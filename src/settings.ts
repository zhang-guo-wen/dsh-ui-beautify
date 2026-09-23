/**
 * The `ui-beautify` user-settings namespace: which bundled face the interface
 * sets its body text to.
 *
 * The namespace is this plugin's Loader row Config. The profile entry id
 * (`ui-beautify`) is what the settings page addresses, and the schema below is
 * the live form it renders, so a committed choice reaches the running interface
 * without a restart.
 *
 * The stored value is validated on read, not by the schema. A settings document
 * is hand-editable, and a schema that rejects one field makes the whole
 * namespace fall back to its last good value — so an unknown id must resolve to
 * the default at the read site instead of failing the section.
 *
 * @module @guowenzhang/dsh-ui-beautify/settings
 */

import type { Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { DEFAULT_FONT_ID, type FontSettings } from './fonts.ts'

export { FONT_SETTINGS_NS } from './params.ts'
export type { FontSettings } from './fonts.ts'

/** Live fields this plugin projects to the settings page. */
export interface Config {
  /** Bundled face applied to the document, or the system default. */
  font: Volatile<FontSettings['font']>
}

/** Schema served to settings clients.
 * The inferred type is the source of truth: `.volatile()` produces the `Volatile` accessor above. */
export const Config = z.object({
  font: z.string().default(DEFAULT_FONT_ID).volatile(),
})
