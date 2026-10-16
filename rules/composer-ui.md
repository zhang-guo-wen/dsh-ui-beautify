本文件覆盖 composer 上方的光柱（含已被替代的骑车道历史实现）、回到最近提问、会话开始胶囊与 composer 下方的快捷回复；当你需要改动 composer 上下任何一件界面元素时读它。

# composer 界面元素

## composer 上方的光柱（2026-10-08）

当前实现为 `LightBeam.tsx` + `LightBeam.module.css`，已删除旧 BikeLane 源码。光柱固定 1px，改用宿主 `conversation.input.overlay` 的零高度绝对定位锚点，直接覆盖输入框上边框，不占行、不加 margin/gap，不修改宿主布局；仅保留光柱，无底轨和外扩光晕。保留 `ui-beautify-lane` / order 100；设置页只有默认开启的宿主 Switch，沿用 `motion` 字符串字段写入 `always`／`off`，不新增字段。旧 `system` 或未设置归一化为开启，已存 `off` 保持关闭；删除三选一和浏览器 reduced-motion 分支。不要新增粗细或速度配置。使用宿主主题主色；按真实 assistant partial 字符增长测速，速度为 `1.6 * rate / (rate + 220)` 行程／秒，0.65 秒指数平滑，停止后 8 秒线性减速至静止，空闲保持可见悬浮，不淡出；仅关闭开关时隐藏。若停在行程裁剪区，将光柱停靠最近可见边缘，避免无输出时看不见。位置保存为比例，头尾在容器外换行，背景标签恢复时单帧 dt 最大 0.1 秒。React 只采样，rAF 写 transform，关闭／卸载取消 rAF。`tests/output-rate.test.mjs` 覆盖原型曲线和采样；客户端产物测试覆盖固定 1px／零布局占位、无单车 SVG、空闲可见静止、流动、减速停靠、可见区域无跳跃和默认开启的 always/off 开关。

### 历史骑车道实现（已由光柱替代，仅供历史参考）

composer 卡片正上方那条整宽插槽是 `conversation.input.dock`（ui-conversation 声明，`kind: 'list'`、`scope: 'session'`），本插件在其中注册 `ui-beautify-lane`（order **100**）。同一插槽的既有占用者是 queue（20）、todo（0）与 goal，100 让小人排在它们之后、紧贴卡片。

**速度读的是 `useChat(s => s.legacy.partial)` 的字符增长率，不是 `sessionStats`。** `sessionStats` 的 `decodeTokens` / `decodeMs` 在 `assistant/message` 才结算，一个 step 只有一个读数——那正是「刚才那一段有多快」，而动画要的是「此刻写多快」。Chat 目标的在途累加器随流式分片推进，是浏览器半边唯一能读到「还没结束的 step」的出口。`useChat` 是 ui-chat 通过 `ctx.uiSession.provide({ hooks: ['chat'] })` 提供的标准席位，session 作用域的插槽都能拿到。

这条依赖**不需要运行时兜底**：`conversation.input.dock` 由 ui-conversation 声明，而 ui-conversation、ui-chat、ui-session 都是 `@deepseek-ai/dsh-web-app` bundle 里的行，本插件的 `cordis.patch.yml` 正是打进那一层——插槽存在就一定有 `useChat`。这是**组合事实**，不是同进程类型边界上的假设；若将来本插件要被别的组合复用，得重新核对，而不是加一个 `typeof useChat !== 'function'` 的分支把配置错误藏起来。

单位是**字符**不是 token：provider 要到 step 结束才报 usage，在途输出根本没有 token 数，按模型猜一个分词器等于编造精度。曲线的形状才是重点，所以每个字符一视同仁。

**两个时钟必须分开**，这是动画平滑的全部原因：

- React 只在字符数变化时重渲染，把新读数折进样本窗口——频率跟着 transcript 自己的发布节奏走，不是帧率。画好的 SVG 用 `memo` 包住，否则每个分片都会让 React 重新协调那十个节点，而它们的属性其实都由帧循环独占。
- `requestAnimationFrame` 独占位移与车轮角，直接写 `transform` 与 SVG 的 `transform`/`points` 属性，**不 setState**，并在这里自己对速度做缓动。输出一停它不是立刻不动，而是滑行 8 秒才停下（见下）。

**车轮由位移驱动**（`角度 = 位移 / 轮半径`，滚动不打滑），不是第二条独立动画，因此不可能与地面脱节；曲柄再按 `GEAR_RATIO` 跟在车轮后面，腿随曲柄起落。

`prefers-reduced-motion: reduce` 由**用户的选择**决定，不由环境强制：

| 存储值 | 行为 |
|---|---|
| `system`（默认）| 浏览器要求减少动效时不渲染、不启动帧循环 |
| `always` | 无论浏览器怎么说都播放 |
| `off` | 不渲染、不启动帧循环 |

