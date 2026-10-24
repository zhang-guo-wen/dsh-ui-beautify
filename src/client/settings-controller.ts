/**
 * Controller bridging the Host `ui-beautify` settings namespace and its cache
 * read-out onto the General-settings rows' snapshots.
 *
 * It reads the stored choices, writes a new one through the settings form, and
 * carries what the local cache holds for each face and how each write settled.
 * Applying a choice to the document is not this class's job — the plugin body
 * owns that, so a row can render a snapshot without touching the DOM.
 *
 * Every row shares one snapshot and one store: the choices live in one
 * namespace, so three subscriptions would only give three views of the same
 * document and three chances to disagree about it.
 *
 * The cache reading is a sample, not a subscription: the Host answers when
 * asked, and a row asks when it renders and shortly after a font choice lands,
 * which is when a download has had time to put something on disk. Both font rows
 * share one reading, and overlapping callers share one request, because they
 * share one cache.
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
import { quickReplySlots } from '../quick-replies.ts'

export { FONT_SETTINGS_NS } from '../params.ts'

/**
 * How long after a committed choice the cache is read again.
 *
 * Applying a face is what starts its download, so the read that follows the
 * click has to wait long enough for the first files to land.
 */
const CACHE_REREAD_DELAY_MS = 1500

/**
 * How long a settled write keeps saying so.
 *
 * Success is reported, not asked about, so the note has to retire itself; a
 * failure stays until the retry replaces it.
 */
const SAVED_NOTE_MS = 2500

/** The value a row can write: the three JSON shapes the namespace fields use. */
type Writable = string | boolean | readonly string[]

/** What one row's last write is doing, as the row shows it. */
export type SaveState = 'saving' | 'saved' | 'error'

/**
 * Whether a field already holds the value a row is about to write.
 *
 * Pickers store strings, the visibility switch stores a boolean, and the
 * phrases are a positional list. Identity answers for scalars, but a list is compared
 * entry by entry — an equal list would otherwise publish a new snapshot and
 * re-render the dock for nothing.
 * @param current - the stored value, or undefined when the field is absent.
 * @param next - the value about to be written.
 * @returns whether writing it would change anything.
 */
function sameValue(current: Writable | undefined, next: Writable): boolean {
  if (!Array.isArray(next)) return current === next
  return Array.isArray(current) && current.length === next.length
    && current.every((entry, at) => entry === next[at])
}

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
  logo: string
  brandIcon: string
  brandName: string
  tagline: string
  /** Phrases the quick-reply dock offers, as positional slots; empty means built-in. */
  quickReplies: string[]
  /** Desktop visibility, defaulting on for existing profiles. */
  quickRepliesEnabled: boolean
  mobileLayoutEnabled: boolean
  recentSessionsEnabled: boolean
  remoteSettingsEnabled: boolean
  /** Whether the up button back to the latest sent question is shown. */
  scrollToPromptEnabled: boolean
  /** Whether the floating "conversation start" chip above the transcript is shown. */
  sessionStartChipEnabled: boolean
  /** Whether the deployment-facing surfaces are stripped; defaults off. */
  streamlinedUiEnabled: boolean
  /** Whether the readings under the composer are hidden; defaults off. */
  hideComposerStats: boolean
  /** Whether the composer's primary button carries the context ring; defaults on. */
  contextRingEnabled: boolean
  /** What each face holds in the local cache; a face absent from it has downloaded nothing. */
  cache: FontCacheReport
  /**
   * What each field's last write from this page is doing. A field with no entry
   * has not been written here, which is every field on a freshly opened page.
   */
  save: Readonly<Partial<Record<keyof BeautifySettings, SaveState>>>
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
   * choice that belongs to no font role, and because quick replies use both
   * a phrase list and a boolean visibility setting.
   */
  choose: (key: keyof BeautifySettings, value: Writable) => void
  /** Send the value the last failed write for this field carried, again. */
  retry: (key: keyof BeautifySettings) => void
  /** Ask the Host what the cache holds and publish the answer. */
  refreshCache: () => void
}

