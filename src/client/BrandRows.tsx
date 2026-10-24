/** Image-upload controls and the sidebar name field on this plugin's page. */
import type { ChangeEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { observeComposition } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { BRAND_ROUTE, MAX_BRAND_IMAGE_BYTES } from '../params.ts'
import type { SettingsRowFace, SettingsRowState } from './settings-controller.ts'
import { imageUrl } from './branding.tsx'
import { hostBrandName, hostTagline } from './host-defaults.ts'
import { NS } from './locales.ts'
import { SaveNote } from './SaveNote.tsx'
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
  const { useBeautify, t, choose, retry } = props
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
      // The file is stored; the address still has to reach the settings
      // document, and the note below reports that write rather than letting the
      // row look settled the moment the upload returns.
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
        <SaveNote state={state} field={field} t={t} retry={retry} />
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

/**
 * The host text a text row reports while its setting is empty.
 *
 * The hint describes what the interface currently shows, so it comes from the
 * host's rendered content rather than a copied default: a deployment build
 * embeds its own tagline and product name, and those change without this
 * plugin. The read repeats once the setting becomes empty — the plugin releases
 * its occupant and the host repaints its own a moment later — and reports
 * nothing while that host surface is not mounted.
 * @param field - which host surface the row describes.
 * @param empty - whether the stored setting is empty.
 * @returns the host text, or '' while the setting has a value or the surface is absent.
 */
function useHostHint(field: 'brandName' | 'tagline', empty: boolean): string {
  const read = field === 'brandName' ? hostBrandName : hostTagline
  const [hint, setHint] = useState(() => empty ? read() : '')
  useEffect(() => {
    if (!empty) { setHint(''); return }
    setHint(read())
    // The occupant swap commits after the setting does; one more read once the
    // host has painted keeps the hint from naming the value just released.
    let frame = 0
    if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(() => { setHint(read()) })
    return () => { if (frame !== 0) cancelAnimationFrame(frame) }
  }, [empty, read])
  return empty ? hint : ''
}

function TextRow({ field, ...props }: BrandRowProps & { field: 'brandName' | 'tagline' }): ReactNode {
  const { useBeautify, t, choose, retry } = props
  const state = useBeautify(snapshot => snapshot)
  const input = useRef<HTMLInputElement>(null)
  // The host's composition observer: the same guard the host's own text fields,
  // menus and shortcut recorder use. It also swallows the closing keydown a
  // browser sends right after `compositionend`, which an inline check for
  // `isComposing`/229 alone cannot see.
  const composition = useRef<ReturnType<typeof observeComposition> | null>(null)
  const title = t(field === 'brandName' ? 'brandNameTitle' : 'taglineTitle')
  const disabled = !state.available || !state.writable || !state.fields[field]
  const stored = state[field]
  const hint = useHostHint(field, stored.trim() === '')
  const placeholder = hint === '' ? '' : field === 'brandName' ? t('namePlaceholder', { name: hint }) : hint

  useEffect(() => {
    const guard = observeComposition(document)
    composition.current = guard
    return () => { guard.dispose(); composition.current = null }
  }, [])

  // The stored value follows the write, and a write follows a blur, so this only
  // lands while the field is not being typed into. The element is deliberately
  // not keyed by the value: a key that moves would remount the field and drop
  // both the draft and the focus, and a focused field is never overwritten here
  // even when the Host republishes.
  useEffect(() => {
    const node = input.current
    if (node === null || node === document.activeElement) return
    if (node.value !== stored) node.value = stored
  }, [stored])

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{title}</div>
        <div className={css.desc}>{t(field === 'brandName' ? 'brandNameDesc' : 'taglineDesc')}</div>
        <div className={css.meta}>{detail(state, field, t)}</div>
        <SaveNote state={state} field={field} t={t} retry={retry} />
      </div>
      <input
        ref={input}
        className={css.textInput}
        type="text"
        aria-label={title}
        placeholder={placeholder}
        defaultValue={stored}
        maxLength={field === 'brandName' ? 80 : 120}
        disabled={disabled}
        // A blur commits whatever the field holds. The guard is deliberately not
        // applied here: it is true for a composition that just ended, and the blur
        // that follows a confirmed candidate is exactly when the finished value
        // must be saved. Enter is where a half-composed value would otherwise be
        // committed, so that is where the guard belongs.
        onBlur={event => { choose(field, event.currentTarget.value.trim()) }}
        onKeyDown={event => {
          if (event.key !== 'Enter') return
          if (composition.current?.guards(event.nativeEvent) === true) return
          event.currentTarget.blur()
        }}
      />
    </div>
  )
}

export function BrandNameRow(props: BrandRowProps): ReactNode { return <TextRow field="brandName" {...props} /> }
export function TaglineRow(props: BrandRowProps): ReactNode { return <TextRow field="tagline" {...props} /> }
