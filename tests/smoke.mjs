// Smoke test: run the built Host half against a mock context and exercise the
// route resolution, the face table, and the settings registration the browser
// depends on. Run with `node tests/smoke.mjs`.
import { stat } from 'node:fs/promises'
import {
  apply, fontFaceById, fontFileFor, fontStack,
  DEFAULT_FONT_ID, FONT_FACES, FONTS_ROUTE, FONT_SETTINGS_NS, FONT_SETTINGS_SCHEMA,
} from '../lib/index.mjs'

const failures = []
const check = (label, ok, detail = '') => {
  if (ok) {
    console.log(`  ok   ${label}`)
    return
  }
  failures.push(label)
  console.log(`  FAIL ${label}${detail === '' ? '' : ` — ${detail}`}`)
}

console.log('route and settings registration')
let registered
const disposers = []
let registeredNamespace
let registeredSchema
let registeredOptions
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
  inject(services, callback) {
    if (!services.includes('settings')) return
    callback({
      settings: {
        register(namespace, schema, options) {
          registeredNamespace = namespace
          registeredSchema = schema
          registeredOptions = options
          return { get: () => ({ font: DEFAULT_FONT_ID }) }
        },
      },
    })
  },
})
check('claims exactly one route', registered !== undefined)
check('as a prefix route', registered?.kind === 'prefix', String(registered?.kind))
check('under the agreed path', registered?.path === FONTS_ROUTE, String(registered?.path))
check('with a request handler', typeof registered?.handler === 'function')
check('registers the settings namespace', registeredNamespace === FONT_SETTINGS_NS, String(registeredNamespace))
check('with a schema', registeredSchema !== undefined)
check('applies live, not on restart', registeredOptions?.applies === 'live', String(registeredOptions?.applies))
check('seeded with the default face', registeredOptions?.base?.font === DEFAULT_FONT_ID, String(registeredOptions?.base?.font))
// Only the route is an explicit effect; the namespace registration is scoped by
// the `ctx.inject` callback it runs in, so it adds none of its own.
check('registers one explicit effect', disposers.length === 1, String(disposers.length))

console.log('face table')
check('ships at least two faces', FONT_FACES.length >= 2, String(FONT_FACES.length))
check('defaults to the first face', FONT_FACES[0]?.id === DEFAULT_FONT_ID, String(FONT_FACES[0]?.id))
check('ids are unique', new Set(FONT_FACES.map(f => f.id)).size === FONT_FACES.length)
check('dirs are unique', new Set(FONT_FACES.map(f => f.dir)).size === FONT_FACES.length)
for (const face of FONT_FACES) {
  check(`${face.id}: stack leads with its family`, fontStack(face).startsWith(`'${face.family}'`), fontStack(face).slice(0, 40))
  check(`${face.id}: stack ends with the shared fallback`, fontStack(face).includes('sans-serif'))
  const sheet = fontFileFor(`${FONTS_ROUTE}/${face.dir}/index.css`)
  check(`${face.id}: stylesheet resolves`, sheet !== undefined)
  if (sheet !== undefined) {
    check(`${face.id}: stylesheet is on disk`, await stat(sheet).then(() => true, () => false))
  }
}
check('an unknown id falls back to the default', fontFaceById('nope').id === DEFAULT_FONT_ID)
check('an undefined id falls back to the default', fontFaceById(undefined).id === DEFAULT_FONT_ID)

console.log('path resolution')
const face = FONT_FACES[0]
const allowed = [
  `${FONTS_ROUTE}/${face.dir}/index.css`,
  `${FONTS_ROUTE}/${face.dir}/files/shared-4-wght500.woff2`,
]
const refused = [
  `${FONTS_ROUTE}/../../package.json`,
  `${FONTS_ROUTE}/../src/index.ts`,
  FONTS_ROUTE,
  `${FONTS_ROUTE}/`,
  '/plugins/other/fonts/index.css',
]
for (const pathname of allowed) check(`serves ${pathname}`, fontFileFor(pathname) !== undefined)
for (const pathname of refused) check(`refuses ${pathname}`, fontFileFor(pathname) === undefined)

// Resolution answers "is this inside the font root?", not "does this file
// exist" — absence is the handler's `stat` and becomes a 404 there. A path
// under a directory that happens to be missing must still resolve in-root.
const absent = `${FONTS_ROUTE}/no-such-face/index.css`
const absentResolved = fontFileFor(absent)
check(
  'resolves an in-root path whose file does not exist',
  absentResolved !== undefined && absentResolved.includes('assets'),
  String(absentResolved),
)

console.log('settings schema')
const schema = FONT_SETTINGS_SCHEMA
check('defaults to the default face', schema({}).font === DEFAULT_FONT_ID, String(schema({}).font))
check(
  'accepts an unknown id rather than failing the section',
  schema({ font: 'anything' }).font === 'anything',
  String(schema({ font: 'anything' }).font),
)

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
