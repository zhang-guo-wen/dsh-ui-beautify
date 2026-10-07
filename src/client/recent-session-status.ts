import type { RecentSession, RecentSessionList } from './recent-sessions.ts'

/** Public standard-seat projection, shared with the workspace sidebar. */
export interface RecentSessionStatus {
  running?: boolean
  completionUnread?: boolean
  pendingInteraction?: { kind: string }
}
export type RecentSessionStatuses = ReadonlyMap<string, RecentSessionStatus>
export type RecentStatusKind = 'approval' | 'plan-review' | 'question' | 'running' | 'subagents' | 'completed' | 'idle'

/** Match the sidebar priority: user attention > live work > unread completion. */
export function recentSessionStatus(row: RecentSession, list: RecentSessionList, statuses: RecentSessionStatuses): RecentStatusKind {
  const status = statuses.get(row.id)
  const pending = status?.pendingInteraction?.kind
  if (pending === 'approval' || pending === 'plan-review' || pending === 'question') return pending
  if (status?.running ?? row.running) return 'running'
  const children = list.projectionsBySession?.[row.id]?.values.subagentCatalog ?? []
  if (children.some(child => (statuses.get(child.id)?.running ?? list.byId[child.id]?.running) === true)) return 'subagents'
  if (status?.completionUnread === true) return 'completed'
  return 'idle'
}
