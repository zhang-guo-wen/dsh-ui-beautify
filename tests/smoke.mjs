// Smoke test: run the built Host half against a mock context and exercise the
// route parsing, the face catalogue, and the settings schema the browser
// depends on. Nothing here touches the network or the cache — the download path
// is covered by tests/http.mjs against a stub registry.
// Run with `node tests/smoke.mjs`.
import { existsSync } from 'node:fs'
import {
  apply, faceById, fontRouteFor, fontStack, mirrorUrl, resolveCacheDir, resolveFontChoice,
  CACHE_ROUTE, Config, DEFAULT_FONT_ID, DEFAULT_MIRRORS, FACE_ID_PATTERN, FONT_CHOICES,
  FONT_FACES, FONTS_ROUTE, FONT_SETTINGS_NS, SYSTEM_FONT_ID,
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
const routes = []
const disposers = []
const config = Config({})
apply({
  effect(fn) {
    const dispose = fn()
    if (typeof dispose === 'function') disposers.push(dispose)
  },
  webServer: {
    register(route) {
      routes.push(route)
      return () => {}
    },
  },
}, config)
const fontRoute = routes.find(route => route.path === FONTS_ROUTE)
const cacheRoute = routes.find(route => route.path === CACHE_ROUTE)
check('claims exactly two routes', routes.length === 2, routes.map(route => route.path).join(', '))
check('the font route is a prefix route', fontRoute?.kind === 'prefix', String(fontRoute?.kind))
check('the font route carries a request handler', typeof fontRoute?.handler === 'function')
check('the cache read-out is an exact route', cacheRoute?.kind === 'exact', String(cacheRoute?.kind))
check('the cache read-out carries a request handler', typeof cacheRoute?.handler === 'function')
check('the two routes do not overlap', !CACHE_ROUTE.startsWith(`${FONTS_ROUTE}/`), CACHE_ROUTE)
check('registers one explicit effect per route', disposers.length === 2, String(disposers.length))

console.log('face catalogue')
check('offers several faces', FONT_FACES.length >= 6, String(FONT_FACES.length))
check('offers the system default', FONT_CHOICES.includes(SYSTEM_FONT_ID))
check('offers every catalogued face', FONT_FACES.every(face => FONT_CHOICES.includes(face.id)))
check('leads with the system default', FONT_CHOICES[0] === SYSTEM_FONT_ID, String(FONT_CHOICES[0]))
check('the default is an offered choice', FONT_CHOICES.includes(DEFAULT_FONT_ID), DEFAULT_FONT_ID)
check('choices are unique', new Set(FONT_CHOICES).size === FONT_CHOICES.length)
check('ids are unique', new Set(FONT_FACES.map(f => f.id)).size === FONT_FACES.length)
check('no face claims the system id', faceById(SYSTEM_FONT_ID) === undefined)
check('covers both writing systems', FONT_FACES.some(f => f.group === 'cjk') && FONT_FACES.some(f => f.group === 'latin'))
for (const face of FONT_FACES) {
  const id = face.id
  check(`${id}: id is a url segment`, FACE_ID_PATTERN.test(id), id)
  check(`${id}: declares a family`, face.family.trim() !== '', face.family)
  check(`${id}: stack leads with its family`, fontStack(face).startsWith(`'${face.family}'`), fontStack(face).slice(0, 40))
  check(`${id}: stack ends with the shared fallback`, fontStack(face).includes('sans-serif'))
  check(`${id}: resolves to itself`, faceById(id)?.family === face.family)
  check(`${id}: pins a package`, /^(@[a-z0-9-]+\/)?[a-z0-9-]+$/.test(face.source.package), face.source.package)
  check(`${id}: pins a version`, /^\d+\.\d+\.\d+$/.test(face.source.version), face.source.version)
  check(`${id}: declares sheets`, face.source.sheets.length > 0)
  check(
    `${id}: sheets are package-relative stylesheets`,
    face.source.sheets.every(sheet => sheet.endsWith('.css') && !sheet.startsWith('/') && !sheet.includes('..')),
    face.source.sheets.join(', '),
  )
  check(`${id}: sheets are unique`, new Set(face.source.sheets).size === face.source.sheets.length)
}
check('an unknown value resolves to the default', resolveFontChoice('nope') === DEFAULT_FONT_ID)
check('an undefined value resolves to the default', resolveFontChoice(undefined) === DEFAULT_FONT_ID)
check('a known value passes through', resolveFontChoice(SYSTEM_FONT_ID) === SYSTEM_FONT_ID)
check('the system default applies no face', faceById(resolveFontChoice(SYSTEM_FONT_ID)) === undefined)

console.log('no font bytes ship with the plugin')
check(
  'the package holds no assets directory',
  !existsSync(new URL('../assets', import.meta.url)),
)

console.log('route parsing')
const face = FONT_FACES[0]
for (const sheet of face.source.sheets) {
  const route = fontRouteFor(`${FONTS_ROUTE}/${face.id}/${sheet}`)
  check(`resolves ${sheet}`, route?.kind === 'file' && route.path === sheet, JSON.stringify(route))
}
const shard = fontRouteFor(`${FONTS_ROUTE}/${face.id}/files/noto-sans-sc-4-wght-normal.woff2`)
check('resolves a nested shard', shard?.kind === 'file' && shard.path === 'files/noto-sans-sc-4-wght-normal.woff2')
check('resolves a percent-encoded shard name', fontRouteFor(`${FONTS_ROUTE}/${face.id}/files/a%2Db.woff2`)?.path === 'files/a-b.woff2')
const unknown = fontRouteFor(`${FONTS_ROUTE}/no-such-face/index.css`)
check('names an unknown face rather than a file', unknown?.kind === 'unknown-face', JSON.stringify(unknown))
const refused = [
  `${FONTS_ROUTE}/../../package.json`,
  `${FONTS_ROUTE}/../src/index.ts`,
  `${FONTS_ROUTE}/%2e%2e/package.json`,
  `${FONTS_ROUTE}/..%2fpackage.json`,
  `${FONTS_ROUTE}/${face.id}/../../../etc/passwd`,
  `${FONTS_ROUTE}/${face.id}/%2e%2e/%2e%2e/package.json`,
  `${FONTS_ROUTE}/${face.id}/files/..%2f..%2fpackage.json`,
  `${FONTS_ROUTE}/${face.id}/..\\..\\package.json`,
  `${FONTS_ROUTE}/${face.id}/./index.css`,
  `${FONTS_ROUTE}/${face.id}//index.css`,
  `${FONTS_ROUTE}/${face.id}/`,
  `${FONTS_ROUTE}/${face.id}`,
  `${FONTS_ROUTE}/`,
  FONTS_ROUTE,
  '/plugins/other/fonts/index.css',
]
for (const pathname of refused) {
  check(`refuses ${pathname}`, fontRouteFor(pathname) === undefined)
}

console.log('mirror templates')
const request = { source: face.source, path: 'files/noto-sans-sc-4-wght-normal.woff2' }
check(
  'npmmirror template carries the version as a directory',
  mirrorUrl(DEFAULT_MIRRORS[0], request)
    === `https://registry.npmmirror.com/${face.source.package}/${face.source.version}/files/${request.path}`,
  mirrorUrl(DEFAULT_MIRRORS[0], request),
)
check(
  'jsDelivr template carries the version in the path segment',
  mirrorUrl(DEFAULT_MIRRORS[1], request)
    === `https://cdn.jsdelivr.net/npm/${face.source.package}@${face.source.version}/${request.path}`,
  mirrorUrl(DEFAULT_MIRRORS[1], request),
)
check(
  'a bare package-root path needs no directory prefix',
  mirrorUrl(DEFAULT_MIRRORS[1], { source: face.source, path: 'index.css' })
    === `https://cdn.jsdelivr.net/npm/${face.source.package}@${face.source.version}/index.css`,
)

console.log('cache directory')
const previousHome = process.env.DSH_HOME
process.env.DSH_HOME = '~/fixture-home'
check(
  'an empty cacheDir follows $DSH_HOME',
  resolveCacheDir('').replace(/\\/g, '/').endsWith('/fixture-home/cache/ui-beautify/fonts'),
  resolveCacheDir(''),
)
process.env.DSH_HOME = '   '
const blankHome = resolveCacheDir('')
process.env.DSH_HOME = previousHome
check('a blank $DSH_HOME falls back to the OS home', !blankHome.includes('   '), blankHome)
check(
  'a configured cacheDir wins outright',
  resolveCacheDir('~/elsewhere').replace(/\\/g, '/').endsWith('/elsewhere'),
  resolveCacheDir('~/elsewhere'),
)

console.log('settings schema')
check('the namespace is the loader row id', FONT_SETTINGS_NS === 'ui-beautify', FONT_SETTINGS_NS)
check('declares the face field live', Config.dict.font.meta.volatile === true)
check('defaults to the default face', Config({}).font.get() === DEFAULT_FONT_ID, String(Config({}).font.get()))
check('defaults the mirrors to the built-in registries', Config({}).mirrors.join(',') === DEFAULT_MIRRORS.join(','))
check('defaults the cache directory to the harness home', Config({}).cacheDir === '', String(Config({}).cacheDir))
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
