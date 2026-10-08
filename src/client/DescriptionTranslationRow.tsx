/** Explicit batch operation, separate from volatile preference writes. */
import { useSyncExternalStore, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { DescriptionController } from './description-controller.ts'
import { NS } from './locales.ts'
import css from './SettingRow.module.css'

export function DescriptionTranslationRow({ descriptions, t }: PropsLocale<typeof NS> & { descriptions: DescriptionController }): ReactNode {
  const state = useSyncExternalStore(descriptions.subscribe, descriptions.getSnapshot)
  const status = state.phase === 'unavailable' ? t('translationUnavailable')
    : state.phase === 'loading' ? t('translationLoading')
    : state.phase === 'error' ? t('translationError', { error: state.error })
    : state.phase === 'cancelled' ? t('translationCancelled')
    : state.phase === 'running' ? t('translationRunning')
    : state.failed > 0 ? t('translationFailures', { failed: state.failed }) : ''
  return <div className={css.row} data-description-translation="">
    <div className={css.rowText}>
      <div className={css.title}>{t('translationTitle')}</div>
      <div className={css.desc}>{t('translationDesc')}</div>
      <div className={css.meta}>{state.model ? t('translationModel', { provider: state.model.provider, model: state.model.model,
        effort: state.model.reasoningEffort ? ` · ${state.model.reasoningEffort}` : '' }) : t('translationModelUnknown')}</div>
      {state.model && <div className={css.meta} data-translation-progress="" aria-live="polite">
        {t('translationPluginProgress', state.progress.plugins)} · {t('translationSkillProgress', state.progress.skills)} · {t('translationWorkspaceSkillProgress', state.progress.workspaceSkills)}
      </div>}
      <div className={css.meta} role="status">{status}</div>
      {state.warnings.length > 0 && <div className={css.meta}>{t('translationScopeWarning')}</div>}
    </div>
    <Button type="button" size="sm" variant="outline" disabled={['loading', 'unavailable'].includes(state.phase)}
      onClick={() => { if (state.phase === 'running') descriptions.cancel(); else void descriptions.run() }}>{t(state.phase === 'running' ? 'translationCancel' : 'translationButton')}</Button>
  </div>
}
