/**
 * Controller bridging the Host `ui-beautify` settings namespace and its cache
 * read-out onto the General-settings rows' snapshots.
 *
 * It reads the stored face ids, writes a new one through the settings form, and
 * carries what the local cache holds for each face. Applying a choice to the
 * document is not this class's job — the plugin body owns that, so a row can
 * render a snapshot without touching the DOM.
 *
 * The cache reading is a sample, not a subscription: the Host answers when
 * asked, and a row asks when it renders and shortly after a choice lands, which
 * is when a download has had time to put something on disk. Both rows share one
 * reading, because they share one cache.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/settings-controller
 */

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  FONT_ROLES, resolveFontChoice, type FontCacheReport, type FontRole, type FontSettings,
} from '../fonts.ts'
import { CACHE_ROUTE, FONT_SETTINGS_NS } from '../params.ts'

export { FONT_SETTINGS_NS } from '../params.ts'

/**
 * How long after a committed choice the cache is read again.
 *
 * Applying a face is what starts its download, so the read that follows the
 * click has to wait long enough for the first files to land.
 */
const CACHE_REREAD_DELAY_MS = 1500

/** Snapshot a row renders. */
export interface FontRowState {
  /** Whether the namespace is exposed to this client. */
  available: boolean
  /** Whether the Host document accepts writes. */
  writable: boolean
  /** Id of the body face currently stored. */
  font: string
  /** Id of the code face currently stored. */
  codeFont: string
  /** What each face holds in the local cache; a face absent from it has downloaded nothing. */
  cache: FontCacheReport
}

/** What one row needs from the plugin body: the shared snapshot and its writers. */
export interface FontRowFace {
  hooks: {
    /** Row snapshot bound by the renderer as useFontSettings. */
    fontSettings: SnapshotStore<FontRowState>
  }
  /** Store one face id as this row's choice. */
  choose: (id: string) => void
  /** Ask the Host what the cache holds and publish the answer. */
  refreshCache: () => void
}

/** Owner handle over the `ui-beautify` namespace and its cache read-out. */
export class FontController {
  private readonly store: SnapshotStore<FontRowState>
  private readonly unsubscribe: () => void
  private cache: FontCacheReport = {}
  private pending: ReturnType<typeof setTimeout> | undefined

  /**
   * @param scope - the `ui-beautify` configuration form.
   */
  constructor(private readonly scope: ConfigForm<FontSettings>) {
    this.store = createSnapshotStore(this.projection())
    this.unsubscribe = scope.subscribe(() => {
      this.publish()
      this.scheduleCacheRead()
    })
  }

  /** Stop observing settings and drop the pending cache read. */
  dispose(): void {
    this.unsubscribe()
    if (this.pending !== undefined) clearTimeout(this.pending)
  }

  /**
   * Build the renderer face for one row.
   * @param role - the role that row edits.
   * @returns its hooks and writers.
   */
  inject(role: FontRole): FontRowFace {
    return {
      hooks: { fontSettings: this.store },
      choose: id => { this.choose(role, id) },
      refreshCache: () => { this.refreshCache() },
    }
  }

  /** Read the cache once and publish what it holds. */
  refreshCache(): void {
    void this.read()
  }

  private async read(): Promise<void> {
    let report: FontCacheReport
    try {
      const response = await fetch(CACHE_ROUTE, { headers: { accept: 'application/json' } })
      if (!response.ok) return
      report = ((await response.json()) as { faces?: FontCacheReport }).faces ?? {}
    } catch {
      // A Host that is not answering leaves the rows without cache labels. The
      // choice itself still works, so a row shows nothing rather than an error
      // the user cannot act on.
      return
    }
    this.cache = report
    this.publish()
  }

  private scheduleCacheRead(): void {
    if (this.pending !== undefined) clearTimeout(this.pending)
    this.pending = setTimeout(() => {
      this.pending = undefined
      this.refreshCache()
    }, CACHE_REREAD_DELAY_MS)
  }

  private choose(role: FontRole, id: string): void {
    const snapshot = this.scope.getSnapshot()
    if (snapshot.status !== 'ready' || !snapshot.writable) return
    const key = FONT_ROLES[role].key
    if (snapshot.value?.[key] === id) return
    void this.scope.set(key, id)
  }

  private projection(): FontRowState {
    const snapshot = this.scope.getSnapshot()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      // The document is hand-editable, so an unknown stored value must show as
      // the choice actually in effect rather than as nothing selected.
      font: resolveFontChoice(snapshot.value?.font, 'body'),
      codeFont: resolveFontChoice(snapshot.value?.codeFont, 'code'),
      cache: this.cache,
    }
  }

  private publish(): void {
    this.store.set(this.projection())
  }
}
