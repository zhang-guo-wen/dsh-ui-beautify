# @guowenzhang/dsh-ui-beautify

[English](<README.md>) | 中文

## 背景

这是一个为 [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/) 做界面优化的第三方插件，重点是**手机端适配**：让对话、侧栏和设置页面在小屏幕上更好用。

同时支持分别选择正文与代码字体，自定义 Logo、图标、名称和欢迎标语，以及使用默认模型把 Skill、插件等英文描述翻译成当前界面语言，方便使用和阅读。另有最近对话切换、回到最近提问、输入框光柱和 PC 端快捷回复等小改进。

在缺少最新 JavaScript API 的手机浏览器上，插件会补齐 PDF 引擎需要的那几个 API，因此 PDF 与 Word/PowerPoint 预览能正常打开，而不是报 `... is not a function`。

## 安装

需要 DeepSeek Harness **0.2.0-rc.1 或更新版本**。以下以 `web` profile 为例：

```sh
npx @deepseek-ai/dsh plugin --profile web add @guowenzhang/dsh-ui-beautify
```

安装后重启对应宿主并刷新浏览器，在 **设置 → 界面美化** 中使用。描述翻译需点击「翻译描述」，消耗默认模型额度，译文会缓存且不修改原始文件。

## 截图

### 1. 设置页面

外观、界面增强和品牌设置集中在 **设置 → 界面美化**。

| 外观 | 界面增强 | 品牌 |
| --- | --- | --- |
| ![正文字体、代码字体与动效设置](<docs/images/settings-appearance.png>) | ![手机适配、最近对话与描述翻译设置](<docs/images/settings-enhance.png>) | ![Logo、图标、名称与标语设置](<docs/images/settings-branding.png>) |

### 2. 手机端适配

以下使用同一个演示会话、相同的 **393 × 844** 手机视口截图。左侧关闭本插件的手机适配与最近对话开关，右侧开启；设置页对比仅切换手机适配。图中编号标注主要区别。

#### 对话界面对比

![手机对话界面适配前后对比及区别标注](<docs/images/mobile-conversation-comparison.zh.png>)

1. **侧栏不再挤占对话宽度**：固定图标栏改为左上角抽屉入口。
2. **切换对话更方便**：顶部显示最近对话；此功能有独立开关。
3. **阅读与输入更宽松**：正文和输入框使用适合手机的宽度与留白。

#### 设置页面对比

![手机设置页面适配前后对比及区别标注](<docs/images/mobile-settings-comparison.zh.png>)

1. **分类导航横向排列**：不再占用左侧内容空间，可左右滑动切换分类。
2. **内容区域全宽显示**：减少文字被挤窄和频繁换行。
3. **控件适合触摸**：字体选择等控件堆叠排列，关闭按钮保留在顶部。

### 3. 手机端兼容

修复前，缺少这些 API 的手机浏览器打开每一份 PDF 与 Office 预览都会显示下面这条错误：

![手机截图：无法显示 PDF：this[#methodPromises].getOrInsertComputed is not a function，右侧是重试按钮（修复前）](<docs/images/pdf-preview-before-fix.png>)

## 许可

插件本体采用 **Apache-2.0**，见 [LICENSE](<LICENSE>)。

插件不分发字体文件。按需下载的字体保留各自原始许可：字体采用 **SIL Open Font License 1.1**，霞鹜文楷系列的 webfont npm 打包代码另采用 MIT。第三方声明见 [NOTICE](<NOTICE>)。
