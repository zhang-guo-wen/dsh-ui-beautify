---
paths:
  - "package.json"
  - "tsconfig.json"
  - "build-client.mjs"
  - "tsdown.config.ts"
  - "lib/**"
  - "docs/**"
  - "README.md"
  - "README.zh.md"
  - "tests/client.mjs"
  - "tests/smoke.mjs"
  - "tests/plugin-metadata.test.mjs"
---

> 覆盖什么、何时读：本文件覆盖仓库目录逐文件说明、构建产出、测试清单、部署与生效语义、发版流程、易崩清单、后续可加项与 README 截图约定；当你需要构建、发布、排障或规划下一步时读它。

# 构建、测试与发版

## 目录

仓库根**就是**包：`package.json` 即 `@guowenzhang/dsh-ui-beautify`。
这不是风格选择——`dsh plugin add <git-url>` 取的是仓库根，包放在 `packages/*` 下会被装成错误的东西。

```
src/
  params.ts               两半边共用的路由（字体前缀 + 缓存精确路由）与命名空间常量
  fonts.ts                角色表（正文 / 代码）、两份字体表、字体栈、缓存用量类型、命名空间值的类型
  motion.ts               车道的动效选择（跟随浏览器 / 始终播放 / 关闭）与 prefers-reduced-motion 读取
  quick-replies.ts        快捷回复的槽位模型：最多几条、空槽怎么算、超长怎么截，两半边共用
  source.ts               镜像模板、带超时/体积上限/内容校验的下载
  store.ts                磁盘缓存（generation、原子写入、并发合并、过期清理、用量统计）
  serve.ts                两个 HTTP 面：字体文件应答（404/502）与缓存用量 JSON
  settings.ts             Host：ui-beautify 命名空间（字体 / 动效 / 快捷回复 / 品牌）与 mirrors/cacheDir 配置
  brand-assets.ts         Host：图片上传校验、持久化与图片应答
  index.ts                Host：认领字体、缓存与品牌图片三个路由
  client/
    index.ts              Client：注册独立设置页、composer 上下的车道与快捷回复 + 按角色应用所选字体
    BeautifySection.tsx   字体、动效、快捷回复开关与品牌页面（内容编辑行暂不挂载）
    BrandRows.tsx         欢迎页 Logo、侧栏图标的上传控件与名称输入
    branding.tsx          仅在设置非空时接管宿主品牌插槽
    FontRows.tsx          字体偏好行组件（标题 / 描述 / 缓存状态 + 下拉选择），两个角色共用
    MotionRow.tsx         车道那一行：三选一，并写出「为什么带子是空的」
    QuickReplyRow.tsx     快捷回复内容编辑行（**暂不挂载**）：4 个槽位标签，点开就地编辑
    QuickReplyToggleRow.tsx PC 端快捷回复显示开关：复用宿主 Switch，手机隐藏
    SettingRow.module.css 七项设置共用的行样式
    BikeLane.tsx          composer 卡片正上方的骑车小人：SVG 与逐帧驱动
    BikeLane.module.css
    QuickReplies.tsx      composer 卡片正下方的快捷回复标签：短语 → 草稿 → 提交
    QuickReplies.module.css
    output-rate.ts        输出速率（字符/秒）与「速率 → 车速」映射，纯函数
    settings-controller.ts 设置命名空间、缓存用量 ↔ 行快照，独立页面共用一份
    locales.ts            中英文案（设置行 + 快捷回复短语）
tests/
  smoke.mjs               路由、两份字体表、路径解析、配置默认值、快捷回复槽位（离线）
  http.mjs                桩镜像下的 HTTP 层：字节、缓存、并发、失败应答、离线、用量上报
  client.mjs              加载 lib/client.js 驱动 apply()：独立设置页、品牌插槽、链接、两种 token、下拉、状态行、快捷回复的默认与自定义短语，以及逐帧驱动的 composer 车道
  brand.mjs               图片上传、拒绝无效文件、持久化和读取的 HTTP 测试
  cdn.mjs                 联网逐字体（两个角色）校验镜像、分片与族名
tools/
  probe-font.mjs          联网评估候选 npm 包：分片、族名、镜像可达、可直接粘贴的配置行
```

