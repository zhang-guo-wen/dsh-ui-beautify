// Host-half check for the published-release row: the version ordering the row
// relies on, the two files a desktop install already carries (its feed
// coordinates and the channel manifest), and the reader that folds them into one
// answer — including the cache, the forced re-read, and every failure the row
// has to distinguish from "up to date".
// Run with `node --test tests/update-check.test.mjs` (after `npm run build`).
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  compareVersions, parseAppUpdateYaml, parseManifestVersion, readDesktopUpdateFeed,
  resolveFeedUrl, UpdateChecker, UPDATE_CACHE_MS,
} from '../lib/index.mjs'

const MANIFEST = `version: 0.2.3-alpha.4
files:
  - url: Arcuchi Harness-0.2.3-alpha.4.exe
    sha512: V6H86mqrImhx51wQoe+9EAbG7mbx+sXgU5bCW9xR9OJaNph1BLV7A4esWX2UuJHYhbhNoFEUg3MI8UMigfwYPg==
    size: 308276877
path: Arcuchi Harness-0.2.3-alpha.4.exe
sha512: V6H86mqrImhx51wQoe+9EAbG7mbx+sXgU5bCW9xR9OaNph1BLV7A4esWX2UuJHYhbhNoFEUg3MI8UMigfwYPg==
releaseDate: '2026-10-26T09:18:37.161Z'
`

const APP_UPDATE = `provider: generic
url: https://example.invalid/supporthubt/deepseekharness/prerelease/
channel: nightly
updaterCacheDirName: arcuchi-harness-updater
`

test('release versions order the way the updater ranks them', () => {
  // Only the sign is promised: callers ask "newer", not "by how much".
  const rank = (left, right) => Math.sign(compareVersions(left, right))
  assert.equal(rank('0.2.2-alpha.3', '0.2.1-rc.2.20261026.1'), 1)
  assert.equal(rank('0.2.1-rc.2.20261026.1', '0.2.2-alpha.3'), -1)
  assert.equal(rank('1.2.3', '1.2.3'), 0)
  assert.equal(rank('v1.2.3', '1.2.3'), 0)
  assert.equal(rank('1.2.3+build.7', '1.2.3'), 0)
  // A release outranks every prerelease of the same version.
  assert.equal(rank('1.0.0', '1.0.0-rc.1'), 1)
  // Prerelease identifiers: numeric compares numerically, and ranks below text.
  assert.equal(rank('1.0.0-rc.2', '1.0.0-rc.10'), -1)
  assert.equal(rank('1.0.0-alpha.1', '1.0.0-alpha.beta'), -1)
  // A shorter identifier list loses to its own prefix.
  assert.equal(rank('1.0.0-alpha', '1.0.0-alpha.1'), -1)
  // Missing components are zeros, and a malformed side compares equal so the
  // row reports "nothing newer" rather than an upgrade that can never install.
  assert.equal(rank('1.2', '1.2.0'), 0)
  assert.equal(rank('not-a-version', '1.2.3'), 0)
})

test('the channel manifest names the published release', () => {
  assert.equal(parseManifestVersion(MANIFEST), '0.2.3-alpha.4')
  assert.equal(parseManifestVersion('files:\n  - url: x\n'), undefined)
  assert.equal(parseManifestVersion(''), undefined)
})

test('the shell app-update file names the feed the channel resolves to', () => {
  assert.deepEqual(parseAppUpdateYaml(APP_UPDATE), {
    url: 'https://example.invalid/supporthubt/deepseekharness/prerelease/',
    channel: 'nightly',
    manifest: 'nightly.yml',
  })
  // A missing trailing slash is added, so the join below stays a real URL.
  assert.equal(parseAppUpdateYaml('url: https://example.invalid/releases\n')?.url,
    'https://example.invalid/releases/')
  // No channel means the updater's default channel.
  assert.equal(parseAppUpdateYaml('url: https://example.invalid/r/\n')?.manifest, 'latest.yml')
  assert.equal(parseAppUpdateYaml('provider: generic\n'), undefined)
})

test('the manifest URL comes from the configuration first, then the shell', () => {
  const shell = parseAppUpdateYaml(APP_UPDATE)
  assert.equal(resolveFeedUrl('https://configured.invalid/latest.yml', shell),
    'https://configured.invalid/latest.yml')
  assert.equal(resolveFeedUrl('', shell),
    'https://example.invalid/supporthubt/deepseekharness/prerelease/nightly.yml')
  assert.equal(resolveFeedUrl('   ', undefined), undefined)
  // A configured value that is not a URL is ignored rather than fetched.
  assert.equal(resolveFeedUrl('file:///etc/passwd', shell), undefined)
})

