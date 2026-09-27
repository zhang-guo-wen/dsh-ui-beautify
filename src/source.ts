/**
 * Fetching one file from the npm CDNs that mirror the font packages.
 *
 * A mirror is a URL template rather than a host, because the two supported
 * registries address the same package-relative path differently: jsDelivr
 * carries the version in the path segment, npmmirror keeps it in a directory.
 * Templates are tried in order until one answers, so a blocked or degraded
 * registry degrades to the next instead of failing the request.
 *
 * Every response is validated before it is returned: a mirror that answers 200
 * with an error page must not reach the cache or the browser.
 *
 * @module @guowenzhang/dsh-ui-beautify/source
 */

import type { FontSource } from './fonts.ts'

/** One package-relative file this plugin wants the bytes of. */
export interface SourceRequest {
  /** The face's package coordinates. */
  source: FontSource
  /** Package-relative path, e.g. `index.css` or `files/inter-latin-wght-normal.woff2`. */
  path: string
}

/**
 * Registries tried in order, as `{package}` / `{version}` / `{path}` templates.
 *
 * npmmirror leads because it is the reachable registry from mainland China,
 * where the interface this plugin dresses usually runs; jsDelivr covers the
 * rest of the world and stays as the fallback.
 */
export const DEFAULT_MIRRORS: readonly string[] = [
  'https://registry.npmmirror.com/{package}/{version}/files/{path}',
  'https://cdn.jsdelivr.net/npm/{package}@{version}/{path}',
]

/** Per-attempt ceiling; a mirror that has not answered by then is skipped. */
export const DOWNLOAD_TIMEOUT_MS = 20_000

/**
 * Largest single file accepted.
 *
 * Every shard of a `unicode-range`-sliced face is far below this; the cap only
 * bounds a mirror that streams something other than the file it was asked for.
 */
export const MAX_FILE_BYTES = 8 * 1024 * 1024

/**
 * A download that no mirror could satisfy.
 *
 * `missing` separates the two answers the HTTP layer owes the browser: a file
 * no mirror has is a 404, while an unreachable or unusable mirror is a 502 and
 * stays retryable.
 */
export class FontDownloadError extends Error {
  /**
   * @param message - what failed, per mirror.
   * @param missing - whether every mirror agreed the file does not exist.
   */
  constructor(message: string, readonly missing: boolean) {
    super(message)
    this.name = 'FontDownloadError'
  }
}

/**
 * Build the request URL for one mirror template.
 * @param template - a mirror entry from {@link DEFAULT_MIRRORS}.
 * @param request - the package coordinates and package-relative path.
 * @returns the absolute URL, with each path segment percent-encoded.
 */
export function mirrorUrl(template: string, request: SourceRequest): string {
  const path = request.path.split('/').map(segment => encodeURIComponent(segment)).join('/')
  return template
    .replace('{package}', request.source.package)
    .replace('{version}', request.source.version)
    .replace('{path}', path)
}

/**
 * Download one file, trying each mirror until one answers.
 * @param request - the package coordinates and package-relative path.
 * @param mirrors - mirror templates, in the order they are tried.
 * @returns the file's bytes, already validated against its extension.
 * @throws FontDownloadError when no mirror returned a usable file.
 */
export async function downloadFile(
  request: SourceRequest,
  mirrors: readonly string[],
): Promise<Buffer> {
  const failures: string[] = []
  let answered = false
  for (const template of mirrors) {
    const url = mirrorUrl(template, request)
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
        redirect: 'follow',
      })
      if (response.status === 404 || response.status === 410) {
        failures.push(`${url}: ${String(response.status)}`)
        continue
      }
      if (!response.ok) {
        failures.push(`${url}: ${String(response.status)}`)
        answered = true
        continue
      }
      answered = true
      const bytes = await readBounded(response)
      validate(request.path, bytes)
      return bytes
    } catch (error) {
      // One mirror's transport, timeout, or payload failure; the next one is
      // still worth trying, so the reason is collected rather than rethrown.
      failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`)
      answered = true
    }
  }
  throw new FontDownloadError(
    `no mirror served ${request.source.package}@${request.source.version}/${request.path} (${failures.join('; ')})`,
    !answered,
  )
}

/**
 * Read a response body, refusing to buffer more than {@link MAX_FILE_BYTES}.
 * @param response - an OK response whose body is the file.
 * @returns the body's bytes.
 */
async function readBounded(response: Response): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length') ?? Number.NaN)
  if (Number.isFinite(declared) && declared > MAX_FILE_BYTES) {
    throw new Error(`declared ${String(declared)} bytes, over the ${String(MAX_FILE_BYTES)}-byte cap`)
  }
  if (response.body === null) return Buffer.alloc(0)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_FILE_BYTES) {
      await reader.cancel()
      throw new Error(`body passed the ${String(MAX_FILE_BYTES)}-byte cap`)
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

/**
 * Reject a payload that is not the kind of file its extension promises.
 *
 * A mirror answering 200 with an error page, a login form, or a truncated
 * stream is the failure this catches, and it is caught before anything is
 * written into the cache.
 * @param path - the package-relative path the bytes were requested for.
 * @param bytes - the body a mirror returned.
 */
function validate(path: string, bytes: Buffer): void {
  if (bytes.length === 0) throw new Error('empty body')
  if (path.endsWith('.woff2') && bytes.subarray(0, 4).toString('latin1') !== 'wOF2') {
    throw new Error('body is not a woff2 file')
  }
  const isStylesheet = path.endsWith('.css')
  if (isStylesheet) {
    const text = bytes.toString('utf8')
    if (!text.includes('@font-face') && !text.includes('@import')) {
      throw new Error('body is not a stylesheet')
    }
  }
}
