/**
 * The identities both halves must agree on: where the faces are downloaded from,
 * and which settings namespace records the choice.
 *
 * Nothing here may import a Host-only package. The Client half reads this file,
 * so anything added has to stay resolvable in the browser bundle.
 *
 * The route lives under `/plugins` because that is the origin the app already
 * serves plugin-owned assets from, and `webServer` resolves it
 * longest-prefix-first, so it wins over the client-modules bundle route on
 * `/plugins`. Every face is served beneath it as `<FONTS_ROUTE>/<face>/<path>`,
 * where `<path>` is the file's own path inside the face's npm package.
 */

/** URL prefix font files are served under, with no trailing slash. */
export const FONTS_ROUTE = '/plugins/dsh-ui-beautify/fonts'

/**
 * Settings namespace owned by this plugin.
 *
 * The Host half registers it and the Client half binds it, so the literal has
 * exactly one definition: a mismatch would leave the picker reading a namespace
 * nobody owns.
 */
export const FONT_SETTINGS_NS = 'ui-beautify'
