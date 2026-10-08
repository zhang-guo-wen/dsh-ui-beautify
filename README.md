# @guowenzhang/dsh-ui-beautify

English | [中文](<README.zh.md>)

A third-party plugin for [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/) with custom fonts, a composer light beam, quick replies, branding, and mobile layout improvements. Everything lives in **Settings → UI Beautify** with nothing else to configure; display names and descriptions in the plugin list follow the Harness language setting.

## Features

- **Body and code fonts**: choose each independently from 19 faces (Source Han Sans, Source Han Serif, LXGW WenKai, Inter, JetBrains Mono, and more). The Host downloads only the character shards a page needs into a local cache that works offline afterwards; pick **System default** to restore the host font without uninstalling.
- **Composer light beam**: a fixed 1px beam along the message box's top edge follows real assistant output speed and slows to a stop when output ends, without adding height, spacing, or layout changes.
- **Quick replies (desktop)**: four phrases below the message box insert at the caret and submit without replacing your draft. Narrow composers drop trailing tags instead of wrapping; phones always hide them.
- **Back to your message**: a floating up button returns to your latest sent message so you can read a long answer from the beginning.
- **Recent conversation switches**: up to five recent conversations above the transcript, with live status dots for approval waits, running agents, and unread completions.
- **Mobile layout**: at widths up to 600px the left sidebar becomes a drawer, conversations stay full-width, and the settings dialog is reflowed.
- **Custom branding**: replace the welcome logo, the top-left icon and name, and the welcome tagline.
- **Remote settings reads**: phones and other remote pages mirror the host's redacted settings read-only, fixing settings that do not take effect on a phone.
- **Description translation**: translate plugin and skill descriptions into the interface language with one click, using the host's default model.

## Interface

### Appearance

Body and code fonts, the composer beam switch, and the desktop quick-reply switch.

![UI Beautify: appearance settings](<docs/images/settings-appearance.png>)

### Composer

The 1px light beam runs along the top edge of the message box, following output speed; the desktop quick replies sit below it.

![Composer light beam and quick replies](<docs/images/composer-quick-replies.png>)

### Recent conversations

Up to five recent conversations above the transcript. Tabs reuse host fonts and the selected underline; the dot shows approval waits, running agents, and unread completions.

![Recent conversation tabs](<docs/images/recent-sessions.png>)

### Interface enhancements

The four feature switches and **Translate descriptions**.

![UI Beautify: interface enhancements](<docs/images/settings-enhance.png>)

### Branding

![UI Beautify: branding settings](<docs/images/settings-branding.png>)

### Mobile layout

At widths up to 600px the left sidebar becomes a drawer, conversations stay full-width, and the transcript and composer use phone gutters. The two shots below are the same conversation on a phone with the **Mobile layout** switch off and on.

| Before (switch off) | After (default) |
| --- | --- |
| ![Before: a fixed icon rail squeezes the conversation and there are no recent tabs](<docs/images/mobile-before.png>) | ![After: a full-width conversation, a top-left drawer opener, and recent tabs](<docs/images/mobile-after.png>) |

Tap the top-left button to slide the sidebar drawer in; choose a session, tap the backdrop, or press Escape to close it:

![Sidebar drawer on a phone](<docs/images/mobile-drawer.png>)

The settings dialog gets a top title/close row, horizontally scrollable categories, and full-width scrolling content, in both light and dark host themes:

| Light | Dark |
| --- | --- |
| ![Mobile settings dialog (light)](<docs/images/mobile-settings-light.png>) | ![Mobile settings dialog (dark)](<docs/images/mobile-settings-dark.png>) |

## Switches

**Settings → UI Beautify → Interface enhancements** controls **Back to my latest message**, **Mobile layout**, **Recent conversation switches**, and **Remote settings reads** independently. All four are on by default, and turning one off restores the host's original interface immediately.

