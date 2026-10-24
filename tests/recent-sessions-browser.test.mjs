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
                // The host renders its view tabs before the plugin layer.
                const header=document.querySelector('header');
                const layer=header.querySelector('[data-ui-beautify-recent]');
                if(layer) header.insertBefore(tabs, layer); else header.append(tabs);
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
  :root {
    --dsw-alias-bg-base:#fff; --dsw-alias-bg-layer-1:#fff; --dsw-alias-label-tertiary:#555;
    --dsw-alias-label-caption:#888; --dsw-alias-border-l2:rgba(0,0,0,.1); --dsw-alias-border-l4:rgba(0,0,0,.16);
    --dsw-alias-state-business-primary:#245bdb; --dsw-alias-interactive-bg-hover:#eee;
    --dsw-alias-state-idle-primary:#ccc; --dsw-font-family:Arial,sans-serif; --dsw-radius-sm:4px;
    --dsw-focus-ring-width:2px;
    --dsw-elevation-soft:0 0 0 .5px rgba(0,0,0,.1), 0 4px 16px 0 rgba(0,0,0,.03);
    --ds-transition-duration:.2s; --ds-transition-duration-fast:.1s; --ds-ease-in-out:cubic-bezier(.4,0,.2,1);
  }
  :root[data-theme=dark] {
    --dsw-alias-bg-base:#171717; --dsw-alias-bg-layer-1:#2a2a2a; --dsw-alias-label-tertiary:#bbb;
    --dsw-alias-label-caption:#999; --dsw-alias-border-l2:rgba(255,255,255,.12); --dsw-alias-border-l4:rgba(255,255,255,.2);
    --dsw-alias-state-business-primary:#83aaff; --dsw-alias-interactive-bg-hover:#333;
    --dsw-alias-state-idle-primary:#666;
    --dsw-elevation-soft:0 0 0 .5px rgba(255,255,255,.2), 0 4px 16px 0 rgba(0,0,0,.4);
  }
  header { display:grid; grid-template-columns:auto minmax(0,1fr); padding:10px 28px 0 20px; border-bottom:1px solid #888; }
  [data-leading] { grid-column:1;grid-row:1;width:32px; }
  [data-title] { grid-column:2;display:flex;justify-content:space-between;min-height:30px; }
  [data-conversation-tabs] { grid-column:1/-1;display:flex;gap:36px;margin-top:10px;padding-left:8px; }
  .host-tab-z9 { flex:none;border:0;background:transparent;color:inherit;padding:0 0 9px;font:500 13px/16px Arial; }
  main { padding:20px; }
`

const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

for (const width of [1200, 601, 600, 393]) {
  test(`hemp-line recent sessions keep host tabs at ${width}px`, async () => {
    const { chromium } = await import(pathToFileURL(process.env.DSH_MOBILE_PLAYWRIGHT
      ?? join(homedir(), '.dsh/profiles/desktop/node_modules/playwright-core/index.mjs')).href)
    const browser = await chromium.launch({ headless: true, executablePath: process.env.DSH_MOBILE_CHROME
      ?? join(process.env.ProgramFiles ?? 'C:/Program Files', 'Google/Chrome/Application/chrome.exe') })
    const desktop = width > 600
    try {
      const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: !desktop })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.setContent('<header><div data-leading>☰</div><div data-title><span>Conversation</span><div data-actions></div><button data-tool>Tools</button></div></header><main>对话</main>')
      await page.addStyleTag({ content: hostCss + await readFile(new URL('../src/client/recent-sessions.css', import.meta.url), 'utf8') })
      await page.addScriptTag({ content: await fixtureBundle() })
      assert.deepEqual(errors, [])
      const strip = page.locator('[data-ui-beautify-recent]')
      const buttons = page.locator('[data-recent-session-id]')
      await page.waitForFunction(() => document.querySelectorAll('[data-recent-session-id]').length === 5)
      await page.evaluate(() => { window.originalPortal = document.querySelector('[data-ui-beautify-recent]') })

      const geometry = () => strip.evaluate(node => {
        const header = node.closest('header')
        const nav = node.querySelector('nav')
        const all = [...nav.querySelectorAll('[data-recent-session-id]')]
        const first = all[0]
        const middle = all[Math.floor(all.length / 2)]
        const current = nav.querySelector('[aria-current=page]')
        const idle = all.find(button => button !== current) ?? first
        const card = first.querySelector('[data-recent-session-card]')
        const svg = node.querySelector('[data-ui-beautify-recent-rope]')
        const path = svg.querySelector('path')
        const layerBox = node.getBoundingClientRect()
        const headerBox = header.getBoundingClientRect()
        const firstBox = first.getBoundingClientRect()
        const lastBox = all.at(-1).getBoundingClientRect()
        const translateY = element => {
          const value = getComputedStyle(element).transform
          if (!value || value === 'none') return 0
          const match = value.match(/matrix\(([^)]+)\)/)
          return match ? parseFloat(match[1].split(',')[5]) : 0
        }
        const tabs = [...header.querySelectorAll('[data-conversation-tabs] [role=tab]')]
        return {
          parentIsHeader: node.parentElement === header,
          bodyOverflow: document.documentElement.scrollWidth > innerWidth,
          layerLeft: layerBox.left, layerRight: layerBox.right,
          layerCenter: layerBox.left + layerBox.width / 2, layerWidth: layerBox.width,
          headerLeft: headerBox.left, headerRight: headerBox.right,
          clusterLeft: firstBox.left, clusterRight: lastBox.right,
          clusterCenter: (firstBox.left + lastBox.right) / 2,
          color: getComputedStyle(idle).color,
          active: current ? getComputedStyle(current).color : null,
          underline: current ? getComputedStyle(current, '::after').backgroundColor : null,
          cardShadow: getComputedStyle(card).boxShadow,
          cardRadius: getComputedStyle(card).borderRadius,
          ropeDisplay: getComputedStyle(svg).display,
          ropeWidth: Number(svg.getAttribute('width') ?? 0),
          path: path ? path.getAttribute('d') : null,
          fit: header.getAttribute('data-ui-beautify-recent-fit'),
          tabsVisible: tabs.filter(tab => tab.checkVisibility()).length,
          firstDrop: translateY(first), middleDrop: translateY(middle),
          scroll: node.scrollWidth > node.clientWidth + 1,
        }
      })

      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
        for (const hasTabs of [false, true, false, true]) {
          await page.evaluate(value => window.fixture.tabs(value), hasTabs)
          await page.waitForFunction(() => document.querySelector('[data-ui-beautify-recent]'))
          await page.evaluate(frame)
          assert.equal(await strip.count(), 1)
          assert.equal(await buttons.count(), 5)
          assert.equal(await page.evaluate(() => window.originalPortal === document.querySelector('[data-ui-beautify-recent]')), true)
          assert.equal(await page.evaluate(() => window.removedTabs.every(node => !node.hasAttribute('data-ui-beautify-recent-tabs') && !node.querySelector('[data-ui-beautify-recent]'))), true)
          const g = await geometry()
          assert.equal(g.parentIsHeader, true)
          assert.equal(g.bodyOverflow, false)
          assert.equal(g.color, theme === 'dark' ? 'rgb(187, 187, 187)' : 'rgb(85, 85, 85)')
          assert.equal(g.active, theme === 'dark' ? 'rgb(131, 170, 255)' : 'rgb(36, 91, 219)')
          assert.equal((await page.locator('[data-recent-session-title]').allTextContents()).every(text => Array.from(text).length <= 5), true)
          if (desktop) {
            assert.equal(g.ropeDisplay, 'block')
            assert.match(g.path ?? '', /^M 2 3 Q [\d.]+ [\d.]+ [\d.]+ 3$/)
            assert.ok(Math.abs(g.layerLeft - g.headerLeft) < 1, `line reaches the header's left edge (${g.layerLeft} vs ${g.headerLeft})`)
            assert.ok(Math.abs(g.layerRight - g.headerRight) < 1, `line reaches the header's right edge (${g.layerRight} vs ${g.headerRight})`)
            assert.ok(Math.abs(g.ropeWidth - g.layerWidth) < 1)
            assert.ok(Math.abs(g.layerCenter - g.clusterCenter) < 1.5, 'tags stay centered on the line')
            assert.equal(g.tabsVisible, hasTabs ? 2 : 0)
            if (!hasTabs) assert.equal(g.fit, 'solo')
            else assert.equal(g.fit, width === 1200 ? 'band' : 'stack')
            assert.notEqual(g.cardShadow, 'none')
            assert.equal(g.cardRadius, '4px')
            assert.ok(g.middleDrop > g.firstDrop, 'the middle tag hangs lower than the edge tag')
            assert.equal(g.scroll, false, 'wide header keeps the tags inside the layer')
            if (hasTabs) {
              await page.getByRole('tab', { name: '轨迹' }).click()
              assert.equal(await page.locator('main').textContent(), '轨迹')
              await page.getByRole('tab', { name: '对话', exact: true }).click()
              assert.equal(await page.locator('main').textContent(), '对话')
            }
          } else {
            assert.equal(g.ropeDisplay, 'none')
            assert.equal(g.fit, 'solo')
            assert.equal(g.underline, g.active)
            assert.equal(g.cardShadow, 'none')
            assert.equal(g.tabsVisible, 0)
            assert.equal(await headerHidesViewTabs(page), true)
            if (width === 393) assert.equal(g.scroll, true)
          }
          const order = await buttons.evaluateAll(nodes => nodes.map(node => node.dataset.recentSessionId))
          const select = page.locator('[data-recent-session-id=r2]')
          await select.scrollIntoViewIfNeeded()
          if (desktop) await select.click(); else await select.tap()
          assert.equal(await select.getAttribute('aria-current'), 'page')
          assert.deepEqual(await buttons.evaluateAll(nodes => nodes.map(node => node.dataset.recentSessionId)), order)
          await page.locator('[data-recent-session-id=r3]').click()
          const opened = await page.evaluate(() => window.opens.length)
          await page.locator('[data-recent-session-id=r3]').click()
          assert.equal(await page.evaluate(() => window.opens.length), opened, 'current session is not reopened')
        }
      }

      // Keyboard focus keeps the host ring and Enter switches sessions.
      await page.evaluate(() => window.fixture.tabs(false))
      await page.waitForFunction(() => document.querySelector('[data-ui-beautify-recent]'))
      await page.evaluate(frame)
      await page.locator('main').click()
      for (let step = 0; step < 12; step++) {
        await page.keyboard.press('Tab')
        const recentId = await page.evaluate(() => document.activeElement?.getAttribute('data-recent-session-id') ?? null)
        if (recentId === 'r1') break
      }
      const secondTag = page.locator('[data-recent-session-id=r1]')
      assert.equal(await secondTag.evaluate(node => document.activeElement === node), true)
      assert.equal(await secondTag.evaluate(node => getComputedStyle(node).outlineStyle), 'solid')
      await page.keyboard.press('Enter')
      assert.equal(await secondTag.getAttribute('aria-current'), 'page')

      // Resizes cross both the phone breakpoint and the band/stack fallback.
      await page.evaluate(() => window.fixture.tabs(true))
      await page.waitForFunction(() => document.querySelector('[data-ui-beautify-recent]'))
      await page.evaluate(frame)
      for (const resized of [1200, 600, 601, 393]) {
        await page.setViewportSize({ width: resized, height: 844 })
        await page.waitForFunction(width => innerWidth === width, resized)
        await page.evaluate(frame)
        assert.equal(await strip.count(), 1)
        assert.equal(await buttons.count(), 5)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        assert.equal(await page.locator('[data-conversation-tabs] [role=tab]').evaluateAll(nodes => nodes.filter(node => node.checkVisibility()).length),
          resized > 600 ? 2 : 0)
      }

      // Native recent strip wins; removing it brings the line back.
      await page.evaluate(() => window.fixture.native(true))
      await strip.waitFor({ state: 'detached' })
      assert.equal(await page.evaluate(() => document.querySelector('header').hasAttribute('data-ui-beautify-recent-fit')), false)
      await page.evaluate(() => window.fixture.native(false))
      await strip.waitFor()
      await page.evaluate(frame)
      assert.equal(await buttons.count(), 5)

      // Empty catalog and the settings switch both remove the strip and all marks.
      await page.evaluate(() => window.fixture.empty(true))
      await strip.waitFor({ state: 'detached' })
      assert.equal(await page.evaluate(() => document.querySelector('header').hasAttribute('data-ui-beautify-recent-fit')), false)
      await page.evaluate(() => window.fixture.empty(false))
      await strip.waitFor()
      await page.evaluate(() => window.fixture.enable(false))
      assert.equal(await strip.count(), 0)
      assert.equal(await page.locator('[data-ui-beautify-recent-tabs]').count(), 0)
      assert.equal(await page.evaluate(() => document.querySelector('header').hasAttribute('data-ui-beautify-recent-fit')), false)
      await page.evaluate(() => window.fixture.tabs(true))
      await page.evaluate(() => window.fixture.enable(true))
      await strip.waitFor()
      await page.evaluate(() => { window.fixture.tabs(true); window.fixture.unmount() })
      await page.evaluate(frame)
      assert.equal(await strip.count(), 0)
      assert.equal(await page.locator('[data-ui-beautify-recent-tabs]').count(), 0)
      assert.equal(await page.getByRole('tab').count(), 2)
      assert.deepEqual(errors, [])
    } finally { await browser.close() }
  })
}

async function headerHidesViewTabs(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-conversation-tabs] [role=tab]')].every(tab => !tab.checkVisibility()))
}
