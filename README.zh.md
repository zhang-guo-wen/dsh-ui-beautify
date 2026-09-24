# @guowenzhang/dsh-ui-beautify

[English](README.md) | 中文

## 背景：DeepSeek Harness

DeepSeek Harness（`dsh`）是 DeepSeek AI 开源的 agent harness，几乎所有能力都是 [Cordis](https://github.com/cordiverse/cordis) 插件。它处于 **developer preview** 阶段、迭代很快，会有破坏性变更（[文档站](https://deepseek-harness.github.io/deepseek-harness/)，`0.1.7-alpha.*`）；本插件是独立第三方包，`@deepseek-ai/*` 运行时从宿主解析。

## 这个插件解决什么问题

Web GUI 的正文与代码字体只能用系统回退字体、无法更改；本插件在 **设置 → 通用设置** 里各加一行字体选择，字体首次使用时才下载。

## 截图

![两行字体选择](docs/images/font-rows.png)
设置 → 通用设置：**正文字体**与**代码字体**就在**字号大小**正下方，各自显示所选字体的描述与缓存状态。

## 安装

```sh
npx @deepseek-ai/dsh plugin --profile web add @guowenzhang/dsh-ui-beautify
```

来自 npm 官方源：<https://www.npmjs.com/package/@guowenzhang/dsh-ui-beautify>。装完重启宿主；本地目录开发安装、git 源与排查见 [AGENTS.md](AGENTS.md)。

## 用法

### 选择正文字体

**设置 → 通用设置**，「字号大小」下方的那一行 **正文字体**。点右侧胶囊下拉选一款字体；选中即生效、无需确认，选择会写进当前 profile 的设置文件。

### 选择代码字体

**代码字体** 行，在正文字体下一行、工作过程展示上方。它默认是 `system`，所以全新安装不会改变代码显示的任何观感，直到你自己选。

### 理解 `system` 的含义

`system` 移除插件的样式表链接与 token 覆盖，让 token 回到 `ui-theme` 自己的声明。它不是把今天的默认值冻结一份——上游改默认字体这里会跟随。选中它也是把自定义字体关掉的唯一方式，不需要卸载插件。

### 看懂缓存状态行

每一行都有标题、当前字体的描述，以及一行状态，例如 `已缓存 103 KB · 1/101 片`。这里**没有下载按钮**：字体按需拉取，页面需要多少就取多少。那个分数是按需下载的进度读数，不是失败——你继续浏览、页面出现新字符，它会自己涨。数字只在**这一行渲染时**与**切换字体后约 1.5 秒**读取，不是实时订阅；因此状态行末尾常驻一句提示，告诉用户**刷新页面（F5）**即可重新统计。

### 理解下载行为

下载是**按分片**进行的，不是整包预取。先取所选字体的样式表，然后只取页面实际用到的字符所属的那几片。同一文件的并发请求会合并；之后再次加载页面全部走本地磁盘，不再联网。

| Situation | What you see |
|---|---|
| The host machine has no outbound network | Downloads fail; the GUI keeps rendering with its fallback fonts |
| The browser has network access but the host does not | Downloads still fail — the browser never contacts an external site |

## 注意事项

- **字体首次使用需要宿主机能联网。** 浏览器只跟 DSH 自己的源说话，取文件的是宿主。这是本插件唯一依赖宿主联网的地方，也是浏览器自己通网、首次使用却仍可能失败的唯一原因。
- **`system` 是代码字体的默认值**，所以全新安装在你不选之前视觉上什么都不会变。
- **只有 `maple-mono-cn` 覆盖中文。** 其余四款只覆盖拉丁字符，中文回退到内置栈；`maple-mono-cn` 还有 9 MB，并且只能走 jsDelivr，因为 npm 镜像没同步这个包。
- **字体没下下来时界面不会坏。** 先用回退字体渲染，分片到位后再替换；彻底失败就一直用回退字体。
- **有两处不认字体 token**，因为它们的字体是写死的：集成终端（xterm 构造参数，不走 CSS）和队列面板样式表里写死的 `Inter` 前缀。
- **镜像列表与缓存目录是宿主启动时的配置**，不是实时设置——改完要重启宿主。
- **字体不在本插件的许可范围内。** 每款字体各自保留自己的许可，见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。

## 许可

插件本体是 Apache-2.0——见 [LICENSE](LICENSE) 与 [NOTICE](NOTICE)。

**插件不分发任何字体文件。** 字体按需从 npm 镜像下载到本机缓存，各自保留原始许可。Noto Sans SC、Noto Serif SC、ZCOOL XiaoWei、ZCOOL KuaiLe、ZCOOL QingKe HuangYou、Ma Shan Zheng、Zhi Mang Xing、Long Cang、Liu Jian Mao Cao、Inter、Geist、JetBrains Mono、Fira Code、Geist Mono、Noto Sans Mono 与 Maple Mono CN 为 SIL Open Font License 1.1，由 Fontsource 或字体发布方打包。LXGW WenKai、LXGW WenKai TC 与 LXGW WenKai Screen 同为 SIL Open Font License 1.1；承载它们的 npm 包 `lxgw-wenkai-webfont`、`lxgw-wenkai-tc-webfont` 与 `lxgw-wenkai-screen-webfont` 为 MIT。

## 延伸阅读

- [AGENTS.md](AGENTS.md) —— 完整字体表、下载链路、缓存布局、开发命令、加字体流程与排查。
- [dsh-web-design](https://github.com/zhang-guo-wen/dsh-web-design) —— 姊妹插件，在 DSH 侧栏里预览与编辑 HTML。
- [DeepSeek Harness 文档](https://deepseek-harness.github.io/deepseek-harness/)。
