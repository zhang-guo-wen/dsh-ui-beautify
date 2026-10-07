import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { homedir } from 'node:os'
import { join } from 'node:path'

const url = process.env.DSH_MOBILE_URL

test('actual installed host phone drawer, cold touch load, breakpoints and desktop', { skip: !url }, async () => {
  const playwright = process.env.DSH_MOBILE_PLAYWRIGHT ?? join(homedir(), '.dsh/profiles/desktop/node_modules/playwright-core/index.mjs')
  const { chromium } = await import(pathToFileURL(playwright).href)
  const browser = await chromium.launch({ executablePath: process.env.DSH_MOBILE_CHROME ??
    (process.platform === 'win32' ? join(process.env.ProgramFiles ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe') : undefined), headless: true })
  const context = await browser.newContext({ viewport: { width: 393, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/119.0.0.0 Mobile Safari/537.36 MicroMessenger/8.0.50' })
  try {
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    // The phone HTTP origin can repeat the host's preview notice during catalog updates.
    // Use its real Continue action whenever it mounts; never force clicks through its mask.
    await page.addLocatorHandler(page.getByRole('dialog', { name: '预览版说明' }), async dialog => {
      await dialog.getByRole('button', { name: '继续', exact: true }).tap()
    })
    await page.goto(url)
    await page.locator('[data-mobile-layout-frame]').waitFor()
    assert.equal(await page.evaluate(() => window.__DSH_BOOT__.entries.some(x => x.id === '@guowenzhang/dsh-mobile-layout')), false)
    assert.equal(await page.locator('style[data-plugin-css="@guowenzhang/dsh-ui-beautify/mobile-layout.css"]').count(), 1)
    const notice = page.getByRole('button', { name: '继续', exact: true })
    const dialog = page.getByRole('dialog')
    try {
      await notice.waitFor({ state: 'visible', timeout: 10000 })
      await notice.click()
      await dialog.waitFor({ state: 'hidden' })
    } catch (error) {
      assert.equal(await dialog.count(), 0, `Unexpected first-run dialog: ${String(error)}`)
    }
    const geometry = () => page.evaluate(() => {
      const f = document.querySelector('[data-shell-overlay]').parentElement
      return { marked:f.hasAttribute('data-mobile-layout-frame'),closed:f.hasAttribute('data-sidebar-collapsed'),
        grid:getComputedStyle(f).gridTemplateColumns,center:f.children[1].getBoundingClientRect().width,
        sideVisibility:getComputedStyle(f.firstElementChild).visibility,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        slotErrors:document.querySelectorAll('[data-slot-error]').length }
    })
    const blankButtons = await page.locator('[data-mobile-layout-header-toggle],[data-sidebar-right-expand]').evaluateAll(nodes => nodes.map(n => {
      const box = n.getBoundingClientRect()
      return { center: box.y + box.height / 2, width: box.width, height: box.height }
    }))
    assert.equal(blankButtons.length, 2)
    assert.deepEqual(blankButtons[0], blankButtons[1], 'blank conversation top buttons align too')
    let g = await geometry()
    assert.equal(g.center, 393)
    assert.equal(g.grid, '0px 393px 0px')
    assert.equal(g.sideVisibility, 'hidden')
    assert.equal(g.slotErrors, 0)
    await page.locator('[data-mobile-layout-toggle]').tap()
    await page.waitForFunction(() => !document.querySelector('[data-mobile-layout-frame]').hasAttribute('data-sidebar-collapsed'))
    await page.locator('[data-mobile-layout-backdrop]').tap({ position: { x: 340, y: 400 } })
    await page.waitForFunction(() => document.querySelector('[data-mobile-layout-frame]').hasAttribute('data-sidebar-collapsed'))
    await page.locator('[data-mobile-layout-toggle]').tap()
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('[data-mobile-layout-frame]').hasAttribute('data-sidebar-collapsed'))
    await page.reload()
    await page.locator('[data-mobile-layout-frame]').waitFor()
    assert.equal((await geometry()).center, 393)
    await page.setViewportSize({ width: 600, height: 844 })
    await page.waitForFunction(() => innerWidth === 600 && document.querySelector('[data-mobile-layout-frame]'))
    assert.equal((await geometry()).center, 600)
    await page.setViewportSize({ width: 601, height: 844 })
    await page.waitForFunction(() => !document.querySelector('[data-mobile-layout-frame]'))
    assert.ok((await geometry()).grid.startsWith('56px'))
    // New-origin onboarding can remount after catalog refresh. Dismiss only its visible buttons.
    const continueAgain = page.getByRole('dialog').getByRole('button', { name: '继续', exact: true })
    if (await continueAgain.isVisible()) { await continueAgain.click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }) }
    // Open a real, already-existing conversation; do not create or send a prompt.
    await page.setViewportSize({ width: 393, height: 844 })
    await page.locator('[data-mobile-layout-toggle]').tap()
    assert.ok(process.env.DSH_MOBILE_WORKSPACE, 'Set DSH_MOBILE_WORKSPACE to an existing workspace name')
    assert.ok(process.env.DSH_MOBILE_SESSION_PATTERN, 'Set DSH_MOBILE_SESSION_PATTERN to an existing conversation title pattern')
    const workspace = page.getByRole('treeitem', { name: process.env.DSH_MOBILE_WORKSPACE, exact: true })
    if (await workspace.getAttribute('aria-expanded') !== 'true') await workspace.tap()
    const row = page.getByRole('treeitem').filter({ hasText: new RegExp(process.env.DSH_MOBILE_SESSION_PATTERN) }).first()
    await row.tap()
    await page.locator('[data-mobile-recent-sessions]').waitFor()
    const recent = page.locator('[data-mobile-recent-sessions] button')
    assert.ok(await recent.count() > 0 && await recent.count() <= 5)
    assert.ok((await recent.first().getAttribute('class')).split(/\s+/).some(x => x.endsWith('_tab')))
    assert.ok((await recent.allTextContents()).every(x => Array.from(x).length <= 5))
    const header = page.locator('header').filter({ has: page.locator('[data-mobile-recent-sessions]') })
    const assertAligned = async () => {
      const left = await page.locator('[data-mobile-layout-header-toggle]').boundingBox()
      const right = await header.locator('[data-sidebar-right-expand]').boundingBox()
      assert.ok(left && right)
      assert.ok(Math.abs(left.y + left.height / 2 - right.y - right.height / 2) < 1, 'top buttons share a horizontal centerline')
      assert.equal(left.width, right.width)
      assert.equal(left.height, right.height)
      assert.equal(await page.locator('[data-mobile-layout-header-toggle] svg').getAttribute('width'), '16')
    }
    await assertAligned()
    assert.equal(await recent.filter({ has: page.locator('[data-recent-session-status]') }).count(),
      await page.locator('[data-mobile-recent-sessions] button:not([data-recent-status="idle"])').count())
    assert.ok(await recent.evaluateAll(nodes => nodes.every(n => n.title.includes(' · ') && n.getAttribute('aria-label').includes(' · '))))
    assert.equal(await header.getByRole('tab', { name: '对话', exact: true }).isVisible(), false)
    assert.equal(await header.locator('[data-open-target="directory"]').isVisible(), false)
    assert.equal(await header.locator('[class*="_moreButton"]').isVisible(), false)
    if (await recent.count() > 1) {
      const before = await recent.evaluateAll(nodes => nodes.map(x => x.dataset.recentSessionId))
      for (const id of [before[1], before[0], before[1]]) {
        await page.locator(`[data-recent-session-id="${id}"]`).tap()
        await page.waitForFunction(id => document.querySelector('[data-mobile-recent-sessions] button[aria-current="page"]')?.getAttribute('data-recent-session-id') === id, id)
        assert.deepEqual(await recent.evaluateAll(nodes => nodes.map(x => x.dataset.recentSessionId)), before)
        await assertAligned()
      }
    }
    // The phone host opens the right panel fullscreen; its close control must remain reachable.
    await header.locator('[data-sidebar-right-expand]').tap()
    await page.waitForFunction(() => {
      const p = document.querySelector('[data-sidebar-right-panel][data-sidebar-right-open]')
      return p && Math.abs(p.getBoundingClientRect().left) < 1 && Math.abs(p.getBoundingClientRect().right - innerWidth) < 1
    })
    const collapseRight = page.getByRole('button', { name: '收起右侧边栏', exact: true })
    assert.equal(await collapseRight.isVisible(), true)
    await collapseRight.tap()
    await header.locator('[data-sidebar-right-expand]').waitFor({ state: 'visible' })
    await header.locator('[data-sidebar-right-expand]').tap()
    await collapseRight.tap()
    await header.locator('[data-sidebar-right-expand]').waitFor({ state: 'visible' })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.waitForFunction(() => innerWidth === 1280 && !document.querySelector('[data-mobile-layout-frame]'))
    assert.equal(await page.locator('[data-mobile-layout-toggle]').count(), 0)
    assert.equal(await header.getByRole('tab', { name: '对话', exact: true }).isVisible(), true)
    assert.equal(await header.locator('[data-open-target="directory"]').isVisible(), true)
    assert.equal(await header.locator('[class*="_moreButton"]').isVisible(), true)
    await page.setViewportSize({ width: 393, height: 844 })
    await page.waitForFunction(() => !!document.querySelector('[data-mobile-layout-frame]'))
    g = await geometry()
    assert.equal(g.center, 393)
    assert.equal(g.scrollWidth, g.width)
    assert.equal(errors.length, 0, errors.join('\n'))
    await mkdir(new URL('../.browser-test/', import.meta.url), { recursive: true })
    await page.screenshot({ path: new URL('../.browser-test/phone.png', import.meta.url).pathname.replace(/^\/(\w:)/, '$1') })
  } finally { await browser.close() }
})
