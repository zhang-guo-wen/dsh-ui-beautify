# @zhang-guo-wen/dsh-ui-beautify

DeepSeek Harness 的**页面美化插件**。第一个能力：把 Web GUI 的正文字体换成**思源黑体**（Noto Sans SC），字体随插件分发，不依赖本机安装。

## 它做什么

| 半边 | 职责 |
|---|---|
| Host | 认领一个 `webServer` 前缀路由，把 `assets/fonts/` 里的字体文件通过应用 origin 提供给浏览器 |
| Client | 链入分片样式表，并把 `--dsw-font-family` 重绑到思源黑体 |

字体通过**主题服务的覆盖层**（`ctx.theme.overrideTokens`）生效——它写成 `body` 的行内样式，优先级高于 `:root`，因此不受插件激活顺序影响，卸载时自动回滚。

## 为什么不是把字体装进系统

字体随插件走，换机器/换 profile 不用重装字体。用的是 `@fontsource-variable/noto-sans-sc`：

- **按 `unicode-range` 分片**（101 个 woff2，共 4.31 MB）——浏览器只下载页面**实际用到**的分片，首屏通常只拉 latin(25 KB) + 几个中文片（各约 50 KB），不是一次性 4 MB。
- **可变字体**（`wght` 轴 100–900）——一个分片覆盖全部字重，不用装 7 个静态字重。
- **OFL 开源许可**，允许随包分发（见 `assets/fonts/LICENSE`）。

## 覆盖范围

只改 `--dsw-font-family`，即**正文 / UI / Markdown**。

`--ds-font-family-code`（代码块、等宽）**保持不动**。以下位置硬编码了字体，覆盖 CSS 变量管不到，同样保持原样：

- 集成终端（xterm 构造参数）
- 队列面板 `QueueDock.module.css` 里写死的 `Inter` 前缀

## 安装

```sh
dsh plugin --profile web add C:/02-codespace/deepseek-harness/dsh-ui-beautify
```

本地目录安装时 pnpm 建的是 symlink（`link:`），所以改完重建 `lib/` **重启即生效，无需重装**。

client 产物变了要**硬刷新浏览器**（`Ctrl+F5`），否则浏览器继续跑旧 bundle。

## 开发

```sh
npm install
npm run typecheck      # tsc --noEmit
npm run build          # tsdown（host）+ build-client.mjs（client handoff 包）
npm test               # 冒烟测试 + HTTP 层验证（对构建产物运行）
```

`npm test` 跑两个脚本：`tests/smoke.mjs` 用 mock ctx 调 `apply()`，断言路由注册、路径穿越防护、字体文件可达；`tests/http.mjs` 用真实 `node:http` 服务器驱动插件注册的 handler，断言响应头、字节哈希与 woff2 魔数。

`lib/` 是**提交进仓库的构建产物**，这样可以直接从 git 安装。改完源码记得 `npm run build` 并把 `lib/` 一起提交。

## 目录

```
src/
  params.ts          两半边共用的路由与字体族常量
  index.ts           host：认领字体路由
  serve.ts           字体静态文件服务（含路径穿越防护、缓存策略）
  client/index.ts    client：链入分片样式表 + 覆盖字体 token
assets/fonts/
  index.css          @fontsource 生成的 101 条 @font-face（unicode-range 分片）
  files/*.woff2      分片字体
  LICENSE            OFL-1.1
tests/smoke.mjs      针对构建产物的冒烟测试
```

## 接下来可以加的

这个插件是「页面美化」的落点，字体只是第一个能力。同一套结构（host 提供资源 + client 覆盖 token）可以直接扩展：

- 代码字体（覆盖 `--ds-font-family-code`，另配等宽字体如 Sarasa Mono SC）
- 字号阶梯、行高、圆角、间距
- 自定义主题配色（`ctx.theme.register` 注册整套 alias token）

## 许可

插件本体 Apache-2.0；`assets/fonts/` 下的 Noto Sans SC 为 SIL Open Font License 1.1。
