import test from 'node:test'
import assert from 'node:assert/strict'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

// The row measures the line it shares with the session-stat pills and trims the
// tags that do not fit. Its answer has to follow from the room there is: a
// measurement that leaves a brought-back tag without the class that holds a pill
// at its own width measures a squeezed row, answers "everything fits", and then
// alternates with the answer the real layout gives — the row visibly blinking
// between two counts, which is what this file exists to catch.
//
// Set DSH_QUICK_REPLY_URL (and, in a multi-workspace host, DSH_QUICK_REPLY_WORKSPACE
// plus DSH_QUICK_REPLY_SESSION) to point it at a running host. The isolated
// browser replaces only this plugin's client bundle response with the worktree
// build, so the installed plugin directory is never touched.
const url = process.env.DSH_QUICK_REPLY_URL

test('the quick-reply row holds its count while the composer width changes', { skip: !url }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.DSH_MOBILE_PLAYWRIGHT
    ?? join(homedir(), '.dsh/profiles/desktop/node_modules/playwright-core/index.mjs')).href)
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.DSH_MOBILE_CHROME
      ?? join(process.env.ProgramFiles ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
  })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route(/\/plugins\/.*dsh-ui-beautify\/client\.js/, route => route.fulfill({
      path: fileURLToPath(new URL('../lib/client.js', import.meta.url)),
      contentType: 'application/javascript',
    }))
    await page.goto(url)
    // The host remembers whether the sidebar is open; the session has to be
    // reachable either way before anything can be measured.
    const opener = page.getByRole('button', { name: '打开侧边栏', exact: true })
    if (await opener.count() > 0) {
      await opener.first().click()
      await page.waitForTimeout(300)
    }
    const workspace = process.env.DSH_QUICK_REPLY_WORKSPACE
    if (workspace !== undefined) {
      const item = page.getByRole('treeitem', { name: workspace, exact: true })
      await item.waitFor()
      if (await item.getAttribute('aria-expanded') !== 'true') await item.click()
    }
    const session = process.env.DSH_QUICK_REPLY_SESSION
    await (session === undefined
      ? page.getByRole('treeitem').filter({ hasNot: page.locator('[aria-expanded]') }).last()
      : page.getByRole('treeitem').filter({ hasText: session }).first()).click()
    // Only the visible composer's row: a session the host keeps mounted behind
    // another one renders the same row with `display: none`, and measuring that
    // one would report "no tags, no flips" for every width.
    const row = page.locator('[role="group"]:has(> button):visible').first()
    await row.waitFor({ timeout: 20000 })
    const handle = await row.elementHandle()
    assert.ok(handle !== null, 'the quick-reply row never appeared')

    /** Every frame of `ms`: the shown count, the row's box, and the tags' span. */
    const frames = ms => handle.evaluate(async (element, watch) => {
      const samples = []
      const deadline = performance.now() + watch
      while (performance.now() < deadline) {
        await new Promise(resolve => requestAnimationFrame(resolve))
        const tags = [...element.children]
        const shown = tags.filter(tag => tag.getClientRects().length > 0)
        const box = element.getBoundingClientRect()
        samples.push({
          n: shown.length,
          box: box.width,
          extent: shown.length === 0
            ? 0
            : shown.at(-1).getBoundingClientRect().right - shown[0].getBoundingClientRect().left,
        })
      }
      return samples
    }, ms)

    const summarise = samples => ({
      n: samples.at(-1).n,
      flips: samples.filter((frame, at) => at > 0 && frame.n !== samples[at - 1].n).length,
      overflow: samples.filter(frame => frame.extent > frame.box + 0.5).length,
    })

    // Each width is looked at twice: the count must not move on its own, and it
    // must not have moved by the time the second look starts. Nothing in the
    // list assumes which other columns the host keeps open at that width — the
    // host may collapse its own right sidebar, which changes the room the row
    // has without anything being wrong.
    const widths = [760, 700, 680, 660, 640, 620, 601]
    const counts = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      await page.waitForTimeout(600)
      const first = summarise(await frames(1200))
      assert.equal(first.flips, 0, `the row changes its count at rest (${width}px)`)
      assert.equal(first.overflow, 0, `a tag overflows the row's box (${width}px)`)
      await page.waitForTimeout(500)
      const second = summarise(await frames(1200))
      assert.equal(second.flips, 0, `the row changes its count at rest (${width}px)`)
      assert.equal(second.n, first.n, `the row's count moves between two looks (${width}px)`)
      counts.push({ width, ...second })
    }
    // A row that never renders a tag would satisfy every assertion above.
    assert.ok(counts.some(entry => entry.n > 0), 'the row never showed a tag')
    // A phone hides the row by media query rather than by measurement.
    await page.setViewportSize({ width: 600, height: 900 })
    await page.waitForTimeout(600)
    assert.equal(await handle.evaluate(element => element.getClientRects().length), 0,
      'a phone-width composer still shows the row')
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
  }
})
