---
paths:
  - "src/settings.ts"
  - "src/brand-assets.ts"
  - "src/update-check.ts"
  - "src/serve.ts"
  - "src/client/BeautifySection.tsx"
  - "src/client/BeautifySection.module.css"
  - "src/client/SettingRow.module.css"
  - "src/client/settings-controller.ts"
  - "src/client/SaveNote.tsx"
  - "src/client/FeatureToggleRows.tsx"
  - "src/client/feature-switch.ts"
  - "src/client/BrandRows.tsx"
  - "src/client/branding.tsx"
  - "src/client/tagline.ts"
  - "src/client/MotionRow.tsx"
  - "src/client/UpdateVersionRow.tsx"
  - "src/client/UpdateVersionRow.module.css"
  - "src/client/update-check.ts"
  - "src/client/desktop-update.ts"
  - "src/client/locales.ts"
  - "locale/**"
  - "tests/ui-copy.test.mjs"
  - "tests/settings-layout.test.mjs"
  - "tests/settings-layout-browser.test.mjs"
  - "tests/feature-switch.test.mjs"
  - "tests/brand.mjs"
  - "tests/update-check.test.mjs"
  - "tests/http.mjs"
  - "tests/smoke.mjs"
---

> 覆盖什么、何时读：本文件覆盖设置页的字段与可配项、配置写在哪个文件、设置文案约定、单项保存反馈与请求去重、以及「界面增强」的五个功能开关；当你需要改设置页、加设置字段或改设置文案时读它。

# 设置页与功能开关

## 设置与可配项

插件注册一个 `settings.section`（id `ui-beautify`，order 40），在「设置 → 界面美化」页面显示正文字体、代码字体、输入框动效、PC 端快捷回复开关、界面增强四项与品牌四项。`BeautifySection` 的各行复用 `SettingsController` 的一份快照；快捷回复内容编辑行**暂时不挂载**（见「短语是可自定义的」），显示开关则已独立挂载。

快捷回复的字段与 dock 的读取逻辑照旧，只是暂时没有 UI 去写它——要自定义就手改 profile 补丁里的 `quickReplies`；要恢复设置行，把 `<QuickReplyRow {...props} />` 加回动效行之后即可。

品牌四项在它之后。`logo` 对应空白会话页标志，`brandIcon` 和 `brandName` 对应侧栏左上角，`tagline` 对应空白会话页标语。图片通过 `POST /plugins/dsh-ui-beautify/brand/upload/{logo|brandIcon}` 上传，限 2 MB 的 PNG/JPEG/WebP/GIF，按内容哈希保存到 `$DSH_HOME/assets/ui-beautify`，由同一路由下的 `assets/<sha>.<ext>` 读取。设置中仅保存图片 URL；留空时不注册品牌插槽，宿主默认内容继续显示。自定义侧栏插槽使用 priority -1 覆盖官方插件的 priority 0。标语当前由宿主组件直接渲染、无插槽；客户端以 DOM 观察同步可见文案，清空后恢复宿主文案。Electron 安装版的原生首次引导不加载浏览器插件。

选择写进**当前 profile 的配置文件** `$DSH_HOME/profiles/<profile>/cordis.patch.yml` 里 `ui-beautify` 行的 `config`（`font` / `codeFont` / `motion` / `quickReplies` / `quickRepliesEnabled` / `scrollToPromptEnabled` / `sessionStartChipEnabled` / `mobileLayoutEnabled` / `recentSessionsEnabled` / `remoteSettingsEnabled` / `logo` / `brandIcon` / `brandName` / `tagline`），改完立即生效、无需重启。新增字段在宿主仍跑着旧 schema 时会显示旧版本提示并禁用；重启 dsh 即可。

> 更早的 DSH 版本把选择写在 `$DSH_HOME/settings.yaml`；该文件已被 DSH 迁移进 profile 的补丁文件并重命名为 `settings.yaml.imported`。现在手工改设置要改的是 profile 补丁。

