import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, open, readdir, rename, rmdir, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import {
  canonicalDescriptionLanguage,
  descriptionEntryIdentity,
  validateDescriptionEntry,
  validateDescriptionTranslationRequest,
  validateDescriptionTranslationText,
} from './description-translations.ts'
import type {
  DescriptionEntry,
  DescriptionTranslationBatch,
  DescriptionTranslationErrorCode,
  DescriptionTranslationResult,
  TranslationRecord,
} from './description-translations.ts'

export type DescriptionTranslationGenerate = (entry: DescriptionEntry, language: string, signal: AbortSignal) => Promise<string>
export type DescriptionTranslationGenerateBatch = (entries: readonly DescriptionEntry[], language: string, signal: AbortSignal) => Promise<readonly string[]>

export interface DescriptionTranslationStoreOptions {
  /** Host-owned data directory, never a skill/plugin source directory. */
  dataDir: string
  generate: DescriptionTranslationGenerate
  /** Total per-record budget including waiting for generation capacity. Default 30s, max 120s. */
  timeoutMs?: number
  /** Default 4, max 16; first instance sets the shared limit for this dataDir. */
  maxConcurrentGenerations?: number
}

export interface DescriptionTranslationOptions {
  /** Cancels this caller; a shared generation is cancelled only when all callers leave. */
  signal?: AbortSignal
}

export const DEFAULT_DESCRIPTION_TRANSLATION_TIMEOUT_MS = 30_000
export const MAX_DESCRIPTION_TRANSLATION_TIMEOUT_MS = 120_000
const MAX_RECORD_BYTES = 128 * 1024

class TranslationFailure extends Error {
  code: DescriptionTranslationErrorCode

