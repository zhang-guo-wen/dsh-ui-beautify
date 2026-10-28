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

- **产物**：`lib/index.mjs` `0d067fa9…`（82087 字节）、`lib/client.js` `bfbe3b12…`（253938 字节）。`artifact` 车道重建后哈希与改动前一致的可比读数来自同一次运行；真实浏览器验收加载的就是这份产物（隔离实例的 profile 以 `link:` 指向本仓，宿主启动于重建之后）。
- **其余车道**（同一份产物，先于 artifact 运行）：`typecheck` passed 1.6s；`metadata` passed 0.4s；`unit` passed 22.6s（168 tests，163 pass / 5 skip）；`browser:recent` passed 11.2s。证据分别是 `.scratch/test-system/runs/2026-10-25-001625-dsh-ui-beautify.json`、`…-001650-…json`、`…-001702-…json`；`unit` 的 5 个 skip 是缺 `DSH_MOBILE_URL` / `DSH_SCROLL_URL` / `DSH_QUICK_REPLY_URL` / `DSH_SETTINGS_LOCAL_URL` 的既有浏览器探针，不是本功能。
- **新增单测**：`tests/unread-answer-start.test.mjs` 23 项全部通过（转换判定、可见回答筛选、落点几何与顶部截断、等待 DOM、开跑不触发、超时放弃、五类手势取消、卸载清理、稳定帧数）；`tests/client.mjs` 新增 7 条产物级断言（默认开、落点 1276/24px、scroll+scrollend、不重复、关开关释放、重开恢复、开关行默认开/写字段/stale/只读）。
- **真实浏览器**（隔离实例 `@deepseek-ai/dsh@0.2.1-rc.2`，`DSH_HOME=C:\02-codespace\DeepSeek\.scratch\harness-tests\ui-unread-0.2.1-rc.2-gzw4gq`，端口 58110，Chrome 155 headless，1440×900，本地假 Messages provider，无网络与真实凭据；探针 `.scratch/ui-beautify-unread/verify/probe-answer-start.mjs`）：
  - 默认开（`unreadAnswerStartEnabled` 未写入配置）：新建运行会话发送提示词后 **约 200ms 内**切回主视图；宿主绿点在该行出现（`span[data-state="done"]`，`#22c55e`，10×10，本次进程内自发送起 31.3s 出现——假 provider 下宿主 `turn/end` 比 `step/end` 晚约 25s，与被测插件无关）。点击该行后：可见回答行顶部距滚动区顶部 **24.0px**（断言 24±2），`nearBottom=1275`，`[data-chat-following-tail]` 不存在；回答开头文本为「滚动位置验证 · 长回答样本」。
  - 设置页：`设置 → 界面美化 → 界面增强` 第 4 行出现「未读会话停在回答开头」，描述为「打开带绿点（离开期间已完成）的会话时，停在最后一条回答的开头，而不是底部，方便从头读起。」，`aria-checked=true`；点击后写 `false` 并显示「已保存」；再点回 `true`，profile 补丁落盘 `unreadAnswerStartEnabled: true`。
  - 关闭开关后重复同一流程：落点 `nearBottom=0`、`[data-chat-following-tail]` 存在、回答开头在视口上方 1251px——即宿主默认的底部落点。
  - 本轮 `page.on('console')` / `pageerror`：0 条错误。截图：`.scratch/ui-beautify-unread/verify/shots/landing-on.png`、`settings-off.png`、`landing-off.png`、`green-dot-GREEN-A.png`、`green-dot-GREEN-B.png`；机读结果 `.scratch/ui-beautify-unread/verify/report.json`。

### 本节未覆盖

- **手势取消与超时**只在 `tests/unread-answer-start.test.mjs` 用可控帧/事件替身验证；真实浏览器里没有制造「落点窗口内滚轮/触摸/翻页键」的点击证据。
- **多分栏、同会话多标签、轨迹视图**未实测；控制器只对可见且含 `[data-chat-flow]` 的会话体落点，轨迹视图按设计静默跳过。
- **手机/触摸（`pointer: coarse`）、浅色/深色主题、`prefers-reduced-motion`** 未做真实浏览器读数：本功能不改样式与动效，但也没有浏览器证据。
- **旧宿主 schema 缺字段**（设置为 `stale`/禁用、功能按默认开启）只在 `tests/client.mjs` 产物级覆盖，未在真实旧 Host 上验证。
- **桌面端日常形态**（Arcuchi Harness 44.7.0 打包宿主）未实测；按红线只用隔离实例，不启动/修改日常实例。
- 假 provider 下宿主运行收尾比答案渲染晚约 25 秒，该延迟未被定性为宿主缺陷也未追查；它只影响探针等待时长，不影响被测插件的落点读数。
- 真实浏览器探针依赖本地假 provider 与种子会话，留在 `.scratch` 作为一次性证据，**没有**并入 `npm test` 链。

