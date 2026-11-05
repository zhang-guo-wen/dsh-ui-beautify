/**
 * The version row's reading: one request to the Host, one snapshot for the row.
 *
 * The Host owns the answer because the release manifest sits on another origin;
 * this side only asks, keeps what came back, and lets the row render it. One
 * reading is shared by every mount — opening the settings page again reuses the
 * answer the Host already has instead of starting a second request.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/update-check
 */

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { UPDATE_ROUTE } from '../params.ts'

/** What the row can say about the published release. */
export type UpdateRowPhase = 'idle' | 'loading' | 'ready' | 'failed' | 'unavailable'

/** Snapshot the version row renders. */
export interface UpdateRowState {
  phase: UpdateRowPhase
  /** The running release, as the Host reports it. */
  current: string | null
  /** The published release. */
  latest: string | null
  /** Whether the published release is newer than the running one. */
  hasUpdate: boolean
}

/** What the row's registration exposes to its component. */
export interface UpdateRowFace {
  hooks: { update: SnapshotStore<UpdateRowState> }
  /** Ask the Host again, past its cache. */
  checkUpdate: () => void
  /** Open the desktop shell's own update flow. */
  openUpgrade: () => void
  /** Whether this page can open that flow at all. */
  canUpgrade: boolean
}

/** The JSON the Host route answers with. */
interface UpdateAnswer {
  state?: unknown
  current?: unknown
  latest?: unknown
  hasUpdate?: unknown
}

/**
 * Read one answer into a row snapshot.
 * @param answer - the decoded JSON, of unknown provenance.
 * @returns the snapshot the row renders.
 */
function snapshotOf(answer: UpdateAnswer): UpdateRowState {
  const current = typeof answer.current === 'string' && answer.current !== '' ? answer.current : null
  const latest = typeof answer.latest === 'string' && answer.latest !== '' ? answer.latest : null
  const phase: UpdateRowPhase = answer.state === 'unavailable' ? 'unavailable'
    : answer.state === 'ok' ? 'ready'
    : 'failed'
  return { phase, current, latest, hasUpdate: phase === 'ready' && answer.hasUpdate === true }
}

/**
 * One reading of the published release, shared by every mount of the row.
 *
 * A request already in flight is joined rather than duplicated, and a settled
 * reading is kept: the Host re-reads the manifest on its own schedule, so a
 * second mount asking again would only add latency to the settings page.
 */
export class UpdateCheckController {
  /** The snapshot the row subscribes to. */
  readonly store = createSnapshotStore<UpdateRowState>({
    phase: 'idle', current: null, latest: null, hasUpdate: false,
  })

  private pending: Promise<void> | undefined

  /** @param route - the Host path that answers the published release. */
  constructor(private readonly route: string = UPDATE_ROUTE) {}

  /**
   * Ask the Host what is published.
   * @param force - whether to ask past the Host's cache and this side's settled answer.
   * @returns when the snapshot holds the answer, or the failure.
   */
  async check(force = false): Promise<void> {
    if (this.pending !== undefined) return this.pending
    const snapshot = this.store.getSnapshot()
    if (!force && (snapshot.phase === 'loading' || snapshot.phase === 'ready' || snapshot.phase === 'unavailable')) return
    if (snapshot.phase !== 'ready') this.store.set({ ...snapshot, phase: 'loading' })
    const work = (async (): Promise<void> => {
      try {
        const response = await fetch(`${this.route}${force ? '?force=1' : ''}`, { credentials: 'same-origin' })
        if (!response.ok) throw new Error(`update status: ${response.status}`)
        this.store.set(snapshotOf(await response.json() as UpdateAnswer))
      } catch {
        // A route that cannot answer leaves the published version unknown; the
        // row says so instead of pretending the install is current.
        this.store.set({ ...this.store.getSnapshot(), phase: 'failed' })
      }
    })()
    this.pending = work
    try { await work } finally { this.pending = undefined }
  }

  /**
   * The registration face the row's component reads.
   * @param openUpgrade - opens the desktop shell's update flow, when it has one.
   * @param canUpgrade - whether this page has such a flow.
   * @returns the hooks compartment and the row's two actions.
   */
  inject(openUpgrade: () => void, canUpgrade: boolean): UpdateRowFace {
    return {
      hooks: { update: this.store },
      checkUpdate: () => { void this.check(true) },
      openUpgrade,
      canUpgrade,
    }
  }

  /** Drop the settled answer so the next mount asks again. */
  dispose(): void {
    this.pending = undefined
  }
}
