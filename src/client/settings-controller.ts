/**
 * Controller bridging the Host `ui-beautify` settings namespace onto the Page
 * beautification section snapshot.
 *
 * It reads the stored face id and writes a new one through the settings scope.
 * Applying a choice to the document is not this class's job — the plugin body
 * owns that, so the section can render a snapshot without touching the DOM.
 *
 * @module @zhang-guo-wen/dsh-ui-beautify/client/settings-controller
 */

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import { DEFAULT_FONT_ID, type FontSettings } from '../fonts.ts'
import { FONT_SETTINGS_NS } from '../params.ts'

export { FONT_SETTINGS_NS } from '../params.ts'

/** Snapshot the section renders. */
export interface FontSectionState {
  /** Whether the namespace is exposed to this client. */
  available: boolean
  /** Whether the Host document accepts writes. */
  writable: boolean
  /** Id of the face currently stored. */
  font: string
}

/** Registration-side face for the section. */
export interface FontSectionFace {
  hooks: {
    /** Section snapshot bound by the renderer as useFontSettings. */
    fontSettings: SnapshotStore<FontSectionState>
  }
  /** Store one face id as the chosen body font. */
  choose: (id: string) => void
}

/** Owner handle over the `ui-beautify` namespace. */
export class FontController {
  private readonly store: SnapshotStore<FontSectionState>
  private readonly unsubscribe: () => void

  /**
   * @param scope - bound `ui-beautify` settings scope.
   */
  constructor(private readonly scope: SettingsScope<FontSettings>) {
    this.store = createSnapshotStore(this.projection())
    this.unsubscribe = scope.subscribe(() => { this.publish() })
  }

  /** Stop observing settings. */
  dispose(): void {
    this.unsubscribe()
  }

  /** Build the renderer face for this section. */
  inject(): FontSectionFace {
    return {
      hooks: { fontSettings: this.store },
      choose: id => { this.choose(id) },
    }
  }

  private choose(id: string): void {
    const snapshot = this.scope.getSnapshot()
    if (snapshot.status !== 'ready' || !snapshot.writable) return
    if (snapshot.value?.font === id) return
    void this.scope.set('font', id)
  }

  private projection(): FontSectionState {
    const snapshot = this.scope.getSnapshot()
    return {
      available: snapshot.status === 'ready',
      writable: snapshot.writable,
      font: snapshot.value?.font ?? DEFAULT_FONT_ID,
    }
  }

  private publish(): void {
    this.store.set(this.projection())
  }
}