  constructor(code: DescriptionTranslationErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

function abortFailure(): TranslationFailure {
  return new TranslationFailure('aborted', 'Description translation was aborted')
}

function checkSignal(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason instanceof TranslationFailure ? signal.reason : abortFailure()
}

/** Reject even when a generator ignores its signal, and consume late rejections. */
function withSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((accept, reject) => {
    const abort = () => reject(signal.reason instanceof TranslationFailure ? signal.reason : abortFailure())
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
    promise.then(accept, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

/** Only backend code imports crypto. No raw ids/languages ever become path segments. */
export function descriptionTranslationKey(value: DescriptionEntry, language: string): string {
  const entry = validateDescriptionEntry(value)
  // UTF-16 preserves even lone surrogates; UTF-8 would collapse distinct strings to U+FFFD.
  const sourceHash = createHash('sha256').update(entry.source, 'utf16le').digest('hex')
  return createHash('sha256').update(JSON.stringify([entry.kind, entry.id, sourceHash, canonicalDescriptionLanguage(language)]), 'utf8').digest('hex')
}

type SuccessfulResult = Extract<DescriptionTranslationResult, { record: TranslationRecord }>
interface Flight {
  controller: AbortController
  promise: Promise<SuccessfulResult>
  waiters: number
}
interface DirectoryState {
  flights: Map<string, Flight>
  concurrency: number
  active: number
  queue: Array<() => void>
}
// Sharing by resolved directory also coalesces requests across store instances in this process.
// The filesystem lock below additionally coordinates independent host processes.
const directories = new Map<string, DirectoryState>()
const LOCK_POLL_MS = 25
const LOCK_OWNER_PATTERN = /^([1-9][0-9]*)\.([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.owner$/u

function checkDeadline(signal: AbortSignal, deadline: number): void {
  checkSignal(signal)
  if (Date.now() >= deadline) throw new TranslationFailure('timeout', 'Description translation timed out')
}

function waitForLock(signal: AbortSignal, deadline: number): Promise<void> {
  checkDeadline(signal, deadline)
  return new Promise((accept, reject) => {
    const abort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      reject(signal.reason instanceof TranslationFailure ? signal.reason : abortFailure())
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      accept()
    }, Math.min(LOCK_POLL_MS, Math.max(1, deadline - Date.now())))
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
  })
}

export class DescriptionTranslationStore {
  readonly dataDir: string
  readonly recordDir: string
  private readonly generate: DescriptionTranslationGenerate
  private readonly timeoutMs: number
  private readonly state: DirectoryState

  constructor(options: DescriptionTranslationStoreOptions) {
    if (typeof options.dataDir !== 'string' || !options.dataDir.trim()) throw new TypeError('dataDir must be nonempty')
    if (typeof options.generate !== 'function') throw new TypeError('generate must be a function')
    const timeoutMs = options.timeoutMs ?? DEFAULT_DESCRIPTION_TRANSLATION_TIMEOUT_MS
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_DESCRIPTION_TRANSLATION_TIMEOUT_MS) {
      throw new TypeError('timeoutMs must be an integer between 1 and 120000')
    }
    const concurrency = options.maxConcurrentGenerations ?? 4
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) throw new TypeError('maxConcurrentGenerations must be between 1 and 16')
    this.dataDir = resolve(options.dataDir)
    this.recordDir = join(this.dataDir, 'description-translations', 'v1')
    this.generate = options.generate
    this.timeoutMs = timeoutMs
    let state = directories.get(this.recordDir)
    if (!state) {
      state = { flights: new Map(), concurrency, active: 0, queue: [] }
      directories.set(this.recordDir, state)
    }
    this.state = state
  }

  /** Read-only: no model calls, no directory creation, no automatic filling of misses. */
  async lookup(entries: unknown, language: unknown): Promise<DescriptionTranslationBatch> {
    const request = validateDescriptionTranslationRequest({ entries, language })
    const results = await Promise.all(request.entries.map(async entry => {
      try {
        const record = await this.readRecord(entry, request.language)
        return record ? { entry, status: 'cached' as const, record } : { entry, status: 'missing' as const }
      } catch (error) {
        return this.errorResult(entry, error)
      }
    }))
    return { language: request.language, results }
  }

  /** Explicit generation only. Valid requests always get per-entry partial results. */
  async translate(entries: unknown, language: unknown, options: DescriptionTranslationOptions = {}): Promise<DescriptionTranslationBatch> {
    const request = validateDescriptionTranslationRequest({ entries, language })
    const results = await Promise.all(request.entries.map(async entry => {
      try {
        if (options.signal?.aborted) throw abortFailure()
        return await this.joinFlight(entry, request.language, options.signal)
      } catch (error) {
        return this.errorResult(entry, error)
      }
    }))
    return { language: request.language, results }
  }

  /** One model call for all unique misses. The caller splits requests by byte budget. */
  async translateBatch(entries: unknown, language: unknown, generateBatch: DescriptionTranslationGenerateBatch, options: DescriptionTranslationOptions = {}): Promise<DescriptionTranslationBatch> {
    const request = validateDescriptionTranslationRequest({ entries, language })
    if (typeof generateBatch !== 'function') throw new TypeError('generateBatch must be a function')
    const unique = new Map<string, DescriptionEntry>()
    for (const entry of request.entries) unique.set(descriptionTranslationKey(entry, request.language), entry)
    const results = new Map<string, DescriptionTranslationResult>()
    const controller = new AbortController()
    const abort = () => controller.abort(abortFailure())
    options.signal?.addEventListener('abort', abort, { once: true })
    if (options.signal?.aborted) abort()
    const deadline = Date.now() + this.timeoutMs
    const timer = setTimeout(() => controller.abort(new TranslationFailure('timeout', 'Description translation timed out')), this.timeoutMs)
    try {
      await withSignal(this.fillBatch(unique, request.language, generateBatch, results, controller.signal, deadline), controller.signal)
    } catch (error) {
      for (const [key, entry] of unique) {
        if (!results.has(key)) results.set(key, this.errorResult(entry, error))
      }
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', abort)
    }
    return {
      language: request.language,
      results: request.entries.map(entry => ({ ...results.get(descriptionTranslationKey(entry, request.language))!, entry })),
    }
  }

  private async fillBatch(entries: Map<string, DescriptionEntry>, language: string, generateBatch: DescriptionTranslationGenerateBatch, results: Map<string, DescriptionTranslationResult>, signal: AbortSignal, deadline: number): Promise<void> {
    checkDeadline(signal, deadline)
    const missing = new Map<string, DescriptionEntry>()
    for (const [key, entry] of entries) {
      try {
        const cached = await this.readRecord(entry, language)
        checkDeadline(signal, deadline)
        if (cached) results.set(key, { entry, status: 'cached', record: cached })
        else missing.set(key, entry)
      } catch (error) {
        checkDeadline(signal, deadline)
        results.set(key, this.errorResult(entry, error))
      }
    }
    const locks: Array<() => Promise<void>> = []
    const releaseLocks = async () => {
      // Try every owned token even if another lock's cleanup fails.
      const released = await Promise.allSettled(locks.reverse().map(release => release()))
      const failed = released.find(result => result.status === 'rejected')
      if (failed?.status === 'rejected') throw failed.reason
    }
    let generation: Promise<unknown> | undefined
    let generationSettled = true
    try {
      // A total ordering prevents deadlock for partially overlapping batches.
      for (const key of [...missing.keys()].sort()) {
        try {
          locks.push(await this.acquireRecordLock(key, signal, deadline))
        } catch (error) {
          checkDeadline(signal, deadline)
          results.set(key, this.errorResult(missing.get(key)!, error))
          missing.delete(key)
        }
      }
      // Re-read only after acquiring all locks: another batch/process may have filled
      // any subset while we waited. Keep callback ordering independent of lock order.
      for (const [key, entry] of missing) {
        try {
          const cached = await this.readRecord(entry, language)
          checkDeadline(signal, deadline)
          if (cached) {
            results.set(key, { entry, status: 'cached', record: cached })
            missing.delete(key)
          }
        } catch (error) {
          checkDeadline(signal, deadline)
          results.set(key, this.errorResult(entry, error))
          missing.delete(key)
        }
      }
      if (!missing.size) return
      const release = await this.acquire(signal)
      let output: unknown
      try {
        try {
          checkDeadline(signal, deadline)
          generationSettled = false
          generation = Promise.resolve().then(() => {
            checkDeadline(signal, deadline)
            // Copies protect both identity and ordering from provider mutation.
            return generateBatch([...missing.values()].map(entry => ({ ...entry })), language, signal)
          }).finally(() => { generationSettled = true })
          output = await withSignal(generation, signal)
        } catch (error) {
          checkSignal(signal)
          if (error instanceof TranslationFailure) throw error
          throw new TranslationFailure('generation-failed', 'Description translation generation failed')
        }
      } finally {
        release()
      }
      checkDeadline(signal, deadline)
      let texts: string[]
      try {
        if (!Array.isArray(output) || output.length !== missing.size) throw new TypeError('Invalid batch count')
        // Array.from validates sparse holes as well. Validate ALL before writing ANY.
        texts = Array.from(output, validateDescriptionTranslationText)
      } catch {
        throw new TranslationFailure('invalid-output', 'Description translation returned invalid batch text')
      }
      let index = 0
      for (const [key, entry] of missing) {
        const record: TranslationRecord = { ...entry, language, text: texts[index++]!, createdAt: new Date().toISOString() }
        try {
          checkDeadline(signal, deadline)
          await this.writeRecord(key, record, signal)
          checkDeadline(signal, deadline)
          results.set(key, { entry, status: 'translated', record })
        } catch (error) {
          checkDeadline(signal, deadline)
          results.set(key, this.errorResult(entry, error))
        }
      }
    } finally {
      if (generation && !generationSettled) {
        // Bound the caller, not the lock lifetime: late abandoned output is never
        // persisted, and overlapping callbacks wait for actual provider settlement.
        void generation.then(releaseLocks, releaseLocks).catch(() => {})
      } else {
        await releaseLocks()
      }
    }
  }

  private errorResult(entry: DescriptionEntry, error: unknown): DescriptionTranslationResult {
    const code = error instanceof TranslationFailure ? error.code : 'storage-failed'
    // Never relay arbitrary provider errors (which may contain credentials or prompt text).
    const message = error instanceof TranslationFailure ? error.message : 'Description translation storage failed'
    return { entry, status: 'error', error: { code, message } }
  }

  private async readRecord(entry: DescriptionEntry, language: string): Promise<TranslationRecord | undefined> {
    const target = join(this.recordDir, `${descriptionTranslationKey(entry, language)}.json`)
    let handle
    try {
      handle = await open(target, 'r')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
    let contents: string
    try {
      if ((await handle.stat()).size > MAX_RECORD_BYTES) return undefined
      // A bounded read also protects against a file growing after stat().
      const buffer = Buffer.alloc(MAX_RECORD_BYTES + 1)
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      if (bytesRead > MAX_RECORD_BYTES) return undefined
      contents = buffer.toString('utf8', 0, bytesRead)
    } finally {
      await handle.close()
    }
    try {
      const value = JSON.parse(contents) as Record<string, unknown>
      const stored = validateDescriptionEntry(value)
      if (descriptionEntryIdentity(stored) !== descriptionEntryIdentity(entry) || value.language !== language) return undefined
      const text = validateDescriptionTranslationText(value.text)
      if (typeof value.createdAt !== 'string' || value.createdAt.length !== 24 || new Date(value.createdAt).toISOString() !== value.createdAt) return undefined
      return { ...stored, language, text, createdAt: value.createdAt }
    } catch {
      // Corrupt/invalid records are misses, not permanent cached failures.
      return undefined
    }
  }

  private joinFlight(entry: DescriptionEntry, language: string, signal?: AbortSignal): Promise<SuccessfulResult> {
    const key = descriptionTranslationKey(entry, language)
    let flight = this.state.flights.get(key)
    if (!flight) {
      const controller = new AbortController()
      const deadline = Date.now() + this.timeoutMs
      const timer = setTimeout(() => controller.abort(new TranslationFailure('timeout', 'Description translation timed out')), this.timeoutMs)
      const started: Flight = { controller, waiters: 0, promise: Promise.resolve().then(() => withSignal(this.fill(entry, language, key, controller.signal, deadline), controller.signal)) }
      flight = started
      this.state.flights.set(key, flight)
      // Install cleanup before callers attach, so retries after failure get a new flight.
      started.promise = started.promise.finally(() => {
        clearTimeout(timer)
        if (this.state.flights.get(key) === started) this.state.flights.delete(key)
      })
    }
    const shared = flight
    shared.waiters++
    return new Promise((accept, reject) => {
      let done = false
      const finish = (error?: unknown, result?: SuccessfulResult) => {
        if (done) return
        done = true
        signal?.removeEventListener('abort', abort)
        shared.waiters--
        if (error !== undefined) reject(error)
        else accept(result!)
        if (!shared.waiters) {
          if (!shared.controller.signal.aborted) shared.controller.abort(abortFailure())
          if (this.state.flights.get(key) === shared) this.state.flights.delete(key)
        }
      }
      const abort = () => finish(abortFailure())
      signal?.addEventListener('abort', abort, { once: true })
      shared.promise.then(result => finish(undefined, result), error => finish(error))
      if (signal?.aborted) abort()
    })
  }

  private async acquire(signal: AbortSignal): Promise<() => void> {
    checkSignal(signal)
    const release = () => {
      this.state.active--
      this.state.queue.shift()?.()
    }
    if (this.state.active >= this.state.concurrency) {
      await new Promise<void>((accept, reject) => {
        const wake = () => {
          signal.removeEventListener('abort', abort)
          // Reserve synchronously: new arrivals cannot steal the awakened slot.
          this.state.active++
          accept()
        }
        const abort = () => {
          const index = this.state.queue.indexOf(wake)
          if (index >= 0) this.state.queue.splice(index, 1)
          reject(signal.reason)
        }
        this.state.queue.push(wake)
        signal.addEventListener('abort', abort, { once: true })
      })
    } else {
      this.state.active++
    }
    if (signal.aborted) {
      release()
      checkSignal(signal)
    }
    return release
  }

  private lockPath(key: string): string {
    if (!/^[a-f0-9]{64}$/u.test(key)) throw new Error('Invalid lock key')
    const target = join(this.recordDir, `${key}.lock`)
    if (dirname(target) !== this.recordDir) throw new Error('Invalid lock path')
    return target
  }

  /** Remove only our exact token, never recursively delete a lock or unknown files. */
  private async releaseRecordLock(target: string, owner: string): Promise<void> {
    if (dirname(target) !== this.recordDir || !target.endsWith('.lock') || !LOCK_OWNER_PATTERN.test(owner)) throw new Error('Invalid lock path')
    if (!(await lstat(target)).isDirectory()) throw new Error('Invalid lock directory')
    const marker = join(target, owner)
    if (dirname(marker) !== target) throw new Error('Invalid lock owner path')
    try {
      await unlink(marker)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    // Only the process that successfully removed the token may remove this directory.
    // A second stale observer must not remove a newly acquired (temporarily empty) lock.
    await rmdir(target).catch(error => {
      if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
    })
  }

  private async recoverDeadRecordLock(target: string): Promise<void> {
    try {
      if (!(await lstat(target)).isDirectory()) return
      const files = await readdir(target)
      if (files.length !== 1) return
      const match = LOCK_OWNER_PATTERN.exec(files[0]!)
      if (!match) return
      const pid = Number(match[1])
      if (!Number.isSafeInteger(pid) || pid > 2_147_483_647) return
      const marker = await lstat(join(target, files[0]!))
      if (!marker.isFile() || marker.size !== 0) return
      try {
        process.kill(pid, 0)
        return // Live (including PID reuse): never steal its lock, regardless of age.
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') return // EPERM is not proof of death.
      }
      await this.releaseRecordLock(target, files[0]!)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  private async acquireRecordLock(key: string, signal: AbortSignal, deadline: number): Promise<() => Promise<void>> {
    const target = this.lockPath(key)
    // PID + UUID live in the exclusively created filename; there is no partially written metadata.
    const owner = `${process.pid}.${randomUUID()}.owner`
    await mkdir(this.recordDir, { recursive: true })
    while (true) {
      checkDeadline(signal, deadline)
      try {
        await mkdir(target, { mode: 0o700 })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
        await this.recoverDeadRecordLock(target)
        await waitForLock(signal, deadline)
        continue
      }
      // If token creation fails, retain the incomplete lock: without an owned token
      // cleanup cannot safely distinguish it from a directory replaced by another actor.
      const handle = await open(join(target, owner), 'wx', 0o600)
      await handle.close()
      let released = false
      return async () => {
        if (released) return
        released = true
        await this.releaseRecordLock(target, owner)
      }
    }
  }

  private async fill(entry: DescriptionEntry, language: string, key: string, signal: AbortSignal, deadline: number): Promise<SuccessfulResult> {
    checkSignal(signal)
    const cached = await this.readRecord(entry, language)
    checkSignal(signal)
    if (cached) return { entry, status: 'cached', record: cached }
    const releaseLock = await this.acquireRecordLock(key, signal, deadline)
    let generation: Promise<unknown> | undefined
    let generationSettled = true
    try {
      checkDeadline(signal, deadline)
      // Another process may have completed while we waited. Never infer/overwrite that record.
      const current = await this.readRecord(entry, language)
      checkDeadline(signal, deadline)
      if (current) return { entry, status: 'cached', record: current }
      const release = await this.acquire(signal)
      let output: unknown
      try {
        try {
          // Timers may be delayed; do not start stale queued model calls after their deadline.
          checkDeadline(signal, deadline)
          // Pass a separate copy so a generator cannot mutate the request/cache identity.
          generationSettled = false
          generation = Promise.resolve().then(() => {
            checkDeadline(signal, deadline)
            return this.generate({ ...entry }, language, signal)
          }).finally(() => { generationSettled = true })
          output = await withSignal(generation, signal)
        } catch (error) {
          checkSignal(signal)
          if (error instanceof TranslationFailure) throw error
          throw new TranslationFailure('generation-failed', 'Description translation generation failed')
        }
      } finally {
        release()
      }
      checkDeadline(signal, deadline)
      let text: string
      try {
        text = validateDescriptionTranslationText(output)
      } catch {
        throw new TranslationFailure('invalid-output', 'Description translation returned invalid text')
      }
      const record: TranslationRecord = { ...entry, language, text, createdAt: new Date().toISOString() }
      await this.writeRecord(key, record, signal)
      return { entry, status: 'translated', record }
    } finally {
      if (generation && !generationSettled) {
        // Callers still abort/timeout promptly, but ignored-abort inference must keep its lock
        // until it actually settles. No lease can safely expire for a still-running callback.
        void generation.then(releaseLock, releaseLock).catch(() => {})
      } else {
        await releaseLock()
      }
    }
  }

  private async writeRecord(key: string, record: TranslationRecord, signal: AbortSignal): Promise<void> {
    await mkdir(this.recordDir, { recursive: true })
    checkSignal(signal)
    const target = join(this.recordDir, `${key}.json`)
    const temporary = join(this.recordDir, `${key}.${randomUUID()}.tmp`)
    // All paths are controlled hashed filenames and verified in the assigned data directory.
    if (dirname(target) !== this.recordDir || dirname(temporary) !== this.recordDir) throw new Error('Invalid record path')
    try {
      const handle = await open(temporary, 'wx', 0o600)
      try {
        await handle.writeFile(JSON.stringify(record), 'utf8')
        await handle.sync()
      } finally {
        await handle.close()
      }
      checkSignal(signal)
      await rename(temporary, target)
    } finally {
      await unlink(temporary).catch(error => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      })
    }
  }
}
