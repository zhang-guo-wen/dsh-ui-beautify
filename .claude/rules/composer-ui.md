---
paths:
  - "src/motion.ts"
  - "src/client/LightBeam.tsx"
  - "src/client/LightBeam.module.css"
  - "src/client/follow-output.ts"
  - "src/client/output-rate.ts"
  - "src/client/scroll-to-prompt.ts"
  - "src/client/ScrollToPrompt.tsx"
  - "src/client/ScrollToPrompt.module.css"
  - "src/client/SessionStartChip.tsx"
  - "src/client/SessionStartChip.module.css"
  - "src/client/context-ring.ts"
  - "src/client/ContextRing.tsx"
  - "src/client/composer-stats.ts"
  - "src/client/answer-start.ts"
  - "src/client/unread-entry.ts"
  - "src/client/unread-answer-start.ts"
  - "tests/output-rate.test.mjs"
  - "tests/scroll-to-prompt.test.mjs"
  - "tests/scroll-to-prompt-browser.test.mjs"
  - "tests/context-ring.test.mjs"
  - "tests/composer-stats.test.mjs"
  - "tests/unread-answer-start.test.mjs"
---

> 覆盖什么、何时读：本文件覆盖 composer 上方的光柱（含已被替代的骑车道历史实现）、回到最近提问、会话开始胶囊、未读会话落点与 composer 下方的快捷回复；当你需要改动 composer 上下任何一件界面元素时读它。

# composer 界面元素

## composer 上方的光柱（2026-10-08）

当前实现为 `LightBeam.tsx` + `LightBeam.module.css`，已删除旧 BikeLane 源码。光柱固定 1px，改用宿主 `conversation.input.overlay` 的零高度绝对定位锚点，直接覆盖输入框上边框，不占行、不加 margin/gap，不修改宿主布局；仅保留光柱，无底轨和外扩光晕。保留 `ui-beautify-lane` / order 100；设置页只有默认开启的宿主 Switch，沿用 `motion` 字符串字段写入 `always`／`off`，不新增字段。旧 `system` 或未设置归一化为开启，已存 `off` 保持关闭；删除三选一和浏览器 reduced-motion 分支。不要新增粗细或速度配置。使用宿主主题主色；速度是**对数曲线** `0.65 * log2(1 + rate / 60)` 行程／秒，rate 为**估算 token/秒**（CJK 字符 ≈ 1 token，其他字符 ≈ 0.3 token；见 `follow-output.ts` 的 `estimateTokens`），`0.35` 秒指数平滑，停止后 `2.5` 秒线性减速至静止，空闲保持可见悬浮，不淡出；仅关闭开关时隐藏。若停在行程裁剪区，将光柱停靠最近可见边缘，避免无输出时看不见。位置保存为比例，头尾在容器外换行，背景标签恢复时单帧 dt 最大 0.1 秒。React 只采样，rAF 写 transform，关闭／卸载取消 rAF。`tests/output-rate.test.mjs` 覆盖速度曲线（含 200 与 500 token/s 两档明显分开、每次翻倍都可见）和采样；客户端产物测试覆盖固定 1px／零布局占位、无单车 SVG、空闲可见静止、流动、减速停靠、可见区域无跳跃、默认开启的 always/off 开关、token 估算，以及 `assistantOutputTokens` hook。

**2026-10-19 观感校准，最终落在「估算 token + 对数曲线」。** 用户先报「200 多和 500 多感觉差不多」，随后给出真实带宽：模型输出常见 50/80/120/200/250/300/400/500 token/s，很少超过 1000。曾试过双曲 `3.4·r/(r+900)`（r 为字符/秒），但字符与 token 不同量纲，且双曲曲线在高位压平；**8 秒滑行是「两档看着一样」的最大头**——实际写作是「一串分片 → 停顿」，大部分时间看到的是上一次速度在滑行。现在：读数改为**估算 token/秒**（`estimateTokens`：CJK ≈ 1、其他 ≈ 0.3），速度用对数 `0.65·log2(1 + r/60)`，平滑 0.35 秒、滑行 2.5 秒。50/120/200/300/500/1000 分别约 0.57/1.03/1.37/1.68/2.09/2.69 行程/秒——整个常用带宽摊开约 3.7 倍，每次翻倍都看得出来。再调时只动 `SPEED_REFERENCE`、`SPANS_PER_DOUBLING`、平滑与滑行四个常量，并同步 `tests/output-rate.test.mjs` 与 `tests/client.mjs` 里的 `3.4 *` 上界与 token 估算断言。

