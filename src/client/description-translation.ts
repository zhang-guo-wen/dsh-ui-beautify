/** Optional feature boot: failure cannot prevent the rest of beautify loading. */
import type { Context } from '@deepseek-ai/cordis'
import { DESCRIPTION_NAMESPACE, DESCRIPTION_REMOTE, type DescriptionRemote } from '../description-translation-remote.ts'
import { DescriptionController, type DescriptionLocale } from './description-controller.ts'
import { installDescriptionAdapters } from './description-adapters.tsx'
import { installPluginDescriptionAdapter } from './description-plugin-adapter.ts'

export function applyDescriptionTranslation(ctx: Context): DescriptionController {
  const locale = ctx.get('locale')! as unknown as DescriptionLocale
  // Installed hosts all supply locale snapshots; fixtures must model this public face.
  const controller = new DescriptionController(undefined, locale)
  const remote = ctx.get('remote')!
  ctx.effect(() => () => controller.dispose(), 'ui-beautify: description cache')
  ctx.effect(() => installDescriptionAdapters(ctx, controller), 'ui-beautify: description display adapters')
  installPluginDescriptionAdapter(ctx, controller)
  const invalidate = (): void => { controller.invalidate(controller.currentSession()) }
  ctx.on('connection/reset', () => controller.reset())
  const on = remote.$on?.bind(remote) as unknown as ((event: string, callback: (...args: any[]) => void) => () => void) | undefined
  if (on) {
    ctx.effect(() => on('agent-preset/selected', (sessionId: string) => controller.invalidate(sessionId)), 'ui-beautify: skill preset invalidation')
    ctx.effect(() => on('plugin-manager/changed', invalidate), 'ui-beautify: plugin description invalidation')
  }
  if (typeof remote.$mount === 'function') {
    void remote.$mount(DESCRIPTION_REMOTE).then(off => {
      ctx.effect(() => off, 'ui-beautify: description Remote')
      const api = ctx.get(`remote.${DESCRIPTION_NAMESPACE}`) as DescriptionRemote | undefined
      controller.connect(api)
    }).catch(() => { controller.connect(undefined) })
  }
  return controller
}
