// Smoke test: run the built Host half against a mock context and exercise the
// route resolution the browser depends on. Run with `node tests/smoke.mjs`.
import { stat } from 'node:fs/promises'
import { apply, fontFileFor, FONTS_ROUTE, FONT_FAMILY, FONT_STACK } from '../lib/index.mjs'

const failures = []
const check = (label, ok, detail = '') => {
  if (ok) {
    console.log(`  ok   ${label}`)
    return
  }
  failures.push(label)
  console.log(`  FAIL ${label}${detail === '' ? '' : ` — ${detail}`}`)
}

console.log('route registration')
let registered
const disposers = []
apply({
  effect(fn) {
    const dispose = fn()
    if (typeof dispose === 'function') disposers.push(dispose)
  },
  webServer: {
    register(route) {
      registered = route
      return () => {}
    },
  },
})
check('claims exactly one route', registered !== undefined)
check('as a prefix route', registered?.kind === 'prefix', String(registered?.kind))
check('under the agreed path', registered?.path === FONTS_ROUTE, String(registered?.path))
check('with a request handler', typeof registered?.handler === 'function')
check('registers one effect', disposers.length === 1, String(disposers.length))

console.log('path resolution')
const allowed = [
  '/plugins/dsh-ui-beautify/fonts/index.css',
  '/plugins/dsh-ui-beautify/fonts/files/noto-sans-sc-4-wght-normal.woff2',
]
const refused = [
  '/plugins/dsh-ui-beautify/fonts/../../package.json',
  '/plugins/dsh-ui-beautify/fonts/../src/index.ts',
  '/plugins/dsh-ui-beautify/fonts',
  '/plugins/dsh-ui-beautify/fonts/',
  '/plugins/dsh-ui-beautify/other/x.css',
  '/plugins/other/fonts/index.css',
]
for (const pathname of allowed) check(`serves ${pathname}`, fontFileFor(pathname) !== undefined)
for (const pathname of refused) check(`refuses ${pathname}`, fontFileFor(pathname) === undefined)

console.log('font payload')
const css = fontFileFor('/plugins/dsh-ui-beautify/fonts/index.css')
check('index.css is on disk', await stat(css).then(() => true, () => false))
const shard = fontFileFor('/plugins/dsh-ui-beautify/fonts/files/noto-sans-sc-4-wght-normal.woff2')
check('a shard is on disk', await stat(shard).then(() => true, () => false))
check('family name is the one the sheet declares', FONT_FAMILY === 'Noto Sans SC Variable', FONT_FAMILY)
check('stack leads with the bundled family', FONT_STACK.startsWith(`'${FONT_FAMILY}'`), FONT_STACK.slice(0, 40))

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
