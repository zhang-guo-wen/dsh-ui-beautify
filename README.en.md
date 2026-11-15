---
description: "Interface polish for DeepSeek Harness: mobile layout, body and code fonts, branding, and translation of English descriptions"
kind: "plugin-readme"
---

# @guowenzhang/dsh-ui-beautify

English | [中文](<README.md>)

## Background

**An interface that works on a phone.**

A third-party interface plugin for DeepSeek Harness whose focus is mobile use: conversations, the sidebar and settings no longer squeeze together on a narrow screen. It also offers separate body and code fonts, custom branding, and translation of English skill and plugin descriptions into the interface language.

## Screenshots

**Mobile conversation**: the same conversation in the same viewport, mobile layout off on the left and on the right.

![Mobile conversation before and after](<docs/images/mobile-conversation-comparison.en.png>)

**Settings**: mobile layout, recent conversations and description translation all live in **Settings → UI Beautify**.

![The interface enhancements group on the settings page](<docs/images/settings-enhance.png>)

## Install

```sh
npx @deepseek-ai/dsh plugin --profile web add @guowenzhang/dsh-ui-beautify
```

Restart the host and reload the browser, then open **Settings → UI Beautify**.

## Features

1. **Mobile layout**: the fixed icon rail becomes a drawer button in the top-left corner, the transcript and composer use phone-friendly widths, and settings categories scroll sideways at full content width.
2. **Body and code fonts**: the two roles are chosen separately; fonts are downloaded on demand into a local cache and work offline afterwards.
3. **Branding and running indicator**: custom logo, icon, name and welcome tagline, plus replacement wording and an animated icon for the running line.
4. **Description translation**: the default model turns English skill and plugin descriptions into the interface language, with cached results and the original files left untouched.
5. **Streamlined interface and shortcuts**: hide the settings entries and composer statistics you do not need, and get recent conversations, unread conversations opening at the answer, and the floating quick-action button.
