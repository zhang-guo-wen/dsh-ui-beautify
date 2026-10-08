/** Authenticated Remote API. Translation is explicit; catalog/cache reads never call a model. */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { LlmRuntime } from '@deepseek-ai/dsh-llm'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DescriptionTranslationStore } from './description-translation-store.ts'
import { canonicalDescriptionLanguage, descriptionEntryIdentity, validateDescriptionTranslationRequest, type DescriptionEntry } from './description-translations.ts'
import { translateDescriptionWithModel, type DefaultModelReader } from './description-translation-model.ts'
import { translateDescriptionBatchWithModel } from './description-batch-model.ts'
import { DESCRIPTION_BATCH_MAX_BYTES, descriptionBatchBytes, type DescriptionModelInfo } from './description-batches.ts'

interface TextMap { readonly [locale: string]: string }
type Text = string | TextMap
interface PluginMeta { title?: Text; description?: Text }
interface Bundle { name: string; installed?: boolean; enabled?: boolean; description?: string; meta?: PluginMeta; rows?: { moduleName: string; meta?: PluginMeta }[] }
interface Skill { name: string; description: string; path?: string }
interface PluginDirectory { listBundles(): Promise<Bundle[]> }
interface SessionSkillDirectory { list(request: { sessionId: string }, signal: AbortSignal): Promise<{ skills: Skill[] }> }
interface GlobalSkillDirectory { list(options: { cwd?: string; signal: AbortSignal }): Promise<Skill[]> }
interface WorkspaceDirectory { list(): { path: string }[] }

export interface DescriptionCatalogRequest { language: string; sessionId?: string; allWorkspaces?: boolean }
export interface DescriptionCatalog {
  entries: DescriptionEntry[]; skills: { name: string; id: string }[]; pluginTitles: string[]
  available: boolean; skillScope: 'session' | 'global' | 'all-workspaces'; warnings: string[]
  counts: { plugins: number; skills: number; descriptions: number; workspaces: number }
  progressGroups: { plugins: { id: string; entries: string[] }[]; skills: { id: string; entries: string[] }[]; workspaceSkills: { id: string; entries: string[] }[] }
  model: DescriptionModelInfo | null; maxBatchBytes: number
}

export function pluginDescriptionSource(text: Text | undefined, language: string): string | undefined {
  if (typeof text === 'string') return text.trim() ? text : undefined
  if (!text) return undefined
  const locale = language.toLowerCase()
  // Preserve author translations, including their language fallback.
  if (Object.keys(text).some(key => key.toLowerCase() === locale || key.toLowerCase() === locale.split('-')[0])) return undefined
  return text.en?.trim() ? text.en : undefined
}

function catalogRequest(value: unknown): DescriptionCatalogRequest {
  if (!value || typeof value !== 'object') throw new Error('Invalid catalog request')
  const request = value as Record<string, unknown>
  const language = canonicalDescriptionLanguage(request.language)
  if (request.sessionId !== undefined && (typeof request.sessionId !== 'string' || !request.sessionId || request.sessionId.length > 200)) throw new Error('Invalid session identity')
  if (request.allWorkspaces !== undefined && typeof request.allWorkspaces !== 'boolean') throw new Error('Invalid workspace scope')
  return { language, ...(request.sessionId === undefined ? {} : { sessionId: request.sessionId as string }),
    ...(request.allWorkspaces === undefined ? {} : { allWorkspaces: request.allWorkspaces }) }
}

export class DescriptionTranslationService extends TypertRemoteService {
  readonly store: DescriptionTranslationStore
  constructor(ctx: Context) {
    super(ctx, 'uiBeautifyDescriptions')
    this.store = new DescriptionTranslationStore({
      dataDir: join(process.env.DSH_HOME?.trim() || join(homedir(), '.dsh'), 'data', 'ui-beautify'),
      timeoutMs: 120_000,
      generate: async (entry, language, signal) => {
        const llm = ctx.get('llm') as LlmRuntime | undefined
        const defaults = ctx.get('agentDefaultModel') as DefaultModelReader | undefined
        if (!llm || !defaults) throw new Error('Default model service is unavailable')
        return translateDescriptionWithModel(llm, defaults, entry.source, language, signal)
      },
    })
  }