- **Mobile layout** only covers this plugin's drawer, gutters, and settings reflow; recent tabs have their own switch and the two do not affect each other.
- **Remote settings reads** is switched on the local host: when off, plugin synchronization stops and the host's original reads return, while remote pages stay read-only.
- Switches persist on the current profile's `ui-beautify` configuration row (`scrollToPromptEnabled`, `mobileLayoutEnabled`, `recentSessionsEnabled`, `remoteSettingsEnabled`). After upgrading, restart the host and reload the page once to load the new fields; local switches apply immediately afterwards.

## Description translation

Open **Settings → UI Beautify → Interface enhancements → Skill and plugin descriptions** and click **Translate descriptions** to translate into the current interface language with the host's configured default model. Only descriptions are sent—never conversations, tools, or full skill instructions—and original files are never modified.

- Translations persist by source identity, exact description, and target language: repeated clicks, reloads, restarts, and upgrades with unchanged descriptions reuse them, while a source change fills only the missing entries on the next click.
- Storage is `$DSH_HOME/data/ui-beautify/description-translations/v1`, separate from the plugin installation. Generation needs connectivity and consumes the default model's quota.
- A missing translation or default-model service shows as unavailable and does not disable the other beautify features.

## Installation

Install and run DeepSeek Harness **0.2.0-rc.1 or newer** first, then add the plugin to the profile you use. Examples use `web`; replace it for another profile.

### From npm

```sh
npx @deepseek-ai/dsh plugin --profile web add @guowenzhang/dsh-ui-beautify
```

Published versions are listed on the [npm package page](https://www.npmjs.com/package/@guowenzhang/dsh-ui-beautify).

### From GitHub

```sh
npx @deepseek-ai/dsh plugin --profile web add https://github.com/zhang-guo-wen/dsh-ui-beautify.git
```

After installing or upgrading, **restart the corresponding host and hard-reload the browser (Ctrl+F5)**, then open **Settings → UI Beautify**. Phones just open the same address; no extra mobile plugin, layout URL parameter, or Harness source change is needed.

### Uninstall

```sh
npx @deepseek-ai/dsh plugin --profile web remove @guowenzhang/dsh-ui-beautify
```

### Local development

```sh
npm ci
npm run typecheck
npm run build
npm test
```

The font catalogue, cache mechanics, routes, and troubleshooting are in the [maintainer guide](https://github.com/zhang-guo-wen/dsh-ui-beautify/blob/master/AGENTS.md).

## Notes

- **First font downloads require Host connectivity**: the browser only contacts DSH, and the Host fetches from mirrors, so browser connectivity alone is not enough. Uncacheable new characters may still need downloads; failures leave fallback fonts in place without breaking the interface.
- **Code font coverage**: among the code fonts, only Maple Mono CN covers Chinese (about 9 MB of shards, served from jsDelivr); the other four fall back to host fonts for Chinese. Hardcoded fonts in the integrated terminal and queue panel do not follow font settings.
- **Quick replies send immediately**: an existing draft is submitted together with the inserted phrase. Settings do not provide a phrase editor; to customize, set `quickReplies` on the current profile's `ui-beautify` row (up to four phrases, 40 characters each).
- **The beam is not an exact speed meter**: it approximates output character growth, not the status bar's `tok/s`. It neither reads user input nor sends data.
- **Settings and storage**: choices persist in the current profile configuration and usually apply immediately. Default font storage is `$DSH_HOME/cache/ui-beautify/fonts`; uploaded images are stored in `$DSH_HOME/assets/ui-beautify`. Changes to `mirrors` or `cacheDir` require a host restart.
- **Compatibility**: DSH is evolving quickly and host upgrades may introduce compatibility changes; this plugin resolves runtime dependencies from the host rather than replacing it. Hosts with native mobile drawers or recent strips retain their implementation and breakpoints.
- **Branding scope**: customization applies to the DSH browser interface; the Electron installer's separately packaged native first-run window does not load this plugin.

## License

The plugin itself is licensed under **Apache-2.0**; see [LICENSE](<LICENSE>).

No font files are distributed with the plugin. Fonts downloaded on demand retain their original licenses: the fonts used are **SIL Open Font License 1.1**, while the LXGW WenKai webfont npm packaging code is additionally MIT. Full third-party declarations are in [NOTICE](<NOTICE>).