test('a packaged desktop resource tree supplies the feed', async () => {
  const windows = mkdtempSync(join(tmpdir(), 'dsh-update-win-'))
  const mac = mkdtempSync(join(tmpdir(), 'dsh-update-mac-'))
  const bare = mkdtempSync(join(tmpdir(), 'dsh-update-bare-'))
  try {
    mkdirSync(join(windows, 'resources'))
    writeFileSync(join(windows, 'resources', 'app-update.yml'), APP_UPDATE)
    assert.equal((await readDesktopUpdateFeed(join(windows, 'Arcuchi Harness.exe')))?.manifest, 'nightly.yml')

    // A macOS bundle keeps the same file one level above the executable. The
    // two layouts are separate temp roots: Windows resolves `resources` and
    // `Resources` to the same directory, so one tree cannot prove both.
    mkdirSync(join(mac, 'Contents', 'MacOS'), { recursive: true })
    mkdirSync(join(mac, 'Contents', 'Resources'), { recursive: true })
    writeFileSync(join(mac, 'Contents', 'Resources', 'app-update.yml'), APP_UPDATE)
    assert.equal((await readDesktopUpdateFeed(join(mac, 'Contents', 'MacOS', 'App')))?.manifest, 'nightly.yml')

    // No such file is the ordinary answer for a Web install.
    assert.equal(await readDesktopUpdateFeed(join(bare, 'bin', 'node.exe')), undefined)
  } finally {
    for (const root of [windows, mac, bare]) rmSync(root, { recursive: true, force: true })
  }
})

/** A transport that answers from a table and counts what it was asked. */
function transportFor(answer) {
  const asked = []
  const transport = async (url) => {
    asked.push(url)
    if (answer instanceof Error) throw answer
    return { ok: answer.ok, status: answer.status ?? 200, text: async () => answer.text }
  }
  return { asked, transport }
}

test('a published release newer than this install is reported as an update', async () => {
  const { asked, transport } = transportFor({ ok: true, text: MANIFEST })
  const checker = new UpdateChecker({
    current: '0.2.2-alpha.3',
    resolveFeed: async () => 'https://example.invalid/nightly.yml',
    fetchText: transport,
    now: () => 1_000,
  })
  const status = await checker.status()
  assert.deepEqual(status, {
    state: 'ok',
    current: '0.2.2-alpha.3',
    latest: '0.2.3-alpha.4',
    hasUpdate: true,
    feed: 'https://example.invalid/nightly.yml',
    checkedAt: 1_000,
  })
  assert.deepEqual(asked, ['https://example.invalid/nightly.yml'])
})

test('an install at the published release has nothing to upgrade to', async () => {
  const { transport } = transportFor({ ok: true, text: MANIFEST })
  const checker = new UpdateChecker({
    current: '0.2.3-alpha.4', resolveFeed: async () => 'https://example.invalid/nightly.yml', fetchText: transport,
  })
  const status = await checker.status()
  assert.equal(status.state, 'ok')
  assert.equal(status.hasUpdate, false)
})

test('one reading answers the next one until it ages or is forced', async () => {
  let clock = 1_000
  const { asked, transport } = transportFor({ ok: true, text: MANIFEST })
  const checker = new UpdateChecker({
    current: '0.2.2-alpha.3',
    resolveFeed: async () => 'https://example.invalid/nightly.yml',
    fetchText: transport,
    now: () => clock,
  })
  await checker.status()
  await checker.status()
  assert.equal(asked.length, 1)
  clock += UPDATE_CACHE_MS + 1
  await checker.status()
  assert.equal(asked.length, 2)
  await checker.status(true)
  assert.equal(asked.length, 3)
})

test('concurrent readers share one request', async () => {
  const { asked, transport } = transportFor({ ok: true, text: MANIFEST })
  const checker = new UpdateChecker({
    current: '0.2.2-alpha.3', resolveFeed: async () => 'https://example.invalid/nightly.yml', fetchText: transport,
  })
  const answers = await Promise.all([checker.status(), checker.status(), checker.status()])
  assert.equal(asked.length, 1)
  assert.ok(answers.every(answer => answer.hasUpdate))
})

test('a host with no feed reports unavailable rather than an answer', async () => {
  const checker = new UpdateChecker({ current: '0.2.2-alpha.3', resolveFeed: async () => undefined })
  const status = await checker.status()
  assert.equal(status.state, 'unavailable')
  assert.equal(status.latest, null)
  assert.equal(status.hasUpdate, false)
})

test('an unreachable or unreadable feed reports a failed check', async () => {
  const unreachable = new UpdateChecker({
    current: '0.2.2-alpha.3',
    resolveFeed: async () => 'https://example.invalid/nightly.yml',
    fetchText: transportFor(new Error('offline')).transport,
  })
  assert.equal((await unreachable.status()).state, 'failed')

  const missing = new UpdateChecker({
    current: '0.2.2-alpha.3',
    resolveFeed: async () => 'https://example.invalid/nightly.yml',
    fetchText: transportFor({ ok: false, status: 404, text: '' }).transport,
  })
  assert.equal((await missing.status()).state, 'failed')

  // A 200 that is not a manifest — a proxy's error page, say — must not be read
  // as a release.
  const garbage = new UpdateChecker({
    current: '0.2.2-alpha.3',
    resolveFeed: async () => 'https://example.invalid/nightly.yml',
    fetchText: transportFor({ ok: true, text: '<html>not found</html>' }).transport,
  })
  const status = await garbage.status()
  assert.equal(status.state, 'failed')
  assert.equal(status.hasUpdate, false)
})

test('a build without a version never announces an upgrade', async () => {
  const { transport } = transportFor({ ok: true, text: MANIFEST })
  const checker = new UpdateChecker({
    current: undefined, resolveFeed: async () => 'https://example.invalid/nightly.yml', fetchText: transport,
  })
  const status = await checker.status()
  assert.equal(status.state, 'ok')
  assert.equal(status.current, null)
  assert.equal(status.hasUpdate, false)
})
