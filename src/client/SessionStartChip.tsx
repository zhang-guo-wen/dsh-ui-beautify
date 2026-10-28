/**
 * The floating "conversation start" chip: an IDEA-like fold marker for the chat
 * transcript.
 *
 * When the beginning of the round the reader is inside has scrolled above the
 * viewport, one short line of that round's opening message floats at the top of
 * the conversation — the way folded code shows its first line. Clicking it
 * jumps back to the round's start. Only one line is ever mounted — the nearest
 * round start above the reader — so there is never a nested stack of markers
 * like folded code has.
 *
 * The up button next to the host's down control walks the same list one round
 * per press (see `scroll-to-prompt.ts`); this chip is the preview half of that
 * pair and carries its own visibility switch.
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconChevronUpOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NS } from './locales.ts'
import { nearestPromptAbove, promptPreviewText, promptScrollerOf, scrollToPrompt } from './scroll-to-prompt.ts'
import type { SettingsRowFace } from './settings-controller.ts'
import css from './SessionStartChip.module.css'

export type SessionStartChipProps =
  PropsRuntime<'conversation.input.dock'>
  & PropsLocale<typeof NS>
  & InjectFace<SettingsRowFace>

/** A zero-height dock anchor locates its own conversation; the chip lives outside the clipped flow. */
export function SessionStartChip({ t, useBeautify }: SessionStartChipProps): ReactNode {
  const anchor = useRef<HTMLSpanElement>(null)
  const [target, setTarget] = useState<{ flow: HTMLElement; frame: HTMLElement } | null>(null)
  const [visible, setVisible] = useState(false)
  const [preview, setPreview] = useState('')
  const rowRef = useRef<HTMLElement | null>(null)
  // The settings switch owns this control's presence. The slot entry stays
  // registered either way, so switching it back on restores the chip without
  // a page reload — a vanished entry would be indistinguishable from a broken one.
  const enabled = useBeautify(snapshot => snapshot.sessionStartChipEnabled)
  useLayoutEffect(() => {
    // Re-runs on the switch, because a chip that was never located when it
    // was off has to bind to its conversation the moment it is switched on.
    if (!enabled) {
      setTarget(null)
      setVisible(false)
      setPreview('')
      rowRef.current = null
      return
    }
    const content = anchor.current?.closest<HTMLElement>('[data-conversation-content]')
    if (content == null) return
    let flow: HTMLElement | null = null
    let scroller: HTMLElement | null = null
    let resize: ResizeObserver | null = null
    const update = (): void => {
      const row = flow !== null && scroller !== null ? nearestPromptAbove(flow, scroller) : null
      setVisible(row !== null)
      if (row !== rowRef.current) {
        rowRef.current = row
        setPreview(row === null ? '' : promptPreviewText(row))
      }
    }
    const sync = (): void => {
      const next = content.querySelector<HTMLElement>('[data-chat-flow]')
      if (next !== flow) {
        scroller?.removeEventListener('scroll', update)
        resize?.disconnect()
        flow = next
        // Host structure: frame > root > list > flow. The floating chip belongs
        // to frame so it can stick to the scrollport's top edge; do not insert
        // into the message list itself.
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
      rowRef.current = null
    }
  }, [enabled])
  return <>
    <span ref={anchor} className={css.anchor} aria-hidden="true" />
    {enabled && target !== null && visible ? createPortal(
      <div className={css.slot} data-ui-beautify-session-start="">
        {/* The whole control is one line of the round's opening text with a
            hairline beneath it; clicking it jumps to that opening. */}
        <button type="button" className={css.chip}
          data-ui-beautify-session-start-line=""
          aria-label={t('sessionStartChipAria', { text: preview === '' ? t('sessionStartChipFallback') : preview })}
          onClick={() => { scrollToPrompt(target.flow) }}>
          <IconChevronUpOutlineRegular className={css.icon} />
          <span className={css.line}>
            {preview === '' ? t('sessionStartChipFallback') : preview}
          </span>
        </button>
      </div>, target.frame,
    ) : null}
  </>
}
