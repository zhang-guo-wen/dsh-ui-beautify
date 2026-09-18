/**
 * Serving the bundled font directory.
 *
 * The browser fetches the shards from the application origin, so this plugin
 * claims one `webServer` prefix instead of relying on any implicit asset
 * mapping. Every served path is resolved against the font root and rejected
 * unless it stays inside it, because the request path is untrusted input.
 */
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { FONTS_ROUTE } from './params.ts'

/** Absolute path of the font directory that ships beside this module. */
const FONT_ROOT = resolve(fileURLToPath(new URL('../assets/fonts', import.meta.url)))

/** Content types the font directory holds; anything else is served as bytes. */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
}

/**
 * Cache policy per extension. The shard names are content-addressed by font
 * version, so a year is safe for them; the stylesheet keeps its name across
 * regenerations, so it must be revalidated or a font swap would stay invisible.
 */
const CACHE_CONTROL: Readonly<Record<string, string>> = {
  '.css': 'no-cache',
  '.woff2': 'public, max-age=31536000, immutable',
}

/**
 * Resolve one request path to a file inside the font root.
 * @param pathname - the decoded request pathname.
 * @returns the absolute file path, or undefined when it is outside this route.
 */
export function fontFileFor(pathname: string): string | undefined {
  if (!pathname.startsWith(`${FONTS_ROUTE}/`)) return undefined
  const relative = pathname.slice(FONTS_ROUTE.length + 1)
  if (relative === '') return undefined
  let decoded: string
  try {
    decoded = decodeURIComponent(relative)
  } catch {
    // A malformed percent sequence cannot name a file.
    return undefined
  }
  // `normalize` collapses `..` before the containment check, so a traversal
  // attempt either escapes the root and is rejected or resolves inside it.
  const candidate = resolve(FONT_ROOT, normalize(decoded))
  if (!candidate.startsWith(FONT_ROOT + sep)) return undefined
  return candidate
}

/**
 * Answer one request for a font file.
 *
 * A prefix route is consulted for everything under its path, including paths
 * whose `..` segments a client sent: URL parsing collapses those before this
 * handler runs, so a request can arrive that no longer names this route at all.
 * Such a request is refused rather than answered with some other file.
 * @param req - the incoming request.
 * @param res - the response to own.
 */
export async function serveFontFile(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const pathname = new URL(req.url ?? '/', 'http://x').pathname
  const file = fontFileFor(pathname)
  if (file === undefined) {
    res.writeHead(403).end('forbidden')
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
