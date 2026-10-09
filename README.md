# @guowenzhang/dsh-ui-beautify

English | [中文](<README.zh.md>)

## Background

A third-party interface enhancement plugin for [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/), focused on **mobile usability**: making conversations, the sidebar, and settings easier to use on small screens.

It also offers independent body and code font choices, custom logos, icons, names and welcome taglines, and translation of English skill and plugin descriptions into the interface language using the default model. Other improvements include recent conversation tabs, a return-to-your-message button, a composer light beam, and desktop quick replies.

On phones whose browser predates the newest JavaScript APIs, the plugin completes the ones the PDF engine calls, so PDF and Word/PowerPoint previews open instead of failing with `... is not a function`.

## Installation

Requires DeepSeek Harness **0.2.0-rc.1 or newer**. This example uses the `web` profile:

```sh
npx @deepseek-ai/dsh plugin --profile web add @guowenzhang/dsh-ui-beautify
```

Restart the corresponding host and reload the browser, then open **Settings → UI Beautify**. Click **Translate descriptions** to generate translations; this uses the default model's quota, caches results, and leaves original files unchanged.

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