**速度读数来自 `follow-output.ts`，不再读 Chat 的 `legacy.partial`（2026-10-19）。** Chat 目标在运行中的 step 还没有可见块时会把 `legacy.partial` 置空——也就是思考（reasoning）和工具参数还没结束、第一个回答文字还没出现的大部分时间——所以「AI 一直在工作但光柱不动」是读数的空档，不是动画坏了；而 `conversation.input.overlay` 也拿不到 Chat 钩子（该插槽不声明 `useChat`）。现在的读数由本插件 register 的 Session 钩子 `assistantOutputTokens` 提供：`uiSession.provide({ hooks: ['assistantOutputTokens'], resolve })`，每个 Session binding 一个源，用**钝化式（fresh-snapshot）订阅** `binding.eventSource`，每次通知读**最新快照**的 `change.entries`（`change.kind === 'append'`）——不能用 `{ event: change.event }` 这类写法，快照里没有单数 `event` 字段，那会让计数恒为 0。只数 `assistant/live-chunk` 里 `text-delta` 与 `reasoning-delta` 的 `text`（按 `estimateTokens` 换算，累计、只增不减）；`assistant/message` 不计入，因为它的文字已经流式计过。已核对安装版 0.2.1 宿主：`dsh-api-session-controller/lib/client.js` 把实时分片以 `assistant/live-chunk` 经 `eventSource.append()` 发布，抽出的 `entry.event` 落在 `change.entries` 的 `{ event }` 上——宿主自己的 Chat 行也读这份数据，所以只要会话里能看到文字，这个钩子就该同一时刻看到分片。

**席位是标准 props，不要塞进条目 inject。** `ui-renderer` 的 `runInject()` 返回值会被 `bindInjectSources()` 解构 `{ hooks, keyedHooks, ...rest }`，`hooks` 被**整体吃掉**：某条目自己提供的 `inject().hooks` 不会变成组件 prop。Session 钩子由 `uiSession.provide` 注册、经 `standardKit` 绑定，所有 session 作用域条目（含 overlay）自动拿到 `useAssistantOutputChars`，且它是**选择器钩子**，必须传选择器（`useAssistantOutputChars(v => v)`）；无参调用会在渲染期抛 `selector is not a function`，插槽条目崩掉。`LightBeamProps` 仍把它声明为可选、缺失时按 0 处理并照常渲染，`tests/client.mjs` 有「a missing output seat still draws the lane, at rest」钉住这条。

**2026-10-19 两次事故的根因（务必保留）：**
1. **`uiSession` 必须写进本插件的 `inject` 数组。** 之前用 `ctx.get('uiSession')` 却没声明依赖，插件 `apply` 在 ui-session 尚未激活时执行，`undefined.provide` 抛 TypeError，`ui-beautify: failed` 直接让整个 web 启动失败（桌面端表现为“启动失败 / UI 整块消失”）。声明后纤维会等到服务就绪。诊断方法：隔离实例（`tool/testing/isolate.mjs` + `npx dsh web`）会打印带 token 的 URL，用无头 Edge 打开就能读到渲染进程真实堆栈；桌面端自己的 boot 日志在 `%APPDATA%\arcuchi-harness\logs\crash-*-web-boot.log`，只报「哪个 entry 没激活」，不报堆栈。
2. **`uiSession.provide` 的 resolver 绝不能抛错。** 它会在*所有* descriptor 的 materialize 里被调用；抛错会连带让触发重建的插件（当时是 `@deepseek-ai/dsh-client-ui-chat`）激活失败，于是整个聊天区（含输入框与光柱）消失。现在 binding 缺 `eventSource` 时退回 `ZERO_SOURCE`（读数恒 0），不抛错。
3. 因此“光柱不动”和“光柱/聊天区消失”是两件事：前者是读数源选错（见上），后者是激活期抛错。排查先看 `document.querySelectorAll('[data-beautify-light-lane]').length`：0 表示条目没渲染（激活或渲染崩），1 才是动效问题。

