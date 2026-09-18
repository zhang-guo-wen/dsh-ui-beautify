/**
 * Page beautification, browser half: load the bundled font shards and rebind
 * the GUI body font to them.
 *
 * The font itself is not written here — `assets/fonts/index.css` declares every
 * `@font-face` shard, and the Host half serves it beside the `files/` directory
 * its relative `url()`s address. This half only links that sheet and moves the
 * one token the whole GUI reads its body font from.
 * @module @zhang-guo-wen/dsh-ui-beautify/client
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the ui-theme plugin's Context merge (ctx.theme).
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import { FONTS_ROUTE, FONT_STACK } from '../params.ts'

/** Identity of this plugin's stylesheet link and its theme override layer. */
const PLUGIN_ID = '@zhang-guo-wen/dsh-ui-beautify'

/**
 * The font override is applied through the theme service, which writes it as an
 * inline style on `body` — the only layer that outranks the `:root` declaration
 * in ui-theme's own sheet regardless of plugin activation order. Wait for it.
 */
export const inject = ['theme']

/**
 * Client plugin body: link the shard stylesheet, then rebind the body font.
 * @param ctx - client cordis context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `${FONTS_ROUTE}/index.css`
    link.dataset.plugin = PLUGIN_ID
    document.head.appendChild(link)
    return () => { link.remove() }
  }, 'ui-beautify: font shard stylesheet')

  // The override layer demands one value per colour scheme so a token never
  // goes illegible when the user switches. A font has no scheme, so both
  // entries carry the same stack rather than leaving one palette uncovered.
  ctx.effect(
    () => ctx.theme.overrideTokens(PLUGIN_ID, {
      '--dsw-font-family': { light: FONT_STACK, dark: FONT_STACK },
    }),
    'ui-beautify: body font family',
  )
}
