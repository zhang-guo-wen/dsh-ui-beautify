// Chromium regression over the built update row, real React/Button and host version CSS.
// This fixture is not an authenticated Harness or native desktop update test.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { rolldown } from 'rolldown'
import { transform } from 'lightningcss'

const repo = fileURLToPath(new URL('../', import.meta.url))
const workspace = join(repo, '..')
const host = join(process.env.DSH_HARNESS_ROOT ?? join(workspace, 'deepseekharness'), 'packages/client')
const require = createRequire(import.meta.url)
const pluginPath = join(repo, 'lib/client.js')
const plugin = await readFile(pluginPath, 'utf8')
const componentStart = plugin.indexOf('\t\tfunction detailOf(state, t)')
const componentEnd = plugin.indexOf('\t\t//#endregion', componentStart)
const cssStart = plugin.lastIndexOf('\t\tconst css', componentStart)
const cssEnd = plugin.indexOf('\t\t//#endregion', cssStart)
assert.ok(componentStart > 0 && cssStart > 0 && componentEnd > componentStart)
const rowCode = plugin.slice(cssStart, cssEnd) + plugin.slice(componentStart, componentEnd)
const inputs = new Set([pluginPath])
const bundle = await rolldown({
  input: 'update-fixture', platform: 'browser',
  transform: { define: { 'process.env.NODE_ENV': '"production"', 'process.env.DSH_CLIENT_VERSION': '"0.2.2-alpha.3"' } },
  plugins: [{
    name: 'real-update-fixture',
    resolveId(id, importer) {
      if (id === 'update-fixture') return '\0update-fixture'
      if (/^(react|react-dom)(\/|$)/u.test(id)) return require.resolve(id)
      if (id.endsWith('.module.css')) return '\0css:' + join(dirname(importer), id) + '.mjs'
    },
    async load(id) {
      if (id === '\0update-fixture') return `
        import * as react from ${JSON.stringify(require.resolve('react'))}
        import * as react_jsx_runtime from ${JSON.stringify(require.resolve('react/jsx-runtime'))}
        import { createRoot } from ${JSON.stringify(require.resolve('react-dom/client'))}
        import { Button } from ${JSON.stringify(join(host, 'ui-primitives/src/Button.tsx'))}
        import { CurrentVersionRow } from ${JSON.stringify(join(host, 'ui-settings-general/src/client/CurrentVersionRow.tsx'))}
        const _deepseek_ai_dsh_client_ui_primitives = { Button }
        ${rowCode}
        const root = createRoot(document.querySelector('#fixture'))
        window.upgrades = 0
        window.renderUpdate = (phase, hasUpdate, text, canUpgrade = true) => root.render(
          react.createElement('div', { 'data-slot': 'settings.general.item' },
            react.createElement(CurrentVersionRow, { t: (_, p) => '当前版本：' + p.version }),
            react.createElement(UpdateVersionRow, {
              useUpdate: select => select({phase, hasUpdate, latest: '0.2.3'}),
              checkUpdate() {}, openUpgrade() { window.upgrades++ }, canUpgrade,
              t: key => key === 'updateAction' ? '升级' : text
            })))
      `
      if (id.startsWith('\0css:')) {
        const path = id.slice(5, -4)
        inputs.add(path)
        const compiled = transform({ filename: path, code: await readFile(path), cssModules: { pattern: '[hash]_[local]' } })
        const names = Object.fromEntries(Object.entries(compiled.exports).map(([key, value]) => [key, value.name]))
        return `const tag = document.createElement('style'); tag.textContent = ${JSON.stringify(String(compiled.code))}; document.head.appendChild(tag); export default ${JSON.stringify(names)}`
      }
    },
  }],
})
const { output: chunks } = await bundle.generate({ format: 'iife' })
await bundle.close()
const script = chunks.find(chunk => chunk.type === 'chunk').code
const themeFiles = ['base.css', 'design-platform.css', 'gradient-shadow-text.css'].map(name => join(host, 'ui-theme/src/styles', name))
const theme = (await Promise.all(themeFiles.map(path => readFile(path, 'utf8')))).join('\n')
for (const path of themeFiles) inputs.add(path)
const out = join(workspace, '.scratch/test-system/update-alignment', new Date().toISOString().replaceAll(':', '-'))
await mkdir(out, { recursive: true })
const report = { at: new Date().toISOString(), node: process.version, inputs: [], scenarios: [],
  scope: 'Built plugin component and CSS with real React, host Button and CurrentVersionRow in a browser fixture',
  unverified: ['Authenticated npm Harness (isolated alpha.3 returned 401 without printed authentication URL)', 'Native desktop upgrade window/download/restart', 'Physical touch devices, keyboards and safe areas', 'Multiline installed-version title'] }
