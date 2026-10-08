/** One settings page for every control owned by ui-beautify. */
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { BrandIconRow, BrandNameRow, LogoRow, TaglineRow } from './BrandRows.tsx'
import { CodeFontRow, FontRow } from './FontRows.tsx'
import { NS } from './locales.ts'
import { MobileLayoutToggleRow, RecentSessionsToggleRow, RemoteSettingsToggleRow, ScrollToPromptToggleRow } from './FeatureToggleRows.tsx'
import { MotionRow } from './MotionRow.tsx'
import { QuickReplyToggleRow } from './QuickReplyToggleRow.tsx'
import { DescriptionTranslationRow } from './DescriptionTranslationRow.tsx'
import type { DescriptionController } from './description-controller.ts'
import type { SettingsRowFace } from './settings-controller.ts'
import css from './BeautifySection.module.css'

export type BeautifySectionProps = PropsRuntime<'settings.section'> & PropsLocale<typeof NS> & InjectFace<SettingsRowFace> & { descriptions: DescriptionController }

// `QuickReplyRow` is parked: its component and its tests still live in this repo,
// but the page does not mount it while the row's presentation is undecided.
// Adding `<QuickReplyRow {...props} />` below the motion row is the whole change
// to bring it back — the copy, the styles, the `quickReplies` field, and the
// dock's read of it are all still in place.
export function BeautifySection(props: BeautifySectionProps): ReactNode {
  const mobileLayoutEnabled = props.useBeautify(snapshot => snapshot.mobileLayoutEnabled)
  return (
    <div className={css.page} data-beautify-mobile-layout={mobileLayoutEnabled ? '' : undefined}>
      <h2 className={css.heading}>{props.t('pageTitle')}</h2>
      <p className={css.intro}>{props.t('pageIntro')}</p>
      <h3 className={css.groupTitle}>{props.t('appearanceGroup')}</h3>
      <FontRow {...props} />
      <CodeFontRow {...props} />
      <MotionRow {...props} />
      <QuickReplyToggleRow {...props} />
      <h3 className={css.groupTitle}>{props.t('enhancementsGroup')}</h3>
      <ScrollToPromptToggleRow {...props} />
      <MobileLayoutToggleRow {...props} />
      <RecentSessionsToggleRow {...props} />
      <RemoteSettingsToggleRow {...props} />
      <DescriptionTranslationRow {...props} />
      <h3 className={css.groupTitle}>{props.t('brandingGroup')}</h3>
      <LogoRow {...props} />
      <BrandIconRow {...props} />
      <BrandNameRow {...props} />
      <TaglineRow {...props} />
    </div>
  )
}
