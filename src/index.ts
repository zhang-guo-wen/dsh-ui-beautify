/**
 * @guowenzhang/dsh-ui-beautify — page beautification for the DSH Web GUI.
 *
 * The host half owns one thing: the route the browser downloads font files
 * from. No font ships in the package — a face is a `package@version` plus the
 * package-relative stylesheets it declares, and the first request for a sheet
 * or a shard fetches it from the configured mirrors into a local cache. The
 * browser needs those bytes over the application origin, so this plugin claims
 * a `webServer` prefix; the client half links the chosen faces' stylesheets,
 * rebinds the body and code font tokens, and renders the pickers that write the
 * namespace. Nothing here is model-facing.
 * @module @guowenzhang/dsh-ui-beautify
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the webserver plugin's Context merge (ctx.webServer).
import type {} from '@deepseek-ai/dsh-host-webserver'
import { CACHE_ROUTE, FONTS_ROUTE } from './params.ts'
import { serveCacheUsage, serveFontFile } from './serve.ts'
import { Config } from './settings.ts'
import { FontStore, resolveCacheDir } from './store.ts'

/** Loader row name for this plugin. */
export const name = 'ui-beautify'

/** The font route only exists on a Web carrier, so wait for one. */
export const inject = ['webServer']

// Re-exported so the package's own tests can assert on the served route, the
// catalogue, the cache layout, and the namespace identity without reaching into
// internal module paths. These are the only values published beyond the plugin
// surface.
export { CACHE_ROUTE, FONTS_ROUTE } from './params.ts'
export {
  anyFaceById, choicesFor, CODE_FACES, CODE_FALLBACK_STACK, CODE_FONT_CHOICES,
  DEFAULT_CODE_FONT_ID, DEFAULT_FONT_ID, FACE_ID_PATTERN, FONT_CHOICES, FONT_FACES,
  FONT_ROLES, faceById, fontStack, resolveFontChoice, SYSTEM_FONT_ID,
} from './fonts.ts'
export type {
  FontCacheReport, FontCacheUsage, FontFace, FontGroup, FontRole, FontRoleSpec, FontSource,
} from './fonts.ts'
export { fontRouteFor, serveCacheUsage, serveFontFile } from './serve.ts'
export type { FontRoute } from './serve.ts'
export { FONT_SETTINGS_NS } from './settings.ts'
export { DEFAULT_MIRRORS, downloadFile, mirrorUrl } from './source.ts'
export { FontStore, resolveCacheDir } from './store.ts'
export { Config }

/**
 * Host plugin body: claim the font directory's URL prefix and the cache
 * read-out the pickers label each face with. The chosen faces live in this
 * row's volatile Config, which the settings page edits directly; the mirrors
 * and cache directory are read once here, at host start.
 * @param ctx - host cordis context.
 * @param config - this row's parsed configuration.
 */
export function apply(ctx: Context, config: Config): void {
  const store = new FontStore({
    cacheDir: resolveCacheDir(config.cacheDir),
    mirrors: config.mirrors,
  })
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'prefix',
      path: FONTS_ROUTE,
      handler: (req, res) => serveFontFile(req, res, store),
    }),
    'ui-beautify: font assets',
  )
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: CACHE_ROUTE,
      handler: (req, res) => serveCacheUsage(req, res, store),
    }),
    'ui-beautify: cache read-out',
  )
}
