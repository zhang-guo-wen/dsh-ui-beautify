/**
 * Which conversation just opened from the host's "finished, not read" state.
 *
 * `uiSession.sessionStatus` publishes a `completionUnread` flag per Session: the
 * host sets it when a run finishes while the Session is not the main view — the
 * green dot the workspace sidebar draws — and clears it at two different moments.
 * A new run starting clears it too, so the flag alone cannot say what happened;
 * the published snapshot separates the two: a run clear still reports
 * `running: true`, while the reader opening the Session clears it with the run
 * stopped.
 *
 * Those moments are asynchronous to rendering: the host clears the flag in the
 * same publication that switches the main view, before the opened conversation
 * has rendered. Watching the publications keeps the fact longer than the flag
 * does, which is what lets the landing wait for its DOM.
 */

/** The two Session facts this module reads. */
export interface SessionStatusLike {
  /** Whether a run is executing in this Session. */
  readonly running?: boolean
  /** Whether a run finished while the Session was not the main view. */
  readonly completionUnread?: boolean
}

/** One publication of the host's per-Session status map. */
export type SessionStatusSnapshot = ReadonlyMap<string, SessionStatusLike>

/**
 * Sessions whose unread completion cleared without a run taking over.
 *
 * The first publication only establishes the baseline: a page that loads while
 * tabs are already open must not land anywhere.
 * @param previous - the previous publication, or undefined before the baseline.
 * @param next - the publication just received.
 * @returns the Sessions a reader opened, in publication order.
 */
export function openedFromUnread(
  previous: SessionStatusSnapshot | undefined,
  next: SessionStatusSnapshot,
): readonly string[] {
  if (previous === undefined) return []
  const opened: string[] = []
  for (const [id, status] of next) {
    if (previous.get(id)?.completionUnread !== true) continue
    if (status.completionUnread === true) continue
    // A run that started clears the same flag; only a stopped Session is a read.
    if (status.running === true) continue
    opened.push(id)
  }
  return opened
}
