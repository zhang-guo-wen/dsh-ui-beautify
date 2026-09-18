/**
 * Locale-owned copy for the Page beautification settings section.
 *
 * Product-visible text lives here and reaches the component through the `t`
 * seat; the component itself carries no fallback strings.
 *
 * @module @zhang-guo-wen/dsh-ui-beautify/client/locales
 */

/** Dictionary namespace owning this section's copy. */
export const NS = 'settings.uiBeautify'

/** English copy. */
export const en = {
  nav: 'Page beautification',
  intro: 'Choose the typeface the interface uses for body text. The fonts ship with this plugin, so no system installation is needed.',
  fontSection: 'Body font',
  fontSystem: 'System default',
  fontSystemDesc: 'Applies no bundled font. The interface keeps whatever stack DeepSeek Harness ships with, so it follows upstream changes.',
  fontNotoSansSc: 'Source Han Sans',
  fontNotoSansScDesc: 'Sans-serif. Even stroke weight and squared-off forms; the most neutral choice for interface text.',
  fontLxgwWenkai: 'LXGW WenKai',
  fontLxgwWenkaiDesc: 'Handwritten kai style. Warmer and easier to read in long prose, at the cost of a heavier download.',
  active: 'In use',
  unavailable: 'The Host settings service is unavailable, so this choice cannot be saved.',
  readonly: 'The settings document is read-only, so this choice cannot be saved.',
  loading: 'Loading the font…',
}

/** Chinese copy. */
export const zh: typeof en = {
  nav: '页面美化',
  intro: '选择界面正文使用的字体。字体随插件分发，无需在系统里安装。',
  fontSection: '正文字体',
  fontSystem: '系统默认',
  fontSystemDesc: '不应用任何内置字体。界面沿用 DeepSeek Harness 自带的系统字体栈，因此会跟随上游的变化。',
  fontNotoSansSc: '思源黑体',
  fontNotoSansScDesc: '无衬线。笔画粗细均匀、字形方正，界面文本最中性稳妥的选择。',
  fontLxgwWenkai: '霞鹜文楷',
  fontLxgwWenkaiDesc: '手写楷体。长文阅读更温润舒适，代价是首次下载体积更大。',
  active: '使用中',
  unavailable: '宿主设置服务不可用，该选择无法保存。',
  readonly: '设置文档为只读，该选择无法保存。',
  loading: '字体加载中…',
}

/** Every key this section's copy may use. */
export type FontSectionKey = keyof typeof en
