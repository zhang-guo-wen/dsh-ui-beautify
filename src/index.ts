/**
 * @zhang-guo-wen/dsh-ui-beautify — page beautification for the DSH Web GUI.
 *
 * The host half owns two things: the bundled font directories, and the settings
 * namespace that records which face the interface uses. The browser needs the
 * shards over the application origin, so this plugin claims a `webServer`
 * prefix; the client half links the chosen face's stylesheet, rebinds the body
 * font token, and renders the picker that writes the namespace. Nothing here is
 * model-facing.
 * @module @zhang-guo-wen/dsh-ui-beautify
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the webserver plugin's Context merge (ctx.webServer).
import type {} from '@deepseek-ai/dsh-host-webserver'
import { FONTS_ROUTE } from './params.ts'
import { serveFontFile } from './serve.ts'
import { registerFontSettings } from './settings.ts'

/** Loader row name for this plugin. */
export const name = 'ui-beautify'

/** The font route only exists on a Web carrier, so wait for one. */
export const inject = ['webServer']

// Re-exported so the package's own tests can assert on the served route, the
// face table, and the namespace identity without reaching into internal module
// paths. These are the only values published beyond the plugin surface.
export { FONTS_ROUTE } from './params.ts'
export { DEFAULT_FONT_ID, FONT_FACES, FONT_IDS, fontFaceById, fontStack } from './fonts.ts'
export { fontFileFor, serveFontFile } from './serve.ts'
export { FONT_SETTINGS_NS, FONT_SETTINGS_SCHEMA } from './settings.ts'

/**
 * Host plugin body: claim the font directory's URL prefix and register the
 * namespace that records the chosen face.
 * @param ctx - host cordis context.
 */
export function apply(ctx: Context): void {
  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: FONTS_ROUTE, handler: serveFontFile }),
    'ui-beautify: font assets',
  )
  registerFontSettings(ctx)
}
