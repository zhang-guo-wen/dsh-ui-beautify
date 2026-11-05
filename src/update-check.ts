/**
 * What is published, and is it newer than what is running.
 *
 * The row under the installed version shows the newest release the desktop
 * shell would install, so it reads the same `electron-updater` manifest the
 * shell's own updater reads: one feed, one answer. The manifest is located the
 * way the shell locates it — `<resources>/app-update.yml` names the feed URL and
 * the channel, and the channel names the file (`nightly.yml`, `latest.yml`).
 *
 * Nothing here installs anything. Upgrading is the shell's existing flow; this
 * module only answers "what is published". A host that has no such file — a
 * plain `dsh web` install, or a desktop build without an updater — reports
 * `unavailable`, and the row stays out of the way.
 *
 * @module @guowenzhang/dsh-ui-beautify/update-check
 */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** How long one reading answers later requests, in milliseconds. */
export const UPDATE_CACHE_MS = 10 * 60 * 1000

/** How long one manifest request may take, in milliseconds. */
export const UPDATE_TIMEOUT_MS = 10_000

/** One answer about the published release. */
export interface UpdateStatus {
  /**
   * `ok` compared a published version, `unavailable` found no feed at all, and
   * `failed` found one that could not be read.
   */
  state: 'ok' | 'unavailable' | 'failed'
  /** The running release, or null when the build carries no version. */
  current: string | null
  /** The published release, or null when it is unknown. */
  latest: string | null
  /** Whether `latest` is newer than `current`; false whenever either is unknown. */
  hasUpdate: boolean
  /** The manifest that was read, or null when no feed was found. */
  feed: string | null
  /** When this answer was produced (epoch milliseconds). */
  checkedAt: number
}

/** A parsed counterpart of a version, in the order semver compares it. */
interface VersionParts {
  core: number[]
  pre: string[]
}

/**
 * Split a release version into the parts semver orders.
 *
 * Build metadata (`+sha`) never affects precedence, so it is dropped; a leading
 * `v` is dropped for the same reason the updater drops it.
 * @param version - the release version.
 * @returns its comparable parts, or undefined when it is not a version.
 */
function versionParts(version: string): VersionParts | undefined {
  const trimmed = version.trim().replace(/^v/i, '').split('+')[0]
  if (trimmed === undefined || trimmed === '') return undefined
  const [core, pre] = trimmed.split('-', 2)
  if (core === undefined) return undefined
  const numbers: number[] = []
  for (const piece of core.split('.')) {
    if (!/^\d+$/.test(piece)) return undefined
    numbers.push(Number(piece))
  }
  while (numbers.length < 3) numbers.push(0)
  return { core: numbers, pre: pre === undefined ? [] : pre.split('.') }
}

/**
 * Compare two release versions the way the updater ranks them.
 *
 * Numeric prerelease identifiers compare as numbers and rank below
 * alphanumeric ones; a version without a prerelease outranks every prerelease
 * of the same core. An unparsable side makes the two compare equal, so a
 * malformed manifest reads as "nothing to upgrade to" instead of an upgrade
 * that can never install.
 * @param left - the first version.
 * @param right - the second version.
 * @returns a negative number when `left` is older, zero when equal, a positive number when newer.
 */
export function compareVersions(left: string, right: string): number {
  const a = versionParts(left)
  const b = versionParts(right)
  if (a === undefined || b === undefined) return 0
  const length = Math.max(a.core.length, b.core.length)
  for (let at = 0; at < length; at += 1) {
    const difference = (a.core[at] ?? 0) - (b.core[at] ?? 0)
    if (difference !== 0) return difference
  }
  if (a.pre.length === 0 || b.pre.length === 0) {
    if (a.pre.length === b.pre.length) return 0
    return a.pre.length === 0 ? 1 : -1
  }
  const preLength = Math.max(a.pre.length, b.pre.length)
  for (let at = 0; at < preLength; at += 1) {
    const one = a.pre[at]
    const other = b.pre[at]
    if (one === undefined) return -1
    if (other === undefined) return 1
    const oneNumeric = /^\d+$/.test(one)
    const otherNumeric = /^\d+$/.test(other)
    if (oneNumeric && otherNumeric) {
      const difference = Number(one) - Number(other)
      if (difference !== 0) return difference
      continue
    }
    // A numeric identifier always ranks below an alphanumeric one.
    if (oneNumeric !== otherNumeric) return oneNumeric ? -1 : 1
    if (one !== other) return one < other ? -1 : 1
  }
  return 0
}

/**
 * Read the release version out of an `electron-updater` manifest.
 * @param text - the manifest (`latest.yml` / `nightly.yml`) contents.
 * @returns the version it announces, or undefined when it announces none.
 */
export function parseManifestVersion(text: string): string | undefined {
  const match = /^version:[ \t]*["']?([^"'\s]+)["']?[ \t]*$/m.exec(text)
  return match?.[1]
}

/** What a desktop shell's `app-update.yml` says about its release feed. */
export interface DesktopUpdateFeed {
  /** The directory the channel's manifest is fetched from, ending in a slash. */
  readonly url: string
  /** The updater channel (`nightly`, `latest`, …). */
  readonly channel: string
  /** The manifest file name the channel resolves to. */
  readonly manifest: string
}

/**
 * Read the feed coordinates out of a desktop shell's `app-update.yml`.
 * @param text - the file's contents.
 * @returns the feed, or undefined when the file names no generic feed URL.
 */
