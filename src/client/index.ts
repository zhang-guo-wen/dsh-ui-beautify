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
 * 2. **The settings page** writes the font, motion, quick-reply, branding, and
 *    streamlined-interface choices.
 * 3. **The quick replies** are the composer's submit plane offered as one click
 *    per common answer; they send the phrase the tag carries, which is the
 *    user's own text once they have customized the row.
 * 4. **The light beam** reports actual output speed in a fixed 1px strip.
 *    Its default-on settings switch controls whether it can play.
 * 5. **The conversation-start chip** floats at the transcript's top edge and
 *    previews the round the reader is inside; its own switch controls it, and
 *    the up button walks back through earlier rounds one press at a time.
 * 6. **The unread-answer landing** waits for the host to mark a Session as read
 *    — the green dot disappearing — and moves that conversation to the start of
 *    its last answer instead of the bottom it restores by default.
 * 7. **The running-indicator rename** replaces the phrase and the mark the
 *    transcript shows while a Turn streams; both fields are live, so a stored
 *    phrase reaches a row already on screen.
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
// Type-only: the slot registry the entries register into.
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the Workspace service merge (`uiWorkspace`) the quick actions call.
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
// Type-only: the composer-dock SlotMap entry the quick replies register into.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the slot registry Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the ui-theme plugin's Context merge (ctx.theme).
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  faceById, fontStack, resolveFontChoice, FONT_ROLES, type BeautifySettings, type FontFace, type FontRole,
} from '../fonts.ts'
import { FONTS_ROUTE, FONT_SETTINGS_NS } from '../params.ts'
import { LightBeam } from './LightBeam.tsx'
import { installOutputTokens } from './follow-output.ts'
import { BeautifySection } from './BeautifySection.tsx'
import { applyBranding } from './branding.tsx'
import { en, NS, zh, type SettingsKey } from './locales.ts'
import { QuickReplies } from './QuickReplies.tsx'
import { QuickActions } from './QuickActions.tsx'
import { ScrollToPrompt } from './ScrollToPrompt.tsx'
import { SessionStartChip } from './SessionStartChip.tsx'
import { SettingsController } from './settings-controller.ts'
import { applyTagline } from './tagline.ts'
import { applyMobileLayout } from './mobile-layout.tsx'
import { applyStreamlinedUi } from './streamlined-ui.ts'
import { applyComposerStats } from './composer-stats.ts'
import { applyHiddenSeats } from './composer-seats.ts'
import { applyContextRing } from './ContextRing.tsx'
import { installRemoteSettings } from './remote-settings.ts'
import { applyDescriptionTranslation } from './description-translation.ts'
import { installPdfWorkerCompat } from './pdf-worker-compat.ts'
import { installUnreadAnswerStart } from './unread-answer-start.ts'
import { applyRunningStatus } from './running-status.ts'
import { watchFeature } from './feature-switch.ts'

export type { LightBeamProps } from './LightBeam.tsx'
export type { CodeFontRowProps, FontRowProps } from './FontRows.tsx'
export type { MotionRowProps } from './MotionRow.tsx'
export type { QuickRepliesProps } from './QuickReplies.tsx'
export type { SettingsRowFace, SettingsRowState } from './settings-controller.ts'
export { NS } from './locales.ts'
// Pure/UI adapter exports let regression tests exercise the installed handoff.
export { installOutputTokens, eventTokens, estimateTokens, createOutputTokensSource } from './follow-output.ts'
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

/**
 * The conversation-start chip's cell in the composer dock, right after the
 * up-button entry. Both are zero-height anchors; order only fixes a stable
 * identity among the dock's rows.
 */
const CHIP_ID = 'ui-beautify-session-start'
const CHIP_ORDER = 102

/**
 * The floating quick-actions button's cell in the composer dock.
 *
 * The entry renders a portal to `<body>` rather than a dock row, so its order
 * only fixes a stable identity among the dock's entries.
 */
const QUICK_ACTIONS_ID = 'ui-beautify-quick-actions'
const QUICK_ACTIONS_ORDER = 103

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** This plugin's settings-row and quick-reply copy. */
    'settings.uiBeautify': SettingsKey
  }
}

/**
 * Required services: the theme service owns the token overrides, slots and
 * locale carry the rows, the configuration forms service is where the choices
 * live, and `uiSession` owns the per-Session standard sources — the lane's
 * output figure is one of them, and it must be active before this body asks.
 */