---

## 2、浮动会话开始行不再遮住跳转落点（2026-10-25，产物 `25902DE5` / `0AA9360B`）

### 环境与产物绑定

| 项 | 值 |
|---|---|
| 日期 | 2026-10-25T10:58:40+08:00 |
| 插件 | @guowenzhang/dsh-ui-beautify@1.6.0（HEAD dd475f6，工作树 29 项未提交：本次修复；本记录随修复一起提交，产物哈希不因提交改变） |
| 宿主 | @deepseek-ai/dsh@0.2.1-rc.2（隔离实例） |
| DSH_HOME | `C:\02-codespace\DeepSeek\.scratch\harness-tests\ui-unread-0.2.1-rc.2-gzw4gq` |
| 端口 / URL | 49687 / http://127.0.0.1:49687/?token=***（token 已抹） |
| Node | v24.12.0 |
| lib/index.mjs | `25902de52428cdaa3c55f4f15c861c988376f7ebed004a61a0bce3d2482b390f`（82611 字节，2026-10-25T02:58:07.174Z） |
| lib/client.js | `0aa9360b73954702dd70ae4a854a7e351a09367787cb99ed748ab35eb89965a3`（275011 字节，2026-10-25T02:58:07.282Z） |
| 证据文件 | `.scratch/test-system/runs/2026-10-25-105830-dsh-ui-beautify.json` |

### 车道结果

| 车道 | 状态 | 退出码 | 耗时 |
|---|---|---|---|
| artifact | passed | 0 | 23.4s |

### 逐项读数

- **根因**：会话开始胶囊（`[data-ui-beautify-session-start]`）是 frame 里的零高度 sticky 锚点，33px 高的一行悬在滚动区顶部；旧实现的两条跳转（向上按钮/胶囊点击、未读回答落点）都以滚动区顶边 + 24px 为落点，于是目标行顶部有 `33 − 24 = 9px` 落在胶囊后面。手机截图里「已提交。」首行被切掉 9px 即是此故。
- **修复**：新增 `src/client/reading-top.ts` 的 `readableTopOf(flow, scroller)`——可视顶部取滚动区顶边与会话开始行底边的较大值；`scrollToPrompt()` 与 `answerLanding()` 都改为相对它计算 24px 缩进，`AnswerLanding.offset` 语义同步改为「距可视顶部」。落点循环每帧重测，因此滚动后才出现的胶囊也会被下一帧让开。胶囊行加 `data-ui-beautify-session-start-line` 作为稳定测量点。
- **修复前真实浏览器读数**（隔离实例，Chrome 155 headless，viewport 393×844；探针 `.scratch/ui-beautify-unread/verify/probe-chip-overlap.mjs --tag before`，跑的是 4cf0773 提交的客户端产物，`lib/client.js` SHA256 前缀 `6E895CFB`（273596 字节））：打开带绿点的会话后回答行顶部距滚动区顶 `answerOffset=24px`，胶囊高 `33px`，**重叠 `+9px`**（首行被盖住）；console errors 0。截图 `chip-overlap-before-landing.png`。
- **修复后真实浏览器读数**（同一环境与流程，`--tag after`，产物 `0AA9360B`（275011 字节））：`answerOffset=57px`（= 胶囊 33 + 阅读缩进 24），**`answerOverlap=−24px`**（回答首行在胶囊下方 24px 处，完整可见），`chipBottomOffset=33px`、`scrollTop=122`；console errors 0。截图 `chip-overlap-after-landing.png`。
- **胶囊点击路径真实浏览器回归**：`tests/scroll-to-prompt-browser.test.mjs` 指向同一隔离实例（`DSH_SCROLL_URL` / `DSH_SCROLL_WORKSPACE=demo-workspace` / `DSH_SCROLL_SESSION=绿点会话验证`）通过（3.4s）：1280 与 393 两档下，落点行都不在胶囊后面，且可继续滚动时恰好位于可视顶部下 24px；向下按钮/浅深色/轨迹视图清理断言同过。测试需要一轮以上历史的会话（单轮会贴顶截断），用 `.scratch/ui-beautify-unread/verify/make-multiround.mjs` 在该实例里造了一个两轮会话。
- **单测**：`npm test` 195 项、190 pass / 5 skip / 0 fail。新增 `readableTopOf` 三档（无胶囊、胶囊悬在滚动区上、胶囊在滚动区上方或零高），`answerLanding` 带胶囊的几何与目标，控制器「落点后胶囊才出现」的二次校正（1276 → 1243），`scrollToPrompt` 带胶囊的落点（363 而非 396）；原有 24px 读数在无胶囊时保持不变。
- 产物与证据：`lib/index.mjs` `25902DE5…`（82611 字节）、`lib/client.js` `0AA9360B…`（275011 字节）；证据 `.scratch/test-system/runs/2026-10-25-105830-dsh-ui-beautify.json`；机读结果 `.scratch/ui-beautify-unread/verify/chip-overlap-before.json` / `chip-overlap-after.json`。

