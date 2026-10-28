/** The running-indicator rows: its phrase, its mark, and the mark's switch. */
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { observeComposition, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { BRAND_ROUTE, MAX_BRAND_IMAGE_BYTES } from '../params.ts'
import { imageUrl } from './image-url.ts'
import { NS } from './locales.ts'
import { rowToggle } from './row-toggle.ts'
import { SaveNote } from './SaveNote.tsx'
import type { SettingsRowFace } from './settings-controller.ts'
import css from './SettingRow.module.css'

type Props = PropsLocale<typeof NS> & InjectFace<SettingsRowFace>

/** Image types the mark uploader accepts; the host serves them back by URL. */
const MARK_IMAGE_ACCEPT = 'image/png,image/apng,image/webp,image/gif'

/**
 * The phrase row: what the running indicator says instead of the host's copy.
 *
 * Text is committed on blur rather than per keystroke for the same reason the
 * brand rows do: the value is a settings write, and a write per character would
 * churn the Host document while the user is still typing.
 * @param props - row face and copy.
 * @returns the phrase row.
 */
export function RunningStatusTextRow(props: Props): ReactNode {
  const { useBeautify, t, choose, retry } = props
  const state = useBeautify(snapshot => snapshot)
  const input = useRef<HTMLInputElement>(null)
  const composition = useRef<ReturnType<typeof observeComposition> | null>(null)
  const disabled = !state.available || !state.writable || !state.fields.runningStatusText
  const stored = state.runningStatusText
  const detail = !state.available ? t('unavailable')
    : !state.writable ? t('readonly')
      : !state.fields.runningStatusText ? t('stale') : ''

  useEffect(() => {
    const guard = observeComposition(document)
    composition.current = guard
    return () => { guard.dispose(); composition.current = null }
  }, [])

  // Untouched while focused: a republished value must not overwrite a draft.
  useEffect(() => {
    const node = input.current
    if (node === null || node === document.activeElement) return
    if (node.value !== stored) node.value = stored
  }, [stored])

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('runningStatusTextTitle')}</div>
        <div className={css.desc}>{t('runningStatusTextDesc')}</div>
        <div className={css.meta}>{detail}</div>
        <SaveNote state={state} field="runningStatusText" t={t} retry={retry} />
      </div>
      <input
        ref={input}
        className={css.textInput}
        type="text"
        aria-label={t('runningStatusTextTitle')}
        placeholder={t('runningStatusTextPlaceholder')}
        defaultValue={stored}
        maxLength={40}
        disabled={disabled}
        onBlur={event => { choose('runningStatusText', event.currentTarget.value.trim()) }}
        onKeyDown={event => {
          if (event.key !== 'Enter') return
          if (composition.current?.guards(event.nativeEvent) === true) return
          event.currentTarget.blur()
        }}
      />
    </div>
  )
}

/**
 * The mark switch: whether the host's whale is replaced at all.
 *
 * Separate from the image because the built-in animation is the mark a
 * deployment that owns no artwork still gets. Turning the switch off restores
 * the host's own icon without discarding the uploaded image.
 * @param props - row face and copy.
 * @returns the switch row.
 */
export function ReplaceRunningIconRow(props: Props): ReactNode {
  const { useBeautify, t, choose, retry } = props
  const state = useBeautify(snapshot => snapshot)
  const detail = !state.available ? t('unavailable')
    : !state.fields.replaceRunningIcon ? t('stale') : !state.writable ? t('readonly') : ''
  const disabled = !state.available || !state.writable || !state.fields.replaceRunningIcon
  return (
    <div className={css.row} data-beautify-feature="replaceRunningIcon"
      onClick={rowToggle(disabled, () => { choose('replaceRunningIcon', !state.replaceRunningIcon) })}>
      <div className={css.rowText}>
        <div className={css.title}>{t('replaceRunningIconTitle')}</div>
        <div className={css.desc}>{t('replaceRunningIconDesc')}</div>
        <div className={css.meta}>{detail}</div>
        <SaveNote state={state} field="replaceRunningIcon" t={t} retry={retry} />
      </div>
      <Switch checked={state.replaceRunningIcon} label={t('replaceRunningIconTitle')}
        disabled={disabled}
        onChange={enabled => { choose('replaceRunningIcon', enabled) }} />
    </div>
  )
}

/**
 * The mark image row: an uploaded animation shown in place of the whale.
 *
 * The upload route and the size cap are the brand rows': both write one image
 * to the same plugin-owned directory, so a second mechanism would be a second
 * set of limits to keep in step.
 * @param props - row face and copy.
 * @returns the image row.
 */
export function RunningStatusIconRow(props: Props): ReactNode {
  const { useBeautify, t, choose, retry } = props
  const state = useBeautify(snapshot => snapshot)
  const input = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'failed' | 'large'>('idle')
  const url = imageUrl(state.runningStatusIcon)
  const disabled = !state.available || !state.writable || !state.fields.runningStatusIcon || status === 'uploading'
  const detail = !state.available ? t('unavailable')
    : !state.writable ? t('readonly')
      : !state.fields.runningStatusIcon ? t('stale')
        : state.runningStatusIcon.trim() !== '' && url === '' ? t('invalidImageUrl') : ''

  const upload = async (file: File): Promise<void> => {
    if (file.size > MAX_BRAND_IMAGE_BYTES) { setStatus('large'); return }
    setStatus('uploading')
    try {
      const response = await fetch(`${BRAND_ROUTE}/upload/runningStatusIcon`, {
        method: 'POST',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!response.ok) throw new Error(String(response.status))
      const result = await response.json() as { url?: string }
      if (typeof result.url !== 'string' || imageUrl(result.url) === '') throw new Error('invalid upload response')
      choose('runningStatusIcon', result.url)
      // Uploading a mark is the whole point of the switch, so a stored image
      // turns it on rather than leaving the row looking applied but inert.
      if (!state.replaceRunningIcon) choose('replaceRunningIcon', true)
      setStatus('idle')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('runningStatusIconTitle')}</div>
        <div className={css.desc}>{t('runningStatusIconDesc')}</div>
        <div className={css.meta}>
          {status === 'failed' ? t('uploadFailed') : status === 'large' ? t('imageTooLarge') : detail}
        </div>
        <SaveNote state={state} field="runningStatusIcon" t={t} retry={retry} />
      </div>
      <div className={css.imageControl}>
        {url !== '' && <img className={css.preview} src={url} alt="" aria-hidden="true" />}
        <input
          ref={input}
          className={css.fileInput}
          type="file"
          accept={MARK_IMAGE_ACCEPT}
          aria-label={t('runningStatusIconTitle')}
          disabled={disabled}
          onChange={event => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file !== undefined) void upload(file)
          }}
        />
        <button className={css.selector} type="button" disabled={disabled} onClick={() => { input.current?.click() }}>
          {status === 'uploading' ? t('uploading') : t('chooseImage')}
        </button>
        {state.runningStatusIcon !== '' && (
          <button className={css.reset} type="button" disabled={disabled} onClick={() => { choose('runningStatusIcon', '') }}>
            {t('restoreDefault')}
          </button>
        )}
      </div>
    </div>
  )
}
