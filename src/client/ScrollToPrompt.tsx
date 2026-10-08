import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button, IconChevronUpOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NS } from './locales.ts'
import { latestPrompt, scrollToPrompt } from './scroll-to-prompt.ts'
import type { SettingsRowFace } from './settings-controller.ts'
import css from './ScrollToPrompt.module.css'

export type ScrollToPromptProps =
  PropsRuntime<'conversation.input.dock'>
  & PropsLocale<typeof NS>
  & InjectFace<SettingsRowFace>

/** A zero-height dock anchor locates its own conversation; the control lives outside the clipped flow. */
export function ScrollToPrompt({ t, useBeautify }: ScrollToPromptProps): ReactNode {
  const anchor = useRef<HTMLSpanElement>(null)
  const [target, setTarget] = useState<{ flow: HTMLElement; frame: HTMLElement } | null>(null)
  const [visible, setVisible] = useState(false)
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
      return
    }
    const content = anchor.current?.closest<HTMLElement>('[data-conversation-content]')
    if (content == null) return
    let flow: HTMLElement | null = null
    let scroller: HTMLElement | null = null
    let resize: ResizeObserver | null = null
    const update = (): void => {
      const row = flow === null ? null : latestPrompt(flow)
      setVisible(row !== null && scroller !== null
        && row.getBoundingClientRect().top < scroller.getBoundingClientRect().top - 1)
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
        scroller = flow?.closest<HTMLElement>('[data-conversation-scroll]') ?? list
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
    }
  }, [enabled])
  return <>
    <span ref={anchor} className={css.anchor} aria-hidden="true" />
    {enabled && target !== null && visible ? createPortal(
      <div className={css.slot} data-ui-beautify-to-prompt="">
        <Button className={css.button} aria-label={t('backToPrompt')} title={t('backToPrompt')}
          onClick={() => { scrollToPrompt(target.flow) }} icon={<IconChevronUpOutlineRegular />} />
      </div>, target.frame,
    ) : null}
  </>
}