排障入口：控制台 `document.querySelectorAll('[data-beautify-light-lane]').length` 区分「插件没加载（0）/ 在跑（1）」，`window.__ModuleLoader__` 是否存在的检查只适用于 web 端，桌面端不是同一种引导方式。绑定类型由 `ctx.get('uiSession')` 与本地 `BindingEvents` 窄接口描述（本包不依赖 `dsh-api-session-controller`）。改这一段时同步 `tests/client.mjs` 的「the lane reads streamed output from a Session hook」一节，它用假的 `uiSession.provide` 与事件源验证 reasoning 计数、非输出事件忽略、每次计数唤醒一次、`assistant/message` 不重复计、每个 binding 复用同一源、释放后取消订阅；`eventChars` / `createOutputCharsSource` 也从 `lib/client.js` 导出供产物级测试直接调用。

### 历史骑车道实现（已由光柱替代，仅供历史参考）

composer 卡片正上方那条整宽插槽是 `conversation.input.dock`（ui-conversation 声明，`kind: 'list'`、`scope: 'session'`），本插件在其中注册 `ui-beautify-lane`（order **100**）。同一插槽的既有占用者是 queue（20）、todo（0）与 goal，100 让小人排在它们之后、紧贴卡片。

**速度读的是 `assistantOutputTokens`（`follow-output.ts`），不是 `sessionStats`，也不再是 `legacy.partial`。** `sessionStats` 的 `decodeTokens` / `decodeMs` 在 `assistant/message` 才结算，一个 step 只有一个读数——那正是「刚才那一段有多快」，而动画要的是「此刻写多快」。`legacy.partial` 曾是唯一出口，但它在运行中的 step 还没有可见块时为空（思考与工具参数期间多半如此），于是 AI 在工作而光柱不动；Session 事件流则从第一个分片起就在推进。当前读数与带宽校准见上文光柱一节。

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

`src/client/output-rate.ts` 里的观感常量是设计值，不是配置项。**没有输出就没有位移**：`laneSpeed(0) === 0`，不会低速空转。曲线在半速点（1500 字符/秒）以下近似线性、之上饱和，所以更快的输出永远还能再快一点，快速流不会和「稍快一点」看起来一模一样。

**四个细节都是为了动作连续，改之前先读它们的注释：**

- `charsPerSecond` 的**分母是样本窗口自身的跨度，不是 `now`**。跑到 `now` 看着无害，其实每两次分片之间读数都在衰减、分片一到又猛跳——看起来就是一顿一顿的，正是要避免的卡顿。流是否停下的判断交给另一条规则：最新样本比窗口还旧就**精确返回 0**。
- 还有输出时，帧循环对速度做**指数缓动**（`SPEED_EASE_SECONDS`，帧率无关的 `1 - exp(-dt/τ)`）。逐分片的读数是阶梯状的，不缓动就是跳到每个新值。
- 输出停下后**不走这条缓动**：保持当时的速度，按 `COAST_SECONDS`（8 秒）**线性**减到 0。走缓动会在一秒内停住，那是急刹；滑行 8 秒才是「停下来」而不是「断掉」。
- **位置按比例记，不按像素。** `MotionState.progress` 是行程的分数（0..1），像素 x 由它算出。按像素记时 `clientWidth` 每帧现读，车道**一变窄**（滚动条出现、侧栏折叠、卡片宽度变化）就会提前取模——车凭空跳回左边，看起来就是「重置」。行程比车道两端各多一个车宽，所以换行发生在画面外、看不见。

`MotionState` 放在 `useRef` 里而不是 effect 闭包内：effect 一旦重跑（`animate` 翻转、子树重挂），闭包里的状态就归零，车会从起点重新出发。

`BikeLane.module.css` 的 36×20px 与 `BikeLane.tsx` 的 `BIKE_WIDTH_PX` / `BIKE_HEIGHT_PX` **必须一致**——轮半径由它们推出，而且盒子的宽高比与画布并不完全相同，所以缩放取两者较小的那个比值，否则车轮会与地面打滑。描边宽度按**渲染后的像素**定，所以图越小、viewBox 里的描边要越粗，否则缩到 20px 会淡成一片灰。

