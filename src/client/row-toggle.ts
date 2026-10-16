/**
 * Row-wide activation for the rows whose only control is a switch.
 *
 * The host `Switch` is a fixed 36x20 control whose body a plugin cannot enlarge,
 * so the row itself is the touch target: it is 44px tall on a coarse pointer, and
 * a press anywhere outside another control fires the same change the switch does.
 * The switch stays the only focusable, keyboard-reachable control; this handler
 * only widens where a pointer may land.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/row-toggle
 */

import type { MouseEvent } from 'react'

/** Selector for the controls that answer a press themselves. */
const OWN_CONTROLS = 'button, input, select, textarea, a'

/**
 * Build one row's press handler.
 * @param disabled - whether the row's switch is currently disabled.
 * @param toggle - the change its switch would make.
 * @returns the handler the row element attaches.
 */
export function rowToggle(disabled: boolean, toggle: () => void): (event: MouseEvent<HTMLElement>) => void {
  return (event) => {
    if (disabled) return
    // A press that lands on the switch, the save retry or any other control is
    // that control's own gesture; handling it here too would flip the setting
    // twice or steal the retry's press.
    const target = event.target as Element | null
    if (target !== null && target.closest?.(OWN_CONTROLS) != null) return
    toggle()
  }
}