- `lib/` —— 构建产物：**已提交进仓库**（`index.mjs` host + `client.js` 浏览器 handoff），这样别人可以直接从 git 安装。改完源码**记得 `npm run build` 并把 `lib/` 一起提交**。

### 打包配置与许可

- `cordis.patch.yml` —— 把插件行插入组合的 bundle 层。
- `build-client.mjs` / `tsdown.config.ts` —— 两段打包的配置（见「构建」）。
- `LICENSE` / `NOTICE` —— 插件本体 Apache-2.0；字体各自的许可与上游声明见 `NOTICE`。

## 构建

```sh
npm install
npm run typecheck      # tsc --noEmit -p tsconfig.json
npm run build          # tsdown（host）+ build-client.mjs（client handoff 包）
```

- host：`tsdown` 打 `src/index.ts` → `lib/index.mjs`，`@deepseek-ai/*` 全部保持 external（`deps.neverBundle`），`clean: true`。
- client：`build-client.mjs`（rolldown）→ `lib/client.js`，包成 `window.__ModuleLoader__.load({ id, factory })`，react / `@deepseek-ai/*` external，`.module.css` 用 lightningcss 编译并内联成 `<style data-plugin-css=…>`。

CSS module 的类名映射按 local 名排序后才输出：lightningcss 的 `exports` 没有稳定键序，不排序会让每次构建产出字节不同的 `lib/client.js`，在提交进仓库的产物上表现为无意义的 diff。

`lib/` 是**提交进仓库的构建产物**，这样可以直接从 git 安装。改完源码记得 `npm run build` 并把 `lib/` 一起提交。

## 测试

```sh
npm test               # 冒烟 + HTTP 层验证（对构建产物运行，不联网）
npm run test:cdn       # 联网：逐字体校验两个镜像、分片与字体族名
npm run probe -- <包>  # 联网：评估一个候选 npm 包能不能当字体用
```

- `tests/smoke.mjs`：mock ctx 调 `apply()`，断言路由注册、字体表完整性（id 字符集、包名版本、样式表路径）、路由解析与路径穿越防护、镜像模板拼接、缓存目录解析、设置 schema。
- `tests/http.mjs`：**桩镜像**（`node:http`）+ 真实 `node:http` 服务器驱动插件 handler。断言响应头与字节、第二次请求走磁盘、并发冷请求只下载一次、三种失败应答（404 / 502 / 403）、镜像回退，最后**关掉桩镜像再请求一次**，证明缓存命中可离线工作。
- `tests/client.mjs`：按浏览器加载器的姿势加载**构建产物** `lib/client.js`，用假 ctx、DOM 桩与 React 桩驱动 `apply()`，断言独立 `settings.section` 的注册、字体链接和 token、设置页控件、品牌图片上传写入与默认值恢复，以及 composer 车道和快捷回复。
  同一份桩还模拟了宿主 ref、commit 后 effect 与**可控时钟**，于是 composer 车道可以逐帧驱动：断言它注册进 `conversation.input.dock`、order 100、`aria-hidden`、**没有输出时位移与轮转都精确为 0**、有输出时前进并转轮、**输出停下后仍滑行 2 秒、8 秒后才完全停住**、以及**在车道上时从不跳回起点**（换行只允许发生在两端都基本在画面外的那一帧）；再加上三种动效选择的行为——`system` + 浏览器要求减少动效时不渲染也不申请帧、`always` 时照常播放并在动、`off` 时什么都不画。车道那一行也在这里渲染：三选一的选项、以及状态行写出「为什么带子是空的」。两个测量辅助函数把「没写过 transform」当成停住（0），而不是 `NaN`——停住的车道**什么都不写**，用 `NaN` 会让停住的断言全部假失败；`travelOf` / `turnOf` 读的是像素，所以「没跳回起点」要按**可见性**判断（换行那一帧两端都在画面外，DOM 上却是一次 800px 的跳跃）。车轮角度必须取模（`((to - from) % 360 + 360) % 360` 并只在单帧内测量）——绝对角度会绕圈，增量会因绕圈变成负数。