export function parseAppUpdateYaml(text: string): DesktopUpdateFeed | undefined {
  const url = /^url:[ \t]*["']?([^"'\s]+)["']?[ \t]*$/m.exec(text)?.[1]
  if (url === undefined) return undefined
  const channel = /^channel:[ \t]*["']?([^"'\s]+)["']?[ \t]*$/m.exec(text)?.[1] ?? 'latest'
  return { url: url.endsWith('/') ? url : `${url}/`, channel, manifest: `${channel}.yml` }
}

/**
 * Locate the desktop shell's `app-update.yml` beside a running executable.
 *
 * A packaged Windows or Linux shell keeps it in `<exe dir>/resources`; a macOS
 * bundle keeps it in `Contents/Resources`, one level above the executable.
 * @param execPath - the shell's executable path, as the Host process reports it.
 * @returns the file's contents, or undefined when there is no such file.
 */
export async function readDesktopUpdateFeed(execPath: string): Promise<DesktopUpdateFeed | undefined> {
  const executable = dirname(execPath)
  const candidates = [join(executable, 'resources', 'app-update.yml'), join(executable, '..', 'Resources', 'app-update.yml')]
  for (const candidate of candidates) {
    try {
      const text = await readFile(candidate, 'utf8')
      const feed = parseAppUpdateYaml(text)
      if (feed !== undefined) return feed
    } catch {
      // No file here is the ordinary answer for a Web install; the next
      // candidate, then the caller's "unavailable", covers the rest.
    }
  }
  return undefined
}

/**
 * The manifest URL one reading should fetch.
 * @param configured - the plugin configuration's own URL, when a deployment set one.
 * @param discovered - the feed read from the desktop shell, when it had one.
 * @returns the URL to fetch, or undefined when neither side named a feed.
 */
export function resolveFeedUrl(configured: string, discovered: DesktopUpdateFeed | undefined): string | undefined {
  const trimmed = configured.trim()
  if (trimmed !== '') return /^https?:\/\//i.test(trimmed) ? trimmed : undefined
  if (discovered === undefined) return undefined
  try {
    return new URL(discovered.manifest, discovered.url).href
  } catch {
    return undefined
  }
}

/** One HTTP answer, narrowed to what this module reads. */
export interface FetchAnswer {
  readonly ok: boolean
  readonly status: number
  text(): Promise<string>
}

/** What one reading needs from its surroundings. */
export interface UpdateCheckerOptions {
  /** The running release, or undefined when the build carries no version. */
  current: string | undefined
  /** Resolves the manifest URL for this reading; undefined means there is no feed. */
  resolveFeed: () => Promise<string | undefined>
  /** Manifest transport; defaults to the global `fetch`. */
  fetchText?: (url: string, signal: AbortSignal) => Promise<FetchAnswer>
  /** Clock, so a test can age a cached answer. */
  now?: () => number
  /** How long an answer is reused. */
  ttlMs?: number
  /** How long one request may take. */
  timeoutMs?: number
}

/**
 * One reading of the published release, shared by every request that asks.
 *
 * The row is rendered every time the settings page opens, so an answer is
 * reused for a TTL rather than re-fetched per open; a caller that asks for a
 * fresh reading joins whatever request is already in flight instead of
 * starting a second one.
 */
export class UpdateChecker {
  private cached: UpdateStatus | undefined
  private pending: Promise<UpdateStatus> | undefined

  /** @param options - the running version, the feed resolver, and the transport. */
  constructor(private readonly options: UpdateCheckerOptions) {}

  /**
   * Answer what is published right now.
   * @param force - whether a cached answer must be replaced by a fresh reading.
   * @returns the answer; failures are reported in it rather than thrown.
   */
  async status(force = false): Promise<UpdateStatus> {
    const now = (this.options.now ?? Date.now)()
    const cached = this.cached
    if (!force && cached !== undefined && now - cached.checkedAt < (this.options.ttlMs ?? UPDATE_CACHE_MS)) {
      return cached
    }
    if (this.pending !== undefined) return this.pending
    const work = this.read(now)
    this.pending = work
    try {
      const answer = await work
      this.cached = answer
      return answer
    } finally {
      this.pending = undefined
    }
  }

  /**
   * Perform one reading.
   * @param checkedAt - the instant this reading speaks for.
   * @returns the answer, with any failure folded into `state`.
   */
  private async read(checkedAt: number): Promise<UpdateStatus> {
    const current = this.options.current ?? null
    const feed = await this.options.resolveFeed().catch(() => undefined)
    const missing: UpdateStatus = { state: 'unavailable', current, latest: null, hasUpdate: false, feed: null, checkedAt }
    if (feed === undefined) return missing
    let answer: FetchAnswer
    try {
      const transport = this.options.fetchText
        ?? ((url, signal) => fetch(url, { signal, headers: { accept: 'text/yaml, text/plain, */*' } }))
      answer = await transport(feed, AbortSignal.timeout(this.options.timeoutMs ?? UPDATE_TIMEOUT_MS))
    } catch {
      // An unreachable feed leaves the published version unknown, which the row
      // reports as a failed check rather than as "up to date".
      return { state: 'failed', current, latest: null, hasUpdate: false, feed, checkedAt }
    }
    if (!answer.ok) return { state: 'failed', current, latest: null, hasUpdate: false, feed, checkedAt }
    const text = await answer.text().catch(() => '')
    const latest = parseManifestVersion(text)
    if (latest === undefined) return { state: 'failed', current, latest: null, hasUpdate: false, feed, checkedAt }
    const hasUpdate = current !== null && compareVersions(latest, current) > 0
    return { state: 'ok', current, latest, hasUpdate, feed, checkedAt }
  }
}
