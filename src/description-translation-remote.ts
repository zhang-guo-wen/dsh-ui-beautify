/** Explicit, validated RPC contribution for an independently installed plugin. */
import type { InvocationDescriptor, TypertCodec, TypertSchema, TypertRemoteContribution, RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { canonicalDescriptionLanguage, validateDescriptionEntry, validateDescriptionTranslationText, validateDescriptionTranslationRequest, type DescriptionEntry } from './description-translations.ts'
import type { DescriptionCatalog, DescriptionCatalogRequest } from './description-translation-service.ts'
import type { DescriptionTranslationBatch } from './description-translations.ts'

export const DESCRIPTION_NAMESPACE = 'uiBeautifyDescriptions'
export interface DescriptionRemote {
  catalog(request: DescriptionCatalogRequest, signal?: AbortSignal): Promise<RemoteResult<DescriptionCatalog>>
  lookup(request: { language: string; entries: DescriptionEntry[] }, signal?: AbortSignal): Promise<RemoteResult<DescriptionTranslationBatch>>
  translate(request: { language: string; entries: DescriptionEntry[] }, signal?: AbortSignal): Promise<RemoteResult<DescriptionTranslationBatch>>
}

function catalog(value: unknown): DescriptionCatalogRequest {
  if (!value || typeof value !== 'object') throw new Error('Invalid catalog request')
  const request = value as Record<string, unknown>
  if (request.sessionId !== undefined && (typeof request.sessionId !== 'string' || !request.sessionId || request.sessionId.length > 200)) throw new Error('Invalid session identity')
  if (request.allWorkspaces !== undefined && typeof request.allWorkspaces !== 'boolean') throw new Error('Invalid workspace scope')
  return { language: canonicalDescriptionLanguage(request.language), ...(request.sessionId === undefined ? {} : { sessionId: request.sessionId as string }),
    ...(request.allWorkspaces === undefined ? {} : { allWorkspaces: request.allWorkspaces }) }
}
export function validateDescriptionResponse(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid translation response')
  const response = value as Record<string, unknown>
  if (Array.isArray(response.results)) {
    canonicalDescriptionLanguage(response.language)
    if (response.results.length > 200) throw new Error('Translation response is too large')
    for (const result of response.results) {
      if (!result || typeof result !== 'object') throw new Error('Invalid translation item')
      const item = result as Record<string, unknown>
      validateDescriptionEntry(item.entry)
      if (item.status === 'cached' || item.status === 'translated') {
        const record = item.record as Record<string, unknown>
        validateDescriptionEntry(record)
        canonicalDescriptionLanguage(record.language)
        validateDescriptionTranslationText(record.text)
        if (typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt))) throw new Error('Invalid translation timestamp')
      } else if (item.status !== 'missing' && item.status !== 'error') throw new Error('Invalid translation status')
    }
  } else if (Array.isArray(response.entries)) {
    if (response.entries.length > 10000 || typeof response.available !== 'boolean' || !Array.isArray(response.warnings)) throw new Error('Invalid description catalog')
    for (const entry of response.entries) validateDescriptionEntry(entry)
  } else throw new Error('Unknown translation response')
  return value
}
function codec(symbol: string, parse: (value: unknown) => unknown): TypertCodec {
  const schema: TypertSchema<unknown> = { parse }
  return { mode: 'strict', typeSymbol: symbol, schema, create: () => schema } as TypertCodec
}
function descriptor(method: string): InvocationDescriptor {
  const owner = `@guowenzhang/dsh-ui-beautify#${DESCRIPTION_NAMESPACE}/${method}`
  return { id: owner, service: DESCRIPTION_NAMESPACE, namespace: DESCRIPTION_NAMESPACE, method,
    invocation: { kind: 'direct' }, cancellation: { parameter: 'signal' },
    parameters: [{ name: 'request', wire: 'request', source: 'json', codec: codec(`${owner}:request`, method === 'catalog' ? catalog : validateDescriptionTranslationRequest) }],
    result: codec(`${owner}:result`, validateDescriptionResponse) }
}
export const DESCRIPTION_REMOTE: TypertRemoteContribution = {
  package: '@guowenzhang/dsh-ui-beautify', descriptors: ['catalog', 'lookup', 'translate'].map(descriptor),
}
