/**
 * The write state of one settings row, shown under its description.
 *
 * A row's control reflects the stored value, which only moves once the Host has
 * taken the write — so on a slow round trip the control sits at the old value
 * and looks as if the click missed. This note is the missing answer: the write is
 * in flight, it landed, or it did not and can be sent again.
 *
 * It renders nothing while the field is idle, so a row that has never been
 * written here keeps its one-line description.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/SaveNote
 */

import type { ReactNode } from 'react'
import type { BeautifySettings } from '../fonts.ts'
import type { SettingsKey } from './locales.ts'
import type { SettingsRowFace, SettingsRowState } from './settings-controller.ts'
import css from './SettingRow.module.css'

/** Props one row hands its note. */
export interface SaveNoteProps {
  /** The shared row snapshot, which carries every field's write state. */
  state: SettingsRowState
  /** The namespace field this row writes. */
  field: keyof BeautifySettings
  /** This row's translate seat. */
  t: (key: SettingsKey) => string
  /** The shared writer, used to send a failed value again. */
  retry?: SettingsRowFace['retry']
}

/**
 * Render the note for one field.
 * @param props - the snapshot, the field, the copy seat and the writer.
 * @returns the note, or nothing while the field is idle.
 */
export function SaveNote({ state, field, t, retry }: SaveNoteProps): ReactNode {
  const save = state.save?.[field]
  if (save === undefined) return null
  if (save === 'error') {
    return (
      <div className={css.saveNote} data-save="error" role="alert">
        {t('saveFailed')}
        <button className={css.saveRetry} type="button" onClick={() => { retry?.(field) }}>{t('retry')}</button>
      </div>
    )
  }
  return <div className={css.saveNote} data-save={save} role="status">{t(save === 'saving' ? 'saving' : 'saved')}</div>
}
