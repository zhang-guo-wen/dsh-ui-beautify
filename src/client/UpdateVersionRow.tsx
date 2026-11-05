/**
 * The published release under the installed version, and the upgrade action.
 *
 * It occupies the additive seat the General section declares for one preference
 * row, right after the shell's own version row: the number it shows is the same
 * release the desktop shell would install, and its button opens the shell's
 * existing update flow rather than starting a download of its own.
 *
 * The reading is a sample, not a subscription: the Host answers when asked, the
 * row asks when it mounts, and the answer is what the line under the version
 * says until the page is opened again.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/UpdateVersionRow
 */

import { useEffect, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { UpdateRowFace, UpdateRowState } from './update-check.ts'
import { NS } from './locales.ts'
import css from './UpdateVersionRow.module.css'

/** Full component props. */
export type UpdateVersionRowProps = PropsLocale<typeof NS> & InjectFace<UpdateRowFace>

/**
 * `aria-live` status for the line under the version.
 * @param state - the current reading.
 * @param t - the locale seat.
 * @returns the line's copy.
 */
function detailOf(state: UpdateRowState, t: UpdateVersionRowProps['t']): string {
  if (state.phase === 'failed') return t('updateFailed')
  if (state.phase !== 'ready') return t('updateChecking')
  if (state.hasUpdate && state.latest !== null) return t('updateLatest', { version: state.latest })
  return t('updateCurrent')
}

/**
 * Render the published release and its upgrade button.
 * @param props - runtime translation seat plus the injected reading and actions.
 * @returns the row, or nothing when this Host has no release feed at all.
 */
export function UpdateVersionRow({
  useUpdate, checkUpdate, openUpgrade, canUpgrade, t,
}: UpdateVersionRowProps): ReactNode {
  const state = useUpdate(snapshot => snapshot)
  // One reading per mount, past the Host cache so a settings visit is not
  // answered by an hour-old reading.
  useEffect(() => { checkUpdate() }, [checkUpdate])
  if (state.phase === 'unavailable') return null
  const upgradeable = state.phase === 'ready' && state.hasUpdate && canUpgrade
  return <div className={css.row} data-ui-beautify-update="" data-update-phase={state.phase}
    data-update-available={state.hasUpdate ? 'true' : 'false'}>
    <div className={css.detail} role="status">{detailOf(state, t)}</div>
    <Button
      type="button"
      size="sm"
      variant={upgradeable ? 'primary' : 'outline'}
      disabled={!upgradeable}
      title={canUpgrade ? undefined : t('updateDesktopOnly')}
      onClick={() => { if (upgradeable) openUpgrade() }}
    >{t('updateAction')}</Button>
  </div>
}
