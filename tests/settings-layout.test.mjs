import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/client/mobile-layout.css', import.meta.url), 'utf8')
const rowCss = readFileSync(new URL('../src/client/SettingRow.module.css', import.meta.url), 'utf8')

test('settings reflow is phone-only and scoped to the actual portaled settings shell', () => {
  assert.ok(css.indexOf("[data-shortcut-modal='settings']") > css.indexOf('@media (max-width: 600px)'))
  assert.match(css, /grid-template-rows: auto auto minmax\(0, 1fr\)/)
  assert.match(css, /height: calc\(100dvh/)
  assert.match(css, /scroll-padding-inline: 16px/)
  assert.match(css, /overscroll-behavior-x: contain/)
  assert.match(css, /safe-area-inset-bottom/)
  assert.match(css, /\[data-slot='settings.general.item'\]/)
  assert.doesNotMatch(css, /body\s*\{|\.wCInkW|\.v01cdW|role='dialog'/)
})

test('Pocket file-copy reflow is scoped to changed-file anchor siblings on phones', () => {
  const selector = "[data-changed-files] li > :has(> [data-mobile-nav='copy-file'])"
  assert.ok(css.indexOf(selector) > css.indexOf('@media (max-width: 600px)'))
  assert.match(css, /\[data-mobile-nav-copy\] \{\s*flex: 1 1 0;\s*width: 0;/)
  assert.match(css, /\[data-mobile-nav-copy\] > \[class\*='_path'\]/)
  assert.match(css, /\[data-changed-files\] \[data-mobile-nav='copy-file'\]:focus-visible/)
  assert.match(css, /\[data-changed-files\] \[data-mobile-nav='copy-file'\]:disabled/)
})

test('phone controls preserve readable labels, compact switches and touch-sized inputs', () => {
  assert.match(rowCss, /\.row:not\(\.desktopOnly\):has\(> button\[role='switch'\]\)/)
  assert.match(rowCss, /grid-template-columns: minmax\(0, 1fr\) auto/)
  assert.match(rowCss, /min-height: 44px/)
  assert.match(rowCss, /white-space: nowrap/)
  assert.match(rowCss, /\.textInput \{\s*min-height: 44px;\s*font-size: 16px/)
})
