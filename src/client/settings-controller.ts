/**
 * Controller bridging the Host `ui-beautify` settings namespace onto the Page
 * beautification section snapshot.
 *
 * It reads the stored face id and writes a new one through the settings form.
 * Applying a choice to the document is not this class's job — the plugin body
 * owns that, so the section can render a snapshot without touching the DOM.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/settings-controller
 */

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { resolveFontChoice, type FontSettings } from '../fonts.ts'
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
   * @param scope - the `ui-beautify` configuration form.
   */
  constructor(private readonly scope: ConfigForm<FontSettings>) {
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
      // The document is hand-editable, so an unknown stored value must show as
      // the choice actually in effect rather than as nothing selected.
      font: resolveFontChoice(snapshot.value?.font),
    }
  }

  private publish(): void {
    this.store.set(this.projection())
  }
}
