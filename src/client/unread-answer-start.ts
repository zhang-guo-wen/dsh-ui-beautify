/**
 * Land an opened "finished, not read" conversation at the beginning of its last
 * answer.
 *
 * The trigger is the host's green dot seen from the other side: `uiSession`
 * publishes a Session's `completionUnread` flag, and the host clears it when that
 * Session becomes the main view. That publication arrives before React has
 * rendered the opened conversation, so this controller keeps the Session id and
 * walks the frames until the conversation body exists and the host's own saved
 * position (or tail follow) has settled, then moves the reader to the answer's
 * first row. A reader gesture during that window abandons the landing: the
 * gesture owns the viewport from then on, and the window closes after
 * {@link LANDING_WINDOW_MS} regardless, so a conversation that never renders
 * cannot be scrolled long after the fact.
 *
 * The switch that owns this behavior lives in the settings page; the plugin body
 * installs and releases this controller through `watchFeature`.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/unread-answer-start
 */
import type { Context } from '@deepseek-ai/cordis'
import { answerLanding, ANSWER_TOP_INSET, landAnswer } from './answer-start.ts'
import { openedFromUnread, type SessionStatusSnapshot } from './unread-entry.ts'

/** How long an opened Session may take to mount and settle before the landing is abandoned. */
export const LANDING_WINDOW_MS = 2500

/** Consecutive frames the landed offset must hold, so the host's own restore has finished. */
export const SETTLE_FRAMES = 3

/** Keys whose press moves the transcript; any of them hands the viewport back to the reader. */
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

/** Browser reading gestures that cancel a pending landing. */
const INTENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

/** The host observable this controller watches. */
export interface UnreadAnswerStartSource {
  /**
   * Read the latest status publication.
   * @returns the current per-Session status map.
   */
  getSnapshot(): SessionStatusSnapshot
  /**
   * Observe status publications.
   * @param listener - called after each publication.
   * @returns the unsubscribe function.
   */
  subscribe(listener: () => void): () => void
}

/** The document and clock the landing needs; explicit so the regression tests can drive it. */
export interface UnreadAnswerStartHost {
  readonly document: Document
  /** Monotonic milliseconds, matching `performance.now()`. */
  now(): number
  /**
   * Run one callback before the next paint.
   * @param callback - the landing step.
   * @returns a cancellation handle.
   */
  requestFrame(callback: () => void): number
  /**
   * Cancel one scheduled frame.
   * @param handle - the handle `requestFrame` returned.
   */
  cancelFrame(handle: number): void
}

/** One Session whose landing is being waited for. */
interface PendingLanding {
  readonly sessionId: string
  readonly deadline: number
  frame: number | null
  stable: number
}

/**
 * Whether an event target is inside the element the selector names.
 * @param target - the event target to inspect.
 * @param selector - the ancestor selector.
 * @returns whether a closest ancestor (or the target itself) matches.
 */
function matchesClosest(target: EventTarget | null, selector: string): boolean {
  if (target === null || typeof target !== 'object') return false
  const closest = (target as { closest?: unknown }).closest
  if (typeof closest !== 'function') return false
  return (closest as (selector: string) => Element | null).call(target, selector) !== null
}

/**
 * Watch status publications and land the conversation a reader just opened.
 * @param source - the host's per-Session status observable.
 * @param host - the document and frame scheduler.
 * @returns a disposer releasing the subscription, the pending frame, and the listeners.
 */
export function createUnreadAnswerStart(
  source: UnreadAnswerStartSource,
  host: UnreadAnswerStartHost,
): () => void {
  let previous: SessionStatusSnapshot | undefined = source.getSnapshot()
  let pending: PendingLanding | null = null

  const stopLanding = (): void => {
    if (pending === null) return
    if (pending.frame !== null) host.cancelFrame(pending.frame)
    pending = null
  }

  /**
   * The visible conversation body of one Session.
   *
   * Other conversations stay mounted behind the active view and keep their
   * attribute, so the first visible one is the only eligible target.
   * @param sessionId - the Session the reader opened.
   * @returns its conversation body, or null while it is not rendered.
   */
  const visibleContent = (sessionId: string): HTMLElement | null => {
    for (const node of host.document.querySelectorAll<HTMLElement>('[data-conversation-content]')) {
      if (node.getAttribute('data-conversation-session') !== sessionId) continue
      if (node.getClientRects().length === 0) continue
      return node
    }
    return null
  }

  const step = (): void => {
    const landing = pending
    if (landing === null) return
    landing.frame = null
    if (host.now() > landing.deadline) {
      pending = null
      return
    }
    const content = visibleContent(landing.sessionId)
    const flow = content?.querySelector<HTMLElement>('[data-chat-flow]') ?? null
    const measured = flow === null ? null : answerLanding(flow)
    if (flow !== null && measured !== null) {
      if (Math.abs(measured.offset - ANSWER_TOP_INSET) <= 1) {
        landing.stable += 1
        if (landing.stable >= SETTLE_FRAMES) {
          pending = null
          return
        }
      } else {
        landing.stable = 0
        landAnswer(flow)
      }
    }
    landing.frame = host.requestFrame(step)
  }

  const start = (sessionId: string): void => {
    stopLanding()
    const landing: PendingLanding = {
      sessionId,
      deadline: host.now() + LANDING_WINDOW_MS,
      frame: null,
      stable: 0,
    }
    pending = landing
    landing.frame = host.requestFrame(step)
  }

  const onStatus = (): void => {
    const next = source.getSnapshot()
    const opened = openedFromUnread(previous, next)
    previous = next
    const sessionId = opened.at(-1)
    if (sessionId !== undefined) start(sessionId)
  }

  const onIntent = (event: Event): void => {
    if (pending === null) return
    if (event.type === 'keydown') {
      const key = (event as KeyboardEvent).key
      if (!SCROLL_KEYS.has(key)) return
    } else if ((event.type === 'pointerdown' || event.type === 'touchstart')
      && !matchesClosest(event.target, '[data-conversation-scroll]')) {
      return
    }
    stopLanding()
  }

  const stop = source.subscribe(onStatus)
  for (const type of INTENTS) host.document.addEventListener(type, onIntent, { capture: true, passive: true })
  return () => {
    stop()
    stopLanding()
    for (const type of INTENTS) host.document.removeEventListener(type, onIntent, { capture: true })
  }
}

/** The `uiSession` service slice this module reads; the package has no dependency on its types. */
interface UiSessionStatus {
  readonly sessionStatus?: UnreadAnswerStartSource
}

/**
 * Install the landing through the browser globals the client bundle runs in.
 * @param ctx - client cordis context owning the subscription.
 * @returns a disposer releasing the controller.
 */
export function installUnreadAnswerStart(ctx: Context): () => void {
  const uiSession = ctx.get('uiSession') as UiSessionStatus | undefined
  const source = uiSession?.sessionStatus
  // A Host that predates the status publication keeps the plugin working; only
  // this one behavior is unavailable.
  if (source === undefined) return () => {}
  return createUnreadAnswerStart(source, {
    document,
    now: () => performance.now(),
    requestFrame: callback => requestAnimationFrame(callback),
    cancelFrame: handle => { cancelAnimationFrame(handle) },
  })
}
