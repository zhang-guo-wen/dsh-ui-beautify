/** Small public catalog projection; do not treat subagents or blank drafts as recent conversations. */
export interface RecentSession { id: string; displayTitle: string; updatedAt: number; blank?: boolean; origin?: string }
export interface RecentSessionList { ids: readonly string[]; byId: Readonly<Record<string, RecentSession | undefined>> }
export function deriveRecentSessions(list: RecentSessionList, current: string, archivedIds: readonly string[] = []): readonly RecentSession[] {
  const archived = new Set(archivedIds)
  // Selection changes only the highlight, never membership or position.
  return list.ids.map(id => list.byId[id]).filter((row): row is RecentSession =>
    row !== undefined && row.origin !== 'subagent' && !row.blank && !archived.has(row.id))
    .sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id))
    .slice(0, 5)
}
export function equalRecentSessions(left: readonly RecentSession[], right: readonly RecentSession[]): boolean {
  return left.length === right.length && left.every((row, at) => row.id === right[at]?.id && row.displayTitle === right[at]?.displayTitle)
}
export function recentTitle(title: string): string { return Array.from(title).slice(0, 5).join('') }
