// Evaluate one npm package as a candidate face before adding it to fonts.ts.
//
// A catalogue row needs three things the package itself never states plainly:
// the sheet to link, the family that sheet declares, and whether it is sliced
// into `unicode-range` shards (an unsliced CJK file is megabytes per character
// set, which is the failure this script exists to catch). It answers all three
// from the registries the plugin actually downloads from, then prints the row.
//
// Usage:
//   npm run probe -- <package>[@version] [sheet ...]
//   npm run probe -- @fontsource/zcool-kuaile
//   npm run probe -- lxgw-wenkai-webfont 1.7.0 lxgwwenkai-regular.css
import { DEFAULT_MIRRORS } from '../lib/index.mjs'

const [spec, ...rest] = process.argv.slice(2)
if (spec === undefined) {
  console.error('usage: npm run probe -- <package>[@version] [version] [sheet ...]')
  process.exit(2)
}

const at = spec.lastIndexOf('@')
const [name, inlineVersion] = at > 0 ? [spec.slice(0, at), spec.slice(at + 1)] : [spec, undefined]
// A bare `1.2.3` after the name pins the version without the `@` form.
const [versionedArg, ...sheetArgs] = rest
const pinned = inlineVersion ?? (/^\d+\.\d+\.\d+/.test(versionedArg ?? '') ? versionedArg : undefined)
const sheets = pinned === versionedArg && versionedArg !== undefined ? sheetArgs : rest
const labelled = (template) => new URL(
  template.replace('{package}', 'x').replace('{version}', 'x').replace('{path}', 'x'),
).host

/** Fetch a package-relative path from every mirror, newest-first. */
async function fetchEverywhere(version, path, { text = false } = {}) {
  const results = []
  for (const template of DEFAULT_MIRRORS) {
    const url = template
      .replace('{package}', name)
      .replace('{version}', version)
      .replace('{path}', path)
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
      results.push({
        mirror: labelled(template),
        status: response.status,
        ...(response.ok
          ? text
            ? { body: await response.text() }
            : { bytes: (await response.arrayBuffer()).byteLength }
          : {}),
      })
    } catch (error) {
      results.push({ mirror: labelled(template), status: 0, reason: String(error).slice(0, 60) })
    }
  }
  return results
}

/** `index.css` and friends are the entry points every React/SCSS package uses. */
const ENTRY_CANDIDATES = ['index.css', 'style.css', 'font.css', 'all.css']

/** Discover stylesheet entries from the package file list. */
async function discoverSheets(version) {
  const url = `https://data.jsdelivr.com/v1/packages/npm/${name}@${version}?structure=flat`
  try {
    const listing = await (await fetch(url, { signal: AbortSignal.timeout(20_000) })).json()
    const css = (listing.files ?? [])
      .map(entry => String(entry.name).replace(/^\//, ''))
      .filter(path => path.endsWith('.css') && !path.endsWith('.min.css'))
    // A package that publishes one sheet per weight or per subset has dozens of
    // them; the entry points are the useful ones to look at first.
    const entries = ENTRY_CANDIDATES.filter(path => css.includes(path))
    const others = css.filter(path => !entries.includes(path)).slice(0, 6)
    return [...entries, ...others]
  } catch {
    return []
  }
}

const version = pinned ?? await (async () => {
  const packument = await (await fetch(`https://registry.npmmirror.com/${name}`, { signal: AbortSignal.timeout(20_000) })).json()
  if (packument.error !== undefined) throw new Error(`unknown package: ${String(packument.error)}`)
  return packument['dist-tags'].latest
})()

console.log(`${name}@${version}`)
const probes = sheets.length > 0 ? sheets : await discoverSheets(version)
if (probes.length === 0) {
  console.log('  no stylesheet to inspect — pass one explicitly, e.g. `npm run probe -- pkg@1.0.0 style.css`')
  process.exit(1)
}

let recommended
for (const sheet of probes.slice(0, 8)) {
  const found = await fetchEverywhere(version, sheet, { text: true })
  const reachable = found.filter(entry => entry.status === 200 && entry.body !== undefined)
  const body = reachable[0]?.body
  const mirrors = found.map(entry => `${entry.mirror}=${entry.status === 0 ? 'ERR' : String(entry.status)}`).join(' ')
  if (body === undefined) {
    console.log(`  ${sheet.padEnd(34)} ${mirrors}`)
    continue
  }
  const faces = (body.match(/@font-face/g) ?? []).length
  const ranges = (body.match(/unicode-range:/g) ?? []).length
  const family = /font-family:\s*['"]([^'"]+)['"]/.exec(body)?.[1] ?? '(none)'
  const reference = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(body)?.[1]
  const shard = reference === undefined
    ? '—'
    : await (async () => {
      // The reference is relative to the sheet's own directory, as the browser
      // resolves it; an `@import`-only sheet has no shard of its own.
      const directory = sheet.includes('/') ? `${sheet.slice(0, sheet.lastIndexOf('/'))}/` : ''
      const path = new URL(reference, `https://x/${directory}`).pathname.replace(/^\//, '')
      const [entry] = await fetchEverywhere(version, path)
      return entry?.status === 200 ? `${path} (${String(entry.bytes)} B)` : `${path} (${String(entry.status)})`
    })()
  const sliced = faces > 1 && faces === ranges
  const imports = (body.match(/@import/g) ?? []).length
  const verdict = faces === 0 && imports > 0
    ? `@import-only — link the imported sheet instead`
    : sliced
      ? `slice ✓ ${String(faces)} shards`
      : `NOT SLICED (${String(faces)} face(s), ${String(ranges)} ranges) — one download per subset`
  console.log(`  ${sheet.padEnd(34)} ${mirrors}`)
  console.log(`      family '${family}' · ${verdict}`)
  console.log(`      first url: ${shard}`)
  if (sliced && recommended === undefined) recommended = { sheet, family }
}

if (recommended !== undefined) {
  console.log('\nrow for src/fonts.ts (fill in id/group; then add copy in locales.ts):')
  console.log(`  {
    id: '<id>', family: '${recommended.family}', group: 'cjk',
    source: { package: '${name}', version: '${version}', sheets: ['${recommended.sheet}'] },
  },`)
  console.log('\nthen: npm run test:cdn')
} else {
  console.log('\nno sliced sheet found — do not add this package without checking why.')
  process.exitCode = 1
}
