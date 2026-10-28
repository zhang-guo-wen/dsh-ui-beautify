/**
 * The two composer seats this plugin can hide: the model selector on the right
 * of the message box and the access-mode (permission) selector on the left.
 *
 * Both are `single` host slots — `conversation.input.model` and
 * `conversation.input.permission` — so the same shadowing rule the streamlined
 * switch uses applies: a registration in the same cell at a lower `priority`
 * wins the cell and renders nothing, while the host's own registration stays on
 * the ledger. Switching a row off drops the shadow and the host seat returns
 * without anything being re-registered.
 *
 * The two rows are independent: hiding the model never touches the permission
 * seat and vice versa. Both default off, so a fresh install keeps both host
 * seats; hiding one is a choice the user makes. Both controls stay reachable
 * through the host's own `/model` and `/permission` commands, which is what
 * keeps this a display choice rather than a capability change.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/composer-seats
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the conversation SlotMap merge (the composer seats).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the slot registry Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ReactNode } from 'react'
import type { BeautifySettings } from '../fonts.ts'
import { watchFeature } from './feature-switch.ts'

/** The composer seat holding the model selector. */
export const MODEL_SEAT_SLOT = 'conversation.input.model'

/** The composer seat holding the access-mode (permission) selector. */
export const ACCESS_MODE_SEAT_SLOT = 'conversation.input.permission'

/**
 * Priority of the shadow registrations.
 *
 * Every host seat registers at the default priority 0; a lower number wins the
 * cell, and the slot registry allows one registration per priority, so this is
 * the documented way to shadow a single seat instead of throwing at startup.
 */
export const SEAT_SHADOW_PRIORITY = -10

/** The two slots a hide switch can shadow. */
export type ComposerSeatSlot = typeof MODEL_SEAT_SLOT | typeof ACCESS_MODE_SEAT_SLOT

/** Render nothing: the registration wins the seat's cell so the host seat never renders. */
function SuppressedSeat(): ReactNode {
  return null
}

/**
 * Shadow one composer seat while the returned disposer is held.
 * @param ctx - client context owning the registration.
 * @param slot - the seat to shadow.
 * @returns disposer removing the shadow and restoring the host seat.
 */
export function shadowComposerSeat(ctx: Context, slot: ComposerSeatSlot): () => void {
  return ctx.slots.inject(slot, () => ctx.slots.register({
    name: slot,
    priority: SEAT_SHADOW_PRIORITY,
  }, SuppressedSeat))
}

/**
 * Wire the two hiding switches.
 *
 * Each row owns only its own effect: turning the model switch off must leave an
 * access-mode shadow that the other row installed alone. Both effects read the
 * live settings snapshot, so flipping a switch changes the composer without a
 * page reload.
 * @param ctx - client context owning the effects.
 * @param scope - the `ui-beautify` configuration form holding the switches.
 */
export function applyHiddenSeats(ctx: Context, scope: ConfigForm<BeautifySettings>): void {
  ctx.effect(
    () => watchFeature(scope, 'hideModelSelector', () => shadowComposerSeat(ctx, MODEL_SEAT_SLOT), { defaultOn: false }),
    'ui-beautify: hidden model seat',
  )
  ctx.effect(
    () => watchFeature(scope, 'hideAccessMode', () => shadowComposerSeat(ctx, ACCESS_MODE_SEAT_SLOT), { defaultOn: false }),
    'ui-beautify: hidden access-mode seat',
  )
}
