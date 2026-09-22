// Smoke test: run the built Host half against a mock context and exercise the
// route resolution, the choice table, and the settings schema the browser
// depends on. Run with `node tests/smoke.mjs`.
import { stat } from 'node:fs/promises'
import {
  apply, bundledFaceById, fontFileFor, fontStack, resolveFontChoice,
  BUNDLED_FACES, DEFAULT_FONT_ID, FONT_CHOICES, FONTS_ROUTE,
  FONT_SETTINGS_NS, Config, SYSTEM_FONT_ID,
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

console.log('route and settings declaration')
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
check('registers one explicit effect', disposers.length === 1, String(disposers.length))

console.log('choice table')
check('offers the system default', FONT_CHOICES.includes(SYSTEM_FONT_ID))
check('offers every bundled face', BUNDLED_FACES.every(face => FONT_CHOICES.includes(face.id)))
check('leads with the system default', FONT_CHOICES[0] === SYSTEM_FONT_ID, String(FONT_CHOICES[0]))
check('ships at least two bundled faces', BUNDLED_FACES.length >= 2, String(BUNDLED_FACES.length))
check('the default is an offered choice', FONT_CHOICES.includes(DEFAULT_FONT_ID), DEFAULT_FONT_ID)
check('choices are unique', new Set(FONT_CHOICES).size === FONT_CHOICES.length)
check('ids are unique', new Set(BUNDLED_FACES.map(f => f.id)).size === BUNDLED_FACES.length)
check('dirs are unique', new Set(BUNDLED_FACES.map(f => f.dir)).size === BUNDLED_FACES.length)
check('no bundled face claims the system id', bundledFaceById(SYSTEM_FONT_ID) === undefined)
for (const face of BUNDLED_FACES) {
  check(`${face.id}: stack leads with its family`, fontStack(face).startsWith(`'${face.family}'`), fontStack(face).slice(0, 40))
  check(`${face.id}: stack ends with the shared fallback`, fontStack(face).includes('sans-serif'))
  check(`${face.id}: resolves to itself`, bundledFaceById(face.id)?.family === face.family)
  const sheet = fontFileFor(`${FONTS_ROUTE}/${face.dir}/index.css`)
  check(`${face.id}: stylesheet resolves`, sheet !== undefined)
  if (sheet !== undefined) {
    check(`${face.id}: stylesheet is on disk`, await stat(sheet).then(() => true, () => false))
  }
}
check('an unknown value resolves to the default', resolveFontChoice('nope') === DEFAULT_FONT_ID)
check('an undefined value resolves to the default', resolveFontChoice(undefined) === DEFAULT_FONT_ID)
check('a known value passes through', resolveFontChoice(SYSTEM_FONT_ID) === SYSTEM_FONT_ID)
check('the system default applies no face', bundledFaceById(resolveFontChoice(SYSTEM_FONT_ID)) === undefined)

console.log('path resolution')
const face = BUNDLED_FACES[0]
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
check('the namespace is the loader row id', FONT_SETTINGS_NS === 'ui-beautify', FONT_SETTINGS_NS)
check('declares the face field live', Config.dict.font.meta.volatile === true)
check('defaults to the default face', Config({}).font.get() === DEFAULT_FONT_ID, String(Config({}).font.get()))
check(
  'accepts an unknown id rather than failing the section',
  Config({ font: 'anything' }).font.get() === 'anything',
  String(Config({ font: 'anything' }).font.get()),
)

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
