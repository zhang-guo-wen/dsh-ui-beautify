/**
 * Put a conversation back on its newest content when the reader returns to it.
 *
 * The host remembers one reading position per Session for the length of the page
 * and restores it on every later open. An answer landing is a reading position
 * too: it scrolls the transcript up to the last answer's first row, and the
 * host's own sampler records exactly that row. Reopening the Session later then
 * restores the landing — the transcript jumps back to the last answer instead of
 * showing what arrived since, with no unread mark to explain the move.
 *
 * Only a landing this module recorded can be undone, and only while the host
 * still rests on it: the transcript shows the landed answer exactly at the
 * landing inset. A reader who moved on has their own position, which stays
 * theirs. The undo lands on the transcript floor, so the Session opens on its
 * newest content.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/answer-return
 */
import { answerLanding, ANSWER_TOP_INSET } from './answer-start.ts'
import { promptScrollerOf } from './scroll-to-prompt.ts'

/** How long a returned Session may take to show the host's restored position. */
export const RETURN_WINDOW_MS = 1500

/** Pixels of slack when the host restores to the landing it sampled. */
export const RETURN_TOLERANCE = 6

/** The document, clock, frames, and change feed the return needs. */
export interface LandingReturnHost {
  readonly document: Document
  /** Monotonic milliseconds, matching `performance.now()`. */
  now(): number
  /**
   * Run one callback before the next paint.
   * @param callback - the observation step.
   * @returns a cancellation handle.
   */
  requestFrame(callback: () => void): number
  /**
   * Cancel one scheduled frame.
   * @param handle - the handle `requestFrame` returned.
   */
  cancelFrame(handle: number): void
  /**
   * Watch DOM changes that can reveal a different conversation.
   * @param callback - called after a change, not synchronized to frames.
   * @returns the unsubscribe function.
   */
  observe(callback: () => void): () => void
}

/** The installed observer, armed once per recorded landing. */
export interface LandingReturn {
  /** Begin watching for a return; the first call primes the visible Session. */
  arm(): void
  /** Abandon a waiting return without forgetting the landing. */
  cancel(): void
  /** Release the observer, the pending frame, and the return. */
  dispose(): void
}

/** One Session the reader came back to. */
interface Waiting {
  readonly sessionId: string
  readonly deadline: number
  frame: number | null
}

/**
 * Watch visible conversations and undo a landing the reader returns to.
 * @param host - document, clock, frames, and the change feed.
 * @param landed - Sessions whose landing the host is carrying as a reading position.
 * @returns the armable observer.
 */
export function createLandingReturn(
  host: LandingReturnHost,
  landed: Set<string>,
): LandingReturn {
  let visible: string | null = null
  let armed = false
  let unwatch: (() => void) | null = null
  let scheduled: number | null = null
  let waiting: Waiting | null = null
  let disposed = false

  /** The visible conversation body of one Session. */
  const contentOf = (sessionId: string): HTMLElement | null => {
    for (const node of host.document.querySelectorAll<HTMLElement>('[data-conversation-content]')) {
      if (node.getAttribute('data-conversation-session') !== sessionId) continue
      if (node.getClientRects().length === 0) continue
      return node
    }
    return null
  }

  /** The Session whose conversation body is the one on screen. */
  const visibleSession = (): string | null => {
    for (const node of host.document.querySelectorAll<HTMLElement>('[data-conversation-content]')) {
      if (node.getClientRects().length === 0) continue
      const id = node.getAttribute('data-conversation-session')
      if (id !== null) return id
    }
    return null
  }

  const stopWaiting = (): void => {
    if (waiting === null) return
    if (waiting.frame !== null) host.cancelFrame(waiting.frame)
    waiting = null
  }

  const scrollToFloor = (scroller: HTMLElement): void => {
    const floor = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
    scroller.scrollTo({ top: floor, behavior: 'instant' })
    // Navigation, not tail following: the host's own sampler must settle here too.
    scroller.dispatchEvent(new Event('scroll'))
    scroller.dispatchEvent(new Event('scrollend'))
  }

  const step = (): void => {
    const state = waiting
    if (state === null || disposed) return
    state.frame = null
    const content = contentOf(state.sessionId)
    const flow = content?.querySelector<HTMLElement>('[data-chat-flow]') ?? null
    const scroller = flow === null ? null : promptScrollerOf(flow)
    const measured = flow === null ? null : answerLanding(flow)
    if (scroller === null || measured === null) {
      if (host.now() > state.deadline) {
        waiting = null
        landed.delete(state.sessionId)
        return
      }
      state.frame = host.requestFrame(step)
      return
    }
    if (Math.abs(measured.offset - ANSWER_TOP_INSET) <= RETURN_TOLERANCE) {
      waiting = null
      landed.delete(state.sessionId)
      scrollToFloor(scroller)
      return
    }
    if (host.now() > state.deadline) {
      // The host did not come back to the landing: the reader's own position stands.
      waiting = null
      landed.delete(state.sessionId)
      return
    }
    state.frame = host.requestFrame(step)
  }

  const startWaiting = (sessionId: string): void => {
    stopWaiting()
    const state: Waiting = { sessionId, deadline: host.now() + RETURN_WINDOW_MS, frame: null }
    waiting = state
    state.frame = host.requestFrame(step)
  }

  const sync = (): void => {
    scheduled = null
    if (disposed) return
    const next = visibleSession()
    if (next === visible) return
    const previous = visible
    visible = next
    stopWaiting()
    if (next === null || previous === null) return
    if (landed.has(next)) startWaiting(next)
  }

  const schedule = (): void => {
    if (disposed || scheduled !== null) return
    scheduled = host.requestFrame(sync)
  }

  return {
    arm(): void {
      if (disposed || armed) return
      armed = true
      visible = visibleSession()
      unwatch = host.observe(schedule)
    },
    cancel(): void {
      stopWaiting()
    },
    dispose(): void {
      disposed = true
      stopWaiting()
      if (scheduled !== null) host.cancelFrame(scheduled)
      scheduled = null
      unwatch?.()
      unwatch = null
    },
  }
}
