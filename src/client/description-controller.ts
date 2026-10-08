/** Shared UI cache. Only run() generates translations; reads are model-free. */
import type { DescriptionEntry, TranslationRecord } from '../description-translations.ts'
import { canonicalDescriptionLanguage, descriptionEntryIdentity } from '../description-translations.ts'
import { validateDescriptionResponse, type DescriptionRemote } from '../description-translation-remote.ts'
import { splitDescriptionBatches, DESCRIPTION_BATCH_MAX_BYTES, type DescriptionModelInfo } from '../description-batches.ts'
import type { DescriptionCatalog } from '../description-translation-service.ts'

export interface DescriptionState {
  revision: number; phase: 'loading' | 'ready' | 'running' | 'cancelled' | 'unavailable' | 'error'
  total: number; completed: number; cached: number; failed: number; warnings: readonly string[]
  language: string; error: string
  model: DescriptionModelInfo | null; pluginCount: number; skillCount: number; workspaceCount: number
  maxBatchBytes: number
  progress: { plugins: { completed: number; total: number }; skills: { completed: number; total: number }; workspaceSkills: { completed: number; total: number } }
}
export interface DescriptionLocale { getSnapshot(): { active: string }; subscribe(listener: () => void): () => void }
export class DescriptionController {
  private state: DescriptionState
  private readonly listeners = new Set<() => void>()
  private readonly scopes = new Map<string, readonly DescriptionEntry[]>()
  private readonly generations = new Map<string, number>()
  private readonly names = new Map<string, readonly { name: string; id: string }[]>()
  private readonly pluginTitles = new Set<string>()
  private readonly records = new Map<string, TranslationRecord>()
  private readonly catalogs = new Map<string, Promise<void>>()
  private readonly abort = new AbortController()
  private readonly offLocale: () => void
  private sessionId: string | undefined
  private disposed = false
  private runPromise: Promise<void> | undefined
  private runAbort: AbortController | undefined
  private progressGroups: DescriptionCatalog['progressGroups'] = { plugins: [], skills: [], workspaceSkills: [] }
  private api: DescriptionRemote | undefined
  private readonly locale: DescriptionLocale
  constructor(api: DescriptionRemote | undefined, locale: DescriptionLocale) {
    this.api = api
    this.locale = locale
    this.state = { revision: 0, phase: api ? 'loading' : 'unavailable', total: 0, completed: 0, cached: 0, failed: 0,
      warnings: [], language: canonicalDescriptionLanguage(locale.getSnapshot().active), error: '',
      model: null, pluginCount: 0, skillCount: 0, workspaceCount: 0, maxBatchBytes: DESCRIPTION_BATCH_MAX_BYTES,
      progress: { plugins: {completed:0,total:0}, skills: {completed:0,total:0}, workspaceSkills: {completed:0,total:0} } }
    this.offLocale = locale.subscribe(() => {
      const language = canonicalDescriptionLanguage(locale.getSnapshot().active)
      if (language === this.state.language) return
      this.publish({ language })
      void this.loadCatalog(this.sessionId)
    })
    if (api) void this.loadCatalog()
  }
  connect(api: DescriptionRemote | undefined): void {
    if (this.disposed) return
    this.api = api
    this.publish({ phase: api ? 'loading' : 'unavailable' })
    if (api) void this.loadCatalog(this.sessionId, true)
  }
  getSnapshot = (): DescriptionState => this.state
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private publish(patch: Partial<DescriptionState> = {}): void {
    if (this.disposed) return
    this.state = { ...this.state, ...patch, revision: this.state.revision + 1 }
    for (const listener of [...this.listeners]) listener()
  }
  dispose(): void { this.disposed = true; this.abort.abort(); this.offLocale(); this.listeners.clear() }
  currentSession(): string | undefined { return this.sessionId }
  reset(): void {
    for (const key of this.generations.keys()) this.generations.set(key, (this.generations.get(key) ?? 0) + 1)
    this.scopes.clear(); this.names.clear(); this.catalogs.clear(); this.pluginTitles.clear()
    this.publish()
    void this.loadCatalog(this.sessionId, true)
  }
  observeSession(sessionId: string | undefined): void {
    if (!sessionId || sessionId === this.sessionId) return
    this.sessionId = sessionId
    void this.loadCatalog(sessionId, true)
  }
  private scopeKey(sessionId?: string, language = this.state.language): string { return JSON.stringify([language, sessionId ?? 'global']) }
  private entriesFor(sessionId?: string): readonly DescriptionEntry[] { return this.scopes.get(this.scopeKey(sessionId)) ?? [] }
  invalidate(sessionId?: string): void {
    const scope = this.scopeKey(sessionId)
    this.generations.set(scope, (this.generations.get(scope) ?? 0) + 1)
    this.scopes.delete(scope)
    this.catalogs.delete(scope)
    this.publish()
    void this.loadCatalog(sessionId, true)
  }
  private accept(batch: Awaited<ReturnType<DescriptionRemote['lookup']>>): void {
    if (!batch.ok) throw new Error(batch.error.message)
    validateDescriptionResponse(batch.value)
    for (const result of batch.value.results) {
      if (result.status === 'cached' || result.status === 'translated') {
        this.records.set(`${result.record.language}:${descriptionEntryIdentity(result.record)}`, result.record)
      }
    }
    this.publish({ progress: this.progressSnapshot() })
  }
  async loadCatalog(sessionId?: string, force = false): Promise<void> {
    if (!this.api || this.disposed) return
    const language = this.state.language
    const key = this.scopeKey(sessionId, language)
    if (!force && this.catalogs.has(key)) return this.catalogs.get(key)!
    const scope = key
    const generation = (this.generations.get(scope) ?? 0) + 1
    this.generations.set(scope, generation)
    const task = (async () => {
      const result = await this.api!.catalog({ language, allWorkspaces: true, ...(sessionId ? { sessionId } : {}) }, this.abort.signal)
      // Keep current-session presentation membership separate from the all-workspace translation directory.
      const scoped = sessionId ? await this.api!.catalog({ language, sessionId }, this.abort.signal) : result
      if (!scoped.ok) throw new Error(scoped.error.message)
      if (!result.ok) throw new Error(result.error.message)
      validateDescriptionResponse(result.value)
      if (this.disposed || generation !== (this.generations.get(scope) ?? 0)) return
      this.scopes.set(scope, scoped.value.entries)
      this.names.set(scope, scoped.value.skills ?? [])
      for (const title of result.value.pluginTitles ?? []) this.pluginTitles.add(title)
      for (let at = 0; at < result.value.entries.length; at += 200) {
        this.accept(await this.api!.lookup({ language, entries: result.value.entries.slice(at, at + 200) }, this.abort.signal))
      }
      if (language === this.state.language && generation === this.generations.get(scope)) {
        this.publish({ ...this.catalogInfo(result.value), ...(this.runPromise ? {} : { phase: result.value.available && !!result.value.counts && !!result.value.model && !!result.value.maxBatchBytes && !!result.value.progressGroups ? 'ready' : 'unavailable' }), warnings: result.value.warnings })
      }
    })().catch(error => {
      if (generation !== this.generations.get(scope)) return
      this.catalogs.delete(key)
      if (language === this.state.language) {
        const message = error instanceof Error ? error.message : String(error)
        this.publish({ phase: /HTTP 404|definition-unavailable|service-unavailable/.test(message) ? 'unavailable' : 'error', error: message })
      }
    })
    this.catalogs.set(key, task)
    return task
  }
  /** Exact-source resolution only; no name-only translation matching. */
  resolve(kind: DescriptionEntry['kind'], source: string, id?: string): string {
    const language = this.state.language
    if (id) return this.records.get(`${language}:${descriptionEntryIdentity({ kind, id, source })}`)?.text ?? source
    const matches = [...this.records.values()].filter(record => record.language === language && record.kind === kind && record.source === source)
    const texts = new Set(matches.map(record => record.text))
    return texts.size === 1 ? matches[0]!.text : source
  }
  skillFileDescription(path: string, sessionId?: string): string | undefined {
    const candidates = this.entriesFor(sessionId).filter(entry => entry.kind === 'skill' && entry.id === path)
    if (candidates.length !== 1) return undefined
    const source = candidates[0]!.source
    const text = this.resolve('skill', source, path)
    return text === source ? undefined : text
  }
  skillDescription(name: string, sessionId?: string): string | undefined {
    const ids = new Set((this.names.get(this.scopeKey(sessionId)) ?? []).filter(skill => skill.name === name).map(skill => skill.id))
    const candidates = this.entriesFor(sessionId).filter(entry => entry.kind === 'skill' && ids.has(entry.id))
    const descriptions = new Set(candidates.map(entry => entry.source))
    if (descriptions.size !== 1) return undefined
    const source = candidates[0]!.source
    const text = this.resolve('skill', source)
    return text === source ? undefined : text
  }
  resolveSkillCandidate(source: string): string {
    const exact = this.resolve('skill', source)
    if (exact !== source) return exact
    // The host's localized user-only marker stays untouched.
    const matching = [...this.scopes.values()].flat().filter(entry => entry.kind === 'skill' && source.endsWith(` · ${entry.source}`))
    if (matching.length === 0) return source
    const description = matching[0]!.source
    return source.slice(0, -description.length) + this.resolve('skill', description)
  }
  cancel = (): void => {
    if (!this.runAbort || this.runAbort.signal.aborted) return
    this.runAbort.abort()
    this.publish({ phase: 'cancelled' })
  }
  run = (): Promise<void> => {
    if (this.runPromise) return this.runPromise
    const controller = new AbortController()
    this.runAbort = controller
    this.runPromise = this.translate(AbortSignal.any([this.abort.signal, controller.signal])).finally(() => {
      this.runPromise = undefined; this.runAbort = undefined
      if (this.state.phase === 'running') this.publish({ phase: 'ready' })
    })
    return this.runPromise
  }
  private catalogInfo(value: DescriptionCatalog): Partial<DescriptionState> {
    this.progressGroups = value.progressGroups ?? {plugins:[],skills:[],workspaceSkills:[]}
    return { progress: this.progressSnapshot(), model: value.model ?? null, pluginCount: value.counts?.plugins ?? 0,
      skillCount: value.counts?.skills ?? 0,
      workspaceCount: value.counts?.workspaces ?? 0, maxBatchBytes: value.maxBatchBytes ?? DESCRIPTION_BATCH_MAX_BYTES }
  }
  private progressSnapshot(): DescriptionState['progress'] {
    const project = (groups: { id: string; entries: string[] }[]) => ({ total: groups.length,
      completed: groups.filter(group => group.entries.every(key => this.records.has(`${this.state.language}:${key}`))).length })
    return {plugins:project(this.progressGroups.plugins),skills:project(this.progressGroups.skills),workspaceSkills:project(this.progressGroups.workspaceSkills)}
  }
  private async translate(signal: AbortSignal): Promise<void> {
    if (!this.api || this.disposed) return
    const language = this.state.language
    const sessionId = this.sessionId
    const scope = this.scopeKey(sessionId, language)
    const generation = (this.generations.get(scope) ?? 0) + 1
    this.generations.set(scope, generation)
    const stillCurrent = (): boolean => !signal.aborted && generation === this.generations.get(scope) && language === this.state.language
    this.publish({ phase: 'running', completed: 0, cached: 0, failed: 0, total: 0, error: '' })
    try {
      const catalog = await this.api.catalog({ language, allWorkspaces: true, ...(sessionId ? { sessionId } : {}) }, signal)
      signal.throwIfAborted()
      if (!catalog.ok) throw new Error(catalog.error.message)
      validateDescriptionResponse(catalog.value)
      if (!catalog.value.counts || !catalog.value.model || !catalog.value.maxBatchBytes || !catalog.value.progressGroups) {
        this.publish({ phase: 'unavailable' })
        return
      }
      const entries = catalog.value.entries
      if (!stillCurrent()) return
      const scoped = sessionId ? await this.api.catalog({ language, sessionId }, signal) : catalog
      signal.throwIfAborted()
      if (!scoped.ok) throw new Error(scoped.error.message)
      this.scopes.set(scope, scoped.value.entries)
      this.names.set(scope, scoped.value.skills ?? [])
      for (const title of catalog.value.pluginTitles ?? []) this.pluginTitles.add(title)
      this.publish({ ...this.catalogInfo(catalog.value), total: entries.length, warnings: catalog.value.warnings })
      const missing: DescriptionEntry[] = []
      let cached = 0
      for (let at = 0; at < entries.length; at += 200) {
        const lookup = await this.api.lookup({ language, entries: entries.slice(at, at + 200) }, signal)
        signal.throwIfAborted()
        this.accept(lookup)
        if (!lookup.ok) throw new Error(lookup.error.message)
        for (const item of lookup.value.results) {
          if (item.status === 'cached') cached++
          else missing.push(item.entry)
        }
      }
      if (!stillCurrent()) return
      const batches = splitDescriptionBatches(missing, language, this.state.maxBatchBytes)
      this.publish({ cached, completed: cached, progress: this.progressSnapshot() })
      for (const batch of batches) {
        signal.throwIfAborted()
        if (!stillCurrent()) return
        const result = await this.api.translate({ language, entries: batch }, signal)
        signal.throwIfAborted()
        this.accept(result)
        if (!result.ok) throw new Error(result.error.message)
        if (!stillCurrent()) return
        this.publish({ model: result.value.model ?? this.state.model,
          completed: this.state.completed + result.value.results.filter(item => item.status === 'cached' || item.status === 'translated').length,
          cached: this.state.cached + result.value.results.filter(item => item.status === 'cached').length,
          failed: this.state.failed + result.value.results.filter(item => item.status === 'error').length,
          progress: this.progressSnapshot() })
      }
      this.publish({ phase: 'ready' })
    } catch (error) { if (stillCurrent()) this.publish({ phase: 'error', error: error instanceof Error ? error.message : String(error) }) }
  }
}