`.lane` 用 `margin-bottom: calc(2px - var(--dsh-composer-stack-gap, 6px))` 把 `composerStack` 的 6px 行距吃掉大半：小人要看起来**坐在输入框上**，而不是和下方面板一样属于上方那组卡片。留 2px 免得贴死。用变量而不是写死 -4px，是为了 stack 行距变了这里跟着变。

## 回到最近提问（2026-10-15 起逐轮向上跳）

`ScrollToPrompt.tsx` 在 `conversation.input.dock` 注册零高度定位锚点，通过 portal 把向上按钮放入当前 Chat frame，保持宿主向下按钮不变。按钮复用宿主 Button、向上图标与 floating token，位于向下按钮左侧 42px。**2026-10-15 用户把目标从「最近一条提问」改成逐轮向上**：目标一律是「当前视口上方最近的一条可见 `user` / `steering` 已发送消息」——也就是读者正处的那一轮的开头；跳过去后（**可视顶部**下 24px 阅读缩进；会话开始行可见时可视顶部是它底边，见「浮动行与跳转落点」）下一次点击落到再上一轮，连续点击逐轮走回更早的对话。`nearestPromptAbove(flow, scroller)` 是这一判据的唯一实现，按钮与胶囊共用；切到没有可见提问（如空会话、或已停在最早一轮）时隐藏。不跳到整个历史开头、不读取草稿。滚动后立即交付 scroll/scrollend，让宿主结束读者位置采样、停止追随输出；切换轨迹视图或卸载时释放 portal、滚动监听与观察器。

设置页「界面增强」第一行是它的开关：`scrollToPromptEnabled`（默认 `true` 的 volatile 字段）。注册时带上 `inject: () => controller.inject()`，组件读同一份设置快照；关闭时组件返回 `null`（**插槽条目照常注册**，否则重开就没法恢复），定位 effect 以该开关为依赖重跑——关着的时候没有锚点，重新打开必须重新定位，否则按钮再也不会出现。新增字段需要宿主重启一次，旧 schema 会把这一行显示成 `stale`。

`npm run test:scroll` 覆盖逐轮定位与空白/隐藏消息；真实浏览器回归设置 `DSH_SCROLL_URL`、`DSH_SCROLL_WORKSPACE`、`DSH_SCROLL_SESSION`，选择已有长对话，隔离测试浏览器仅替换本次 client bundle 响应，不覆盖正在使用的插件目录。验收包括向上/原向下、393px/桌面、浅色/深色、轨迹切换清理（按钮与胶囊都清掉），以及关掉开关后按钮消失、重开立即恢复。

## 会话开始胶囊（2026-10-15）

`SessionStartChip.tsx` 与向上按钮同在 `conversation.input.dock`（`ui-beautify-session-start`，order **102**），是 IDEA 折叠标记的对话版：当读者所在那轮的开头滚出视口，**一行该轮提问的开头文本**悬浮在 Chat frame 顶部，下方一条 0.5px 分割线（用户先后明确：「不是显示会话开始一个按钮，是显示简短的一行字」「不要区块，参考 idea，一条线分割就行。且只显示一行」「然后也不需要悬浮显示」；此前依次做过「会话开始」小胶囊、等宽圆角区块和悬停弹出层，全部按用户反馈改掉或删掉）。行与消息列同宽（`min(var(--dsh-chat-content-width, 100%), 100%)`），样式照宿主折叠轮次行（TurnProcessNodeView）：无底色块、`border-bottom: 0.5px solid var(--dsw-alias-border-l2)`、正文字号、单行省略；唯一例外是行底加 `--dsw-alias-bg-base`——悬浮行必须有一层页面底色才能遮住身后的滚动正文，否则文字叠文字不可读。文字比宿主折叠行加深两档（用户先要求「字体样式加深一下」，2026-10-15 看到深色截图后又说「顶部那个太不明显了」）：常态 `--dsw-alias-label-primary-dimmed`（宿主折叠行常态是 tertiary、悬停才到 secondary），悬停 `--dsw-alias-label-primary`，箭头继承行色；`font-weight: 600` 加粗（用户接着说「加粗吧」），**必须写在 `font: inherit` 之后**——shorthand 会把字重重置回继承的 400，`tests/client.mjs` 有这条顺序断言；内容右对齐（用户再说「改成右对齐吧」）：`justify-content: flex-end` 让箭头与文字作为一个整体贴住消息列右端，**行本身仍是满宽**——`.chip` 的 `width: min(var(--dsh-chat-content-width, 100%), 100%)` 与那条 0.5px 分割线都不跟着缩，`text-overflow: ellipsis` 仍按 `min-width: 0` 正常截断，测试里两条一起断言；**垂直居中于行高**（用户看到截图后指出「是字体在行高的居中」）：`.chip` 的 `padding: 0`（宿主折叠行那份 `padding: 0 0 8px` 不能照抄——宿主那行是内联的，8px 只是让文字别贴住分割线，这里是悬浮行，同样的 pad 会把文字顶到行中线上方 4px，看起来「下面空一倍」），居中交给 `align-items: center`，行高比 33px 基准高时（`--dsh-content-font-delta` 为正，实测用户环境 +8.5px）依然成立；点击与向上按钮落同一点（**可视顶部**下 24px 缩进 + scroll/scrollend 交付；可视顶部即本行底边，见「浮动行与跳转落点」）。**没有悬停弹出层**，整行就是全部内容。**只显示一个**——目标就是 `nearestPromptAbove` 给出的最近一轮开头，绝不按轮嵌套。行内文字由 `promptPreviewText` 克隆行后剥掉 `[data-clock]` 与 `[data-message-attachments]` 得到；行内没有文字时回退读附件的 `title`/`alt` 名称，仍为空时才显示字典兜底「本轮提问」。

