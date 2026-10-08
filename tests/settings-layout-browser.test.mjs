import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { homedir } from 'node:os'
import { join } from 'node:path'

const url = process.env.DSH_SETTINGS_URL

test('installed settings shell: phone navigation, controls, scroll, themes and desktop restore', { skip: !url }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.DSH_MOBILE_PLAYWRIGHT ??
    join(homedir(), '.dsh/profiles/desktop/node_modules/playwright-core/index.mjs')).href)
  const browser = await chromium.launch({ executablePath: process.env.DSH_MOBILE_CHROME ??
    'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  const context = await browser.newContext({ viewport: { width: 393, height: 844 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const dialog = page.locator('[data-shortcut-modal="settings"]')
  const nav = dialog.locator('nav')
  const options = dialog.locator('[class*="_options"]')
  const resize = async (width, height = 844) => {
    // Cold-load each target width: resizing this installed host can remount its
    // sidebar/settings owner while a touch is being dispatched.
    await page.setViewportSize({ width, height })
    await page.goto(url)
    const settings = page.getByRole('button', { name: '设置', exact: true })
    if (width <= 600) await page.getByRole('button', { name: '打开侧边栏', exact: true }).tap()
    // A blank hero can asynchronously mount onboarding and close settings.
    // Select an existing started conversation, without creating or sending data.
    if (width <= 600) {
      await page.getByRole('treeitem').filter({ hasText: process.env.DSH_SETTINGS_SESSION ?? 'UI美化插件，优化设置页面样' }).first().tap()
      await page.getByRole('button', { name: '打开侧边栏', exact: true }).tap()
    }
    await settings.tap()
    await dialog.waitFor()
    errors.length = 0
  }
  const select = async name => {
    const button = nav.getByRole('button', { name, exact: true })
    await button.scrollIntoViewIfNeeded()
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await button.tap()
    await button.waitFor()
    assert.equal(await button.getAttribute('aria-current'), 'true')
  }
  try {
    await page.goto(url)
    await page.getByRole('button', { name: '打开侧边栏', exact: true }).tap()
    await page.getByRole('button', { name: '设置', exact: true }).tap()
    await dialog.waitFor()
    // The installed Pocket sidebar has unrelated legacy icon errors on cold
    // mobile startup. Track only new failures after the settings shell opens.
    errors.length = 0
    // No mock host response or temporary CSS injection: this is the installed bundle.
    assert.ok(await page.locator('style[data-plugin-css="@guowenzhang/dsh-ui-beautify/mobile-layout.css"]').textContent())
    const geometry = () => dialog.evaluate(d => {
      const n = d.querySelector('nav > [class*="_navList"]')
      const o = d.querySelector('[class*="_options"]')
      const b = d.getBoundingClientRect()
      return { display: getComputedStyle(d).display, left: b.left, right: b.right, width: innerWidth,
        optionsWidth: o.clientWidth, overflow: o.scrollWidth - o.clientWidth,
        navOverflow: n.scrollWidth > n.clientWidth, navDirection: getComputedStyle(n).flexDirection }
    })
    for (const width of [320, 360, 393, 430, 600]) {
      await resize(width)
      await select('通用设置')
      const g = await geometry()
      assert.equal(g.display, 'grid')
      assert.equal(g.navDirection, 'row')
      assert.ok(g.navOverflow)
      assert.ok(g.left >= 0 && g.right <= width)
      assert.ok(g.optionsWidth >= width - 60)
      assert.ok(g.overflow <= 1)
      const title = options.getByText('权限', { exact: true })
      const box = await title.boundingBox()
      assert.ok(box.height < 30, `horizontal permission title at ${width}px`)
      const cubeWidths = await options.locator('[class*="_themeCube"]').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().width))
      assert.equal(cubeWidths.length, 3)
      assert.ok(cubeWidths.every(w => w > 70))
      await select('界面美化')
      assert.ok((await geometry()).overflow <= 1)
      assert.equal(await options.getByRole('switch', { name: '快捷回复', exact: true }).count(), 0,
        'desktop-only quick reply setting stays out of phone accessibility tree')
      const switches = await options.getByRole('switch').evaluateAll(nodes => nodes.filter(n => n.getBoundingClientRect().width > 0).map(n => {
        const t = n.parentElement.firstElementChild.getBoundingClientRect()
        const b = n.getBoundingClientRect()
        return { textRight: t.right, switchLeft: b.left, centerDistance: Math.abs(t.y + t.height / 2 - b.y - b.height / 2) }
      }))
      assert.ok(switches.length > 0)
      assert.ok(switches.every(s => s.textRight <= s.switchLeft && s.centerDistance < 2))
      await options.evaluate(o => { o.scrollTop = o.scrollHeight })
      await options.getByPlaceholder('当前名称：DeepSeek Harness').waitFor({ state: 'visible' })
      assert.ok(await options.evaluate(o => o.scrollTop > 0))
    }
    await resize(393)
    await select('通用设置')
    // Host theme choice is browser-local. Restore its original selection.
    const cubes = options.locator('[class*="_themeCube"]')
    const originalTheme = await cubes.evaluateAll(ns => ns.findIndex(n => n.getAttribute('aria-pressed') === 'true'))
    await mkdir(new URL('../docs/images/', import.meta.url), { recursive: true })
    try {
      for (const theme of ['深色', '浅色']) {
        await options.getByRole('button', { name: theme, exact: true }).click()
        await options.getByRole('button', { name: theme, exact: true }).getAttribute('aria-pressed').then(v => assert.equal(v, 'true'))
        // Let Chromium's touch highlight fade before saving documentation.
        await page.waitForTimeout(400)
        await page.screenshot({ path: new URL(`../docs/images/settings-mobile-${theme === '浅色' ? 'light' : 'dark'}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1') })
      }
    } finally { if (originalTheme >= 0 && await dialog.isVisible()) await cubes.nth(originalTheme).tap() }
    for (const width of [601, 1280]) {
      await resize(width, 900)
      const g = await geometry()
      assert.equal(g.display, 'flex')
      assert.equal(g.navDirection, 'column')
    }
    await resize(393)
    await dialog.getByRole('button', { name: '关闭', exact: true }).tap()
    await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: '设置', exact: true }).tap()
    await dialog.waitFor()
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.deepEqual(errors, [])
  } finally { await browser.close() }
})
