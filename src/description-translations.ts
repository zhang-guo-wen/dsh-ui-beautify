/** Browser-safe contract. Descriptions and generated text are inert data, never code. */
export interface DescriptionEntry {
  kind: 'skill' | 'plugin'
  id: string
  source: string
}

export interface TranslationRecord extends DescriptionEntry {
  language: string
  text: string
  /** ISO-8601 timestamp of the first successful, persisted translation. */
  createdAt: string
}

export interface DescriptionTranslationRequest {
  entries: DescriptionEntry[]
  language: string
}

export type DescriptionTranslationErrorCode = 'aborted' | 'timeout' | 'invalid-output' | 'generation-failed' | 'storage-failed'

export type DescriptionTranslationResult =
  | { entry: DescriptionEntry, status: 'cached' | 'translated', record: TranslationRecord }
  | { entry: DescriptionEntry, status: 'missing' }
  | { entry: DescriptionEntry, status: 'error', error: { code: DescriptionTranslationErrorCode, message: string } }

export interface DescriptionTranslationBatch {
  language: string
  model?: { provider: string; model: string; reasoningEffort?: string }
  /** Same order and length as the request, including duplicate entries. */
  results: DescriptionTranslationResult[]
}

/** Length limits use JavaScript UTF-16 code units, matching browser maxLength. */
export const MAX_DESCRIPTION_LENGTH = 4000
export const MAX_DESCRIPTION_ENTRIES = 200
export const MAX_DESCRIPTION_ID_LENGTH = 512
export const MAX_TRANSLATION_LENGTH = 8000
export const MAX_DESCRIPTION_LANGUAGE_LENGTH = 64

/** Strict BCP-47 validation with canonical casing/aliases; no locale fallback. */
export function canonicalDescriptionLanguage(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_DESCRIPTION_LANGUAGE_LENGTH || value !== value.trim()) {
    throw new TypeError('language must be a nonempty BCP-47 tag of at most 64 characters')
  }
  try {
    const language = Intl.getCanonicalLocales(value)[0]
    if (language) return language
  } catch {
    // Return a stable validation error rather than an engine-specific RangeError.
  }
  throw new TypeError('language must be a valid BCP-47 tag')
}

/** Copy only the public fields; preserve source exactly so edits invalidate caches. */
export function validateDescriptionEntry(value: unknown): DescriptionEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('entry must be an object')
  const entry = value as Record<string, unknown>
  if (entry.kind !== 'skill' && entry.kind !== 'plugin') throw new TypeError('entry.kind must be skill or plugin')
  if (typeof entry.id !== 'string' || !entry.id.trim() || entry.id.length > MAX_DESCRIPTION_ID_LENGTH || /[\u0000-\u001f\u007f]/u.test(entry.id)) {
    throw new TypeError('entry.id must be nonempty, without control characters, and at most 512 characters')
  }
  if (typeof entry.source !== 'string' || !entry.source.trim() || entry.source.length > MAX_DESCRIPTION_LENGTH) {
    throw new TypeError('entry.source must be nonempty and at most 4000 characters')
  }
  return { kind: entry.kind, id: entry.id, source: entry.source }
}

/** Reject the entire malformed request before any lookup or generation starts. */
export function validateDescriptionTranslationRequest(value: unknown): DescriptionTranslationRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('request must be an object')
  const request = value as Record<string, unknown>
  const language = canonicalDescriptionLanguage(request.language)
  if (!Array.isArray(request.entries) || request.entries.length > MAX_DESCRIPTION_ENTRIES) {
    throw new TypeError('request.entries must be an array of at most 200 entries')
  }
  // Array.from also validates holes in sparse arrays (Array.map would skip them).
  return { language, entries: Array.from(request.entries, validateDescriptionEntry) }
}

export function validateDescriptionTranslationText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_TRANSLATION_LENGTH || value.includes('\0')) {
    throw new TypeError('translation must be nonempty text of at most 8000 characters without NUL')
  }
  return value.trim()
}

/** Collision-free browser map identity, not a disk key and deliberately not a hash. */
export function descriptionEntryIdentity(value: DescriptionEntry): string {
  const entry = validateDescriptionEntry(value)
  return JSON.stringify([entry.kind, entry.id, entry.source])
}

export function descriptionTranslationIdentity(entry: DescriptionEntry, language: string): string {
  return JSON.stringify([descriptionEntryIdentity(entry), canonicalDescriptionLanguage(language)])
}
