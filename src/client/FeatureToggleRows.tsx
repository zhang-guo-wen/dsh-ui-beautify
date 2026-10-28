/** Independent enhancement switches; every row reuses the host Switch. */
import type { ReactNode } from 'react'
import { Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'
import type { SettingsRowFace } from './settings-controller.ts'
import { rowToggle } from './row-toggle.ts'
import { SaveNote } from './SaveNote.tsx'
import css from './SettingRow.module.css'

type Props = PropsLocale<typeof NS> & InjectFace<SettingsRowFace>
type Feature =
  | 'mobileLayoutEnabled'
  | 'recentSessionsEnabled'
  | 'remoteSettingsEnabled'
  | 'scrollToPromptEnabled'
  | 'sessionStartChipEnabled'
  | 'unreadAnswerStartEnabled'
  | 'quickActionsEnabled'
  | 'streamlinedUiEnabled'
  | 'hideComposerStats'
  | 'hideModelSelector'
  | 'hideAccessMode'
  | 'contextRingEnabled'

function FeatureToggleRow({ useBeautify, t, choose, retry, field, title, description }: Props & {
  field: Feature
  title:
    | 'mobileLayoutTitle'
    | 'recentSessionsTitle'
    | 'remoteSettingsTitle'
    | 'scrollToPromptTitle'
    | 'sessionStartChipTitle'
    | 'unreadAnswerStartTitle'
    | 'quickActionsTitle'
    | 'streamlinedUiTitle'
    | 'hideComposerStatsTitle'
    | 'hideModelSelectorTitle'
    | 'hideAccessModeTitle'
    | 'contextRingTitle'
  description:
    | 'mobileLayoutDesc'
    | 'recentSessionsDesc'
    | 'remoteSettingsDesc'
    | 'scrollToPromptDesc'
    | 'sessionStartChipDesc'
    | 'unreadAnswerStartDesc'
    | 'quickActionsDesc'
    | 'streamlinedUiDesc'
    | 'hideComposerStatsDesc'
    | 'hideModelSelectorDesc'
    | 'hideAccessModeDesc'
    | 'contextRingDesc'
}): ReactNode {
  const state = useBeautify(snapshot => snapshot)
  const detail = !state.available ? t('unavailable')
    : !state.fields[field] ? t('stale') : !state.writable ? t('readonly') : ''
  const disabled = !state.available || !state.writable || !state.fields[field]
  return <div className={css.row} data-beautify-feature={field}
    onClick={rowToggle(disabled, () => { choose(field, !state[field]) })}>
    <div className={css.rowText}>
      <div className={css.title}>{t(title)}</div>
      <div className={css.desc}>{t(description)}</div>
      <div className={css.meta}>{detail}</div>
      <SaveNote state={state} field={field} t={t} retry={retry} />
    </div>
    <Switch checked={state[field]} label={t(title)}
      disabled={disabled}
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
export function SessionStartChipToggleRow(props: Props): ReactNode {
  return <FeatureToggleRow {...props} field="sessionStartChipEnabled" title="sessionStartChipTitle" description="sessionStartChipDesc" />
}
export function UnreadAnswerStartToggleRow(props: Props): ReactNode {
  return <FeatureToggleRow {...props} field="unreadAnswerStartEnabled" title="unreadAnswerStartTitle" description="unreadAnswerStartDesc" />
}
export function QuickActionsToggleRow(props: Props): ReactNode {
  return <FeatureToggleRow {...props} field="quickActionsEnabled" title="quickActionsTitle" description="quickActionsDesc" />
}
export function StreamlinedUiToggleRow(props: Props): ReactNode {
  return <FeatureToggleRow {...props} field="streamlinedUiEnabled" title="streamlinedUiTitle" description="streamlinedUiDesc" />
}
export function HideComposerStatsToggleRow(props: Props): ReactNode {
  return <FeatureToggleRow {...props} field="hideComposerStats" title="hideComposerStatsTitle" description="hideComposerStatsDesc" />
}
export function HideModelSelectorToggleRow(props: Props): ReactNode {
  return <FeatureToggleRow {...props} field="hideModelSelector" title="hideModelSelectorTitle" description="hideModelSelectorDesc" />
}
export function HideAccessModeToggleRow(props: Props): ReactNode {
  return <FeatureToggleRow {...props} field="hideAccessMode" title="hideAccessModeTitle" description="hideAccessModeDesc" />
}
export function ContextRingToggleRow(props: Props): ReactNode {
  return <FeatureToggleRow {...props} field="contextRingEnabled" title="contextRingTitle" description="contextRingDesc" />
}
