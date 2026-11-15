---
description: "@guowenzhang/dsh-ui-beautify 的行为验证记录：每次验证的环境绑定、产物哈希、逐项读数与未覆盖项。"
kind: "package-reference"
---

# 行为验证记录

本页回答一个问题：**每个结论各自被什么证据支持、怎么复现。**
**没跑过的结论不写成本页的结论**；失败、未覆盖与受阻项如实保留。
读数必须绑定产物哈希：重建 `lib/` 之后旧读数不再是结论。

生成：`node tools/testing/record.mjs dsh-ui-beautify --title "<行为>" [--run <证据 json>] [--instance <test-instance.json>]`

## 1、未读会话从最后一条回答开头看起（2026-10-25，产物 `0D067FA9` / `BFBE3B12`）

### 环境与产物绑定

| 项 | 值 |
|---|---|
| 日期 | 2026-10-25T00:32:41+08:00 |
| 插件 | @guowenzhang/dsh-ui-beautify@1.5.0（生成时 HEAD ad7a0c1，工作树 41 项未提交：本次改动 + 会话前已存在的未跟踪 scratch 文件；本记录随改动一起提交，产物哈希不因提交改变） |
| 宿主 | @deepseek-ai/dsh@0.2.1-rc.2（隔离实例） |
| DSH_HOME | `C:\02-codespace\DeepSeek\.scratch\harness-tests\ui-unread-0.2.1-rc.2-gzw4gq` |
| 端口 / URL | 58110 / http://127.0.0.1:58110/?token=***（token 已抹） |
| Node | v24.12.0 |
| lib/index.mjs | `0d067fa949ab536ec370f55163ff11daa3981f0b13eaa521074bb16cce66c1e8`（82087 字节，2026-10-24T16:32:13.958Z） |
| lib/client.js | `bfbe3b12baf6f51142614b065912bfe83514e03b903858b3f6f4b10ffc18f967`（253938 字节，2026-10-24T16:32:14.078Z） |
| 证据文件 | `.scratch/test-system/runs/2026-10-25-003237-dsh-ui-beautify.json` |

### 车道结果

| 车道 | 状态 | 退出码 | 耗时 |
|---|---|---|---|
| artifact | passed | 0 | 23.9s |

### 逐项读数

> 本节的浏览器读数来自隔离实例 + 种子分页会话；单测与产物断言来自本仓 `npm test`。

