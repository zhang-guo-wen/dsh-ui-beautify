/**
 * General-settings rows: the body-font picker and the code-font picker.
 *
 * Both occupy the additive seat ui-settings-general declares for a single
 * preference that needs no page of its own, which is why each draws its own
 * label: that column only stacks rows. The layout and the pill selector match
 * the preference rows shipped beside them, so they read as part of that page
 * rather than as foreign controls.
 *
 * The two rows are the same control over different catalogues, so they share one
 * implementation and differ only by the role handed to it: which setting they
 * write, which faces they offer, and which copy names them.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/FontRows
 */

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import {
  IconChevronDownOutlineRegular, Menu, type MenuEntry,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  FONT_ROLES, SYSTEM_FONT_ID, type FontCacheUsage, type FontRole,
} from '../fonts.ts'
import type { FontRowFace, FontRowState } from './settings-controller.ts'
import type { FontRowKey } from './locales.ts'
import { NS } from './locales.ts'
import css from './FontRows.module.css'

/** Full component props, shared by both rows. */
export type FontRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<typeof NS>
  & InjectFace<FontRowFace>

/** The code row takes the same props; the name exists so both reads alike. */
export type CodeFontRowProps = FontRowProps

/**
 * Copy keys per choice id. The catalogue owns the ids and families; the wording
 * lives in the locale dictionary, so this table is the one place the two meet.
 * Ids are unique across roles, so one table serves both rows.
 */
const CHOICE_COPY: Readonly<Record<string, { name: FontRowKey; desc: FontRowKey }>> = {
  'noto-sans-sc': { name: 'fontNotoSansSc', desc: 'fontNotoSansScDesc' },
  'noto-serif-sc': { name: 'fontNotoSerifSc', desc: 'fontNotoSerifScDesc' },
  'lxgw-wenkai': { name: 'fontLxgwWenkai', desc: 'fontLxgwWenkaiDesc' },
  'lxgw-wenkai-tc': { name: 'fontLxgwWenkaiTc', desc: 'fontLxgwWenkaiTcDesc' },
  'lxgw-wenkai-screen': { name: 'fontLxgwWenkaiScreen', desc: 'fontLxgwWenkaiScreenDesc' },
  'zcool-xiaowei': { name: 'fontZcoolXiaowei', desc: 'fontZcoolXiaoweiDesc' },
  'zcool-kuaile': { name: 'fontZcoolKuaile', desc: 'fontZcoolKuaileDesc' },
  'zcool-qingke-huangyou': { name: 'fontZcoolQingkeHuangyou', desc: 'fontZcoolQingkeHuangyouDesc' },
  'ma-shan-zheng': { name: 'fontMaShanZheng', desc: 'fontMaShanZhengDesc' },
  'zhi-mang-xing': { name: 'fontZhiMangXing', desc: 'fontZhiMangXingDesc' },
  'long-cang': { name: 'fontLongCang', desc: 'fontLongCangDesc' },
  'liu-jian-mao-cao': { name: 'fontLiuJianMaoCao', desc: 'fontLiuJianMaoCaoDesc' },
  inter: { name: 'fontInter', desc: 'fontInterDesc' },
  geist: { name: 'fontGeist', desc: 'fontGeistDesc' },
  'jetbrains-mono': { name: 'codeFontJetbrainsMono', desc: 'codeFontJetbrainsMonoDesc' },
  'fira-code': { name: 'codeFontFiraCode', desc: 'codeFontFiraCodeDesc' },
  'geist-mono': { name: 'codeFontGeistMono', desc: 'codeFontGeistMonoDesc' },
  'noto-sans-mono': { name: 'codeFontNotoSansMono', desc: 'codeFontNotoSansMonoDesc' },
  'maple-mono-cn': { name: 'codeFontMapleMonoCn', desc: 'codeFontMapleMonoCnDesc' },
}

/**
 * Copy for the one choice that is not a catalogue row. The same id means
 * different things to the two roles — "leave the interface font alone" against
 * "leave the built-in code stack alone" — so it cannot live in the table above.
 */
const SYSTEM_COPY: Readonly<Record<FontRole, { name: FontRowKey; desc: FontRowKey }>> = {
  body: { name: 'fontSystem', desc: 'fontSystemDesc' },
  code: { name: 'codeFontSystem', desc: 'codeFontSystemDesc' },
}

