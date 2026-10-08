# @guowenzhang/dsh-ui-beautify

English | [中文](<README.zh.md>)

A third-party plugin for [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/) with custom fonts, composer motion, quick replies, branding, and mobile layout improvements.

In the plugin list, display names and descriptions follow the Harness language setting in English or Chinese (English is the default fallback); English names use the package name without its npm scope, Chinese names describe the purpose, and installation still uses the unchanged real package name.

## Improvements

- **Body and code fonts**: choose each independently from faces including Source Han Sans, Source Han Serif, LXGW WenKai, Inter, JetBrains Mono, and Fira Code. Body text defaults to Source Han Sans; code defaults to the system font. Choosing **System default** restores the host font without uninstalling.
- **On-demand font caching**: download only the character shards needed by the page and reuse cached files offline. Settings show concise descriptions and cache sizes.
- **Composer motion**: a fixed 1px light beam along the message box’s top edge follows real assistant output speed, overlaying its top border with no added height, spacing, or layout changes. It slows to a stop over eight seconds after output ends, and remains visible, hovering still while idle. A single settings switch is on by default: on always enables the animation, off hides it, independently of browser reduced-motion preferences.
- **Desktop quick replies**: tags below the message box default to **Continue**, **OK**, **I don’t understand**, and **What’s going on now**, following the interface language. Clicking inserts at the caret and submits without replacing the draft; messages queue while the agent is busy. The tags stay on one line: when the composer gets narrow, the trailing ones are hidden (in order, from the end) instead of wrapping, and they come back as it widens. The settings switch takes effect immediately; phones always hide the tags.
- **Back to your message**: a floating up button returns to your latest sent message so you can read the AI answer from the beginning. The existing down button still jumps to the bottom. Available on desktop and phones, with an immediate settings switch.
- **Custom branding**: upload a welcome logo and top-left icon, and edit the top-left name and welcome tagline. Images support PNG, JPEG, WebP, and GIF up to 2 MB. Restore an image's default or clear a text field to use built-in content.
- **Mobile layout**: at widths up to 600px, the left sidebar becomes a drawer and conversations stay full-width; its top-left opener aligns with the right sidebar entry. Choosing a session or section, tapping the backdrop, or pressing Escape closes the drawer. The right sidebar keeps the host fullscreen panel and restores its opener on collapse. Host dialogs stay above drawers and fullscreen editors, preventing hidden dialogs from blocking touch input. The settings dialog uses a top title/close row, horizontally scrollable categories, and full-width scrolling content. Selectors and text inputs stack on narrow screens while switches stay beside their descriptions, avoiding squeezed text and horizontal overflow. Transcript/composer gutters are 16px/8px. Desktop layout is unchanged. With Pocket, changed-file cards keep copy actions beside file names and line counts, ellipsizing long paths without changing copy behavior.
- **Recent conversation switches**: started conversations show up to five recent tabs, each capped at five characters, ordered by activity without moving a clicked tab to the front. Archived, blank, and subagent sessions are excluded, with no empty placeholders. Tabs reuse host fonts, selected underlines, and live state dots for approval/plan review/answer waits, running agents (including subagents), and unread completion reminders; idle sessions have no dot. Desktop places them after Chat/Trajectory; phones show only a horizontally scrollable recent row and hide the open-file and log/feedback menu.
- **Remote settings reads**: phones and other remote pages read the same redacted Host settings as desktop without a separate phone configuration. Values refresh on settings changes, reconnect, and returning to the page. Remote forms remain read-only; edit and save on the local host.

## Feature switches

Open **Settings → UI Beautify → Interface enhancements** to control **Back to my latest question**, **Mobile layout**, **Recent conversation switches**, and **Remote settings reads** independently. Each includes a description and is **enabled by default**, including profiles without the new fields.