- **车道**：`typecheck` / `metadata` / `artifact` 全部 passed（artifact = `npm run build && npm test`，耗时 23.8s），产物哈希跑前跑后一致（`67BF7C32` / `E3C8EE5D`）。`npm test` 共 248 项：243 pass / 0 fail / 5 skip，5 个 skip 是缺 `DSH_MOBILE_URL` / `DSH_SCROLL_URL` / `DSH_QUICK_REPLY_URL` / `DSH_SETTINGS_LOCAL_URL` 的既有浏览器探针；`DSH_MOBILE_PLAYWRIGHT` 指向本工作区 `.scratch/pw-core` 后，`recent-sessions-browser` 的 4 项从「缺 playwright-core 报错」变为真实通过。`node tools/testing/gate.mjs` 里 `dsh-ui-beautify` 无 error、无 warning（全仓 7 个 error 都在别的仓）。
- **改前基线**（`baseline-client.js` = `git show HEAD:lib/client.js`，`CC4B22F7…`）：滚到已加载历史顶端时 `[data-ui-beautify-to-prompt]` 数量 **0**；宿主自己的「加载更早」在（`[data-chat-flow]` 第 0 个子节点 `div.EvIC1a_older`，其中唯一 `button`，accessible name 就是文案「加载更早」，无 aria-label/title）。分页窗口 = 25 条提问（round 4..28）；点一次宿主按钮 → 约 300ms 提交，`scrollTop` 0→614 且同一提问屏幕位置 top 156→156（分页锚点保持）；再点一次 `hasMore=false`、包装 div 整体消失。1280×900 与 393×844 各 9/9 通过（中文、英文各一轮）。
- **改后**（`lib/client.js` = `E3C8EE5D…`）：顶端 `[data-ui-beautify-to-prompt]` = **1**、enabled（aria/title 仍「回到上一条提问」，34×34），宿主「加载更早」仍在。点一次箭头：宿主按钮被**恰好点中 1 次**，文案 `加载更早→加载中…` 且 `disabled=true`（点击后约 2.5ms），窗口 25→28 条提问（round 1..28 连续、不跳过），箭头恢复 enabled；**落点 round 3 屏幕 top=166、可视顶 142 → offset = +24.0px**（393×844：168−144 = +24.0px），改前该值为 **−201px**（读者视觉上没动）。`scrollLog` 逐帧只剩宿主一次性 645 与插件 389，无写回；console / pageerror **0** 条。中文 14/14、英文 14/14 通过（英文 aria/title `Back to the previous question`、宿主 `Load earlier → Loading…`、落点同为 +24.0px）。截图：`.scratch/ui-beautify-autoload/verify/shots/implemented-{zh-CN,en-US}-{1280x900,393x844}-{top,landed}.png`。
- **两次真实失败与最终修法**（重要，别回退）：第一次只落一次 → 宿主 `ChatNavigation.contentCommitted → ChatViewport.preserve → write` 在插件 `scrollTo` 之后 **0.1ms** 写回 614；第二次改成逐帧重落 → 宿主分页锚点**一直 armed**，每次程序化滚动后同一帧写回，重试永远赢不了（`readerSampled` 永远等不到，因为写回早于宿主自己的 `scroll` 事件投递）。最终在首次落点前于 `[data-conversation-scroll]` 派发一次**合成 `pointerdown`**：宿主把 `wheel/touchstart/pointerdown/keydown/beforematch` 监听在 scroller 上且不查 `isTrusted`，命中即 `stopPreserving()`；落点随即稳住（提交后 `scrollTop` 389 连续 30 帧不动）。
- **副作用审计**（`verify/probe-side-effects.mjs`，1280×900）：点击前 → 补页+落点后 1.5s → 4.5s → 真实滚轮之后，可见菜单/弹层/对话框 0、文本选择为空、`activeElement=BODY`、会话开始行正常出现、箭头一直 enabled、`scrollTop` 稳定在 389 不漂、console 0 错误。被释放的只有宿主分页锚点与待执行的 follow。
- **单测与产物断言**：新增 `tests/earlier-page.test.mjs` 10 项（结构识别、消息行终止扫描、加载中仍识别、补页后落到新页最近一条、**宿主每帧写回锚点必须靠 pointerdown 释放**、clamp 到顶端不死等、尾部追加不算补页、超时放弃、取消、无可加载时不发请求）；`tests/client.mjs` 新增 5 条产物级断言（边界仍显示箭头、点一次调宿主控件、请求期间 disabled、落点 `top=476` 且派发 scroll/scrollend、落点后恢复 enabled）。

### 本节未覆盖

- **一次 loadOlder 就把剩余历史补完**（种子会话只剩 3 轮、宿主一页把剩余全拿走），所以「连续多页逐页补齐」「补页后 hasMore 仍为 true 时再点是否继续」没有真实浏览器读数，只有单测覆盖。
- **`loadOlder` 失败/超时**在真实浏览器里没有制造（宿主自己显示错误；插件 10 秒后解除等待，不撤销加载）。
- **合成 `pointerdown` 的副作用只测了空场景**：宿主菜单/弹层打开时按箭头、文本选择进行中、拖拽中未造场景。
- **真机手机与触摸（`pointer: coarse`）**未测；393×844 是桌面 headless 的视口模拟。**深色主题、字体档位、`prefers-reduced-motion`** 未读数（本改动不动样式与动效）。
- **安装版 0.2.1-rc.5 以外的宿主**没有回归；`[data-chat-flow]` 首几个子节点为「hint/error → 加载更早包装 → `display:contents` 的插槽 div」这一结构依赖只在 0.2.1-rc.5 核对过，宿主改结构时插件会静默不显示（不报错）。
- **桌面日常形态**（Arcuchi Harness 打包宿主）未实测；按红线只用隔离实例。`browser:mobile` / `browser:scroll` / `browser:replies` / `browser:recent` / `browser:remote-settings` 车道仍因缺 `DSH_*_URL` 与真实会话阻塞，本轮浏览器验收用的是 `.scratch` 里的一次性探针，**没有**并入 `npm test` 链。

---
## 2、发版 1.6.1：适配 0.2.2-alpha.3 侧栏行结构（2026-11-04，产物 `67BF7C32` / `9E4D1176`）

### 环境与产物绑定