定位portal 的宿主结构依赖有二，均已核对安装版 0.2.0-rc.2：Chat frame 是 `position: relative; display: flex; flex-direction: column`，`.slot` 借 `order: -1` 排到最前（sticky 的自然位置必须在 frame 顶部，portal 只能追加在末尾）；宿主用户行带 `data-clock`（图标动作行）与 `data-message-attachments`（附件胶囊），行内文字据此剥壳。frame 改掉 flex 列或换掉这两个属性时，行会退化成停在 frame 底部或文字混入时间——先核对再改。独立（无 `[data-conversation-scroll]`）聊天里 sticky 同样成立。

开关是新的 volatile 字段 `sessionStartChipEnabled`（默认 `true`）：行为照「环境开关不要挡在注册前面」的旧规——插槽条目照常注册，关闭只让组件返回 `null`，重开立即恢复；旧宿主 schema 缺字段时该行显示 `stale` 并禁用开关，但功能按默认开启生效，重启宿主后开关才可写。`tests/client.mjs` 覆盖注册（dock/order 102/共享快照）、开关、行内文字剥壳与附件名回退、点击落点与 sticky/order/无底色块的样式回归；`npm run test:scroll` 的浏览器回归在 393px/桌面断言行框内、点击落点与轨迹清理。

## 浮动行与跳转落点（2026-10-25）

**问题**：会话开始行（`.slot` 零高度 + sticky，`.chip` 33px 一行）悬在滚动区顶部、盖住身后的正文；向上按钮/胶囊点击与未读回答落点都按「滚动区顶边 + 24px」定位，于是目标行顶部有 `33 − 24 = 9px` 藏在行后面。手机截图里绿色会话打开后「已提交。」首行被切掉 9px 即此。用户原话：「他不是跳转到了会话开始，它被遮挡了一点点。」

**修法**：`src/client/reading-top.ts` 是两条跳转共用的可视顶部定义。`READING_INSET = 24`；`readableTopOf(flow, scroller)` = `max(scroller 顶边, 会话开始行底边)`——行通过 `data-ui-beautify-session-start-line` 标记（slot 本身零高，量它没有意义），行不存在、零高或在滚动区上方时退回滚动区顶边。`scrollToPrompt()` 与 `answerLanding()` 都相对它计算；`AnswerLanding.offset` 语义是「距可视顶部」，落点循环每帧重测，所以**滚动后才出现的行**也会在下一帧被让开（单测钉住 1276 → 1243 的二次校正）。不要改成固定 33px 或 `24 + 33`：行高带 `--dsh-content-font-delta`，且开关关闭时没有这行。