### 本节未覆盖

- **真实手机浏览器**未驱动（没有真机调试通道）：用 393×844 的桌面 Chrome 模拟手机宽度，真机的系统字体缩放、浏览器 UI 高度与安全区未参与测量。缩进是相对 CSS 像素计算的，胶囊高度又是实时测量，因此几何结论仍成立，但没有真机截图。
- **深浅色主题、`prefers-reduced-motion`** 未单独测量：本修复只改滚动落点，不改样式、动效与颜色。
- **字体设置改变胶囊高度**（`--dsh-content-font-delta`）未在浏览器里切换字体验证；`readableTopOf` 读实时矩形，单测覆盖了任意高度/零高情形，但缺一项真实字体档位的读数。
- **胶囊开关关闭**时无遮罩路径只有单测覆盖（浏览器回归以胶囊存在为前提）。
- **宿主自带的其他悬浮层**没有纳入：只测量本插件的会话开始行；若宿主以后在滚动区顶部再加 sticky 元素，仍需扩展 `readableTopOf`。
- 基线产物 `6E895CFB` 是从 `4cf0773` 的 `lib/client.js` 还原出的字节哈希（探针运行时工作树即为该提交），不是当时再次构建的产物。

---

## 3、隐藏模型与访问模式座位（2026-10-25，产物 `E4CF79C7` / `D094EFCC`）

> 2026-10-26 起两行默认改为**关**（用户要求「不进行隐藏，需要用户手动隐藏」），本节读数对应旧默认；新产物、单测与未重跑的浏览器项见第 3A 节。

### 环境与产物绑定

| 项 | 值 |
|---|---|
| 日期 | 2026-10-25T12:40:22+08:00 |
| 插件 | @guowenzhang/dsh-ui-beautify@1.6.0（HEAD e46872a，工作树 41 项未提交：本节功能与记录；记录随功能一起提交，产物哈希不因提交改变） |
| 宿主 | @deepseek-ai/dsh@0.2.1-rc.2（隔离实例） |
| DSH_HOME | `C:\02-codespace\DeepSeek\.scratch\harness-tests\ui-unread-0.2.1-rc.2-gzw4gq` |
| 端口 / URL | 51779 / http://127.0.0.1:51779/?token=***（token 已抹） |
| Node | v24.12.0 |
| lib/index.mjs | `e4cf79c75b49d68fad4f3b5eb1b8677f5a9acbbab295327429357cf456f5d672`（82724 字节，2026-10-25T04:39:25.519Z） |
| lib/client.js | `d094efccf774aa3e4591b5060df9ac282d7a05a57fabb7ea2590a31423a125a2`（278358 字节，2026-10-25T04:39:25.634Z） |
| 证据文件 | `.scratch/test-system/runs/2026-10-25-123954-dsh-ui-beautify.json` |

### 车道结果

| 车道 | 状态 | 退出码 | 耗时 |
|---|---|---|---|
| artifact | passed | 0 | 29.5s |

### 逐项读数

