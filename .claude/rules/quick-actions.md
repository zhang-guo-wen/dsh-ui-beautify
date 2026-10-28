---
paths:
  - "src/client/QuickActions.tsx"
  - "src/client/QuickActions.module.css"
  - "src/client/quick-actions.ts"
---

# 快捷操作悬浮按钮（2026-10-25）

> 覆盖：对话右下角可拖动悬浮按钮、它的宿主菜单（归档／置顶／**下一个会话的三档优先级**）、拖动位置的保存与边界、绿点/收藏/对话时间三档判据、新开关 `quickActionsEnabled` 的接线，以及验收口径。何时读：动 `src/client/QuickActions*`、`quick-actions.ts`、它的注册与开关行或「下一个会话」的语义时。

## 组件、注册与数据来源

- `QuickActions.tsx` 注册在 `conversation.input.dock`（**Session 作用域**），id `ui-beautify-quick-actions`、order 103。dock 条目本身只渲染一个 **portal 到 `<body>`** 的 `position: fixed` 根节点：挂在 composer 的裁剪子树里会被祖先 `overflow` 裁掉，也可能被 transform 祖先改掉 fixed 的包含块。
- Session 作用域给到 `sessionId` 与两个标准钩子 `useSessions` / `useSessionStatus`；`useWorkspaces` 来自全局座位。这三个钩子在已发布类型里缺 Session 标准座位的合并，所以 `index.ts` 里组件以 `as never` 注册（与 `mobile-layout` 的 `MobileRecentSessions` 同一处理），并用本地结构类型声明钩子形状，不 import 宿主实现包。
- 三个动作走注入的 `uiWorkspace`：`archiveSession` / `pinSession` / `unpinSession` / `openSession`，与侧栏菜单同一服务、同一语义；不要另走 RPC 或直接改 store。
- 空白会话（`byId[sessionId].blank`）不显示按钮；轨迹视图不挂载 composer dock，因此也没有按钮——这是刻意的，不猜用户意图。
- 开关 `quickActionsEnabled`（默认 **on**、volatile）：关闭时组件 `return null`，**插槽条目照常注册**，重开立即恢复。旧宿主 schema 缺字段时设置行显示 `stale` 并被禁用（宿主重启一次才能写），但客户端按默认开启照常显示按钮。

## 位置、拖动与持久化

- 位置是**相对视口右下角的两个距离** `{ right, bottom }`，存 `localStorage` 键 `ui-beautify:quick-actions-position`；值不是两个有限数字时按不存在处理（回退默认位置），不要相信手改过的存储。
- 默认位置不是写死 24px：`defaultDockPosition` 允许传入 `[data-composer-card]` 的顶边，按钮停在输入框**上方** 12px——手机右下的发送按钮正好在视口角落，写死 `bottom: 16px` 会盖住它。宽屏右边距 24、手机 16；找不到 composer 卡片时退回底边距（手机 96、桌面 24）。测量失败（测试替身、无布局引擎）不得抛错。
- 拖动时 `right/bottom` 随指针位移反向更新，`clampDockPosition` 保证整个 44px 圆在视口内、四边最小距 8px；窗口 resize 时重新钳制。指针移动超过 4px 才算拖动；**拖完的 pointerup 不能被当成点击**（`dragged` 标记吃掉紧随的 click，否则松手会弹菜单）。按钮 `touch-action: none`，手机上拖动不会被页面滚动抢走。
- 拖动开始时若菜单开着先关掉；拖动结束才写存储，中途每帧只更新 React 状态（不读 storage 的做法避免卡顿）。

## 菜单与动作

