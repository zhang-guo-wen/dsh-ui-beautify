/** Default-on animation switch; keep stored always/off values without a new schema field. */
import type { ReactNode } from 'react'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsRowFace } from './settings-controller.ts'
import { NS } from './locales.ts'
import { rowToggle } from './row-toggle.ts'
import { SaveNote } from './SaveNote.tsx'
import css from './SettingRow.module.css'

export type MotionRowProps = PropsLocale<typeof NS> & InjectFace<SettingsRowFace>

export function MotionRow({ useBeautify, t, choose, retry }: MotionRowProps): ReactNode {
  const state = useBeautify(snapshot => snapshot)
  const detail = !state.available ? t('unavailable')
    : !state.fields.motion ? t('stale') : !state.writable ? t('readonly') : ''
  const disabled = !state.available || !state.writable || !state.fields.motion
  return <div className={css.row} data-beautify-motion=""
    onClick={rowToggle(disabled, () => { choose('motion', state.motion === 'always' ? 'off' : 'always') })}>
    <div className={css.rowText}>
      <div className={css.title}>{t('motionTitle')}</div>
      <div className={css.desc}>{t('motionDesc')}</div>
      <div className={css.meta}>{detail}</div>
      <SaveNote state={state} field="motion" t={t} retry={retry} />
    </div>
    <Switch checked={state.motion === 'always'} label={t('motionTitle')}
      disabled={disabled}
      onChange={enabled => { choose('motion', enabled ? 'always' : 'off') }} />
  </div>
}
