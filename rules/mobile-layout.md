本文件覆盖手机布局控制器与最近对话、设置弹窗的手机重排、Pocket 文件复制按钮的手机布局、右侧栏归属与白板触摸层级；当你需要改动 ≤600px 的手机行为时读它。

# 手机布局与最近对话

## 目录（原「目录」小节中的手机与最近对话条目）

- 手机布局直接由本插件的 `mobile-layout.tsx`、`mobile-layout-controller.ts` 和 `mobile-layout.css` 提供，复用宿主 `layout.toggleSidebar`、Button 和现有侧栏；≤600px 是浮层，桌面不改，新宿主已有 `data-mobile-sidebar` 时保留其原生布局。不得另装 `dsh-mobile-layout`、复制宿主组件或修改 Harness 源码。Pocket 2.10.6 的三个失效导航 cell 通过 priority -10 shadow，明确标识的 mobile CSS 暂停，卸载时恢复；网络/二维码/设置保持运行。`npm run test:mobile` 运行控制器和可选真实浏览器测试（设置 `DSH_MOBILE_URL`）。普通 3081 根地址必须通过冷加载、触摸、导航、600/601px、桌面和卸载清理验收。设置控件窄屏堆叠，快捷回复内容编辑行仍 parked。
- 顶部完整需求来自 2026-10-07 的原手机适配对话（不是 worktree 丢失）：`MobileRecentSessions.tsx` 复用 session catalog + `uiWorkspace.openSession`，未归档/非空白/非子代理按活动排序最多取 5 条，点击只改选中态，不置首；portal 容器不因 sessionId 变化销毁重建，实际不足时不补位，Unicode 显示 5 字。`useWorkspaces.archivedSessionIds` 是权威归档来源，归档当前会话也移除；每个标签复用实际宿主的 `_tab`/`_tabActive` class，字号/颜色/下划线不另做一套。通过 portal 挂在旧宿主 View tabs 后，手机隐藏旧 View tabs、顶部打开文件和日志/反馈三点菜单，正文/输入框边距 16px/8px；已有原生 recent strip 不重复插入。公开开发声明缺 session standard-seat augmentation 时仅在插槽注册边界适配，不复制宿主组件或类型图。必须在当前会话页验证真实标签点击、桌面保留 View tabs 与工具按钮，不能只测空白页。
- 2026-10-07 提交前验证：真实 3081 宿主通过冷加载、触摸抽屉、Esc、遮罩、600/601px、近期会话切换和桌面恢复；真实卸载恢复及新宿主原生布局尚未做端到端验收，控制器清理和原生布局不接管只经单测验证。原生 recent strip 保留宿主自身断点（新宿主可能在恰好 600px 显示 View tabs）。浏览器回归须设置 `DSH_MOBILE_URL`、`DSH_MOBILE_WORKSPACE` 和 `DSH_MOBILE_SESSION_PATTERN`；可用 `DSH_MOBILE_PLAYWRIGHT`、`DSH_MOBILE_CHROME` 指定浏览器环境，目标工作区需有至少一条已开始会话；回归按 1–5 条实际数量校验，不要求凑齐五条。
- 手机右侧栏依然归宿主所有：`[data-rightbar-col]` 必须固定在 grid-column 3/grid-row 1（0 宽轨道的右边缘），否则宿主 fullscreen 面板会定位到负的 viewport 宽度；打开时在左侧抽屉/overlay 之上，全屏时隐藏左侧展开按钮。不可替换宿主右侧栏和关闭控件。浏览器验收必须包括实际触摸“展开 → 收起 → 再展开”，验证面板 left=0/right=innerWidth 与入口恢复。
- 2026-10-08 手机白板触摸卡死：手机 frame 的 drawer/rightbar 为 1200/1250，高于 body portal 的宿主 Modal（1000）；宿主将 root 设为 inert 后，弹窗被编辑器遮住但遮罩仍拦输入。只在 `[data-mobile-layout-frame]` 加 `isolation: isolate` 限定层级，不移除 inert、不跳过弹窗、不更改 Draw.io。回归须用浏览器 `DOMSnapshot` paint order（普通可见性和 elementFromPoint 会被 inert 误导），证明去掉 isolation 重现、恢复后 Modal 在 iframe 上方，并触摸继续后可操作。实际 LAN 页面需验证白板打开、菜单、收起再打开。

