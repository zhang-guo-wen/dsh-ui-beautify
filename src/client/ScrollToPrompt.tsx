import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button, IconChevronUpOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NS } from './locales.ts'
import { earlierPageButtonOf, requestEarlierPage, type EarlierPageHost } from './earlier-page.ts'
import { nearestPromptAbove, promptScrollerOf, scrollToPrompt } from './scroll-to-prompt.ts'
import type { SettingsRowFace } from './settings-controller.ts'
import css from './ScrollToPrompt.module.css'

export type ScrollToPromptProps =
  PropsRuntime<'conversation.input.dock'>
  & PropsLocale<typeof NS>
  & InjectFace<SettingsRowFace>

/** The browser clock and frames one page request runs on. */
const PAGE_HOST: EarlierPageHost = {
  now: () => performance.now(),
  requestFrame: callback => requestAnimationFrame(callback),
  cancelFrame: handle => { cancelAnimationFrame(handle) },
}

/** A zero-height dock anchor locates its own conversation; the control lives outside the clipped flow. */
export function ScrollToPrompt({ t, useBeautify }: ScrollToPromptProps): ReactNode {
  const anchor = useRef<HTMLSpanElement>(null)
  const [target, setTarget] = useState<{ flow: HTMLElement; frame: HTMLElement } | null>(null)
  const [visible, setVisible] = useState(false)
  // True while the host is fetching the page this press asked for.
  const [busy, setBusy] = useState(false)
  const pendingPage = useRef<(() => void) | null>(null)
  // The settings switch owns this control's presence. The slot entry stays
  // registered either way, so switching it back on restores the button without
  // a page reload — a vanished entry would be indistinguishable from a broken one.
  const enabled = useBeautify(snapshot => snapshot.scrollToPromptEnabled)
  useLayoutEffect(() => {
    // Re-runs on the switch, because a control that was never located when it
    // was off has to bind to its conversation the moment it is switched on.
    if (!enabled) {
      setTarget(null)
      setVisible(false)
      setBusy(false)
      pendingPage.current?.()
      pendingPage.current = null
      return
    }
    const content = anchor.current?.closest<HTMLElement>('[data-conversation-content]')
    if (content == null) return
    let flow: HTMLElement | null = null
    let scroller: HTMLElement | null = null
    let resize: ResizeObserver | null = null
    const update = (): void => {
      // Visible while some sent input sits above the reader's viewport, or while
      // the host still holds an unloaded page: either way one press moves the
      // reader one round further up, so the control never disappears at the
      // boundary and leave the reader hunting for the host's own button. A page
      // already in flight keeps the control in place (it shows the busy state)
      // rather than blinking out for the length of the request.
      setVisible(flow !== null && scroller !== null
        && (nearestPromptAbove(flow, scroller) !== null || earlierPageButtonOf(flow) !== null))
    }
    const sync = (): void => {
      const next = content.querySelector<HTMLElement>('[data-chat-flow]')
      if (next !== flow) {
        scroller?.removeEventListener('scroll', update)
        resize?.disconnect()
        flow = next
        // Host structure: frame > root > list > flow. The floating bottom control
        // also belongs to frame; do not insert into the message list itself.
        const list = flow?.parentElement ?? null
        const frame = list?.parentElement?.parentElement ?? null
        scroller = flow === null ? null : promptScrollerOf(flow)
        setTarget(flow !== null && frame !== null ? { flow, frame } : null)
        scroller?.addEventListener('scroll', update, { passive: true })
        if (flow !== null && scroller !== null && typeof ResizeObserver !== 'undefined') {
          resize = new ResizeObserver(update)
          resize.observe(flow)
          resize.observe(scroller)
        }
      }
      update()
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(content, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['hidden', 'data-chat-flow-kind'] })
    return () => {
      observer.disconnect()
      resize?.disconnect()
      scroller?.removeEventListener('scroll', update)
      // The host's page lands on its own; only the landing that was waiting for it
      // must not outlive the unmounted control.
      pendingPage.current?.()
      pendingPage.current = null
    }
  }, [enabled])
  /**
   * Step up one round. At the boundary of the loaded history the same press asks
   * the host for the older page and lands on the round it added, so the reader
   * never has to press the host's own "load earlier" control. The landing itself
   * is retried by the request, because the host's paging anchor writes the old
   * position back after it.
   */
  const press = (): void => {
    if (target === null || busy || pendingPage.current !== null) return
    const flow = target.flow
    if (scrollToPrompt(flow)) return
    const cancel = requestEarlierPage(flow, PAGE_HOST, () => {
      pendingPage.current = null
      setBusy(false)
    })
    if (cancel === null) return
    pendingPage.current = cancel
    setBusy(true)
  }
  return <>
    <span ref={anchor} className={css.anchor} aria-hidden="true" />
    {enabled && target !== null && visible ? createPortal(
      <div className={css.slot} data-ui-beautify-to-prompt="">
        <Button className={css.button} aria-label={t('backToPrompt')} title={t('backToPrompt')}
          disabled={busy} onClick={press} icon={<IconChevronUpOutlineRegular />} />
      </div>, target.frame,
    ) : null}
  </>
}
