import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { StateDot, type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import { deriveRecentSessions, recentTitle, type RecentSessionList } from './recent-sessions.ts'
import { recentSessionStatus, type RecentSessionStatuses, type RecentStatusKind } from './recent-session-status.ts'
import { NS } from './locales.ts'

interface RecentWorkspaceSnapshot { archivedSessionIds: readonly string[]; phase?: string }
interface HostTabStyle { target: HTMLElement; tab: string; active: string }

const statusPresentation = {
  approval: ['warning', 'mobileStatusApproval'],
  'plan-review': ['warning', 'mobileStatusPlanReview'],
  question: ['warning', 'mobileStatusQuestion'],
  running: ['ongoing', 'mobileStatusRunning'],
  subagents: ['ongoing', 'mobileStatusSubagents'],
  completed: ['done', 'mobileStatusCompleted'],
  idle: ['idle', 'mobileStatusIdle'],
} as const satisfies Record<RecentStatusKind, readonly [StateDotState, string]>

/** Reuse the host catalog, archive/status snapshots, tab styles and session navigation. */
export function MobileRecentSessions({ sessionId, useSessions, useSessionStatus, useWorkspaces, openSession, t }:
  PropsLocale<typeof NS> & { sessionId: string; openSession: (id: string) => void;
    useSessions<T>(selector: (list: RecentSessionList) => T, equal?: (left: T, right: T) => boolean): T;
    useSessionStatus<T>(selector: (state: RecentSessionStatuses) => T, equal?: (left: T, right: T) => boolean): T;
    useWorkspaces<T>(selector: (state: RecentWorkspaceSnapshot) => T, equal?: (left: T, right: T) => boolean): T }): ReactNode {
  const archives = useWorkspaces(state => state.archivedSessionIds,
    (left, right) => left.length === right.length && left.every((id, at) => id === right[at]))
  const list = useSessions(list => list)
  const statuses = useSessionStatus(state => state)
  const rows = deriveRecentSessions(list, sessionId, archives)
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
      {rows.map(row => {
        const kind = recentSessionStatus(row, list, statuses)
        const [state, labelKey] = statusPresentation[kind]
        const label = t(labelKey)
        return <button key={row.id} type="button" className={`${style.tab} ${row.id === sessionId ? style.active : ''}`}
          title={`${row.displayTitle} · ${label}`} data-recent-session-id={row.id} data-recent-status={kind}
          aria-label={`${t('mobileSwitch', { title: row.displayTitle })} · ${label}`}
          aria-current={row.id === sessionId ? 'page' : undefined}
          onClick={() => { if (row.id !== sessionId) openSession(row.id) }}>
          {state !== 'idle' && <span data-recent-session-status=""><StateDot state={state} /></span>}
          <span data-recent-session-title="">{recentTitle(row.displayTitle)}</span>
        </button>
      })}
    </nav>, style.target)}</>
}
