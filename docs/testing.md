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
