/**
 * DOM adapter scoped to one mounted Chat view; never scroll the document or a
 * side panel.
 *
 * Both upward controls share one target definition: the nearest visible sent
 * input above the reader's viewport — the beginning of the round the reader is
 * currently inside. The floating chip previews it, and the up button jumps to
 * it; from a landed prompt, the next press reaches the round before it, so
 * repeated presses walk back one round at a time.
 */
export const PROMPT_SELECTOR = '[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"]'

/** The scroller a Chat flow reports to; the conversation body owns it when present. */
export function promptScrollerOf(flow: HTMLElement): HTMLElement | null {
  return flow.closest<HTMLElement>('[data-conversation-scroll]') ?? flow.parentElement
}

/**
 * The nearest visible sent input above the scroller's top edge — the round the
 * reader is currently inside. Rows sit in document order, so the backward scan
 * answers with one position read in the common at-the-bottom case. Returns null
 * once that round's start is in view, which is what hides both controls.
 */
export function nearestPromptAbove(flow: HTMLElement, scroller: HTMLElement): HTMLElement | null {
  const top = scroller.getBoundingClientRect().top
  const rows = flow.querySelectorAll<HTMLElement>(PROMPT_SELECTOR)
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index]!
    if (row.closest('[hidden]') !== null || row.getClientRects().length === 0) continue
    if (row.getBoundingClientRect().top < top - 1) return row
  }
  return null
}

/**
 * Plain beginning text of one sent input: a detached copy with the message
 * chrome removed, so the clock line never reaches the preview. A message with
 * no text of its own reads as its attachment names, which the row keeps in
 * `title`/`alt` attributes rather than as text.
 */
export function promptPreviewText(row: HTMLElement, limit = 400): string {
  const clone = row.cloneNode(true) as HTMLElement
  const labels: string[] = []
  for (const element of clone.querySelectorAll('[data-clock], [data-message-attachments]')) {
    for (const named of element.querySelectorAll('[title], [alt]')) {
      const label = named.getAttribute('title') ?? named.getAttribute('alt')
      if (label !== null && label !== '') labels.push(label)
    }
    element.remove()
  }
  let text = (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (text === '') text = labels.join(' ')
  if (text.length <= limit) return text
  return `${Array.from(text).slice(0, limit).join('')}…`
}

/** Position the nearest prompt above the reader, leaving a small reading inset. */
export function scrollToPrompt(flow: HTMLElement): boolean {
  const scroller = promptScrollerOf(flow)
  if (scroller === null) return false
  const row = nearestPromptAbove(flow, scroller)
  if (row === null) return false
  const top = scroller.scrollTop + row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 24
  scroller.scrollTo({ top: Math.max(0, top), behavior: 'instant' })
  // Settle the host's reader-position sampling immediately. This is navigation,
  // not bottom following: subsequent streamed output must not pull the reader down.
  scroller.dispatchEvent(new Event('scroll'))
  scroller.dispatchEvent(new Event('scrollend'))
  return true
}
