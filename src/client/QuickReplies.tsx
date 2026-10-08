/**
 * The composer dock's quick replies: one row of tags in the strip below the
 * composer card, each of which sends its phrase in a single click.
 *
 * The phrases are themselves the messages — clicking a tag submits text the
 * user would otherwise have typed — so the built-in ones are dictionary entries
 * rather than literals here, and the row offers whichever locale is active. What
 * the user typed over them lives in the settings, one phrase per slot; the
 * dictionary is only what an uncustomized install shows.
 *
 * A click writes the phrase into the draft at the caret and then submits, which
 * is the same path the Send button takes; nothing here talks to the Host on its
 * own. Inserting rather than replacing is what keeps a half-typed message from
 * being thrown away by a stray click: over an empty draft the two are the same
 * thing.
 *
 * The row is one line, always. The strip's line is shared with the session-stat
 * pills and the context meter, and a narrow composer leaves the tags less room
 * than all four phrases need; wrapping onto a second line pushes the card's own
 * controls around, and squeezing a tag into an ellipsis hides the very text a
 * click would send. Instead the row measures the room it is given and renders
 * the leading phrases that fit — a shorter row, never a second line.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/QuickReplies
 */

import type { ReactNode } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the 'conversation.composer.dock' SlotMap entry this plugin
// registers into, plus the session standard seats (useInput, inputActions) the
// renderer hands every session-scope entry.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { visibleQuickReplies } from '../quick-replies.ts'
import { NS, QUICK_REPLY_PHRASE_KEYS } from './locales.ts'
import type { SettingsRowFace } from './settings-controller.ts'
import css from './QuickReplies.module.css'

/** Full component props. */
export type QuickRepliesProps =
  PropsRuntime<'conversation.composer.dock'>
  & PropsLocale<typeof NS>
  & InjectFace<SettingsRowFace>

/**
 * The quick-reply row.
 *
 * Every phrase stays in the tree; the ones past the measured fit are hidden by
 * class instead of unmounted, so the next measurement can try them again when
 * the composer grows. `display: none` keeps a hidden tag out of the layout, out
 * of the tab order, and out of the accessibility tree — it is not a tag the
 * user can reach, which is the point.
 * @param props - composed slot props.
 * @returns the tags that fit, one per phrase.
 */
