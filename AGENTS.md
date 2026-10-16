# AGENTS.md

本仓 `dsh-ui-beautify` 是**独立于 harness monorepo** 的 DeepSeek Harness (DSH) 插件：在「设置 → 界面美化」独立页面提供字体、动效、PC 端快捷回复开关与品牌设置（快捷回复的内容编辑行**暂时不挂载**，组件留在仓库里），并给 composer 上下各加一件——上方是光柱，下方是快捷回复标签（内置四条，可经手改配置替换）。
字体**不随包分发**——包里只有 npm 包名、锁定版本与包内样式表路径，字体在首次使用时由 Host 从镜像下载到本机缓存，之后完全离线可用。它不打包 `@deepseek-ai/*`，运行时从宿主 harness 解析这些包。

姊妹插件：[`dsh-web-design`](../dsh-web-design)（在 DSH 侧栏里预览与编辑 HTML）。

仓库根**就是**包（`package.json` 即 `@guowenzhang/dsh-ui-beautify`）：`dsh plugin add <git-url>` 取的是仓库根，包放在 `packages/*` 下会被装成错误的东西。

```
src/                  Host 与两半边共用：params、fonts、motion、quick-replies、source、store、serve、settings、brand-assets、description-*、pdf-worker-compat、index
  client/             浏览器半边：设置页、品牌、字体行、光柱、快捷回复、滚动锚点、会话开始胶囊、手机布局、描述翻译、locales.ts
tests/                smoke / http / client / brand / cdn 等，读 lib/ 产物运行
docs/                 说明文档与 README 截图（images/）；tools/ 是字体探针；locale/ 是随包分发的 nls 文案
lib/                  构建产物（index.mjs host + client.js 浏览器 handoff），**提交进仓库**
cordis.patch.yml      把插件行插进组合的 bundle 层；打包配置为 build-client.mjs / tsdown.config.ts
```

## 构建与测试

```sh
npm install            # 或 npm ci（依据锁文件）
npm run typecheck      # tsc --noEmit -p tsconfig.json
npm run build          # tsdown（host → lib/index.mjs）+ build-client.mjs（→ lib/client.js）
npm test               # 冒烟 + HTTP 层验证（对构建产物运行，不联网）
npm run test:cdn       # 联网：逐字体校验两个镜像、分片与字体族名
npm run probe -- <包>  # 联网：评估一个候选 npm 包能不能当字体用
npm run test:mobile    # 手机布局控制器（可选真实浏览器，设 DSH_MOBILE_URL）
npm run test:scroll    # 回到最近提问（可选真实浏览器，设 DSH_SCROLL_URL）
npm run test:replies   # 快捷回复「一行放不下就少显示几条」（可选真实浏览器，设 DSH_QUICK_REPLY_URL）
```

测试都从 `lib/index.mjs` / `lib/client.js` 读产物，**改完源码先 `npm run build` 再测**。

## 关键硬约束

