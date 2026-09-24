// Registry check: fetch every catalogued face's stylesheets through each
// configured mirror and prove the two properties the route depends on — the
// sheet declares the family the catalogue names, and it is sliced into
// `unicode-range` shards rather than pointing at one whole-font file.
//
// This is the check to run when adding a face, and it is not part of `npm test`
// because it needs the network. Run with `npm run test:cdn`.
import { downloadFile, DEFAULT_MIRRORS, FONT_FACES } from '../lib/index.mjs'

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

for (const face of FONT_FACES) {
  console.log(`face ${face.id} (${face.source.package}@${face.source.version})`)
  for (const sheet of face.source.sheets) {
    let text
    for (const [index, mirror] of DEFAULT_MIRRORS.entries()) {
      const label = new URL(mirror.replace('{package}', 'x').replace('{version}', 'x').replace('{path}', 'x')).host
      try {
        const bytes = await downloadFile({ source: face.source, path: sheet }, [mirror])
        check(`  ${sheet} via ${label}`, true)
        if (index === 0) text = bytes.toString('utf8')
      } catch (error) {
        check(`  ${sheet} via ${label}`, false, String(error).slice(0, 160))
      }
    }
    if (text === undefined) continue
    check(`  ${sheet} declares '${face.family}'`, text.includes(`font-family: '${face.family}'`), text.slice(0, 120))
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

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nall checks passed')
