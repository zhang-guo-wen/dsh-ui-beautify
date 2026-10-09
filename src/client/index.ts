/**
 * Page beautification, browser half: register the settings page, apply the
 * chosen faces to the document, and fill the composer's two strips — the lane
 * above the card and the quick replies below it.
 *
 * Four responsibilities, in this order of importance:
 *
 * 1. **Applying the faces** is the plugin's actual effect. Each role's
 *    stylesheet links and token overrides follow its stored id, and the override
 *    rides the theme service — which writes it as an inline style on `body`, the
 *    only layer that outranks the `:root` declaration in ui-theme's own sheet
 *    regardless of activation order.
 * 2. **The settings page** writes the font, motion, quick-reply, and branding
 *    choices.
 * 3. **The quick replies** are the composer's submit plane offered as one click
 *    per common answer; they send the phrase the tag carries, which is the
 *    user's own text once they have customized the row.
 * 4. **The light beam** reports actual output speed in a fixed 1px strip.
 *    Its default-on settings switch controls whether it can play.
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
// Type-only: the composer-dock SlotMap entry the quick replies register into.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the slot registry Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the ui-theme plugin's Context merge (ctx.theme).
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  faceById, fontStack, resolveFontChoice, FONT_ROLES, type BeautifySettings, type FontRole,
} from '../fonts.ts'
import { FONTS_ROUTE, FONT_SETTINGS_NS } from '../params.ts'
import { LightBeam } from './LightBeam.tsx'
import { BeautifySection } from './BeautifySection.tsx'
import { applyBranding } from './branding.tsx'
import { en, NS, zh, type SettingsKey } from './locales.ts'
import { QuickReplies } from './QuickReplies.tsx'
import { ScrollToPrompt } from './ScrollToPrompt.tsx'
import { SettingsController } from './settings-controller.ts'
import { applyTagline } from './tagline.ts'
import { applyMobileLayout } from './mobile-layout.tsx'
import { installRemoteSettings } from './remote-settings.ts'
import { applyDescriptionTranslation } from './description-translation.ts'
import { installPdfWorkerCompat } from './pdf-worker-compat.ts'

export type { LightBeamProps } from './LightBeam.tsx'
export type { CodeFontRowProps, FontRowProps } from './FontRows.tsx'
export type { MotionRowProps } from './MotionRow.tsx'
export type { QuickRepliesProps } from './QuickReplies.tsx'
export type { SettingsRowFace, SettingsRowState } from './settings-controller.ts'
export { NS } from './locales.ts'
// Pure/UI adapter exports let regression tests exercise the installed handoff.
export { descriptionProjection, translateSkillMenu, installDescriptionAdapters } from './description-adapters.tsx'
// The PDF Worker patch is exported for the same reason: its shim text has to be
// checked against a realm that lacks the APIs, not only against the pages here.
export { installPdfWorkerCompat, pdfWorkerCompatSource } from './pdf-worker-compat.ts'

/** Identity of this plugin's stylesheet links and its theme override layer. */
const PLUGIN_ID = '@guowenzhang/dsh-ui-beautify'

/** The roles, in the order their rows appear and their tokens are installed. */
const ROLE_ORDER: readonly FontRole[] = ['body', 'code']

/**
 * The lane's cell in the composer dock, and where it sits among the entries
 * already there.
 *
 * Behind the shipped queue, todo, and goal docks, so the figure rides closest to
 * the composer card whenever one of those cards is open.
 */
const LANE_ID = 'ui-beautify-lane'
const LANE_ORDER = 100

/**
 * The quick replies' cell in the strip *below* the composer card, and where it
 * sits among the entries already there.
 *
 * That strip is `conversation.composer.dock`, whose other occupant is the
 * session-stats pills; order 1 puts the tags directly after them, with the
 * context meter that the composer itself renders last.
 */
const REPLIES_ID = 'ui-beautify-replies'
const REPLIES_ORDER = 1

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** This plugin's settings-row and quick-reply copy. */
    'settings.uiBeautify': SettingsKey
  }
}

/**
 * Required services: the theme service owns the token overrides, slots and
 * locale carry the rows, and the configuration forms service is where the
 * choices live.
 */
export const inject = ['theme', 'slots', 'locale', 'configForms', 'layout', 'remote', 'remote.settings']

/**
 * Client plugin body: register the settings page, keep the document in sync
 * with the stored choices, and put the lane in the composer dock.
 * @param ctx - client cordis context.
 */
export async function apply(ctx: Context): Promise<void> {
  // First, before the awaits below: a page that reloaded with a document tab
  // open can mount the PDF body while this body is still waiting on the remote
  // settings read, and the Worker is built the moment a document opens.
  ctx.effect(() => installPdfWorkerCompat(), 'ui-beautify: PDF Worker compatibility')
  const remoteSettings = installRemoteSettings(ctx)
  if (remoteSettings) {
    ctx.effect(() => () => { remoteSettings.dispose() }, 'ui-beautify: remote settings reads')
    await remoteSettings.ready
  }
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-beautify: dictionaries')
  const scope = ctx.configForms.get<BeautifySettings>(FONT_SETTINGS_NS)
  const controller = new SettingsController(scope)
  ctx.effect(() => () => { controller.dispose() }, 'ui-beautify: settings form')

  ctx.effect(() => applyFonts(ctx, scope), 'ui-beautify: fonts')
  ctx.effect(() => applyTagline(scope), 'ui-beautify: tagline')
  applyBranding(ctx, scope)
  applyMobileLayout(ctx, scope)
  const descriptions = applyDescriptionTranslation(ctx)
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'ui-beautify', order: 40,
    label: () => t('nav'), locale: NS,
    inject: () => ({ ...controller.inject(), descriptions }),
  }, BeautifySection))

  // The switch that hides this control lives in the settings namespace, so the
  // entry reads the same snapshot the rows do rather than a copy of the choice.
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: 'ui-beautify-to-prompt', order: 101, locale: NS,
    inject: () => controller.inject(),
  }, ScrollToPrompt))

  // Registered unconditionally, and given the stored answer rather than the
  // browser's: a lane the user switched off is a lane they can switch back on,
  // while a lane that never registered is indistinguishable from a broken one.
  ctx.slots.inject('conversation.input.overlay', () => ctx.slots.register({
    name: 'conversation.input.overlay',
    id: LANE_ID,
    order: LANE_ORDER,
    inject: () => controller.inject(),
  }, LightBeam))

  // No business face of its own — the session's input actions and the draft's
  // phase are standard props every session-scope entry receives — but the
  // phrases it offers are the user's, so it reads the same settings snapshot the
  // rows do.
  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: REPLIES_ID,
    order: REPLIES_ORDER,
    locale: NS,
    inject: () => controller.inject(),
  }, QuickReplies))
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
function applyFonts(ctx: Context, scope: ConfigForm<BeautifySettings>): () => void {
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
