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
 * Only the chosen face's stylesheet is linked, so the browser never fetches the
 * shard layout of a face the user is not using.
 *
 * @module @zhang-guo-wen/dsh-ui-beautify/client
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the settings namespace scope merge (ctx.settingsScope) and slot types.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the slot registry Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the ui-theme plugin's Context merge (ctx.theme).
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import { bundledFaceById, fontStack, resolveFontChoice, type FontSettings } from '../fonts.ts'
import { FONTS_ROUTE, FONT_SETTINGS_NS } from '../params.ts'
import { FontSection } from './FontSection.tsx'
import { en, NS, zh, type FontSectionKey } from './locales.ts'
import { FontController } from './settings-controller.ts'

export type { FontSectionProps } from './FontSection.tsx'
export type { FontSectionFace, FontSectionState } from './settings-controller.ts'
export { NS } from './locales.ts'

/** Identity of this plugin's stylesheet link and its theme override layer. */
const PLUGIN_ID = '@zhang-guo-wen/dsh-ui-beautify'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** This plugin's settings section copy. */
    'settings.uiBeautify': FontSectionKey
  }
}

/**
 * Required services: the theme service owns the token override, slots and locale
 * carry the section, and the settings scope is where the choice lives.
 */
export const inject = ['theme', 'slots', 'locale', 'settingsScope']

/**
 * Client plugin body: register the section and keep the document in sync with
 * the stored choice.
 * @param ctx - client cordis context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-beautify: dictionaries')
  const t = ctx.locale.bind(NS)
  const scope = ctx.settingsScope.bind<FontSettings>({ namespace: FONT_SETTINGS_NS })
  const controller = new FontController(scope)
  ctx.effect(() => () => { controller.dispose() }, 'ui-beautify: settings scope')

  ctx.effect(() => applyBodyFont(ctx, scope), 'ui-beautify: body font')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'ui-beautify',
    order: 12,
    label: () => t('nav'),
    locale: NS,
    inject: () => controller.inject(),
  }, FontSection))
}

/**
 * Point the document at the stored choice and keep it there.
 *
 * The stylesheet link and the token override are swapped together on every
 * committed change, so the document never references a family whose shards are
 * not being served. The system default applies neither: it drops both and lets
 * `--dsw-font-family` resolve to ui-theme's own declaration, which is the only
 * way "off" tracks that declaration instead of freezing a copy of it.
 *
 * The first sync runs before the scope is ready, which resolves to the default
 * choice — the same one a fresh install shows, so nothing shifts once the
 * durable value arrives.
 * @param ctx - client cordis context owning the effect.
 * @param scope - bound settings scope holding the choice.
 * @returns disposer removing the link, the override, and the subscription.
 */
function applyBodyFont(ctx: Context, scope: SettingsScope<FontSettings>): () => void {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.dataset.plugin = PLUGIN_ID
  document.head.appendChild(link)

  // The theme override layer is replaced wholesale on each change: the service
  // keeps one layer per source, so re-registering restacks rather than
  // accumulating, and the previous layer's disposer stops being meaningful.
  let applied: string | undefined
  let releaseTokens: (() => void) | undefined

  const sync = (): void => {
    const choice = resolveFontChoice(scope.getSnapshot().value?.font)
    if (choice === applied) return
    applied = choice
    // Every change starts from nothing applied, so the system default needs no
    // separate path: it simply stops before installing anything.
    releaseTokens?.()
    releaseTokens = undefined
    link.removeAttribute('href')
    const face = bundledFaceById(choice)
    if (face === undefined) return
    link.href = `${FONTS_ROUTE}/${face.dir}/index.css`
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
    releaseTokens?.()
    link.remove()
  }
}
