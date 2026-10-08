/** Reversible UI-only adapters; original catalogs, menu stores, file bytes and tool results stay untouched. */
import type { Context } from '@deepseek-ai/cordis'
import { createElement, useEffect, useMemo, useSyncExternalStore, type ComponentType, type ReactNode } from 'react'
import type { StoredEntry } from '@deepseek-ai/dsh-client-ui-slots'
import type { DescriptionController } from './description-controller.ts'
import css from './SettingRow.module.css'

type Props = Record<string, any>
interface Observable<T> { getSnapshot(): T; subscribe(listener: () => void): () => void }

/** Stable read-only view; upstream write methods are deliberately not exposed. */
export function descriptionProjection<T>(source: Observable<T>, translations: Observable<unknown>, project: (value: T) => T): Observable<T> {
  let previous: T | undefined
  let revision: unknown
  let projected: T
  return {
    getSnapshot() {
      const value = source.getSnapshot(), next = translations.getSnapshot()
      if (value !== previous || revision !== next) { previous = value; revision = next; projected = project(value) }
      return projected
    },
    subscribe(listener) { const a = source.subscribe(listener), b = translations.subscribe(listener); return () => { a(); b() } },
  }
}

export function translateSkillMenu(state: Props, controller: DescriptionController): Props {
  if (!Array.isArray(state.groups)) return state
  return { ...state, groups: state.groups.map((group: Props) => group.source !== 'skill' ? group : {
    ...group, items: group.items.map((item: Props) => typeof item.description !== 'string' ? item : {
      ...item, description: controller.resolveSkillCandidate(item.description),
    }),
  }) }
}

/** Shadow only the selected known component, never replace a whole page or duplicate child declarations. */
function shadow(ctx: Context, slot: string, cell: string, kind: 'id' | 'key', expected: string, componentName: string, wrap: (original: ComponentType<Props>) => ComponentType<Props>): () => void {
  const slots = ctx.get('slots')!
  if (typeof slots.entries !== 'function' || typeof slots.entriesOfSlot !== 'function' || typeof slots.subscribe !== 'function') return () => {}
  const key = slot as Parameters<typeof slots.entries>[0]
  let current: StoredEntry | undefined
  let release: (() => void) | undefined
  let own: unknown
  let syncing = false
  const sync = (): void => {
    if (syncing) return
    syncing = true
    try {
      const entries = slots.entries(key)
      const winner = slots.entriesOfSlot(key).find(entry => entry.options[kind] === cell)
      const original = winner?.component === own ? (current && entries.includes(current) ? current : undefined)
        : winner && (winner.registrant?.includes(expected)
          || (typeof winner.component === 'function' && winner.component.name === componentName)) ? winner : undefined
      if (original === current) return
      release?.(); release = undefined; current = original
      if (!original || (original.children && Object.keys(original.children).length > 0) || typeof original.component !== 'function') return
      own = wrap(original.component as ComponentType<Props>)
      const priority = Math.min(...entries.filter(entry => entry.options[kind] === cell).map(entry => entry.options.priority ?? 0)) - 1
      // Slot contracts differ between installed versions; adapt only this erased registration boundary.
      const register = slots.register as unknown as (options: Props, component: unknown) => () => void
      release = register.call(slots, { name: slot, ...original.options, priority,
        ...(original.inject ? { inject: original.inject } : {}), ...(original.locale ? { locale: original.locale } : {}),
        ...(original.store ? { store: original.store } : {}) }, own)
    } finally { syncing = false }
  }
  const off = slots.subscribe(key, sync)
  sync()
  return () => { off(); release?.() }
}

function Summary({ text }: { text: string | undefined }): ReactNode {
  return text ? <div className={css.desc} data-description-translation-summary="">{text}</div> : null
}

export function installDescriptionAdapters(ctx: Context, controller: DescriptionController): () => void {
  const disposers: (() => void)[] = []
  const slots = ctx.get('slots')!
  disposers.push(shadow(ctx, 'conversation.input.overlay', 'slash-menu', 'id', 'ui-input-trigger', 'MenuView', Original => function TranslatedMenu(props) {
    const menu = useMemo(() => props.menu?.getSnapshot && props.menu?.subscribe
      ? descriptionProjection(props.menu, controller, value => translateSkillMenu(value as Props, controller)) : props.menu,
    [props.menu])
    useEffect(() => { controller.observeSession(props.sessionId) }, [props.sessionId])
    return createElement(Original, { ...props, menu })
  }))
  disposers.push(shadow(ctx, 'sidebar.right.tab.document', '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/markdown', 'key', 'ui-sidebar-documentpreview', 'MarkdownBody', Original => function TranslatedSkillFile(props) {
    useSyncExternalStore(controller.subscribe, controller.getSnapshot)
    const resource = props.useResource?.(props.resourceAddress)
    const path: string | undefined = resource?.value?.absolutePath
    useEffect(() => { controller.observeSession(props.sessionId) }, [props.sessionId])
    const description = path ? controller.skillFileDescription(path, props.sessionId) : undefined
    return <><Summary text={description} />{createElement(Original, props)}</>
  }))
  disposers.push(shadow(ctx, 'tool.call.toolview', 'skill', 'key', 'ui-skill', 'SkillRow', Original => function TranslatedSkillCall(props) {
    useSyncExternalStore(controller.subscribe, controller.getSnapshot)
    useEffect(() => { controller.observeSession(props.sessionId) }, [props.sessionId])
    let name: string | undefined
    try {
      const block = props.block
      if (props.phase !== 'preparing' && block && !block.isError && block.error?.code !== 'interrupted') {
        const args = JSON.parse(block.call?.argsRaw ?? block.argsRaw ?? '{}')
        if (typeof args.name === 'string') name = args.name
      }
    } catch { /* Streaming/truncated arguments remain the host's responsibility. */ }
    return <>{createElement(Original, props)}<Summary text={name ? controller.skillDescription(name, props.sessionId) : undefined} /></>
  }))
  // Scope discovery uses a null session-slot contributor, not DOM or persisted private selection state.
  const register = slots.register as unknown as (options: Props, component: unknown) => () => void
  disposers.push(slots.inject('conversation.input.overlay', () => register.call(slots,
    { name: 'conversation.input.overlay', id: 'ui-beautify-description-scope', order: 1000 },
    function DescriptionScope(props: Props) { useEffect(() => { controller.observeSession(props.sessionId) }, [props.sessionId]); return null })))

  return () => { for (const off of disposers.reverse()) off() }
}