for (const path of inputs) report.inputs.push({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })
const { chromium } = await import(pathToFileURL(process.env.DSH_TEST_PLAYWRIGHT ?? join(workspace, '.scratch/pw-core/node_modules/playwright-core/index.mjs')).href)
const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(path => path && existsSync(path))
const browser = await chromium.launch({ executablePath: chrome, headless: true })
report.browser = browser.version()
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
try {
  for (const touch of [false, true]) for (const dark of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 700 }, hasTouch: touch, colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setContent(`<style>${theme}\nbody{margin:0;font-family:var(--dsw-font-family);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}#fixture{width:min(560px,calc(100% - 40px));margin:24px auto}[data-slot]{display:contents}</style><main id="fixture"></main>`)
    if (dark) await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
    await page.addScriptTag({ content: script })
    for (const width of [320, 360, 390, 430, 600, 601, 760, 761, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 700 })
      for (const [phase, available, text] of [['ready', false, '已是最新版本'], ['ready', true, '最新版本：0.2.3'], ['loading', false, '正在检查更新…'], ['failed', false, '无法获取最新版本'], ['ready', true, '最新版本：0.2.3-alpha.20261105-with-a-long-release-identifier']]) {
        await page.evaluate(args => window.renderUpdate(...args), [phase, available, text])
        await settle(page)
        const g = await page.evaluate(() => {
          const update = document.querySelector('[data-ui-beautify-update]')
          const title = update.previousElementSibling
          const detail = update.querySelector('[role=status]')
          const button = update.querySelector('button')
          const r = node => { const b = node.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, height: b.height } }
          const titleStyle = getComputedStyle(title)
          const titleTop = title.getBoundingClientRect().top + parseFloat(titleStyle.paddingTop)
          const titleBottom = title.getBoundingClientRect().bottom - parseFloat(titleStyle.paddingBottom)
          const detailTop = detail.getBoundingClientRect().top + parseFloat(getComputedStyle(detail).paddingTop)
          const b = r(button), d = r(detail)
          return { titleTop, titleBottom, detailTop, button: b, detail: d,
            offset: (b.top + b.bottom) / 2 - (titleTop + d.bottom) / 2,
            gap: detailTop - titleBottom, disabled: button.disabled,
            overflow: document.querySelector('#fixture').scrollWidth - document.querySelector('#fixture').clientWidth }
        })
        const scenario = { width, touch, dark, phase, available, text, ...g }
        report.scenarios.push(scenario)
        if (width === 1280 && phase === 'ready' && !available) await page.screenshot({ path: join(out, `current-${touch ? 'touch' : 'mouse'}-${dark ? 'dark' : 'light'}.png`) })
        if (Math.abs(g.offset) > 1 || Math.abs(g.gap - 4) > 1) {
          await page.screenshot({ path: join(out, 'failure.png') })
          assert.fail(`Upgrade must center on the version + status block: ${JSON.stringify(scenario)}`)
        }
        assert.ok(g.overflow <= 1, 'No horizontal overflow')
        assert.ok(g.button.left >= g.detail.right + 11, 'Status must not overlap upgrade')
        assert.equal(g.disabled, !available)
        assert.equal(g.button.height, touch ? 44 : 28)
        if (available) {
          const before = await page.evaluate(() => window.upgrades)
          await page.getByRole('button', { name: '升级' }).click()
          assert.equal(await page.evaluate(() => window.upgrades), before + 1)
        }
      }
    }
    await page.evaluate(() => window.renderUpdate('ready', true, '最新版本：0.2.3', false))
    await settle(page)
    assert.equal(await page.getByRole('button', { name: '升级' }).isDisabled(), true)
    await page.evaluate(() => window.renderUpdate('unavailable', false, ''))
    await settle(page)
    assert.equal(await page.locator('[data-ui-beautify-update]').count(), 0)
    assert.deepEqual(errors, [])
    await page.close()
  }
  report.passed = true
  console.log(`PASS ${report.scenarios.length} geometry/state cases; ${out}`)
} finally {
  await browser.close()
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`Evidence: ${out}`)
}