## 设置弹窗手机布局（2026-10-08）

- 设置弹窗与美化设置行的手机布局统一由 `mobileLayoutEnabled` 控制。`BeautifySection` 订阅同一设置快照，仅开启时添加 `data-beautify-mobile-layout`；`SettingRow.module.css` 的全部 ≤600px 布局／触摸尺寸规则必须以该属性为作用域。唯一例外是 `.desktopOnly` 的快捷回复设置手机隐藏规则，保持始终隐藏。关闭时恢复原控件排列、输入尺寸，重开实时恢复，不增加配置字段或绑定最近对话开关。回归须包括实际开关关→开、美化页与通用页、桌面和原始配置恢复。

- `mobile-layout.css` 在 ≤600px 内仅通过 `data-shortcut-modal='settings'` 定位 body portal 的实际设置壳；用 grid + display:contents 重排为标题／宿主 actions 与关闭按钮、横滑原导航、全宽独立滚动内容。保留宿主组件、slots、焦点管理和权限；不修改 Harness，不复制设置壳。颜色和圆角使用宿主 token；桌面不覆盖。
- 宿主通用偏好行仅在 `settings.general.item` 内按 CSS module local 后缀覆盖，选择器和描述堆叠，开关并排，三个主题选项同排。插件开关规则必须排除 `.desktopOnly`，避免较高选择器优先级把手机已隐藏的快捷回复设置重新显示。文字输入 16px／44px，避免 iOS 聚焦缩放。
- `tests/settings-layout.test.mjs` 覆盖样式边界，`tests/settings-layout-browser.test.mjs` 设置 `DSH_SETTINGS_URL` 后验收实际已加载产物，无模拟响应或临时 CSS。已通过当前桌面宿主公开的 3081 入口：320/360/393/430/600px 触摸切换通用／美化分类、无内容横溢、开关、底部输入、浅深色、601/1280px 两栏和关闭／Esc；19387 的隔离浏览器请求为 401，未绕过认证。当前宿主改变 viewport 会重挂设置 owner，空白欢迎页的异步 onboarding 也会关闭设置；测试各宽度冷加载并在手机选择已有已开始会话，不把该行为称为插件 bug 或修改宿主。手机验收可用 `DSH_SETTINGS_SESSION` 指定现有会话标题片段。

## Pocket 文件复制按钮手机布局（2026-10-08）

- Pocket 的远程 file guard 在 HoverCard anchor 内把 `data-mobile-nav='copy-file'` 按钮插在全宽文件行后；旧 Pocket mobile CSS 已停用，因此按钮会换行并显示浏览器默认边框。仅在 `mobile-layout.css` ≤600px 的 `[data-changed-files]` 内，把含直接 copy 子节点的 wrapper 改 flex、原文件按钮设 flex:1/width:0、长路径省略，复制按钮为 44px 触摸区域和宿主 token。不得移节点、复制事件处理器、修改远程 readFile 或开启 Pocket 旧全局 CSS。
- `tests/file-copy-browser.test.mjs` 通过 `DSH_FILE_COPY_URL`（须为远程 LAN 源）和 `DSH_FILE_COPY_SESSION` 指定已有会话。已在当前实际 100.91.74.34:3081 的 320/393/600px 触摸验证折叠／展开、同排不重叠、增删统计、超长路径；只测布局，未宣称实际复制内容 RPC／剪贴板通过。回归不发送会话消息、不修改原始文件。
