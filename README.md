# @guowenzhang/dsh-ui-beautify

English | [中文](<README.zh.md>)

A third-party plugin for [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/) with custom fonts, composer motion, quick replies, branding, and mobile layout improvements.

## Improvements

- **Body and code fonts**: choose each independently from faces including Source Han Sans, Source Han Serif, LXGW WenKai, Inter, JetBrains Mono, and Fira Code. Body text defaults to Source Han Sans; code defaults to the system font. Choosing **System default** restores the host font without uninstalling.
- **On-demand font caching**: download only the character shards needed by the page and reuse cached files offline. Settings show descriptions, cache sizes, and shard counts; reload (F5) to recount.
- **Composer motion**: a cyclist above the message box follows assistant output speed and coasts to a stop over eight seconds after output ends. Choose **Follow the browser**, **Always play**, or **Off**; the default respects reduced-motion preferences.
- **Desktop quick replies**: tags below the message box default to **Continue**, **OK**, **I don’t understand**, and **What’s going on now**, following the interface language. Clicking inserts at the caret and submits without replacing the draft; messages queue while the agent is busy. The settings switch takes effect immediately; phones always hide the tags.
- **Custom branding**: upload a welcome logo and top-left icon, and edit the top-left name and welcome tagline. Images support PNG, JPEG, WebP, and GIF up to 2 MB. Restore an image's default or clear a text field to use built-in content.
- **Mobile layout**: at widths up to 600px, the left sidebar becomes a drawer and conversations stay full-width; its top-left opener aligns with the right sidebar entry. Choosing a session or section, tapping the backdrop, or pressing Escape closes the drawer. The right sidebar keeps the host fullscreen panel and restores its opener on collapse. Settings controls stack on narrow screens; transcript/composer gutters are 16px/8px. Desktop layout is unchanged.
- **Recent conversation switches**: started conversations show up to five recent tabs, each capped at five characters, ordered by activity without moving a clicked tab to the front. Archived, blank, and subagent sessions are excluded, with no empty placeholders. Tabs reuse host fonts, selected underlines, and live state dots for approval/plan review/answer waits, running agents (including subagents), and unread completion reminders; idle sessions have no dot. Desktop places them after Chat/Trajectory; phones show only a horizontally scrollable recent row and hide the open-file and log/feedback menu.
- **Remote settings reads**: phones and other remote pages read the same redacted Host settings as desktop without a separate phone configuration. Values refresh on settings changes, reconnect, and returning to the page. Remote forms remain read-only; edit and save on the local host.

## Settings screenshots

Open **Settings → UI Beautify** to adjust appearance and branding. These are actual screenshots of the Chinese interface; font choices, cache counts, and switch states are examples, not installation defaults.

### Appearance

![UI Beautify settings: body and code fonts, composer motion, and desktop quick replies](<docs/images/settings-appearance.png>)

### Branding

![UI Beautify settings: welcome logo, top-left icon and name, and welcome tagline](<docs/images/settings-branding.png>)

## Installation

Install and run DeepSeek Harness **0.2.0-rc.1 or newer** first, then add this plugin to the profile you use. Examples use `web`; replace it for another profile.

### From npm

```sh
npx @deepseek-ai/dsh plugin --profile web add @guowenzhang/dsh-ui-beautify
```

Published versions are listed on the [npm package page](https://www.npmjs.com/package/@guowenzhang/dsh-ui-beautify).

### From GitHub

```sh
npx @deepseek-ai/dsh plugin --profile web add https://github.com/zhang-guo-wen/dsh-ui-beautify.git
```

After installing or upgrading, **restart the corresponding host and hard-reload the browser (Ctrl+F5)**, then open **Settings → UI Beautify**. Refresh the usual phone address to use the mobile layout; no extra mobile plugin, layout URL parameter, or Harness source changes are needed.

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

Local-directory installation, the full font catalogue, and troubleshooting are in the [maintainer guide](https://github.com/zhang-guo-wen/dsh-ui-beautify/blob/master/AGENTS.md).

## Notes

- **Compatibility**: DSH is evolving quickly, and host upgrades may introduce compatibility changes. This plugin resolves runtime dependencies from the host rather than replacing it. Hosts with native mobile drawers/recent strips retain their implementation and breakpoints (which may differ at exactly 600px). With dsh-pocket 2.10.6, only incompatible mobile navigation cells and styles are replaced; proxy, QR access, and settings remain active, without its extra phone file/log shortcuts.
- **First font downloads require Host connectivity**: the browser only contacts DSH; the Host fetches from mirrors. Browser connectivity alone is insufficient. Only cached files work offline; new characters may still require uncached shards. Failed downloads leave fallback fonts in place without breaking the interface.
- **Code font coverage**: of the custom code fonts provided, only Maple Mono CN covers Chinese. Its full set of shards is about 9 MB and uses jsDelivr; the other four fall back to host fonts for Chinese. Hardcoded fonts in the integrated terminal and queue panel do not fully follow font settings.
- **Settings and storage**: choices persist in the current profile configuration and usually apply immediately. New setting fields require a Host restart, as do changes to mirrors or the cache directory. Default font storage is `$DSH_HOME/cache/ui-beautify/fonts`; uploaded images are stored in `$DSH_HOME/assets/ui-beautify`.
- **Quick replies send immediately**: an existing draft is submitted together with the inserted phrase. Tags are disabled while submission locks the composer and do not appear on the blank welcome page. Settings do not provide a phrase editor. For custom phrases, set `quickReplies` on the current profile's `ui-beautify` configuration row (up to four phrases, 40 characters each); see the [maintainer guide](https://github.com/zhang-guo-wen/dsh-ui-beautify/blob/master/AGENTS.md).
- **Motion is not an exact speed meter**: the cyclist approximates output character growth, not the status bar's `tok/s`. It neither reads user input nor sends data.
- **Remote access stays read-only**: shared settings forms are covered, not pages with their own APIs or browser-local storage. This does not enable credential reads, configuration-file opening, plugin installation, or other loopback-only actions.
- **Branding scope**: customization applies to the DSH browser interface. The Electron installer's separately packaged native first-run window does not load this plugin.

## License

The plugin itself is licensed under **Apache-2.0**; see [LICENSE](<LICENSE>).

No font files are distributed with the plugin. Fonts downloaded on demand retain their original licenses: the fonts used are **SIL Open Font License 1.1**, while the LXGW WenKai webfont npm packaging code is additionally MIT. Full third-party declarations are in [NOTICE](<NOTICE>).
