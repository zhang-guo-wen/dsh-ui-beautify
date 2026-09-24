/**
 * Page beautification settings section: the body-font picker.
 *
 * The Host downloads every face on demand, so this page is the whole
 * installation surface — there is nothing to install and nothing to restart.
 * A choice lands in the `ui-beautify` namespace and the plugin body applies it
 * to the document, so this component never touches the DOM or a stylesheet.
 *
 * The blocks below are derived from the catalogue rather than written out, so a
 * new face appears here as soon as it has copy in the locale dictionary.
 *
 * Cards stack a name over a description, which the ui-primitives catalog names
 * as the reason a card lives in its feature package rather than being a shared
 * control.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/FontSection
 */

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { FONT_FACES, SYSTEM_FONT_ID, type FontCacheUsage } from '../fonts.ts'
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
 * only one that downloads no face.
 */
const CHOICE_COPY: Readonly<Record<string, { name: FontSectionKey; desc: FontSectionKey }>> = {
  system: { name: 'fontSystem', desc: 'fontSystemDesc' },
  'noto-sans-sc': { name: 'fontNotoSansSc', desc: 'fontNotoSansScDesc' },
  'noto-serif-sc': { name: 'fontNotoSerifSc', desc: 'fontNotoSerifScDesc' },
  'lxgw-wenkai': { name: 'fontLxgwWenkai', desc: 'fontLxgwWenkaiDesc' },
  'lxgw-wenkai-tc': { name: 'fontLxgwWenkaiTc', desc: 'fontLxgwWenkaiTcDesc' },
  'zcool-xiaowei': { name: 'fontZcoolXiaowei', desc: 'fontZcoolXiaoweiDesc' },
  'zcool-kuaile': { name: 'fontZcoolKuaile', desc: 'fontZcoolKuaileDesc' },
  'ma-shan-zheng': { name: 'fontMaShanZheng', desc: 'fontMaShanZhengDesc' },
  'zhi-mang-xing': { name: 'fontZhiMangXing', desc: 'fontZhiMangXingDesc' },
  inter: { name: 'fontInter', desc: 'fontInterDesc' },
  geist: { name: 'fontGeist', desc: 'fontGeistDesc' },
}

/**
 * The picker's blocks, in presentation order.
 *
 * The system default opens on its own because it is the baseline the rest
 * depart from; the catalogue then splits into the two writing systems a face
 * can cover.
 */
const BLOCKS: readonly { label: FontSectionKey; ids: readonly string[] }[] = [
  { label: 'groupSystem', ids: [SYSTEM_FONT_ID] },
  { label: 'groupCjk', ids: FONT_FACES.filter(face => face.group === 'cjk').map(face => face.id) },
  { label: 'groupLatin', ids: FONT_FACES.filter(face => face.group === 'latin').map(face => face.id) },
]

/** The unit a byte count is shown in, named by its dictionary key. */
function byteSize(bytes: number): { value: string; unit: FontSectionKey } {
  if (bytes >= 1024 ** 3) return { value: (bytes / 1024 ** 3).toFixed(1), unit: 'unitGb' }
  if (bytes >= 1024 ** 2) return { value: (bytes / 1024 ** 2).toFixed(1), unit: 'unitMb' }
  return { value: String(Math.max(1, Math.round(bytes / 1024))), unit: 'unitKb' }
}

/**
 * The cache line under one card.
 *
 * A face no stylesheet has been cached for has downloaded nothing at all: the
 * stylesheet is what names the shards, so its absence is the honest answer
 * rather than a zero byte count.
 * @param t - this section's translate seat.
 * @param usage - what the Host reported for this face, if anything.
 * @returns the line's text.
 */
function cacheLabel(t: FontSectionProps['t'], usage: FontCacheUsage | undefined): string {
  if (usage === undefined || usage.shardsTotal === 0) return t('cacheAbsent')
  const size = byteSize(usage.bytes)
  return t('cachePresent', {
    size: `${size.value} ${t(size.unit)}`,
    cached: usage.shardsCached,
    total: usage.shardsTotal,
  })
}

/** The settings section body. */
export function FontSection(props: FontSectionProps): ReactNode {
  const { useFontSettings, t, choose, refreshCache } = props
  const state = useFontSettings(snapshot => snapshot)
  const disabled = !state.available || !state.writable

  // The reading is taken when the page opens: the numbers only move while a
  // download is running, and this is the moment they are worth asking for.
  useEffect(() => { refreshCache() }, [refreshCache])

  return (
    <div className={css.section}>
      <div className={css.panel}>
        <p className={css.intro}>{t('intro')}</p>
        {BLOCKS.map(({ label, ids }) => (
          <div key={label} className={css.group}>
            <span className={css.groupLabel}>{t(label)}</span>
            {/* Buttons with `aria-pressed` rather than a radiogroup: the group
                then needs no roving tabindex or arrow-key handling to stay
                operable. */}
            <div className={css.cards}>
              {ids.map((id) => {
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
                    {/* The system default downloads nothing, so it has no cache
                        line to show. */}
                    {id === SYSTEM_FONT_ID
                      ? null
                      : <span className={css.cardMeta}>{cacheLabel(t, state.cache[id])}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {!state.available ? <p className={css.note}>{t('unavailable')}</p> : null}
        {state.available && !state.writable ? <p className={css.note}>{t('readonly')}</p> : null}
      </div>
    </div>
  )
}
