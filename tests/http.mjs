// HTTP-level check: drive the handler the Host half registers through a real
// node:http server, with a stub registry standing in for the npm CDNs. It
// verifies what the browser actually receives — status, headers, and bytes —
// plus the cache behaviour the plugin exists for: one download per file, a
// second request answered from disk, and a request answered with no registry
// reachable at all.
// Run with `node tests/http.mjs`.
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, Config, FONT_FACES, FONTS_ROUTE } from '../lib/index.mjs'

const failures = []
const check = (label, ok, detail = '') => {
  if (ok) {
    console.log(`  ok   ${label}`)
    return
  }
  failures.push(label)
  console.log(`  FAIL ${label}${detail === '' ? '' : ` — ${detail}`}`)
}

// The face under test is a real catalogue row: the stub answers for its real
// package coordinates, so the test breaks if the catalogue moves.
const face = FONT_FACES[0]
const SHARD = 'files/noto-sans-sc-4-wght-normal.woff2'
const SECOND_SHARD = 'files/noto-sans-sc-5-wght-normal.woff2'
const BROKEN_SHARD = 'files/noto-sans-sc-6-wght-normal.woff2'
const MISSING_SHARD = 'files/noto-sans-sc-7-wght-normal.woff2'
// Present upstream but never requested while the registry is up, so the last
// check can ask for it with nothing reachable.
const UNREACHABLE_SHARD = 'files/noto-sans-sc-8-wght-normal.woff2'

const stylesheet = [
  `/* ${face.id} */`,
  '@font-face {',
  `  font-family: '${face.family}';`,
  "  font-style: normal;",
  '  font-display: swap;',
  '  font-weight: 100 900;',
  `  src: url(./${SHARD}) format('woff2-variations');`,
  '  unicode-range: U+0-7f;',
  '}',
  '',
].join('\n')
const woff2 = fill => Buffer.concat([Buffer.from('wOF2', 'latin1'), Buffer.alloc(128, fill)])
const files = new Map([
  ['index.css', Buffer.from(stylesheet, 'utf8')],
  [SHARD, woff2(0x11)],
  [SECOND_SHARD, woff2(0x22)],
  [UNREACHABLE_SHARD, woff2(0x33)],
  // An error page served with 200 is the failure the downloader must catch
  // instead of caching and handing to the browser.
  [BROKEN_SHARD, Buffer.from('<html>rate limited</html>', 'utf8')],
])

const sha = buffer => createHash('sha256').update(buffer).digest('hex')

/** Start the stub registry; `{package}` starts every path it answers. */
async function startRegistry() {
  const hits = new Map()
  const prefix = `/${face.source.package}/${face.source.version}/files/`
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    if (!pathname.startsWith(prefix)) {
      res.writeHead(404).end('not found')
      return
    }
    const path = pathname.slice(prefix.length)
    hits.set(path, (hits.get(path) ?? 0) + 1)
    const body = files.get(path)
    if (body === undefined) {
      res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"not found"}')
      return
    }
    const send = () => {
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': String(body.length) })
      res.end(body)
    }
    // The second shard answers slowly so the concurrent requests below overlap.
    if (path === SECOND_SHARD) setTimeout(send, 100)
    else send()
  })
  await new Promise(ready => { server.listen(0, '127.0.0.1', ready) })
  return {
    hits,
    template: `http://127.0.0.1:${String(server.address().port)}/{package}/{version}/files/{path}`,
    stop: () => new Promise(done => { server.close(done) }),
  }
}

/** Apply the plugin against a mock context and serve its handler. */
async function startPlugin(options) {
  let handler
  const disposers = []
  apply({
    effect(fn) {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
    },
    webServer: {
      register(route) {
        handler = route.handler
        return () => {}
      },
    },
  }, Config(options))
  if (handler === undefined) throw new Error('the plugin registered no handler')
  const server = createServer((req, res) => { void handler(req, res) })
  await new Promise(ready => { server.listen(0, '127.0.0.1', ready) })
  return {
    base: `http://127.0.0.1:${String(server.address().port)}`,
    stop: async () => {
      await new Promise(done => { server.close(done) })
      for (const dispose of disposers) dispose()
    },
  }
}

const cacheDir = await mkdtemp(join(tmpdir(), 'ui-beautify-http-'))
const registry = await startRegistry()
const plugin = await startPlugin({ mirrors: [registry.template], cacheDir })
const sheetUrl = `${plugin.base}${FONTS_ROUTE}/${face.id}/index.css`
const shardUrl = `${plugin.base}${FONTS_ROUTE}/${face.id}/${SHARD}`