- **宿主契约**（从安装版 ArcuchiHarness `resources/app.asar` 只读取出 `@deepseek-ai/dsh-desktop-runtime@0.2.1-rc.2` 的客户端 bundle 核对）：`conversation.input.model` 与 `conversation.input.permission` 在 `dsh-client-ui-conversation` 的 SlotMap 里都是 `kind: 'single'; scope: 'session'`；分别由 `dsh-client-ui-model-selection` 与 `dsh-client-ui-permission-presets` 各注册一个匿名条目（无 id、priority 0）。`dsh-client-ui-slots@0.1.7-rc.2` 的 `register()` 对 single 槽同优先级重复注册抛错，`entriesOfSlot()` 按 priority 升序取每格第一个且只渲染该条目——因此 `priority: -10` + 返回 null 的组件赢下格子，宿主条目仍在账本上。**不要改成 `[data-slot=...]` 的 CSS 隐藏**：锚点两种状态下都在，只有影子赢得座位才算隐藏。
- **真实验收**（隔离实例、Chrome 155 headless、1280×900；探针 `.scratch/ui-beautify-unread/verify/probe-hide-seats.mjs`，跑的是本文绑定的 `D094EFCC` 产物；profile 里没有这两个字段的冷状态）：两个座位锚点都存在但 `display: contents`、高度 0、**其内 button 数均为 0**、文本为空——默认开即隐藏。
- 打开设置：账号菜单 → 设置 → 导航「界面美化」；「界面精简」组出现 `data-beautify-feature="hideModelSelector"` / `hideAccessMode` 两行，`aria-checked="true"`，文案分别为「隐藏模型选择…仍可用 /model 命令切换模型。」与「隐藏访问模式…仍可用 /permission 命令切换。」。
- 只关「隐藏模型选择」（`aria-checked=false`）：模型锚点 button 数变 1、文本 `Fake LongOff`，访问模式仍为 0——两行互不影响。两行都关：模型 button 1（`Fake LongOff`）+ 访问模式 button 1（`完全权限`）。关闭设置弹窗后查看输入框：底行恢复 `+ / ⊙ 完全权限 ⌄ / Fake Long Off ⌄ / 发送键`（截图 `hide-seats-both-restored.png`）。
- 刷新页面后：两个座位仍各 1 个 button——设置写入已落盘并生效。再把两行打开（`aria-checked=true`）：两个座位 button 数回到 0。全程 `page.on('console')`/`pageerror` **0 错误**。
- 手机宽度：393×844 下重新加载，两个座位仍 button 0、高度 0；输入框底行只剩 `+` 与发送箭头（截图 `hide-seats-phone.png`）。
- 截图：`hide-seats-default.png`（默认，两个座位隐藏）、`hide-seats-settings.png`（设置页「界面精简」组的两行）、`hide-seats-both-restored.png`（两行关闭后宿主座位恢复）、`hide-seats-phone.png`（393×844）。机读结果 `.scratch/ui-beautify-unread/verify/hide-seats-report.json`。
- **单测与产物断言**：`npm test` 204 项、199 pass / 5 skip / 0 fail；`tests/hide-composer-seats.test.mjs` 9 项（常量与优先级、默认开安装两个影子、冷加载等待、各自释放/恢复、卸载退订、单座位影子、Config 默认 true、双语、产物标记）；`tests/client.mjs` 增加两行的默认开/文案/写字段/缺字段/只读与运行时影子生命周期；`tests/smoke.mjs`、`tests/ui-copy.test.mjs` 同步字段与文案约束；`package.json` 的 `test`/`test:mobile` 链包含新文件。

### 本节未覆盖

- **`/model` 与 `/permission` 命令**未在真实浏览器里点开验证（实现与命令入口来自宿主 bundle 静态核对；本轮只验证座位隐藏与恢复，没有走命令菜单）。
- **浅色/深色主题、`prefers-reduced-motion`** 未单独测量：本功能只替换插槽渲染，不改样式、颜色与动效；隔离实例为浅色默认。
- **旧宿主没有这两个槽**时静默等待的行为只在单测的假上下文里覆盖，没有真实旧版宿主实例。
- **真机手机与远程 Pocket 页面**未驱动：393×844 用桌面 Chrome 模拟；手机布局与设置弹窗触摸操作未参与。
- **远程只读页**的行禁用态只在 `tests/client.mjs` 覆盖，未在远程页面实测。
- 日常实例未触碰；隔离实例与安装版 ArcuchiHarness 的客户端 bundle 同为 0.2.1-rc.2，但没有在安装版页面里实测。

---

## 3A、隐藏座位默认值改为关（2026-10-26，产物 `67BF7C32` / `D26E0A49`）

### 环境与产物绑定

| 项 | 值 |
|---|---|
| 日期 | 2026-10-26T10:07:46+08:00 |
| 插件 | @guowenzhang/dsh-ui-beautify@1.6.0（HEAD b9e8f6a，工作树含本次改动，未提交） |
| Node | v24.12.0 |
| lib/index.mjs | `67bf7c32c991fcfe2a2bba3f7af29fc0ddbfb18569602c57594459b420bec570`（82786 字节，2026-10-26T10:16:23.424+08:00） |
| lib/client.js | `d26e0a49e51e7f3793e46b81fbea3a22203fb504b780966b6980d9a0e339373a`（308518 字节，2026-10-26T10:16:23.535+08:00） |
| 证据文件 | `.scratch/test-system/runs/2026-10-26-101615-dsh-ui-beautify.json`（typecheck/metadata/unit/browser:recent）、`2026-10-26-101622-…`（build）、`2026-10-26-101652-…`（artifact） |

### 变更

用户 2026-10-26 要求「隐藏访问模式和隐藏模型选择，默认都是关，不进行隐藏，需要用户手动隐藏」。改动：`src/settings.ts` 两字段改为 `z.boolean().default(false)`；`src/client/settings-controller.ts` 的设置页投影改为 `=== true`；`src/client/composer-seats.ts` 的两个 `watchFeature` 传 `{ defaultOn: false }`（旧宿主 schema 缺字段时不安装影子）；`src/fonts.ts`、`README.md`、`README.zh.md`、`.claude/rules/settings.md`、`.claude/rules/composer-ui.md` 同步文案与默认值说明。

