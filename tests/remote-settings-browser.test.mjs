import test from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { homedir } from 'node:os'
import { join } from 'node:path'

const url = process.env.DSH_MOBILE_URL
const local = process.env.DSH_SETTINGS_LOCAL_URL ?? 'http://127.0.0.1:3081/'
test('remote settings match Host and stay read-only while loopback writes propagate', { skip: !url }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.DSH_MOBILE_PLAYWRIGHT ?? join(homedir(), '.dsh/profiles/desktop/node_modules/playwright-core/index.mjs')).href)
  const browser = await chromium.launch({ executablePath: process.env.DSH_MOBILE_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
  let before
  let changed = false
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const call = async (origin, method, args = {}) => {
    const response = await context.request.post(new URL('/api/' + method, origin).href, { data: {
      type: 'client-request', rpcId: 'remote-settings-test-' + Date.now(), method, payload: { args },
    } })
    const result = (await response.json()).result
    assert.equal(result.ok, true, JSON.stringify(result.error))
    return result.value
  }
  try {
    const page = await context.newPage()
    const errors = []
    const writes = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('request', r => { if (/\/api\/(settings\/(?:mutate|update|replace|openSettingsDocument)|credentials\/(?!describe(?:$|\?)))/.test(r.url())) writes.push(r.url()) })
    await page.addLocatorHandler(page.getByRole('dialog', { name: '预览版说明' }), async dialog => { await dialog.getByRole('button', { name: '继续', exact: true }).click() })
    // Complete normal browser authentication before making same-origin API requests.
    await page.goto(local)
    await page.locator('button[aria-label="设置"]').waitFor()
    before = (await call(local, 'settings/describe')).namespaces.find(x => x.ns === 'ui-beautify')
    await page.goto(url)
    const preview = page.getByRole('dialog', { name: '预览版说明' })
    try {
      await preview.waitFor({ state: 'visible', timeout: 5000 })
      await preview.getByRole('button', { name: '继续', exact: true }).click()
      await preview.waitFor({ state: 'hidden' })
    } catch { assert.equal(await preview.isVisible(), false) }
    await page.getByRole('button', { name: '设置', exact: true }).click()
    await page.getByRole('button', { name: '界面美化', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '设置' })
    await dialog.getByRole('button', { name: 'JetBrains Mono', exact: true }).waitFor()
    assert.equal(await dialog.getByRole('button', { name: 'JetBrains Mono', exact: true }).isDisabled(), true)
    assert.ok((await dialog.innerText()).includes('设置文档为只读'))
    assert.ok(!(await dialog.innerText()).includes('宿主设置服务不可用'))
    assert.ok((await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--ds-font-family-code'))).includes('JetBrains Mono'))
    const nextFont = before.value.codeFont === 'fira-code' ? 'jetbrains-mono' : 'fira-code'
    await call(local, 'settings/update', { ns: 'ui-beautify', patch: { codeFont: nextFont }, expectedRevision: before.revision })
    changed = true
    await dialog.getByRole('button', { name: nextFont === 'fira-code' ? 'Fira Code' : 'JetBrains Mono', exact: true }).waitFor()
    assert.ok((await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--ds-font-family-code'))).includes(nextFont === 'fira-code' ? 'Fira Code' : 'JetBrains Mono'))
    const current = (await call(local, 'settings/describe')).namespaces.find(x => x.ns === 'ui-beautify')
    await call(local, 'settings/replace', { ns: 'ui-beautify', section: before.user, expectedRevision: current.revision })
    changed = false
    await dialog.getByRole('button', { name: 'JetBrains Mono', exact: true }).waitFor()
    await page.getByRole('button', { name: '通用设置', exact: true }).click()
    assert.equal(await dialog.getByRole('button', { name: '完全权限', exact: true }).isDisabled(), true)
    assert.equal(writes.length, 0, writes.join('\n'))
    assert.equal(errors.length, 0, errors.join('\n'))
    const restored = (await call(local, 'settings/describe')).namespaces.find(x => x.ns === 'ui-beautify')
    assert.deepEqual(restored.value, before.value)
    assert.deepEqual(restored.user, before.user)
  } finally {
    if (changed && before) {
      const current = (await call(local, 'settings/describe')).namespaces.find(x => x.ns === 'ui-beautify')
      await call(local, 'settings/replace', { ns: 'ui-beautify', section: before.user, expectedRevision: current.revision })
    }
    await browser.close()
  }
})
