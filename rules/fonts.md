本文件覆盖字体表、字体按需分片下载链路与磁盘缓存、覆盖范围、加一款字体的步骤，以及「装了但字体没变」的排查路径；当你需要改字体表 / 下载与缓存机制 / 新增字体 / 排查字体没生效时读它。

# 字体与下载

## 字体表

两款字体**各自独立配置**：正文字体与代码字体各占插件独立设置页面里的一行，互不影响。
路由按 face id 解析、不区分角色（`anyFaceById`），所以**所有 id 在两份表之间必须唯一**。

### 正文字体（`system` 之外 14 款）

全部是 OFL 开源字体，每款都带 `unicode-range` 分片。

| id | 字体 | 分片 | 全量体积 | 来源 |
|---|---|---|---|---|
| `system` | 系统默认 | 不下载任何字体 | 0 | —— |
| `noto-sans-sc`（默认值）| 思源黑体 | 101 | 4.4 MB | `@fontsource-variable/noto-sans-sc@5.3.0` |
| `noto-serif-sc` | 思源宋体 | 101 | 5.9 MB | `@fontsource-variable/noto-serif-sc@5.3.0` |
| `lxgw-wenkai` | 霞鹜文楷 | 2 字重 × 97 | 9.0 MB | `lxgw-wenkai-webfont@1.7.0` |
| `lxgw-wenkai-tc` | 霞鹜文楷 TC | 2 字重 × 97 | 8.9 MB | `lxgw-wenkai-tc-webfont@1.2.0` |
| `lxgw-wenkai-screen` | 霞鹜文楷 屏幕版 | 97 | 5.0 MB | `lxgw-wenkai-screen-webfont@1.7.0` |
| `zcool-xiaowei` | 站酷小薇体 | 92 | 3.2 MB | `@fontsource/zcool-xiaowei@5.3.0` |
| `zcool-kuaile` | 站酷快乐体 | 93 | 1.1 MB | `@fontsource/zcool-kuaile@5.3.0` |
| `zcool-qingke-huangyou` | 站酷庆科黄油体 | 92 | 3.0 MB | `@fontsource/zcool-qingke-huangyou@5.3.0` |
| `ma-shan-zheng` | 马善政楷书 | 92 | 3.5 MB | `@fontsource/ma-shan-zheng@5.3.1` |
| `zhi-mang-xing` | 志莽行书 | 92 | 2.5 MB | `@fontsource/zhi-mang-xing@5.3.0` |
| `long-cang` | 龙藏体 | 92 | 3.2 MB | `@fontsource/long-cang@5.3.0` |
| `liu-jian-mao-cao` | 柳建毛草 | 92 | 2.6 MB | `@fontsource/liu-jian-mao-cao@5.3.0` |
| `inter` | Inter（拉丁）| 7 | 0.21 MB | `@fontsource-variable/inter@5.3.0` |
| `geist` | Geist（拉丁）| 5 | 0.07 MB | `@fontsource-variable/geist@5.3.0` |

### 代码字体（`system` 之外 5 款）

默认是 `system`——**不改变任何现有观感**，代码块沿用 DSH 内置的等宽字体栈。想要统一观感再自己选：

| id | 字体 | 分片 | 全量体积 | 来源 |
|---|---|---|---|---|
| `system`（默认值）| 系统默认 | 不下载任何字体，沿用内置栈 | 0 | —— |
| `jetbrains-mono` | JetBrains Mono | 6 | 0.08 MB | `@fontsource-variable/jetbrains-mono@5.3.0` |
| `fira-code` | Fira Code | 7 | 0.11 MB | `@fontsource-variable/fira-code@5.3.0` |
| `geist-mono` | Geist Mono | 6 | 0.07 MB | `@fontsource-variable/geist-mono@5.3.0` |
| `noto-sans-mono` | Noto Sans Mono | 7 | 0.30 MB | `@fontsource-variable/noto-sans-mono@5.3.0` |
| `maple-mono-cn` | Maple Mono CN | 239 | 9.0 MB | `@mogeko/maple-mono-cn@7.9.0` |

