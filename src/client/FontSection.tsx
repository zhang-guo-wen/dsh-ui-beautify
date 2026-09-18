/**
 * Page beautification settings section: the body-font picker.
 *
 * The Host ships every face with the plugin, so this page is the whole
 * installation surface — there is nothing to install and nothing to restart.
 * A choice lands in the `ui-beautify` namespace and the plugin body applies it
 * to the document, so this component never touches the DOM or a stylesheet.
 *
 * Cards stack a name over a description, which the ui-primitives catalog names
 * as the reason a card lives in its feature package rather than being a shared
 * control.
 *
 * @module @zhang-guo-wen/dsh-ui-beautify/client/FontSection
 */

import type { ReactNode } from 'react'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { FONT_CHOICES } from '../fonts.ts'
import type { FontSectionFace } from './settings-controller.ts'
import type { FontSectionKey } from './locales.ts'
import { NS } from './locales.ts'
import css from './FontSection.module.css'

/** Full component props. */
export type FontSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<typeof NS>
  & InjectFace<FontSectionFace>

/**
 * Copy keys per choice id. The registry in `fonts.ts` owns the ids and families;
 * the wording lives in the locale dictionary, so this table is the one place
 * the two meet. The system default is a choice like any other here — it is the
 * only one that applies no bundled face.
 */
const CHOICE_COPY: Readonly<Record<string, { name: FontSectionKey; desc: FontSectionKey }>> = {
  system: { name: 'fontSystem', desc: 'fontSystemDesc' },
  'noto-sans-sc': { name: 'fontNotoSansSc', desc: 'fontNotoSansScDesc' },
  'lxgw-wenkai': { name: 'fontLxgwWenkai', desc: 'fontLxgwWenkaiDesc' },
}

/** The settings section body. */
export function FontSection(props: FontSectionProps): ReactNode {
  const { useFontSettings, t, choose } = props
  const state = useFontSettings(snapshot => snapshot)
  const disabled = !state.available || !state.writable

  return (
    <div className={css.section}>
      <div className={css.panel}>
        <p className={css.intro}>{t('intro')}</p>
        <span className={css.groupLabel}>{t('fontSection')}</span>
        {/* Buttons with `aria-pressed` rather than a radiogroup: the group then
            needs no roving tabindex or arrow-key handling to stay operable. */}
        <div className={css.cards}>
          {FONT_CHOICES.map((id) => {
            const copy = CHOICE_COPY[id]
            if (copy === undefined) return null
            const active = id === state.font
            return (
              <button
                key={id}
                type="button"
                className={css.card}
                data-active={active}
                aria-pressed={active}
                disabled={disabled}
                onClick={() => { choose(id) }}
              >
                <span className={css.cardHead}>
                  <span className={css.cardName}>{t(copy.name)}</span>
                  {active ? <Tag tone="success">{t('active')}</Tag> : null}
                </span>
                <span className={css.cardDesc}>{t(copy.desc)}</span>
              </button>
            )
          })}
        </div>
        {!state.available ? <p className={css.note}>{t('unavailable')}</p> : null}
        {state.available && !state.writable ? <p className={css.note}>{t('readonly')}</p> : null}
      </div>
    </div>
  )
}