| 项 | 值 |
|---|---|
| 日期 | 2026-11-04T22:04:45+08:00 |
| 插件 | @guowenzhang/dsh-ui-beautify@1.6.1（HEAD d9f1790，工作树 3 项未提交） |
| 宿主 | （未绑定隔离实例；如为源码内验证请写明） |
| DSH_HOME | （未绑定） |
| 端口 / URL | （未绑定） |
| Node | v24.12.0 |
| lib/index.mjs | `67bf7c32c991fcfe2a2bba3f7af29fc0ddbfb18569602c57594459b420bec570`（82786 字节，2026-11-04T14:04:11.322Z） |
| lib/client.js | `9e4d11764236a6b52ac13fe9a2b5756e0a3b8e361de1c3fd67fee8350977ea1b`（328455 字节，2026-11-04T14:04:11.429Z） |
| 证据文件 | `.scratch/test-system/runs/2026-11-04-220434-dsh-ui-beautify.json` |

### 车道结果

| 车道 | 状态 | 退出码 | 耗时 |
|---|---|---|---|
| typecheck | passed | 0 | 1.6s |
| build | passed | 0 | 0.8s |
| metadata | passed | 0 | 0.4s |
| unit | passed | 0 | 22.6s |
| artifact | passed | 0 | 23.4s |

### 逐项读数

- **依赖还原**：工作区 `node_modules` 曾被 pnpm 重装（存在 `node_modules/.modules.yaml` 与未跟踪的 `pnpm-lock.yaml`），顶层 `react` 解析到 19.3.1，而 `react-dom` 是 18.3.1，`recent-sessions-browser` 4 项因此抛 `ReactCurrentDispatcher` 未定义。按 `package-lock.json` 执行 `npm ci` 后两者均为 **18.3.1**、`node_modules` 回到 npm 管理，这 4 项随即真实通过（首跑失败是环境漂移，与本次改动无关）。
- `npm run typecheck`：`tsc --noEmit -p tsconfig.json`，退出码 0（1.6s）。
- `npm run build`：tsdown（host）+ `build-client.mjs`，退出码 0；产物 `lib/index.mjs` 82786 字节、`lib/client.js` 328455 字节，SHA256 见上表。依赖还原后重建的字节与提交里 pnpm 工具链产物不同，故随发版提交一并提交。
- `npm run test:metadata`：passed。
- `npm test`（unit，22.6s）：**249 项：244 pass / 0 fail / 5 skip**；5 个 skip 是缺 `DSH_MOBILE_URL` / `DSH_SCROLL_URL` / `DSH_QUICK_REPLY_URL` / `DSH_SETTINGS_LOCAL_URL` 的既有浏览器探针。`DSH_MOBILE_PLAYWRIGHT` 指向工作区 `.scratch/pw-core`（`tools/testing/registry.mjs` 的既定来源），`recent-sessions-browser` 的 4 项真实通过。
- `artifact`（23.4s）：`npm run build && npm test`，产物哈希跑前跑后一致（`67BF7C32` / `9E4D1176`）。
- 本次改动对应的断言：`tests/streamlined-ui.test.mjs` 更新为「侧栏按行外层（`[data-slot=sidebar] nav > div`）计数、排除每行第二个按钮造成的序号偏移」。
- `npm pack --dry-run`：`@guowenzhang/dsh-ui-beautify@1.6.1`，26 个文件、压缩 1358702 字节；含 `lib/`、`locale/`、`cordis.patch.yml`、双语 README 与 `docs/images`；无密钥、无 `pnpm-lock.yaml`。

### 本节未覆盖

- 未在隔离 Harness 实例（适配目标 0.2.2-alpha.3 宿主）里做真实点击验收；本节的浏览器证据是仓库自带的 Chrome/React fixture，没有日常实例读数。
- `browser:mobile` / `browser:scroll` / `browser:replies` / `browser:recent` / `browser:remote-settings` 车道仍因缺 `DSH_*_URL` 跳过，未跑。
- 未测真机手机触摸、深色主题与 `prefers-reduced-motion`（本改动不动样式与动效）。
- 工作区里另一会话遗留的未跟踪 `pnpm-lock.yaml` 未提交、未删除；它不影响本包分发内容。

---
## 3、隐藏侧栏品牌时移除桌面空行（2026-11-05，产物 `830A73B8` / `F21DD6C8`）

### 环境与产物绑定

