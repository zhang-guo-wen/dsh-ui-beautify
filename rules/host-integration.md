本文件覆盖描述翻译（Typert Remote + 批量翻译）、远程设置只读桥接、PDF/Office 手机兼容补丁与 `cordis.patch.yml` 组合接线；当你需要碰宿主元数据装饰、远程表单、PDF 补丁或插件接线时读它。

# 宿主集成与兼容补丁

## 描述翻译（2026-10-08）

- 设置页只有一个「翻译描述」按钮，使用 `agentDefaultModel.currentSelection()` + `llm.stream()` 独立请求，不创建会话、不传工具／历史、不改 skill 注册表或原文件。`uiBeautifyDescriptions` 通过 Typert Remote 接入认证 Gateway；禁止用未认证字体路由调用模型。`@Remote` 必须构建期降级，并保留 `request, signal` 参数名。
- 成功缓存按 kind／id／精确原文哈希／目标语言保存到 `$DSH_HOME/data/ui-beautify/description-translations/v1`。读接口不生成；重复、并发与不同宿主进程用原子 PID+UUID 锁去重。只恢复证实已退出进程的锁，未知锁不猜测删除；失败／超时不写缓存。
- 插件描述仅在公开 `remote.pluginManager.listBundles` 与 `remote.pluginInventory.list` 的返回副本里添加描述语言映射，原元数据、标题与宿主不改。卸载按原 property descriptor 恢复，不通过 Cordis 每次返回的新函数代理比较身份。译文刷新使用原插件页公开 inject face 的 refresh，不复制或 shadow 带 children 的 main 页。
- 斜杠菜单复用原 MenuView，只投影 skill group 描述的只读 observable；Markdown 预览和 SkillRow 附加当前目录的译文摘要，原文件及历史结果保持原样。采用公开 slots priority shadow + 原组件／inject／locale／store，拒绝带 children 的组件。打包宿主 registrant 可能缩写为 mf，需结合精确 cell 和原组件名识别，不能依赖 registrant 包名。
- 翻译目录包括全局已加载 Skill、workspaceRegistry.list() 的所有已登记工作区通过 skills.list({cwd}) 发现的项目 Skill，以及当前会话专属目录；不扫描未登记项目／磁盘。按来源去重，名称和文件分开，工作区读取失败提示。展示 membership 仍按会话和语言隔离，防同名串译。
- 2026-10-08 用户明确改为真正批量：先 lookup 排除缓存，description-batches.ts 按含 system+JSON 的 UTF-8 16 KB 上限拆批，每批一次 llm.stream 返回编号 JSON。translateBatch 先按哈希有序持全部缺项锁、重读缓存，所有编号／数量／译文验证成功才逐项存储；不得回退为每条调用／仅增加并发。UI 显示实际默认提供方／模型／推理档位，以及插件、Skill（全局／Agent）、工作区 Skill 三类已完成／总数。2026-10-08 用户要求去掉批次／字节说明；运行中的同一按钮切成可点击「取消」，用独立 run AbortController 传到 Remote 和模型，取消不销毁页面只读缓存、不删除成功译文，后续点击复用。插件全部相关描述完成才计完成，官方译文也计完成，失败不算完成。已有官方译文不生成，组件描述计入翻译总数但不重复算插件包。每个批次读取默认模型并将实际路由回传；不擅自切低档或其他模型。
- 回归新增 `tests/description-*.test.mjs`：持久化、真实子进程去重、认证 Gateway 401/403、默认模型终止校验、作用域／语言、标题同文不误改、菜单原状态不变、卸载恢复。实际 19387 页面已用临时浏览器响应模拟验证按钮／复用、插件列表和详情、斜杠菜单；模拟已移除。真实默认模型及 skill 预览／调用卡片的全流程仍需重载当前宿主后验收，不得把模拟通过表述成真实翻译已生效。

## 远程设置只读（`remote-settings.ts`，原「目录」小节条目）

- `remote-settings.ts` 只在 `remote.$host.isLoopback=false` 的页面装饰共用 configForms 的公开读取方法和已缓存表单，使用现有 `remote.settings.describe()` 脱敏值。禁止伪造本机身份、读取 credentials 或 settings document、调用写 RPC；远程表单 `set/unset/mutate` 必须直接 false。describe 一律 writable/hasDocument=false，变更事件、重连和页面可见时刷新；失败保留上次真实值，卸载恢复方法/监听器。本机不适配，原写队列不变。`tests/remote-settings.test.mjs` 覆盖同步、合并读取、拒写和还原。

## PDF/Office 预览手机兼容补丁（2026-10-09）

