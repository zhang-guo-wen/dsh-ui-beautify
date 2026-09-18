// HTTP-level check: drive the handler the Host half registers through a real
// node:http server on an OS-assigned port, so the response headers and bytes the
// browser will receive are verified rather than inferred.
// Run with `node tests/http.mjs`.
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { apply, FONTS_ROUTE } from '../lib/index.mjs'

const failures = []
const check = (label, ok, detail = '') => {
  if (ok) {
    console.log(`  ok   ${label}`)
    return
  }
  failures.push(label)
  console.log(`  FAIL ${label}${detail === '' ? '' : ` — ${detail}`}`)
}

let handler
apply({
  effect(fn) { fn() },
  webServer: {
    register(route) {
      handler = route.handler
      return () => {}
    },
  },
})
if (handler === undefined) {
  console.error('the plugin registered no handler')
  process.exit(1)
}

const server = createServer((req, res) => { void handler(req, res) })
await new Promise((ready) => { server.listen(0, '127.0.0.1', ready) })
const base = `http://127.0.0.1:${String(server.address().port)}`

try {
  console.log('stylesheet')
  const css = await fetch(`${base}${FONTS_ROUTE}/index.css`)
  check('200', css.status === 200, String(css.status))
  check('text/css', css.headers.get('content-type') === 'text/css; charset=utf-8', String(css.headers.get('content-type')))
  check('revalidated, not long-cached', css.headers.get('cache-control') === 'no-cache', String(css.headers.get('cache-control')))
  const cssText = await css.text()
  const declared = new Set([...cssText.matchAll(/url\(\.\/files\/([\w.-]+)\)/g)].map(m => m[1]))
  check('declares @font-face shards', declared.size > 0, String(declared.size))
  check('every shard is on disk', (await Promise.all([...declared].map(name =>
    readFile(new URL(`../assets/fonts/files/${name}`, import.meta.url)).then(() => true, () => false),
  ))).every(Boolean))
  check('family name matches the token stack', cssText.includes("font-family: 'Noto Sans SC Variable'"))

  console.log('one shard')
  const shardName = [...declared][0]
  const expected = await readFile(new URL(`../assets/fonts/files/${shardName}`, import.meta.url))
  const shard = await fetch(`${base}${FONTS_ROUTE}/files/${shardName}`)
  check('200', shard.status === 200, String(shard.status))
  check('font/woff2', shard.headers.get('content-type') === 'font/woff2', String(shard.headers.get('content-type')))
  check('immutable long cache', (shard.headers.get('cache-control') ?? '').includes('immutable'), String(shard.headers.get('cache-control')))
  const bytes = Buffer.from(await shard.arrayBuffer())
  check('byte length matches the file', bytes.length === expected.length, `${bytes.length} vs ${expected.length}`)
  check('bytes match the file', createHash('sha256').update(bytes).digest('hex') === createHash('sha256').update(expected).digest('hex'))
  check('looks like woff2', bytes.subarray(0, 4).toString('ascii') === 'wOF2', bytes.subarray(0, 4).toString('ascii'))

  console.log('refusals')
  const traversal = await fetch(`${base}${FONTS_ROUTE}/../../package.json`)
  check('traversal does not return the file', traversal.status !== 200 || !(await traversal.text()).includes('dsh-ui-beautify'), String(traversal.status))
  const missing = await fetch(`${base}${FONTS_ROUTE}/files/nope.woff2`)
  check('missing shard is 404', missing.status === 404, String(missing.status))
} finally {
  await new Promise((done) => { server.close(done) })
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
