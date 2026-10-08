import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { homedir } from 'node:os'
import { join } from 'node:path'

const url = process.env.DSH_FILE_COPY_URL
const session = process.env.DSH_FILE_COPY_SESSION

test('remote Pocket copy buttons stay beside changed-file rows at phone widths', { skip: !url || !session }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.DSH_MOBILE_PLAYWRIGHT ??
    join(homedir(), '.dsh/profiles/desktop/node_modules/playwright-core/index.mjs')).href)
  const browser = await chromium.launch({ executablePath: process.env.DSH_MOBILE_CHROME ??
    'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  try {
    for (const width of [320, 393, 600]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })
      const page = await context.newPage()
      await page.addLocatorHandler(page.getByRole('dialog', { name: '预览版说明' }), async dialog => {
        await dialog.getByRole('button', { name: '继续', exact: true }).tap()
      })
      await page.goto(url)
      await page.getByRole('button', { name: '打开侧边栏', exact: true }).tap()
      await page.getByRole('treeitem').filter({ hasText: session }).first().tap()
      const card = page.locator('[data-changed-files]').first()
      await card.waitFor()
      await card.scrollIntoViewIfNeeded()
      await card.locator('[data-mobile-nav="copy-file"]').first().waitFor()
      const measure = () => card.locator('li').evaluateAll(nodes => nodes.map(n => {
        const row = n.querySelector('[data-mobile-nav-copy]')
        const copy = n.querySelector('[data-mobile-nav="copy-file"]')
        const path = row.querySelector('[class*="_path"]')
        const count = row.querySelector('[class*="_counts"]')
        const a = row.getBoundingClientRect(), b = copy.getBoundingClientRect(), c = n.getBoundingClientRect()
        return { centerDiff: Math.abs(a.y + a.height / 2 - b.y - b.height / 2), right: b.right, end: c.right,
          overlap: a.right > b.left, height: c.height, width: b.width, copyHeight: b.height,
          border: getComputedStyle(copy).borderWidth, ellipsis: getComputedStyle(path).textOverflow,
          countEnd: count.getBoundingClientRect().right, rowEnd: a.right }
      }))
      const check = async () => {
        const rows = await measure()
        assert.ok(rows.length > 0)
        for (const r of rows) {
          assert.ok(r.centerDiff < 1 && !r.overlap && r.right <= r.end)
          assert.equal(r.height, 44)
          assert.ok(r.width >= 44 && r.copyHeight >= 44)
          assert.equal(r.border, '0px')
          assert.equal(r.ellipsis, 'ellipsis')
          assert.ok(r.countEnd <= r.rowEnd)
        }
      }
      await check()
      await card.getByRole('button', { name: /展开全部/ }).tap()
      await check()
      // Narrow-layout stress: change visible path only, never invoke copy on this
      // test text or touch the host's recorded summary.
      const path = card.locator('[data-mobile-nav-copy] [class*="_path"]').first()
      const text = await path.textContent()
      await path.evaluate(n => { n.textContent = '目录/'.repeat(80) + 'very-long-file-name.ts' })
      await check()
      await path.evaluate((n, value) => { n.textContent = value }, text)
      // Desktop must not receive this phone reflow, even if Pocket leaves a node.
      await page.setViewportSize({ width: 1280, height: 900 })
      assert.equal(await page.evaluate(() => matchMedia('(max-width: 600px)').matches), false)
      await context.close()
    }
  } finally { await browser.close() }
})