- **问题不在转换，在渲染**：宿主把 pptx/docx 转成 PDF 是成功的，失败发生在浏览器渲染 PDF 的第一步。Harness 打包的是 PDF.js 6 的**默认构建**，它调用一组最新 API 且**全都没有特性检测**：`Uint8Array.prototype.toHex`（每次加载都算 `fingerprints`）、`toBase64`/`fromBase64`（字体与 base64 传输编码）、`Math.sumPrecise`（字体字节数）、`Promise.try`（Worker 消息处理）、`Map`/`WeakMap.prototype.getOrInsertComputed`（`WorkerTransport#cacheSimpleMethod`，在加载路径上，`getMetadata` 等都会走）、`URL.parse`（链接与 fetch URL 检查）。缺任何一个的浏览器（移动 Safari、旧 Chrome/WebView）都会对**每一份 PDF** 报错，界面显示「无法显示 PDF：…」；Office 预览走同一条链路，所以 pptx 也一并失效。桌面 Chrome 版本新，只在手机上复现——这就是它看起来像「pptx 打不开」的原因。
- **这一组是一次补完的，不是一轮补一个**：第一轮只按报错补了 `toHex` 一类，手机随即在 `getOrInsertComputed` 上报第二次错；扫过 pdf.js 两个构建里全部「新 API 调用」后才把整组补上。改这个文件时若要收窄范围，必须先重跑下面的端到端命令，而不是只看当前报错。
- **插件改注入点，不改 Harness**：Worker 源码内联在 Harness 的 bundle 里，插件唯一的接触点是它交给 `URL.createObjectURL` 的那个 Blob。`src/client/pdf-worker-compat.ts` 记住脚本类型的 Blob，在 Harness 用 `new Worker(url, { type: 'module', name: 'dsh-pdf' })` 建 Worker 时改交一个把补丁源码前置的 Blob。判据是「**模块** Worker + 脚本 Blob」，不是 Worker 名字：名字改了补丁仍生效；excel（`dsh-excel`）与 file-upload 的 Worker 不是模块 Worker，保持原样。
- **一个函数，两个 realm**：`installPdfApis` 只写缺失的方法（已有实现一律不覆盖），页面半边直接调用，Worker 半边把 `installPdfApis.toString()` 拼进 Blob 文本——所以它必须自包含，不引用模块作用域的任何值；改它等于同时改两个 realm。页面与 Worker 同一引擎，所以只探测页面这一侧就够。
- **门槛看 realm 的出生状态，不看当前状态**：第一次安装把「这个引擎天生缺这些 API」记在 realm 上（`Symbol.for` 标记，见 `MISSING_MARKER`）。只看当前状态会漏：插件重载时页面已被上一个实例补过，再按现状判断就会以为浏览器是新的，于是不再挂 Worker 补丁，PDF 又报同样的错。现代浏览器（整组 API 齐全且从未被标记）一个全局都不动。
- **与 Harness 的耦合是明说出来的**：补丁认的是「`text/javascript`/`application/javascript` Blob + `{ type: 'module' }` 的 `new Worker`」。Harness 换 PDF 引擎、改成非内联 Worker、或改掉模块 Worker 的建法，补丁会静默失效（退回报错，不会更坏）；Harness 自己换到 `legacy/` 构建或补上特性检测后，这个文件可以整体删掉。
- 验证：`tests/pdf-worker-compat.test.mjs` 拿**构建产物里的**补丁源码在删掉这些 API 的 `node:vm` realm 里跑——toHex、base64 往返与 padding、`Math.sumPrecise` 的补偿求和、`Promise.try` 的 then／catch、Map/WeakMap 两个 upsert（含「回调抛错不入表」「回调收到 key」）、`URL.parse` 的 null 语义、已有实现不被覆盖、Worker 替换与 Blob 释放、二次安装与 dispose 后重装；`tests/client.mjs` 断言 `apply()` 真的装了它、只动 PDF 那个模块 Worker、释放后还原三个全局。另有一次性端到端复核（`.scratch/ui-beautify-e2e-probe.mjs`）：在删掉整组 API 的环境里，用**未修改的** Harness 现代 Worker + 主构建、经真实 Worker 线程**加载并渲染**真实 PDF 成功（`numPages`、指纹、`getMetadata`、`getTextContent`、canvas 像素全部通过）；不前置补丁时同一环境报 `hashOriginal.toHex is not a function`。

## 组合接线

`cordis.patch.yml` 把插件行插进组合的 bundle 层：

```yaml
- insert:
    - id: ui-beautify
      name: '@guowenzhang/dsh-ui-beautify'
```

`package.json` 的 `dsh.bundle.patch` 指向这个文件，`dsh.client` 声明浏览器半边要用的服务提供包：

```json
"dsh": {
  "client": {
    "inject": [
      "@deepseek-ai/dsh-api-gateway", "@deepseek-ai/dsh-client-store", "@deepseek-ai/dsh-client-locale",
      "@deepseek-ai/dsh-client-ui-chat", "@deepseek-ai/dsh-client-ui-conversation",
      "@deepseek-ai/dsh-client-ui-primitives", "@deepseek-ai/dsh-client-ui-renderer",
      "@deepseek-ai/dsh-client-ui-settings", "@deepseek-ai/dsh-client-ui-slots", "@deepseek-ai/dsh-client-ui-theme"
    ],
    "platform": "web"
  },
  "bundle": { "patch": "./cordis.patch.yml" }
}
```

client 半边必须打成 `window.__ModuleLoader__.load({ id, factory })` 手接格式；`id` 就是 `build-client.mjs` 里的 `HANDOFF_ID`（本插件等于包名 `@guowenzhang/dsh-ui-beautify`）。改 client 后强刷浏览器（`Ctrl+F5`），或 bump `HANDOFF_ID` 让浏览器取新 bundle。

host 插件导出 `{ name, inject, Config, apply }`，`inject: ['webServer']`（字体路由只存在于 Web carrier 上，所以等一个）。注册一律走 `ctx.effect(...)` 收口，依赖的服务用 `ctx.get('x')` 取，**不要** `ctx.x` 属性访问——未 inject 的服务属性在 Cordis 的 inject guard 下会抛错。