| 项 | 值 |
|---|---|
| 日期 | 2026-11-05T16:18:09+08:00 |
| 插件 | @guowenzhang/dsh-ui-beautify@1.6.1（HEAD d110170，工作树 8 项未提交） |
| 宿主 | @deepseek-ai/dsh@0.2.1-rc.5 隔离实例启动，但无认证 URL、访问返回 401；实际几何测试使用工作区 ui-sidebar@0.2.1-alpha.2 的已构建 CSS（SHA256 见 fixture 报告） |
| DSH_HOME | `C:\02-codespace\DeepSeek\.scratch\harness-tests\sidebar-brand-gap-0.2.1-rc.5-pdx7g4` |
| 端口 / URL | 39023 / http://127.0.0.1:39023/；401，已通过 isolate stop 核对 PID 并停止、端口已释放 |
| Node | v24.12.0 |
| lib/index.mjs | `830a73b8de65908c5705b67842ff5a65a83c48415a3aa98c01cb6307416a4094`（93113 字节，2026-11-05T08:15:16.839Z） |
| lib/client.js | `f21dd6c8047a8aec738cdeefa398f3716a4fa235f01c881e270e28cb5357313b`（341663 字节，2026-11-05T08:15:16.956Z） |
| 证据文件 | `.scratch/test-system/runs/2026-11-05-161717-dsh-ui-beautify.json` |

### 车道结果

| 车道 | 状态 | 退出码 | 耗时 |
|---|---|---|---|
| unit | passed | 0 | 28.9s |
| build | passed | 0 | 1.0s |
| typecheck | passed | 0 | 1.8s |
| browser:sidebar-brand | passed | 0 | 24.4s |
| static gate | passed | 0 | error 0 / warning 0 |

### 逐项读数

- 失败先行：旧产物在 Windows 首项断言失败，品牌行隐藏后仍为 40px；证据 `.scratch/test-system/runs/2026-11-05-160845-dsh-ui-beautify.json`。
- 独立 Chromium DOM fixture 使用真实 SidebarRoot 样式与本插件产物中的 install/dispose：Windows/macOS/Web × 11 个视口（320…1440px）× 浅深主题，共 66 项通过；减少动态效果模式。报告 `.scratch/test-system/sidebar-brand-gap/report.json` 绑定宿主样式、主题与插件产物 SHA256。
- Windows 1280px 展开态：品牌行 40→0px，新会话 top 86→46px，标题栏按钮仍为 top=2px、H28；macOS 保留 H52 顶栏，新会话 top 104→52px；Web 顶行仍为 H60、新会话 top=70px。展开态两个按钮均实际点击；移除 effect 后品牌与几何恢复。
- 单元套件完整执行：前置 smoke/http/brand/client 检查通过，Node test 262 passed、0 failed、5 skipped。首次因旧的 Playwright 默认路径失败；通过进程局部 DSH_MOBILE_PLAYWRIGHT 指向工作区 `.scratch/pw-core` 后重跑通过，未安装新依赖。
- 截图 `.scratch/test-system/sidebar-brand-gap/windows-hidden.png` 是简化 DOM fixture，不是日常桌面实例截图。

### 本节未覆盖

- 隔离真实宿主没有输出认证 URL，访问为 401；未绕过认证，未改日常实例。桌面实际安装集成、原生标题栏拖动/命中、抽屉遮罩与真实折叠动画尚未验收；fixture 的 class 切换不等于真实折叠集成。
- 5 项需要真实宿主 URL 的既有浏览器用例跳过；真机手机键盘、安全区及性能记录未覆盖。
- 本轮按用户确认只修顶部空白，不修改任务列表／白板随会话滚动的问题；不提交、不发布、不升级日常实例。原有未跟踪 pnpm-lock.yaml 保留。

---
## 4、手机抽屉在宿主原生 drawer（data-sidebar-drawer）下退让，≤600px 侧栏不再空白（2026-11-09，产物 `830A73B8` / `522AF61B`）

### 环境与产物绑定

