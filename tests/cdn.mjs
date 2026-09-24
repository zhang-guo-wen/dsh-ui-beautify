// Registry check: fetch every catalogued face's stylesheets through each
// configured mirror and prove the two properties the route depends on — the
// sheet declares the family the catalogue names, and it is sliced into
// `unicode-range` shards rather than pointing at one whole-font file. Both roles
// are checked, since either picker can select any face in its catalogue.
//
// This is the check to run when adding a face, and it is not part of `npm test`
// because it needs the network. Run with `npm run test:cdn`.
import { downloadFile, DEFAULT_MIRRORS, FONT_ROLES } from '../lib/index.mjs'

const failures = []
const check = (label, ok, detail = '') => {
  if (ok) {
    console.log(`  ok   ${label}`)
    return
  }
  failures.push(label)
  console.log(`  FAIL ${label}${detail === '' ? '' : ` — ${detail}`}`)
}

/** Resolve a relative `url()` against the directory its sheet lives in. */
function resolveShard(sheet, reference) {
  const segments = sheet.split('/').slice(0, -1)
  for (const segment of reference.split('/')) {
    if (segment === '.' || segment === '') continue
    if (segment === '..') segments.pop()
    else segments.push(segment)
  }
  return segments.join('/')
}

/** The host a mirror template points at, for readable labels. */
function mirrorHost(template) {
  return new URL(template.replace('{package}', 'x').replace('{version}', 'x').replace('{path}', 'x')).host
}

/** Whether a sheet declares a family, whichever quote style it uses. */
function declaresFamily(css, family) {
  return new RegExp(`font-family:\\s*['"]${family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(css)
}

for (const [role, spec] of Object.entries(FONT_ROLES)) {
  for (const face of spec.faces) {
    console.log(`face ${face.id} [${role}] (${face.source.package}@${face.source.version})`)
    for (const sheet of face.source.sheets) {
      // A face has to be downloadable, not mirrored everywhere: a package the
      // npm mirror never synced is still served by the fallback, which is the
      // case for Maple Mono CN. Which mirrors answered is printed either way.
      const servedBy = []
      let text
      for (const mirror of DEFAULT_MIRRORS) {
        try {
          const bytes = await downloadFile({ source: face.source, path: sheet }, [mirror])
          servedBy.push(mirrorHost(mirror))
          if (text === undefined) text = bytes.toString('utf8')
        } catch {
          // This mirror does not carry the package; another one still may.
        }
      }
      check(`  ${sheet} is served (${servedBy.join(', ') || 'no mirror'})`, servedBy.length > 0)
      if (text === undefined) continue
      check(`  ${sheet} declares '${face.family}'`, declaresFamily(text, face.family), text.slice(0, 120))
      const declarations = (text.match(/@font-face/g) ?? []).length
      const ranges = (text.match(/unicode-range:/g) ?? []).length
      check(
        `  ${sheet} is sliced into unicode-range shards`,
        declarations > 1 && declarations === ranges,
        `${String(declarations)} faces, ${String(ranges)} ranges`,
      )
      const reference = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(text)?.[1]
      check(`  ${sheet} references a shard`, reference !== undefined && !/^(https?:|data:|\/)/.test(reference), String(reference))
      if (reference === undefined) continue
      const shard = resolveShard(sheet, reference)
      const shardBytes = await downloadFile({ source: face.source, path: shard }, DEFAULT_MIRRORS)
        .catch(error => { failures.push(`${face.id}: ${shard}`); return String(error).slice(0, 160) })
      check(
        `  ${shard} is a woff2 file`,
        Buffer.isBuffer(shardBytes) && shardBytes.subarray(0, 4).toString('latin1') === 'wOF2',
        Buffer.isBuffer(shardBytes) ? `${String(shardBytes.length)} bytes` : shardBytes,
      )
    }
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
