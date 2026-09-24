/**
 * Controller bridging the Host `ui-beautify` settings namespace and its cache
 * read-out onto the General-settings rows' snapshots.
 *
 * It reads the stored choices, writes a new one through the settings form, and
 * carries what the local cache holds for each face. Applying a choice to the
 * document is not this class's job — the plugin body owns that, so a row can
 * render a snapshot without touching the DOM.
 *
 * Every row shares one snapshot and one store: the choices live in one
 * namespace, so three subscriptions would only give three views of the same
 * document and three chances to disagree about it.
 *
 * The cache reading is a sample, not a subscription: the Host answers when
 * asked, and a row asks when it renders and shortly after a choice lands, which
 * is when a download has had time to put something on disk. Both font rows share
 * one reading, because they share one cache.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/settings-controller
 */

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  resolveFontChoice, type BeautifySettings, type FontCacheReport,
} from '../fonts.ts'
import { resolveMotionChoice, type MotionChoice } from '../motion.ts'
import { CACHE_ROUTE, FONT_SETTINGS_NS } from '../params.ts'

export { FONT_SETTINGS_NS } from '../params.ts'

/**
 * How long after a committed choice the cache is read again.
 *
 * Applying a face is what starts its download, so the read that follows the
 * click has to wait long enough for the first files to land.
 */
const CACHE_REREAD_DELAY_MS = 1500

/** Snapshot a settings row renders. */
export interface SettingsRowState {
  /** Whether the namespace is exposed to this client. */
  available: boolean
  /** Whether the Host document accepts writes. */
  writable: boolean
  /**
   * Whether the Host's namespace exposes each field at all.
   *
   * A field the bundled client knows about but the running Host does not is the
   * signature of a Host half that predates it: the plugin module is imported
   * once per process, so replacing `lib/` updates the browser half on the next
   * page load while the Host keeps the schema it loaded at start. Writes to a
   * field its schema lacks are refused, which otherwise looks like a dead
   * control.
   */
  fields: Readonly<Record<keyof BeautifySettings, boolean>>
  /** Id of the body face currently stored. */
  font: string
  /** Id of the code face currently stored. */
  codeFont: string
  /** Motion answer currently stored, already resolved to a choice. */
  motion: MotionChoice
  /** What each face holds in the local cache; a face absent from it has downloaded nothing. */
  cache: FontCacheReport
}

/** What one settings row needs from the plugin body: the shared snapshot and its writers. */
export interface SettingsRowFace {
  hooks: {
    /** Row snapshot bound by the renderer as useBeautify. */
    beautify: SnapshotStore<SettingsRowState>
  }
  /**
   * Store one value under one namespace field.
   *
   * Addressed by field rather than by role because the lane's row writes a
   * choice that belongs to no font role.
   */
  choose: (key: keyof BeautifySettings, id: string) => void
  /** Ask the Host what the cache holds and publish the answer. */
  refreshCache: () => void
}

/** Owner handle over the `ui-beautify` namespace and its cache read-out. */
export class SettingsController {
  private readonly store: SnapshotStore<SettingsRowState>
  private readonly unsubscribe: () => void
  private cache: FontCacheReport = {}
  private pending: ReturnType<typeof setTimeout> | undefined

  /**
   * @param scope - the `ui-beautify` configuration form.
   */
  constructor(private readonly scope: ConfigForm<BeautifySettings>) {
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
   * Build the renderer face every settings row shares.
   * @returns its hooks and writers.
   */
  inject(): SettingsRowFace {
    return {
      hooks: { beautify: this.store },
      choose: (key, id) => { this.choose(key, id) },
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

  private choose(key: keyof BeautifySettings, id: string): void {
    const snapshot = this.scope.getSnapshot()
    if (snapshot.status !== 'ready' || !snapshot.writable) return
    if (snapshot.value?.[key] === id) return
    void this.scope.set(key, id)
  }

  private projection(): SettingsRowState {
    const snapshot = this.scope.getSnapshot()
    // Partial, because this reads presence: a field the Host's schema lacks is
    // absent from the section it sends, whatever this bundle expects.
    const value: Partial<BeautifySettings> | undefined = snapshot.value
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      fields: {
        font: value?.font !== undefined,
        codeFont: value?.codeFont !== undefined,
        motion: value?.motion !== undefined,
      },
      // The document is hand-editable, so an unknown stored value must show as
      // the choice actually in effect rather than as nothing selected.
      font: resolveFontChoice(value?.font, 'body'),
      codeFont: resolveFontChoice(value?.codeFont, 'code'),
      motion: resolveMotionChoice(value?.motion),
      cache: this.cache,
    }
  }

  private publish(): void {
    this.store.set(this.projection())
  }
}