/** The row title each role shows. */
const ROW_TITLE: Readonly<Record<FontRole, FontRowKey>> = { body: 'title', code: 'codeTitle' }

/** This row's translate seat. */
type Translate = FontRowProps['t']

/** The copy for one choice, from the catalogue table or the system seat. */
function copyFor(role: FontRole, id: string): { name: FontRowKey; desc: FontRowKey } | undefined {
  return id === SYSTEM_FONT_ID ? SYSTEM_COPY[role] : CHOICE_COPY[id]
}

/**
 * A role's choices, grouped for presentation.
 *
 * The system default opens on its own because it is the baseline the rest
 * depart from; the catalogue then splits into the two writing systems a face
 * can cover.
 */
function groupsFor(role: FontRole): readonly { label: FontRowKey; ids: readonly string[] }[] {
  const faces = FONT_ROLES[role].faces
  return [
    { label: 'groupSystem', ids: [SYSTEM_FONT_ID] },
    { label: 'groupCjk', ids: faces.filter(face => face.group === 'cjk').map(face => face.id) },
    { label: 'groupLatin', ids: faces.filter(face => face.group === 'latin').map(face => face.id) },
  ]
}

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
 * @param role - the role this row edits.
 * @param state - the snapshot this row renders.
 * @returns the note that applies, the chosen face's reading, or nothing for the
 * system default, which downloads no face to report on.
 */
function detailLine(t: Translate, role: FontRole, state: FontRowState): string {
  if (!state.available) return t('unavailable')
  if (!state.writable) return t('readonly')
  if (!state.fields[role]) return t('stale')
  const choice = state[FONT_ROLES[role].key]
  if (choice === SYSTEM_FONT_ID) return ''
  return cacheDetail(t, state.cache[choice])
}

/**
 * Build the menu: every choice, grouped, each downloadable face labelled with
 * what is already on disk.
 * @param t - this row's translate seat.
 * @param role - the role this row edits.
 * @param state - the snapshot this row renders.
 * @returns the menu entries.
 */
function menuEntries(t: Translate, role: FontRole, state: FontRowState): MenuEntry[] {
  const entries: MenuEntry[] = []
  for (const { label, ids } of groupsFor(role)) {
    entries.push({ type: 'label', id: `group-${role}-${label}`, text: t(label) })
    for (const id of ids) {
      const copy = copyFor(role, id)
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

/**
 * One preference row.
 * @param props - the composed slot props plus the role this row edits.
 * @returns the row body.
 */
function FontPicker({ role, ...props }: FontRowProps & { role: FontRole }): ReactNode {
  const { useFontSettings, t, choose, refreshCache } = props
  const state = useFontSettings(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  const choice = state[FONT_ROLES[role].key]
  const selected = copyFor(role, choice)

  // The reading is taken when the row renders: the numbers only move while a
  // download is running, and a choice made here schedules its own re-read.
  useEffect(() => { refreshCache() }, [refreshCache])

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t(ROW_TITLE[role])}</div>
        <div className={css.desc}>{selected === undefined ? '' : t(selected.desc)}</div>
        <div className={css.meta}>{detailLine(t, role, state)}</div>
      </div>
      <Menu
        open={open}
        onClose={() => { setOpen(false) }}
        items={menuEntries(t, role, state)}
        selectedId={choice}
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
            disabled={!state.available || !state.writable || !state.fields[role]}
            onClick={() => { setOpen(previous => !previous) }}
          >
            {selected === undefined ? t(ROW_TITLE[role]) : t(selected.name)}
            <IconChevronDownOutlineRegular className={css.chevron} />
          </button>
        )}
      />
    </div>
  )
}

/**
 * The body-font row.
 * @param props - composed slot props.
 * @returns the row.
 */
export function FontRow(props: FontRowProps): ReactNode {
  return <FontPicker role="body" {...props} />
}

/**
 * The code-font row.
 * @param props - composed slot props.
 * @returns the row.
 */
export function CodeFontRow(props: CodeFontRowProps): ReactNode {
  return <FontPicker role="code" {...props} />
}