try {
  console.log('stylesheet over the route')
  const sheet = await fetch(sheetUrl)
  check('200', sheet.status === 200, String(sheet.status))
  check('text/css', sheet.headers.get('content-type') === 'text/css; charset=utf-8', String(sheet.headers.get('content-type')))
  check('revalidated, not long-cached', sheet.headers.get('cache-control') === 'no-cache', String(sheet.headers.get('cache-control')))
  const sheetText = await sheet.text()
  check('served byte-identical: the relative url() is not rewritten', sheetText === stylesheet)
  check('declares its family', sheetText.includes(`font-family: '${face.family}'`), face.family)
  check('one upstream download', registry.hits.get('index.css') === 1, String(registry.hits.get('index.css')))
  const cachedSheet = await fetch(sheetUrl)
  check('a second request is served from the cache', cachedSheet.status === 200 && await cachedSheet.text() === stylesheet)
  check('still one upstream download', registry.hits.get('index.css') === 1, String(registry.hits.get('index.css')))

  console.log('shard over the route')
  const shard = await fetch(shardUrl)
  check('200', shard.status === 200, String(shard.status))
  check('font/woff2', shard.headers.get('content-type') === 'font/woff2', String(shard.headers.get('content-type')))
  check(
    'immutable long cache',
    (shard.headers.get('cache-control') ?? '').includes('immutable'),
    String(shard.headers.get('cache-control')),
  )
  const shardBytes = Buffer.from(await shard.arrayBuffer())
  check('content-length matches', shard.headers.get('content-length') === String(shardBytes.length), String(shard.headers.get('content-length')))
  check('bytes match the registry copy', sha(shardBytes) === sha(files.get(SHARD)))
  check('looks like woff2', shardBytes.subarray(0, 4).toString('ascii') === 'wOF2')
  const cachedShard = await fetch(shardUrl)
  check('a second request is served from the cache', cachedShard.status === 200)
  check('still one upstream download', registry.hits.get(SHARD) === 1, String(registry.hits.get(SHARD)))

  console.log('cache layout')
  const generations = await readdir(join(cacheDir, face.id))
  check('one generation directory', generations.length === 1, generations.join(', '))
  const cachedShardPath = join(cacheDir, face.id, generations[0], SHARD)
  check(
    'the shard sits at the package-relative path',
    await readFile(cachedShardPath).then(bytes => sha(bytes) === sha(files.get(SHARD)), () => false),
  )
  check('no scratch file is left behind', !(await readdir(join(cacheDir, face.id, generations[0], 'files'))).some(name => name.endsWith('.tmp')))

  console.log('concurrent cold requests')
  const secondUrl = `${plugin.base}${FONTS_ROUTE}/${face.id}/${SECOND_SHARD}`
  const responses = await Promise.all(Array.from({ length: 8 }, () => fetch(secondUrl)))
  check('every response is 200', responses.every(response => response.status === 200), responses.map(r => r.status).join(','))
  check('the body is the same for all of them', (await Promise.all(responses.map(r => r.arrayBuffer()))).every(body => sha(Buffer.from(body)) === sha(files.get(SECOND_SHARD))))
  check('the registry was asked once', registry.hits.get(SECOND_SHARD) === 1, String(registry.hits.get(SECOND_SHARD)))

  console.log('failures')
  const missing = await fetch(`${plugin.base}${FONTS_ROUTE}/${face.id}/${MISSING_SHARD}`)
  check('a shard no mirror has is 404', missing.status === 404, String(missing.status))
  const broken = await fetch(`${plugin.base}${FONTS_ROUTE}/${face.id}/${BROKEN_SHARD}`)
  check('a mirror answering 200 with an error page is 502', broken.status === 502, String(broken.status))
  check('the bad payload is not cached', !(await stat(join(cacheDir, face.id, generations[0], BROKEN_SHARD)).then(() => true, () => false)))
  const unknownFace = await fetch(`${plugin.base}${FONTS_ROUTE}/no-such-face/index.css`)
  check('an unknown face is 404', unknownFace.status === 404, String(unknownFace.status))
  const traversal = await fetch(`${plugin.base}${FONTS_ROUTE}/${face.id}/%2e%2e%2f%2e%2e%2fpackage.json`)
  check('an encoded traversal is refused', traversal.status === 403, String(traversal.status))
  check(
    'traversal never returns a package file',
    !(await traversal.text()).includes('dsh-ui-beautify'),
  )

  console.log('mirror fallback')
  const fallbackCache = await mkdtemp(join(tmpdir(), 'ui-beautify-fallback-'))
  // Port 1 refuses immediately on every supported platform, so the second
  // template is the one that answers.
  const fallback = await startPlugin({
    mirrors: ['http://127.0.0.1:1/{package}/{version}/files/{path}', registry.template],
    cacheDir: fallbackCache,
  })
  try {
    const response = await fetch(`${fallback.base}${FONTS_ROUTE}/${face.id}/index.css`)
    check('a dead first mirror falls through to the next', response.status === 200, String(response.status))
    check('and yields the same bytes', await response.text() === stylesheet)
  } finally {
    await fallback.stop()
    await rm(fallbackCache, { recursive: true, force: true })
  }

  console.log('offline, from the cache')
  await plugin.stop()
  await registry.stop()
  const offline = await startPlugin({ mirrors: [registry.template], cacheDir })
  try {
    const coldSheet = await fetch(`${offline.base}${FONTS_ROUTE}/${face.id}/index.css`)
    check('the stylesheet is still served', coldSheet.status === 200, String(coldSheet.status))
    check('with the same bytes', await coldSheet.text() === stylesheet)
    const coldShard = await fetch(`${offline.base}${FONTS_ROUTE}/${face.id}/${SHARD}`)
    check('the shard is still served', coldShard.status === 200, String(coldShard.status))
    check('with the same bytes', sha(Buffer.from(await coldShard.arrayBuffer())) === sha(files.get(SHARD)))
    const uncached = await fetch(`${offline.base}${FONTS_ROUTE}/${face.id}/${UNREACHABLE_SHARD}`)
    check('a file that was never cached is a retryable 502', uncached.status === 502, String(uncached.status))
    check('and says so without being cached', uncached.headers.get('cache-control') === 'no-store', String(uncached.headers.get('cache-control')))
  } finally {
    await offline.stop()
  }
} finally {
  await rm(cacheDir, { recursive: true, force: true })
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
