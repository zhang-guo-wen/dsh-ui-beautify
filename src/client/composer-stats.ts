/**
 * The composer-statistics switch: hides the three readings the host paints under
 * the message box — the activity pill (turns, steps, output speed), the usage
 * pill (token spend and cache hits), and the context-occupancy ring.
 *
 * The two pills are `conversation.composer.dock` entries owned by `ui-chat`, so
 * each is shadowed the way a host cell is always shadowed: one registration in
 * the same cell (`activity`, `usage`) at a lower priority, rendering nothing. The
 * host's own registrations stay on the ledger, so switching this off restores
 * the pills without re-registering anything.
 *
 * The ring has no slot. `ui-conversation`'s input bar renders it directly as the
 * dock's sibling after the dock slot's anchor, which leaves a stylesheet as the
 * only way to hide it. Its root is a `<span>` whose direct child is the trigger
 * button (`aria-haspopup="dialog"`), and that button's svg draws the ring's track
 * and fill circles — the selector keys on that structure rather than on hashed
 * CSS-module class names.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/composer-stats
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the conversation SlotMap merge (the composer dock entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the slot registry Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ReactNode } from 'react'
import type { BeautifySettings } from '../fonts.ts'
import { watchFeature } from './feature-switch.ts'

/**
 * The dock entries this switch hides, in dock order.
 *
 * Both belong to `ui-chat`: `activity` carries the round/step count and output
 * speed, `usage` the token spend with its cache-hit share.
 */
export const COMPOSER_STATS_PILL_IDS: readonly string[] = ['activity', 'usage']

/**
 * Selector of the context-occupancy ring in the composer dock.
 *
 * The dock holds the `conversation.composer.dock` slot anchor and this meter as
 * its only direct children. The meter's root is a `<span>` whose direct child is
 * its trigger button — the tooltip clones that button rather than wrapping it —
 * and the button's svg holds the ring's two `<circle>` elements (track and
 * fill). Anchoring on those facts survives the CSS-module class hashes.
 */
export const CONTEXT_METER_SELECTOR = '[data-composer-dock] > span:has(> button[aria-haspopup="dialog"] svg circle)'

/** Plugin identity written on the stylesheet the switch installs. */
const STYLESHEET_ID = '@guowenzhang/dsh-ui-beautify/composer-stats.css'

/**
 * The stylesheet the switch injects.
 * @returns one rule hiding the context meter inside the composer dock.
 */
export function composerStatsCss(): string {
  return `${CONTEXT_METER_SELECTOR} {\n  display: none;\n}\n`
}

/** Render nothing: the registration wins the pill's cell so the host pill never renders. */
function SuppressedComposerStat(): ReactNode {
  return null
}

/**
 * Install the composer-statistics hiding.
 *
 * The two pills are shadowed and the ring is hidden by one stylesheet; the host
 * contributions all stay registered, so releasing this restores every reading
 * as it was.
 * @param ctx - client context owning the shadow registrations and the style element.
 * @returns disposer removing the shadows and the stylesheet.
 */
export function installComposerStats(ctx: Context): () => void {
  const style = document.createElement('style')
  style.dataset.pluginCss = STYLESHEET_ID
  style.textContent = composerStatsCss()
  document.head.appendChild(style)
  const pills = COMPOSER_STATS_PILL_IDS.map(id => ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id,
    priority: -10,
  }, SuppressedComposerStat)))
  return () => {
    for (const off of pills) off()
    style.remove()
  }
}

/**
 * Wire the composer-statistics switch.
 *
 * The switch defaults off, so the installation waits for an explicit `true`: a
 * settings document without the field — a Host whose schema predates it — must
 * keep the readings. It is independent from the streamlined-interface switch:
 * either surface can be hidden without the other.
 * @param ctx - client context owning the effect.
 * @param scope - the `ui-beautify` configuration form holding the switch.
 */
export function applyComposerStats(ctx: Context, scope: ConfigForm<BeautifySettings>): void {
  ctx.effect(
    () => watchFeature(scope, 'hideComposerStats', () => installComposerStats(ctx), { defaultOn: false }),
    'ui-beautify: composer statistics',
  )
}