- **`lib/` 必须随源码一起提交**：它是提交进仓库的构建产物，别人直接从 git 安装；改完源码跑 `npm run build` 并把 `lib/` 一并提交，不要把 `lib/` 落在外面的工作区。
- **不得停止、重启、升级或修改日常 Harness 实例**：真实浏览器验收一律用独立 `DSH_HOME` + npm 发布版的隔离实例（随机高位端口）；不占用日常实例端口、不改它的配置与凭据。认证失败就报告认证条件，**不绕过认证、不改日常实例**。
- **不得写死用户可见文案**：所有可见字符串（含 `aria-label`、`title`、`placeholder`、空态与状态格式化）进本包 `src/client/locales.ts` 的 typed 字典；用户数据、模型输出、代码 token 与协议字段保持原样。**不得写死颜色**：一律取 `--dsw-alias-*` 语义别名，不新写 `#hex`/`rgb()` 字面量、不复制静态调色板值、不写浅色/深色选择器、不覆盖 token，写进 CSS 的 token 必须能在 `ui-theme` 或宿主组件里搜到同名定义或消费点。
- **必须复用宿主控件**：优先用 `@deepseek-ai/dsh-client-ui-primitives` 的 `Button`、`Input`、`Modal`、`Menu`、`SegmentedTabs`、`Tag`、`Toast`、`Switch`、`Tooltip`、`Pill`，不自己仿造；样式写在 `ComponentName.module.css`，用 `clsx` 组合类名，不引入组件库或 Tailwind。更完整的配色、排版、断点、动效、可访问性、性能与验收标准见工作区根 `AGENTS.md` 的「插件 UI 规范」，那是更高权威。
- **不得另装 `dsh-mobile-layout`、复制宿主组件或修改 Harness 源码**：手机布局由本插件的 `mobile-layout.tsx` / `mobile-layout-controller.ts` / `mobile-layout.css` 提供，只复用宿主 `layout.toggleSidebar`、Button 与现有侧栏；右侧栏 `[data-rightbar-col]` 仍归宿主所有，不可替换。
- **环境开关不要挡在插槽注册前面**：关闭只让组件 `return null`，插槽条目照常注册（否则重开无法恢复）；开关放设置页，并在状态行写出「为什么是空的」。
- **两个角色的字体 token 必须在一次 `ctx.theme.overrideTokens(PLUGIN_ID, tokens)` 里给出**——theme 服务每个来源只保留一层，分两次调用会替换而不是叠加。
- **两份字体表的 id 必须全局唯一**（路由按 `anyFaceById`、不区分角色）；`family` 必须与包内样式表的 `font-family` 逐字一致，写错会让所有 `@font-face` 静默匹配不上。
- **改 client 必须硬刷新（Ctrl+F5）或 bump `HANDOFF_ID`**；**重建 `lib/index.mjs` 必须重启宿主**才会换上新 schema（`mirrors` / `cacheDir` 也是启动时读一次）。
- **改 `isServablePath` / `validate()` 等路径与内容校验要同步 `tests/http.mjs` 的 403 / 502 断言**；镜像返回的 200 错误页不得被当成字体缓存下来。
- **`tests/client.mjs` 里没有桩的 bare specifier 会让产物加载即失败**：client 半边新增 import 要同步那份桩表。
- 提交：只暂存本包相关文件，沿用 `chore:` / `feat:` / `fix:` 前缀；推送遵守工作区根 `AGENTS.md` 的时间规则，**不要 push**，除非用户明确要求。

## 详细规则

按需读取下列文件，每个文件第一行都写明覆盖范围与何时该读。

- [rules/fonts.md](rules/fonts.md)：字体表（正文 14 款 / 代码 5 款）、按需分片下载链路与磁盘缓存、`system` 的真实语义、覆盖范围、加一款字体的完整步骤，以及「装了但字体没变」的七步排查——改字体表、下载链路、缓存，或排查字体没生效时读。
- [rules/composer-ui.md](rules/composer-ui.md)：composer 上方的光柱（含已被光柱替代的骑车道历史实现）、回到最近提问、会话开始胶囊、下方快捷回复（开关、槽位模型、「一行放不下就少显示几条」）——动 composer 上下任何一件时读。
- [rules/settings.md](rules/settings.md)：设置页字段与可配项、配置写在哪个文件、设置文案约定、单项保存反馈与请求去重、「界面增强」五个功能开关——改设置页、加字段或改文案时读。
- [rules/mobile-layout.md](rules/mobile-layout.md)：手机布局控制器与最近对话、设置弹窗的手机重排、Pocket 文件复制按钮、右侧栏归属与手机白板触摸层级——动 ≤600px 行为时读。
- [rules/host-integration.md](rules/host-integration.md)：描述翻译（Typert Remote + 批量翻译）、远程设置只读桥接、PDF/Office 手机兼容补丁、`cordis.patch.yml` 组合接线——碰宿主元数据装饰、远程表单、PDF 补丁或插件接线时读。
- [rules/build-release.md](rules/build-release.md)：目录逐文件说明、构建产出、测试清单、部署与生效语义、发版流程、易崩清单、后续可加项、README 截图约定——构建、发布、排障或规划下一步时读。
