/** Optional brand occupants. An empty setting leaves the host's own slot intact. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { BeautifySettings } from '../fonts.ts'

type BrandField = 'logo' | 'brandIcon' | 'brandName'

/** Accept web images and same-origin absolute paths; reject script and file URLs. */
export function imageUrl(value: string | undefined): string {
  const url = value?.trim() ?? ''
  if (/^https?:\/\/\S+$/i.test(url)) return url
  if (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\') && !/\s/.test(url)) return url
  return ''
}

function selected(value: Partial<BeautifySettings> | undefined, field: BrandField): string {
  if (field === 'brandName') return value?.brandName?.trim() ?? ''
  return imageUrl(value?.[field])
}

/** Shadow the official sidebar occupant only while a custom value is present. */
export function applyBranding(ctx: Context, scope: ConfigForm<BeautifySettings>): void {
  const install = (slot: 'conversation.hero.brand.mark' | 'sidebar.brand.mark' | 'sidebar.brand.name', field: BrandField): void => {
    ctx.slots.inject(slot, () => {
      let current = ''
      let release: (() => void) | undefined
      const sync = (): void => {
        const next = selected(scope.getSnapshot().value, field)
        if (next === current) return
        release?.()
        release = undefined
        current = next
        if (next === '') return
        if (slot === 'conversation.hero.brand.mark') {
          release = ctx.slots.register({ name: slot, priority: -1 }, ({ size, className }) =>
            <img src={next} alt="" aria-hidden="true" className={className} style={{ width: size, height: size, objectFit: 'contain' }} />)
        } else if (slot === 'sidebar.brand.mark') {
          release = ctx.slots.register({ name: slot, priority: -1 }, ({ size }) =>
            <img src={next} alt="" aria-hidden="true" style={{ width: size, height: size, objectFit: 'contain' }} />)
        } else {
          release = ctx.slots.register({ name: slot, priority: -1 }, () =>
            <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{next}</span>)
        }
      }
      sync()
      const unsubscribe = scope.subscribe(sync)
      return () => { unsubscribe(); release?.() }
    })
  }
  install('conversation.hero.brand.mark', 'logo')
  install('sidebar.brand.mark', 'brandIcon')
  install('sidebar.brand.name', 'brandName')
}
