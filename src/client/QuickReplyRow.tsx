/**
 * Settings row for the quick replies: the four phrases the composer dock offers.
 *
 * **Parked.** The page no longer mounts this row while its presentation is
 * undecided, so nothing here reaches the browser bundle; the row is kept whole so
 * that re-adding `<QuickReplyRow {...props} />` to `BeautifySection` is the whole
 * change, and `tests/client.mjs` re-runs its block for this component the moment
 * the page renders it again. It is still type-checked, and the `quickReplies`
 * field, this row's copy, its styles, and the dock's read of the stored value all
 * stay in place meanwhile.
 *
 * The row is the only place the phrases are authored, and it shows them the way
 * the dock does — one capsule per slot. A slot holding a phrase is a solid tag;
 * a slot holding nothing stays a grey tag carrying the built-in phrase, which is
 * both the hint for what this slot could say and the text clicking it opens. So
 * the row never has to explain what an empty field means: the tag itself is
 * either on (solid) or off (grey), and the dock shows exactly the solid ones.
 *
 * Clicking a tag turns it into a capsule field in place, seeded with the phrase
 * (a grey tag is switched on by that same click, so pressing Enter saves the
 * built-in phrase as typed). Enter or losing focus saves, Escape writes back
 * what the slot held before the click, and saving an empty field switches the
 * slot off again. The value lives in the store, not in the row: only the slot
 * being edited is local state.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/QuickReplyRow
 */

import type { ReactNode } from 'react'
import { useRef, useState } from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { MAX_QUICK_REPLIES, MAX_QUICK_REPLY_LENGTH, quickReplySlots } from '../quick-replies.ts'
import { NS, QUICK_REPLY_PHRASE_KEYS } from './locales.ts'
import type { SettingsRowFace, SettingsRowState } from './settings-controller.ts'
import css from './SettingRow.module.css'

/** Full component props. */
export type QuickReplyRowProps =
  PropsLocale<typeof NS>
  & InjectFace<SettingsRowFace>

/** The slot currently opened for editing, and what it held before the click. */
interface Editing {
  /** Which slot the field replaced. */
  at: number
  /** Text the slot had when the click landed; Escape writes it back. */
  restore: string
}

/**
 * The line under the description: whether this row can be written at all.
 * @param t - this row's translate seat.
 * @param state - the snapshot this row renders.
 * @returns the note that applies, or nothing when the row is editable.
 */
function detailLine(t: QuickReplyRowProps['t'], state: SettingsRowState): string {
  if (!state.available) return t('unavailable')
  if (!state.writable) return t('readonly')
  if (!state.fields.quickReplies) return t('stale')
  return ''
}

/**
 * The quick-reply settings row.
 * @param props - composed slot props.
 * @returns the row: one tag per slot, plus a reset once anything is stored.
 */
export function QuickReplyRow(props: QuickReplyRowProps): ReactNode {
  const { useBeautify, t, choose } = props
  const state = useBeautify(snapshot => snapshot)
  const [editing, setEditing] = useState<Editing | null>(null)
  // Escape unmounts the field, and a browser may deliver that unmount's blur
  // afterwards; without this the cancelled text would be committed on the way
  // out. It is a ref rather than state because only the blur handler reads it.
  const cancelled = useRef(false)
  const disabled = !state.available || !state.writable || !state.fields.quickReplies
  // The built-in phrases are the slot list: one tag each, capped at the shared
  // maximum so a longer dictionary could never offer more slots than the dock
  // has. A slot the store says nothing about is off, and its tag falls back to
  // the dictionary phrase.
  const slots = QUICK_REPLY_PHRASE_KEYS.slice(0, MAX_QUICK_REPLIES)
    .map((key, at) => ({ at, key, phrase: state.quickReplies[at] ?? '' }))
  const customized = slots.some(slot => slot.phrase !== '')

  /**
   * Store one slot's text, leaving the other slots alone.
   * @param at - the slot's position.
   * @param text - what the slot should hold; empty switches it off.
   */
  const write = (at: number, text: string): void => {
    choose('quickReplies', quickReplySlots(slots.map(slot => slot.at === at ? text : slot.phrase)))
  }

  /**
   * Open one slot for editing.
   * @param at - the slot's position.
   * @param fallback - the built-in phrase this slot falls back to.
   */
  const edit = (at: number, fallback: string): void => {
    // A previous Escape may have left the guard set: browsers do not reliably
    // deliver a blur for the field that cancelling removed. Every edit starts
    // clean, or that stale guard would swallow this edit's first blur.
    cancelled.current = false
    const restore = slots[at]?.phrase ?? ''
    // A grey tag is off; clicking it is what switches the built-in phrase on, so
    // the field opens over a slot that already holds text.
    if (restore === '') write(at, fallback)
    setEditing({ at, restore })
  }

  /**
   * Save the field and close it.
   * @param at - the slot's position.
   * @param raw - what the field held when it was committed.
   */
  const save = (at: number, raw: string): void => {
    write(at, raw.trim())
    setEditing(null)
  }

  /** Close the field without keeping what was typed. */
  const cancel = (): void => {
    if (editing !== null) write(editing.at, editing.restore)
    setEditing(null)
  }

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('quickReplyTitle')}</div>
        <div className={css.desc}>{t('quickReplyDesc')}</div>
        <div className={css.meta}>{detailLine(t, state)}</div>
      </div>
      <div className={css.replyControl}>
        {slots.map(({ at, key, phrase }) => {
          const fallback = t(key)
          const shown = phrase === '' ? fallback : phrase
          if (editing?.at === at) {
            return (
              // Keyed by slot alone: switching the slot on re-renders this row
              // from the store, and a key carrying the value would remount the
              // field and drop the focus the click just gave it.
              <input
                key={`edit:${at}`}
                className={css.replyInput}
                type="text"
                aria-label={t('quickReplyInput')}
                placeholder={fallback}
                defaultValue={shown}
                maxLength={MAX_QUICK_REPLY_LENGTH}
                autoFocus
                disabled={disabled}
                onBlur={event => {
                  if (cancelled.current) { cancelled.current = false; return }
                  save(at, event.currentTarget.value)
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') { cancelled.current = true; cancel() }
                }}
              />
            )
          }
          return (
            <button
              key={`tag:${at}:${phrase}`}
              className={phrase === '' ? `${css.replyTag} ${css.replyTagGhost}` : css.replyTag}
              type="button"
              aria-label={t('quickReplyTag', { text: shown })}
              disabled={disabled}
              onClick={() => { edit(at, fallback) }}
            >
              {shown}
            </button>
          )
        })}
        {customized && (
          <button
            className={css.reset}
            type="button"
            disabled={disabled}
            onClick={() => { choose('quickReplies', []) }}
          >
            {t('restoreDefault')}
          </button>
        )}
      </div>
    </div>
  )
}
