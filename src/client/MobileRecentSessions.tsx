import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { deriveRecentSessions, equalRecentSessions, recentTitle, type RecentSessionList } from './recent-sessions.ts'
import { NS } from './locales.ts'

interface RecentWorkspaceSnapshot { archivedSessionIds: readonly string[]; phase?: string }
interface HostTabStyle { target: HTMLElement; tab: string; active: string }

/** Reuse the host catalog, archive snapshot, tab styles and session navigation. */
export function MobileRecentSessions({ sessionId, useSessions, useWorkspaces, openSession, t }:
  PropsLocale<typeof NS> & { sessionId: string; openSession: (id: string) => void;
    useSessions<T>(selector: (list: RecentSessionList) => T, equal?: (left: T, right: T) => boolean): T;
    useWorkspaces<T>(selector: (state: RecentWorkspaceSnapshot) => T, equal?: (left: T, right: T) => boolean): T }): ReactNode {
  const archives = useWorkspaces(state => state.archivedSessionIds,
    (left, right) => left.length === right.length && left.every((id, at) => id === right[at]))
  const rows = useSessions(list => deriveRecentSessions(list, sessionId, archives), equalRecentSessions)
  const anchor = useRef<HTMLSpanElement>(null)
  const [style, setStyle] = useState<HostTabStyle | null>(null)
  useLayoutEffect(() => {
    const header = anchor.current?.closest('header')
    if (!header || header.querySelector('[class*="_recentSessions"]')) return
    const tabs = header.querySelector<HTMLElement>('[data-conversation-tabs]')
    const hostTabs = Array.from(tabs?.querySelectorAll<HTMLButtonElement>(':scope > button[role="tab"]') ?? [])
    const tab = hostTabs.flatMap(node => Array.from(node.classList)).find(name => name.endsWith('_tab')) ?? ''
    const active = hostTabs.flatMap(node => Array.from(node.classList)).find(name => name.endsWith('_tabActive')) ?? ''
    const node = document.createElement('div')
    node.dataset.uiBeautifyRecent = ''
    if (tabs) {
      tabs.setAttribute('data-ui-beautify-recent-tabs', '')
      tabs.appendChild(node)
    } else header.appendChild(node)
    setStyle({ target: node, tab, active })
    return () => { node.remove(); tabs?.removeAttribute('data-ui-beautify-recent-tabs') }
  }, [])
  return <><span ref={anchor} data-ui-beautify-recent-anchor="" />{style && rows.length > 0 && createPortal(
    <nav aria-label={t('mobileRecent')} data-mobile-recent-sessions="">
      {rows.map(row => <button key={row.id} type="button" className={`${style.tab} ${row.id === sessionId ? style.active : ''}`}
        title={row.displayTitle} data-recent-session-id={row.id} aria-label={t('mobileSwitch', { title: row.displayTitle })}
        aria-current={row.id === sessionId ? 'page' : undefined}
        onClick={() => { if (row.id !== sessionId) openSession(row.id) }}>{recentTitle(row.displayTitle)}</button>)}
    </nav>, style.target)}</>
}
