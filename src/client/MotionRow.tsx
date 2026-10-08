/** Default-on animation switch; keep stored always/off values without a new schema field. */
import type { ReactNode } from 'react'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsRowFace } from './settings-controller.ts'
import { NS } from './locales.ts'
import css from './SettingRow.module.css'

export type MotionRowProps = PropsLocale<typeof NS> & InjectFace<SettingsRowFace>

export function MotionRow({ useBeautify, t, choose }: MotionRowProps): ReactNode {
  const state = useBeautify(snapshot => snapshot)
  const detail = !state.available ? t('unavailable')
    : !state.fields.motion ? t('stale') : !state.writable ? t('readonly') : ''
  return <div className={css.row} data-beautify-motion="">
    <div className={css.rowText}>
      <div className={css.title}>{t('motionTitle')}</div>
      <div className={css.desc}>{t('motionDesc')}</div>
      <div className={css.meta}>{detail}</div>
    </div>
    <Switch checked={state.motion === 'always'} label={t('motionTitle')}
      disabled={!state.available || !state.writable || !state.fields.motion}
      onChange={enabled => { choose('motion', enabled ? 'always' : 'off') }} />
  </div>
}
