# @guowenzhang/dsh-ui-beautify

[English](<README.md>) | 中文

为 [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/) 提供字体、输入框光柱、快捷回复、品牌自定义与手机布局优化的第三方插件。全部选项集中在 **设置 → 界面美化**，安装后无需额外配置；插件列表里的显示名称与介绍随 Harness 语言切换。

## 功能

- **正文字体 / 代码字体**：两类字体各自独立选择，共 19 款（思源黑体、思源宋体、霞鹜文楷、Inter、JetBrains Mono 等）。字体在首次使用时由宿主按需下载到本机缓存，之后可离线使用；选「系统默认」即恢复宿主字体，不必卸载插件。
- **输入框光柱**：1px 光柱贴住输入框上沿，随助手实际输出速度流动，输出结束后减速静止；不占额外高度或间距，不影响布局。
- **快捷回复（PC）**：输入框下方四个短语，点击即在光标处插入并发送，不覆盖已写草稿；窗口变窄时从末尾少显示几条，手机端始终隐藏。
- **回到最近提问**：浮动向上按钮回到最近一条已发送的提问，方便从头阅读长回答。
- **最近对话切换**：顶部最多显示 5 个最近对话，带等待审批、运行中、未读完成等实时状态圆点。
- **手机端适配**：宽度不超过 600px 时左侧栏变为抽屉、会话保持全宽，并重排设置弹窗。
- **品牌自定义**：替换欢迎页 Logo、左上角图标与名称、欢迎页标语。
- **远程设置同步读取**：手机等远程页面只读同步本机脱敏设置，解决部分配置在手机端不生效。
- **描述翻译**：用宿主默认模型把插件与 Skill 描述翻译成当前界面语言，只需点一次。

## 界面

### 外观

正文字体、代码字体、输入框上方的动画开关与 PC 端快捷回复开关。

![界面美化 · 外观](<docs/images/settings-appearance.png>)

### 输入框

输入框上沿的 1px 光柱随输出速度流动；下沿是 PC 端快捷回复标签。

![输入框上沿的光柱与下方快捷回复标签](<docs/images/composer-quick-replies.png>)

### 最近对话

顶部最多 5 个最近对话，标签复用宿主字体与选中下划线，右侧圆点表示等待审批、运行中与未读完成。

![顶部最近对话标签](<docs/images/recent-sessions.png>)

### 界面增强

四个功能开关与「翻译描述」。

![界面美化 · 界面增强](<docs/images/settings-enhance.png>)

### 品牌

![界面美化 · 品牌](<docs/images/settings-branding.png>)

### 手机端适配

宽度不超过 600px 时，左侧栏收成抽屉、会话保持全宽，正文与输入框改用手机留白。下图是同一个会话在手机上开关「手机端适配」前后的对比。

| 适配前（关闭开关） | 适配后（默认开启） |
| --- | --- |
| ![手机适配前：左侧固定图标栏，会话被压窄，顶部没有最近对话](<docs/images/mobile-before.png>) | ![手机适配后：会话全宽，左上角抽屉入口，顶部显示最近对话](<docs/images/mobile-after.png>) |

点击左上角按钮滑出侧栏抽屉，选择会话、点击遮罩或按 Esc 收起：

![手机侧栏抽屉](<docs/images/mobile-drawer.png>)

设置弹窗改为顶部标题与关闭按钮、可横向滑动的分类导航与全宽滚动内容，浅色与深色都沿用宿主主题：

| 浅色 | 深色 |
| --- | --- |
| ![手机设置弹窗（浅色）](<docs/images/mobile-settings-light.png>) | ![手机设置弹窗（深色）](<docs/images/mobile-settings-dark.png>) |

## 开关

**设置 → 界面美化 → 界面增强** 可分别关闭 **回到最近提问**、**手机端适配**、**最近对话切换**、**远程设置同步读取**，四项默认开启，关闭后立即恢复宿主原有界面。

- **手机端适配**只控制本插件的抽屉、留白与设置页重排；最近对话由独立开关控制，两者互不影响。
- **远程设置同步读取**只在本机开关：关闭后停止插件同步并恢复宿主原有读取方式，远程页面始终只读。
- 开关保存在当前 profile 的 `ui-beautify` 配置行（`scrollToPromptEnabled`、`mobileLayoutEnabled`、`recentSessionsEnabled`、`remoteSettingsEnabled`）。升级后首次需要重启宿主并刷新页面以加载新字段，之后本机开关即时生效。

