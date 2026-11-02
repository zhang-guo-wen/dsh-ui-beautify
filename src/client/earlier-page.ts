/**
 * The host's "load earlier" control and one page request through it.
 *
 * While older history remains, the Chat flow starts with a wrapper holding one
 * button — "加载更早" in Chinese, "Load earlier" in English — rendered before
 * any message row. The plugin finds that control by structure, so the localized
 * label never has to be matched, and a message row can never be mistaken for it:
 * rows carry `data-chat-flow-kind` and stop the scan.
 *
 * The host keeps the reader's position while it prepends a page (its paging
 * anchor compensates in the commit that adds the rows), and that compensation is
 * written *after* a single landing scroll can already have happened — measured
 * 0.1ms after it, in the same frame. So the press does not land once: it lands,
 * then re-checks the same row for a few frames and lands again whenever the host
 * moved it, which is what makes the reader actually end up on the new round.
 * A prepended page is recognized by the flow's first row changing identity;
 * streamed output only ever appends, so it cannot be mistaken for one.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/earlier-page
 */
import { readableTopOf, READING_INSET } from './reading-top.ts'
import {
  FLOW_ROW_SELECTOR, landRow, nearestPromptAbove, promptScrollerOf,
} from './scroll-to-prompt.ts'

/** Leading flow children inspected while looking for the host's older-page control. */
export const EARLIER_WRAPPER_SCAN = 3

/** Frames the committed page gets to settle before the press starts landing. */
export const EARLIER_PAGE_SETTLE_FRAMES = 2

/** Consecutive frames the landed row must hold, so the host's own anchor write has happened. */
export const EARLIER_LAND_SETTLE_FRAMES = 3

/** Consecutive landings that leave the scrollport unmoved mean the page ends there. */
export const EARLIER_LAND_STUCK_FRAMES = 2

/** How long one press may take before the wait is abandoned. */
export const EARLIER_PAGE_TIMEOUT_MS = 10_000

/** One pixel of slack: the host's own restored position may round. */
const LAND_TOLERANCE = 1

/** Clock and frame scheduling the page request needs; explicit for the regression tests. */
export interface EarlierPageHost {
  /** Monotonic milliseconds, matching `performance.now()`. */
  now(): number
  /**
   * Run one callback before the next paint.
   * @param callback - the polling step.
   * @returns a cancellation handle.
   */
  requestFrame(callback: () => void): number
  /**
   * Cancel one scheduled frame.
   * @param handle - the handle `requestFrame` returned.
   */
  cancelFrame(handle: number): void
}

/** The row one press is landing on, and how steadily it has held. */
interface Landing {
  readonly row: HTMLElement
  stable: number
  stuck: number
}

/**
 * Release the host's paging anchor with the reader intent it honors.
 *
 * A prepend leaves the host's anchor armed, and it writes the preserved position
 * back on the frame after *every* programmatic scroll — re-landing alone never
 * wins (measured in the browser: 12 frames of write-back after each attempt).
 * The host listens for reading intents on its scrollport and releases the anchor
 * on any of them, including a synthesized press, so one press inside the
 * transcript before the first landing is what makes the landing hold.
 * @param scroller - the Chat scrollport.
 */
export function releasePagingAnchor(scroller: HTMLElement): void {
  // Chromium is the only target; a host without pointer events keeps the plain
  // landing, which is still correct when no page was just prepended.
  if (typeof PointerEvent !== 'function') return
  scroller.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
}

/**
 * The host's older-page button inside one Chat flow.
 *
 * The wrapper is one of the flow's leading element children — after the optional
 * history-loading hint and error rows — and holds nothing but that button.
 * @param flow - the Chat flow (`[data-chat-flow]`).
 * @returns the control, or null when every page is loaded.
 */