### 车道结果

| 车道 | 状态 | 退出码 |
|---|---|---|
| typecheck | passed | 0 |
| build | passed | 0 |
| metadata | passed | 0 |
| unit | passed | 0 |
| artifact | passed | 0 |
| browser:recent | passed | 0 |
| browser:mobile / scroll / replies / remote-settings | skip（未设 DSH_* URL 环境变量） | - |

### 逐项读数

- 工作区入口 `node tools/testing/lanes.mjs dsh-ui-beautify --all`：typecheck 1.4s、metadata 0.3s、unit 28.3s（226 项、221 pass / 5 skip / 0 fail）、browser:recent 16.8s 全通过；build 与 artifact 需 `--allow-writes`，单独跑后均为 passed（artifact 29.2s）。四类 skip 的浏览器车道都是缺环境变量，未覆盖。
- `npm run typecheck`（`tsc --noEmit -p tsconfig.json`）退出码 0。
- `npm run build` 退出码 0：`lib/index.mjs` 82.79 kB、`lib/client.js` 写入 handoff bundle。
- 产物断言：`lib/index.mjs:820-821` 为 `.default(false)`；`lib/client.js` 的设置页投影为 `value?.hideModelSelector === true`、`value?.hideAccessMode === true`，运行时为 `watchFeature(scope, "hideAccessMode", …, { defaultOn: false })`。
- 单测（`tests/hide-composer-seats.test.mjs` 9 项）：默认关冷启动不安装影子、冷文档等待且缺字段保持关、两行各自释放/恢复、卸载退订、单座位影子、`Config` 默认 false、双语文案、产物标记；`tests/client.mjs` 运行时断言改为「无字段 → 无影子；打开才遮蔽；关掉恢复其一/全部」；`tests/smoke.mjs` 钉住默认 false。旧产物 `E4CF79C7` / `D094EFCC` 的读数不再适用于默认值。

### 本节未覆盖

- **默认关的真实浏览器读数未重跑**：第 3 节「全新 profile 默认隐藏、`aria-checked=true`、两个座位 button 数 0」对应旧默认。默认关后应在隔离实例确认「全新 profile 两个座位可见 → 手动打开隐藏 → 刷新保持」，并按新默认调整 `.scratch/ui-beautify-unread/verify/probe-hide-seats.mjs` 的断言后再跑；本轮只有单测与构建产物断言。
- **旧宿主（schema 无这两个字段）的真实实例**未构造：缺字段保持关只在单测与 `tests/client.mjs` 假上下文覆盖。
- **日常实例未触碰**：未把本产物装进日常 profile，默认值变化尚未在安装版页面验证。

---

## 4、右下角快捷操作悬浮按钮（2026-10-25，产物 `FB4EA487` / `AC080513`）

### 环境与产物绑定

| 项 | 值 |
|---|---|
| 日期 | 2026-10-25T12:53:33+08:00 |
| 插件 | @guowenzhang/dsh-ui-beautify@1.6.0（HEAD 82bd62c，分支 feat/floating-quick-actions 基于 aa763ba；插件以 worktree 路径装入隔离实例，验收后已 ff 合入 master） |
| 宿主 | @deepseek-ai/dsh@0.2.1-rc.2（隔离实例） |
| DSH_HOME | `C:\02-codespace\DeepSeek\.scratch\harness-tests\quick-actions-0.2.1-rc.2-fab01` |
| 端口 / URL | 62300 / http://127.0.0.1:62300/?token=***（token 已抹） |
| Node | v24.12.0 |
| lib/index.mjs | `fb4ea4873df18ffcce2cbfc689458a233d7494cbf29d5884acaefccf1809a00a`（82784 字节，2026-10-25T04:52:59.827Z） |
| lib/client.js | `ac0805133b319d6a704c0ed3147fc2d52d9ca0b7f8547a44d70d0c771bb4a0da`（299090 字节，2026-10-25T04:52:59.968Z） |
| 证据文件 | `.scratch/test-system/runs/2026-10-25-125329-dsh-ui-beautify.json` |

### 车道结果

| 车道 | 状态 | 退出码 | 耗时 |
|---|---|---|---|
| artifact | passed | 0 | 30.0s |

### 逐项读数

