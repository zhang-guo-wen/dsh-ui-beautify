/**
 * The sidebar-brand switch: hides the logo and the product name painted at the
 * top-left of the sidebar.
 *
 * The brand is not a slot of its own — `ui-sidebar` renders the
 * `sidebar.brand.mark` and `sidebar.brand.name` occupants inside one container
 * (`SidebarRoot`'s `.logoRow > .brand`) and makes that container the New Session
 * shortcut. Shadowing the two occupants would therefore leave an unlabelled,
 * full-width click target behind, so the switch hides the container with one
 * stylesheet instead: the toggle beside it and the New Session button below it
 * keep their places, and releasing the stylesheet restores the host's own mark,
 * name, and click target untouched.
 *
 * The selector anchors on the structure rather than on the hashed CSS-module
 * names a build produces: the sidebar slot's anchor wraps the column root, the
 * logo row is the row holding the brand, and the brand is that row's direct
 * child whose class carries the module name `brand`. A host that renames its
 * rows stops matching, which leaves the brand visible instead of hiding the
 * wrong element.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/sidebar-brand
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { BeautifySettings } from '../fonts.ts'
import { watchFeature } from './feature-switch.ts'

/**
 * Selector of the sidebar's brand container.
 *
 * `[data-slot="sidebar"]` is the host slot's render anchor (laid out with
 * `display: contents`, so it wraps the column root without joining the layout).
 * Inside it, the logo row is the only element whose class carries the module
 * name `logoRow`, and the brand is the direct child of that row whose class
 * carries `brand` — the collapsed rail renders no brand at all, and the
 * `brandMark` / `brandName` occupants are grandchildren rather than children.
 */
export const SIDEBAR_BRAND_SELECTOR = '[data-slot="sidebar"] [class*="_logoRow"] > [class*="_brand"]'

/** Plugin identity written on the stylesheet the switch installs. */
const STYLESHEET_ID = '@guowenzhang/dsh-ui-beautify/sidebar-brand.css'

/**
 * The stylesheet the switch injects.
 * @returns one rule hiding the sidebar's brand container.
 */
export function sidebarBrandCss(): string {
  return `${SIDEBAR_BRAND_SELECTOR} {\n  display: none;\n}\n`
}

/**
 * Install the sidebar-brand hiding.
 *
 * Nothing else is touched: the host's brand occupants, the New Session shortcut,
 * and the sidebar toggle all stay registered and rendered, so releasing this
 * restores the row as the host painted it.
 * @returns disposer removing the stylesheet.
 */
export function installSidebarBrand(): () => void {
  const style = document.createElement('style')
  style.dataset.pluginCss = STYLESHEET_ID
  style.textContent = sidebarBrandCss()
  document.head.appendChild(style)
  return () => { style.remove() }
}

/**
 * Wire the sidebar-brand switch.
 *
 * The switch defaults off, so the installation waits for an explicit `true`: a
 * settings document without the field — a Host whose schema predates it — must
 * keep the mark and the name. It is independent of the other streamlined rows:
 * hiding the brand neither hides the composer seats nor the settings entries.
 * @param ctx - client context owning the effect.
 * @param scope - the `ui-beautify` configuration form holding the switch.
 */
export function applySidebarBrand(ctx: Context, scope: ConfigForm<BeautifySettings>): void {
  ctx.effect(
    () => watchFeature(scope, 'hideSidebarBrand', installSidebarBrand, { defaultOn: false }),
    'ui-beautify: sidebar brand',
  )
}
