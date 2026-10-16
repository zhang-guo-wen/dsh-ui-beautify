---
paths:
  - "src/motion.ts"
  - "src/client/LightBeam.tsx"
  - "src/client/LightBeam.module.css"
  - "src/client/output-rate.ts"
  - "src/client/scroll-to-prompt.ts"
  - "src/client/ScrollToPrompt.tsx"
  - "src/client/ScrollToPrompt.module.css"
  - "src/client/SessionStartChip.tsx"
  - "src/client/SessionStartChip.module.css"
  - "tests/output-rate.test.mjs"
  - "tests/scroll-to-prompt.test.mjs"
  - "tests/scroll-to-prompt-browser.test.mjs"
---

> 覆盖什么、何时读：本文件覆盖 composer 上方的光柱（含已被替代的骑车道历史实现）、回到最近提问、会话开始胶囊与 composer 下方的快捷回复；当你需要改动 composer 上下任何一件界面元素时读它。

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
