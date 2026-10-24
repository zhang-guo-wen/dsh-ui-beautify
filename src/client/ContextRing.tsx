/**
 * Context-occupancy ring around the composer's primary button, browser half.
 *
 * The ring is one zero-size anchor in `conversation.composer.dock` plus one
 * stylesheet. The anchor reads the host's `contextPressure` projection through
 * the Session standard seat its scope supplies, finds the composer card from the
 * dock's parent, marks that card's last button (the send / stop one), and writes
 * the percentage into a custom property the stylesheet turns into a 2px ring.
 *
 * The mark is re-synced on every projection change and on every composer
 * mutation, because a host re-render can replace the button node; removing the
 * attribute — on switch-off or unload — restores the button untouched. The
 * switch is independent from the composer-statistics one: hiding the readings
 * under the message box leaves this ring in place.
 *
 * Published packages do not declare the Session standard seat, so the component
 * is cast to the composed slot props at registration (the same shape the recent
 * conversations entry uses). A host client that predates the seat supplies no
 * `useProjection`: the ring then reads nothing and stays invisible instead of
 * failing the entry.
 */

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the conversation SlotMap merge (the composer dock entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the slot registry Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PropsRuntime, SlotComponent } from '@deepseek-ai/dsh-client-ui-slots'
import type { BeautifySettings } from '../fonts.ts'
import {
  CONTEXT_RING_CSS, CONTEXT_RING_ENTRY_ID, CONTEXT_RING_ORDER, CONTEXT_RING_STYLESHEET_ID,
  composerRootOf, contextRingPercent, markContextRing, type ContextProjectionSeat,
} from './context-ring.ts'
import { watchFeature } from './feature-switch.ts'

/** Props this entry relies on: the Session projection seat its slot scope supplies. */
export type ContextRingProps = ContextProjectionSeat

/**
 * Anchor entry that paints the context ring on the composer's primary button.
 * @param props - composed slot props; the ring reads only the projection seat.
 * @returns a zero-size anchor (always mounted, so the ring can appear later).
 */
export function ContextRing({ useProjection = () => undefined }: ContextRingProps): ReactNode {
  const percent = contextRingPercent(useProjection('contextPressure'))
  const anchor = useRef<HTMLSpanElement>(null)
  const percentRef = useRef<number | null>(percent)
  const syncRef = useRef<() => void>(() => {})

  // Mount once per composer: locate the root, mark the card's primary button, and
  // follow the host when it re-renders the card's children.
  useLayoutEffect(() => {
    const span = anchor.current
    if (span === null) return
    const root = composerRootOf(span)
    const sync = (): void => { markContextRing(root, percentRef.current) }
    syncRef.current = sync
    sync()
    // A host re-render can replace the button node; re-mark whatever is last now.
    const observer = new MutationObserver(sync)
    if (root !== null) observer.observe(root, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      syncRef.current = () => {}
      markContextRing(root, null)
    }
  }, [])

  // Every projection change only rewrites the custom property.
  useLayoutEffect(() => {
    percentRef.current = percent
    syncRef.current()
  }, [percent])

  // The slot's own wrapper is display:contents, so this adds no dock row; `hidden`
  // keeps the anchor out of the accessibility tree and out of layout.
  return <span ref={anchor} hidden data-ui-beautify-context-ring-anchor="" />
}

/**
 * Install the ring: its dock anchor and the stylesheet that draws it.
 * @param ctx - client context owning the registration and the style element.
 * @returns disposer removing both and releasing the marked button.
 */
export function installContextRing(ctx: Context): () => void {
  const style = document.createElement('style')
  style.dataset.pluginCss = CONTEXT_RING_STYLESHEET_ID
  style.textContent = CONTEXT_RING_CSS
  document.head.appendChild(style)
  const off = ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: CONTEXT_RING_ENTRY_ID,
    order: CONTEXT_RING_ORDER,
  // Published development packages omit the Session standard-seat augmentation.
  }, ContextRing as unknown as SlotComponent<PropsRuntime<'conversation.composer.dock'>>))
  return () => {
    off()
    style.remove()
  }
}

/**
 * Wire the context-ring switch.
 *
 * The switch defaults on, so an ordinary install shows the ring as soon as the
 * composer mounts; switching it off removes the anchor and the stylesheet, and
 * switching it on again restores both. Independent of every other switch in this
 * plugin.
 * @param ctx - client context owning the effect.
 * @param scope - the `ui-beautify` configuration form holding the switch.
 */
export function applyContextRing(ctx: Context, scope: ConfigForm<BeautifySettings>): void {
  ctx.effect(
    () => watchFeature(scope, 'contextRingEnabled', () => installContextRing(ctx)),
    'ui-beautify: context ring',
  )
}
