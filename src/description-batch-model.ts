/** One model call translates a whole byte-bounded batch; validates IDs before any cache write. */
import type { LlmRuntime, GenerateOptions } from '@deepseek-ai/dsh-llm'
import type { DescriptionEntry } from './description-translations.ts'
import { validateDescriptionTranslationText } from './description-translations.ts'
import { DESCRIPTION_BATCH_MAX_BYTES, DESCRIPTION_BATCH_SYSTEM, descriptionBatchBytes, descriptionBatchPayload } from './description-batches.ts'

export async function translateDescriptionBatchWithModel(
  llm: Pick<LlmRuntime, 'stream'>, selection: Pick<GenerateOptions, 'provider' | 'model' | 'reasoningEffort'>,
  entries: readonly DescriptionEntry[], language: string, signal: AbortSignal,
): Promise<readonly string[]> {
  if (!selection.provider || !selection.model) throw new Error('Default model is not configured')
  if (!entries.length) return []
  if (descriptionBatchBytes(entries, language) > DESCRIPTION_BATCH_MAX_BYTES) throw new Error('Batch exceeds byte limit')
  const blocks = new Map<number, string>()
  const maxOutputBytes = 128 * 1024
  const encoder = new TextEncoder()
  let finished = false
  let size = 0
  for await (const chunk of llm.stream({ ...selection, signal, maxTokens: 16384,
    system: DESCRIPTION_BATCH_SYSTEM,
    messages: [{ role: 'user', content: [{ type: 'text', text: descriptionBatchPayload(entries, language) }] }],
  })) {
    signal.throwIfAborted()
    if (finished) throw new Error('Model emitted data after completion')
    if ((chunk.type === 'block-start' && chunk.blockType === 'tool-call')
      || (chunk.type === 'block-end' && chunk.block.type === 'tool-call') || chunk.type === 'tool-call-delta') throw new Error('Unexpected tool request')
    if (chunk.type === 'text-delta') {
      size += encoder.encode(chunk.text).byteLength
      if (size > maxOutputBytes) throw new Error('Batch output is too large')
      blocks.set(chunk.index, (blocks.get(chunk.index) ?? '') + chunk.text)
    } else if (chunk.type === 'block-end' && chunk.block.type === 'text') {
      blocks.set(chunk.index, chunk.block.text)
      if (encoder.encode([...blocks.values()].join('')).byteLength > maxOutputBytes) throw new Error('Batch output is too large')
    } else if (chunk.type === 'finish') {
      if (chunk.reason.kind !== 'stop') throw new Error(`Batch translation did not complete: ${chunk.reason.kind}`)
      finished = true
    }
  }
  if (!finished) throw new Error('Incomplete batch translation')
  const text = [...blocks.entries()].sort(([a], [b]) => a - b).map(([, value]) => value).join('')
  const parsed: unknown = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as Record<string, unknown>).translations)) throw new Error('Invalid translation batch')
  const rows = (parsed as { translations: unknown[] }).translations
  if (rows.length !== entries.length) throw new Error('Translation count mismatch')
  const output = new Map<number, string>()
  for (const row of rows) {
    if (!row || typeof row !== 'object') throw new Error('Invalid translation item')
    const value = row as Record<string, unknown>
    if (typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id < 0 || value.id >= entries.length || output.has(value.id)) throw new Error('Invalid or duplicate translation ID')
    output.set(value.id, validateDescriptionTranslationText(value.text))
  }
  return entries.map((_, id) => output.get(id)!)
}