- 菜单复用宿主 `Menu`（`MenuSurface` 材质、键盘行走与外点关闭都由它负责）：`portal` + `getAnchorRect` 指向按钮、`side="top"`、`align="end"`、`autoFocus`。菜单行是数据项 `MenuEntry`，图标用 ui-primitives 的 `IconArchiveOutlineRegular`、`IconPinOutlineRegular/Fill`、`IconChevronRightOutlineRegular`；标题用 `IconEnhanceOutlineRegular`。
- 三个动作：归档当前会话；置顶/取消置顶（标题和图标跟着 `pinnedSessionIds` 翻转）；**下一个会话**（按三档优先级选目标）。运行中（`running`）归档行禁用并显示一行说明；没有其他会话可切换时「下一个会话」行禁用并显示说明；动作失败写一行本地化失败文案（`quickActionsArchiveFailed` / `quickActionsPinFailed` / `quickActionsNextFailed`），不吞错也不把宿主原始错误直接抛到界面。
- **归档后自动切到下一个会话**：宿主归档当前会话会清空选中、落到空白新建会话页；按钮在 `archiveSession()` 成功后用同一份 `nextId` 调 `uiWorkspace.openSession(target)`，所以归档读起来是「往前走一步」而不是「重新开始」。target 在点击时就已按三档优先级算好（当前会话被排除）；没有其他会话时保持宿主兜底（新建会话页），不要凭空造一个 open 调用。归档失败（运行中/宿主拒绝）不 hop；`openSession` 若被宿主拒绝则吞掉异常、保留宿主兜底。
- **置顶与归档互斥**：已置顶的会话要先取消置顶再归档，否则宿主拒绝；真实浏览器流程按这个顺序验证过。归档运行中的会话宿主会拒绝（按钮层已禁用，属双保险）。
- 「下一个会话」的判据在 `quick-actions.ts` 的 `nextConversation`，三档按顺序只取第一档命中的：
  1. **未读绿点**（`statuses.get(id).completionUnread === true`）：优先打开读者离开期间完成、还没读的会话；
  2. **收藏（宿主置顶）**（`useWorkspaces.pinnedSessionIds`）：没有绿点时打开下一个置顶会话；
  3. **对话时间**：前两档都没有时，按 `updatedAt` 从新到旧，取当前会话之后**紧邻的更旧一个**；当前会话已是最旧则绕回最新。
  前两档按宿主 `useSessions` 的 `ids` 顺序从当前会话之后走、到末尾绕回（与侧栏顺序一致）；第三档**必须显式按 `updatedAt` 排序**，不要依赖 ids 顺序就是时间顺序。三档都跳过当前会话、空白草稿、子智能体（`origin === 'subagent'`）、已归档（`archivedSessionIds`）与 `byId` 缺失的 id。找到后调用 `uiWorkspace.openSession`；宿主打开即清绿点，连续按会逐档前进、不会原地重复。
- 打开菜单时清掉上一次的失败行；菜单关闭（Escape、外点、选完动作）也清。

## 验收与证据

- 纯逻辑：`tests/quick-actions.test.mjs`（19 项：默认位置、钳制、存储解析/序列化、三档优先级与包裹/过滤、时间档的 `updatedAt` 排序与绕回）。
- 产物级：`tests/client.mjs` 的「the floating quick actions」一节（注册/dock/order/共享快照、注入的动作、开关关闭仍保留注册、三行菜单、运行中禁用与说明、绿点优先、无绿点时回退到收藏再回退到时间、无其他会话时禁用并说明、置顶翻转、归档后 hop 到下一个会话、无其他会话时只归档不 hop、归档被拒时不 hop、失败行、拖动存储与 reload 位置、拖完不误开菜单）。
- 真实浏览器（隔离实例，插件指向 worktree）：`.scratch/ui-beautify-unread/verify/probe-next-priority.mjs` 造三个会话——普通 A（在屏完成）、收藏 B（在屏完成后用按钮置顶）、绿点 C（离开期间完成）——从主视图连点「下一个会话」依次落在 **C → B → A**（绿点 > 收藏 > 对话时间），绿点被清空、菜单文案为「下一个会话」、控制台 0 错误；`probe-archive-hop.mjs` 归档当前会话后落在下一个会话而不是空白新建会话页（见 `docs/testing.md` 第 6 节）。`probe-quick-actions.mjs` / `probe-quick-actions-settings.mjs` 保留拖动、手机布局与设置开关的读数。读数与截图登记在 `docs/testing.md` 第 4、5、6 节。探针依赖假 provider 的隔离实例，**不进** `npm test` 链。
- 不把「宿主菜单样式」「真实手机触摸」当已覆盖项：真机未驱动，触屏手势只用 4px 阈值 + `touch-action: none` 的设计与鼠标拖动近似验证。

## 易崩清单

1. 在 dock 条目里直接渲染 fixed 控件而不 portal：祖先 `overflow: hidden` 会裁掉它，拖动后可能整块消失。
2. 把默认 `bottom` 写死 16px：手机上盖住发送按钮（本功能正是为此测了 `sendOverlapArea === 0`）。
3. 拖完不抑制 click：松手会打开菜单，看起来「拖一下就弹菜单」。
4. 用 `useSessions` 的 `ids` 顺序实现「对话时间」档：宿主列表顺序未必等于 `updatedAt` 顺序；第三档必须显式排序（前两档才用 ids 的顺序走）。
5. 归档已置顶会话：宿主拒绝，菜单只显示失败行；先取消置顶。
6. 归档后不 hop：宿主清空选中会落到空白新建会话页；`archiveSession` 成功后要接着 `openSession(nextId)`，且没有 nextId 时不要凭空造 open 调用。
7. 忘记把新开关加进 `tests/smoke.mjs` 的默认开字段循环与 `FeatureToggleRows` 的联合类型：设置行会渲染但类型不收紧。
