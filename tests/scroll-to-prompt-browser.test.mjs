import test from 'node:test'
import assert from 'node:assert/strict'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const url = process.env.DSH_SCROLL_URL

test('real host up/down navigation, phone sizing, themes, and view-switch cleanup', { skip: !url }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.DSH_MOBILE_PLAYWRIGHT
    ?? join(homedir(), '.dsh/profiles/desktop/node_modules/playwright-core/index.mjs')).href)
  const browser = await chromium.launch({ headless: true, executablePath: process.env.DSH_MOBILE_CHROME
    ?? join(process.env.ProgramFiles ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe') })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    // Only this isolated test browser loads the worktree bundle. Do not overwrite
    // an installed plugin or change the host profile, especially during parallel work.
    await page.route(/\/plugins\/.*@guowenzhang\/dsh-ui-beautify\/client\.js/, route => route.fulfill({
      path: fileURLToPath(new URL('../lib/client.js', import.meta.url)), contentType: 'application/javascript',
    }))
    await page.goto(url)
    const workspace = page.getByRole('treeitem', { name: process.env.DSH_SCROLL_WORKSPACE, exact: true })
    await workspace.waitFor()
    if (await workspace.getAttribute('aria-expanded') !== 'true') await workspace.click()
    const session = page.getByRole('treeitem').filter({ hasText: process.env.DSH_SCROLL_SESSION }).first()
    await session.click()
    await page.locator('[data-chat-flow]').first().waitFor()
    const scroller = page.locator('[data-conversation-scroll]')
    const up = page.getByRole('button', { name: '回到上一条提问', exact: true })
    const down = page.getByRole('button', { name: '回到底部', exact: true })
    // The host keeps other conversations mounted behind the view, so every chip
    // locator below takes only the visible one of the open session.
    const chip = page.locator('[data-ui-beautify-session-start] button:visible')
    for (const width of [1280, 393]) {
      await page.setViewportSize({ width, height: 900 })
      await scroller.evaluate(e => { e.scrollTo({ top: e.scrollHeight, behavior: 'instant' }) })
      await up.waitFor()
      const box = await up.boundingBox()
      assert.ok(box && box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 900)
      assert.equal(box.width, 34)
      await chip.waitFor()
      const chipBox = await chip.boundingBox()
      assert.ok(chipBox && chipBox.x >= 0 && chipBox.x + chipBox.width <= width && chipBox.y >= 0, 'chip stays inside the viewport')
      assert.ok((await chip.textContent() ?? '').trim().length > 0, 'the line shows the round\'s opening text')
      await chip.click()
      await page.waitForFunction(() => !document.querySelector('[data-chat-following-tail]'))
      const landing = await page.evaluate(() => {
        const scroller = document.querySelector('[data-conversation-scroll]')
        const prompt = [...document.querySelectorAll('[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"]')]
          .filter(e => !e.closest('[hidden]') && e.getClientRects().length).at(-1)
        const line = document.querySelector('[data-ui-beautify-session-start-line]')
        return {
          promptTop: prompt.getBoundingClientRect().top,
          scrollerTop: scroller.getBoundingClientRect().top,
          scrollTop: scroller.scrollTop,
          chipBottom: line === null ? null : line.getBoundingClientRect().bottom,
        }
      })
      // With the floating chip still showing the round above, the landed prompt
      // starts below the chip, not behind it; without it the scrollport edge rules.
      const visibleTop = landing.chipBottom === null ? landing.scrollerTop : Math.max(landing.scrollerTop, landing.chipBottom)
      const offset = landing.promptTop - visibleTop
      assert.ok(offset >= -1, `landed prompt is not hidden under the floating chip: ${offset}`)
      // The first round cannot be pushed down by the inset; further rounds must sit
      // exactly at the reading inset below whatever floats above the transcript.
      if (landing.scrollTop > 0) assert.ok(Math.abs(offset - 24) < 1, `prompt reading inset below the visible top: ${offset}`)
      else assert.ok(offset <= 25, `clamped landing keeps the prompt visible: ${offset}`)
      // The click leaves the chip targeting the round before the one it landed on:
      // the line follows the reader upward instead of repeating the last target.
      if (await chip.count() > 0) {
        assert.ok(((await chip.textContent()) ?? '').trim().length > 0, 'the line follows the jump upward')
      }
      await down.click()
      await page.waitForFunction(() => !!document.querySelector('[data-chat-following-tail]'))
      const distance = await scroller.evaluate(e => e.scrollHeight - e.clientHeight - e.scrollTop)
      assert.ok(distance < 1)
    }
    const light = await up.evaluate(e => getComputedStyle(e).backgroundColor)
    await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
    const dark = await up.evaluate(e => getComputedStyle(e).backgroundColor)
    assert.notEqual(light, dark)
    await up.click()
    await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.getByRole('tab', { name: '轨迹', exact: true }).click()
    assert.equal(await up.count(), 0)
    assert.equal(await chip.count(), 0)
    await page.getByRole('tab', { name: '对话', exact: true }).click()
    await page.locator('[data-chat-flow]').first().waitFor()
    assert.equal(await page.locator('[data-slot-error]').count(), 0)
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
  }
})