export const inject = ['theme', 'slots', 'locale', 'configForms', 'layout', 'remote', 'remote.settings', 'uiSession']

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
  applyStreamlinedUi(ctx, scope)
  applyComposerStats(ctx, scope)
  // Independent switches: hiding the model seat must not release the
  // access-mode shadow, so the two effects are wired side by side.
  applyHiddenSeats(ctx, scope)
  applyContextRing(ctx, scope)
  applyRunningStatus(ctx, scope)
  // The switch owns the whole watcher: releasing it drops the status
  // subscription, the pending frame, and the reading-gesture listeners.
  ctx.effect(
    () => watchFeature(scope, 'unreadAnswerStartEnabled', () => installUnreadAnswerStart(ctx)),
    'ui-beautify: unread answer start',
  )
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

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: CHIP_ID, order: CHIP_ORDER, locale: NS,
    inject: () => controller.inject(),
  }, SessionStartChip))

  // The button is a viewport-fixed control, but its entry lives in the Session
  // dock: that scope supplies the current Session identity and the standard
  // Session/Workspace hooks it reads. The three actions come from the injected
  // Workspace service — the same calls the sidebar's own menu makes.
  ctx.inject(['uiWorkspace'], workspace => {
    const uiWorkspace = () => workspace.get('uiWorkspace')!
    const sessionIdOf = (id: string): Parameters<NonNullable<Context['uiWorkspace']>['openSession']>[0] =>
      id as Parameters<NonNullable<Context['uiWorkspace']>['openSession']>[0]
    ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
      name: 'conversation.input.dock', id: QUICK_ACTIONS_ID, order: QUICK_ACTIONS_ORDER, locale: NS,
      inject: () => ({
        ...controller.inject(),
        archiveSession: (id: string) => uiWorkspace().archiveSession(sessionIdOf(id)),
        pinSession: (id: string) => uiWorkspace().pinSession(sessionIdOf(id)),
        unpinSession: (id: string) => uiWorkspace().unpinSession(sessionIdOf(id)),
        openSession: (id: string) => { uiWorkspace().openSession(sessionIdOf(id)) },
      }),
      // Standard Session seats (`sessionId`, `useSessions`, `useSessionStatus`)
      // are supplied by the renderer but absent from the published types.
    }, QuickActions as never))
  })

  // Registered unconditionally, and given the stored answer rather than the
  // browser's: a lane the user switched off is a lane they can switch back on,
  // while a lane that never registered is indistinguishable from a broken one.
  // The figure arrives through the `assistantOutputTokens` Session hook, which is
  // a standard seat every Session-scope entry receives — registered here before
  // anything renders, so the lane's first render already has it.
  installOutputTokens(ctx)
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
 * Each role is tracked on its own: a role whose id did not move keeps the links
 * it already has, so choosing a code face cannot make the browser re-validate
 * the body face's stylesheets or lay its text out again.
 *
 * The token override is still one call for both roles: the theme service keeps
 * one layer per source, so a second call would replace the first role's tokens
 * rather than add to them. It is rebuilt from the roles in effect, which is
 * cheap — a style object the theme service writes once.
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
  /** The id each role is currently applied at. */
  const applied = new Map<FontRole, string>()
  /** The stylesheet links each role is currently carried by. */
  const links = new Map<FontRole, HTMLLinkElement[]>()
  let releaseTokens: (() => void) | undefined

  const removeLinks = (role: FontRole): void => {
    for (const link of links.get(role) ?? []) link.remove()
    links.delete(role)
  }

  /**
   * Link one role's stylesheets, replacing whatever it had.
   * @param role - the role being applied.
   * @param face - the face it resolves to.
   */
  const installLinks = (role: FontRole, face: FontFace): void => {
    const created: HTMLLinkElement[] = []
    // One link per sheet: a face may declare several weights, and each sheet
    // carries its own `@font-face` rules and its own shard set.
    for (const sheet of face.source.sheets) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.dataset.plugin = PLUGIN_ID
      link.href = `${FONTS_ROUTE}/${face.id}/${sheet}`
      document.head.appendChild(link)
      created.push(link)
    }
    links.set(role, created)
  }

  /** Rebuild the single token layer from the roles in effect. */
  const syncTokens = (): void => {
    releaseTokens?.()
    releaseTokens = undefined
    const tokens: Record<string, { light: string; dark: string }> = {}
    for (const role of ROLE_ORDER) {
      const choice = applied.get(role)
      const face = choice === undefined ? undefined : faceById(choice, role)
      if (face === undefined) continue
      const stack = fontStack(face, role)
      // A font carries no colour scheme, so both modes take the same stack
      // rather than leaving one palette uncovered.
      for (const token of FONT_ROLES[role].tokens) tokens[token] = { light: stack, dark: stack }
    }
    if (Object.keys(tokens).length > 0) releaseTokens = ctx.theme.overrideTokens(PLUGIN_ID, tokens)
  }

  /** Apply one role's choice: its links, and bookkeeping for the token layer. */
  const settle = (role: FontRole, choice: string): void => {
    applied.set(role, choice)
    removeLinks(role)
    const face = faceById(choice, role)
    if (face !== undefined) installLinks(role, face)
  }

  const sync = (): void => {
    const value = scope.getSnapshot().value
    const choices = {
      body: resolveFontChoice(value?.font, 'body'),
      code: resolveFontChoice(value?.codeFont, 'code'),
    } satisfies Record<FontRole, string>
    const moved = ROLE_ORDER.filter(role => applied.get(role) !== choices[role])
    if (moved.length === 0) return
    for (const role of moved) settle(role, choices[role])
    syncTokens()
  }

  sync()
  const stop = scope.subscribe(sync)
  return () => {
    stop()
    releaseTokens?.()
    releaseTokens = undefined
    for (const role of ROLE_ORDER) removeLinks(role)
  }
}