- `tests/cdn.mjs`：对真实镜像逐个字体跑，除了 200 还检查两件容易踩的事——样式表里声明的 `font-family` 与表里写的一致，以及它**确实是 `unicode-range` 分片**而不是一个整字体文件。
- 快捷回复在同一份 `tests/client.mjs` 里断言：注册进 `conversation.composer.dock`（不是 `settings.general.item`）、order 1、四个内置短语按字典顺序各占一个标签、外层的 `role="group"` 与 `aria-label`、每个标签自己的 `aria-label`、点击后先按捕获到的光标位置 `insertText` 再 `submit`、**插入被拒时一次都不提交**、以及 `submitting` 相位下全部禁用。再加上自定义那一段：存的短语整排顶替内置、空槽不占标签、超过 4 条被截断、四个都空回落内置、点击发的是自定义文本。设置行单独走一遍**点击 → 编辑 → 保存**：4 个标签按字典显示内置短语且都是灰的、`aria-label` 是「编辑「<显示的字>」」、点灰标签写入该内置短语并把这一格换成输入框（`defaultValue`/`placeholder`/`autoFocus`）、失焦写回裁剪后的文字、清空把这一格关掉、Esc 写回点击前的值并关掉输入框、点实心标签本身不写入、点「恢复默认」写入空列表、宿主 schema 缺字段时显示 `stale` 且标签禁用。**测试桩的 `useState` 会跨 mount 保留值**，所以「点击 → 再 mount 同一实例」就是一次重渲染。`src/quick-replies.ts` 的纯函数（裁剪、去空、保位）在 `tests/smoke.mjs` 里断言。设置行那一整块断言由 `pageComponents.has('QuickReplyRow')` 守卫：这一行现在不挂载，所以整块跳过并打一行 parked；把它挂回页面即 24 条全部重跑，不需要改测试。`Pill` 是为此加进桩表的——client 半边新增 import 同样要同步那一张（见易崩清单 12）。**一行放不下就少显示几条**那一节另有一组断言：桩里给行挂上假的 `classList`/`getBoundingClientRect` 与「每个可见条数对应多大的盒子」，再由 `ResizeObserver` 桩手动触发测量，断言放得下就四条、超出就丢尾部并加 `.hidden`、窄到一条都放不下时显示 0 条但行仍在（否则变宽后测不回来）、变宽后整排回来；`window` 桩因此补了 `addEventListener`/`removeEventListener`。**闪烁修复后这一段桩也模拟了「class 两份」与 React 的提交**：每条标签的 class 是一个集合，`classList.toggle(name, on)` 按名字增删（不再是单个 `hidden` 布尔），并且只有带 `.tag` 的可见标签才报自己的宽度、丢了 `.tag` 的可见标签宽度算 0（被压进盒子）；`fitsTo()` 先用 React 上一次渲染的 `className` 覆盖节点（模拟 commit），再触发观察器，并把**探索自己写下的 class** 与**紧接着要渲染的 class** 分别记下来对比。两条新断言就是这次闪烁的回归：`the measurement leaves exactly the classes React renders for its answer`（探索留下的 DOM 必须等于该条数要渲染的 DOM）与 `measuring the same line again answers the same`（同一布局连测三次答案必须一致）。把 `show()` 改回只 toggle `.hidden`，这两条连同上面两条都会 FAIL——旧代码实测输出是「四条 → 三条 → 四条」。
- `tests/quick-replies-browser.test.mjs`：真实宿主上的那条回归。设 `DSH_QUICK_REPLY_URL`（多工作区时再设 `DSH_QUICK_REPLY_WORKSPACE`、`DSH_QUICK_REPLY_SESSION`）后用隔离浏览器只替换本插件 client bundle 响应，先按需打开侧边栏并选中已有会话，再按 760→601 逐档静置，**每档看两次**：每次 1.2 秒逐帧采样断言 0 次条数变化、0 帧标签溢出行的盒子，两次之间再断言条数没变；最后断言总得有点标签（否则「一行都没有」会让前面全部空过）与 600px 由媒体查询整行隐藏。**只取可见的那一行**（`[role="group"]:has(> button):visible`）并把它抓成 elementHandle：宿主会把别的会话挂在后面，那一行是 `display: none`，量它会得到「没有标签、没有闪烁」的假通过。**故意不断言「越宽越多」**——宿主自己的右侧栏会在窄宽度自动收起，房间变大是合理的，这条断言只会误报。`npm run test:replies` 单独跑它，`npm test` 也带（未设环境变量时跳过）。旧构建实测在 640px 触发溢出断言、在 601px 触发闪烁断言，修好后全绿。

