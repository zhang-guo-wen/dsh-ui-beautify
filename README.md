# @guowenzhang/dsh-ui-beautify

DeepSeek Harness 的**页面美化插件**。目前的能力：让 Web GUI 在设置页里切换**正文字体**。字体**不随插件分发**——插件里只存下载地址，字体在首次使用时下载到本机缓存，之后完全离线可用。

## 它做什么

| 半边 | 职责 |
|---|---|
| Host | 认领两个路由：一个前缀路由把浏览器要的字体文件从镜像下载下来并缓存，再按 npm 包里的原始路径提供出去；一个精确路由汇报缓存里已有什么 |
| Client | 按选择链入对应字体的分片样式表，把 `--dsw-font-family` 重绑过去，并渲染设置页的「页面美化」区块（含每款字体的缓存状态） |

字体通过**主题服务的覆盖层**（`ctx.theme.overrideTokens`）生效——它写成 `body` 的行内样式，优先级高于 `:root`，因此不受插件激活顺序影响，卸载时自动回滚。

设置入口在 **Settings → 页面美化**（`settings.section`，order 12）。选择写进 `~/.dsh/settings.yaml` 的 `ui-beautify` 分节，改完立即生效、无需重启。

## 可选字体

`system` 之外共 10 款，全部是 OFL 开源字体，每款都带 `unicode-range` 分片。

| id | 字体 | 分片 | 全量体积 | 来源 |
|---|---|---|---|---|
| `system` | 系统默认 | 不下载任何字体 | 0 | —— |
| `noto-sans-sc`（默认值）| 思源黑体 | 101 | 4.3 MB | `@fontsource-variable/noto-sans-sc@5.3.0` |
| `noto-serif-sc` | 思源宋体 | 101 | 5.8 MB | `@fontsource-variable/noto-serif-sc@5.3.0` |
| `lxgw-wenkai` | 霞鹜文楷 | 2 字重 × 97 | 28 MB | `lxgw-wenkai-webfont@1.7.0` |
| `lxgw-wenkai-tc` | 霞鹜文楷 TC | 2 字重 × 97 | 27 MB | `lxgw-wenkai-tc-webfont@1.2.0` |
| `zcool-xiaowei` | 站酷小薇体 | 93 | 5.2 MB | `@fontsource/zcool-xiaowei@5.3.0` |
| `zcool-kuaile` | 站酷快乐体 | 94 | 1.7 MB | `@fontsource/zcool-kuaile@5.3.0` |
| `ma-shan-zheng` | 马善政楷书 | 93 | 6.0 MB | `@fontsource/ma-shan-zheng@5.3.1` |
| `zhi-mang-xing` | 志莽行书 | 93 | 4.3 MB | `@fontsource/zhi-mang-xing@5.3.0` |
| `inter` | Inter（拉丁）| 42 | 1.8 MB | `@fontsource-variable/inter@5.3.0` |
| `geist` | Geist（拉丁）| 10 | 0.15 MB | `@fontsource-variable/geist@5.3.0` |

**「全量体积」永远不会真的下完。** 分片是按 `unicode-range` 切的，浏览器只请求页面**实际渲染到的字符**所属的那几片：以思源黑体为例，latin 片约 25 KB，中文片多在 30 KB 上下（实测 19 片，最大 77 KB），也就是首屏通常只有几百 KB 而不是 4.3 MB。`inter` / `geist` 只覆盖拉丁字符，中文回退到系统字体栈——卡片描述里写明了这一点。

**`system` 不是「把系统字体栈复制一份写进 `--dsw-font-family`」**，而是**移除样式表链接与 token 覆盖层**，让 `--dsw-font-family` 回到 ui-theme 自己的声明。区别在于：复制一份会把今天的默认值冻结在插件里，上游改了默认字体这里也不会跟随；移除覆盖则始终跟随。选中它也是「关掉自定义字体」的唯一方式，不需要卸载插件。