export function QuickReplies({ inputActions, useInput, useBeautify, t }: QuickRepliesProps): ReactNode {
  // A submission in flight has already locked the editor, so the tags close
  // with it instead of looking clickable and discarding the click.
  const phase = useInput(state => state.phase)
  const locked = phase === 'adjudicating' || phase === 'submitting'
  const state = useBeautify(snapshot => snapshot)
  const row = useRef<HTMLDivElement>(null)
  // Leading phrases the last measurement could fit; null until then, which
  // shows every phrase (the first measurement runs before the frame paints).
  const [fits, setFits] = useState<number | null>(null)
  const custom = visibleQuickReplies(state.quickReplies)
  // The built-in list replaces the row wholesale once the user writes phrases of
  // their own: customization means the row is what they typed, not their text
  // followed by the leftovers.
  const phrases = custom.length > 0 ? custom : QUICK_REPLY_PHRASE_KEYS.map(key => t(key))
  // One dependency for "the phrases changed": a different list is what has to
  // be priced again, and a length would miss an edit of the same width.
  const phraseKey = phrases.join('\u0000')

  useLayoutEffect(() => {
    const rowElement = row.current
    if (rowElement === null || typeof ResizeObserver !== 'function') return

    /**
     * How many leading tags the strip's line holds.
     *
     * The strip is a flex line that shrinks this row to make everything fit, so
     * the dock can look perfectly packed while the tags spill over the pills
     * beside them — the honest signal is the row's own content outgrowing the
     * box the line gave it. Take tags off the tail until it no longer does;
     * each removal hands room back, so the box is measured again every step.
     *
     * The exploration moves the same class the render does, so a tag hidden by
     * the last measurement can be shown again by this one — an inline
     * `display` could only ever hide, and the row would ratchet down to nothing.
     * @returns the fitting count, or null while there is nothing to measure.
     */
    const fit = (): number | null => {
      const tags = Array.from(rowElement.children) as HTMLElement[]
      const hidden = css.hidden
      const tag = css.tag
      // No rendered tag or no hiding rule means there is nothing to price.
      if (tags.length === 0 || hidden === undefined) return null
      /**
       * Put the row into exactly the state React renders for this count.
       *
       * Both classes, not just the hiding one: React renders a hidden tag with
       * `.hidden` *alone*, so a tag this exploration brings back would be
       * missing `.tag` — the class that keeps a pill at its own width. It would
       * then be squeezed into the box it is measured against, `spills` would
       * read that squeezed span as "fits", and the answer would depend on what
       * happened to be rendered instead of on the room there is: rendered-four
       * answers three, rendered-three answers four, and since every answer
       * resizes the row the observer fires again and the pair alternates
       * forever. Restoring the class makes the answer a function of the layout
       * alone, so measuring is idempotent.
       */
      const show = (count: number): void => {
        for (const [at, element] of tags.entries()) {
          const visible = at < count
          element.classList.toggle(hidden, !visible)
          if (tag !== undefined) element.classList.toggle(tag, visible)
        }
      }
      const spills = (count: number): boolean => {
        const first = tags[0]?.getBoundingClientRect()
        const last = tags[count - 1]?.getBoundingClientRect()
        if (first === undefined || last === undefined) return false
        // The extent, not `scrollWidth`: the row centers its content, so half
        // the overhang lands left of the box and never reaches its scroll area.
        // Half a pixel of rounding must not cost a tag.
        return last.right - first.left > rowElement.getBoundingClientRect().width + 0.5
      }
      let count = tags.length
      show(count)
      while (count > 0 && spills(count)) {
        count -= 1
        show(count)
      }
      return count
    }

    /**
     * Price the row and keep the DOM in step with the answer.
     *
     * The class the exploration left behind is the class React renders next, so
     * the frame between measuring and re-rendering is already correct.
     */
    const measure = (): void => {
      const next = fit()
      if (next === null) return
      setFits(current => (current === next ? current : next))
    }

    // The line changes for two reasons: a box the row sits in resizes (window,
    // sidebar, composer width), or a neighbour's own text does. The dock, its
    // other entries and the strip above them cover both — the strip's own box
    // is what a viewport change moves, because the row's box stops moving as
    // soon as it fits. A webfont swap changes the tags' widths without resizing
    // anything the row can watch, hence `loadingdone`; a window resize is
    // listened to directly because a wider composer need not move any box at
    // all while the row is trimmed.
    const observer = new ResizeObserver(() => { measure() })
    const observe = (): void => {
      observer.disconnect()
      observer.observe(rowElement)
      const dock = rowElement.parentElement
      if (dock === null) return
      observer.observe(dock)
      if (dock.parentElement !== null) observer.observe(dock.parentElement)
      for (const child of Array.from(dock.children)) {
        if (child !== rowElement) observer.observe(child)
      }
    }
    const mutations = typeof MutationObserver === 'function'
      ? new MutationObserver(() => { observe(); measure() })
      : null
    mutations?.observe(rowElement.parentElement ?? rowElement, {
      childList: true, characterData: true, subtree: true,
    })
    const fonts = typeof document === 'undefined' ? undefined : document.fonts
    fonts?.addEventListener('loadingdone', measure)
    window.addEventListener('resize', measure)
    observe()
    measure()
    return () => {
      observer.disconnect()
      mutations?.disconnect()
      fonts?.removeEventListener('loadingdone', measure)
      window.removeEventListener('resize', measure)
    }
  }, [phraseKey])

  // Keep the slot registered so changing the setting restores it immediately.
  if (!state.quickRepliesEnabled) return null
  const shown = fits === null ? phrases.length : Math.max(0, fits)

  /**
   * Send one phrase as this session's next message.
   * @param phrase - the message text the tag carries.
   */
  const send = (phrase: string): void => {
    // A refused insertion means the editor moved under the click or a
    // submission locked it; submitting anyway would send the previous draft.
    if (!inputActions.insertText(phrase, inputActions.captureInsertion())) return
    inputActions.submit()
  }

  return (
    <div className={css.row} ref={row} role="group" aria-label={t('quickTitle')}>
      {phrases.map((phrase, at) => (
        // A custom list may repeat a phrase, so the position is part of the key.
        // Tags past the fit stay mounted but hidden (see the effect).
        <Pill
          key={`${at}:${phrase}`}
          className={at < shown ? css.tag : css.hidden}
          disabled={locked}
          aria-label={t('quickSend', { text: phrase })}
          onClick={() => { send(phrase) }}
        >
          {phrase}
        </Pill>
      ))}
    </div>
  )
}
