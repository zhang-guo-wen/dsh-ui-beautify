# @guowenzhang/dsh-ui-beautify

DeepSeek Harness 的**页面美化插件**。目前的能力：让 Web GUI 在设置页里切换**正文字体**，字体随插件分发，不依赖本机安装。

## 它做什么

| 半边 | 职责 |
|---|---|
| Host | 认领一个 `webServer` 前缀路由提供字体文件，并注册 `ui-beautify` 设置命名空间记录选择 |
| Client | 按选择链入对应字体的分片样式表，把 `--dsw-font-family` 重绑过去，并渲染设置页的「页面美化」区块 |

字体通过**主题服务的覆盖层**（`ctx.theme.overrideTokens`）生效——它写成 `body` 的行内样式，优先级高于 `:root`，因此不受插件激活顺序影响，卸载时自动回滚。

设置入口在 **Settings → 页面美化**（`settings.section`，order 12）。选择写进 `~/.dsh/settings.yaml` 的 `ui-beautify` 分节，改完立即生效、无需重启。

## 可选字体

| id | 字体 | 分片 | 体积 | 来源 |
|---|---|---|---|---|
| `system` | 系统默认 | 不加载任何内置字体 | 0 | —— |
| `noto-sans-sc`（默认值）| 思源黑体 | 101 片，现成 | 4.3 MB | `@fontsource-variable/noto-sans-sc@5.3.0` |
| `lxgw-wenkai` | 霞鹜文楷 | 202 片（2 字重 × 101），**自切** | 7.9 MB | `@fontsource/lxgw-wenkai@5.3.0` |

内置字体都是 OFL 许可，允许随包分发；`assets/fonts/<face>/LICENSE` 各自保留原始许可文本。

**`system` 不是「把系统字体栈复制一份写进 `--dsw-font-family`」**，而是**移除样式表链接与 token 覆盖层**，让 `--dsw-font-family` 回到 ui-theme 自己的声明。区别在于：复制一份会把今天的默认值冻结在插件里，上游改了默认字体这里也不会跟随；移除覆盖则始终跟随。选中它也是「关掉自定义字体」的唯一方式，不需要卸载插件。

**为什么按 `unicode-range` 分片**：浏览器只下载页面**实际用到**的分片，首屏通常只拉 latin（约 25 KB）+ 几个中文片（各约 50 KB），而不是一次性几 MB。思源黑体是可变字体（`wght` 100–900 一个分片覆盖全字重）。选中 `system` 时**一个分片都不会请求**。

### 霞鹜文楷为什么是自切的

`@fontsource/lxgw-wenkai` 只提供 3 个**整体** woff2（6.9 / 8.4 / 7.1 MB），**完全没有 unicode-range 分片**——浏览器必须先下完整个 8.4 MB 才能渲染一个字。所以这里用 `tools/slice-font.py` 把它切成了与思源黑体相同的分片布局：

```sh
npm pack @fontsource/lxgw-wenkai
tar -xzf fontsource-lxgw-wenkai-*.tgz
python tools/slice-font.py \
  --reference assets/fonts/noto-sans-sc/index.css \
  --face 500=package/files/lxgw-wenkai-latin-500-normal.woff2 \
  --face 700=package/files/lxgw-wenkai-latin-700-normal.woff2 \
  --out-dir assets/fonts/lxgw-wenkai/files \
  --css-out assets/fonts/lxgw-wenkai/index.css \
  --family "LXGW WenKai" --slug lxgw-wenkai
```

分片布局从思源黑体的样式表读取而不是另起一套，所以新增字体沿用同一套字符空间划分；切换字体时已经在途的分片不必重下。脚本需要 `fontTools` 与 `brotli`。

**分片键必须同时包含编号块和脚本标签。** 思源黑体的 101 个分片里，97 个是编号块（`4`–`119`），另外 4 个是 `latin` / `latin-ext` / `cyrillic` / `vietnamese`。只读编号块会静默丢掉拉丁分片，结果是中英混排里每个字母和数字都掉回系统字体。脚本对两者一视同仁。

霞鹜文楷只有 300/500/700 三个字重（**没有 400**）。这里打包 500 与 700，靠 CSS 的字重匹配规则覆盖界面用到的 400/500/600/700：`400` 落到 500（规则优先向上取 500 以内），`600` 落到 700。

## 覆盖范围

只改 `--dsw-font-family`，即**正文 / UI / Markdown**。

代码与等宽字体 `--ds-font-family-code` **保持不动**（仍是 Consolas）。以下位置硬编码了字体，覆盖 CSS 变量管不到，同样保持原样：

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

`npm test` 跑两个脚本：`tests/smoke.mjs` 用 mock ctx 调 `apply()`，断言路由注册、命名空间注册、字体表完整性与路径穿越防护；`tests/http.mjs` 用真实 `node:http` 服务器驱动插件注册的 handler，**逐字体**断言响应头、字节哈希与 woff2 魔数。