**只有 `maple-mono-cn` 覆盖中文**——中文注释也能对齐，代价是 9 MB 且 **npm 镜像没同步这个包，只能走 jsDelivr**（这正是镜像回退存在的意义）。其余四款只覆盖拉丁字符，中文回退到内置栈。

### 体积怎么读

**「分片」与「全量体积」指的是这一款字体**——它那几个样式表声明出来的全部分片之和（实测，解码后字节），**不是 npm 包的整包大小**：包里通常还有别的字重、别的子集和 `.woff` 备份，那些永远不会被下载。挑字体时以这张表为准，别拿包体积估算。

**「全量体积」也永远不会真的下完。** 分片是按 `unicode-range` 切的，浏览器只请求页面**实际渲染到的字符**所属的那几片：以思源黑体为例，latin 片约 25 KB，中文片多在 30 KB 上下（实测 19 片，最大 77 KB），也就是首屏通常只有几百 KB 而不是 4.4 MB。

**`system` 不是「把字体栈复制一份写进 token」**，而是**移除样式表链接与 token 覆盖层**，让 token 回到 ui-theme 自己的声明。区别在于：复制一份会把今天的默认值冻结在插件里，上游改了默认字体这里也不会跟随；移除覆盖则始终跟随。选中它也是「关掉自定义字体」的唯一方式，不需要卸载插件。

## 字体是怎么下载的

插件包里**一个字体文件都没有**（`assets/fonts/` 已删除，包体积从 12.7 MB 降到约 0.19 MB）。`src/fonts.ts` 里每一行只记 npm 包名、锁定版本和分包内的样式表路径，例如：

```ts
{ id: 'noto-sans-sc', family: 'Noto Sans SC Variable', group: 'cjk',
  source: { package: '@fontsource-variable/noto-sans-sc', version: '5.3.0', sheets: ['index.css'] } }
```

浏览器请求 `/plugins/dsh-ui-beautify/fonts/<face>/<包内路径>`，Host 半边按这个路径去镜像取文件、落盘、再回给浏览器。**路由直接镜像 npm 包的目录结构**，所以样式表里那些 `url(./files/x.woff2)` 相对路径原样成立，Host 不需要改写一个字节的 CSS（`tests/http.mjs` 断言了「逐字节相同」）。

### 三个路由

| 路由 | 类型 | 职责 |
|---|---|---|
| `/plugins/dsh-ui-beautify/fonts` | `webServer` prefix | 字体文件应答：命中缓存读盘、未命中下载，畸形路径 403、未知 face 404、镜像失败 502 |
| `/plugins/dsh-ui-beautify/cache` | `webServer` exact | 缓存用量 JSON（`no-store`，只读；只收 GET/HEAD，其他方法 405） |
| `/plugins/dsh-ui-beautify/brand` | `webServer` prefix | 上传并持久化品牌图片，按内容哈希提供图片读取 |

三条都在 `src/index.ts` 里用 `ctx.effect(() => ctx.webServer.register(...))` 注册，`inject: ['webServer']`。
路由挂在 `/plugins` 下，因为那是应用已经用来提供插件自有资源的源；`webServer` 按最长前缀优先解析，所以它赢过 `/plugins` 上的 client-modules bundle 路由。
`fontRouteFor` 把请求路径解析成 face + 包内相对路径，`isServablePath` 拒绝空段、`.`、`..`、反斜杠与 NUL——Windows 把反斜杠当分隔符，带反斜杠的路径能爬出缓存目录，所以一律按畸形拒绝而不是归一化。

### 下载链路

**浏览器从不直连外部站点**——它只跟 DSH 自己的源说话，由 Host 去取：