`mirrors` 与 `cacheDir` 是这个插件行的**普通配置**（不是设置页里的实时字段）：它们在宿主启动时读一次，改完要重启宿主。写在 profile 的 `cordis.patch.yml` 或 `~/.dsh/cordis.patch.yml` 的插件行 `config` 下：

```yaml
- id: ui-beautify
  name: '@guowenzhang/dsh-ui-beautify'
  config:
    mirrors:
      - 'https://registry.npmmirror.com/{package}/{version}/files/{path}'
      - 'https://cdn.jsdelivr.net/npm/{package}@{version}/{path}'
    cacheDir: 'D:/dsh-font-cache'   # 留空则用 $DSH_HOME/cache/ui-beautify/fonts
```

模板里的 `{package}` / `{version}` / `{path}` 会被替换（`{path}` 逐段 percent-encode）；换公司内网镜像、加一层代理缓存，都只改这里，不动代码。

`cacheDir` 留空时的解析顺序：`$DSH_HOME`（非空时）→ `~/.dsh`，再拼 `cache/ui-beautify/fonts`。插件自己展开 `~` / `~/` / `~\` 前缀，因为 `@deepseek-ai/dsh-home-paths` 是 harness 内部包，loader 从 profile 解析本插件的 import，那里没装它。填了值就 `resolve()` 成绝对路径，所以**相对路径按宿主进程的 cwd 解析**，不是 profile 目录。

所有用户可配字段都是 volatile；显示开关是 `z.boolean().default(...).volatile()`，各开关默认值见下文各节（多数默认开；「界面精简」组的 `streamlinedUiEnabled`、`hideComposerStats`、`hideModelSelector`、`hideAccessMode` 默认关）：字体、动效、品牌五项是 `z.string().volatile()`，快捷回复是 `z.array(z.string()).volatile()`（默认 `[]`，不写 `.max()`——schema 拒绝一个字段会让整份命名空间回落到上一个好值，超长列表在读取处裁掉，见「短语是可自定义的」）。字体和动效的未知值在读取处回落到默认值，图片地址、短语列表在使用时检查。`mirrors` / `cacheDir` 有默认值但不是 volatile，不出现在设置页。

## 已发布版本行（2026-11-05）

- **位置**：注册进宿主 ui-settings-general 的 `settings.general.item` 列表（id `ui-beautify-update`，order 101）。宿主自己的当前版本行是 order 100，所以这一行总是紧贴在其下方；不要试图把这个数字塞进那一行——它属于宿主。
- **整体对齐**：宿主版本行是 `padding: 16px 0` 包着 22px 单行文字；本行 `margin-top: -38px` 覆盖标题及底部留白，说明 `padding-top: 26px` 预留标题和 4px 间距，让按钮居中于「当前版本＋说明」整个文字块，而不是只对齐说明。按钮不参与收缩，触摸端最小高 44px，说明换行由自然布局撑高。依赖宿主标题单行、22px 行高和16px padding；宿主结构改变或标题换行需要重新测量，不能叠加位移补偿。文案与颜色沿用 `--dsw-font-xxs-12` + `--dsw-alias-label-tertiary`。`browser:update-row` 车道测量真实浏览器盒子；fixture 通过不代表已认证宿主验收通过。
- **数字来源**：桌面壳的更新源，不是 npm、不是写死的地址。Host 半 `src/update-check.ts` 读 `<exe 同级>/resources/app-update.yml`（macOS 为 `Contents/Resources/`），取 `url` 与 `channel`（缺省 `latest`）拼出 `<url>/<channel>.yml`；`config.updateFeedUrl` 非空时优先用它（非 http(s) 视为未配置）。两处都没有就返回 `unavailable`，客户端整行不渲染——**不要为了「总有东西可显示」编一个默认厂商地址**。
- **判定**：`compareVersions` 只承诺符号（semver 预发布规则：数字标识按数值、低于字母标识；带预发布低于同版本正式版；解析不了按相等处理，避免「永远升不了」）。当前版本取 Host 进程的 `DSH_CLIENT_VERSION`（桌面壳启动 Host 时注入），取不到就不报有更新。
- **升级动作**：只调 `window.dshDesktop.updates.open()`，走桌面壳原有检查→下载→重启流程；插件自己**不下载、不安装**。没有该桥（普通浏览器、或 preload 只有 `protocolVersion`）时按钮置灰并带 `updateDesktopOnly` 提示。
- **缓存**：Host 端一次读数复用 `UPDATE_CACHE_MS`（10 分钟），并发请求合并为一次；客户端每次挂载带 `?force=1` 重新读，避免设置页被一小时前的读数回答。响应一律 `cache-control: no-store`，`POST` 返回 405。
- **状态与文案**：`updateLatest`（有小字版本号）/ `updateCurrent`（已是最新）/ `updateChecking`（读取中）/ `updateFailed`（读不到，不能假装是最新）四态都在 `locales.ts`；`tests/client.mjs` 的「the published-release row」段落逐态断言文案、按钮禁用与点击转发。

## 设置文案简化（2026-10-08）

后续截图标注优先于上文历史展示规则：字体缓存行只显示缓存大小／未下载，不显示分片数量或刷新提示；思源黑体说明去掉可变分片细节。各开关说明仅保留功能用途，不重复默认开启、关闭后恢复、独立开关和操作权限说明；远程说明补充解决某些配置在手机端不生效问题。名称输入框的灰字是「当前名称：<宿主实际显示的名称>」，仅为 placeholder，不写入配置、不覆盖已有名称。默认开启与只读等行为不变，旧宿主缺字段提示保留。`tests/ui-copy.test.mjs` 与客户端渲染测试保护这组文案约定。

## 品牌文本行的灰字读宿主实际内容（2026-10-24）

- **灰字不再写死默认文案，也不再回退到固定字符串**：`taglinePlaceholder` 这类静态默认值已删除，`namePlaceholder` 改为带 `{name}` 的格式串。设置值为空时，`host-defaults.ts` 读宿主**已渲染**的内容——标语取 `[class*="_headline"] [class*="_titleGroup"] > span:first-child` 的文本，名称取 `[class*="_brandName"]` 的文本；读不到（该宿主区域未挂载：有消息的会话没有 hero、侧栏收起或名称由 SVG 字标承担）就显示空 placeholder，不显示任何内容。
- **为什么读 DOM**：部署定制版把品牌标语/产品名写在宿主 client bundle 里（构建期常量），既不是配置也不是插槽 owner props，插件没有公开接口可读；渲染结果是唯一能同时覆盖上游版与定制版的实际值。选择器与 `tagline.ts` 写回用的是同一个常量 `HERO_HEADLINE_SELECTOR`，两处必须一起改。
- **读的时机**：`BrandRows.tsx` 的 `useHostHint` 在挂载时读一次，设置变空后再读一次（宿主释放占位后要等它重绘），并用一帧 `requestAnimationFrame` 补读，避免灰字短暂显示刚被清掉的值。`tests/client.mjs` 覆盖「挂载时显示实际文本」「未挂载时不显示内容」两条路径；`tests/settings-layout-browser.test.mjs` 改用 `getByLabel('左上角名称')` 定位输入框，不能再依赖灰字文本。

## 设置行的保存反馈与请求去重（2026-10-16）

- **单项保存有保存中／成功／失败+重试三态**：`SettingsController` 按字段记 `saving|saved|error`，随共享快照发布；`SaveNote.tsx` 渲染在描述行下方（空闲时不渲染，所以没写过的字段仍是原来一行描述）。成功约 2.5 秒后由定时器自行退场，失败保留到重试成功。`retry(key)` 重发该字段上次的尝试值；`writable`/`status` 不允许时 `choose` 不写也不报错。
- **同一手势只发一次写**：`write()` 比较的是「本行最近一次请求的值」而不是 store 里的旧值——写还在飞时 store 尚未追上，按旧值比较会让第二次点击重复提交同一选择。每次尝试带自增 token，只有最新一次结算能改行内状态（后写覆盖前写）。底层顺序写队列、revision fence 与「只有最新结算才发布」都是既有能力，这里补的只是可见反馈。
- **一次缓存读取服务所有调用者**：`readOnce()` 复用在飞 Promise，两个字体行挂载时只发一次 `GET /plugins/dsh-ui-beautify/cache`。延迟重读的触发条件从「任意美化快照变化」收窄为「`font`/`codeFont` 的解析值变化」（`fontChoicesMoved()`）——开关、短语、品牌图变化不再安排一次遍历字体目录并逐项 `stat` 的读取。
- **IME 用宿主 `observeComposition`，不手写 `isComposing`/`keyCode 229`**：`BrandRows.tsx` 的文本行在挂载时安装宿主 guard，Enter 交给 `composition.guards(event.nativeEvent)`（它还覆盖 `compositionend` 之后紧跟的那个关闭键，宿主自己的内联判断看不到这一条）。**失焦不做守卫**：`guards()` 对「刚刚结束的组合」同样返回 true，而候选确认后的失焦正是必须保存完成文本的时刻，套上去会把用户刚确认的字丢掉；宿主 `ui-theme/FontFamilyRow.tsx` 也只在 Enter 上跳过组合状态。文本行**不以保存值为 React `key`**（宿主那份 `key={value}` 会重建输入框、丢草稿与焦点），改为 `ref` + effect，只在输入框未聚焦时同步 store 值。
- **只重装变化角色的字体样式**：`applyFonts` 按角色分别记 `applied` 与 `links`，`moved` 里没有的角色保留原有 `<link>` 节点，浏览器不必重新校验另一角色的样式表；token 层仍是一次 `ctx.theme.overrideTokens`（theme 服务每个来源只保留一层，分两次调用会替换而不是叠加）。
- **只贡献 `settings.section` 的页面不套 960px 内容列**（BASELINE §3.3）：`BeautifySection.module.css` 的 `.page` 用 `container-type: inline-size` + `max-width: 760px`，与宿主 `ui-settings-plugin-inventory` 的 `.section` 一致；`SettingRow.module.css` 的 `@container (max-width: 440px)` 在同一档把行改为纵向堆叠、`.rowText` 右留白从 48px 收到 16px。**容器必须匿名**：CSS Modules（lightningcss）按所在文件给 `container-name` 加哈希前缀，声明在 `BeautifySection.module.css`、查询在 `SettingRow.module.css` 时会变成两个名字（实测产物曾是 `container:VrIHLG_beautify-page/inline-size` vs `@container xrCt8G_beautify-page (width<=440px)`），查询永不匹配、整块规则是死代码——2026-10-16 由另一路浏览器验收发现（task-19），改为匿名后修复。`tests/settings-layout.test.mjs` 现在断言两侧都匿名，`tests/client.mjs` 的产物检查确保构建后仍如此。
  真实浏览器实测（隔离实例 0.2.0-rc.2，端口 61673，Chromium 155）：窗口 **601px** 时 `.page` 内容宽 312–317px、`(max-width: 600px)` 不匹配，`.row` 计算值 `flex-direction: column`、`.rowText` `padding-right: 0px` → 由容器查询接管；窗口 **600px** 时 `.page` 544px、`(max-width: 600px)` 匹配，`.row` 仍 `column` → 由既有手机媒体查询提供（≤600px 行为未变）。`.page` 计算值 `container-name: none` / `container-type: inline-size`。
  `mobile-layout.css` 的手机抽屉仍按窗口宽度与 `data-beautify-mobile-layout` 判，因为宿主抽屉断点本身是视口级的。
- **开关行只有开关本身可点（2026-11-01 用户要求改掉整行可点）**：宿主 `Switch` 固定 36×20，插件不改控件本体，**行容器不挂按下处理器**——点标题、描述或行内空白都不会翻转，桌面与触屏一致；`row-toggle.ts` 已删除，`@media (pointer: coarse)` 不再给开关行 `min-height: 44px` / `cursor: pointer`（那会让整行看起来可点）。代价是手机上开关的点击目标就是 36×20，用户已知并接受。其余行控件（字体下拉、选图按钮、文本输入、重试）仍各自 44px。
- 回归：`tests/client.mjs` 覆盖三态（含重试、失败、退场）、重复点击去重、缓存读取合并与触发收窄、按角色重装（另一角色的 `<link>` 节点身份不变）、**开关行容器无按下处理器**、IME 四条路径（`isComposing`、仅 229、关闭键、普通 Enter）与失焦仍保存、字段不以值为 key；`tests/settings-layout.test.mjs` 与 `tests/recent-sessions.test.mjs` 跟随容器与变量改名。`_team/audit-ui-standard.mjs dsh-ui-beautify` 从 HEAD 的 23 条降到 12 条：11 条是 `mobile-layout.css` / `recent-sessions.css` 覆盖宿主样式所需的 `!important`（标准未禁止），1 条 `token-redefine` 是 `--dsh-composer-side-clearance` —— 它是宿主自己在 `ui-conversation/.../ConversationRoot.module.css:389` 声明、供多处消费的布局变量，就地 rebind 才能生效，改名会直接失效。

## 功能开关（2026-10-08）

- 设置页「界面增强」使用宿主 Switch 显示 `scrollToPromptEnabled`、`sessionStartChipEnabled`、`unreadAnswerStartEnabled`、`mobileLayoutEnabled`、`recentSessionsEnabled`、`remoteSettingsEnabled`，均为默认 true 的 volatile 字段，中英文描述齐全，手机不隐藏。前三项在组件里收窄行为（回到最近提问与会话开始胶囊的开关见各自一节，未读会话落点见 `composer-ui.md`，它的开关释放的是整套状态监听与落点控制器，不是组件），远程一项见下。
- `feature-switch.ts` 等待已存配置，按开关安装／释放；手机适配释放控制器、Pocket shadow 和 CSS，最近对话有独立 `recent-sessions.css` 与插槽生命周期。二者不得相互绑定，关闭最近对话不影响手机抽屉，关闭手机适配不影响最近对话。宿主原生功能不由本插件关闭。开关默认值由 `watchFeature(..., { defaultOn })` 决定：默认 true 的字段缺值算开，默认 false 的字段只有快照明确为 `true` 才算开。
- 远程只读安全边界不变；通过一次脱敏 describe 启动读取获知开关，false 时释放桥接与监听并通知已缓存表单消费者重读宿主快照。远程端在本机开关重新开启后需刷新页面，不保留后台轮询来绕过关闭。本机表单从不装饰。
- `tests/feature-switch.test.mjs` 覆盖冷加载 false、旧配置默认开启、独立生命周期、恢复和清理；构建产物客户端测试覆盖各行控件／写入／缺字段／只读及插槽停用恢复；远程测试覆盖初始关闭与设置事件关闭后的方法、监听器和快照恢复。

## 界面精简开关（2026-10-24）

- 一批原本写进 harness 的定制版「隐藏功能」搬回本插件：`streamlinedUiEnabled`（默认 false、volatile）打开时由 `src/client/streamlined-ui.ts` 在运行时做四件事，关掉或卸载后宿主完全恢复原样。字段默认 false 所以 `watchFeature` 传 `{ defaultOn: false }`：只有快照明确 `true` 才安装，旧宿主没有该字段时不会误删界面。设置页在「界面增强」之后单独一组「界面精简」。
- 三处遮蔽手段各不相同：设置页「打开配置文件」是 `settings.action` 的 list 槽，注册同 id `open-document` + `priority: -10` 返回 null 的组件赢下该格；设置导航的「内置插件」「agent-presets」两个分区**没有可定位的属性**，只能按 `[data-shortcut-modal="settings"] nav button:nth-of-type(N)` 行号隐藏——**选择器不能钉住列表在 nav 里的位置**（0.2.1 把标题当 nav 的第一个 `<div>`、列表第二；0.2.2-alpha 把标题挪到 nav 外面，列表成了唯一子节点，旧的 `nav > div:nth-of-type(2) > button` 在新宿主上一个都不匹配，2026-11-01 另一台 0.2.2 桌面端「关不掉」就是这个原因，行号 6/9 本身是对的）；行号**优先读对话框当前画出来的行**（`hiddenSectionLabels` 从账本取出这两个分区自己的标签，再用 `liveRowNumbers` 在 nav 里按行文本配对），对话框未挂载或标签取不到时才回退到账本序号（`ctx.slots.entries('settings.section')` 取 `id`/`order ?? 0`，升序稳定排序，读的是原始账本而非遮蔽获胜者）；账本订阅与 `watchRowList`（`document.body` 直接子节点 + 该 nav 子树）都会重算。**不能只留账本快照**：账本可能在样式写好之后才变（晚激活的分区、重注册、语言切换），规则就会指到别的页面——2026-11-01 用户报「这两个设置页面关不掉」就是这一类；Agent 预设入口只在 `ctx.configForms.developerTools.enabled` 快照**明确 false** 时遮蔽 `conversation.hero.agentPreset`（single，priority -10 返回 null）与 `conversation.session.header.actions` 的 `agent-preset`（id 遮蔽），并订阅该偏好随开随卸。
- 第四处是**侧栏入口迁入设置导航**（2026-10-26）：侧栏「插件」（`sidebar.panellist` id `plugins`）与「自动化任务」（id `schedules`）两行按与设置导航同一套规则隐藏，选择器是 `[data-slot="sidebar"] > div > nav > button:nth-of-type(N)`——`[data-slot="sidebar"]` 是宿主插槽的稳定锚点（`display:contents`，不进布局），其下第一个 `nav` 就是全局面板列表；每行是 nav 的直接 `button`（`Tooltip` 只额外渲染浮层 `span`，`button:nth-of-type` 不受影响）。行号同样先按 `movedPanelLabels` 的标签配对画面上的行，再回退账本序号；`panellist` 账本变化与列表重画都会重算。同一开关另注册两个 `settings.section`（id `ui-beautify-plugins` order 16、`ui-beautify-schedules` order 21，标签读 `pluginsDestination` / `schedulesDestination`），点这两行时宿主渲染该分区并把 `close` 作为 owner props 传下来；内容组件挂载后先 `ctx.layout.selectPanel(panelId)`，成功才 `close()`——`main` keyed 槽没有对应 key 时不跳也不关，避免把设置页关在旧页面上。
- 宿主客户端比本包旧时可能没有 `configForms.developerTools`：此时只跳过 Agent 预设这一处，其余照常，不能让 `apply()` 抛错把整个插件（含设置页）带下去。导航 CSS 选择器同理只是不匹配，不会报错。
- `tests/streamlined-ui.test.mjs` 覆盖两组行号算法（order 优先、并列保序、缺 order 当 0）、两份 CSS 只含行号与 `display:none`、标签解析（字符串 / thunk / 抛错的 thunk / 非字符串）、按标签定位、**按画面上的行号而非账本快照**（账本已移位时仍隐藏两个目标行）、开关全生命周期（默认关 / 打开 / Coding Tools 开关 / 两个账本变化各自重算 / 关闭与卸载恢复）、迁入行的 id/order/标签与跳转（有 `main` 时选中、缺席时不跳）、旧宿主无偏好时不崩、`Config` 字段默认 false 与中英文案、构建产物含两组选择器与迁移行，并断言 `test` 与 `test:mobile` 链已包含该文件。

## 输入框下方统计开关（2026-10-24）

- 同一「界面精简」组内的第二个独立开关 `hideComposerStats`（默认 false、volatile），由 `src/client/composer-stats.ts` 管理，与 `streamlinedUiEnabled` 互不影响，同样走 `watchFeature(..., { defaultOn: false })`。
- 两个药丸来自宿主 `ui-chat` 注册在 `conversation.composer.dock` 的 list 项，id 分别是 `activity`（order 0，轮次/步数 + 速度）与 `usage`（order 1，Token 消耗 + 缓存命中）：本插件用同 id + `priority: -10` 返回 null 的组件赢下这两格，宿主注册仍在账本上，关掉只释放本插件的影子。不能改隐藏整个 `[data-slot="conversation.composer.dock"]` 包装——本插件自己的快捷回复就注册在这个槽里。
- 上下文占用环没有插槽：`ui-conversation` 的 `InputBar.tsx` 在 `<div data-composer-dock>` 里先 `renderSlot('conversation.composer.dock')`（渲染为 `div[data-slot="conversation.composer.dock"]` 锚点）再直接渲染 `<ContextMeter/>`；`ContextMeter` 根是可空的 `<span>`，内部 `Tooltip` 会 **clone** 而不是包裹子元素，因此该 span 的直接子元素就是 `button[aria-haspopup="dialog"]`，其 svg 里是 track 与 fill 两个 circle。选择器据此写成常量 `CONTEXT_METER_SELECTOR = '[data-composer-dock] > span:has(> button[aria-haspopup="dialog"] svg circle)'`，避开 CSS Module 哈希类名；`composerStatsCss()` 只用常量生成唯一一条 `display: none` 规则，注入 `<style data-plugin-css="@guowenzhang/dsh-ui-beautify/composer-stats.css">`。宿主改 DOM 时最坏只是选择器不匹配（读数继续显示），不会报错。
- `tests/composer-stats.test.mjs` 覆盖选择器常量与「只有一条 display:none、无颜色/尺寸/字号」、开关全生命周期（默认关 / 开→两个影子 + 一条 style / 关→清空 / 卸载→清空并退订）、`Config` 默认 false、中英文案、构建产物含与 `test`/`test:mobile` 链断言；构建产物客户端测试另覆盖该行的默认关、写字段、缺字段提示与只读禁用。

## 隐藏模型与访问模式开关（2026-10-25，默认值 2026-10-26 改为关）

- 用户 2026-10-25 要求「UI美化增加隐藏模型和隐藏授权」：新增两个独立开关 `hideModelSelector`、`hideAccessMode`（volatile），由 `src/client/composer-seats.ts` 管理，设置页放在「界面精简」组、统计开关之后。**当时默认开**；2026-10-26 用户改为「默认都是关、不进行隐藏，需要用户手动隐藏」，因此两处默认值、设置页投影（`=== true`）与 `watchFeature` 的 `{ defaultOn: false }` 都是关的语义：新装或旧配置缺字段时保留宿主原本的模型选择器与访问模式，只有用户手动打开某一行才隐藏对应座位，`/model` 与 `/permission` 命令始终可用。
- 两个座位是宿主的 `single` 槽：`conversation.input.model`（`dsh-client-ui-model-selection` 注册）与 `conversation.input.permission`（`dsh-client-ui-permission-presets` 注册）。single 槽一格只渲染优先级最低的注册，同优先级再注册会抛错；本插件用 `priority: -10` + 返回 null 的组件赢下格子，宿主注册仍在账本上，关开关只释放影子。不要改成用 `[data-slot=...]` 的 CSS 隐藏：`renderSlot` 的锚点在两种状态下都在，只有宿主座位真的被替换才算隐藏（真实验收里 `anchor` 存在但 `button` 数为 0）。
- 两个 `watchFeature` 各自独立，都传 `{ defaultOn: false }`（默认关；旧宿主 schema 缺字段时不安装影子），互不释放；`ctx.slots.inject` 等宿主的槽声明出现后再注册，旧宿主没有这两个槽时静默等待，不抛错。改宿主槽名或 kind 前先核对 `dsh-client-ui-conversation` 的 `SlotMap` 类型再改常量。
- `tests/hide-composer-seats.test.mjs` 覆盖常量与优先级、默认关冷启动不安装影子、冷加载等待、各自释放/恢复、卸载退订、单座位影子、`Config` 默认 false 与可开启、中英文案（含 /model /permission）、构建产物含字段与槽名；`tests/client.mjs` 覆盖两行的默认关、文案、写字段、缺字段提示、只读禁用，以及运行时「默认无影子 → 打开模型只遮蔽模型 → 两个都开遮蔽两个 → 关掉恢复」；`tests/smoke.mjs` 与 `tests/ui-copy.test.mjs` 同步字段与文案约束。

## 隐藏侧栏标志与名称开关（2026-11-05）

- 用户 2026-11-05 要求「UI美化插件增加开关，隐藏这个 logo 和描述」，截图圈的是侧栏左上角的标志与产品名。新增独立开关 `hideSidebarBrand`（默认 false、volatile），设置页放在「界面精简」组、访问模式之后，由 `src/client/sidebar-brand.ts` 管理，走 `watchFeature(..., { defaultOn: false })`：只有快照明确 `true` 才装样式表。
- **为什么用 CSS 而不是影子插槽**：标志（`sidebar.brand.mark`）与名称（`sidebar.brand.name`）两个 single 槽被宿主包在同一个容器里——`ui-sidebar` 的 `SidebarRoot` 渲染 `.logoRow > .brand`（`.brand` 只在展开态出现，收起轨道没有），而这个容器同时是「新会话」快捷入口（`flex: 1`，铺满整行）。只把两个槽影成 null 会留下一条看不见的整行点击区，所以开关隐藏的是容器本身：同一行的折叠按钮与下方的「新会话」按钮位置不变，关掉开关即恢复宿主自己的标志、名称与点击目标。
- 选择器是 `[data-slot="sidebar"] [class*="_logoRow"] > [class*="_brand"]`：`[data-slot="sidebar"]` 是宿主插槽的稳定锚点（`display: contents`），`_logoRow` / `_brand` 是 CSS Module 生成的 `<hash>_<name>` 类名片段（与 `host-defaults.ts` 的 `[class*="_brandName"]` 同一套判定）；`brandMark` / `brandName` 是 `.brand` 的孙子节点，不会被直接子选择器误伤。宿主改结构时最坏只是选择器不匹配（品牌继续显示），不会隐藏别的元素。
- 样式表用 `style[data-plugin-css="@guowenzhang/dsh-ui-beautify/sidebar-brand.css"]` 标记，只有一条 `display: none` 规则——不带颜色、尺寸、字号，也不碰同一行的折叠按钮。自定义品牌图（`brandIcon` / `brandName` 槽）同样在这个容器里，所以开关一并生效；清空品牌值与这个开关互不依赖。
- `tests/hide-sidebar-brand.test.mjs` 覆盖选择器与「只有一条 display:none、无颜色/尺寸」、开关全生命周期（默认关 / 开→一条 style / 重复开不叠加 / 关→移除 / 卸载→移除并退订）、`Config` 默认 false 与 volatile、中英文案、构建产物含字段与选择器片段、`test`/`test:mobile` 链断言；`tests/client.mjs` 覆盖该行默认关、文案、写字段、缺字段提示、只读禁用与运行时样式表安装/释放，`tests/smoke.mjs` 与 `tests/ui-copy.test.mjs` 同步字段与文案约束。
- 真实验收（隔离实例 0.2.1-rc.5、端口 52836、web profile、Chromium）：打开开关后 `.brand` 计算值 `display: none`、尺寸 0×0，`.logoRow` 仍 256×60、折叠按钮 28×28 在原位（x239/y22），「新会话」38px 高按钮仍在 y70；刷新后仍隐藏（值已写入 profile 补丁）；把值改回 false 后规则消失、`.brand` 恢复 `display: flex`、216×24。**未单独验证**：桌面壳的 `[data-windows-titlebar]` 变体（DOM 相同、仅行高与按钮定位不同）与收起轨道（该态不渲染 `.brand`，右上角收起位里的鲸鱼标不受影响）。

## 上下文进度圈开关（2026-10-24）

- 第三个独立开关 `contextRingEnabled`（默认 **true**、volatile，走 `watchFeature` 默认语义：缺字段按开），在「界面增强」组第二行。它把上下文占用画成输入框主按钮（发送/中断共用，34×34）外圈的 2px 进度环，是上面统计开关隐藏读数后的替代读数；两个开关互不影响。组件本身的 DOM/CSS 细节见 `composer-ui.md`。
- `tests/context-ring.test.mjs` 覆盖占用公式（projected 优先、`??` 保留 0、四舍五入、封顶 100、缺窗口/分子为 null）、CSS 只含主题 token 且 mask 双写、标记/换按钮/清除的标记逻辑、插槽注册与 watchFeature 的源码级断言、`Config` 默认 true、中英文案、构建产物含与 test 链断言；构建产物客户端测试覆盖该行默认开、写字段、缺字段提示与只读禁用。