## 描述翻译

在 **设置 → 界面美化 → 界面增强 → Skill 与插件描述** 点击 **翻译描述**，使用宿主配置的默认模型翻译为当前界面语言。只发送描述，不发送会话、工具或完整技能指令，也不修改原始文件。

- 译文按来源、原文与目标语言持久化：重复点击、刷新、重启或描述未变的升级直接复用；原文改变后再次点击只补齐新描述。
- 译文保存在 `$DSH_HOME/data/ui-beautify/description-translations/v1`，独立于插件安装目录。调用模型需要联网并消耗默认模型额度。
- 缺少翻译服务或默认模型时显示不可用，不影响其他美化功能。

## 安装

先安装并运行 DeepSeek Harness **0.2.0-rc.1 或更新版本**，再把插件加入需要使用的 profile。下面以 `web` 为例；其他 profile 请替换名称。

### 从 npm 安装

```sh
npx @deepseek-ai/dsh plugin --profile web add @guowenzhang/dsh-ui-beautify
```

已发布的版本见 [npm 包页面](https://www.npmjs.com/package/@guowenzhang/dsh-ui-beautify)。

### 从 GitHub 安装

```sh
npx @deepseek-ai/dsh plugin --profile web add https://github.com/zhang-guo-wen/dsh-ui-beautify.git
```

安装或升级后，**重启对应宿主并硬刷新浏览器（Ctrl+F5）**，然后打开 **设置 → 界面美化**。手机直接访问同一地址即可，无需额外手机插件、布局 URL 参数或修改 Harness 源码。

### 卸载

```sh
npx @deepseek-ai/dsh plugin --profile web remove @guowenzhang/dsh-ui-beautify
```

### 本地开发

```sh
npm ci
npm run typecheck
npm run build
npm test
```

字体表、缓存机制、路由与排障说明见 [维护指南](https://github.com/zhang-guo-wen/dsh-ui-beautify/blob/master/AGENTS.md)。

## 注意事项

- **首次字体下载需要宿主联网**：浏览器只访问 DSH 自身，由宿主从镜像下载；浏览器能联网不代表宿主能下载。未缓存的新字符仍可能需要下载，失败时使用回退字体，不影响界面使用。
- **代码字体覆盖范围**：代码字体里只有 Maple Mono CN 覆盖中文（全部分片约 9 MB，走 jsDelivr），其余四款的中文回退宿主字体；集成终端和队列面板中硬编码字体的位置不跟随字体设置。
- **快捷回复会直接发送消息**：已有草稿会与插入的短语一起提交。设置页不提供短语内容编辑，如需自定义，可在当前 profile 配置的 `ui-beautify` 行设置 `quickReplies`（最多 4 条，每条最多 40 字）。
- **光柱不是精确测速**：速度按输出字符增长估算，不等同于状态栏的 `tok/s`，不读取用户输入，也不发送数据。
- **设置与缓存位置**：设置保存在当前 profile 的配置中，页面内修改通常立即生效。字体缓存默认在 `$DSH_HOME/cache/ui-beautify/fonts`，上传图片在 `$DSH_HOME/assets/ui-beautify`；`mirrors` 与 `cacheDir` 改动后需要重启宿主。
- **兼容性**：DSH 仍在快速迭代，宿主升级可能带来兼容性变化；本插件从宿主解析运行时依赖，不替换宿主。已有原生手机抽屉／最近对话条时保留宿主实现及其断点。
- **品牌范围**：品牌自定义只作用于 DSH 浏览器界面；Electron 安装版单独打包的原生首次引导窗口不加载此插件。

## 许可证

插件本体采用 **Apache-2.0**，见 [LICENSE](<LICENSE>)。

插件不分发字体文件；按需下载的字体保留各自原始许可。所用字体采用 **SIL Open Font License 1.1**；霞鹜文楷系列的 webfont npm 打包代码另采用 MIT。完整第三方声明见 [NOTICE](<NOTICE>)。