```
浏览器  ──①──▶  http://127.0.0.1:3080/plugins/dsh-ui-beautify/fonts/<face>/<包内路径>
（同源）               │
                      ├─ 命中缓存 ──▶ 读盘回给浏览器（分片带 immutable，浏览器自己再缓存一年）
                      │
                      └─ 未命中 ──②──▶  ① registry.npmmirror.com/<pkg>/<ver>/files/<path>
                                        ② cdn.jsdelivr.net/npm/<pkg>@<ver>/<path>
                                             │  200 → 校验 → 原子落盘 → 回给浏览器
                                             │  404 → 404    不可达/内容不对 → 502（no-store，可重试）
```

走 Host 代理而不是让浏览器直接 `<link>` 到 CDN，换来四件事：单源（不受 CSP / CORS 影响）、磁盘缓存（离线可用，浏览器换一个也还在）、镜像失败可回退、以及下载内容可控校验。代价是 Host 必须有外网出口；若宿主机不通网而浏览器通网，这条路走不通——这是本插件唯一依赖宿主联网的地方。

于是下载是**按需分片**的，不是整包预取：

1. 选中某款字体 → 浏览器请求它的样式表（约 2–105 KB），Host 从镜像取回并缓存。
2. 浏览器按 `unicode-range` 算出页面需要哪几片 → 逐个请求 `/files/*.woff2`，每片首次请求时 Host 才去下载。
3. 同一文件的并发请求在 Host 内合并成一次下载（`FontStore` 的 in-flight 表）。
4. 页面再次加载时全部走本地磁盘，不再联网。

镜像按顺序尝试，默认先 `registry.npmmirror.com`（国内可达），失败再退到 `cdn.jsdelivr.net`；镜像在配置里是 **URL 模板**而不是主机名，因为两个 registry 的版本位置不同（jsDelivr 把它放在路径段里，npmmirror 放在目录里）。任何一次下载都要先通过校验才会写入缓存：`woff2` 必须真的是 `wOF2` 开头，`.css` 必须含 `@font-face`/`@import`——镜像返回 200 的错误页不会被当成字体缓存下来，也不会发给浏览器。单次尝试 20 秒超时，单文件上限 8 MiB（按 `content-length` 与流式累计双重设限）。

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

想重新下（比如怀疑缓存坏了），直接删掉对应字体的目录即可，下次请求会重建。

### 行里的缓存状态

这一行只有三个元素，和旁边的偏好行完全一致：标题、当前字体的描述、以及一行状态；右侧是一个胶囊下拉。

```
正文字体                                        [ 思源黑体 ⌄ ]
无衬线，笔画粗细均匀、字形方正，界面文本最中性稳妥。
已缓存 103 KB · 1/101 片 · 打开本页时统计，刷新页面（F5）更新
```

**没有下载按钮**——字体是按需拉的，点选即用，不需要用户先决定下载什么。下载状态出现在两处：

| 位置 | 显示 |
|---|---|
| 下拉每一项 | `思源黑体 · 已缓存 4.3 MB`、`思源宋体 · 未下载`（`system` 不带后缀，它不下载任何东西） |
| 行内状态行 | 当前字体的完整读数：`已缓存 103 KB · 1/101 片` |

状态行里的分母来自**已缓存的样式表**：分片名字只写在样式表里，所以没有样式表就无从知道总数，也就显示为「未下载」。分子是磁盘上真实存在的分片数，因此「1/101」表示的是**按需下载的进度**，而不是下载失败——随着你继续浏览、页面出现新字符，它会自己涨。用量直接读目录（`FontStore.usage()`），不是账本：分片取哪些由浏览器决定，磁盘是唯一记录。

下拉按「基准 / 中文字体 / 拉丁字体」分组，当前选中项带勾。切换字体即写入设置，无需确认。

数字的读取时机只有两个：**这一行渲染时**，以及**切换字体后约 1.5 秒**（`CACHE_REREAD_DELAY_MS`，给首次下载留出落盘时间）。它不是实时订阅——下载在后台继续时数字会停在那一刻。因为**没有刷新按钮**，状态行末尾常驻一句提示，告诉用户**刷新页面（F5）**即可重新统计；重新加载会重新挂载这一行，也就重新读一次。

