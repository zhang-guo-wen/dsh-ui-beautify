/**
 * The `ui-beautify` user-settings namespace: which face the interface sets its
 * body text to, which it sets code text to, and where the faces are downloaded
 * from.
 *
 * The namespace is this plugin's Loader row Config. The profile entry id
 * (`ui-beautify`) is what the settings page addresses, and the schema below is
 * the live form it renders, so a committed choice reaches the running interface
 * without a restart.
 *
 * The stored value is validated on read, not by the schema. A settings document
 * is hand-editable, and a schema that rejects one field makes the whole
 * namespace fall back to its last good value — so an unknown id must resolve to
 * the role's default at the read site instead of failing the section.
 *
 * Only the two choices are volatile. The mirrors and the cache directory are
 * deployment choices that the route reads once at host start, so presenting them
 * as live fields would promise an effect a settings write cannot deliver; they
 * are set in the plugin row like any other fixed configuration.
 *
 * @module @guowenzhang/dsh-ui-beautify/settings
 */

import type { Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { DEFAULT_CODE_FONT_ID, DEFAULT_FONT_ID, type FontSettings } from './fonts.ts'
import { DEFAULT_MIRRORS } from './source.ts'

export { FONT_SETTINGS_NS } from './params.ts'
export type { FontSettings } from './fonts.ts'

/** Live fields this plugin projects to the settings page. */
export interface Config {
  /** Face applied to body text, or the system default. */
  font: Volatile<FontSettings['font']>
  /** Face applied to code text, or the built-in code stack. */
  codeFont: Volatile<FontSettings['codeFont']>
  /** Registries a font file is downloaded from, tried in order. */
  mirrors: string[]
  /** Directory caching downloaded files; empty follows `$DSH_HOME`, then `~/.dsh`. */
  cacheDir: string
}

/** Schema served to settings clients.
 * The inferred type is the source of truth: `.volatile()` produces the `Volatile` accessor above. */
export const Config = z.object({
  font: z.string().default(DEFAULT_FONT_ID).volatile(),
  codeFont: z.string().default(DEFAULT_CODE_FONT_ID).volatile(),
  mirrors: z.array(z.string()).default([...DEFAULT_MIRRORS]),
  cacheDir: z.string().default(''),
})