三个测试都从 `lib/index.mjs` / `lib/client.js` 读产物，所以改完源码先 `npm run build` 再测。
`tools/probe-font.mjs` 同样 `import { DEFAULT_MIRRORS } from '../lib/index.mjs'`，跑 probe 之前也要有 `lib/`。

## 部署

用官方命令安装，它把参数转发给 profile 目录里的 pnpm，**并自行维护 profile 清单**（`dependencies` 与 `dsh.profile.bundles` 一起加，`remove` 时一起移除）：

```sh
npx @deepseek-ai/dsh plugin --profile web add @guowenzhang/dsh-ui-beautify   # npm 官方源

npx @deepseek-ai/dsh plugin --profile web add https://github.com/zhang-guo-wen/dsh-ui-beautify.git                              # HTTPS
npx @deepseek-ai/dsh plugin --profile web add "git+ssh://git@github.com/zhang-guo-wen/dsh-ui-beautify.git"                     # SSH
npx @deepseek-ai/dsh plugin --profile web add "git+ssh://git@github.com/zhang-guo-wen/dsh-ui-beautify.git#v1.0.0"              # 按 tag 固定
npx @deepseek-ai/dsh plugin --profile web add C:/02-codespace/deepseek-harness/dsh-ui-beautify                                 # 本地开发目录
npx @deepseek-ai/dsh plugin --profile web remove @guowenzhang/dsh-ui-beautify                                                  # 卸载
```

本地目录安装时 pnpm 建的是 **symlink（记作 `link:`）** —— 所以重建 `lib/` 后**重启即生效，无需重装**。
`file:` 依赖则可能退化成物理拷贝，那时改源码不会影响正在跑的 dsh，要重装或手动同步 `lib/`。
相对路径参数（`../dsh-ui-beautify`）按**执行命令时的目录**解析，不是 profile 目录。
装进去的包如果没声明 `dsh.bundle`，命令会警告「installed as a plain dependency, not a profile layer」——本包声明了，所以不会遇到。

### 生效语义

装完重启宿主一定对。`patchReload: live` 的 profile 也会在清单变化后热重组，所以 `dsh plugin add/remove` 不重启通常也已加载；浏览器仍需硬刷新（boot 图是页面加载时组装的）。

**host 半边是进程内模块：重建 `lib/index.mjs` 不会替换正在运行的那份代码。** 只有 `dsh plugin add/remove` 造成的重组才会把它 import 进进程，之后改源码必须**重启宿主**才生效——它的配置 schema 就是启动那一刻的那份。
判据是比三个时间：

```powershell
(Get-Process -Id <dsh 宿主 pid>).StartTime                                              # 宿主何时启动
(Get-Item "$env:USERPROFILE\.dsh\profiles\web\cordis.patch.yml").LastWriteTime          # 设置何时写入
(Get-Item C:\02-codespace\deepseek-harness\dsh-ui-beautify\lib\index.mjs).LastWriteTime # 插件何时构建
```

宿主启动时间**早于**插件构建时间，就需要重启。重启后 Host 重新 import，schema 里就有了新字段；浏览器再硬刷新一次即可。

**client 半边相反**：`lib/client.js` 由浏览器每次加载页面时从磁盘重新取，bundle 按内容 rev 提供，刷新页面就会取到新的。`HANDOFF_ID` 没变时浏览器也可能继续跑旧 bundle，硬刷新（Ctrl+F5）是最省事的一步。

## 发版(Release)

`lib/` 是提交进仓库的，所以**发版 = 改版本号 + 构建 + 提交产物 + 打 tag**。别人按 tag 安装，`master` 上的临时提交不会被他们拿到。

1. 改根 `package.json` 的 `version`（当前 `1.0.0`）。
2. `npm run build`，确认 `lib/index.mjs` 与 `lib/client.js` 是最新。
3. 提交源码与 `lib/`（不要把 `lib/` 落在外面的工作区）。
4. 打带注释的 tag 并推送：

   ```sh
   git tag -a v<version> -m "dsh-ui-beautify <version>"
   git push dsh-ui-beautify master --follow-tags
   ```