/** Owner handle over the `ui-beautify` namespace and its cache read-out. */
export class SettingsController {
  private readonly store: SnapshotStore<SettingsRowState>
  private readonly unsubscribe: () => void
  private cache: FontCacheReport = {}
  private pending: ReturnType<typeof setTimeout> | undefined
  /** The read a second caller joins instead of asking the Host again. */
  private reading: Promise<void> | undefined
  /** Font choices the cache read was last scheduled for. */
  private fonts: { body: string; code: string }
  /** What each field's newest write is doing, and which attempt owns it. */
  private readonly save = new Map<keyof BeautifySettings, SaveState>()
  private readonly attempts = new Map<keyof BeautifySettings, { token: number; value: Writable }>()
  private readonly notes = new Map<keyof BeautifySettings, ReturnType<typeof setTimeout>>()
  private token = 0

  /**
   * @param scope - the `ui-beautify` configuration form.
   */
  constructor(private readonly scope: ConfigForm<BeautifySettings>) {
    this.store = createSnapshotStore(this.projection())
    this.fonts = this.fontChoices()
    this.unsubscribe = scope.subscribe(() => {
      this.publish()
      // Only a face choice starts a download. Anything else in this namespace —
      // a switch, a phrase, a brand image — would otherwise schedule a walk of
      // the font directory that no answer could change.
      if (this.fontChoicesMoved()) this.scheduleCacheRead()
    })
  }

  /** Stop observing settings and drop the pending cache read and save notes. */
  dispose(): void {
    this.unsubscribe()
    if (this.pending !== undefined) clearTimeout(this.pending)
    for (const note of this.notes.values()) clearTimeout(note)
    this.notes.clear()
  }

  /**
   * Build the renderer face every settings row shares.
   * @returns its hooks and writers.
   */
  inject(): SettingsRowFace {
    return {
      hooks: { beautify: this.store },
      choose: (key, value) => { this.write(key, value, false) },
      retry: (key) => { this.retry(key) },
      refreshCache: () => { this.refreshCache() },
    }
  }

  /** Read the cache once and publish what it holds. */
  refreshCache(): void {
    void this.readOnce()
  }

