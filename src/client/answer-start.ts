/**
 * Where an opened conversation should land: the first row of its last answer.
 *
 * The host restores a Session's saved reading position, or follows the tail when
 * there is none. A conversation that finished while the reader was in another
 * one therefore opens at its last line, and a reader who wants to read that
 * answer has to scroll up by themselves. This module names the other end of the
 * last answer — the row the host renders for the answer step — and positions it
 * the same reading inset below the transcript's visible top edge that the
 * up-navigation controls use.
 *
 * The DOM contract is the installed host's own: answer rows carry
 * `data-chat-flow-kind="assistant-step"`, collapsed turn-process rows are hidden
 * with the `hidden` attribute or a zero box, and the scroller is marked with
 * `data-conversation-scroll`. A host that renames any of these turns every
 * function here into a no-op; none of them throws.
 */
import { READING_INSET, readableTopOf } from './reading-top.ts'

/** Rows the host renders for the answer step of an assistant turn. */
export const ANSWER_ROW_SELECTOR = '[data-chat-flow-kind="assistant-step"]'

/** Reading inset above the answer's first line, shared with the up controls. */
export const ANSWER_TOP_INSET = READING_INSET

/** The scroller a Chat flow reports to; the conversation body owns it when present. */
export function answerScrollerOf(flow: HTMLElement): HTMLElement | null {
  return flow.closest<HTMLElement>('[data-conversation-scroll]') ?? flow.parentElement
}

/**
 * The last answer row the reader can actually see.
 *
 * The tail is the newest answer, and the loaded transcript ends there, so the
 * backward scan answers with one position read in the common case. Rows inside a
 * collapsed turn-process group are `hidden` or have no box, and a zero-height row
 * carries no text to start reading.
 * @param flow - the Chat flow (`[data-chat-flow]`) holding the transcript.
 * @returns the row to land on, or null when the transcript holds no visible answer.
 */
export function lastVisibleAnswer(flow: HTMLElement): HTMLElement | null {
  const rows = flow.querySelectorAll<HTMLElement>(ANSWER_ROW_SELECTOR)
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]!
    if (row.closest('[hidden]') !== null) continue
    if (row.getClientRects().length === 0) continue
    if (row.getBoundingClientRect().height <= 0) continue
    return row
  }
  return null
}

/** The scroll offset that would move the last answer to the reading inset, and its current offset. */
export interface AnswerLanding {
  readonly scroller: HTMLElement
  /** Current distance from the answer row's top to the transcript's visible top. */
  readonly offset: number
  /** Scroll offset that lands the answer at {@link ANSWER_TOP_INSET}. */
  readonly target: number
}

/**
 * Measure the landing the reader would get for the last visible answer.
 *
 * The target clamps at the top: a short transcript has no room above its first
 * row, and the host clamps the write for the same reason.
 * @param flow - the Chat flow (`[data-chat-flow]`) holding the transcript.
 * @returns the scroller, current offset, and target offset, or null when there is
 * no visible answer or no scrollport.
 */
export function answerLanding(flow: HTMLElement): AnswerLanding | null {
  const scroller = answerScrollerOf(flow)
  if (scroller === null) return null
  const row = lastVisibleAnswer(flow)
  if (row === null) return null
  // The floating session-start chip hangs over the scrollport's top edge, so the
  // readable top is the chip's bottom edge whenever it is there. The settle loop
  // re-measures every frame, so a chip that appears because of this landing also
  // gets cleared instead of cutting the answer's first line.
  const top = readableTopOf(flow, scroller)
  const offset = row.getBoundingClientRect().top - top
  return { scroller, offset, target: Math.max(0, scroller.scrollTop + offset - ANSWER_TOP_INSET) }
}

/**
 * Position the last answer at the reading inset and hand the move to the host.
 *
 * Both events are dispatched for the host's reading sampler: this is navigation,
 * not tail following, so later layout growth must not pull the reader back down.
 * @param flow - the Chat flow (`[data-chat-flow]`) to land.
 * @returns whether a visible answer was found and scrolled to.
 */
export function landAnswer(flow: HTMLElement): boolean {
  const landing = answerLanding(flow)
  if (landing === null) return false
  landing.scroller.scrollTo({ top: landing.target, behavior: 'instant' })
  landing.scroller.dispatchEvent(new Event('scroll'))
  landing.scroller.dispatchEvent(new Event('scrollend'))
  return true
}
