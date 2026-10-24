/**
 * The streamlined-interface switch: three host surfaces this plugin removes at
 * runtime, where the branded distribution used to bake the same removals into
 * the host build.
 *
 * Each surface is a host contribution this plugin does not own:
 *
 * 1. **The settings header's document action** is the `settings.action` entry
 *    `open-document`, registered by the settings shell on a loopback page. A
 *    second registration in the same cell at a lower priority wins the cell and
 *    renders nothing, so the host's action stays registered but never shows.
 * 2. **The settings navigation rows** `plugins` and `agent-presets` have no
 *    attribute of their own: the shell renders one button per `settings.section`
 *    entry in ledger order. The rows therefore have to be addressed by position,
 *    and the position is recomputed from the same ledger whenever it changes.
 * 3. **The Agent preset entries** — the new-session chip and the session-header
 *    label — are hidden while the Host's shared Coding Tools preference is
 *    explicitly off. That preference is watched rather than sampled, so
 *    re-enabling Coding Tools restores both entries immediately.
 *
 * Every part installs only while the switch is on and is released when it goes
 * off or the plugin unloads, restoring the host's own contributions untouched.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/streamlined-ui
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the settings shell's SlotMap merge (the 'settings.action' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the conversation SlotMap merge (the hero chip and header actions).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the slot registry Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ReactNode } from 'react'
import type { BeautifySettings } from '../fonts.ts'
import { watchFeature } from './feature-switch.ts'

/** Plugin identity written on the stylesheet the navigation hiding installs. */
const STYLESHEET_ID = '@guowenzhang/dsh-ui-beautify/streamlined-ui.css'

/**
 * Settings-navigation sections the switch removes.
 *
 * The ids belong to the registrants: `plugins` is the built-in plugin inventory
 * page and `agent-presets` the Agent roster page. Both stay composed — only
 * their navigation rows go, so this hides entries instead of unplugging a
 * feature.
 */
export const HIDDEN_SETTINGS_SECTIONS: readonly string[] = ['plugins', 'agent-presets']

/**
 * The settings navigation row selector, before its row number.
 *
 * The settings shell paints one `<nav>` inside its modal: the title is that
 * nav's first `<div>`, the row list its second, and every row a `<button>`
 * inside the list, in ledger order. Nothing on a row identifies its section, so
 * a row is addressed by position, computed from the same ledger the shell
 * projects.
 */
export const SETTINGS_NAV_ROW_SELECTOR = '[data-shortcut-modal="settings"] nav > div:nth-of-type(2) > button'

/** Id of the settings header action that opens the configuration file. */
export const OPEN_DOCUMENT_ACTION_ID = 'open-document'

/** Id of the session header's Agent-preset label entry. */
export const AGENT_PRESET_HEADER_ACTION_ID = 'agent-preset'

/**
 * One `settings.section` registration as the navigation shell projects it.
 *
 * Only the two members the projection reads are required: the shell maps every
 * registration to its id and `order`, then sorts. Reading a structural subset
 * keeps the row arithmetic testable without constructing slot entries.
 */
export interface SettingsSectionRow {
  /** Section key; a registration always carries one. */
  readonly options: {
    /** Section key addressed by `only` filtering and by this module. */
    readonly id?: string | undefined
    /** Nav position; absent means 0, as the shell reads it. */
    readonly order?: number | undefined
  }
}

/**
 * Resolve the hidden sections' 1-based row numbers.
 *
 * This repeats the shell's own projection rather than approximating it: every
 * registration in ledger order, its id and `order ?? 0`, then an ascending
 * stable sort. The shell reads the raw ledger (not the shadowing winners), so a
 * shadowed registration occupies a row here too, and ties keep registration
 * order.
 * @param entries - `ctx.slots.entries('settings.section')` at this moment.
 * @param hidden - section ids to locate; defaults to {@link HIDDEN_SETTINGS_SECTIONS}.
 * @returns the 1-based positions of those rows, ascending.
 */
export function hiddenSectionRows(
  entries: readonly SettingsSectionRow[],
  hidden: readonly string[] = HIDDEN_SETTINGS_SECTIONS,
): number[] {
  const wanted = new Set(hidden)
  return entries
    .map(entry => ({ id: entry.options.id ?? '', order: entry.options.order ?? 0 }))
    .sort((left, right) => left.order - right.order)
    .flatMap((row, at) => wanted.has(row.id) ? [at + 1] : [])
}

/**
 * Build the stylesheet that removes the rows at those positions.
 * @param rows - 1-based row numbers from {@link hiddenSectionRows}.
 * @returns one `display: none` rule addressing every row, or `''` for no rows.
 */
export function navHidingCss(rows: readonly number[]): string {
  if (rows.length === 0) return ''
  const selectors = rows.map(row => `${SETTINGS_NAV_ROW_SELECTOR}:nth-of-type(${row})`)
  return `${selectors.join(',\n')} {\n  display: none;\n}\n`
}

