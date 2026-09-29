/** One settings page for every control owned by ui-beautify. */
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { BrandIconRow, BrandNameRow, LogoRow, TaglineRow } from './BrandRows.tsx'
import { CodeFontRow, FontRow } from './FontRows.tsx'
import { NS } from './locales.ts'
import { MotionRow } from './MotionRow.tsx'
import type { SettingsRowFace } from './settings-controller.ts'
import css from './BeautifySection.module.css'

export type BeautifySectionProps = PropsRuntime<'settings.section'> & PropsLocale<typeof NS> & InjectFace<SettingsRowFace>

export function BeautifySection(props: BeautifySectionProps): ReactNode {
  return (
    <div className={css.page}>
      <h2 className={css.heading}>{props.t('pageTitle')}</h2>
      <p className={css.intro}>{props.t('pageIntro')}</p>
      <h3 className={css.groupTitle}>{props.t('appearanceGroup')}</h3>
      <FontRow {...props} />
      <CodeFontRow {...props} />
      <MotionRow {...props} />
      <h3 className={css.groupTitle}>{props.t('brandingGroup')}</h3>
      <LogoRow {...props} />
      <BrandIconRow {...props} />
      <BrandNameRow {...props} />
      <TaglineRow {...props} />
    </div>
  )
}
