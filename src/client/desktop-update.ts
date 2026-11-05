/**
 * The desktop preload's update entry, as this plugin uses it.
 *
 * The shell owns checking, downloading, and installing; the row only asks it to
 * open the flow the user would otherwise reach from the shell's own menu. A
 * page that is not the desktop document has no preload, which is why the entry
 * is looked up rather than assumed.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/desktop-update
 */

/** The one operation this plugin calls on the desktop shell. */
export interface DesktopUpdateEntry {
  /** Open the shell's update flow, resolving when the shell has taken the request. */
  open(): Promise<unknown>
}

/**
 * Look the desktop update entry up on a global object.
 * @param scope - the global object to read (`globalThis` in the browser).
 * @returns the entry, or undefined when this page has no desktop shell behind it.
 */
export function desktopUpdateEntry(scope: object): DesktopUpdateEntry | undefined {
  const carrier = (scope as { dshDesktop?: unknown }).dshDesktop
  if (typeof carrier !== 'object' || carrier === null) return undefined
  const updates = (carrier as { updates?: unknown }).updates
  if (typeof updates !== 'object' || updates === null) return undefined
  const open = (updates as { open?: unknown }).open
  if (typeof open !== 'function') return undefined
  return {
    open: () => Promise.resolve((open as (this: unknown) => unknown).call(updates)),
  }
}