判断在 `BikeLane.tsx` 里做（`animate = choice === 'always' \|\| (choice === 'system' && !prefersReducedMotion())`），**不是** CSS 媒体查询：媒体查询看不见存储的选择，两者必须一起权衡。不播放时组件 `return null`，但**插槽条目照常注册**。

曾经把判断放在 `apply()` 里、命中偏好就整条不注册——结果偏好打开时插件和坏掉长得一模一样，排查的人连一个节点都找不到，白烧了两轮定位。**环境开关不要挡在注册前面**：注册照常，行为只在组件里收窄；再给用户一个能覆盖它的开关，并在 `MotionRow` 的状态行里写出「为什么带子是空的」。

`src/client/output-rate.ts` 里的观感常量是设计值，不是配置项。**没有输出就没有位移**：`laneSpeed(0) === 0`，不会低速空转。曲线在半速点（220 字符/秒）以下近似线性、之上饱和，所以更快的输出永远还能再快一点，快速流不会和「稍快一点」看起来一模一样。

**四个细节都是为了动作连续，改之前先读它们的注释：**

- `charsPerSecond` 的**分母是样本窗口自身的跨度，不是 `now`**。跑到 `now` 看着无害，其实每两次分片之间读数都在衰减、分片一到又猛跳——看起来就是一顿一顿的，正是要避免的卡顿。流是否停下的判断交给另一条规则：最新样本比窗口还旧就**精确返回 0**。
- 还有输出时，帧循环对速度做**指数缓动**（`SPEED_EASE_SECONDS`，帧率无关的 `1 - exp(-dt/τ)`）。逐分片的读数是阶梯状的，不缓动就是跳到每个新值。
- 输出停下后**不走这条缓动**：保持当时的速度，按 `COAST_SECONDS`（8 秒）**线性**减到 0。走缓动会在一秒内停住，那是急刹；滑行 8 秒才是「停下来」而不是「断掉」。
- **位置按比例记，不按像素。** `MotionState.progress` 是行程的分数（0..1），像素 x 由它算出。按像素记时 `clientWidth` 每帧现读，车道**一变窄**（滚动条出现、侧栏折叠、卡片宽度变化）就会提前取模——车凭空跳回左边，看起来就是「重置」。行程比车道两端各多一个车宽，所以换行发生在画面外、看不见。

`MotionState` 放在 `useRef` 里而不是 effect 闭包内：effect 一旦重跑（`animate` 翻转、子树重挂），闭包里的状态就归零，车会从起点重新出发。

`BikeLane.module.css` 的 36×20px 与 `BikeLane.tsx` 的 `BIKE_WIDTH_PX` / `BIKE_HEIGHT_PX` **必须一致**——轮半径由它们推出，而且盒子的宽高比与画布并不完全相同，所以缩放取两者较小的那个比值，否则车轮会与地面打滑。描边宽度按**渲染后的像素**定，所以图越小、viewBox 里的描边要越粗，否则缩到 20px 会淡成一片灰。

`.lane` 用 `margin-bottom: calc(2px - var(--dsh-composer-stack-gap, 6px))` 把 `composerStack` 的 6px 行距吃掉大半：小人要看起来**坐在输入框上**，而不是和下方面板一样属于上方那组卡片。留 2px 免得贴死。用变量而不是写死 -4px，是为了 stack 行距变了这里跟着变。

## 回到最近提问（2026-10-15 起逐轮向上跳）

`ScrollToPrompt.tsx` 在 `conversation.input.dock` 注册零高度定位锚点，通过 portal 把向上按钮放入当前 Chat frame，保持宿主向下按钮不变。按钮复用宿主 Button、向上图标与 floating token，位于向下按钮左侧 42px。**2026-10-15 用户把目标从「最近一条提问」改成逐轮向上**：目标一律是「当前视口上方最近的一条可见 `user` / `steering` 已发送消息」——也就是读者正处的那一轮的开头；跳过去后（24px 阅读缩进）下一次点击落到再上一轮，连续点击逐轮走回更早的对话。`nearestPromptAbove(flow, scroller)` 是这一判据的唯一实现，按钮与胶囊共用；切到没有可见提问（如空会话、或已停在最早一轮）时隐藏。不跳到整个历史开头、不读取草稿。滚动后立即交付 scroll/scrollend，让宿主结束读者位置采样、停止追随输出；切换轨迹视图或卸载时释放 portal、滚动监听与观察器。

设置页「界面增强」第一行是它的开关：`scrollToPromptEnabled`（默认 `true` 的 volatile 字段）。注册时带上 `inject: () => controller.inject()`，组件读同一份设置快照；关闭时组件返回 `null`（**插槽条目照常注册**，否则重开就没法恢复），定位 effect 以该开关为依赖重跑——关着的时候没有锚点，重新打开必须重新定位，否则按钮再也不会出现。新增字段需要宿主重启一次，旧 schema 会把这一行显示成 `stale`。

