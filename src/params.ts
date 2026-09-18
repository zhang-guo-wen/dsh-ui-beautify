/**
 * The URL and font-family identities both halves must agree on.
 *
 * The route lives under `/plugins` because that is the origin the app already
 * serves plugin-owned assets from, and `webServer` resolves it longest-prefix-first,
 * so it wins over the client-modules bundle route on `/plugins`.
 */

/** URL prefix the bundled font directory is served under, with no trailing slash. */
export const FONTS_ROUTE = '/plugins/dsh-ui-beautify/fonts'

/**
 * The family name `assets/fonts/index.css` declares across all its
 * `unicode-range` shards. Changing it here without regenerating that sheet
 * silently leaves every `@font-face` unmatched.
 */
export const FONT_FAMILY = 'Noto Sans SC Variable'

/**
 * The full stack written into `--dsw-font-family`. The bundled family comes
 * first; everything after it is ui-theme's own fallback chain, kept so the GUI
 * still renders while the shards load and if they never arrive.
 */
export const FONT_STACK = `'${FONT_FAMILY}', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif`
