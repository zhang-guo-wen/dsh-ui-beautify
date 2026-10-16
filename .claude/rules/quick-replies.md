---
paths:
  - "src/quick-replies.ts"
  - "src/client/QuickReplies.tsx"
  - "src/client/QuickReplies.module.css"
  - "src/client/QuickReplyRow.tsx"
  - "src/client/QuickReplyToggleRow.tsx"
  - "tests/quick-replies-browser.test.mjs"
---

> 覆盖什么、何时读：本文件覆盖 composer 下方的快捷回复（注册位置与 order、点击=写草稿+提交、PC 端显示开关与手机隐藏、短语可自定义的槽位模型、以及「一行放不下就少显示几条」的测量与闪烁修复）；当你需要动 composer 下方那条带子、快捷回复短语或它的设置行时读它。

# composer 下方的快捷回复

## composer 下方的快捷回复

composer 卡片正下方那条整宽插槽是 `conversation.composer.dock`（同样由 ui-conversation 声明，`kind: 'list'`、`scope: 'session'`），本插件在其中注册 `ui-beautify-replies`（order **1**）。同一插槽的既有占用者是 ui-chat 的会话统计胶囊（order 0），1 让标签排在它后面；`ContextMeter` 由 composer 自己渲染，在整条带子的最后。

**一次点击 = 写草稿 + 提交**，走的是 session 标准席位里的 `inputActions`：`insertText(短语, captureInsertion())` 然后 `submit()`。是**在光标处插入**而不是 `setDraft` 顶掉整份草稿——用户打了一半的消息不会被误点清空，而草稿为空时两者是同一件事。`insertText` 返回 false（编辑器已锁、或点击与插入之间草稿变了）就**不提交**：否则发出去的是草稿里原有的内容，而不是点中的那句话。

`InputActions.submit()` 是无参版本，固定按 `queue` 投递，模型还在跑时消息排到下一轮，和 composer 自己的默认发送一致。要跟随设置里的「忙碌时回车」偏好，得先把投递模式放进公共席位——插件不越界去读 composer 的内部状态。

短语**就是发出去的消息**，所以内置短语留在 locale 字典（`quickContinue` / `quickOk` / `quickNoUnderstand` / `quickStatus`）里而不是写成组件里的字面量：中文界面发中文，英文界面发英文。顺序与清单在 `locales.ts` 的 `QUICK_REPLY_PHRASE_KEYS` 里，加一句 = 加一个字典键 + 在那一项里加一条，别处没有第二份枚举。

### PC 端显示开关与手机隐藏

`quickRepliesEnabled` 是默认 `true` 的 volatile 布尔字段。`QuickReplyToggleRow` 在设置页的动效行后复用宿主 `Switch`；关闭时 `QuickReplies` 返回 `null`，插槽始终注册，重新开启立即恢复。手机视口（不超过 600px，与宿主侧栏断点一致）通过媒体查询隐藏回复标签和开关行；调整窗口宽度也实时生效。内容编辑行仍 parked，不恢复编辑 UI。新增字段需要宿主重启一次，旧 schema 显示 `stale` 并禁用开关。`tests/client.mjs` 覆盖布尔写入、开关状态、旧宿主/只读/不可用，以及两处手机隐藏规则。

### 短语是可自定义的

用户写的短语存在设置里（`quickReplies`，`z.array(z.string()).volatile()`，默认 `[]`），所以这排标签是"用户自己的话"，内置的四条只是全新安装时的默认值。两半边共用 `src/quick-replies.ts` 的槽位模型：

| 规则 | 位置 |
|---|---|
| 最多 4 条 | `MAX_QUICK_REPLIES` |
| 单条最长 40 字 | `MAX_QUICK_REPLY_LENGTH`（输入框的 `maxLength` 与读取时的截断） |
| 空槽不显示标签 | `visibleQuickReplies()` 过滤空串 |
| 四个都空 = 用内置短语 | 读出来是空列表，`QuickReplies` 回落到字典 |
| 手改文档写了 10 条 | `quickReplySlots()` 截到前 4 条，而不是让整份设置回落 |

