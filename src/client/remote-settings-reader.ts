/** Shared redacted Host settings reader. It has no credential, document-opening or write transport. */
export interface RemoteNamespace {
  ns: string
  value: unknown
  base?: unknown
  user?: unknown
  revision?: number
  schema?: unknown
  [key: string]: unknown
}
export interface RemoteSettingsView {
  namespaces: readonly RemoteNamespace[]
  writable: boolean
  hasDocument: boolean
}
export interface ReadonlySettingsSnapshot {
  status: 'idle' | 'loading' | 'ready' | 'unavailable'
  view: RemoteSettingsView | undefined
  error: string | null
}
export interface ReadonlyFormSnapshot {
  status: 'loading' | 'ready' | 'unavailable'
  value: unknown
  base: unknown
  user: unknown
  revision: number | undefined
  writable: false
  mode: 'memory'
}

export function createRemoteSettingsReader(read: () => Promise<RemoteSettingsView>) {
  let snapshot: ReadonlySettingsSnapshot = { status: 'idle', view: undefined, error: null }
  const listeners = new Set<() => void>()
  const forms = new Map<string, { source: ReadonlySettingsSnapshot; snapshot: ReadonlyFormSnapshot }>()
  let pending: Promise<void> | undefined
  let rerun = false
  let disposed = false
  const publish = (next: ReadonlySettingsSnapshot): void => {
    if (disposed) return
    snapshot = next
    for (const listener of listeners) listener()
  }
  async function refresh(): Promise<void> {
    if (disposed) return
    if (pending) { rerun = true; return pending }
    const work = async (): Promise<void> => {
      do {
        rerun = false
        if (!snapshot.view) publish({ ...snapshot, status: 'loading' })
        try {
          const received = await read()
          if (!received || !Array.isArray(received.namespaces)) throw new Error('settings describe returned no namespaces')
          // Never advertise Host writability or local document operations to the remote page.
          publish({ status: 'ready', view: { ...received, writable: false, hasDocument: false }, error: null })
        } catch (error) {
          publish({ ...snapshot, status: snapshot.view ? 'ready' : 'unavailable',
            error: error instanceof Error ? error.message : String(error) })
        }
      } while (rerun && !disposed)
    }
    pending = work()
    try { await pending } finally { pending = undefined }
  }
  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe,
    refresh,
    ensure: () => snapshot.view ? Promise.resolve() : refresh(),
    formSnapshot(namespace: string): ReadonlyFormSnapshot {
      const held = forms.get(namespace)
      if (held?.source === snapshot) return held.snapshot
      const row = snapshot.view?.namespaces.find(item => item.ns === namespace)
      const next: ReadonlyFormSnapshot = { status: row ? 'ready' : snapshot.status === 'loading' || snapshot.status === 'idle' ? 'loading' : 'unavailable',
        value: row?.value, base: row?.base, user: row?.user, revision: row?.revision, writable: false, mode: 'memory' }
      forms.set(namespace, { source: snapshot, snapshot: next })
      return next
    },
    dispose() { disposed = true; rerun = false; listeners.clear(); forms.clear() },
  }
}