**真实浏览器读数**（隔离实例 0.2.1-rc.2、Chrome 155 headless、393×844；探针 `.scratch/ui-beautify-unread/verify/probe-chip-overlap.mjs`）：修复前 `answerOffset=24`、行高 33、**重叠 +9px**（4cf0773 产物 `6E895CFB`）；修复后 `answerOffset=57`、**重叠 −24px**（产物 `0AA9360B`），控制台无错误。胶囊点击路径用 `tests/scroll-to-prompt-browser.test.mjs` 指向同一隔离实例通过（1280/393 两档：落点不在行后；未贴顶时必须正好位于可视顶部下 24px）。完整读数、截图与未覆盖项登记在 `docs/testing.md` 第 2 节。

## 主按钮上下文进度环（2026-10-24）

把上下文占用画在输入框主按钮（发送／中断共用、34×34、`border-radius: 999px`）外圈，作为「隐藏输入框下方统计」开关之后仍可见的替代读数。开关 `contextRingEnabled`（默认 **true**、volatile，`watchFeature` 默认语义），在「界面增强」第二行；与 `hideComposerStats` 完全独立。

**数据来自 Session 标准 seat `useProjection('contextPressure')`。** `conversation.composer.dock` 是 session 作用域插槽，每个条目自动拿到 `useProjection`；占用公式照抄 `ui-conversation/src/client/context-occupancy.ts`：`used = projectedTokens ?? pressureTokens`（`??` 不能写成 `||`——0 是真实读数），`contextWindow` 缺失或分子缺失时不出环，`percent = min(100, round(used / contextWindow * 100))`。本包安装的 `@deepseek-ai/*`（0.1.7-rc.2）没有声明这个 seat（它由 ui-session 的 `SessionStandardProps` 合并进来），所以 `ContextProjectionSeat` / `ContextPressureProjection` 是本地结构声明，注册时按 `MobileRecentSessions` 先例 `as unknown as SlotComponent<PropsRuntime<...>>` cast——**不要为此新增依赖**。宿主投影键没有时只是拿不到数据、不出环，不抛错。

**DOM 定位**（宿主 master 已核对）：`InputBar.tsx` 的根 `div` 里，`[data-composer-card]` 与 `div[data-composer-dock]` 是兄弟；`conversation.composer.dock` 的条目渲染在 `div[data-slot="conversation.composer.dock"]`（`display:contents`）里，所以锚点 `<span hidden>` 的 `closest('[data-composer-dock]')?.parentElement` 就是 composer 根，根里 `[data-composer-card]` 的**最后一个 `<button>`** 是主按钮（card 里依次是工具栏、模型/模式、可选 stop、最后 primary，Tooltip 只 clone 不包裹，不会多包一层 button）。`markContextRing(root, percent)` 每次同步都重新定位并清理仍带属性的旧按钮，因此宿主重渲染换掉 button 节点时会自动迁移标记；数据缺失、`percent` 为 null、关开关或卸载都会移除属性与自定义属性，按钮恢复宿主原样。Composer 根还用 `MutationObserver(childList + subtree)` 兜底重同步——只观察 childList/子结构，插件自己写的是 attribute，不会自激。

**样式**：注入 `<style data-plugin-css="@guowenzhang/dsh-ui-beautify/context-ring.css">`，`button[data-ui-beautify-context-ring]{position:relative}` + `::before{position:absolute;inset:-3px;border:2px solid transparent;border-radius:999px;background:conic-gradient(...) border-box;mask（padding-box + 全框两层，webkit 写 -webkit-mask-composite: xor，标准写 mask-composite: exclude）;pointer-events:none}`。进度色 `--dsw-alias-state-business-primary`、底环 `--dsw-alias-border-l3`，百分比经 `--ui-beautify-context-ring-percent` 传入；`#000` 只作为 mask 的 alpha 模板，不是绘制颜色。环在按钮边框盒外 3px、粗 2px，不占布局、不接点击；mask 写法需两种方言同时保留。

**回归**：`tests/context-ring.test.mjs` 覆盖公式边界、CSS token/mask 双写、`markContextRing` 的标记/换节点/清除、注册（dock + id `ui-beautify-context-ring` + order 2 + 无 priority）与 watchFeature 的源码断言、`Config` 默认 true、中英文案、产物关键字；`tests/client.mjs` 覆盖该开关行默认开/写字段/缺字段 stale/只读禁用。宿主若改掉 `[data-composer-card]`/`[data-composer-dock]` 或主按钮不再是 card 最后一个 button，环会定位不到（静默不显示，不报错）——改 composer DOM 前先核对这两条。