**位置是保留的**：`quickReplySlots()` 只裁掉尾部空槽，中间的空槽留在原位，所以设置行里第 3 个标签永远对应第 3 个槽位，一次回写不会把半路改了一半的短语挪到别的格子里。写入走 `SettingsRowFace.choose('quickReplies', slots)`——同一个 `choose` 既写字符串也写数组，`sameValue()` 对数组逐项比较，避免写入一份相等列表又白白发布一次快照。

**这一行目前不挂载**：`BeautifySection` 没有渲染 `QuickReplyRow`，因为它的呈现方式还没定（组件文件头有一段 Parked 说明）。组件、文案、样式、`quickReplies` 字段、dock 的读取逻辑，以及下面这些交互规则都原样留着——**在动效行之后加回一行 `<QuickReplyRow {...props} />`（连 import）即恢复**。`tests/client.mjs` 里那一整块断言由 `pageComponents.has('QuickReplyRow')` 守卫：页面不挂载时整块跳过并打一行 parked，挂载即 24 条全部重跑，不需要改测试。

设置行是 `QuickReplyRow.tsx`：**4 个胶囊标签**，一格一个槽位，显示方式与 dock 一致——有短语的是实心标签，空槽是灰色虚线标签并写着该槽的内置短语（一句话同时回答「这一格现在不发标签」和「点它会启用什么」）。

**点标签就地变成输入框**（`autoFocus`），灰色标签的那一下点击本身就把内置短语写进这一格，所以点完直接回车即启用；实心标签只打开、不写入。回车或失焦保存并去掉首尾空白，清空即关闭这一格，Esc 写回点击前的值。`cancelled` 这个 ref 挡住「卸载时浏览器可能补发的 blur」——否则取消反而会把空值提交上去；**每次 `edit()` 都先把它清掉**，因为浏览器对被移除的输入框并不保证补发 blur，留着标记会把下一次编辑的第一次失焦吞掉（`tests/client.mjs` 有这条回归）。编辑态是这一行**唯一**的本地状态（`useState`），短语本身仍以 store 为准，store 一变标签就跟着变。全部为空时不显示「恢复默认」按钮。

`conversation.composer.dock` 的注册因此补上了 `inject: () => controller.inject()`：短语来自设置，不再是常量。

标签用 ui-primitives 的 `Pill`：胶囊几何与配色由它给，行内只留自己的排布——`flex-wrap: nowrap`（**始终一行**，绝不换行把 composer 的控件挤走）、6px 间距、以及禁用时的降透明度。`Pill` 已经被视图切换与终端块用着，所以它的样式一直在 shell 的 CSS 里，不存在「引用了没样式的原子」这种情况。

### 一行放不下就少显示几条（2026-10-08）

composer 下方那条带子是**同一条 flex 行**（会话统计胶囊 + 快捷回复 + ContextMeter），窗口变窄时行会压缩**可收缩的项**：统计胶囊先被省略号截断，快捷回复行被压到比内容窄——旧实现在这里 `flex-wrap` 换行，于是带子长高、把卡片里的控件顶掉。现在改成**只显示放得下的前几条**：

