import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { rolldown } from 'rolldown'

const root = fileURLToPath(new URL('../', import.meta.url))

// Real React and the source component; only the host catalog and StateDot seat
// are fixtures. Host tabs deliberately have unrelated CSS-module class names.
async function fixtureBundle() {
  const bundle = await rolldown({
    input: 'recent-fixture', platform: 'browser',
    resolve: { alias: { react: join(root, 'node_modules/react'), 'react-dom': join(root, 'node_modules/react-dom') } },
    transform: { define: { 'process.env.NODE_ENV': JSON.stringify('development') } },
    plugins: [{
      name: 'recent-fixture',
      resolveId(id) {
        if (id === 'recent-fixture' || id === '@deepseek-ai/dsh-client-ui-primitives') return '\0' + id
      },
      load(id) {
        if (id === '\0@deepseek-ai/dsh-client-ui-primitives') return 'export const StateDot = () => null'
        if (id !== '\0recent-fixture') return
        return `
          import React from 'react';
          import { createRoot } from 'react-dom/client';
          import { flushSync } from 'react-dom';
          import { MobileRecentSessions } from ${JSON.stringify(join(root, 'src/client/MobileRecentSessions.tsx'))};
          const rows = Array.from({length:5}, (_,i) => ({id:'r'+i,displayTitle:'最近会话标题'+i,updatedAt:i}));
          const list = {ids:rows.map(r=>r.id),byId:Object.fromEntries(rows.map(r=>[r.id,r]))};
          let selected = 'r4', enabled = true, empty = false;
          const root = createRoot(document.querySelector('[data-actions]'));
          const render = () => flushSync(() => root.render(enabled ? React.createElement(React.StrictMode, null,
            React.createElement(MobileRecentSessions, {
              sessionId:selected, useSessions:f=>f(empty ? {ids:[],byId:{}} : list),
              useSessionStatus:f=>f(new Map()), useWorkspaces:f=>f({archivedSessionIds:[]}),
              openSession:id=>{ selected=id; window.opens.push(id); render(); },
              t:(key, params)=>params?.title ?? key
            })) : null));
          window.opens=[]; window.removedTabs=[];
          window.fixture={
            enable:value=>{enabled=value;render()}, empty:value=>{empty=value;render()},
            tabs:value=>{
              const previous=document.querySelector('[data-conversation-tabs]');
              if(previous){previous.remove();window.removedTabs.push(previous)}
              if(value){
                const tabs=document.createElement('div'); tabs.dataset.conversationTabs='';
                tabs.innerHTML='<button role="tab" class="host-tab-z9" aria-selected="true">对话</button><button role="tab" class="host-tab-z9">轨迹</button>';
                tabs.addEventListener('click',event=>{if(event.target.matches('[role=tab]')) {
                  tabs.querySelectorAll('[role=tab]').forEach(b=>b.setAttribute('aria-selected',String(b===event.target)));
                  document.querySelector('main').textContent=event.target.textContent;
                }});
                document.querySelector('header').append(tabs);
              }
            },
            native:value=>{
              document.querySelector('.host_recentSessions')?.remove();
              if(value){const native=document.createElement('nav');native.className='host_recentSessions';native.textContent='Native recent';document.querySelector('header').append(native)}
            },
            unmount:()=>flushSync(()=>root.unmount())
          };
          render();
        `
      },
    }],
  })
  try { return (await bundle.generate({ format: 'iife' })).output[0].code }
  finally { await bundle.close() }
}

