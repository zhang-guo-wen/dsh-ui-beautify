/**
 * Page beautification, browser half: register the preference rows and apply the
 * chosen faces to the document.
 *
 * Two responsibilities, in this order of importance:
 *
 * 1. **Applying the faces** is the plugin's actual effect. Each role's
 *    stylesheet links and token overrides follow its stored id, and the override
 *    rides the theme service — which writes it as an inline style on `body`, the
 *    only layer that outranks the `:root` declaration in ui-theme's own sheet
 *    regardless of activation order.
 * 2. **The rows** are the surface that writes those ids.
 *
 * Only the chosen faces' stylesheets are linked, so the browser never fetches
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
import {
  faceById, fontStack, resolveFontChoice, FONT_ROLES, type FontRole, type FontSettings,
} from '../fonts.ts'
import { FONTS_ROUTE, FONT_SETTINGS_NS } from '../params.ts'
import { CodeFontRow, FontRow } from './FontRows.tsx'
import { en, NS, zh, type FontRowKey } from './locales.ts'
import { FontController } from './settings-controller.ts'

export type { CodeFontRowProps, FontRowProps } from './FontRows.tsx'
export type { FontRowFace, FontRowState } from './settings-controller.ts'
export { NS } from './locales.ts'

/** Identity of this plugin's stylesheet links and its theme override layer. */
const PLUGIN_ID = '@guowenzhang/dsh-ui-beautify'

/** The roles, in the order their rows appear and their tokens are installed. */
const ROLE_ORDER: readonly FontRole[] = ['body', 'code']

/**
 * Row positions in the General section.
 *
 * `11.5` and `11.6` place both inside the appearance group: directly under the
 * interface font size (11), above the transcript row (12). Whole steps there
 * would push them past the end of that group, and the two belong next to each
 * other because they are the same kind of choice.
 */
const ROW_ORDER: Readonly<Record<FontRole, number>> = { body: 11.5, code: 11.6 }

/** The row id each role registers under. */
const ROW_ID: Readonly<Record<FontRole, string>> = { body: 'ui-beautify', code: 'ui-beautify-code' }

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** This plugin's settings rows copy. */
    'settings.uiBeautify': FontRowKey
  }
}

/**
 * Required services: the theme service owns the token overrides, slots and
 * locale carry the rows, and the configuration forms service is where the
 * choices live.
 */
export const inject = ['theme', 'slots', 'locale', 'configForms']

/**
 * Client plugin body: register one preference row per role and keep the
 * document in sync with the stored choices.
 * @param ctx - client cordis context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-beautify: dictionaries')
  const scope = ctx.configForms.get<FontSettings>(FONT_SETTINGS_NS)
  const controller = new FontController(scope)
  ctx.effect(() => () => { controller.dispose() }, 'ui-beautify: settings form')

  ctx.effect(() => applyFonts(ctx, scope), 'ui-beautify: fonts')

  for (const role of ROLE_ORDER) {
    ctx.slots.inject('settings.general.item', () => ctx.slots.register({
      name: 'settings.general.item',
      id: ROW_ID[role],
      order: ROW_ORDER[role],
      locale: NS,
      inject: () => controller.inject(role),
    }, role === 'body' ? FontRow : CodeFontRow))
  }
}

/**
 * Point the document at the stored choices and keep it there.
 *
 * Every role's links and tokens are installed in one pass, and the token
 * override is one call: the theme service keeps one layer per source, so a
 * second call would replace the first role's tokens rather than add to them.
 *
 * A role set to the system default contributes neither links nor tokens, which
 * is what lets its token resolve to ui-theme's own declaration — the only way
 * "off" tracks that declaration instead of freezing a copy of it.
 *
 * The first sync runs before the scope is ready, which resolves to the defaults
 * — the same ones a fresh install shows, so nothing shifts once the durable
 * values arrive.
 * @param ctx - client cordis context owning the effect.
 * @param scope - the `ui-beautify` configuration form holding the choices.
 * @returns disposer removing the links, the overrides, and the subscription.
 */
function applyFonts(ctx: Context, scope: ConfigForm<FontSettings>): () => void {
  let applied: Record<FontRole, string> | undefined
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
    const value = scope.getSnapshot().value
    const choices = {
      body: resolveFontChoice(value?.font, 'body'),
      code: resolveFontChoice(value?.codeFont, 'code'),
    } satisfies Record<FontRole, string>
    if (applied !== undefined && ROLE_ORDER.every(role => applied?.[role] === choices[role])) return
    applied = choices
    detach()
    const tokens: Record<string, { light: string; dark: string }> = {}
    for (const role of ROLE_ORDER) {
      const face = faceById(choices[role], role)
      if (face === undefined) continue
      const stack = fontStack(face, role)
      // A font carries no colour scheme, so both modes take the same stack
      // rather than leaving one palette uncovered.
      for (const token of FONT_ROLES[role].tokens) tokens[token] = { light: stack, dark: stack }
      // One link per sheet: a face may declare several weights, and each sheet
      // carries its own `@font-face` rules and its own shard set.
      for (const sheet of face.source.sheets) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.dataset.plugin = PLUGIN_ID
        link.href = `${FONTS_ROUTE}/${face.id}/${sheet}`
        document.head.appendChild(link)
        links.push(link)
      }
    }
    if (Object.keys(tokens).length > 0) releaseTokens = ctx.theme.overrideTokens(PLUGIN_ID, tokens)
  }

  sync()
  const stop = scope.subscribe(sync)
  return () => {
    stop()
    detach()
  }
}
