/** Desktop visibility only; the phrase editor remains parked. */
import type { ReactNode } from 'react'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'
import type { SettingsRowFace } from './settings-controller.ts'
import css from './SettingRow.module.css'

export type QuickReplyToggleRowProps = PropsLocale<typeof NS> & InjectFace<SettingsRowFace>

export function QuickReplyToggleRow({ useBeautify, t, choose }: QuickReplyToggleRowProps): ReactNode {
  const state = useBeautify(snapshot => snapshot)
  const detail = !state.available ? t('unavailable')
    : !state.writable ? t('readonly')
      : !state.fields.quickRepliesEnabled ? t('stale') : ''

  return (
    <div className={`${css.row} ${css.desktopOnly}`}>
      <div className={css.rowText}>
        <div className={css.title}>{t('quickTitle')}</div>
        <div className={css.desc}>{t('quickReplyToggleDesc')}</div>
        <div className={css.meta}>{detail}</div>
      </div>
      <Switch
        checked={state.quickRepliesEnabled}
        label={t('quickTitle')}
        disabled={!state.available || !state.writable || !state.fields.quickRepliesEnabled}
        onChange={enabled => { choose('quickRepliesEnabled', enabled) }}
      />
    </div>
  )
}
