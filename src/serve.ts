/**
 * The plugin's two HTTP surfaces.
 *
 * The browser fetches a face's stylesheets and shards from the application
 * origin, so this plugin claims one `webServer` prefix and resolves each path
 * against the face catalogue. The route mirrors the npm package layout exactly,
 * which is what the stylesheets assume: a path requested here is the path the
 * package holds, so no CSS has to be rewritten on the way through.
 *
 * The second surface is the cache read-out the picker labels each face with. It
 * is a separate exact route, because nothing under the font prefix is a JSON
 * document.
 *
 * Request paths are untrusted input and the resolved file is written to disk,
 * so a path outside the route, a path that names no face, and a path that would
 * escape its own generation directory are three different answers rather than
 * one lookup.
 *
 * @module @guowenzhang/dsh-ui-beautify/serve
 */

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { anyFaceById, FACE_ID_PATTERN, type FontFace } from './fonts.ts'
import { FONTS_ROUTE } from './params.ts'
import { FontDownloadError } from './source.ts'
import type { FontStore } from './store.ts'

/** Where one request under the font route points. */
export type FontRoute =
  | { kind: 'file'; face: FontFace; path: string }
  | { kind: 'unknown-face'; id: string }

/** Content types the font packages hold; anything else is served as bytes. */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
}

/**
 * Cache policy per extension.
 *
 * A shard's name carries the package version, so a year is safe for it. A
 * stylesheet keeps its name across versions, and the pinned version can move
 * under a running host, so the browser must revalidate it rather than keep it.
 */
const CACHE_CONTROL: Readonly<Record<string, string>> = {
  '.css': 'no-cache',
  '.woff2': 'public, max-age=31536000, immutable',
}

/**
 * Resolve one request path to the face and package-relative file it names.
 * @param pathname - the decoded request pathname.
 * @returns the route, or undefined when the path is malformed or outside this route.
 */
export function fontRouteFor(pathname: string): FontRoute | undefined {
  if (!pathname.startsWith(`${FONTS_ROUTE}/`)) return undefined
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname.slice(FONTS_ROUTE.length + 1))
  } catch {
    // A malformed percent sequence cannot name a file.
    return undefined
  }
  const segments = decoded.split('/')
  const id = segments.shift()
  if (id === undefined || !FACE_ID_PATTERN.test(id)) return undefined
  const path = segments.join('/')
  if (!isServablePath(path)) return undefined
  const face = anyFaceById(id)
  if (face === undefined) return { kind: 'unknown-face', id }
  return { kind: 'file', face, path }
}

/**
 * Whether a package-relative path may be fetched and cached.
 *
 * Windows treats a backslash as a separator, so a path carrying one can climb
 * out of the cache directory on that platform even though it looks inert here;
 * it is refused as malformed rather than normalized.
 * @param path - the path beneath the face id.
 * @returns whether every segment is an ordinary name.
 */
function isServablePath(path: string): boolean {
  if (path === '' || path.includes('\\') || path.includes('\0')) return false
  if (path.startsWith('/')) return false
  return path.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..')
}

/**
 * Answer one request for a font file, downloading it when the cache is cold.
 *
 * A prefix route is consulted for everything under its path, including paths
 * whose `..` segments a client sent: URL parsing collapses those before this
 * handler runs, so a request can arrive that no longer names this route at all.
 * Such a request is refused rather than answered with some other file.
 * @param req - the incoming request.
 * @param res - the response to own.
 * @param store - the cache the file is read from or downloaded into.
 */
export async function serveFontFile(
  req: IncomingMessage,
  res: ServerResponse,
  store: FontStore,
): Promise<void> {
  const pathname = new URL(req.url ?? '/', 'http://x').pathname
  const route = fontRouteFor(pathname)
  if (route === undefined) {
    res.writeHead(403).end('forbidden')
    return
  }
  if (route.kind === 'unknown-face') {
    res.writeHead(404).end('not found')
    return
  }
  let file: string
  try {
    file = await store.file(route.face, route.path)
  } catch (error) {
    if (error instanceof FontDownloadError && error.missing) {
      res.writeHead(404).end('not found')
      return
    }
    // Either no mirror answered or the answer could not be written to the
    // cache. Both are retryable, so the response says so and is not cached.
    res.writeHead(502, { 'cache-control': 'no-store' }).end('font source unavailable')
    return
  }
  let size: number
  try {
    const info = await stat(file)
    if (!info.isFile()) throw new Error('not a file')
    size = info.size
  } catch {
    res.writeHead(404).end('not found')
    return
  }
  const extension = extname(file).toLowerCase()
  res.writeHead(200, {
    'content-type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
    'content-length': String(size),
    'cache-control': CACHE_CONTROL[extension] ?? 'no-cache',
  })
  // Settle on the response's own completion, not the file stream's: the stream can
  // end while bytes are still flushing, and teardown then races the write.
  await new Promise<void>((settle) => {
    res.on('finish', settle)
    res.on('close', settle)
    const stream = createReadStream(file)
    stream.on('error', () => { res.destroy(); settle() })
    stream.pipe(res)
  })
}

/**
 * Answer one request for the cache read-out.
 *
 * The picker asks for this when it opens and after a face is applied, so the
 * answer must describe the disk as it is right now: it is never cached.
 * @param req - the incoming request.
 * @param res - the response to own.
 * @param store - the cache being reported on.
 */
export async function serveCacheUsage(
  req: IncomingMessage,
  res: ServerResponse,
  store: FontStore,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' }).end('method not allowed')
    return
  }
  const body = JSON.stringify({ faces: await store.usage() })
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(body)),
    'cache-control': 'no-store',
  })
  res.end(req.method === 'HEAD' ? undefined : body)
}