- Disabling back to my latest question hides the up button; the host down button is unaffected, and re-enabling restores it immediately.
- Disabling mobile layout removes this plugin’s drawer, spacing, phone toolbar and settings layout overrides, including stacked UI Beautify controls and touch-sized inputs, restoring the original layout. Recent tabs have their own switch; quick replies and their setting remain hidden on phones.
- Disabling recent conversations removes this plugin’s tabs and styles and restores the host view tabs; it does not disable the phone drawer or change session data. Native host recent strips are unaffected.
- Change remote settings reads on the local host. Remote pages perform one redacted bootstrap read to learn the switch; when disabled, plugin synchronization and refresh listeners stop and native host reads are restored. Reload remote pages after re-enabling. Remote access remains read-only, without credential access or write permissions.

Switches persist on the current profile’s `ui-beautify` configuration row (`scrollToPromptEnabled`, `mobileLayoutEnabled`, `recentSessionsEnabled`, `remoteSettingsEnabled`). Restart the host and reload the browser once after upgrading to load the new fields; subsequent local switches apply immediately.

## Description translation

Open **Settings → UI Beautify → Interface enhancements → Skill and plugin descriptions**, then click **Translate descriptions**. The Host's configured default model translates into the current interface language. Only descriptions are sent—not full skill instructions, conversation history or tools—and original files are never modified.

- Successful translations persist by source identity, exact description and target language. Repeated clicks, reloads, restarts and upgrades with unchanged descriptions reuse them. Click again after a source change to fill missing translations or retry failures. Author-provided language resources take precedence.
- Translations appear in plugin lists/details and skill slash candidates. Supported skill-file previews and call cards add a translated summary while authored files and historical tool results remain verbatim. Language switching uses that language's cache; missing translations stay original without automatic inference.
- Each model request translates many descriptions: skip cached records, combine UTF-8 input (including JSON and translation instructions), and split only above 16 KB. The UI retains provider/model/reasoning effort and shows completed/total for Plugins, Skills and Workspace skills, without batch or byte-limit copy. While translating, the button becomes an enabled Cancel action that aborts the request and stops later batches; saved translations are retained. It does not call the model once per item.
- Discovery includes the Host global loaded skill directory, project skills exposed through the Skill service for every registered workspace, and the current Session's Agent-specific directory. Identical sources are deduplicated; same-name skills in different files remain separate. Plugin count means installed or enabled packages; component descriptions also contribute to translation totals. Failed workspace reads are reported; unregistered projects are not scanned. Display resolution remains Session-scoped.
- Storage is `$DSH_HOME/data/ui-beautify/description-translations/v1`, separate from plugin installation files. Generation needs connectivity, consumes the default model's quota and sends descriptions to its provider.
- Restart the Host and reload the page after updating this feature. Missing translation/default-model services do not disable other beautify features.

## Settings screenshots

Open **Settings → UI Beautify** to adjust appearance and branding. These are actual screenshots of the Chinese interface; font choices, cache counts, and switch states are examples, not installation defaults.

### Appearance

![UI Beautify settings: body and code fonts, composer motion, and desktop quick replies](<docs/images/settings-appearance.png>)

### Branding

![UI Beautify settings: welcome logo, top-left icon and name, and welcome tagline](<docs/images/settings-branding.png>)

### Mobile settings

At widths up to 600px, swipe categories horizontally and scroll the content independently. Both light and dark appearances use the host theme.

![Mobile settings layout (light)](<docs/images/settings-mobile-light.png>)

[View dark appearance](<docs/images/settings-mobile-dark.png>)

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
- **Motion is not an exact speed meter**: the light beam approximates output character growth, not the status bar's `tok/s`. It neither reads user input nor sends data.
- **Remote access stays read-only**: shared settings forms are covered, not pages with their own APIs or browser-local storage. This does not enable credential reads, configuration-file opening, plugin installation, or other loopback-only actions.
- **Branding scope**: customization applies to the DSH browser interface. The Electron installer's separately packaged native first-run window does not load this plugin.

## License

The plugin itself is licensed under **Apache-2.0**; see [LICENSE](<LICENSE>).

No font files are distributed with the plugin. Fonts downloaded on demand retain their original licenses: the fonts used are **SIL Open Font License 1.1**, while the LXGW WenKai webfont npm packaging code is additionally MIT. Full third-party declarations are in [NOTICE](<NOTICE>).