## 字体是怎么下载的

插件包里**一个字体文件都没有**（`assets/fonts/` 已删除，包体积从 12.7 MB 降到约 0.19 MB）。`src/fonts.ts` 里每一行只记 npm 包名、锁定版本和分包内的样式表路径，例如：

```ts
{ id: 'noto-sans-sc', family: 'Noto Sans SC Variable', group: 'cjk',
  source: { package: '@fontsource-variable/noto-sans-sc', version: '5.3.0', sheets: ['index.css'] } }
```

浏览器请求 `/plugins/dsh-ui-beautify/fonts/<face>/<包内路径>`，Host 半边按这个路径去镜像取文件、落盘、再回给浏览器。**路由直接镜像 npm 包的目录结构**，所以样式表里那些 `url(./files/x.woff2)` 相对路径原样成立，Host 不需要改写一个字节的 CSS（`tests/http.mjs` 断言了「逐字节相同」）。

于是下载是**按需分片**的，不是整包预取：

1. 选中某款字体 → 浏览器请求它的样式表（约 2–105 KB），Host 从镜像取回并缓存。
2. 浏览器按 `unicode-range` 算出页面需要哪几片 → 逐个请求 `/files/*.woff2`，每片首次请求时 Host 才去下载。
3. 同一文件的并发请求在 Host 内合并成一次下载（`FontStore` 的 in-flight 表）。
4. 页面再次加载时全部走本地磁盘，不再联网。

镜像按顺序尝试，默认先 `registry.npmmirror.com`（国内可达），失败再退到 `cdn.jsdelivr.net`。任何一次下载都要先通过校验才会写入缓存：`woff2` 必须真的是 `wOF2` 开头，`.css` 必须含 `@font-face`/`@import`——镜像返回 200 的错误页不会被当成字体缓存下来，也不会发给浏览器。

### 缓存位置与失效

```
$DSH_HOME/cache/ui-beautify/fonts/<face>/<generation>/<包内路径>
```

`<generation>` 是 `包名@版本 + 样式表列表` 的哈希。改动其中任何一项（升级字体版本、给一款字体加减字重）都会换一个 generation 目录，旧的在新目录写成功后删除——不会出现「升级了插件却还在发旧分片」。文件先写临时名再 `rename`，因此缓存里不会留下写了一半的分片。

缓存的应答语义：

| 情况 | 应答 |
|---|---|
| 命中缓存 | 直接读盘；样式表 `no-cache`（每次校验），分片 `immutable` 长缓存 |
| 镜像没有这个文件 | `404` |
| 镜像不可达、或返回的内容不是字体 | `502` + `no-store`（可重试，不会被缓存） |

字体没下下来时界面**不会坏**：`@font-face` 带 `font-display: swap`，浏览器先用手上的回退字体渲染，分片到位后再替换；彻底失败就一直用回退字体，只是没换成功。

### 卡片上的缓存状态

每张卡片底部有一行状态，**没有下载按钮**——字体是按需拉的，点选即用，不需要用户先决定下载什么：

| 卡片显示 | 含义 |
|---|---|
| `未下载` | 这款字体的样式表还没被取过，磁盘占用为 0 |
| `已缓存 103 KB · 1/101 片` | 样式表已缓存，101 个 `unicode-range` 分片里已有 1 片 |
| `已缓存 4.3 MB · 101/101 片` | 这款字体在当前界面用到的字符已经全部在本地 |

分母来自**已缓存的样式表**：分片名字只写在样式表里，所以没有样式表就无从知道总数，也就显示为「未下载」。分子是磁盘上真实存在的分片数，因此「1/101」表示的是**按需下载的进度**，而不是下载失败——随着你继续浏览、页面出现新字符，它会自己涨。

