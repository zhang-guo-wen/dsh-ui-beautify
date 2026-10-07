import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-remotes/types'
import type {} from '@deepseek-ai/dsh-client-connection'
import type { ConfigForm, ConfigForms, SettingsDescribeFace } from '@deepseek-ai/dsh-client-ui-settings/client'
import { createRemoteSettingsReader, type RemoteSettingsView } from './remote-settings-reader.ts'

/** Decorate only public settings read/form methods on remote pages; never change Host identity or RPC permission. */
export function installRemoteSettings(ctx: Context): { ready: Promise<void>; dispose(): void } | undefined {
  const remote = ctx.get('remote')
  if (!remote || remote.$host.isLoopback) return undefined
  const api = ctx.get('remote.settings')
  if (!api) throw new Error('ui-beautify: shared settings read service is unavailable')
  const owner = ctx.get('configForms')!
  const reader = createRemoteSettingsReader(async () => {
    const result = await api.describe()
    if (!result.ok) throw new Error(result.error.message)
    return result.value as RemoteSettingsView
  })
  const restore: (() => void)[] = []
  function replace(object: object, name: string, value: unknown): void {
    const previous = Object.getOwnPropertyDescriptor(object, name)
    Object.defineProperty(object, name, { configurable: true, writable: true, value })
    restore.push(() => { if (previous) Object.defineProperty(object, name, previous); else Reflect.deleteProperty(object, name) })
  }
  const originalGet = owner.get.bind(owner)
  const patched = new WeakSet<object>()
  const get: ConfigForms['get'] = <T,>(namespace: string): ConfigForm<T> => {
    const form = originalGet<T>(namespace)
    if (!patched.has(form)) {
      patched.add(form)
      replace(form, 'getSnapshot', () => reader.formSnapshot(namespace))
      replace(form, 'subscribe', reader.subscribe)
      // The shared reader never calls any write API, including direct form-method calls.
      for (const method of ['set', 'unset', 'mutate']) replace(form, method, () => Promise.resolve(false))
    }
    return form
  }
  const face: SettingsDescribeFace = { getSnapshot: reader.getSnapshot, subscribe: reader.subscribe,
    ensure: reader.ensure, acceptView: () => {} }
  replace(owner, 'get', get)
  replace(owner, 'describe', () => face)
  replace(owner, 'whileServed', (namespaces: readonly string[], register: (served: ReadonlySet<string>) => () => void) => {
    let release: (() => void) | undefined
    const sync = (): void => {
      const served = new Set(reader.getSnapshot().view?.namespaces.map(row => row.ns) ?? [])
      if (namespaces.some(ns => served.has(ns))) { release ??= register(served) }
      else { release?.(); release = undefined }
    }
    const off = reader.subscribe(sync)
    sync()
    return () => { off(); release?.() }
  })
  // Patch cached forms using the public namespace directory, not provider-private maps or stores.
  const offForms = reader.subscribe(() => {
    for (const row of reader.getSnapshot().view?.namespaces ?? []) get(row.ns)
  })
  const refresh = (): void => { void reader.refresh() }
  // Installed Host publishes this event; older development declarations omit its settings augmentation.
  const onSettings = remote.$on.bind(remote) as unknown as (event: 'settings/document-updated', callback: () => void) => () => void
  const offUpdated = onSettings('settings/document-updated', refresh)
  const offReset = ctx.on('connection/reset', refresh)
  const onVisible = (): void => { if (document.visibilityState === 'visible') refresh() }
  document.addEventListener('visibilitychange', onVisible)
  let disposed = false
  return {
    ready: reader.ensure(),
    dispose() {
      if (disposed) return
      disposed = true
      offUpdated(); offReset(); offForms()
      document.removeEventListener('visibilitychange', onVisible)
      reader.dispose()
      for (const undo of restore.reverse()) undo()
    },
  }
}
