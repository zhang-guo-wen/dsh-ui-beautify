/**
 * The `ui-beautify` user-settings namespace: which bundled face the interface
 * sets its body text to.
 *
 * The namespace resolves through `ctx.settings` (the settings seam), so the
 * choice is user-editable in the local settings document and persists across
 * restarts, falling back to the default when the user has not chosen. The
 * settings service is optional: without one mounted the namespace is simply not
 * registered, and the Client half keeps its default.
 *
 * This file deliberately reaches `ctx.settings` through a small local interface
 * rather than depending on the settings package, so the plugin stays composable
 * in trees that mount no settings provider.
 *
 * The stored value is validated on read, not by the schema. A settings document
 * is hand-editable, and a schema that rejects one field makes the whole
 * namespace fall back to its last good value — so an unknown id must resolve to
 * the default at the read site instead of failing the section.
 *
 * @module @zhang-guo-wen/dsh-ui-beautify/settings
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type Schema from '@deepseek-ai/schemastery'
import { DEFAULT_FONT_ID, type FontSettings } from './fonts.ts'
import { FONT_SETTINGS_NS } from './params.ts'

export { FONT_SETTINGS_NS } from './params.ts'
export type { FontSettings } from './fonts.ts'

/** Schema served to settings clients. */
export const FONT_SETTINGS_SCHEMA: Schema<FontSettings> = z.object({
  font: z.string().default(DEFAULT_FONT_ID),
})

/**
 * Minimal local shape of the `settings.register` owner scope we consume. The
 * value types match what `@deepseek-ai/dsh-settings` exposes; declaring them
 * here keeps this package free of a hard reference to that service.
 */
interface SettingsProviderLike {
  register<T>(
    namespace: string,
    schema: unknown,
    options?: { base?: Partial<T>; applies?: 'live' | 'restart' },
  ): { get(): T }
}

/**
 * Register the font namespace with the settings service when one is mounted.
 *
 * `applies: 'live'` lets a committed choice reach the running interface without
 * a restart. Registration is an effect on this plugin's fiber, so disposing the
 * plugin removes the namespace with it.
 * @param ctx - plugin context (uses `ctx.get('settings')` when present).
 */
export function registerFontSettings(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    const provider = (settingsCtx as unknown as { settings: SettingsProviderLike }).settings
    try {
      provider.register<FontSettings>(FONT_SETTINGS_NS, FONT_SETTINGS_SCHEMA, {
        base: { font: DEFAULT_FONT_ID },
        applies: 'live',
      })
    } catch {
      // Another owner already registered this namespace; leave theirs in place
      // rather than failing this plugin's load.
    }
  })
}
