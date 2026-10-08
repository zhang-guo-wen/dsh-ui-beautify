/** DOM adapter scoped to one mounted Chat view; never scroll the document or a side panel. */
export const PROMPT_SELECTOR = '[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"]'

export function latestPrompt(flow: HTMLElement): HTMLElement | null {
  const rows = flow.querySelectorAll<HTMLElement>(PROMPT_SELECTOR)
  for (let index = rows.length - 1; index >= 0; index--) {
    const row = rows[index]!
    if (row.closest('[hidden]') === null && row.getClientRects().length > 0) return row
  }
  return null
}

/** Position the latest submitted input above its answer, leaving a small reading inset. */
export function scrollToPrompt(flow: HTMLElement): boolean {
  const row = latestPrompt(flow)
  if (row === null) return false
  const list = flow.parentElement
  const scroller = flow.closest<HTMLElement>('[data-conversation-scroll]') ?? list
  if (scroller === null) return false
  const top = scroller.scrollTop + row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 24
  scroller.scrollTo({ top: Math.max(0, top), behavior: 'instant' })
  // Settle the host's reader-position sampling immediately. This is navigation,
  // not bottom following: subsequent streamed output must not pull the reader down.
  scroller.dispatchEvent(new Event('scroll'))
  scroller.dispatchEvent(new Event('scrollend'))
  return true
}
