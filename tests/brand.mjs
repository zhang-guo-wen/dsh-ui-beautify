// Upload images through the Host route, then read them from disk as a browser would.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BRAND_ROUTE, MAX_BRAND_IMAGE_BYTES, serveBrandAsset } from '../lib/index.mjs'

const directory = await mkdtemp(join(tmpdir(), 'dsh-ui-beautify-brand-'))
const server = createServer((req, res) => { void serveBrandAsset(req, res, directory) })
await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve) })
const origin = `http://127.0.0.1:${server.address().port}`
const request = (path, options) => fetch(`${origin}${path}`, options)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64')

try {
  const uploaded = await request(`${BRAND_ROUTE}/upload/logo`, {
    method: 'POST', headers: { 'content-type': 'image/png', origin }, body: png,
  })
  assert.equal(uploaded.status, 200)
  const { url } = await uploaded.json()
  assert.match(url, /^\/plugins\/dsh-ui-beautify\/brand\/assets\/[0-9a-f]{64}\.png$/)
  assert.deepEqual(await readFile(join(directory, url.split('/').at(-1))), png)

  const image = await request(url)
  assert.equal(image.status, 200)
  assert.equal(image.headers.get('content-type'), 'image/png')
  assert.equal(image.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png)
  assert.equal((await request(url, { method: 'HEAD' })).status, 200)

  const duplicate = await request(`${BRAND_ROUTE}/upload/brandIcon`, { method: 'POST', body: png })
  assert.equal((await duplicate.json()).url, url)
  assert.equal((await request(`${BRAND_ROUTE}/upload/logo`, { method: 'POST', body: Buffer.from('<svg/>') })).status, 415)
  assert.equal((await request(`${BRAND_ROUTE}/upload/logo`, {
    method: 'POST', body: Buffer.alloc(MAX_BRAND_IMAGE_BYTES + 1),
  })).status, 413)
  assert.equal((await request(`${BRAND_ROUTE}/upload/logo`, {
    method: 'POST', headers: { origin: 'https://attacker.example' }, body: png,
  })).status, 403)
  assert.equal((await request(`${BRAND_ROUTE}/assets/../secret.png`)).status, 404)
  assert.equal((await request(`${BRAND_ROUTE}/assets/${'f'.repeat(64)}.png`)).status, 404)
  console.log('brand image upload, persistence, validation, and serving passed')
} finally {
  await new Promise(resolve => { server.close(resolve) })
  await rm(directory, { recursive: true, force: true })
}
