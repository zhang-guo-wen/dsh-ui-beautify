/** Bounded binary upload and content-addressed storage for brand images. */
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { BRAND_ROUTE, MAX_BRAND_IMAGE_BYTES } from './params.ts'

const TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
} as const
type ImageType = keyof typeof TYPES

/** Sniff bytes instead of trusting the browser's filename or MIME claim. */
export function imageType(bytes: Buffer): ImageType | undefined {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))) return 'gif'
  return undefined
}

async function readUpload(req: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > MAX_BRAND_IMAGE_BYTES) return undefined
    chunks.push(bytes)
  }
  return Buffer.concat(chunks)
}

/** Save bytes atomically; the URL is immutable and survives a Host restart. */
export async function saveBrandImage(bytes: Buffer, directory: string): Promise<string> {
  const type = imageType(bytes)
  if (type === undefined || bytes.length > MAX_BRAND_IMAGE_BYTES) throw new Error('invalid image')
  const digest = createHash('sha256').update(bytes).digest('hex')
  const filename = `${digest}.${type}`
  await mkdir(directory, { recursive: true })
  const destination = join(directory, filename)
  try {
    await stat(destination)
  } catch {
    const temporary = join(directory, `${digest}-${randomUUID()}.tmp`)
    try {
      await writeFile(temporary, bytes)
      await rename(temporary, destination)
    } finally {
      await rm(temporary, { force: true })
    }
  }
  return `${BRAND_ROUTE}/assets/${filename}`
}

/** POST /upload/{logo|brandIcon}; GET /assets/{sha256}.{ext}. */
export async function serveBrandAsset(req: IncomingMessage, res: ServerResponse, directory: string): Promise<void> {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  if (pathname === `${BRAND_ROUTE}/upload/logo` || pathname === `${BRAND_ROUTE}/upload/brandIcon`) {
    if (req.method !== 'POST') { res.writeHead(405, { allow: 'POST' }).end(); return }
    const origin = req.headers.origin
    if (origin !== undefined && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) {
      res.writeHead(403).end('origin denied')
      return
    }
    const declaredSize = Number(req.headers['content-length'])
    if (Number.isFinite(declaredSize) && declaredSize > MAX_BRAND_IMAGE_BYTES) {
      res.writeHead(413).end('image too large')
      return
    }
    try {
      const bytes = await readUpload(req)
      if (bytes === undefined) { res.writeHead(413).end('image too large'); return }
      if (imageType(bytes) === undefined || bytes.length === 0) { res.writeHead(415).end('unsupported image'); return }
      const url = await saveBrandImage(bytes, directory)
      const body = JSON.stringify({ url })
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }).end(body)
    } catch {
      res.writeHead(500).end('image upload failed')
    }
    return
  }
  const match = /^\/plugins\/dsh-ui-beautify\/brand\/assets\/([0-9a-f]{64})\.(png|jpg|webp|gif)$/.exec(pathname)
  if (match === null) { res.writeHead(404).end('not found'); return }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD' }).end(); return }
  try {
    const bytes = await readFile(join(directory, `${match[1]}.${match[2]}`))
    res.writeHead(200, {
      'content-type': TYPES[match[2] as ImageType],
      'content-length': String(bytes.length),
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    }).end(req.method === 'HEAD' ? undefined : bytes)
  } catch {
    res.writeHead(404).end('not found')
  }
}