`lib/` 是**提交进仓库的构建产物**，这样可以直接从 git 安装。改完源码记得 `npm run build` 并把 `lib/` 一起提交。

## 加一款字体

1. 准备 `assets/fonts/<dir>/index.css` 与 `files/`。现成带分片的字体直接用；整体字体用 `tools/slice-font.py` 切。
2. 在 `src/fonts.ts` 的 `BUNDLED_FACES` 加一行（`id` / `dir` / `family`）——`family` 必须与该目录 `index.css` 里的 `font-family` **逐字一致**，写错会让所有 `@font-face` 匹配不上而静默回退。`FONT_CHOICES` 由这张表派生，不用另改。
3. 在 `src/client/FontSection.tsx` 的 `CHOICE_COPY` 加名称与描述的字典键，并在 `src/client/locales.ts` 补齐中英文案。

除此之外插件里没有别处枚举字体。

## 排查：装了但字体没变

按顺序查这四处。

**1. 插件在不在 profile 清单里。** `dsh plugin add` 之后如果还有别的插件管理操作（GUI 插件页、并发的 `dsh plugin` 命令），新装的 bundle **可能被基于旧快照的重写挤掉**——实测装完 50 秒后另一次 profile 写入就会把它覆盖：

```powershell
(Get-Content "$env:USERPROFILE\.dsh\profiles\web\package.json" -Raw | ConvertFrom-Json).dsh.profile.bundles
```

列表里没有 `@guowenzhang/dsh-ui-beautify` 就重跑一次安装。

**2. Host 半边通没通。** 这条不需要浏览器：

```powershell
curl.exe -s -o NUL -w "%{http_code}`n" http://127.0.0.1:3080/plugins/dsh-ui-beautify/fonts/noto-sans-sc/index.css
```

`200` 说明 host 半边已在跑——profile 的 `patchReload: live` 会让 HMR 在清单变化后热重组，**装完不必重启宿主**。若不是 200，查上面的清单。

**3. 命名空间有没有暴露。** 设置区块读的是 Host 注册的 `ui-beautify` 命名空间；若区块显示「宿主设置服务不可用」，说明没有挂载 settings 提供方（`dsh-settings-file`），选择无法保存。

**4. Client 半边跑没跑。** 浏览器 Console：

```js
document.querySelector('link[data-plugin*="ui-beautify"]')?.href   // 应有 URL，不是 undefined
getComputedStyle(document.body).getPropertyValue('--dsw-font-family')
```

第二项应输出以当前所选字体族名开头的字体栈。

**Host 通了但 client 没跑**：浏览器还持有旧的 boot 图，硬刷新（Ctrl+F5）。改过 `lib/client.js` 后同理——`HANDOFF_ID` 没变时浏览器会继续跑旧 bundle，这是最容易被忽略的一步。

**注意 `getComputedStyle().fontFamily` 只反映声明的字体栈，不代表字体文件已经下载成功。** 要确认分片真的加载了：

```js
document.fonts.check('14px "LXGW WenKai"')   // true = 该字体已加载
```

或在 DevTools 的 Elements → Computed → Rendered Fonts 里看实际渲染用的字体。

## 目录

```
src/
  params.ts               两半边共用的路由与命名空间常量
  fonts.ts                可选字体表（system + 内置字体）与字体栈
  settings.ts             Host：注册 ui-beautify 命名空间
  index.ts                Host：认领字体路由 + 注册命名空间
  serve.ts                字体静态文件服务（含路径穿越防护、缓存策略）
  client/
    index.ts              Client：注册设置区块 + 应用所选字体
    FontSection.tsx       「页面美化」区块组件
    FontSection.module.css
    settings-controller.ts 设置命名空间 ↔ 区块快照
    locales.ts            中英文案
assets/fonts/
  noto-sans-sc/index.css + files/*.woff2 + LICENSE
  lxgw-wenkai/index.css  + files/*.woff2 + LICENSE
tools/slice-font.py       整体字体 → unicode-range 分片
tests/smoke.mjs           路由与命名空间注册、字体表、路径解析
tests/http.mjs            HTTP 层：响应头、字节哈希、woff2 魔数
```

## 接下来可以加的

- **代码字体**：同一套机制覆盖 `--ds-font-family-code`，配 Sarasa Mono SC 或 Source Han Mono 与正文同源。顺带能修掉 `--dsw-font-mono` 从未被定义、导致 ui-jobs / ui-agent-preset 一直走 fallback 的老问题。
- **字号阶梯、行高、圆角、间距**：同一区块继续加行即可。
- **自定义主题配色**：`ctx.theme.register` 可注册整套 alias token。

## 许可

插件本体 Apache-2.0；`assets/fonts/` 下的思源黑体与霞鹜文楷均为 SIL Open Font License 1.1。