状态来自 Host 的 `GET /plugins/dsh-ui-beautify/cache`（`no-store`，只读）：

```powershell
curl.exe -s http://127.0.0.1:3080/plugins/dsh-ui-beautify/cache
# {"faces":{"noto-sans-sc":{"bytes":105494,"shardsCached":1,"shardsTotal":101}}}
```

## 覆盖范围

两个角色各改一组 token，都通过 `ctx.theme.overrideTokens` 写成 `body` 的行内样式：

| 角色 | token | 覆盖到 |
|---|---|---|
| 正文字体 | `--dsw-font-family` | 正文 / UI / Markdown |
| 代码字体 | `--ds-font-family-code` + `--dsw-font-mono` | 代码块、行内代码、JSON 树、轨迹表、工具行、侧栏路径、审批面板等 |

行内样式优先级高于 ui-theme 自己 `:root` 里的声明，因此不受插件激活顺序影响，卸载时自动回滚。
theme 服务每个来源只保留一层，所以两个角色的 token 必须在**一次** `overrideTokens(PLUGIN_ID, tokens)` 调用里一起给出——分两次调用会替换掉第一次的 token 而不是叠加。`tokens` 的 light / dark 两个槽给同一个字体栈：字体本身不带配色。

顺带修掉一个老问题：`--dsw-font-mono` **ui-theme 从未定义过**，而 `ui-jobs`、`ui-agent-preset`、`ui-plugin-manager`、文档预览四处都在用 `var(--dsw-font-mono, …)` 的带兜底写法（`ui-jobs` 那处甚至没写兜底）。现在代码字体一并把它绑上，这几处也跟着生效。

以下位置硬编码了字体，CSS 变量管不到，保持原样：

- 集成终端（xterm 构造参数，不走 CSS）
- 队列面板 `QueueDock.module.css` 里写死的 `Inter` 前缀

## 加一款字体

1. `npm run probe -- <包名>[@版本]` 评估候选包（见下节），拿到可用的样式表路径与字体族名。
2. 在 `src/fonts.ts` 的 `FONT_FACES`（正文字体）或 `CODE_FACES`（代码字体）加一行（`id` / `family` / `group` / `source`）——`family` 必须与该包样式表里的 `font-family` **逐字一致**，写错会让所有 `@font-face` 匹配不上而静默回退；`id` 只能是 `[a-z0-9-]`，它同时是路由段，且两份表之间必须唯一。`FONT_CHOICES` / `CODE_FONT_CHOICES` 由这张表派生，不用另改。
3. 在 `src/client/FontRows.tsx` 的 `CHOICE_COPY` 加名称与描述的字典键，并在 `src/client/locales.ts` 补齐中英文案。
4. `npm run test:cdn` 验证（**务必跑**，下面两个坑只有联网才看得出来），再 `npm run build && npm test`。

除此之外插件里没有别处枚举字体。

### 候选从哪里找

字体不是从某个字体站下的：插件只认 **npm 包**（一行 `包名@版本`，运行时从镜像取），所以"找字体" = "找发布了 webfont 的 npm 包"。实践中就两类来源：

| 来源 | 覆盖 | 本插件已用 |
|---|---|---|
| **Fontsource**（`@fontsource/*`、`@fontsource-variable/*`）| 把 Google Fonts 全量转成 npm 包，每款都带 `unicode-range` 分片，命名统一（`index.css` + `files/`）| 思源黑体、思源宋体、站酷小薇/快乐/庆科黄油、马善政楷书、志莽行书、龙藏体、柳建毛草、Inter、Geist |
| **字体作者或社区自建包** | 中文 webfont 的分片打包，命名各不相同，**必须逐个验** | `lxgw-wenkai-webfont`、`lxgw-wenkai-tc-webfont`、`lxgw-wenkai-screen-webfont`（霞鹜文楷系列）|

同类但未收录的还有 `@chinese-fonts/*`、`cn-fontsource-*`、`misans-vf`（MiSans）等——最后一个是 jsDelivr 独有（npmmirror 没同步），加进来就得依赖 jsDelivr。