## 未读会话停在回答开头（2026-10-25）

侧栏给「离开期间跑完」的会话画绿点（宿主 `completionUnread`）。打开这种会话时，宿主先恢复上次阅读位置、没有记录就追随尾部，落点通常是对话底部；本插件改为停在最后一条回答的开头，阅读缩进 24px（与向上按钮同一值；可视顶部含会话开始行，见「浮动行与跳转落点」）。

**触发器是宿主状态的「读掉了」转换，不是点击事件**（`unread-entry.ts`）：`uiSession.sessionStatus` 为每个 Session 发布 `completionUnread`。宿主在两种时机清除这个标记——开始新一轮（快照里 `running: true`）和该会话成为主视图（`running` 为 false）。只有后者是「读者打开了它」，所以 `openedFromUnread(previous, next)` 要求前一份 `completionUnread === true`、后一份不是、且后一份没有在跑。首次发布只建立基线：页面加载时本来就开着的标签不会被移动。这个转换比 React 渲染早（宿主在切主视图的同一份通知里清标记），所以插件记住会话 id，等 DOM 而不是依赖组件挂载。

**等待与落点**（`unread-answer-start.ts`；`createUnreadAnswerStart` 接受注入的 document/clock，供回归测试驱动）：每帧找 `[data-conversation-content][data-conversation-session=<id>]` 中**可见**的那一个（其他会话挂在后面且保留属性），取其 `[data-chat-flow]`，用 `[data-chat-flow-kind="assistant-step"]` 从后往前找最后一条可见回答（跳过 `[hidden]`、无 box 与零高行——折叠的 turn-process 成员由此排除），把它的顶部滚到**可视顶部**（`readableTopOf`：滚动区顶边或会话开始行底边，取较高者）下 24px；连续 `SETTLE_FRAMES` 帧位置保持才收手，让宿主自己的恢复先落地。落点后立即派发 `scroll`/`scrollend`（与向上按钮同一手法）：这是导航不是追随尾部，宿主结束读者位置采样后，后续内容增长不会再把它拉回底部。手势（wheel、在滚动区内的 touchstart/pointerdown、翻页/方向/Home/End/空格键）会取消等待；`LANDING_WINDOW_MS`（2500ms）后无论是否找到都放弃；关开关或卸载同时释放订阅、待执行帧与全部监听器。

**开关**：`unreadAnswerStartEnabled`（默认 **true**、volatile），在「界面增强」组；由 `watchFeature` 安装／释放整套控制器。它**不是**插槽条目，所以不涉及「环境开关不要挡在插槽注册前面」——没有需要保留注册的组件。旧宿主 schema 没有该字段时设置行显示 `stale` 并禁用，但默认开启的行为照常生效，重启宿主后开关才可写。本功能没有 React 组件：它是一次会话级滚动行为，不需要挂件，也不需要 session 插槽。

**宿主 DOM 依赖**（已核对安装版 0.2.1-rc.2 的 client bundle）：`data-conversation-content`、`data-conversation-session`、`data-conversation-scroll` 由 ui-conversation 输出，`data-chat-flow`/`data-chat-flow-kind`/`data-chat-anchor-key` 由 ui-chat 输出。宿主改属性名时最坏是静默不滚（所有读取都守门、不抛错）。轨迹视图没有 `[data-chat-flow]`，此时不落点；之后切回对话也不会补做（等待窗口已过）——刻意不猜用户意图。不要改成按 `data-chat-turn` 找最后一轮：最后一条回答的判据是「最后一条可见 assistant-step」，不是最后一轮的开头。

