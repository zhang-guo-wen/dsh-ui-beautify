/**
 * Page beautification, browser half: register the settings section and apply the
 * chosen face to the document.
 *
 * Two responsibilities, in this order of importance:
 *
 * 1. **Applying a face** is the plugin's actual effect. The stylesheet link and
 *    the `--dsw-font-family` override both follow the stored id, and the
 *    override rides the theme service — which writes it as an inline style on
 *    `body`, the only layer that outranks the `:root` declaration in ui-theme's
 *    own sheet regardless of activation order.
 * 2. **The section** is the surface that writes that id.
 *
 * Only the chosen face's stylesheets are linked, so the browser never fetches
 * the shard layout of a face the user is not using. The files behind them are
 * downloaded by the Host on the first request and cached from then on.
 *
 * @module @guowenzhang/dsh-ui-beautify/client
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the configuration-form service merge (ctx.configForms) and slot types.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the slot registry Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the ui-theme plugin's Context merge (ctx.theme).
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { faceById, fontStack, resolveFontChoice, type FontSettings } from '../fonts.ts'
import { FONTS_ROUTE, FONT_SETTINGS_NS } from '../params.ts'
import { FontRow } from './FontRow.tsx'
import { en, NS, zh, type FontRowKey } from './locales.ts'
import { FontController } from './settings-controller.ts'

export type { FontRowProps } from './FontRow.tsx'
export type { FontRowFace, FontRowState } from './settings-controller.ts'
export { NS } from './locales.ts'

/** Identity of this plugin's stylesheet link and its theme override layer. */
const PLUGIN_ID = '@guowenzhang/dsh-ui-beautify'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** This plugin's settings row copy. */
    'settings.uiBeautify': FontRowKey
  }
}

/**
 * Required services: the theme service owns the token override, slots and locale
 * carry the row, and the configuration forms service is where the choice lives.
 */
export const inject = ['theme', 'slots', 'locale', 'configForms']

/**
 * Client plugin body: register the preference row and keep the document in sync
 * with the stored choice.
 * @param ctx - client cordis context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-beautify: dictionaries')
  const scope = ctx.configForms.get<FontSettings>(FONT_SETTINGS_NS)
  const controller = new FontController(scope)
  ctx.effect(() => () => { controller.dispose() }, 'ui-beautify: settings form')

  ctx.effect(() => applyBodyFont(ctx, scope), 'ui-beautify: body font')

  // `11.5` is deliberate: the body font belongs with the appearance controls,
  // directly under the interface font size (11) and above the transcript row
  // (12). A whole step there would push it past the end of that group.
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'ui-beautify',
    order: 11.5,
    locale: NS,
    inject: () => controller.inject(),
  }, FontRow))
}

/**
 * Point the document at the stored choice and keep it there.
 *
 * The stylesheet links and the token override are swapped together on every
 * committed change, so the document never references a family whose shards are
 * not being served. The system default applies neither: it drops both and lets
 * `--dsw-font-family` resolve to ui-theme's own declaration, which is the only
 * way "off" tracks that declaration instead of freezing a copy of it.
 *
 * The first sync runs before the scope is ready, which resolves to the default
 * choice — the same one a fresh install shows, so nothing shifts once the
 * durable value arrives.
 * @param ctx - client cordis context owning the effect.
 * @param scope - the `ui-beautify` configuration form holding the choice.
 * @returns disposer removing the links, the override, and the subscription.
 */
function applyBodyFont(ctx: Context, scope: ConfigForm<FontSettings>): () => void {
  // The theme override layer is replaced wholesale on each change: the service
  // keeps one layer per source, so re-registering restacks rather than
  // accumulating, and the previous layer's disposer stops being meaningful.
  let applied: string | undefined
  let releaseTokens: (() => void) | undefined
  let links: HTMLLinkElement[] = []

  // Every change starts from nothing applied, so the system default needs no
  // separate path: it simply stops before installing anything.
  const detach = (): void => {
    releaseTokens?.()
    releaseTokens = undefined
    for (const link of links) link.remove()
    links = []
  }

  const sync = (): void => {
    const choice = resolveFontChoice(scope.getSnapshot().value?.font)
    if (choice === applied) return
    applied = choice
    detach()
    const face = faceById(choice)
    if (face === undefined) return
    // One link per sheet: a face may declare several weights, and each sheet
    // carries its own `@font-face` rules and its own shard set.
    links = face.source.sheets.map((sheet) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.dataset.plugin = PLUGIN_ID
      link.href = `${FONTS_ROUTE}/${face.id}/${sheet}`
      document.head.appendChild(link)
      return link
    })
    // A font carries no colour scheme, so both modes take the same stack rather
    // than leaving one palette uncovered.
    releaseTokens = ctx.theme.overrideTokens(PLUGIN_ID, {
      '--dsw-font-family': { light: fontStack(face), dark: fontStack(face) },
    })
  }

  sync()
  const stop = scope.subscribe(sync)
  return () => {
    stop()
    detach()
  }
}