5. 验证安装（仓库根即包，不再需要 `path:` 参数）：

   ```sh
   npx @deepseek-ai/dsh plugin --profile web add \
     "git+ssh://git@github.com/zhang-guo-wen/dsh-ui-beautify.git#v<version>"
   ```

## 易崩清单

1. `family` 写成包内样式表没有的名字 → 所有 `@font-face` 匹配不上，静默回退，界面不报错。
2. 两份字体表之间 id 重名 → 路由 `anyFaceById` 命中另一角色的 face，拉到错误分片（id 必须全局唯一）。
3. client 包不是 `window.__ModuleLoader__.load({ id, factory })` 格式 → 浏览器加载失败。
4. 改 client 不 bump `HANDOFF_ID` / 不硬刷新 → 浏览器跑旧 bundle（表现为"改动没生效"）。
5. 重建 `lib/index.mjs` 不重启宿主 → 宿主 schema 里没有新字段，控件可点、写入被拒（行里会写「旧版本」）。
6. 只改 `mirrors` / `cacheDir` 不重启 → 仍是旧配置（启动时读一次）。
7. `cacheDir` 填相对路径 → 按宿主进程的 cwd 解析，不是 profile 目录。
8. Windows 反斜杠路径 / `..` 段没被挡住 → 能爬出 generation 目录；`isServablePath` 与 `targetFor` 两道检查，改动任一处都要同步 `tests/http.mjs` 的 403 断言。
9. 镜像 200 的错误页绕过校验 → 会被当成字体落盘并回给浏览器；改 `validate()` 要同步 `tests/http.mjs`。
10. 两个角色的 token 分两次 `overrideTokens` 调用 → 第二次替换第一次，前一个角色的字体失效。
11. CSS module 里 JSX 引用但 CSS 未定义的类 → `undefined`，静默无样式。
12. `tests/client.mjs` 里没有桩的 bare specifier → 构建产物加载即失败；client 半边新增 import 要同步那份桩表。
13. `BikeLane.tsx` 的 `BIKE_WIDTH_PX` / `BIKE_HEIGHT_PX` 与 `BikeLane.module.css` 的 36×20px 不一致 → 车轮按错误的半径换算，看起来在打滑。盒子宽高比与画布不同，缩放比取两者较小值。
14. 用「两帧角度相减」量车轮转速 → 越过 360° 会得到负数；只能在单帧内取模测量（`tests/client.mjs` 就是这么做的）。
15. 把 `charsPerSecond` 的分母改回 `now` → 分片之间减速、分片一到猛跳，动画立刻变成一顿一顿的（详见「骑车道」一节）。
16. 把车道位置按**像素**记而不是按行程比例记 → 车道一变窄就提前取模，车凭空跳回左边，看起来像「重置」。
17. 把动画状态放进 effect 闭包而不是 ref → effect 一重跑，车就从起点重新出发。
18. `MAX_QUICK_REPLIES` 与 `QUICK_REPLY_PHRASE_KEYS` 的条数不一致 → 设置行按字典渲染标签（再按常量截断），槽位模型按常量裁剪：字典比常量**少**时后面那几个槽位在界面上没有标签，用户改不到，也不会有报错。加短语时两处一起改。
19. 把 PDF 补丁的安装门槛写成「当前 realm 缺这些 API」→ 插件重载后页面已被上一个实例补过，于是以为浏览器是新的，不再挂 Worker 补丁，手机上的 PDF/Office 预览又报 `toHex`。门槛必须看 realm 的出生标记（`MISSING_MARKER`）。
20. 把替换条件放宽到「所有脚本 Blob」或「所有 Worker」→ excel 与 file-upload 的 Worker 也用小写 `text/javascript`，会被前置一段与它们无关的代码；保持「`{ type: 'module' }` 的 `new Worker`」这一条，`tests/pdf-worker-compat.test.mjs` 与 `tests/client.mjs` 都有对应断言。
21. 在 `installPdfApis` 里引用模块作用域的变量或常量 → 页面半边正常，Worker 半边（只有 `toString()` 的文本）直接 ReferenceError，而这只在缺少这些 API 的浏览器上出现，桌面测不出来。

