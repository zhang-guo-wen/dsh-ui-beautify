/**
 * The composer dock's quick replies: one row of tags in the strip below the
 * composer card, each of which sends its phrase in a single click.
 *
 * The phrases are themselves the messages — clicking a tag submits text the
 * user would otherwise have typed — so they are dictionary entries rather than
 * literals here, and the row offers whichever locale is active.
 *
 * A click writes the phrase into the draft at the caret and then submits, which
 * is the same path the Send button takes; nothing here talks to the Host on its
 * own. Inserting rather than replacing is what keeps a half-typed message from
 * being thrown away by a stray click: over an empty draft the two are the same
 * thing.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/QuickReplies
 */

import type { ReactNode } from 'react'
import { Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the 'conversation.composer.dock' SlotMap entry this plugin
// registers into, plus the session standard seats (useInput, inputActions) the
// renderer hands every session-scope entry.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SettingsKey } from './locales.ts'
import { NS } from './locales.ts'
import css from './QuickReplies.module.css'

/** Full component props. */
export type QuickRepliesProps =
  PropsRuntime<'conversation.composer.dock'>
  & PropsLocale<typeof NS>

/**
 * The phrases offered, in the order they appear.
 *
 * The list runs from the answer to a finished turn through the short
 * acknowledgements to the request for more detail, which is the order they are
 * reached for. Every entry is a whole message, so this is a list of messages
 * rather than a set of controls: adding one is adding a dictionary key here and
 * in `locales.ts`.
 */
const PHRASES: readonly SettingsKey[] = [
  'quickContinue', 'quickOk', 'quickGood', 'quickRetry', 'quickDetail',
]

/**
 * The quick-reply row.
 * @param props - composed slot props.
 * @returns the tags, one per phrase.
 */
export function QuickReplies({ inputActions, useInput, t }: QuickRepliesProps): ReactNode {
  // A submission in flight has already locked the editor, so the tags close
  // with it instead of looking clickable and discarding the click.
  const phase = useInput(state => state.phase)
  const locked = phase === 'adjudicating' || phase === 'submitting'

  /**
   * Send one phrase as this session's next message.
   * @param phrase - the message text the tag carries.
   */
  const send = (phrase: string): void => {
    // A refused insertion means the editor moved under the click or a
    // submission locked it; submitting anyway would send the previous draft.
    if (!inputActions.insertText(phrase, inputActions.captureInsertion())) return
    inputActions.submit()
  }

  return (
    <div className={css.row} role="group" aria-label={t('quickTitle')}>
      {PHRASES.map(key => {
        const phrase = t(key)
        return (
          <Pill
            key={key}
            className={css.tag}
            disabled={locked}
            aria-label={t('quickSend', { text: phrase })}
            onClick={() => { send(phrase) }}
          >
            {phrase}
          </Pill>
        )
      })}
    </div>
  )
}
