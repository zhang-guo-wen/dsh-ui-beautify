import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { StateDot, type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import { deriveRecentSessions, recentTitle, type RecentSessionList } from './recent-sessions.ts'
import { recentSessionStatus, type RecentSessionStatuses, type RecentStatusKind } from './recent-session-status.ts'
import { NS } from './locales.ts'

interface RecentWorkspaceSnapshot { archivedSessionIds: readonly string[]; phase?: string }

const statusPresentation = {
  approval: ['warning', 'mobileStatusApproval'],
  'plan-review': ['warning', 'mobileStatusPlanReview'],
  question: ['warning', 'mobileStatusQuestion'],
  running: ['ongoing', 'mobileStatusRunning'],
  subagents: ['ongoing', 'mobileStatusSubagents'],
  completed: ['done', 'mobileStatusCompleted'],
  idle: ['idle', 'mobileStatusIdle'],
} as const satisfies Record<RecentStatusKind, readonly [StateDotState, string]>

/** Reuse host session data/navigation; keep recent tabs styled without a code-view tab bar. */
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
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const hasRows = rows.length > 0
  useLayoutEffect(() => {
    const header = anchor.current?.closest('header')
    if (!header || !hasRows) { setTarget(null); return }
    const node = document.createElement('div')
    node.dataset.uiBeautifyRecent = ''
    let tabs: HTMLElement | null = null
    const sync = (): void => {
      const native = header.querySelector('[class*="_recentSessions"]')
      const nextTabs = native ? null : header.querySelector<HTMLElement>('[data-conversation-tabs]')
      if (tabs !== nextTabs) {
        tabs?.removeAttribute('data-ui-beautify-recent-tabs')
        tabs = nextTabs
        tabs?.setAttribute('data-ui-beautify-recent-tabs', '')
      }
      if (native) { node.remove(); return }
      // Move the same portal when the optional host tab bar mounts or disappears.
      const parent = tabs ?? header
      if (node.parentElement !== parent) parent.appendChild(node)
    }
    sync()
    setTarget(node)
    const observer = new MutationObserver(sync)
    observer.observe(header, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      node.remove()
      tabs?.removeAttribute('data-ui-beautify-recent-tabs')
    }
  }, [hasRows])
  return <><span ref={anchor} data-ui-beautify-recent-anchor="" />{target && hasRows && createPortal(
    <nav aria-label={t('mobileRecent')} data-mobile-recent-sessions="">
      {rows.map(row => {
        const kind = recentSessionStatus(row, list, statuses)
        const [state, labelKey] = statusPresentation[kind]
        const label = t(labelKey)
        return <button key={row.id} type="button"
          title={`${row.displayTitle} · ${label}`} data-recent-session-id={row.id} data-recent-status={kind}
          aria-label={`${t('mobileSwitch', { title: row.displayTitle })} · ${label}`}
          aria-current={row.id === sessionId ? 'page' : undefined}
          onClick={() => { if (row.id !== sessionId) openSession(row.id) }}>
          {state !== 'idle' && <span data-recent-session-status=""><StateDot state={state} /></span>}
          <span data-recent-session-title="">{recentTitle(row.displayTitle)}</span>
        </button>
      })}
    </nav>, target)}</>
}