## 接下来可以加的

- **第三个角色**：整个机制已经是「角色表」——加一行 `FONT_ROLES` 条目（key、tokens、fallback、faces、defaultId）就多一个可独立配置的字体位，比如标题字体、终端字体（终端需要先支持通过 CSS 变量传字体）。
- **镜像自动测速**：启动时对 `mirrors` 各探一次，把最快的排到前面，而不是固定顺序。
- **缓存管理**：界面美化页面显示每款字体的缓存占用并提供「清理」——`FontStore` 已经有 generation 概念，加上 enumerating 与 `rm` 即可；`GET /plugins/dsh-ui-beautify/cache` 已经在报这份数据。
- **跟随系统字体**：把 `system` 从「不覆盖」扩展成「跟随一个可配置的字体栈」。
- **字号阶梯、行高、圆角、间距**：同一套行机制继续加行即可。
- **自定义主题配色**：`ctx.theme.register` 可注册整套 alias token。
- **车道的外观**：车速曲线的常量在 `src/client/output-rate.ts`，尺寸常量在 `BikeLane.tsx`/`.module.css`（改尺寸要同时改两处）。想让它更小、更淡或换形象，只动这三处。
- **车道可调速度**：加第二个 `z.number().volatile()` 字段做倍率即可，`SettingsController` 与 `MotionRow` 的写法可以照抄。
- **把快捷回复的设置行挂回来**：`QuickReplyRow.tsx`（4 个槽位标签、点开就地编辑）、它的文案与样式、`quickReplies` 字段与 dock 的读取、以及 `tests/client.mjs` 里那 24 条断言都还在仓库里；`BeautifySection` 加一行 `<QuickReplyRow {...props} />`（连 import）即恢复，测试块由 `pageComponents.has('QuickReplyRow')` 守卫、会自动重跑。呈现方式想好了再挂。
- PC 端快捷回复显示开关已实现（`quickRepliesEnabled`），手机始终隐藏；四条全空仍是「用内置短语」，与显示开关独立。

## README 截图（2026-10-09）

- 双语 README 仅保留背景、npm 安装、截图、许可。设置页三个分组 `settings-appearance` / `settings-enhance` / `settings-branding` 用一个三列表格放在同一行；手机对话与设置各用一张合成前后对比图，编号框和图下注释标注区别。`mobile-conversation-comparison.{zh,en}.png` / `mobile-settings-comparison.{zh,en}.png` 分别提供中英文标注，底图界面均为中文。
- 截图只能使用独立 `DSH_HOME` 的 npm 发布版宿主，禁止改日常实例设置。本轮 npm 精确版本 `0.2.0-rc.2`（查询时 latest=next），随机端口 64769，命名空间 `C:/02-codespace/DeepSeek/.scratch/harness-tests/readme-0.2.0-rc.2-20261009-0905`。演示会话内容为人工准备的截图数据，不复制真实会话或凭据，也不调用模型；不是翻译端到端验收。
- 设置分组在 1440px 宽视口截图：增加截图视口高度、将设置壳及有裁剪的祖先改为 `overflow: visible` / `height: auto`，再按 `h3` 临时分组截图；仅截图浏览器做这种处理，不修改产品 CSS。必须读图确认品牌分组四项都没有裁掉。两张近景及抽屉、深色设置原图也重新截取，但精简 README 不单独展示。
- 手机原图采用同一个已开始的演示会话、393×844 视口。对话「适配前」关闭 `mobileLayoutEnabled` 与 `recentSessionsEnabled`，「适配后」两者开启；设置对比仅比较手机适配，最近对话不影响设置。开关会写入测试 profile：点击后必须等待真实 `aria-checked` 和设置壳 flex/grid 变化，再截图，不能将点击后旧帧误作新状态；结束恢复 true。标注用 Pillow 合成，不生成或修改底图内容。
- 原图 `mobile-before` / `mobile-after` / `mobile-settings-before` / `mobile-settings-light` 用于重新合成；`tests/settings-layout-browser.test.mjs` 在设置 `DSH_SETTINGS_URL` 时仍会重写 `mobile-settings-light|dark.png`，之后需要重新合成对比图以保持一致。