- **注册与开关**：插件在 `conversation.input.dock` 注册 `ui-beautify-quick-actions`（order 103），控件本身只把 fixed 根节点 portal 到 `<body>`；设置页「界面增强」出现一行「快捷操作悬浮按钮」，默认 `aria-checked=true`。真实浏览器点击该行：`true → false` 时对话里的按钮立刻消失（`[data-ui-beautify-quick-actions-button]` 计数 1→0），再点回 `true` 恢复为 1；全程控制台 **0 错误**。截图 `quick-actions-settings-row.png`。
- **默认位置与遮挡**：1280×900 下按钮 44×44，停在 `right:24px`、`bottom:142px`（按 `[data-composer-card]` 顶边实测，位于输入框上方），与发送按钮的矩形重叠面积 **0**（`sendOverlapArea=0`）；拖动后再 reload 仍是同一位置。手机 393×844 下落点同样 `sendOverlapArea=0`（此轮沿用拖动后的持久化位置 right=204/bottom=272，仍在视口内）。
- **菜单**：点按钮弹出宿主 `Menu`（`role=menu`），1280×900 下菜单位于 `(1112,600)-(1256,710)` 视口内；三行「归档当前会话」「置顶当前会话」「下一个绿点会话」全部可点。手机 393×844 下菜单位于 `(44,387)-(189,524)` 视口内；没有绿点时「下一个绿点会话」`disabled` 且菜单里出现说明行「没有带绿点的会话在等待」。截图 `quick-actions-menu-desktop.png`、`quick-actions-phone.png`、`quick-actions-menu-phone.png`。
- **下一个绿点会话**：主视图里两个会话在离开期间完成（`greenA=session-c9b55993…`、`greenB=session-d0820791…`，均出现 `data-state="done"`）。第一次点「下一个绿点会话」打开 `greenB`、第二次打开 `greenA`（列表顺序 + 绕回），两次后侧栏绿点数 **0**（打开即清标记），当前会话确实变化。机读结果见 `quick-actions-report.json` 的 `next-green-first` / `next-green-second`。
- **置顶**：对当前会话点「置顶当前会话」后重新打开菜单，同一行变为「取消置顶当前会话」（图标同时换成 PinFill）；再点一次恢复「置顶当前会话」，与宿主的置顶状态同源。
- **归档**：取消置顶后点「归档当前会话」，该会话的侧栏行从默认列表消失（`row=null`），当前选中被宿主清空（`current=null`）——与宿主自己的归档动作一致。
- **拖动与持久化**：从 `(1212,714)` 拖到 `(1032,584)`（位移 180/130px），`localStorage` 写入 `{"right":204,"bottom":272}`；`page.reload()` 后按钮仍在 `(1032,584)`，`style right=204px / bottom=272px`，与拖动值逐像素一致；拖动结束的 pointerup 不触发菜单（`aria-expanded` 保持 false）。
- **单测与产物断言**：artifact 车道重跑后 `npm test` **220 项、215 pass / 5 skip / 0 fail**；`tests/quick-actions.test.mjs` 15 项（默认位置、钳制、存储解析/序列化、绿点轮转的包裹与过滤）；`tests/client.mjs` 新增 22 条（注册/作用域/共享快照、注入动作、开关关闭仍保留注册、菜单三行、运行中禁用与说明、无绿点禁用与说明、置顶翻转、next 打开正确会话、归档调用、失败行、拖动存储、reload 位置、拖完不误开菜单）；`tests/smoke.mjs` 钉住字段 live/默认开/false；`tests/ui-copy.test.mjs` 覆盖新文案（含菜单标签互不相同、zh 文案含「右下角／可拖动／绿点」）。

### 本节未覆盖

- **真实手机触屏**未驱动：393×844 用桌面 Chrome 模拟，拖动只用鼠标指针事件验证；`touch-action: none` 与 4px 阈值的真机手势没有实测。
- **旧宿主 schema**（宿主在按钮出现前启动、还没有 `quickActionsEnabled` 字段）：本轮隔离实例是从功能分支插件启动的，设置行可写；日常宿主未重启时该行会显示 `stale`/禁用，这种表现只有 `tests/client.mjs` 的缺字段断言覆盖，没有在旧宿主实跑。
- **浅色/深色主题、`prefers-reduced-motion`** 未单独测量：按钮与菜单用宿主 token 与宿主 Menu；本功能不改颜色与动效（只有 120ms 背景过渡，reduced-motion 下关闭）。
- **设置页手机布局、软键盘与安全区**未测：悬浮按钮不随软键盘移动（fixed 到视口，`env(safe-area-inset-bottom)` 只做底边留白），真机键盘弹出时的位置没有读数。
- **轨迹视图/空白会话**：composer dock 不挂载时按钮自然不出现；本轮只验证了「归档后当前选择为空、按钮消失」，没有单独在轨迹标签页停留读数。
- 日常实例未触碰；隔离实例与安装版 ArcuchiHarness 的宿主同为 0.2.1-rc.2，但没有在安装版页面实测。