  @Remote
  async catalog(request: DescriptionCatalogRequest, signal: AbortSignal): Promise<DescriptionCatalog> {
    const parsed = catalogRequest(request)
    const entries: DescriptionEntry[] = []
    const skillNames: { name: string; id: string }[] = []
    const pluginTitles: string[] = []
    const pluginIds = new Set<string>()
    const pluginGroups = new Map<string, Set<string>>()
    const globalGroups = new Map<string, Set<string>>()
    const projectGroups = new Map<string, Set<string>>()
    const addGroup = (groups: Map<string, Set<string>>, id: string, entry?: DescriptionEntry): void => {
      const keys = groups.get(id) ?? new Set<string>()
      if (entry) keys.add(descriptionEntryIdentity(entry))
      groups.set(id, keys)
    }
    let workspaceCount = 0
    const titles = (text: Text | undefined): void => { if (typeof text === 'string') pluginTitles.push(text); else if (text) pluginTitles.push(...Object.values(text)) }
    const warnings: string[] = []
    const plugins = this.ctx.get('pluginManager') as PluginDirectory | undefined
    if (plugins) {
      try {
        for (const pkg of await plugins.listBundles()) {
          if (pkg.installed === false && pkg.enabled !== true) continue
          pluginIds.add(pkg.name)
          titles(pkg.meta?.title)
          pluginTitles.push(pkg.name)
          const source = pluginDescriptionSource(pkg.meta?.description ?? pkg.description, parsed.language)
          addGroup(pluginGroups, pkg.name)
          if (source) {
            const entry: DescriptionEntry = { kind: 'plugin', id: pkg.name, source }
            entries.push(entry); addGroup(pluginGroups, pkg.name, entry)
          }
          for (const row of pkg.rows ?? []) {
            titles(row.meta?.title)
            pluginTitles.push(row.moduleName)
            const source = pluginDescriptionSource(row.meta?.description, parsed.language)
            if (source) {
              const entry: DescriptionEntry = { kind: 'plugin', id: row.moduleName, source }
              entries.push(entry); addGroup(pluginGroups, pkg.name, entry)
            }
          }
        }
      } catch { warnings.push('plugin-catalog-unavailable') }
    } else warnings.push('plugin-catalog-unavailable')
    const scoped = this.ctx.get('sessionSkillCatalog') as SessionSkillDirectory | undefined
    const global = this.ctx.get('skills') as GlobalSkillDirectory | undefined
    const addSkills = (skills: readonly Skill[], category: 'global' | 'project' | 'session'): void => {
      for (const skill of skills) {
        const id = skill.path ?? `skill:${skill.name}`
        const entry: DescriptionEntry = { kind: 'skill', id, source: skill.description }
        entries.push(entry)
        if (category === 'global' || (category === 'session' && !projectGroups.has(id))) addGroup(globalGroups, id, entry)
        else if (!globalGroups.has(id)) addGroup(projectGroups, id, entry)
        skillNames.push({ name: skill.name, id })
      }
    }
    if (parsed.allWorkspaces) {
      if (global) {
        try { addSkills(await global.list({ signal }), 'global') } catch { warnings.push('global-skill-catalog-unavailable') }
        const workspaces = this.ctx.get('workspaceRegistry') as WorkspaceDirectory | undefined
        if (workspaces) {
          const paths = [...new Set(workspaces.list().map(workspace => workspace.path))]
          workspaceCount = paths.length
          for (const cwd of paths) {
            signal.throwIfAborted()
            try { addSkills(await global.list({ cwd, signal }), 'project') } catch { warnings.push(`workspace-skill-catalog-unavailable:${cwd}`) }
          }
        } else warnings.push('workspace-catalog-unavailable')
      } else warnings.push('global-skill-catalog-unavailable')
    }
    if (parsed.sessionId && scoped) {
      try { addSkills((await scoped.list({ sessionId: parsed.sessionId }, signal)).skills, 'session') }
      catch { warnings.push('session-skill-catalog-unavailable') }
    } else if (!parsed.allWorkspaces && global) {
      try { addSkills(await global.list({ signal }), 'global') } catch { warnings.push('global-skill-catalog-unavailable') }
    }
    if (!scoped && !global) warnings.push('skill-catalog-unavailable')
    const unique = [...new Map(entries.filter(entry => entry.source.trim() && entry.source.length <= 4000 && entry.id.length <= 512)
      .map(entry => [JSON.stringify([entry.kind, entry.id, entry.source]), entry])).values()]
    const defaults = this.ctx.get('agentDefaultModel') as DefaultModelReader | undefined
    const selected = defaults?.currentSelection()
    const model = selected?.provider && selected.model ? { provider: selected.provider, model: selected.model,
      ...(selected.reasoningEffort ? { reasoningEffort: selected.reasoningEffort } : {}) } : null
    const validKeys = new Set(unique.map(descriptionEntryIdentity))
    const groups = (source: Map<string, Set<string>>) => [...source].map(([id, keys]) => ({ id, entries: [...keys].filter(key => validKeys.has(key)) }))
    return { progressGroups: { plugins: groups(pluginGroups), skills: groups(globalGroups), workspaceSkills: groups(projectGroups) },
      entries: unique, skills: [...new Map(skillNames.map(skill => [JSON.stringify([skill.name, skill.id]), skill])).values()], pluginTitles,
      available: !!this.ctx.get('llm') && model !== null, model, maxBatchBytes: DESCRIPTION_BATCH_MAX_BYTES,
      counts: { plugins: pluginIds.size, skills: new Set(skillNames.map(skill => skill.id)).size, descriptions: unique.length, workspaces: workspaceCount },
      skillScope: parsed.allWorkspaces ? 'all-workspaces' : parsed.sessionId && scoped ? 'session' : 'global', warnings }
  }

  @Remote
  async lookup(request: { language: string; entries: DescriptionEntry[] }, signal: AbortSignal) {
    signal.throwIfAborted()
    const parsed = validateDescriptionTranslationRequest(request)
    return this.store.lookup(parsed.entries, parsed.language)
  }

  @Remote
  async translate(request: { language: string; entries: DescriptionEntry[] }, signal: AbortSignal) {
    const parsed = validateDescriptionTranslationRequest(request)
    if (descriptionBatchBytes(parsed.entries, parsed.language) > DESCRIPTION_BATCH_MAX_BYTES) throw new Error('Batch exceeds byte limit')
    const defaults = this.ctx.get('agentDefaultModel') as DefaultModelReader | undefined
    const llm = this.ctx.get('llm') as LlmRuntime | undefined
    const selection = defaults?.currentSelection()
    if (!selection || !llm) throw new Error('Default model service is unavailable')
    const result = await this.store.translateBatch(parsed.entries, parsed.language,
      (entries, language, signal) => translateDescriptionBatchWithModel(llm, selection, entries, language, signal), { signal })
    return { ...result, model: { provider: selection.provider, model: selection.model,
      ...(selection.reasoningEffort ? { reasoningEffort: selection.reasoningEffort } : {}) } }
  }
}

export function applyDescriptionTranslationService(ctx: Context): void {
  // Optional: absent RPC support must not disable fonts or other beautify features.
  ctx.inject(['typert'], child => { new DescriptionTranslationService(child) })
}
