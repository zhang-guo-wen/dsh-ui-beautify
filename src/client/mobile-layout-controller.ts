/** Phone frame geometry and lifecycle, owned by UI Beautify rather than the host. */
export interface MobileLayoutState { mobile: boolean; open: boolean }
export interface MobileLayoutController {
  getSnapshot(): MobileLayoutState
  subscribe(listener: () => void): () => void
  toggle(): void
  close(): void
  dispose(): void
}

/**
 * Frame attributes that mean the host already owns the phone drawer.
 *
 * DSH 0.2.2+ renders its own drawer below 768px and marks the frame with
 * `data-sidebar-drawer` (see the host's `sidebar-drawer` e2e suite); an earlier
 * draft used `data-mobile-sidebar`. On those hosts the frame's first child is
 * the drawer mask, not the sidebar column, so this plugin's first-child drawer
 * geometry would size and raise the mask over the real sidebar — the drawer then
 * opens blank and swallows every tap. Either attribute means: stand down.
 */
const HOST_DRAWER_ATTRIBUTES = ['data-sidebar-drawer', 'data-mobile-sidebar'] as const

export function createMobileController({ document, window, toggleSidebar, css }: {
  document: Document
  window: Pick<Window, 'matchMedia' | 'requestAnimationFrame' | 'cancelAnimationFrame'> & { MutationObserver: typeof MutationObserver }
  toggleSidebar: () => void
  css: string
}): MobileLayoutController {
  const media = window.matchMedia('(max-width: 600px)')
  const listeners = new Set<() => void>()
  const pocketStyles = new Map<HTMLStyleElement, string | null>()
  const style = document.createElement('style')
  style.dataset.pluginCss = '@guowenzhang/dsh-ui-beautify/mobile-layout.css'
  style.textContent = css
  document.head.appendChild(style)
  let frame: HTMLElement | null = null
  let value: MobileLayoutState = { mobile: false, open: false }
  let stopped = false
  let navigationFrame: number | null = null
  const publish = (mobile: boolean, open: boolean): void => {
    if (value.mobile === mobile && value.open === open) return
    value = { mobile, open }
    for (const listener of listeners) listener()
  }
  const sync = (): void => {
    if (stopped) return
    // Pocket 2.10.6's obsolete mobile styles are separate from its proxy and settings UI.
    for (const tag of document.querySelectorAll<HTMLStyleElement>('style[data-plugin-css="@dsh-external/dsh-mobile-nav/mobile.css"]')) {
      if (!pocketStyles.has(tag)) pocketStyles.set(tag, tag.getAttribute('media'))
      if (tag.getAttribute('media') !== 'not all') tag.setAttribute('media', 'not all')
    }
    const next = document.querySelector('[data-shell-overlay]')?.parentElement ?? null
    if (frame !== next) {
      frame?.removeAttribute('data-mobile-layout-frame')
      frame = next
    }
    const mobile = media.matches && frame !== null
      && !HOST_DRAWER_ATTRIBUTES.some(name => frame?.hasAttribute(name) === true)
    if (mobile && frame !== null) {
      if (!frame.hasAttribute('data-mobile-layout-frame')) frame.setAttribute('data-mobile-layout-frame', '')
    } else frame?.removeAttribute('data-mobile-layout-frame')
    publish(mobile, mobile && frame !== null && !frame.hasAttribute('data-sidebar-collapsed'))
  }
  const close = (): void => {
    sync()
    if (value.mobile && value.open) toggleSidebar()
  }
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) close()
  }
  const onClick = (event: MouseEvent): void => {
    const target = event.target as Element | null
    if (!value.mobile || !value.open || target === null || !frame?.firstElementChild?.contains(target)) return
    if (typeof target.closest !== 'function' || target.closest('[role="dialog"],[role="menu"],[role="listbox"]')) return
    const session = target.closest('[class*="sessionRow"],[role="treeitem"][aria-selected]')
    const action = target.closest('[class*="panelList"] button,[class*="newSession"]')
    if (!session && !action) return
    if (session && target.closest('button')) return
    if (navigationFrame !== null) window.cancelAnimationFrame(navigationFrame)
    navigationFrame = window.requestAnimationFrame(() => { navigationFrame = null; close() })
  }
  const observer = new window.MutationObserver(sync)
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true,
    attributeFilter: ['data-sidebar-collapsed', 'data-sidebar-drawer', 'data-mobile-sidebar', 'data-mobile-layout-frame', 'data-plugin-css', 'media'] })
  media.addEventListener('change', sync)
  document.addEventListener('keydown', onKey)
  document.addEventListener('click', onClick)
  sync()
  return {
    getSnapshot: () => value,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    toggle() { if (value.mobile) toggleSidebar() },
    close,
    dispose() {
      stopped = true
      observer.disconnect()
      media.removeEventListener('change', sync)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
      if (navigationFrame !== null) window.cancelAnimationFrame(navigationFrame)
      frame?.removeAttribute('data-mobile-layout-frame')
      for (const [tag, oldMedia] of pocketStyles) {
        if (oldMedia === null) tag.removeAttribute('media')
        else tag.setAttribute('media', oldMedia)
      }
      style.remove()
      listeners.clear()
    },
  }
}
