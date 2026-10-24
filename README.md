# @guowenzhang/dsh-ui-beautify

English | [中文](<README.zh.md>)

## Background

A third-party interface enhancement plugin for [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/), focused on **mobile usability**: making conversations, the sidebar, and settings easier to use on small screens.

It also offers independent body and code font choices, custom logos, icons, names and welcome taglines, and translation of English skill and plugin descriptions into the interface language using the default model. Other improvements include recent conversation tabs, upward navigation through your sent questions, a floating one-line preview of the round you are reading that jumps back to its start, a composer light beam, and desktop quick replies.

Every choice on the settings page reports its own write: the row says it is saving, confirms when the value landed, and offers a retry when the Host refuses it. The name and tagline fields wait for an input method to finish before they commit, so confirming a candidate never saves half a word.

On phones whose browser predates the newest JavaScript APIs, the plugin completes the ones the PDF engine calls, so PDF and Word/PowerPoint previews open instead of failing with `... is not a function`.

## Installation

Requires DeepSeek Harness **0.2.0-rc.1 or newer**. This example uses the `web` profile:

```sh
npx @deepseek-ai/dsh plugin --profile web add @guowenzhang/dsh-ui-beautify
```

Restart the corresponding host and reload the browser, then open **Settings → UI Beautify**. Click **Translate descriptions** to generate translations; this uses the default model's quota, caches results, and leaves original files unchanged.

Translations sharing the same local data directory are deduplicated across host processes, including recovery after an owner exits. Unknown locks are preserved rather than deleted. Recovery retains small generation-marker directories to prevent stale processes from taking a newer lock; do not clean these markers while any host is running.

## Recent conversations

Recent conversations have their own switch in **Settings → UI Beautify** and do not require the code work view or mobile adaptation. The strip shows up to five eligible conversations in activity order; selecting one does not reorder it. Tabs use the host theme tokens in light and dark mode, including when the host has no conversation/trace tab bar.

On desktop the strip is a hemp line pinned to the header's left and right edges. Up to five recent conversations hang from it on clothespins in the middle, the selected conversation is tinted, and the line sags toward the middle. The line shares the row with the host conversation/trace tabs, which stay clickable; the header grows by the line height. When the header narrows, the tags shrink and then move to their own row below the host tabs, and the line still reaches both edges. At widths of 600px or less, phones keep the previous text-tab strip and hide the host view tabs. A host-native recent strip takes precedence. Disabling recent conversations or unloading the plugin removes the strip and restores the host tabs.

For development, `npm run test:recent` runs catalog/status tests and a real Chrome/React fixture at 1200, 601, 600 and 393px, including delayed tab bars, the band/stack fallbacks, session navigation and cleanup. It uses the existing desktop-profile Playwright installation and local Chrome; set `DSH_MOBILE_PLAYWRIGHT` and `DSH_MOBILE_CHROME` to use other installations. It does not launch or change a running DSH host.

## Streamlined interface

**Settings → UI Beautify → Streamlined interface** removes the entries a deployment does not want its users to reach: it hides the settings header's **Open configuration file** action and the **Plugins** and **Agent presets** pages from the settings navigation. While **Coding Tools** are off in General settings, it also hides the Agent preset picker on the new-session page and the preset label beside the conversation title. The hidden settings pages stay composed — only their navigation rows go — and turning the switch off restores every host entry.

The same page hides the three readings below the message box with its own switch, **Hide the statistics under the message box**: the round/step count with output speed, the token spend with its cache-hit share, and the context-occupancy ring. It is independent of the switch above, and turning it off brings all three readings back.

## Screenshots

### 1. Settings

Appearance, interface enhancements, and branding are grouped in **Settings → UI Beautify**.

| Appearance | Interface enhancements | Branding |
| --- | --- | --- |
| ![Body and code fonts and composer motion](<docs/images/settings-appearance.png>) | ![Mobile layout, recent tabs and description translation](<docs/images/settings-enhance.png>) | ![Logo, icon, name and tagline](<docs/images/settings-branding.png>) |

### 2. Mobile adaptation

These screenshots use the same demo conversation and the same **393 × 844** phone viewport. On the left, this plugin's mobile layout and recent conversation switches are off; on the right, both are on. The settings comparison changes only the mobile layout switch. Numbered annotations highlight the differences.

#### Conversation comparison

![Mobile conversation before and after, with annotations](<docs/images/mobile-conversation-comparison.en.png>)

1. **More room for the conversation**: the fixed icon rail becomes a top-left drawer button.
2. **Easier conversation switching**: recent conversations appear at the top; this has its own switch.
3. **Better reading and input space**: the transcript and composer use phone-friendly widths and gutters.

#### Settings comparison

![Mobile settings before and after, with annotations](<docs/images/mobile-settings-comparison.en.png>)

1. **Horizontal categories**: swipe through categories without giving up content width to a left navigation column.
2. **Full-width content**: descriptions have more room and need fewer line breaks.
3. **Touch-friendly controls**: font selectors and similar controls stack below descriptions, while the close button stays at the top.

### 3. Phone compatibility

Before this fix, every PDF and Office preview on a phone without those APIs showed this message next to a retry button:

![Phone screenshot of the message "Cannot display PDF: this[#methodPromises].getOrInsertComputed is not a function", before the fix](<docs/images/pdf-preview-before-fix.png>)

## License

The plugin is licensed under **Apache-2.0**; see [LICENSE](<LICENSE>).

No font files are distributed with the plugin. Fonts downloaded on demand retain their original licenses: **SIL Open Font License 1.1** for the fonts, and additionally MIT for the LXGW WenKai webfont npm packaging code. See [NOTICE](<NOTICE>) for third-party declarations.