`npm run probe` 就是给第二类准备的评估器：

```sh
npm run probe -- @fontsource/zcool-kuaile
npm run probe -- lxgw-wenkai-webfont 1.7.0 lxgwwenkai-regular.css
```

它对每个候选样式表报出：两个镜像各自的状态码、声明的字体族、`@font-face` 与 `unicode-range` 条数（决定**是不是真分片**）、首个分片的实际字节数；拿到切片样式表后，直接打印一行可以粘进 `fonts.ts` 的配置。实测同一款字体的两种样式表：

```
index.css                    registry.npmmirror.com=200 cdn.jsdelivr.net=200
    family 'Noto Sans SC' · slice ✓ 101 shards
    first url: files/noto-sans-sc-4-400-normal.woff2 (2300 B)
chinese-simplified-400.css   registry.npmmirror.com=200 cdn.jsdelivr.net=200
    family 'Noto Sans SC' · NOT SLICED (1 face(s), 0 ranges) — one download per subset
    first url: files/noto-sans-sc-chinese-simplified-400-normal.woff2 (1142552 B)
```

2.3 KB 对 1.1 MB——这就是下面两个坑，探针会在你提交之前把它们指出来。

### 选包时的两个坑

**一、`@fontsource` 的 `<subset>.css` 名字看着更对，其实是整字体。** 以 `@fontsource/noto-sans-sc` 为例：`index.css` / `400.css` 有 101 条 `@font-face` 且条条带 `unicode-range`（分片）；而 `chinese-simplified-400.css` 只有 1 条、**没有 `unicode-range`**，指向的是 1.09 MB 的**整包中文文件**——而它对应的分片只有 2.3 KB。**中文一律用 `index.css` 或 `<字重>.css`，不要用 `<subset>.css`。**

**二、`style.css` 可能只是 `@import`。** `lxgw-wenkai-webfont` 的 `style.css` 只有 248 字节、6 条 `@import`，一个 `@font-face` 都没有。要直接指向 `lxgwwenkai-regular.css` 这类真正带规则的子样式表。（顺带一提：该包的 `@fontsource` 版本 `@fontsource/lxgw-wenkai` 只有 3 个拉丁整字体、合计 22 MB，**没有中文分片**，不能用。）

`npm run test:cdn` 对每条样式表都断言「`@font-face` 条数 > 1 且条条带 `unicode-range`」，上面两种坑都会被它挡下来。

### 字重

一个字体可以有多个样式表，`sheets` 数组按顺序全部链入。霞鹜文楷只有 300/500/700 三个字重（**没有 400**），这里链入 regular(400) 与 bold(700)：界面用到的 400/500 落在 400，600/700 落到 700。可变字体（`@fontsource-variable/*`）一个分片就覆盖全部字重，不需要多份。

## 排查：装了但字体没变

按顺序查这七处。

**1. 插件在不在 profile 清单里。** `dsh plugin add` 之后如果还有别的插件管理操作（GUI 插件页、并发的 `dsh plugin` 命令），新装的 bundle **可能被基于旧快照的重写挤掉**——实测装完 50 秒后另一次 profile 写入就会把它覆盖：

```powershell
(Get-Content "$env:USERPROFILE\.dsh\profiles\web\package.json" -Raw | ConvertFrom-Json).dsh.profile.bundles
```

列表里没有 `@guowenzhang/dsh-ui-beautify` 就重跑一次安装。

**2. Host 半边通没通。** 这条不需要浏览器，也顺带验证了镜像可达：

