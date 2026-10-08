/** Independent, default-on enhancements; every row reuses the host Switch. */
import type { ReactNode } from 'react'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'
import type { SettingsRowFace } from './settings-controller.ts'
import css from './SettingRow.module.css'

type Props = PropsLocale<typeof NS> & InjectFace<SettingsRowFace>
type Feature = 'mobileLayoutEnabled' | 'recentSessionsEnabled' | 'remoteSettingsEnabled' | 'scrollToPromptEnabled'

function FeatureToggleRow({ useBeautify, t, choose, field, title, description }: Props & {
  field: Feature
  title: 'mobileLayoutTitle' | 'recentSessionsTitle' | 'remoteSettingsTitle' | 'scrollToPromptTitle'
  description: 'mobileLayoutDesc' | 'recentSessionsDesc' | 'remoteSettingsDesc' | 'scrollToPromptDesc'
}): ReactNode {
  const state = useBeautify(snapshot => snapshot)
  const detail = !state.available ? t('unavailable')
    : !state.fields[field] ? t('stale') : !state.writable ? t('readonly') : ''
  return <div className={css.row} data-beautify-feature={field}>
    <div className={css.rowText}>
      <div className={css.title}>{t(title)}</div>
      <div className={css.desc}>{t(description)}</div>
      <div className={css.meta}>{detail}</div>
    </div>
    <Switch checked={state[field]} label={t(title)}
      disabled={!state.available || !state.writable || !state.fields[field]}
      onChange={enabled => { choose(field, enabled) }} />
  </div>
}

export function MobileLayoutToggleRow(props: Props): ReactNode {
  return <FeatureToggleRow {...props} field="mobileLayoutEnabled" title="mobileLayoutTitle" description="mobileLayoutDesc" />
}
export function RecentSessionsToggleRow(props: Props): ReactNode {
  return <FeatureToggleRow {...props} field="recentSessionsEnabled" title="recentSessionsTitle" description="recentSessionsDesc" />
}
export function RemoteSettingsToggleRow(props: Props): ReactNode {
  return <FeatureToggleRow {...props} field="remoteSettingsEnabled" title="remoteSettingsTitle" description="remoteSettingsDesc" />
}
export function ScrollToPromptToggleRow(props: Props): ReactNode {
  return <FeatureToggleRow {...props} field="scrollToPromptEnabled" title="scrollToPromptTitle" description="scrollToPromptDesc" />
}
