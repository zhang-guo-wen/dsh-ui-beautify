// Real Chromium boxes using the shipped SidebarRoot stylesheet and this plugin's built effect.
// Removing desktop row compaction must fail the Windows/macOS gap assertions.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repo = fileURLToPath(new URL('../', import.meta.url))
const workspace = join(repo, '..')
const pluginFile = join(repo, 'lib/client.js')
const hostFile = process.env.DSH_SIDEBAR_HOST_BUNDLE ?? join(workspace, 'deepseekharness/packages/client/ui-sidebar/lib/client.js')
const host = await readFile(hostFile, 'utf8')
const plugin = await readFile(pluginFile, 'utf8')
const hostCss = JSON.parse(host.match(/\bconst css = ("[^\n]+");/u)?.[1] ?? 'null')
assert.ok(hostCss?.includes('_logoRow'), 'Missing real SidebarRoot stylesheet')
const effect = plugin.slice(plugin.indexOf('\t\tconst SIDEBAR_BRAND_SELECTOR ='), plugin.indexOf('\t\tfunction applySidebarBrand('))
assert.ok(effect.includes('function installSidebarBrand()'), 'Missing built sidebar-brand effect')
const playwrightFile = process.env.DSH_TEST_PLAYWRIGHT ?? join(workspace, '.scratch/pw-core/node_modules/playwright-core/index.mjs')
const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(path => path && existsSync(path))
assert.ok(chrome, 'Set CHROME_PATH to an installed Chromium browser')
const { chromium } = await import(pathToFileURL(playwrightFile).href)
const themeFiles = ['base.css', 'design-platform.css'].map(name => join(workspace, 'deepseekharness/packages/client/ui-theme/src/styles', name))
const themeCss = (await Promise.all(themeFiles.map(path => readFile(path, 'utf8')))).join('\n')
const output = join(workspace, '.scratch/test-system/sidebar-brand-gap')
await mkdir(output, { recursive: true })
const report = { at: new Date().toISOString(), inputs: [], scenarios: [],
  scope: 'Shipped host CSS + built plugin effect in an isolated DOM fixture; no daily instance or credentials.',
  unverified: ['Actual desktop titlebar drag/hit testing', 'Native phone keyboard and safe areas', 'Authenticated desktop plugin integration'] }