---

## 5、下一个会话的三档优先级（绿点 > 收藏 > 对话时间）（2026-10-25，产物 `FB4EA487` / `082C20A4`）

### 环境与产物绑定

| 项 | 值 |
|---|---|
| 日期 | 2026-10-25T16:15:56+08:00 |
| 插件 | @guowenzhang/dsh-ui-beautify@1.6.0（HEAD 944656f，分支 feat/next-conversation-priority 基于 74973a2；插件以 worktree 路径装入隔离实例，验收后已 ff 合入 master） |
| 宿主 | @deepseek-ai/dsh@0.2.1-rc.2（隔离实例） |
| DSH_HOME | `C:\02-codespace\DeepSeek\.scratch\harness-tests\next-priority-0.2.1-rc.2-np01` |
| 端口 / URL | 50553 / http://127.0.0.1:50553/?token=***（token 已抹） |
| Node | v24.12.0 |
| lib/index.mjs | `fb4ea4873df18ffcce2cbfc689458a233d7494cbf29d5884acaefccf1809a00a`（82784 字节，2026-10-25T08:15:19.185Z） |
| lib/client.js | `082c20a48b201a647388c9d546e1668e49ccbca60dc79bd79ec659ab04906b97`（300151 字节，2026-10-25T08:15:19.308Z） |
| 证据文件 | `.scratch/test-system/runs/2026-10-25-161548-dsh-ui-beautify.json` |

### 车道结果

| 车道 | 状态 | 退出码 | 耗时 |
|---|---|---|---|
| artifact | passed | 0 | 30.0s |

### 逐项读数

- **测试场景**（隔离实例，1280×900，假 provider）：主视图用种子会话；**普通 A**（`session-12a74563…`）在屏幕内完成，无绿点；**收藏 B**（`session-2f70f16c…`）在屏幕内完成后用悬浮按钮「置顶当前会话」置顶，重开菜单变「取消置顶当前会话」；**绿点 C**（`session-39a0827d…`）发送后立刻切回主视图，完成时侧栏出现 `data-state="done"` 绿点。
- **第 1 档：绿点优先**：主视图点「下一个会话」→ 当前会话变为 C；返回时侧栏绿点数 **0**（打开即清）。菜单三行为「归档当前会话 / 置顶当前会话 / 下一个会话」，全部 `disabled=false`。
- **第 2 档：收藏（置顶）优先**：从 C 再点「下一个会话」→ 当前会话变为 **B**（收藏压过时间档；此时菜单的置顶行已是「取消置顶当前会话」）。
- **第 3 档：对话时间**：从 B 再点「下一个会话」→ 当前会话变为 **A**（`session-12a74563…`，比 B 更旧的普通会话）；没有回弹到 B/C，符合「按 `updatedAt` 取当前之后紧邻的更旧一个」。
- **菜单与错误**：三步菜单文案均为「下一个会话」；没有其他会话时该行才禁用并显示「没有其他会话可切换」（该禁用路径由 `tests/client.mjs` 覆盖，本轮实例里总有其他种子会话）。全程 `page.on('console')`/`pageerror` **0 错误**；截图 `next-priority-menu.png`，机读结果 `.scratch/ui-beautify-unread/verify/next-priority-report.json`（`next-1-green` / `next-2-pinned` / `next-3-time`）。
- **单测与产物断言**：artifact 车道重跑后 `npm test` **224 项、219 pass / 5 skip / 0 fail**；`tests/quick-actions.test.mjs` 19 项（绿点压过收藏、无绿点回退收藏、时间档 `updatedAt` 排序与最旧绕回最新、`updatedAt` 缺失、空白/子智能体/已归档/未知 id 过滤、空候选返回 null）；`tests/client.mjs` 新增「无绿点仍回退时间档并打开下一个更旧会话」「收藏压过时间档」「只有一个会话时禁用并说明」三条路径；`tests/ui-copy.test.mjs` 覆盖「下一个会话」与「收藏/对话时间」文案。

### 本节未覆盖

- **「收藏」按宿主置顶（pin）集合实现**：宿主没有独立的收藏/星标模型，本轮把「收藏」解释为侧栏置顶；如果用户的收藏另有来源（例如其他插件），这里的口径需要再对齐。
- **多个置顶会话之间的选择**只由单测覆盖（真实浏览器实例里只置顶了一个 B），没有在浏览器里造第二个置顶会话验证「按 ids 顺序轮转」。
- **时间档相同 `updatedAt`** 的平局顺序只由单测的 ids 次序保证，没有在真实宿主里制造同毫秒会话。
- 真机触屏、软键盘/安全区、浅深色主题、旧宿主 schema（宿主未重启时 `quickActionsEnabled` 显示 stale）与第 4 节相同，未在本节重复测量。
- 日常实例未触碰；隔离实例为 0.2.1-rc.2，安装版 ArcuchiHarness 页面未实测。

