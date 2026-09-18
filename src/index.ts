/**
 * @zhang-guo-wen/dsh-ui-beautify — page beautification for the DSH Web GUI.
 *
 * The host half owns one thing: the bundled font directory. The browser needs
 * those shards over the application origin, so this plugin claims a `webServer`
 * prefix; the client half then links the shard stylesheet and rebinds the body
 * font token. Nothing here is model-facing.
 * @module @zhang-guo-wen/dsh-ui-beautify
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the webserver plugin's Context merge (ctx.webServer).
import type {} from '@deepseek-ai/dsh-host-webserver'
import { FONTS_ROUTE } from './params.ts'
import { serveFontFile } from './serve.ts'

/** Loader row name for this plugin. */
export const name = 'ui-beautify'

/** The font route only exists on a Web carrier, so wait for one. */
export const inject = ['webServer']

// Re-exported so the package's own tests can assert on the served route and the
// identities both halves must agree on, without reaching into internal module
// paths. These are the only values published beyond the plugin surface.
export { FONTS_ROUTE, FONT_FAMILY, FONT_STACK } from './params.ts'
export { fontFileFor } from './serve.ts'

/**
 * Host plugin body: claim the font directory's URL prefix.
 * @param ctx - host cordis context.
 */
export function apply(ctx: Context): void {
  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: FONTS_ROUTE, handler: serveFontFile }),
    'ui-beautify: font assets',
  )
}