数字的读取时机只有两个：**打开这个设置页时**，以及**切换字体后约 1.5 秒**（给首次下载留出落盘时间）。它不是实时订阅——下载在后台继续时数字会停在那一刻。因为**没有刷新按钮**，介绍文案下方常驻一行提示，告诉用户**刷新页面（F5）**即可重新统计；重新加载会重新挂载这个区块，也就重新读一次。

`system` 卡片没有状态行——它本来就不下载任何东西。

状态来自 Host 的 `GET /plugins/dsh-ui-beautify/cache`（`no-store`，只读）：

```powershell
curl.exe -s http://127.0.0.1:3080/plugins/dsh-ui-beautify/cache
# {"faces":{"noto-sans-sc":{"bytes":105494,"shardsCached":1,"shardsTotal":101}}}
```

### 两个可配项

`mirrors` 与 `cacheDir` 是这个插件行的**普通配置**（不是设置页里的实时字段）：它们在宿主启动时读一次，改完要重启宿主。写在 profile 的 `cordis.patch.yml` 或 `~/.dsh/cordis.patch.yml` 的插件行 `config` 下：

```yaml
- id: ui-beautify
  name: '@guowenzhang/dsh-ui-beautify'
  config:
    mirrors:
      - 'https://registry.npmmirror.com/{package}/{version}/files/{path}'
      - 'https://cdn.jsdelivr.net/npm/{package}@{version}/{path}'
    cacheDir: 'D:/dsh-font-cache'   # 留空则用 $DSH_HOME/cache/ui-beautify/fonts
```