| 项 | 值 |
|---|---|
| 日期 | 2026-11-09 |
| 插件 | @guowenzhang/dsh-ui-beautify@1.7.1（HEAD bcb7c5a，本次 5 个文件未提交：源码 / 单测 / 样式规则文档 / 本页 / lib 产物） |
| 宿主（隔离实例） | @deepseek-ai/dsh@0.2.2-rc.1（`--version` 显式指定，npm 安装） |
| 宿主（问题复现用） | Arcuchi Harness 桌面 0.2.2-alpha.3（只读加载页面，未改配置、未装插件） |
| DSH_HOME | `C:\02-codespace\DeepSeek\.scratch\harness-tests\mobile-drawer-fix-0.2.2-rc.1-9lx6fo` |
| 端口 / URL | 55295（隔离）/ 53276（桌面）；token 已抹 |
| Node | v24.12.0 |
| lib/index.mjs | `830a73b8de65908c5705b67842ff5a65a83c48415a3aa98c01cb6307416a4094`（93113 字节，2026-11-09T03:46:39.020Z，本次未改宿主侧） |
| lib/client.js | `522af61b859ad427b161f913e60e5423dc2089d971cf45b70c31c41a7949d34e`（342415 字节，2026-11-09T03:46:39.141Z） |
| 证据文件 | `.scratch/mobile-sidebar-diag/shots2/40-baseline-blank.png`、`41-after-standdown.png`、`.scratch/mobile-sidebar-diag/isolated/final-w{320,390,600,601}-open.png` |

### 车道结果

| 车道 | 状态 | 退出码 | 耗时 |
|---|---|---|---|
| typecheck | passed | 0 | 2.0s |
| build | passed | 0 | 1.5s |
| metadata | passed（1/1） | 0 | 0.1s |
| unit（`pnpm test`，`DSH_MOBILE_PLAYWRIGHT` 指向工作区 `.scratch/pw-core`） | passed：268 项 / 263 pass / 0 fail / 5 skipped（5 项是缺 `DSH_*_URL` 的既有浏览器探针） | 0 | 10.7s |
| unit（未设该 env） | failed：5 个 `*-browser.test.mjs` 在 import `playwright-core` 时 `ERR_MODULE_NOT_FOUND`（仓内没装该依赖），与本次改动无关；设 env 后即通过 | 1 | - |
| browser:mobile / scroll / replies / remote-settings | skip（缺 `DSH_MOBILE_URL` / `DSH_SCROLL_URL` / `DSH_QUICK_REPLY_URL` / `DSH_SETTINGS_LOCAL_URL`） | - | - |

### 逐项读数

- **问题复现（桌面 0.2.2-alpha.3，390px，经 Pocket 代理只读加载）**：frame 属性为 `data-sidebar-collapsed` + `data-sidebar-drawer` + `data-mobile-layout-frame`；frame 第一个子节点是 `div.ufGdLG_drawerMask`。抽屉打开后 `elementFromPoint(40,80)` = `div.ufGdLG_drawerMask`，侧栏 16 条会话的 `innerText` 存在、`visibility: visible`，但像素上是一片白（截图 `40-baseline-blank.png`）。
- **同实例补 `data-mobile-sidebar`（旧控制器唯一认识的「宿主自带抽屉」标记）后**：`data-mobile-layout-frame` 被控制器自行移除，遮罩回到 z-index 70 / `rgba(0,0,0,.24)`，抽屉列 z-index 71 在上，`elementFromPoint(40,80)` = `span._6ZDZmG_newSessionContent`，会话列表完整可见（截图 `41-after-standdown.png`）。
- **宽度扫描（同一桌面实例）**：320 / 390 / 600px 有 `data-mobile-layout-frame` 且命中遮罩（空白）；601 / 700 / 767px 无该标记（本插件媒体查询上限 600px）且命中会话行（正常）；768px 起宿主不再启用原生抽屉。说明问题只落在 ≤600px。
- **修复后（隔离实例 0.2.2-rc.1，`pnpm run build` 产物）**：320 / 390 / 600 / 601px 四档均为 `data-mobile-layout-frame` 缺失、`data-sidebar-drawer` 存在、抽屉展开（`data-sidebar-collapsed` 被移除）、侧栏列 `visibility: visible`，`elementFromPoint(40,80)` = `span.hHd-Xa_newSessionContent`（抽屉内容在最上层、可命中）；1024px 不启用原生抽屉也不加标记，桌面行为不变。截图 `isolated/final-w*-open.png`。
- **单测**：新增用例 `host-native drawer frame (data-sidebar-drawer) stands down instead of masking the sidebar`（含「带抽屉状态下 600px 媒体查询翻转不重新接管」），`node --test tests/mobile-layout.test.mjs` 8/8 通过。

### 本节未覆盖