`npm run test:scroll` 覆盖逐轮定位与空白/隐藏消息；真实浏览器回归设置 `DSH_SCROLL_URL`、`DSH_SCROLL_WORKSPACE`、`DSH_SCROLL_SESSION`，选择已有长对话，隔离测试浏览器仅替换本次 client bundle 响应，不覆盖正在使用的插件目录。验收包括向上/原向下、393px/桌面、浅色/深色、轨迹切换清理（按钮与胶囊都清掉），以及关掉开关后按钮消失、重开立即恢复。

## 会话开始胶囊（2026-10-15）

`SessionStartChip.tsx` 与向上按钮同在 `conversation.input.dock`（`ui-beautify-session-start`，order **102**），是 IDEA 折叠标记的对话版：当读者所在那轮的开头滚出视口，**一行该轮提问的开头文本**悬浮在 Chat frame 顶部，下方一条 0.5px 分割线（用户先后明确：「不是显示会话开始一个按钮，是显示简短的一行字」「不要区块，参考 idea，一条线分割就行。且只显示一行」「然后也不需要悬浮显示」；此前依次做过「会话开始」小胶囊、等宽圆角区块和悬停弹出层，全部按用户反馈改掉或删掉）。行与消息列同宽（`min(var(--dsh-chat-content-width, 100%), 100%)`），样式照宿主折叠轮次行（TurnProcessNodeView）：无底色块、`border-bottom: 0.5px solid var(--dsw-alias-border-l2)`、正文字号、单行省略；唯一例外是行底加 `--dsw-alias-bg-base`——悬浮行必须有一层页面底色才能遮住身后的滚动正文，否则文字叠文字不可读。文字比宿主折叠行加深两档（用户先要求「字体样式加深一下」，2026-10-15 看到深色截图后又说「顶部那个太不明显了」）：常态 `--dsw-alias-label-primary-dimmed`（宿主折叠行常态是 tertiary、悬停才到 secondary），悬停 `--dsw-alias-label-primary`，箭头继承行色；`font-weight: 600` 加粗（用户接着说「加粗吧」），**必须写在 `font: inherit` 之后**——shorthand 会把字重重置回继承的 400，`tests/client.mjs` 有这条顺序断言；内容右对齐（用户再说「改成右对齐吧」）：`justify-content: flex-end` 让箭头与文字作为一个整体贴住消息列右端，**行本身仍是满宽**——`.chip` 的 `width: min(var(--dsh-chat-content-width, 100%), 100%)` 与那条 0.5px 分割线都不跟着缩，`text-overflow: ellipsis` 仍按 `min-width: 0` 正常截断，测试里两条一起断言；**垂直居中于行高**（用户看到截图后指出「是字体在行高的居中」）：`.chip` 的 `padding: 0`（宿主折叠行那份 `padding: 0 0 8px` 不能照抄——宿主那行是内联的，8px 只是让文字别贴住分割线，这里是悬浮行，同样的 pad 会把文字顶到行中线上方 4px，看起来「下面空一倍」），居中交给 `align-items: center`，行高比 33px 基准高时（`--dsh-content-font-delta` 为正，实测用户环境 +8.5px）依然成立；点击与向上按钮落同一点（24px 缩进 + scroll/scrollend 交付）。**没有悬停弹出层**，整行就是全部内容。**只显示一个**——目标就是 `nearestPromptAbove` 给出的最近一轮开头，绝不按轮嵌套。行内文字由 `promptPreviewText` 克隆行后剥掉 `[data-clock]` 与 `[data-message-attachments]` 得到；行内没有文字时回退读附件的 `title`/`alt` 名称，仍为空时才显示字典兜底「本轮提问」。

定位portal 的宿主结构依赖有二，均已核对安装版 0.2.0-rc.2：Chat frame 是 `position: relative; display: flex; flex-direction: column`，`.slot` 借 `order: -1` 排到最前（sticky 的自然位置必须在 frame 顶部，portal 只能追加在末尾）；宿主用户行带 `data-clock`（图标动作行）与 `data-message-attachments`（附件胶囊），行内文字据此剥壳。frame 改掉 flex 列或换掉这两个属性时，行会退化成停在 frame 底部或文字混入时间——先核对再改。独立（无 `[data-conversation-scroll]`）聊天里 sticky 同样成立。

开关是新的 volatile 字段 `sessionStartChipEnabled`（默认 `true`）：行为照「环境开关不要挡在注册前面」的旧规——插槽条目照常注册，关闭只让组件返回 `null`，重开立即恢复；旧宿主 schema 缺字段时该行显示 `stale` 并禁用开关，但功能按默认开启生效，重启宿主后开关才可写。`tests/client.mjs` 覆盖注册（dock/order 102/共享快照）、开关、行内文字剥壳与附件名回退、点击落点与 sticky/order/无底色块的样式回归；`npm run test:scroll` 的浏览器回归在 393px/桌面断言行框内、点击落点与轨迹清理。

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
