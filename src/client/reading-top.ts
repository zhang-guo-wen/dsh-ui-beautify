/**
 * Where the readable transcript starts inside a chat scrollport.
 *
 * The floating transcript controls — the session-start chip — hang over the top
 * of the scrollport on purpose: the chip is a zero-height sticky anchor whose
 * line paints over the rows scrolling behind it. A jump that lands a row at the
 * scrollport's own top edge therefore leaves that row's first pixels under the
 * chip. Both jump paths (the up control and the unread-answer landing) read the
 * same top line from here, so a row they land at starts below whatever floats
 * above the transcript.
 *
 * The chip is measured live rather than assumed: its height carries the content
 * font delta, and the chip is absent whenever its switch is off, the host owns a
 * native strip, or the reader is at the top of the transcript. A host that never
 * renders the chip simply measures the scrollport edge.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/reading-top
 */

/** Reading inset below the transcript's visible top edge, shared by both jumps. */
export const READING_INSET = 24
/**
 * The line inside the session-start chip.
 *
 * The slot itself is a zero-height sticky anchor, so its own rectangle says
 * nothing; the line is what hangs over the scrollport.
 */
export const START_CHIP_LINE_SELECTOR = '[data-ui-beautify-session-start-line]'

/**
 * The topmost visible line of one chat flow: the scrollport's top edge, or the
 * bottom edge of the session-start chip when the chip hangs over it.
 * @param flow - the Chat flow (`[data-chat-flow]`) inside the conversation body.
 * @param scroller - the scrollport the flow reports to.
 * @returns the Y coordinate a landed row's top should clear.
 */
export function readableTopOf(flow: HTMLElement, scroller: HTMLElement): number {
  const top = scroller.getBoundingClientRect().top
  const content = typeof flow.closest === 'function'
    ? flow.closest<HTMLElement>('[data-conversation-content]')
    : null
  if (content === null || typeof content.querySelector !== 'function') return top
  const line = content.querySelector<HTMLElement>(START_CHIP_LINE_SELECTOR)
  if (line === null) return top
  const rect = line.getBoundingClientRect()
  if (!(rect.height > 0) || rect.bottom <= top) return top
  return rect.bottom
}
