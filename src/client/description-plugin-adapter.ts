/** Read-only plugin metadata projection, never a generic locale/title override. */
import type { Context } from '@deepseek-ai/cordis'
import type { DescriptionController } from './description-controller.ts'

type Text = string | Readonly<Record<string, string>>
interface Meta { title?: Text; description?: Text; [key: string]: unknown }
interface Row { moduleName: string; meta?: Meta; [key: string]: unknown }
interface Bundle { name: string; meta?: Meta; rows?: readonly Row[]; [key: string]: unknown }

export function translatedPluginMeta(meta: Meta | undefined, id: string, controller: DescriptionController): Meta | undefined {
  if (!meta?.description) return meta
  const language = controller.getSnapshot().language
  const text = meta.description
  if (typeof text !== 'string' && Object.keys(text).some(key => key.toLowerCase() === language.toLowerCase() || key.toLowerCase() === language.split('-')[0]!.toLowerCase())) return meta
  const source = typeof text === 'string' ? text : text.en
  if (!source) return meta
  const translated = controller.resolve('plugin', source, id)
  if (translated === source) return meta
  return { ...meta, description: { ...(typeof text === 'string' ? { en: text } : text), [language.toLowerCase()]: translated } }
}

/** Project only description fields and preserve technical identities, titles, switches and host errors. */
export function projectPluginResponse(result: any, bundles: boolean, controller: DescriptionController): any {
  if (!result?.ok || !Array.isArray(result.value)) return result
  return { ...result, value: result.value.map((item: Bundle | Row) => bundles ? {
    ...item, meta: translatedPluginMeta(item.meta, (item as Bundle).name, controller),
    rows: (item as Bundle).rows?.map(row => ({ ...row, meta: translatedPluginMeta(row.meta, row.moduleName, controller) })),
  } : { ...item, meta: translatedPluginMeta(item.meta, (item as Row).moduleName, controller) }) }
}

export function installPluginDescriptionAdapter(ctx: Context, controller: DescriptionController): void {
  ctx.inject(['remote.pluginManager'], child => {
    const remote = child.get('remote.pluginManager') as unknown as { listBundles: (...args: any[]) => Promise<any> }
    if (typeof remote.listBundles !== 'function') return
    const descriptor = Object.getOwnPropertyDescriptor(remote, 'listBundles')
    const original = remote.listBundles.bind(remote)
    let disposed = false
    const replacement = async (...args: any[]): Promise<any> => {
      const result = await original(...args)
      return disposed ? result : projectPluginResponse(result, true, controller)
    }
    Object.defineProperty(remote, 'listBundles', { configurable: true, writable: true, value: replacement })
    child.effect(() => () => {
      disposed = true
      if (Object.getOwnPropertyDescriptor(remote, 'listBundles')?.value === replacement) {
        if (descriptor) Object.defineProperty(remote, 'listBundles', descriptor)
        else Reflect.deleteProperty(remote, 'listBundles')
      }
    }, 'ui-beautify: plugin bundle descriptions')
    const slots = child.get('slots')!
    let revision = controller.getSnapshot().revision
    child.effect(() => controller.subscribe(() => {
      const next = controller.getSnapshot().revision
      if (next === revision) return
      revision = next
      // Public root registration face; no retained entry mutation or child-slot shadow.
      const entry = slots.entries('main').find(entry => entry.options.key === 'plugins'
        && (entry.registrant?.includes('ui-plugin-manager') || (typeof entry.component === 'function' && entry.component.name === 'PluginManagerPage')))
      const face = entry?.inject?.()
      const refresh = face?.refresh
      if (typeof refresh === 'function') refresh()
    }), 'ui-beautify: refresh plugin descriptions')
  })
  ctx.inject(['remote.pluginInventory'], child => {
    const remote = child.get('remote.pluginInventory') as unknown as { list: (...args: any[]) => Promise<any> }
    if (typeof remote.list !== 'function') return
    const descriptor = Object.getOwnPropertyDescriptor(remote, 'list')
    const original = remote.list.bind(remote)
    let disposed = false
    const replacement = async (...args: any[]): Promise<any> => {
      const result = await original(...args)
      if (disposed || !result?.ok || !Array.isArray(result.value?.entries)) return result
      return { ...result, value: { ...result.value,
        entries: projectPluginResponse({ ok: true, value: result.value.entries }, false, controller).value } }
    }
    Object.defineProperty(remote, 'list', { configurable: true, writable: true, value: replacement })
    child.effect(() => () => {
      disposed = true
      if (Object.getOwnPropertyDescriptor(remote, 'list')?.value === replacement) {
        if (descriptor) Object.defineProperty(remote, 'list', descriptor)
        else Reflect.deleteProperty(remote, 'list')
      }
    }, 'ui-beautify: plugin row descriptions')
  })
}
