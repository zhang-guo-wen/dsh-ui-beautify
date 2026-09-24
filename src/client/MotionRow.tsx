/**
 * General-settings row for the composer lane: whether the cyclist moves.
 *
 * It answers a question the lane itself cannot: the lane is decoration, and when
 * a browser asks for reduced motion the default leaves the strip empty — which
 * looks exactly like a plugin that failed to load. This row is where that
 * becomes legible, and where the answer is overridden.
 *
 * The status line is the point of the row. It names the state that produces
 * "nothing is there": the default is following a browser that asks for reduced
 * motion. Without it the honest default would be indistinguishable from a bug.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/MotionRow
 */

import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  IconChevronDownOutlineRegular, Menu, type MenuEntry,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { MOTION_CHOICE_IDS, prefersReducedMotion, type MotionChoice } from '../motion.ts'
import type { SettingsRowFace, SettingsRowState } from './settings-controller.ts'
import type { SettingsKey } from './locales.ts'
import { NS } from './locales.ts'
import css from './SettingRow.module.css'

/** Full component props. */
export type MotionRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<typeof NS>
  & InjectFace<SettingsRowFace>

/** The name and description each choice shows. */
const CHOICE_COPY: Readonly<Record<MotionChoice, { name: SettingsKey; desc: SettingsKey }>> = {
  system: { name: 'motionSystem', desc: 'motionSystemDesc' },
  always: { name: 'motionAlways', desc: 'motionAlwaysDesc' },
  off: { name: 'motionOff', desc: 'motionOffDesc' },
}

/**
 * The line under the description: why the lane is or is not on screen.
 * @param t - this row's translate seat.
 * @param state - the snapshot this row renders.
 * @returns the note that applies, or nothing when the lane is playing.
 */
function detailLine(t: MotionRowProps['t'], state: SettingsRowState): string {
  if (!state.available) return t('unavailable')
  if (!state.writable) return t('readonly')
  if (!state.fields.motion) return t('stale')
  if (state.motion === 'off') return t('motionOffNote')
  if (state.motion === 'system' && prefersReducedMotion()) return t('motionBlocked')
  return ''
}

/**
 * The lane's settings row.
 * @param props - composed slot props.
 * @returns the row.
 */
export function MotionRow(props: MotionRowProps): ReactNode {
  const { useBeautify, t, choose } = props
  const state = useBeautify(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  const selected = CHOICE_COPY[state.motion]
  const entries: MenuEntry[] = MOTION_CHOICE_IDS.map(id => ({
    id,
    label: t(CHOICE_COPY[id].name),
  }))

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('motionTitle')}</div>
        <div className={css.desc}>{t(selected.desc)}</div>
        <div className={css.meta}>{detailLine(t, state)}</div>
      </div>
      <Menu
        open={open}
        onClose={() => { setOpen(false) }}
        items={entries}
        selectedId={state.motion}
        onSelect={(id) => {
          setOpen(false)
          choose('motion', id)
        }}
        align="end"
        portal
        anchor={(
          <button
            type="button"
            className={css.selector}
            aria-haspopup="menu"
            aria-expanded={open}
            disabled={!state.available || !state.writable || !state.fields.motion}
            onClick={() => { setOpen(previous => !previous) }}
          >
            {t(selected.name)}
            <IconChevronDownOutlineRegular className={css.chevron} />
          </button>
        )}
      />
    </div>
  )
}