模板里的 `{package}` / `{version}` / `{path}` 会被替换；换公司内网镜像、加一层代理缓存，都只改这里，不动代码。

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
npm test               # 冒烟 + HTTP 层验证（对构建产物运行，不联网）
npm run test:cdn       # 联网：逐字体校验两个镜像、分片与字体族名
```

- `tests/smoke.mjs`：mock ctx 调 `apply()`，断言路由注册、字体表完整性（id 字符集、包名版本、样式表路径）、路由解析与路径穿越防护、镜像模板拼接、缓存目录解析、设置 schema。
- `tests/http.mjs`：**桩镜像**（`node:http`）+ 真实 `node:http` 服务器驱动插件 handler。断言响应头与字节、第二次请求走磁盘、并发冷请求只下载一次、三种失败应答（404 / 502 / 403）、镜像回退，最后**关掉桩镜像再请求一次**，证明缓存命中可离线工作。
- `tests/client.mjs`：按浏览器加载器的姿势（`window.__ModuleLoader__.load`）加载**构建产物** `lib/client.js`，配一个假 ctx、DOM 桩与只记录调用的 React 桩驱动 `apply()` 并渲染区块，断言设置区块注册、每款字体链入的链接、系统默认时全部移除、`--dsw-font-family` 的重绑内容，以及缓存状态行（`已缓存 4.3 MB · 12/194 片` 之类）由用量数据算出来。client 半边没有单元测试的其他覆盖，这条是「bundle 能不能加载、链接指向对不对、卡片显示什么」的唯一防线。
- `tests/cdn.mjs`：对真实镜像逐个字体跑，除了 200 还检查两件容易踩的事——样式表里声明的 `font-family` 与表里写的一致，以及它**确实是 `unicode-range` 分片**而不是一个整字体文件。

`lib/` 是**提交进仓库的构建产物**，这样可以直接从 git 安装。改完源码记得 `npm run build` 并把 `lib/` 一起提交。

## 加一款字体

1. 在 `src/fonts.ts` 的 `FONT_FACES` 加一行（`id` / `family` / `group` / `source`）——`family` 必须与该包样式表里的 `font-family` **逐字一致**，写错会让所有 `@font-face` 匹配不上而静默回退；`id` 只能是 `[a-z0-9-]`，它同时是路由段。`FONT_CHOICES` 由这张表派生，不用另改。
2. 在 `src/client/FontSection.tsx` 的 `CHOICE_COPY` 加名称与描述的字典键，并在 `src/client/locales.ts` 补齐中英文案。
3. `npm run test:cdn` 验证（**务必跑**，下面两个坑只有联网才看得出来），再 `npm run build && npm test`。

除此之外插件里没有别处枚举字体。

### 选包时的两个坑

**一、`@fontsource` 的 `<subset>.css` 名字看着更对，其实是整字体。** 以 `@fontsource/noto-sans-sc` 为例：`index.css` / `400.css` 有 101 条 `@font-face` 且条条带 `unicode-range`（分片）；而 `chinese-simplified-400.css` 只有 1 条、**没有 `unicode-range`**，指向的是 1.09 MB 的**整包中文文件**——而它对应的分片只有 2.3 KB。**中文一律用 `index.css` 或 `<字重>.css`，不要用 `<subset>.css`。**

**二、`style.css` 可能只是 `@import`。** `lxgw-wenkai-webfont` 的 `style.css` 只有 248 字节、6 条 `@import`，一个 `@font-face` 都没有。要直接指向 `lxgwwenkai-regular.css` 这类真正带规则的子样式表。（顺带一提：该包的 `@fontsource` 版本 `@fontsource/lxgw-wenkai` 只有 3 个拉丁整字体、合计 22 MB，**没有中文分片**，不能用。）

`npm run test:cdn` 对每条样式表都断言「`@font-face` 条数 > 1 且条条带 `unicode-range`」，上面两种坑都会被它挡下来。

### 字重

一个字体可以有多个样式表，`sheets` 数组按顺序全部链入。霞鹜文楷只有 300/500/700 三个字重（**没有 400**），这里链入 regular(400) 与 bold(700)：界面用到的 400/500 落在 400，600/700 落到 700。可变字体（`@fontsource-variable/*`）一个分片就覆盖全部字重，不需要多份。

## 排查：装了但字体没变

按顺序查这五处。

**1. 插件在不在 profile 清单里。** `dsh plugin add` 之后如果还有别的插件管理操作（GUI 插件页、并发的 `dsh plugin` 命令），新装的 bundle **可能被基于旧快照的重写挤掉**——实测装完 50 秒后另一次 profile 写入就会把它覆盖：

```powershell
(Get-Content "$env:USERPROFILE\.dsh\profiles\web\package.json" -Raw | ConvertFrom-Json).dsh.profile.bundles
```

列表里没有 `@guowenzhang/dsh-ui-beautify` 就重跑一次安装。

**2. Host 半边通没通。** 这条不需要浏览器，也顺带验证了镜像可达：

```powershell
curl.exe -s -o NUL -w "%{http_code}`n" http://127.0.0.1:3080/plugins/dsh-ui-beautify/fonts/noto-sans-sc/index.css
```

`200` 说明路由已在跑、镜像也通——profile 的 `patchReload: live` 会让 HMR 在清单变化后热重组，**装完不必重启宿主**。若是 `502`，是镜像不可达（检查 `mirrors` 配置与网络）；若是 `404`，多半是清单里没有这个插件。

**3. 命名空间有没有暴露。** 设置区块读的是 Host 注册的 `ui-beautify` 命名空间；若区块显示「宿主设置服务不可用」，说明没有挂载 settings 提供方（`dsh-settings-file`），选择无法保存。

**4. Client 半边跑没跑。** 浏览器 Console：

```js
document.querySelectorAll('link[data-plugin*="ui-beautify"]').length   // 选中内置字体时应为 1，霞鹜文楷为 2
getComputedStyle(document.body).getPropertyValue('--dsw-font-family')
```

第二项应输出以当前所选字体族名开头的字体栈。

**Host 通了但 client 没跑**：浏览器还持有旧的 boot 图，硬刷新（Ctrl+F5）。改过 `lib/client.js` 后同理——`HANDOFF_ID` 没变时浏览器会继续跑旧 bundle，这是最容易被忽略的一步。

**注意 `getComputedStyle().fontFamily` 只反映声明的字体栈，不代表字体文件已经下载成功。** 要确认分片真的加载了：

```js
document.fonts.check('14px "LXGW WenKai"')   // true = 该字体已加载
```

或在 DevTools 的 Elements → Computed → Rendered Fonts 里看实际渲染用的字体；在 Network 里筛 `fonts/` 能看到哪些分片被拉取、哪些来自 `(disk cache)`。

**5. 缓存里到底有没有东西。** 设置页每张卡片底部就有一行状态；要命令行确认，缓存目录默认在 `$DSH_HOME/cache/ui-beautify/fonts`（Windows 上是 `C:\Users\<你>\.dsh\cache\ui-beautify\fonts`），每个字体一个目录，里面一个 generation 目录：

```powershell
curl.exe -s http://127.0.0.1:3080/plugins/dsh-ui-beautify/cache
Get-ChildItem "$env:USERPROFILE\.dsh\cache\ui-beautify\fonts" -Recurse -File | Select-Object -First 10 FullName, Length
```

想重新下（比如怀疑缓存坏了），直接删掉对应字体的目录即可，下次请求会重建。

## 目录

```
src/
  params.ts               两半边共用的路由（字体前缀 + 缓存精确路由）与命名空间常量
  fonts.ts                可选字体表（system + 10 款，含 npm 来源）与字体栈、缓存用量类型
  source.ts               镜像模板、带超时/体积上限/内容校验的下载
  store.ts                磁盘缓存（generation、原子写入、并发合并、过期清理、用量统计）
  serve.ts                两个 HTTP 面：字体文件应答（404/502）与缓存用量 JSON
  settings.ts             Host：ui-beautify 命名空间与 mirrors/cacheDir 配置
  index.ts                Host：认领两个路由
  client/
    index.ts              Client：注册设置区块 + 应用所选字体
    FontSection.tsx       「页面美化」区块组件（分组渲染 + 每卡缓存状态行 + 刷新提示）
    FontSection.module.css
    settings-controller.ts 设置命名空间、缓存用量 ↔ 区块快照
    locales.ts            中英文案
tests/
  smoke.mjs               路由、字体表、路径解析、配置默认值（离线）
  http.mjs                桩镜像下的 HTTP 层：字节、缓存、并发、失败应答、离线、用量上报
  client.mjs              加载 lib/client.js 驱动 apply() 并渲染区块：链接、token 重绑、缓存状态行
  cdn.mjs                 联网逐字体校验镜像、分片与族名
```

## 接下来可以加的

- **代码字体**：同一套机制覆盖 `--ds-font-family-code`，配 Sarasa Mono SC 或 Maple Mono CN 与正文同源。顺带能修掉 `--dsw-font-mono` 从未被定义、导致 ui-jobs / ui-agent-preset 一直走 fallback 的老问题。
- **镜像自动测速**：启动时对 `mirrors` 各探一次，把最快的排到前面，而不是固定顺序。
- **设置页里的缓存管理**：显示每款字体的缓存占用与「重新下载」按钮——`FontStore` 已经有 generation 概念，加上 enumerating 与 `rm` 即可。
- **字号阶梯、行高、圆角、间距**：同一区块继续加行即可。
- **自定义主题配色**：`ctx.theme.register` 可注册整套 alias token。

## 许可

插件本体 Apache-2.0。**插件不分发任何字体文件**：字体按需从 npm 镜像下载到本机缓存，各自保留原始许可——思源黑体/思源宋体/站酷小薇/站酷快乐/马善政楷书/志莽行书/Inter/Geist 为 SIL Open Font License 1.1（由 Fontsource 打包），霞鹜文楷与霞鹜文楷 TC 的字体同为 OFL 1.1，承载它们的 npm 包 `lxgw-wenkai-webfont` / `lxgw-wenkai-tc-webfont` 为 MIT。