  /**
   * Join the read already in flight, or start one.
   *
   * Both font rows ask when they mount, and a font choice asks again shortly
   * after; the Host answer is one reading of one directory, so the callers share
   * it rather than queueing their own.
   * @returns the read every caller of this burst shares.
   */
  private readOnce(): Promise<void> {
    this.reading ??= this.read().finally(() => { this.reading = undefined })
    return this.reading
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

  /** The face each role resolves to right now. */
  private fontChoices(): { body: string; code: string } {
    const value = this.scope.getSnapshot().value
    return {
      body: resolveFontChoice(value?.font, 'body'),
      code: resolveFontChoice(value?.codeFont, 'code'),
    }
  }

  /**
   * Whether a face choice moved since the last check.
   * @returns whether the cache is worth reading again.
   */
  private fontChoicesMoved(): boolean {
    const next = this.fontChoices()
    const moved = next.body !== this.fonts.body || next.code !== this.fonts.code
    this.fonts = next
    return moved
  }

  /**
   * Send one value the value a row asked for.
   * @param key - the namespace field.
   * @param value - the value to store.
   * @param force - send it even when it equals the stored value, for a retry.
   */
  private write(key: keyof BeautifySettings, value: Writable, force: boolean): void {
    const snapshot = this.scope.getSnapshot()
    if (snapshot.status !== 'ready' || !snapshot.writable) return
    // Compared against the newest value this row asked for rather than the
    // stored one: while a write is in flight the store has not caught up yet, so
    // a second click on the same choice would otherwise be sent a second time.
    const last = this.attempts.get(key)?.value ?? snapshot.value?.[key]
    if (!force && sameValue(last, value)) return
    const token = ++this.token
    this.attempts.set(key, { token, value })
    this.setSave(key, 'saving')
    // The form queues writes in order and fences each on the latest revision, so
    // a newer value supersedes this one at the Host; what this settles is only
    // the note the row shows.
    this.scope.set(key, value).then(
      accepted => { this.settle(key, token, accepted) },
      () => { this.settle(key, token, false) },
    )
  }

  /** Re-send the value whose write failed. */
  private retry(key: keyof BeautifySettings): void {
    const attempt = this.attempts.get(key)
    if (attempt === undefined || this.save.get(key) !== 'error') return
    this.write(key, attempt.value, true)
  }

  /**
   * Record how one attempt settled, unless a newer one owns the field.
   * @param key - the namespace field.
   * @param token - the attempt this settlement belongs to.
   * @param accepted - whether the Host took the write.
   */
  private settle(key: keyof BeautifySettings, token: number, accepted: boolean): void {
    if (this.attempts.get(key)?.token !== token) return
    this.setSave(key, accepted ? 'saved' : 'error')
    if (!accepted) return
    const note = this.notes.get(key)
    if (note !== undefined) clearTimeout(note)
    this.notes.set(key, setTimeout(() => {
      this.notes.delete(key)
      if (this.save.get(key) !== 'saved') return
      this.save.delete(key)
      this.publish()
    }, SAVED_NOTE_MS))
  }

  /**
   * Publish one field's new write state.
   * @param key - the namespace field.
   * @param state - what its newest write is doing.
   */
  private setSave(key: keyof BeautifySettings, state: SaveState): void {
    this.save.set(key, state)
    this.publish()
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
        logo: value?.logo !== undefined,
        brandIcon: value?.brandIcon !== undefined,
        brandName: value?.brandName !== undefined,
        tagline: value?.tagline !== undefined,
        quickReplies: value?.quickReplies !== undefined,
        quickRepliesEnabled: value?.quickRepliesEnabled !== undefined,
        mobileLayoutEnabled: value?.mobileLayoutEnabled !== undefined,
        recentSessionsEnabled: value?.recentSessionsEnabled !== undefined,
        remoteSettingsEnabled: value?.remoteSettingsEnabled !== undefined,
        scrollToPromptEnabled: value?.scrollToPromptEnabled !== undefined,
        sessionStartChipEnabled: value?.sessionStartChipEnabled !== undefined,
        streamlinedUiEnabled: value?.streamlinedUiEnabled !== undefined,
        hideComposerStats: value?.hideComposerStats !== undefined,
        contextRingEnabled: value?.contextRingEnabled !== undefined,
      },
      // The document is hand-editable, so an unknown stored value must show as
      // the choice actually in effect rather than as nothing selected.
      font: resolveFontChoice(value?.font, 'body'),
      codeFont: resolveFontChoice(value?.codeFont, 'code'),
      motion: resolveMotionChoice(value?.motion),
      logo: value?.logo ?? '',
      brandIcon: value?.brandIcon ?? '',
      brandName: value?.brandName ?? '',
      tagline: value?.tagline ?? '',
      // Slots rather than phrases: the settings row edits positions, and the
      // dock drops the blanks itself.
      quickReplies: quickReplySlots(value?.quickReplies),
      quickRepliesEnabled: value?.quickRepliesEnabled !== false,
      mobileLayoutEnabled: value?.mobileLayoutEnabled !== false,
      recentSessionsEnabled: value?.recentSessionsEnabled !== false,
      remoteSettingsEnabled: value?.remoteSettingsEnabled !== false,
      scrollToPromptEnabled: value?.scrollToPromptEnabled !== false,
      sessionStartChipEnabled: value?.sessionStartChipEnabled !== false,
      // Off unless the document says otherwise: this switch takes host surfaces
      // away, so an unread or absent field must leave them in place.
      streamlinedUiEnabled: value?.streamlinedUiEnabled === true,
      // Same default: an unread or absent field keeps the readings visible.
      hideComposerStats: value?.hideComposerStats === true,
      // On unless the document says otherwise, like every other default-on row.
      contextRingEnabled: value?.contextRingEnabled !== false,
      cache: this.cache,
      save: this.saveStates(),
    }
  }

  /** The write states as a plain object, for the rows that read the snapshot. */
  private saveStates(): Partial<Record<keyof BeautifySettings, SaveState>> {
    const states: Partial<Record<keyof BeautifySettings, SaveState>> = {}
    for (const [key, state] of this.save) states[key] = state
    return states
  }

  private publish(): void {
    this.store.set(this.projection())
  }
}
