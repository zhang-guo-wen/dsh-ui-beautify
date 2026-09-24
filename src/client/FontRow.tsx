/**
 * General-settings row: the body-font picker.
 *
 * It occupies the additive seat ui-settings-general declares for a single
 * preference that needs no page of its own, which is why it draws its own
 * label: that column only stacks rows. The layout and the pill selector match
 * the preference rows shipped beside it, so it reads as one of them rather than
 * as a foreign control.
 *
 * The face and its download are one choice, so there is one control. The menu
 * names every face and says which are already cached; the line under the
 * description reports what the chosen one holds, and how to refresh that
 * reading, which is taken when this row renders rather than streamed.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/FontRow
 */

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import {
  IconChevronDownOutlineRegular, Menu, type MenuEntry,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { FONT_FACES, SYSTEM_FONT_ID, type FontCacheUsage } from '../fonts.ts'
import type { FontRowFace, FontRowState } from './settings-controller.ts'
import type { FontRowKey } from './locales.ts'
import { NS } from './locales.ts'
import css from './FontRow.module.css'

/** Full component props. */
export type FontRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<typeof NS>
  & InjectFace<FontRowFace>

/**
 * Copy keys per choice id. The registry in `fonts.ts` owns the ids and families;
 * the wording lives in the locale dictionary, so this table is the one place
 * the two meet.
 */
const CHOICE_COPY: Readonly<Record<string, { name: FontRowKey; desc: FontRowKey }>> = {
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
 * The picker's groups, in presentation order.
 *
 * The system default opens on its own because it is the baseline the rest
 * depart from; the catalogue then splits into the two writing systems a face
 * can cover.
 */
const GROUPS: readonly { label: FontRowKey; ids: readonly string[] }[] = [
  { label: 'groupSystem', ids: [SYSTEM_FONT_ID] },
  { label: 'groupCjk', ids: FONT_FACES.filter(face => face.group === 'cjk').map(face => face.id) },
  { label: 'groupLatin', ids: FONT_FACES.filter(face => face.group === 'latin').map(face => face.id) },
]

/** This row's translate seat. */
type Translate = FontRowProps['t']

/** The unit a byte count is shown in, named by its dictionary key. */
function byteSize(bytes: number): { value: string; unit: FontRowKey } {
  if (bytes >= 1024 ** 3) return { value: (bytes / 1024 ** 3).toFixed(1), unit: 'unitGb' }
  if (bytes >= 1024 ** 2) return { value: (bytes / 1024 ** 2).toFixed(1), unit: 'unitMb' }
  return { value: String(Math.max(1, Math.round(bytes / 1024))), unit: 'unitKb' }
}

/** A byte count as `4.3 MB`, built from the dictionary's own units. */
function readableSize(t: Translate, bytes: number): string {
  const size = byteSize(bytes)
  return `${size.value} ${t(size.unit)}`
}

/**
 * What one face holds in the cache, as one short phrase for a menu row.
 *
 * A face no stylesheet has been cached for has downloaded nothing at all: the
 * stylesheet is what names the shards, so its absence is the honest answer
 * rather than a zero byte count.
 * @param t - this row's translate seat.
 * @param usage - what the Host reported for this face, if anything.
 * @returns the phrase, e.g. `Cached 4.3 MB` or `Not downloaded`.
 */
function cachePhrase(t: Translate, usage: FontCacheUsage | undefined): string {
  if (usage === undefined || usage.shardsTotal === 0) return t('cacheAbsent')
  return t('cacheCached', { size: readableSize(t, usage.bytes) })
}

/**
 * The line under the description for the chosen face: what it holds, how much
 * of it, and how to refresh a reading that was taken when this row rendered.
 * @param t - this row's translate seat.
 * @param usage - what the Host reported for the chosen face, if anything.
 * @returns the line's text.
 */
function cacheDetail(t: Translate, usage: FontCacheUsage | undefined): string {
  if (usage === undefined || usage.shardsTotal === 0) return `${t('cacheAbsent')} · ${t('cacheHint')}`
  const reading = t('cachePresent', {
    size: readableSize(t, usage.bytes),
    cached: usage.shardsCached,
    total: usage.shardsTotal,
  })
  return `${reading} · ${t('cacheHint')}`
}

/**
 * The line under the description.
 * @param t - this row's translate seat.
 * @param state - the snapshot this row renders.
 * @returns the note that applies, the chosen face's reading, or nothing for the
 * system default, which downloads no face to report on.
 */
function detailLine(t: Translate, state: FontRowState): string {
  if (!state.available) return t('unavailable')
  if (!state.writable) return t('readonly')
  if (state.font === SYSTEM_FONT_ID) return ''
  return cacheDetail(t, state.cache[state.font])
}

/**
 * Build the menu: every choice, grouped, each downloadable face labelled with
 * what is already on disk.
 * @param t - this row's translate seat.
 * @param state - the snapshot this row renders.
 * @returns the menu entries.
 */
function menuEntries(t: Translate, state: FontRowState): MenuEntry[] {
  const entries: MenuEntry[] = []
  for (const { label, ids } of GROUPS) {
    entries.push({ type: 'label', id: `group-${label}`, text: t(label) })
    for (const id of ids) {
      const copy = CHOICE_COPY[id]
      if (copy === undefined) continue
      const name = t(copy.name)
      // The system default downloads nothing, so it carries no cache phrase.
      entries.push({
        id,
        label: id === SYSTEM_FONT_ID ? name : `${name} · ${cachePhrase(t, state.cache[id])}`,
      })
    }
  }
  return entries
}

/** The settings row body. */
export function FontRow(props: FontRowProps): ReactNode {
  const { useFontSettings, t, choose, refreshCache } = props
  const state = useFontSettings(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  const selected = CHOICE_COPY[state.font]

  // The reading is taken when the row renders: the numbers only move while a
  // download is running, and a choice made here schedules its own re-read.
  useEffect(() => { refreshCache() }, [refreshCache])

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('title')}</div>
        <div className={css.desc}>{selected === undefined ? '' : t(selected.desc)}</div>
        <div className={css.meta}>{detailLine(t, state)}</div>
      </div>
      <Menu
        open={open}
        onClose={() => { setOpen(false) }}
        items={menuEntries(t, state)}
        selectedId={state.font}
        onSelect={(id) => {
          setOpen(false)
          choose(id)
        }}
        align="end"
        portal
        anchor={(
          <button
            type="button"
            className={css.selector}
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={!state.available || !state.writable}
            onClick={() => { setOpen(previous => !previous) }}
          >
            {selected === undefined ? t('title') : t(selected.name)}
            <IconChevronDownOutlineRegular className={css.chevron} />
          </button>
        )}
      />
    </div>
  )
}