/**
 * Keep one stylesheet matching the hidden settings navigation rows.
 *
 * The ledger moves whenever a plugin registers or drops a section — the Account
 * row comes and goes with the credential — so the row numbers are recomputed on
 * every change instead of being frozen at install time.
 * @param ctx - client context owning the style element and the subscription.
 * @returns disposer removing the stylesheet and the subscription.
 */
export function installSettingsNavHiding(ctx: Context): () => void {
  const style = document.createElement('style')
  style.dataset.pluginCss = STYLESHEET_ID
  const sync = (): void => {
    style.textContent = navHidingCss(hiddenSectionRows(ctx.slots.entries('settings.section')))
  }
  sync()
  document.head.appendChild(style)
  const off = ctx.slots.subscribe('settings.section', sync)
  return () => {
    off()
    style.remove()
  }
}

/** Render nothing: the registration's cell is what the slot stops showing. */
function SuppressedSurface(): ReactNode {
  return null
}

/**
 * Shadow the settings header's "open the configuration file" action.
 *
 * The shell keeps its own registration; a lower priority in the same list cell
 * wins the cell, so the host action stays available to every other surface while
 * this one renders nothing.
 * @param ctx - client context owning the shadow registration.
 * @returns disposer removing the shadow, restoring the host action.
 */
export function shadowSettingsDocumentAction(ctx: Context): () => void {
  return ctx.slots.inject('settings.action', () => ctx.slots.register({
    name: 'settings.action',
    id: OPEN_DOCUMENT_ACTION_ID,
    priority: -10,
  }, SuppressedSurface))
}

/**
 * Shadow the Agent-preset entries: the new-session chip and the session
 * header's preset label.
 *
 * A deployment without coding tools offers no preset choice at all, so both
 * entries leave together. The settings page listing the roster is not touched
 * here — the switch hides that page's navigation row instead.
 * @param ctx - client context owning the shadow registrations.
 * @returns disposer removing both shadows.
 */
export function shadowAgentPresetEntries(ctx: Context): () => void {
  const offChip = ctx.slots.inject('conversation.hero.agentPreset', () => ctx.slots.register({
    name: 'conversation.hero.agentPreset',
    priority: -10,
  }, SuppressedSurface))
  const offLabel = ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: AGENT_PRESET_HEADER_ACTION_ID,
    priority: -10,
  }, SuppressedSurface))
  return () => {
    offChip()
    offLabel()
  }
}

/**
 * The Host's shared Coding Tools preference as this bundle reads it.
 *
 * Declared structurally: the served preference is the settings package's
 * `DeveloperToolsPreference`, and the optional member is what a Host client
 * older than this bundle looks like at runtime.
 */
interface CodingToolsGate {
  /** The shared preference, absent from a Host client that predates it. */
  readonly enabled?: {
    /** Read whether Coding Tools are currently on. */
    getSnapshot(): boolean
    /** Observe accepted preference changes. */
    subscribe(listener: () => void): () => void
  }
}

/**
 * Follow the Coding Tools preference while the streamlined switch is on.
 *
 * Only an explicit `false` hides anything: a preference that has not answered
 * yet, or a Host client that carries none, leaves the Agent surface alone rather
 * than blanking a control the user can still choose.
 * @param ctx - client context owning the shadow registrations and the subscription.
 * @returns disposer releasing the shadows and the preference subscription.
 */
export function watchCodingTools(ctx: Context): () => void {
  const gate = ctx.configForms.developerTools as CodingToolsGate | undefined
  const preference = gate?.enabled
  if (preference === undefined) return () => {}
  let release: (() => void) | undefined
  const sync = (): void => {
    if (preference.getSnapshot() === false) release ??= shadowAgentPresetEntries(ctx)
    else {
      release?.()
      release = undefined
    }
  }
  const off = preference.subscribe(sync)
  sync()
  return () => {
    off()
    release?.()
    release = undefined
  }
}

/**
 * Install every part of the streamlined interface.
 *
 * The parts are independent surfaces but one switch owns them, so they install
 * and release together: a half-streamlined page would be indistinguishable from
 * a broken plugin.
 * @param ctx - client context owning every registration and subscription.
 * @returns disposer restoring every host surface.
 */
export function installStreamlinedUi(ctx: Context): () => void {
  const documentAction = shadowSettingsDocumentAction(ctx)
  const navigation = installSettingsNavHiding(ctx)
  const codingTools = watchCodingTools(ctx)
  return () => {
    codingTools()
    navigation()
    documentAction()
  }
}

/**
 * Wire the streamlined-interface switch.
 *
 * The switch defaults off, so the whole installation waits for an explicit
 * `true`: a settings document without the field — a Host whose schema predates
 * it — must not strip the interface.
 * @param ctx - client context owning the effect.
 * @param scope - the `ui-beautify` configuration form holding the switch.
 */
export function applyStreamlinedUi(ctx: Context, scope: ConfigForm<BeautifySettings>): void {
  ctx.effect(
    () => watchFeature(scope, 'streamlinedUiEnabled', () => installStreamlinedUi(ctx), { defaultOn: false }),
    'ui-beautify: streamlined interface',
  )
}