```powershell
curl.exe -s -o NUL -w "%{http_code}`n" http://127.0.0.1:3080/plugins/dsh-ui-beautify/fonts/noto-sans-sc/index.css
```

`200` 说明路由已在跑、镜像也通——profile 的 `patchReload: live` 会让 HMR 在清单变化后热重组，**装完不必重启宿主**。若是 `502`，是镜像不可达（检查 `mirrors` 配置与网络）；若是 `404`，多半是清单里没有这个插件（未知 face id 也是 404）；若是 `403`，是请求路径本身畸形。

**3. 命名空间有没有暴露。** 那一行读的是 Host 注册的 `ui-beautify` 命名空间；若状态行显示「宿主设置服务不可用」，说明没有挂载 settings 提供方（`dsh-settings-file`），选择无法保存。

**4. 设置页在不在。** 它注册进的是 `settings.section`——由 **ui-settings-general** 声明。若宿主里没有这个包（老版本或裁剪过的组合），`ctx.slots.inject` 会一直等这个声明，**界面美化页面不出现，但字体照常应用**；此时只能改当前 profile 的 `cordis.patch.yml` 手工选。

**5. 点了没反应。** 先看那一行的状态行有没有写「**宿主仍在运行本插件的旧版本，它的配置里没有这一行对应的字段**」——写了就是下面这个情况，**必须重启 dsh**：

**宿主半边和浏览器半边不是一起更新的。** `lib/client.js` 由浏览器在每次加载页面时从磁盘重新取，所以**改完 client 产物只需硬刷新**；而 `lib/index.mjs`（Host 半边）是**每个进程只 import 一次**，它的配置 schema 就是启动那一刻的那份。于是升级插件后可能出现：浏览器已经渲染出新的行，宿主的 schema 里却没有对应的设置字段——写进去会被拒，控件看着可点，实际什么都不会发生。

判据很直接，比对三个时间：

```powershell
(Get-Process -Id <dsh 宿主 pid>).StartTime                                      # 宿主何时启动
(Get-Item "$env:USERPROFILE\.dsh\profiles\web\cordis.patch.yml").LastWriteTime  # 设置何时写入
(Get-Item C:\02-codespace\deepseek-harness\dsh-ui-beautify\lib\index.mjs).LastWriteTime  # 插件何时构建
```

宿主启动时间**早于**插件构建时间，就需要重启。重启后 Host 重新 import，schema 里就有了新字段；浏览器再硬刷新一次即可。

**6. Client 半边跑没跑。** 浏览器 Console：

```js
document.querySelectorAll('link[data-plugin*="ui-beautify"]').length   // 选中内置字体时应为 1，霞鹜文楷为 2
getComputedStyle(document.body).getPropertyValue('--dsw-font-family')
getComputedStyle(document.body).getPropertyValue('--ds-font-family-code')
```

第三项应输出以当前所选代码字体族名开头的等宽栈（选 `system` 时是 ui-theme 的默认值）。

**Host 通了但 client 没跑**：浏览器还持有旧的 boot 图，硬刷新（Ctrl+F5）。改过 `lib/client.js` 后同理——`HANDOFF_ID` 没变时浏览器会继续跑旧 bundle，这是最容易被忽略的一步。

**注意 `getComputedStyle().fontFamily` 只反映声明的字体栈，不代表字体文件已经下载成功。** 要确认分片真的加载了：

```js
document.fonts.check('14px "LXGW WenKai"')   // true = 该字体已加载
```

或在 DevTools 的 Elements → Computed → Rendered Fonts 里看实际渲染用的字体；在 Network 里筛 `fonts/` 能看到哪些分片被拉取、哪些来自 `(disk cache)`。

**7. 缓存里到底有没有东西。** 界面美化页的字体状态行就会写；要命令行确认，缓存目录默认在 `$DSH_HOME/cache/ui-beautify/fonts`（Windows 上是 `C:\Users\<你>\.dsh\cache\ui-beautify\fonts`），每个字体一个目录，里面一个 generation 目录：

```powershell
curl.exe -s http://127.0.0.1:3080/plugins/dsh-ui-beautify/cache
Get-ChildItem "$env:USERPROFILE\.dsh\cache\ui-beautify\fonts" -Recurse -File | Select-Object -First 10 FullName, Length
```

想重新下（比如怀疑缓存坏了），直接删掉对应字体的目录即可，下次请求会重建。
