/** Image-upload controls and the sidebar name field on this plugin's page. */
import type { ChangeEvent, ReactNode } from 'react'
import { useRef, useState } from 'react'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { BRAND_ROUTE, MAX_BRAND_IMAGE_BYTES } from '../params.ts'
import type { SettingsRowFace, SettingsRowState } from './settings-controller.ts'
import { imageUrl } from './branding.tsx'
import { NS } from './locales.ts'
import css from './SettingRow.module.css'

export type BrandRowProps = PropsLocale<typeof NS> & InjectFace<SettingsRowFace>
type ImageField = 'logo' | 'brandIcon'

function detail(state: SettingsRowState, field: ImageField | 'brandName' | 'tagline', t: BrandRowProps['t']): string {
  if (!state.available) return t('unavailable')
  if (!state.writable) return t('readonly')
  if (!state.fields[field]) return t('stale')
  if ((field === 'logo' || field === 'brandIcon') && state[field].trim() !== '' && imageUrl(state[field]) === '') return t('invalidImageUrl')
  return ''
}

function ImageRow({ field, ...props }: BrandRowProps & { field: ImageField }): ReactNode {
  const { useBeautify, t, choose } = props
  const state = useBeautify(snapshot => snapshot)
  const input = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'failed' | 'large'>('idle')
  const title = field === 'logo' ? t('logoTitle') : t('brandIconTitle')
  const url = imageUrl(state[field])
  const disabled = !state.available || !state.writable || !state.fields[field] || status === 'uploading'

  const upload = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file === undefined) return
    if (file.size > MAX_BRAND_IMAGE_BYTES) { setStatus('large'); return }
    setStatus('uploading')
    try {
      const response = await fetch(`${BRAND_ROUTE}/upload/${field}`, {
        method: 'POST',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!response.ok) throw new Error(String(response.status))
      const result = await response.json() as { url?: string }
      if (typeof result.url !== 'string' || imageUrl(result.url) === '') throw new Error('invalid upload response')
      choose(field, result.url)
      setStatus('idle')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{title}</div>
        <div className={css.desc}>{t(field === 'logo' ? 'logoDesc' : 'brandIconDesc')}</div>
        <div className={css.meta}>{status === 'failed' ? t('uploadFailed') : status === 'large' ? t('imageTooLarge') : detail(state, field, t)}</div>
      </div>
      <div className={css.imageControl}>
        {url !== '' && <img className={css.preview} src={url} alt="" aria-hidden="true" />}
        <input
          ref={input}
          className={css.fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          aria-label={title}
          disabled={disabled}
          onChange={event => { void upload(event) }}
        />
        <button className={css.selector} type="button" disabled={disabled} onClick={() => { input.current?.click() }}>
          {status === 'uploading' ? t('uploading') : t('chooseImage')}
        </button>
        {state[field] !== '' && <button className={css.reset} type="button" disabled={disabled} onClick={() => { choose(field, '') }}>{t('restoreDefault')}</button>}
      </div>
    </div>
  )
}

export function LogoRow(props: BrandRowProps): ReactNode { return <ImageRow field="logo" {...props} /> }
export function BrandIconRow(props: BrandRowProps): ReactNode { return <ImageRow field="brandIcon" {...props} /> }

function TextRow({ field, ...props }: BrandRowProps & { field: 'brandName' | 'tagline' }): ReactNode {
  const { useBeautify, t, choose } = props
  const state = useBeautify(snapshot => snapshot)
  const title = t(field === 'brandName' ? 'brandNameTitle' : 'taglineTitle')
  const disabled = !state.available || !state.writable || !state.fields[field]
  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{title}</div>
        <div className={css.desc}>{t(field === 'brandName' ? 'brandNameDesc' : 'taglineDesc')}</div>
        <div className={css.meta}>{detail(state, field, t)}</div>
      </div>
      <input
        key={state[field]}
        className={css.textInput}
        type="text"
        aria-label={title}
        placeholder={t(field === 'brandName' ? 'namePlaceholder' : 'taglinePlaceholder')}
        defaultValue={state[field]}
        maxLength={field === 'brandName' ? 80 : 120}
        disabled={disabled}
        onBlur={event => { choose(field, event.currentTarget.value.trim()) }}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }}
      />
    </div>
  )
}

export function BrandNameRow(props: BrandRowProps): ReactNode { return <TextRow field="brandName" {...props} /> }
export function TaglineRow(props: BrandRowProps): ReactNode { return <TextRow field="tagline" {...props} /> }