- **换行改成隐藏**：超出的标签保留在 React 树里、加 `.hidden`（`display: none`）——既不占行、也不能 Tab 到、更不进无障碍树；变宽后同一次测量可以把它们重新显示出来。
- **判据是「行自己的内容超出它拿到的盒子」**：`QuickReplies.tsx` 的 `fit()` 先显示全部标签，再用 `last.right - first.left`（可见标签的**实际跨度**，不是 `scrollWidth`——行是居中的，溢出的一半落在盒子左边，不进滚动区）与 `row.getBoundingClientRect().width` 比较；放不下就从尾部去掉一条**再测一次**（每去掉一条，兄弟项不再被压缩，盒子会变大，所以必须逐步重测）。`count === 0` 时整行不显示标签，但行本身留着，否则变宽后再也无法测回来。
- **测量时机**：`ResizeObserver` 观察行、dock、dock 的父级（viewport/侧栏变化移动的是这一层，行一旦放得下就不再变形）以及其余同层条目；`MutationObserver` 覆盖兄弟文案变化；`document.fonts` 的 `loadingdone` 覆盖字体换装（标签宽度变了但任何被观察的盒子都没动）；再加 `window` 的 `resize`——变宽时可能**没有任何盒子移动**（行已被裁到刚好放下），只靠 RO 会一直停在少显示几条的状态。
- 用 `classList.toggle(css.hidden, …)` 而不是行内 `display`：行内样式只能藏不能显示，一旦被上一次测量藏起来，后面就永远涨不回来（实测会一路钉死在最少条数）。React 渲染的 `className` 与探索写的是同一个类，二者一致。
- **探索必须把行摆成 React 为该条数渲染的那一份 DOM——两个类都要写，不只是 `.hidden`**（2026-10-08 闪烁修复）：React 渲染一个隐藏标签时给的 `className` **只有** `.hidden`，所以探索把它重新显示出来时它并没有 `.tag`，而 `.tag` 的 `flex: none` 正是让胶囊保持自身宽度的东西；少了它，这条标签被压进被测量的盒子里，`spills()` 会把「压扁后正好等于盒子」读成「放得下」，于是答案取决于「这一刻渲染的是什么」而不是「有多少地方」：渲染 4 条答 3 条、渲染 3 条答 4 条。每次答案都会改变行的宽度，`ResizeObserver` 再触发测量，两个答案**永久交替**——实测 601px 下 3 秒里可见条数变了 173 次（约 60 Hz），用户看到的就是「一会儿 2 个、一会儿 3 个」。`show()` 现在同时 `toggle(hidden, !visible)` 与 `toggle(tag, visible)`，于是探索是**幂等**的：同一个布局无论从哪个已渲染状态进入，答案都一样，测量不再自我触发。改这里之前先读 `QuickReplies.tsx` 里 `show()` 上方的注释。
- **测量窗口比 React 的提交更早**：`ResizeObserver` 的回调可以在 React 为上一次 `setFits` 重新提交 `className` 之前跑到，所以「探索留下的 class」会被下一次测量直接看到——这正是上面那条要求存在的原因，别用「反正 React 随后会把类名改回来」来放过它。
- 验证：`.fit-check/`（一次性脚手架，已删除）+ 真实浏览器里用宿主自己的 `InputBar.module.css` / `StatsPills.module.css` / `ContextMeter.module.css` 复现带子，跑 1200/893/800/700/660/620/601/600/560 的来回切换：≥700 显示 4 条，601–660 显示 3 条，≤600 由既有媒体查询整行隐藏；每次都是**单行、无重叠、统计胶囊不再被截断**。修复后按同一路径重跑：601–640 稳定 3 条、650 起 4 条、≤600 整行隐藏，**每个宽度静止 1.5 秒内 0 次条数变化、0 帧溢出**，720→590→720 的逐帧窄化过程中条数只单调变化；`npm run test:replies` 就是这条回归（见「测试」）。

无障碍的三个字段都是必须的：外层 `role="group"` + `aria-label` 说明这是一组快捷回复，每个标签自己的 `aria-label` 写成「发送「继续」」——按钮上的字就是消息本身，所以两处文案都只从字典取。设置行里每个标签的 `aria-label` 是「编辑「<它现在显示的字>」」（灰色标签用的是内置短语，正好等于点它会启用什么），打开后的输入框是「快捷回复内容」。

**空白会话（hero）里不会有这排标签**：`conversation.composer.dock` 只在 `variant === 'composer'` 时渲染，这是 ui-conversation 的行为，不是插件没注册。