export function earlierPageButtonOf(flow: HTMLElement): HTMLButtonElement | null {
  const children = flow.children
  if (children === null || children === undefined) return null
  const limit = Math.min(children.length, EARLIER_WRAPPER_SCAN)
  for (let index = 0; index < limit; index += 1) {
    const wrapper = children[index]!
    // Message rows start here; the control, when it exists, is rendered first.
    if (wrapper.hasAttribute?.('data-chat-flow-kind') === true) return null
    if (wrapper.childElementCount !== 1) continue
    const control = wrapper.firstElementChild
    if (control !== null && control.tagName === 'BUTTON') return control as HTMLButtonElement
  }
  return null
}

/**
 * Ask the host for one older page, then land the reader on the round it added.
 *
 * The click is the host's own control, so its loading state, error surface, and
 * paging anchor all behave as they do for a manual press; this decides only when
 * the reader may be moved onto the result. A press that finds nothing to load
 * does nothing at all, leaving the affordance for the next press.
 *
 * @param flow - the Chat flow holding the control.
 * @param host - clock and frame scheduler.
 * @param onSettled - called once when the press stops waiting, whether a page
 *   landed or the wait was abandoned.
 * @returns the canceller, or null when no page could be requested.
 */
export function requestEarlierPage(
  flow: HTMLElement,
  host: EarlierPageHost,
  onSettled: () => void,
): (() => void) | null {
  const button = earlierPageButtonOf(flow)
  if (button === null || button.disabled) return null
  const deadline = host.now() + EARLIER_PAGE_TIMEOUT_MS
  const firstRow = flow.querySelector<HTMLElement>(FLOW_ROW_SELECTOR)
  let frame: number | null = null
  let done = false
  let pageSettled = 0
  let landing: Landing | null = null
  const stop = (): void => {
    done = true
    if (frame !== null) {
      host.cancelFrame(frame)
      frame = null
    }
    onSettled()
  }
  /** Land the captured row again; report whether the scrollport could not move. */
  const reland = (scroller: HTMLElement, state: Landing): boolean => {
    const before = scroller.scrollTop
    landRow(flow, state.row)
    return scroller.scrollTop === before
  }
  const landStep = (scroller: HTMLElement): void => {
    if (landing === null) {
      const row = nearestPromptAbove(flow, scroller)
      if (row === null) {
        // The page is committed but its rows have not been laid out yet.
        frame = host.requestFrame(step)
        return
      }
      releasePagingAnchor(scroller)
      landing = { row, stable: 0, stuck: 0 }
    }
    const state = landing
    const offset = state.row.getBoundingClientRect().top - readableTopOf(flow, scroller) - READING_INSET
    if (Math.abs(offset) <= LAND_TOLERANCE) {
      state.stable += 1
      state.stuck = 0
      if (state.stable >= EARLIER_LAND_SETTLE_FRAMES) {
        stop()
        return
      }
    } else {
      state.stable = 0
      state.stuck = reland(scroller, state) ? state.stuck + 1 : 0
      if (state.stuck >= EARLIER_LAND_STUCK_FRAMES) {
        stop()
        return
      }
    }
    frame = host.requestFrame(step)
  }
  const step = (): void => {
    frame = null
    if (done) return
    if (host.now() > deadline) {
      // The page may still land later; the press is simply no longer waiting for it.
      stop()
      return
    }
    if (landing !== null) {
      const scroller = promptScrollerOf(flow)
      if (scroller === null) {
        stop()
        return
      }
      landStep(scroller)
      return
    }
    const control = earlierPageButtonOf(flow)
    const prepended = flow.querySelector<HTMLElement>(FLOW_ROW_SELECTOR) !== firstRow
    if (prepended && (control === null || !control.disabled)) {
      pageSettled += 1
      if (pageSettled >= EARLIER_PAGE_SETTLE_FRAMES) {
        const scroller = promptScrollerOf(flow)
        if (scroller === null) {
          stop()
          return
        }
        landStep(scroller)
        return
      }
    } else {
      pageSettled = 0
    }
    frame = host.requestFrame(step)
  }
  button.click()
  frame = host.requestFrame(step)
  return () => {
    if (done) return
    done = true
    if (frame !== null) {
      host.cancelFrame(frame)
      frame = null
    }
  }
}
