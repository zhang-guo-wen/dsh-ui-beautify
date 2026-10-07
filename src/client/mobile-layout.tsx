import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { useSyncExternalStore, type ReactNode } from 'react'
import { Button, IconPanelLeftOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, SlotComponent } from '@deepseek-ai/dsh-client-ui-slots'
import { createMobileController, type MobileLayoutController } from './mobile-layout-controller.ts'
import { NS } from './locales.ts'
import css from './mobile-layout.css'
import { MobileRecentSessions } from './MobileRecentSessions.tsx'

function MobileOverlay({ controller, t }: PropsLocale<typeof NS> & { controller: MobileLayoutController }): ReactNode {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  if (!state.mobile) return null
  return <div data-mobile-layout-controls="">{state.open
    ? <button type="button" data-mobile-layout-backdrop="" aria-label={t('mobileClose')} onClick={controller.close} />
    : <Button variant="ghost" size="sm" data-mobile-layout-toggle="" aria-label={t('mobileOpen')}
      title={t('mobileOpen')} onClick={controller.toggle} icon={<IconPanelLeftOutlineRegular size={20} />} />}</div>
}
function SuppressedPocketNavigation(): ReactNode { return null }

/** Keep the host sidebar and Pocket network service; replace only obsolete phone navigation. */
export function applyMobileLayout(ctx: Context): void {
  const controller = createMobileController({ document, window, css, toggleSidebar: () => ctx.layout.toggleSidebar() })
  ctx.effect(() => () => { controller.dispose() }, 'ui-beautify: mobile layout')
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'mobile-nav-overlay',
    order: 10, priority: -10, locale: NS, inject: () => ({ controller }) }, MobileOverlay))
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions', id: 'mobile-nav-toggle', order: 10, priority: -10,
  }, SuppressedPocketNavigation))
  ctx.inject(['uiWorkspace'], scope => {
    ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
      name: 'conversation.session.header.actions', id: 'ui-beautify-recent-sessions', order: 100, locale: NS,
      inject: () => ({ openSession: (id: string) => scope.get('uiWorkspace')!.openSession(id as Parameters<NonNullable<Context['uiWorkspace']>['openSession']>[0]) }),
    // Published development packages omit the Session standard-seat augmentation.
    // Installed host supplies sessionId/useSessions to this session-scoped cell.
    }, MobileRecentSessions as unknown as SlotComponent<PropsRuntime<'conversation.session.header.actions'>
      & PropsLocale<typeof NS> & { openSession: (id: string) => void }>))
  })
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action',
    id: 'mobile-nav-session-log', order: 10, priority: -10,
  }, SuppressedPocketNavigation))
}
