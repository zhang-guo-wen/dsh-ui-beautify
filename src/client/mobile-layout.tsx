import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { BeautifySettings } from '../fonts.ts'
import { useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button, IconPanelLeftOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, SlotComponent } from '@deepseek-ai/dsh-client-ui-slots'
import { createMobileController, type MobileLayoutController } from './mobile-layout-controller.ts'
import { NS } from './locales.ts'
import css from './mobile-layout.css'
import recentCss from './recent-sessions.css'
import { MobileRecentSessions } from './MobileRecentSessions.tsx'
import { watchFeature } from './feature-switch.ts'

function MobileOverlay({ controller, t }: PropsLocale<typeof NS> & { controller: MobileLayoutController }): ReactNode {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const [leading, setLeading] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (!state.mobile) { setLeading(null); return }
    // The host header owns vertical alignment, including blank and session headers.
    const sync = (): void => { setLeading(document.querySelector('[data-conversation-header-leading]')) }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, { subtree: true, childList: true })
    return () => { observer.disconnect() }
  }, [state.mobile])
  if (!state.mobile) return null
  const toggle = <Button variant="ghost" size="sm" data-mobile-layout-toggle=""
    data-mobile-layout-header-toggle={leading ? '' : undefined} aria-label={t('mobileOpen')}
    title={t('mobileOpen')} onClick={controller.toggle} icon={<IconPanelLeftOutlineRegular size={16} />} />
  return <div data-mobile-layout-controls="">{state.open
    ? <button type="button" data-mobile-layout-backdrop="" aria-label={t('mobileClose')} onClick={controller.close} />
    : leading ? createPortal(toggle, leading) : toggle}</div>
}
function SuppressedPocketNavigation(): ReactNode { return null }

/** Independent lifetimes: switching off phone geometry never removes the recent strip. */
export function applyMobileLayout(ctx: Context, scope: ConfigForm<BeautifySettings>): void {
  ctx.effect(() => watchFeature(scope, 'mobileLayoutEnabled', () => {
    const controller = createMobileController({ document, window, css, toggleSidebar: () => ctx.layout.toggleSidebar() })
    const offOverlay = ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'mobile-nav-overlay',
      order: 10, priority: -10, locale: NS, inject: () => ({ controller }) }, MobileOverlay))
    const offToggle = ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
      name: 'conversation.session.header.actions', id: 'mobile-nav-toggle', order: 10, priority: -10,
    }, SuppressedPocketNavigation))
    const offLog = ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action',
      id: 'mobile-nav-session-log', order: 10, priority: -10,
    }, SuppressedPocketNavigation))
    return () => { offOverlay(); offToggle(); offLog(); controller.dispose() }
  }), 'ui-beautify: mobile layout')
  ctx.inject(['uiWorkspace'], workspace => {
    ctx.effect(() => watchFeature(scope, 'recentSessionsEnabled', () => {
      const style = document.createElement('style')
      style.dataset.pluginCss = '@guowenzhang/dsh-ui-beautify/recent-sessions.css'
      style.textContent = recentCss
      document.head.appendChild(style)
      const off = ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
        name: 'conversation.session.header.actions', id: 'ui-beautify-recent-sessions', order: 100, locale: NS,
        inject: () => ({ openSession: (id: string) => workspace.get('uiWorkspace')!.openSession(id as Parameters<NonNullable<Context['uiWorkspace']>['openSession']>[0]) }),
      // Published development packages omit the Session standard-seat augmentation.
      }, MobileRecentSessions as unknown as SlotComponent<PropsRuntime<'conversation.session.header.actions'>
        & PropsLocale<typeof NS> & { openSession: (id: string) => void }>))
      return () => { off(); style.remove() }
    }), 'ui-beautify: recent sessions')
  })
}
