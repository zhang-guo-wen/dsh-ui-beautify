// Smoke test: run the built Host half against a mock context and exercise the
// route parsing, the face catalogue, and the settings schema the browser
// depends on. Nothing here touches the network or the cache — the download path
// is covered by tests/http.mjs against a stub registry.
// Run with `node tests/smoke.mjs`.
import { existsSync } from 'node:fs'
import {
  apply, faceById, fontRouteFor, fontStack, mirrorUrl, resolveCacheDir, resolveFontChoice,
  resolveMotionChoice, CACHE_ROUTE, CODE_FACES, CODE_FONT_CHOICES, Config, DEFAULT_CODE_FONT_ID,
  DEFAULT_FONT_ID, DEFAULT_MIRRORS, DEFAULT_MOTION_CHOICE, FACE_ID_PATTERN, FONT_CHOICES,
  FONT_FACES, FONT_ROLES, FONTS_ROUTE, FONT_SETTINGS_NS, MOTION_CHOICE_IDS, SYSTEM_FONT_ID,
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
check('offers several body faces', FONT_FACES.length >= 6, String(FONT_FACES.length))
check('offers several code faces', CODE_FACES.length >= 3, String(CODE_FACES.length))
check('offers the system default to both roles', FONT_CHOICES.includes(SYSTEM_FONT_ID) && CODE_FONT_CHOICES.includes(SYSTEM_FONT_ID))
check('offers every catalogued face', FONT_FACES.every(face => FONT_CHOICES.includes(face.id)) && CODE_FACES.every(face => CODE_FONT_CHOICES.includes(face.id)))
check('leads with the system default', FONT_CHOICES[0] === SYSTEM_FONT_ID && CODE_FONT_CHOICES[0] === SYSTEM_FONT_ID)
check('each default is an offered choice', FONT_CHOICES.includes(DEFAULT_FONT_ID) && CODE_FONT_CHOICES.includes(DEFAULT_CODE_FONT_ID))
check('choices are unique', new Set(FONT_CHOICES).size === FONT_CHOICES.length && new Set(CODE_FONT_CHOICES).size === CODE_FONT_CHOICES.length)
// The cache route resolves an id without knowing which picker asked for it.
check('ids are unique across roles', new Set([...FONT_FACES, ...CODE_FACES].map(f => f.id)).size === FONT_FACES.length + CODE_FACES.length)
check('no face claims the system id', faceById(SYSTEM_FONT_ID, 'body') === undefined && faceById(SYSTEM_FONT_ID, 'code') === undefined)
check('covers both writing systems', FONT_FACES.some(f => f.group === 'cjk') && FONT_FACES.some(f => f.group === 'latin'))
check('the two roles read different catalogues', !FONT_FACES.some(f => f.id === 'jetbrains-mono') && !CODE_FACES.some(f => f.id === 'noto-sans-sc'))
for (const [role, stack] of [['body', 'sans-serif'], ['code', 'monospace']]) {
  check(`${role}: declares its fallback`, FONT_ROLES[role].fallback.includes(stack), FONT_ROLES[role].fallback)
  check(`${role}: declares the tokens it rebinds`, FONT_ROLES[role].tokens.length > 0, FONT_ROLES[role].tokens.join(','))
  for (const face of FONT_ROLES[role].faces) {
    const id = face.id
    check(`${id}: id is a url segment`, FACE_ID_PATTERN.test(id), id)
    check(`${id}: declares a family`, face.family.trim() !== '', face.family)
    check(`${id}: stack leads with its family`, fontStack(face, role).startsWith(`'${face.family}'`), fontStack(face, role).slice(0, 40))
    check(`${id}: stack ends with the role's fallback`, fontStack(face, role).includes(stack))
    check(`${id}: resolves to itself`, faceById(id, role)?.family === face.family)
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
}
check('an unknown body value resolves to the body default', resolveFontChoice('nope', 'body') === DEFAULT_FONT_ID)
check('an undefined body value resolves to the body default', resolveFontChoice(undefined, 'body') === DEFAULT_FONT_ID)
check('a known value passes through', resolveFontChoice(SYSTEM_FONT_ID, 'body') === SYSTEM_FONT_ID)
check('an unknown code value resolves to the code default', resolveFontChoice('nope', 'code') === DEFAULT_CODE_FONT_ID)
check(
  'a body id is not accepted as a code id',
  resolveFontChoice('noto-sans-sc', 'code') === DEFAULT_CODE_FONT_ID,
  resolveFontChoice('noto-sans-sc', 'code'),
)
check('the code default downloads nothing', DEFAULT_CODE_FONT_ID === SYSTEM_FONT_ID, DEFAULT_CODE_FONT_ID)
check('the system default applies no face', faceById(resolveFontChoice(SYSTEM_FONT_ID, 'body'), 'body') === undefined)

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
const codeSheet = fontRouteFor(`${FONTS_ROUTE}/${CODE_FACES[0].id}/${CODE_FACES[0].source.sheets[0]}`)
check(
  'serves a code face through the same route',
  codeSheet?.kind === 'file' && codeSheet.face.family === CODE_FACES[0].family,
  JSON.stringify(codeSheet),
)
check(
  'serves a code face\'s nested sheet path',
  fontRouteFor(`${FONTS_ROUTE}/maple-mono-cn/dist/font/result.css`)?.path === 'dist/font/result.css',
  String(fontRouteFor(`${FONTS_ROUTE}/maple-mono-cn/dist/font/result.css`)?.path),
)
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
check('declares the body field live', Config.dict.font.meta.volatile === true)
check('declares the code field live', Config.dict.codeFont.meta.volatile === true)
check('declares the motion field live', Config.dict.motion.meta.volatile === true)
check('defaults to the default body face', Config({}).font.get() === DEFAULT_FONT_ID, String(Config({}).font.get()))
check('defaults the code face to the built-in stack', Config({}).codeFont.get() === DEFAULT_CODE_FONT_ID, String(Config({}).codeFont.get()))
check('defaults the lane to following the browser', Config({}).motion.get() === DEFAULT_MOTION_CHOICE, String(Config({}).motion.get()))
check('defaults the mirrors to the built-in registries', Config({}).mirrors.join(',') === DEFAULT_MIRRORS.join(','))
check('defaults the cache directory to the harness home', Config({}).cacheDir === '', String(Config({}).cacheDir))
check(
  'accepts an unknown id rather than failing the section',
  Config({ font: 'anything' }).font.get() === 'anything',
  String(Config({ font: 'anything' }).font.get()),
)
check(
  'keeps the three choices independent',
  Config({ font: 'geist', codeFont: 'fira-code', motion: 'always' }).font.get() === 'geist'
    && Config({ font: 'geist', codeFont: 'fira-code', motion: 'always' }).codeFont.get() === 'fira-code'
    && Config({ font: 'geist', codeFont: 'fira-code', motion: 'always' }).motion.get() === 'always',
)

console.log('the lane motion choice')
check('offers the three answers in order', MOTION_CHOICE_IDS.join(',') === 'system,always,off', MOTION_CHOICE_IDS.join(','))
check('an unknown value resolves to the default', resolveMotionChoice('nope') === DEFAULT_MOTION_CHOICE)
check('an undefined value resolves to the default', resolveMotionChoice(undefined) === DEFAULT_MOTION_CHOICE)
check(
  'every offered answer resolves to itself',
  MOTION_CHOICE_IDS.every(choice => resolveMotionChoice(choice) === choice),
)

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