for (const path of [hostFile, pluginFile, ...themeFiles]) report.inputs.push({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })
const browser = await chromium.launch({ executablePath: chrome, headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] })
report.browser = browser.version()
const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
const classFor = name => {
  const sidebarMap = host.slice(host.indexOf('var SidebarRoot_module_css_default ='))
  const value = sidebarMap.match(new RegExp(`"${name}": "([^"]+)"`))?.[1]
  assert.ok(value, `Missing host class ${name}`)
  return value
}
const c = Object.fromEntries(['root', 'logoRow', 'topStrip', 'brand', 'brandIdentity', 'brandMark', 'brandName', 'toggle', 'iconButton', 'newSession', 'collapsed'].map(name => [name, classFor(name)]))
try {
  for (const platform of ['windows', 'darwin', 'web']) {
    for (const width of [320, 360, 390, 430, 600, 601, 760, 761, 1024, 1280, 1440]) {
      for (const dark of [false, true]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: dark ? 'dark' : 'light', reducedMotion: 'reduce' })
        const label = `${platform}-${width}-${dark ? 'dark' : 'light'}`
        const result = { label, status: 'running' }
        report.scenarios.push(result)
        try {
          await page.setContent(`<style>body{margin:0} [data-slot]{display:contents} [data-fixture-shell]{height:850px;width:min(280px,100vw)} html[data-windows-titlebar] [data-fixture-shell]{margin-top:32px} :root{--dsh-windows-titlebar-height:32px}</style>
            <div data-fixture-shell><div data-slot="sidebar"><div class="${c.root}">
            ${platform === 'darwin' ? `<div class="${c.topStrip}" data-window-drag><button class="${c.iconButton} ${c.toggle}" data-sidebar-toggle>Toggle</button></div>` : ''}
            <div class="${c.logoRow}" data-window-drag><button class="${c.brand}"><span class="${c.brandIdentity}"><span class="${c.brandMark}"><img alt="Brand" width="24" height="24"></span><span class="${c.brandName}">Product</span></span></button>
            ${platform !== 'darwin' ? `<button class="${c.iconButton} ${c.toggle}" data-sidebar-toggle>Toggle</button>` : ''}</div>
            <button class="${c.newSession}" data-new-session>New Session</button><nav><button>Tasks</button><button>Whiteboard</button></nav></div></div></div>`)
          await page.evaluate(({ platform, dark }) => {
            if (platform === 'windows') document.documentElement.setAttribute('data-windows-titlebar', '')
            if (platform !== 'web') document.documentElement.setAttribute('data-platform', platform === 'windows' ? 'win32' : 'darwin')
            if (dark) document.body.setAttribute('data-ds-dark-theme', '')
            window.clicks = { toggle: 0, newSession: 0 }
            document.querySelector('[data-sidebar-toggle]').onclick = () => window.clicks.toggle++
            document.querySelector('[data-new-session]').onclick = () => window.clicks.newSession++
          }, { platform, dark })
          await page.addStyleTag({ content: themeCss + '\nbody{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}\n' + hostCss })
          await page.evaluate(script => {
            const install = new Function(`${script}\nreturn installSidebarBrand;`)()
            window.brandFixture = { install, dispose: null }
          }, effect)
          const measure = () => page.evaluate(() => {
            const rect = node => { const b = node.getBoundingClientRect(); return { top: b.top, height: b.height, bottom: b.bottom, left: b.left } }
            return { row: rect(document.querySelector('[class*="_logoRow"]')), next: rect(document.querySelector('[data-new-session]')),
              toggle: rect(document.querySelector('[data-sidebar-toggle]')), strip: document.querySelector('[class*="_topStrip"]') ? rect(document.querySelector('[class*="_topStrip"]')) : null,
              brandDisplay: getComputedStyle(document.querySelector('[class*="_logoRow"] > [class*="_brand"]')).display }
          })
          const before = await measure()
          await page.evaluate(() => { window.brandFixture.dispose = window.brandFixture.install() })
          await page.evaluate(frame)
          const hidden = await measure()
          result.before = before
          result.hidden = hidden
          if (platform === 'windows' && width === 1280 && !dark) await page.screenshot({ path: join(output, 'windows-hidden.png') })
          assert.equal(hidden.brandDisplay, 'none', `${label}: brand must be hidden`)
          assert.deepEqual(hidden.toggle, before.toggle, `${label}: toggle must not move`)
          if (platform === 'windows') {
            assert.equal(hidden.row.height, 0, `${label}: empty Windows brand row still reserves height`)
            assert.equal(before.next.top - hidden.next.top, before.row.height, `${label}: New Session must reclaim the brand row`)
          } else if (platform === 'darwin') {
            assert.equal(hidden.row.height, 0, `${label}: empty macOS brand row still reserves height`)
            assert.ok(hidden.next.top >= hidden.strip.bottom, `${label}: New Session overlaps titlebar controls`)
            assert.ok(hidden.next.top < before.next.top, `${label}: empty macOS brand space was not reclaimed`)
          } else {
            assert.deepEqual(hidden.row, before.row, `${label}: Web toggle row must be retained`)
            assert.deepEqual(hidden.next, before.next, `${label}: Web New Session must stay below toggle`)
          }
          await page.locator('[data-sidebar-toggle]').click()
          await page.locator('[data-new-session]').click()
          assert.deepEqual(await page.evaluate(() => window.clicks), { toggle: 1, newSession: 1 }, `${label}: controls must remain clickable`)
          // Hiding the brand must not remove the rail's toggle when the brand unmounts.
          await page.evaluate(classes => {
            document.querySelector('[class*="_logoRow"] > [class*="_brand"]').remove()
            document.querySelector('[data-slot="sidebar"] > div').classList.add(classes.collapsed)
          }, c)
          assert.equal(await page.locator('[data-sidebar-toggle]').isVisible(), true, `${label}: collapsed toggle hidden`)
          // Rebuild the wide brand, then release the effect and compare original geometry.
          await page.evaluate(classes => {
            document.querySelector('[data-slot="sidebar"] > div').classList.remove(classes.collapsed)
            const brand = document.createElement('button')
            brand.className = classes.brand
            brand.textContent = 'Product'
            document.querySelector('[class*="_logoRow"]').prepend(brand)
            window.brandFixture.dispose()
          }, c)
          await page.evaluate(frame)
          const restored = await measure()
          assert.deepEqual(restored.row, before.row, `${label}: disabling must restore row geometry`)
          assert.deepEqual(restored.next, before.next, `${label}: disabling must restore New Session position`)
          assert.notEqual(restored.brandDisplay, 'none', `${label}: disabling must restore brand`)
          result.status = 'passed'
        } catch (error) {
          result.status = 'failed'
          result.error = error.message
          await page.screenshot({ path: join(output, `${label}-failed.png`) })
          throw error
        } finally { await page.close() }
      }
    }
  }
  console.log(`Sidebar brand geometry: ${report.scenarios.length} scenarios passed`)
} finally {
  await browser.close()
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n')
}