---

## 6、归档当前会话后自动切到下一个会话（2026-10-25，产物 `FB4EA487` / `8F8A18EE`）

### 环境与产物绑定

| 项 | 值 |
|---|---|
| 日期 | 2026-10-25T18:47:48+08:00 |
| 插件 | @guowenzhang/dsh-ui-beautify@1.6.0（HEAD cd1f25d，分支 feat/archive-next-conversation 基于 1468d91；插件以 worktree 路径装入隔离实例，验收后已 ff 合入 master） |
| 宿主 | @deepseek-ai/dsh@0.2.1-rc.2（隔离实例） |
| DSH_HOME | `C:\02-codespace\DeepSeek\.scratch\harness-tests\archive-hop-0.2.1-rc.2-ah01` |
| 端口 / URL | 61157 / http://127.0.0.1:61157/?token=***（token 已抹） |
| Node | v24.12.0 |
| lib/index.mjs | `fb4ea4873df18ffcce2cbfc689458a233d7494cbf29d5884acaefccf1809a00a`（82784 字节，2026-10-25T10:47:21.498Z） |
| lib/client.js | `8f8a18ee8a3b834af23bdcd202baa36c4ea86426b082e6d55c27feaf7e5ec69f`（300442 字节，2026-10-25T10:47:21.624Z） |
| 证据文件 | `.scratch/test-system/runs/2026-10-25-184744-dsh-ui-beautify.json` |

### 车道结果

| 车道 | 状态 | 退出码 | 耗时 |
|---|---|---|---|
| artifact | passed | 0 | 23.2s |

### 逐项读数

- **测试场景**（隔离实例，1280×900，假 provider）：主视图 M 是种子会话（`session-c055bdb9…`）；**普通 A**（`session-4869aed8…`）在屏完成；**绿点 C**（`session-779fa9ab…`）在 M 打开时完成并出现 `data-state="done"` 绿点。
- **归档主会话 M**：从悬浮按钮菜单点「归档当前会话」→ M 从侧栏消失，当前会话直接变为 **C**（绿点优先），**没有停在空白新建会话页**；C 的绿点被清空（`done` 计数 0）。菜单三行仍为「归档当前会话 / 置顶当前会话 / 下一个会话」。截图 `archive-hop.png`，机读 `archive-hop-report.json` 的 `archive-main`（`current=session-779fa9ab…`）。
- **再归档 C**：没有绿点/置顶可优先，按对话时间档落到更旧的 **A**（`session-4869aed8…`），而不是空白页；`archive-green` 记录 `current=session-4869aed8…`。
- **失败不 hop**：归档被宿主拒绝（运行中/置顶互斥）时仍只显示失败行，不调用 `openSession`；没有其他会话时只归档、保留宿主兜底——两条路径由 `tests/client.mjs` 覆盖（本轮实例总有其他种子会话，未在浏览器制造「唯一会话」）。
- **单测与产物断言**：artifact 车道重跑后 `npm test` **224 项、219 pass / 5 skip / 0 fail**；`tests/client.mjs` 的归档断言改为 `archive → open 下一个会话`（`[['archive','session-a'],['open','session-b']]`），并新增「只有一个会话时只归档不 hop」「归档被拒时不 hop」；`tests/quick-actions.test.mjs` 三档逻辑不变（仍 19 项）。全程 `page.on('console')`/`pageerror` **0 错误**。

### 本节未覆盖

- **归档已置顶会话**仍会被宿主拒绝（先取消置顶再归档的既有约束未变），本节没有成功归档置顶会话后 hop 的浏览器读数。
- **唯一会话时归档**（没有可跳目标，保留新建会话页）只有 `tests/client.mjs` 覆盖，没有在浏览器里造「列表只剩一个会话」的实例。
- **置顶/绿点同时存在时的归档目标**按三档优先级实现，但本节浏览器实例里归档 M 时只有绿点 C 一个候选；收藏优先的归档目标没有单独在浏览器验证（第 5 节验证的是「下一个会话」路径）。
- **归档与 hop 之间的宿主时序**（宿主清空选中与我们 `openSession` 的竞态）只按一次成功流程验证，没有做慢宿主/网络延迟注入。
- 真机触屏、软键盘/安全区、浅深色主题、旧宿主 schema 与第 4 节相同，未在本节重复测量。
- 日常实例未触碰；隔离实例为 0.2.1-rc.2，安装版 ArcuchiHarness 页面未实测。

---