const hostCss = `
  * { box-sizing: border-box; } body { margin:0; font-family:Arial,sans-serif; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-tertiary); }
  :root { --dsw-alias-bg-base:#fff; --dsw-alias-label-tertiary:#555; --dsw-alias-state-business-primary:#245bdb; --dsw-alias-interactive-bg-hover:#eee; --dsw-font-family:Arial,sans-serif; --dsw-radius-sm:4px; }
  :root[data-theme=dark] { --dsw-alias-bg-base:#171717; --dsw-alias-label-tertiary:#bbb; --dsw-alias-state-business-primary:#83aaff; --dsw-alias-interactive-bg-hover:#333; }
  header { display:grid; grid-template-columns:auto minmax(0,1fr); padding:10px 28px 0 20px; border-bottom:1px solid #888; }
  [data-leading] { grid-column:1;grid-row:1;width:32px; }
  [data-title] { grid-column:2;display:flex;justify-content:space-between;min-height:30px; }
  [data-conversation-tabs] { grid-column:1/-1;display:flex;gap:36px;margin-top:10px;padding-left:8px; }
  .host-tab-z9 { flex:none;border:0;background:transparent;color:inherit;padding:0 0 9px;font:500 13px/16px Arial; }
  main { padding:20px; }
`

for (const width of [1200, 601, 600, 393]) {
  test(`recent sessions survive code-view lifecycle at ${width}px`, async () => {
    const { chromium } = await import(pathToFileURL(process.env.DSH_MOBILE_PLAYWRIGHT
      ?? join(homedir(), '.dsh/profiles/desktop/node_modules/playwright-core/index.mjs')).href)
    const browser = await chromium.launch({ headless: true, executablePath: process.env.DSH_MOBILE_CHROME
      ?? join(process.env.ProgramFiles ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe') })
    try {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width <= 600 })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.setContent('<header><div data-leading>☰</div><div data-title><span>Conversation</span><div data-actions></div><button data-tool>Tools</button></div></header><main>对话</main>')
      await page.addStyleTag({ content: hostCss + await readFile(new URL('../src/client/recent-sessions.css', import.meta.url), 'utf8') })
      await page.addScriptTag({ content: await fixtureBundle() })
      assert.deepEqual(errors, [])
      const strip = page.locator('[data-ui-beautify-recent]')
      const buttons = page.locator('[data-recent-session-id]')
      const verify = async (hasTabs, theme) => {
        await page.mouse.move(0, 843)
        await page.waitForFunction(({ hasTabs }) => {
          const node=document.querySelector('[data-ui-beautify-recent]')
          return node && (hasTabs ? node.parentElement.matches('[data-conversation-tabs]') : node.parentElement.matches('header'))
        }, { hasTabs })
        assert.equal(await strip.count(), 1)
        assert.equal(await page.evaluate(() => window.removedTabs.every(node => !node.hasAttribute('data-ui-beautify-recent-tabs') && !node.querySelector('[data-ui-beautify-recent]'))), true)
        assert.equal(await buttons.count(), 5)
        const geometry = await strip.evaluate(node => {
          const nav=node.firstElementChild, button=nav.firstElementChild, current=nav.querySelector('[aria-current=page]')
          const style=getComputedStyle(button), box=node.getBoundingClientRect(), h=node.closest('header'), hs=getComputedStyle(h)
          const scroller=node.parentElement.matches('[data-conversation-tabs]') ? node.parentElement : node
          return { font:style.fontSize, bg:style.backgroundColor, border:style.borderTopWidth,
            color:style.color, active:getComputedStyle(current).color, underline:getComputedStyle(current,'::after').backgroundColor,
            grid:getComputedStyle(node).gridColumn, left:box.left,right:box.right,
            contentWidth:h.clientWidth-parseFloat(hs.paddingLeft)-parseFloat(hs.paddingRight), width:box.width,
            scroll:scroller.scrollWidth>scroller.clientWidth, overflow:getComputedStyle(scroller).overflowX,
            bodyOverflow:document.documentElement.scrollWidth>innerWidth }
        })
        assert.equal(geometry.font, '13px')
        assert.equal(geometry.bg, 'rgba(0, 0, 0, 0)')
        assert.equal(geometry.border, '0px')
        assert.equal(geometry.color, theme === 'dark' ? 'rgb(187, 187, 187)' : 'rgb(85, 85, 85)')
        assert.equal(geometry.active, theme === 'dark' ? 'rgb(131, 170, 255)' : 'rgb(36, 91, 219)')
        assert.equal(geometry.underline, geometry.active)
        assert.equal(geometry.bodyOverflow, false)
        if (!hasTabs) {
          assert.equal(geometry.grid, '1 / -1')
          assert.ok(Math.abs(geometry.width-geometry.contentWidth)<1)
        }
        assert.equal(geometry.overflow, 'auto')
        if (width === 393) assert.equal(geometry.scroll, true)
        if (hasTabs) assert.equal(await page.getByRole('tab').count(), width > 600 ? 2 : 0)
        assert.equal(await page.locator('[data-tool]').isVisible(), true)
      }
      await page.waitForFunction(() => document.querySelectorAll('[data-recent-session-id]').length===5)
      await page.locator('[data-recent-session-id=r3]').click()
      await page.evaluate(() => { window.originalPortal=document.querySelector('[data-ui-beautify-recent]') })
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme=theme, theme)
        for (const hasTabs of [false, true, false, true]) {
          await page.evaluate(value => window.fixture.tabs(value), hasTabs)
          await verify(hasTabs, theme)
          assert.equal(await page.evaluate(() => window.originalPortal===document.querySelector('[data-ui-beautify-recent]')), true)
          if (hasTabs && width > 600) {
            await page.getByRole('tab', { name:'轨迹' }).click()
            assert.equal(await page.locator('main').textContent(), '轨迹')
            await page.getByRole('tab', { name:'对话', exact:true }).click()
          }
          const order=await buttons.evaluateAll(nodes=>nodes.map(n=>n.dataset.recentSessionId))
          const select=page.locator('[data-recent-session-id=r2]')
          await select.scrollIntoViewIfNeeded()
          if(width<=600) await select.tap(); else await select.click()
          assert.equal(await select.getAttribute('aria-current'), 'page')
          assert.deepEqual(await buttons.evaluateAll(nodes=>nodes.map(n=>n.dataset.recentSessionId)),order)
          await page.locator('[data-recent-session-id=r3]').click()
        }
      }
      const current = page.locator('[data-recent-session-id=r3]')
      const before = await page.evaluate(() => window.opens.length)
      await current.click()
      assert.equal(await page.evaluate(() => window.opens.length), before, 'current session is not reopened')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      assert.equal(await page.locator('[data-recent-session-id=r1]').evaluate(node => getComputedStyle(node).outlineStyle), 'solid')
      await page.keyboard.press('Enter')
      assert.equal(await page.locator('[data-recent-session-id=r1]').getAttribute('aria-current'), 'page')
      for (const resized of [1200, 600, 601, 393]) {
        await page.setViewportSize({ width: resized, height: 844 })
        assert.equal(await page.getByRole('tab').count(), resized > 600 ? 2 : 0)
        assert.equal(await strip.count(), 1)
        assert.equal(await buttons.count(), 5)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      }
      await page.evaluate(() => window.fixture.native(true))
      await strip.waitFor({ state:'detached' })
      assert.equal(await page.locator('[data-ui-beautify-recent-tabs]').count(),0)
      await page.evaluate(() => window.fixture.native(false))
      await strip.waitFor()
      await page.evaluate(() => window.fixture.empty(true))
      await strip.waitFor({ state:'detached' })
      assert.equal(await page.locator('[data-ui-beautify-recent-tabs]').count(),0)
      await page.evaluate(() => window.fixture.empty(false))
      await strip.waitFor()
      await page.evaluate(() => window.fixture.enable(false))
      assert.equal(await strip.count(),0)
      assert.equal(await page.locator('[data-ui-beautify-recent-tabs]').count(),0)
      assert.equal(await page.getByRole('tab').count(),2)
      await page.evaluate(() => window.fixture.tabs(false))
      await page.evaluate(() => window.fixture.enable(true))
      await strip.waitFor()
      await page.evaluate(() => { window.fixture.tabs(true); window.fixture.unmount() })
      await page.evaluate(() => new Promise(resolve=>requestAnimationFrame(resolve)))
      assert.equal(await strip.count(),0)
      assert.equal(await page.locator('[data-ui-beautify-recent-tabs]').count(),0)
      assert.equal(await page.getByRole('tab').count(),2)
      assert.deepEqual(errors,[])
    } finally { await browser.close() }
  })
}