**回归**：`tests/unread-answer-start.test.mjs` 覆盖转换判定（基线、读掉、开跑、仍在读、删除、顺序）、可见回答筛选、落点几何与顶部截断、等待 DOM、开跑不触发、超时放弃、五类手势取消与两类不取消、卸载清理、稳定帧数，以及 2026-10-25 的浮动行修正（可视顶部三档、带行落点、落点后行才出现时的二次校正）；`tests/client.mjs` 用假 `uiSession.sessionStatus` 驱动「绿点出现 → 打开 → 落到 1276（无行时 24px 缩进）并派发 scroll/scrollend → 不重复 → 关开关释放 → 重开恢复」，并覆盖该开关行的默认开、写字段、缺字段 `stale`、只读与不可用禁用；`tests/smoke.mjs` 钉住 `Config` 的 volatile 与默认值。**真实浏览器验收**（2026-10-25，隔离实例 0.2.1-rc.2、Chrome 155 headless、1440×900、本地假 Messages provider）：默认开时绿点会话打开后回答顶距滚动区顶 24.0px、`nearBottom=1275`、不追随尾部；设置页第 4 行写入 `false` 后同一流程落点 `nearBottom=0`、追随尾部；再写回 `true`；控制台无错误。探针与读数在 `.scratch/ui-beautify-unread/verify/`，证据登记在 `docs/testing.md` 第 1 节；同日的浮动行修正读数与手机 393×844 截图登记在第 2 节（修复前重叠 9px，修复后回答顶在行下 24px）。它依赖假 provider，未并入 `npm test`。

## 隐藏模型与访问模式（2026-10-25，默认值 2026-10-26 改为关）

用户 2026-10-25 要求「UI美化增加隐藏模型和隐藏授权」：输入框底行只留 `+` 和发送键，模型选择与访问模式（完全权限等）不再占位。两行都在「设置 → 界面美化 → 界面精简」组里，开关互相独立，**2026-10-26 起默认关**——需要用户手动打开才隐藏，打开后关掉一行只恢复对应那个座位，`/model` 与 `/permission` 命令始终可切换。实现与字段细节见 `settings.md`。

**宿主契约**：`conversation.input.model` 与 `conversation.input.permission` 都是 `single` 槽（`dsh-client-ui-conversation` 的 SlotMap 声明，`scope: session`），由 `dsh-client-ui-model-selection` 与 `dsh-client-ui-permission-presets` 各注册一个匿名条目（默认 priority 0）。本插件在 `composer-seats.ts` 里用 `ctx.slots.inject(slot, () => ctx.slots.register({ name: slot, priority: -10 }, Suppressed))` 遮蔽：single 槽同一优先级再注册会抛错，低优先级注册赢下格子并渲染 null，宿主条目仍在账本上。**不要改成 `[data-slot="..."] { display: none }`**：`renderSlot` 的锚点一直存在，CSS 隐藏看似生效但影子并未赢得座位；真实验收以「锚点存在、其内 button 数为 0」为判据。

**真实浏览器验收**（2026-10-25，隔离实例 0.2.1-rc.2、Chrome 155 headless、1280×900 与 393×844、独立 DSH_HOME；探针 `.scratch/ui-beautify-unread/verify/probe-hide-seats.mjs`）：全新/旧 profile（无这两个字段）打开页面后，两个 `[data-slot]` 内都没有 host 按钮（model text 空、permission text 空）；设置页「界面精简」组出现两行、`aria-checked=true`；只关「隐藏模型选择」→ 模型座位恢复（按钮文本 `Fake Long Off`）而访问模式仍隐藏；两行都关 → `完全权限` 与模型座位都恢复；刷新后保持恢复态；再把两行打开 → 两个座位重新隐藏。控制台 0 错误。截图：`.scratch/ui-beautify-unread/verify/shots/hide-seats-default.png`（默认隐藏）、`hide-seats-both-restored.png`（宿主座位恢复）、`hide-seats-settings.png`（设置页两行）、`hide-seats-phone.png`（393×844）。单测与产物断言见 `docs/testing.md` 第 3 节。**这组读数对应「默认开」的旧语义**；2026-10-26 默认值改为关后，「全新 profile 两个座位都可见、手动打开才隐藏」的浏览器读数尚未重跑，需按默认关重新验收。探针 `.scratch/ui-beautify-unread/verify/probe-hide-seats.mjs` 与截图目录同前。

**回归**：`tests/hide-composer-seats.test.mjs`（9 项：常量/优先级、默认关、冷加载等待、独立释放与恢复、卸载退订、单座位、Config 默认 false、双语、产物标记）；`tests/client.mjs` 增加两行的默认关/文案/写字段/缺字段/只读与运行时影子生命周期；`tests/smoke.mjs` 与 `tests/ui-copy.test.mjs` 同步字段与文案约束；`package.json` 的 `test`/`test:mobile` 链已加入该文件。