- 日常桌面实例仍运行内嵌的 ui-beautify 1.7.0 旧产物；按隔离红线没有把新产物装进日常实例，**真机手机未验收**（本轮手机侧证据来自 390px 浏览器视口 + Pocket 代理的只读页面）。
- 隔离实例的认证 URL 只能在启动输出里拿到（`isolate.mjs start` 未捕获到），本轮用 `npx … web --port 55295 --no-open` 自行捕获；token 未落盘到本页。
- 在 0.2.2-rc.1 上用旧 CSS 的重现只做到 `elementFromPoint` 返回 `div.pI_x6G_drawerMask`（该宿主下遮罩像素与修复后一致），没有再用旧产物整包复现；空白画面只在 0.2.2-alpha.3 上取得。
- 601–767px 只做了元素命中读数，未跑真实点击导航；真机软键盘、安全区、深浅色与 `prefers-reduced-motion` 本轮未覆盖。

---
## 5、下线远程设置只读桥接：手机/局域网可正常写设置（2026-11-09，产物 `F2DEE744` / `AE0F45E8`）

### 环境与产物绑定

| 项 | 值 |
|---|---|
| 日期 | 2026-11-09 |
| 插件 | @guowenzhang/dsh-ui-beautify@1.7.1（基于 HEAD d05aa70，本次改动未提交） |
| 宿主 | @deepseek-ai/dsh@0.2.2-rc.1（隔离实例，绑定 100.91.74.34） |
| DSH_HOME | `C:\02-codespace\DeepSeek\.scratch\harness-tests\mobile-drawer-verify-0.2.2-rc.1-0czgne` |
| 端口 / URL | 55322（非 loopback 来源，正是被下线桥接针对的场景）；token 已抹 |
| Node | v24.12.0 |
| lib/index.mjs | `f2dee74433839f98315b49c2af4509d740614f5e801763abbc5a8832108d0a71`（93051 字节） |
| lib/client.js | `ae0f45e8dea25c60a9881af4cacc88003d4cd311ba307c4f4e9d81673513bb62`（334953 字节，较下线前少 7462 字节） |
| 证据文件 | 本节读数来自隔离实例真实点击；`lib` 产物 grep 与 `pnpm test` 输出见下文 |

### 车道结果

| 车道 | 状态 | 退出码 | 耗时 |
|---|---|---|---|
| typecheck | passed | 0 | 2.1s |
| build | passed | 0 | 1.4s |
| metadata | passed（1/1） | 0 | 0.1s |
| unit（`DSH_MOBILE_PLAYWRIGHT` 指向 `.scratch/pw-core`） | passed：262 项 / 257 pass / 0 fail / 5 skipped（缺 `DSH_*_URL` 的既有浏览器探针） | 0 | 17.1s |

### 逐项读数

- **下线范围**：删掉 `src/client/remote-settings.ts`、`src/client/remote-settings-reader.ts` 与两个测试文件；`index.ts` 摘掉 `remote.settings` 注入与安装块；设置页「界面增强」少一行 `RemoteSettingsToggleRow`，`settings.ts` / `fonts.ts` / `settings-controller.ts` / `locales.ts`（中英）与 `package.json` 的 `test:remote-settings` 脚本、`tools/testing/registry.mjs` 的车道声明一并清掉。
- **产物无残留**：`lib/index.mjs` 与 `lib/client.js` 里 `remoteSettings`、`远程设置`、`isLoopback` 的出现次数均为 0（下线前 client 产物 342415 字节，现在 334953 字节）。
- **行为验收（这一步才是关键）**：清掉隔离实例 profile 里预置的 `ui-settings-general.welcomeNoticeVersion`，重启后从 **100.91.74.34:55322**（非 loopback）打开页面，点「预览版说明」的「继续」——弹窗前进到「开始使用」，页面没有出现「暂时无法保存确认状态」，profile 的 `cordis.patch.yml` 重新写回 `welcomeNoticeVersion: 2026-09-28.1`。同一路径在 1.7.1 修复版（保留桥接）时是死循环。
- **对照**：同一宿主、同一 LAN 地址、不装本插件的干净实例，同样点「继续」也能写入成功 —— 说明这是宿主既有能力，桥接属于多余的越权只读。

### 本节未覆盖

- 「界面美化」设置页面的真实截图没取到：隔离实例没有密钥/账号，「开始使用」弹窗挡住设置入口（设置快捷键在该状态下也不生效），因此「行已消失」只由产物 grep + 单测（`tests/client.mjs` / `tests/ui-copy.test.mjs` / `tests/smoke.mjs` 断言集合已同步）证明，没有页面截图为证。
- 真机手机、Pocket 远程链路、深浅色与性能未复测；本轮只验非 loopback 写入与产物形状。
- 没有改宿主，也没有重启/修改日常桌面实例。

---
