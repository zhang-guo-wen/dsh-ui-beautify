/**
 * Locale-owned copy for the Page beautification settings section.
 *
 * Product-visible text lives here and reaches the component through the `t`
 * seat; the component itself carries no fallback strings. One name and one
 * description per catalogue row, so adding a face means adding two keys here.
 *
 * @module @guowenzhang/dsh-ui-beautify/client/locales
 */

/** Dictionary namespace owning this section's copy. */
export const NS = 'settings.uiBeautify'

/** English copy. */
export const en = {
  nav: 'Page beautification',
  intro: 'Choose the typeface the interface uses for body text. Nothing is installed on this machine: a face is downloaded the first time it is used, then served from a local cache.',
  groupSystem: 'Baseline',
  groupCjk: 'Chinese faces',
  groupLatin: 'Latin faces',
  fontSystem: 'System default',
  fontSystemDesc: 'Downloads nothing. The interface keeps whatever stack DeepSeek Harness ships with, so it follows upstream changes.',
  fontNotoSansSc: 'Source Han Sans',
  fontNotoSansScDesc: 'Sans-serif with even strokes and squared forms; the most neutral choice for interface text. One variable file per shard covers every weight.',
  fontNotoSerifSc: 'Source Han Serif',
  fontNotoSerifScDesc: 'Serif with thin horizontals and thick verticals. Long prose reads closer to print, at the cost of a softer small-size rendering.',
  fontLxgwWenkai: 'LXGW WenKai',
  fontLxgwWenkaiDesc: 'Handwritten kai style, warm and open. Easier on long prose than a sans at the same size.',
  fontLxgwWenkaiTc: 'LXGW WenKai TC',
  fontLxgwWenkaiTcDesc: 'The traditional-glyph cut of the same kai face, for readers used to Hong Kong or Taiwan forms.',
  fontZcoolXiaowei: 'ZCOOL XiaoWei',
  fontZcoolXiaoweiDesc: 'A thin, elegant serif variant. The interface looks lighter, and thin strokes are the first thing to suffer at small sizes.',
  fontZcoolKuaile: 'ZCOOL KuaiLe',
  fontZcoolKuaileDesc: 'Rounded, even strokes with a playful tilt. Still comfortable to read, and the smallest download of the display faces.',
  fontMaShanZheng: 'Ma Shan Zheng',
  fontMaShanZhengDesc: 'Brush kai with visible stroke entry and exit. Decorative, and best kept to short passages.',
  fontZhiMangXing: 'Zhi Mang Xing',
  fontZhiMangXingDesc: 'Brush running script with joined strokes. The most decorative choice here, and hard to read across long text.',
  fontInter: 'Inter',
  fontInterDesc: 'Latin sans designed for screens. Chinese text falls back to the system stack.',
  fontGeist: 'Geist',
  fontGeistDesc: 'Geometric Latin sans. Chinese text falls back to the system stack.',
  active: 'In use',
  cacheAbsent: 'Not downloaded',
  cachePresent: 'Cached {size} · {cached}/{total} shards',
  unitKb: 'KB',
  unitMb: 'MB',
  unitGb: 'GB',
  unavailable: 'The Host settings service is unavailable, so this choice cannot be saved.',
  readonly: 'The settings document is read-only, so this choice cannot be saved.',
}

/** Chinese copy. */
export const zh: typeof en = {
  nav: '页面美化',
  intro: '选择界面正文使用的字体。无需在本机安装：字体在首次使用时下载，之后由本地缓存提供。',
  groupSystem: '基准',
  groupCjk: '中文字体',
  groupLatin: '拉丁字体',
  fontSystem: '系统默认',
  fontSystemDesc: '不下载任何字体。界面沿用 DeepSeek Harness 自带的系统字体栈，因此会跟随上游的变化。',
  fontNotoSansSc: '思源黑体',
  fontNotoSansScDesc: '无衬线，笔画粗细均匀、字形方正，界面文本最中性稳妥。可变字体，每个分片一份文件即覆盖全部字重。',
  fontNotoSerifSc: '思源宋体',
  fontNotoSerifScDesc: '衬线，横细竖粗、起收有笔锋，长文阅读更接近印刷品；代价是小字号下笔画偏软。',
  fontLxgwWenkai: '霞鹜文楷',
  fontLxgwWenkaiDesc: '手写楷体，笔画舒展温润。同字号下长文阅读比黑体轻松。',
  fontLxgwWenkaiTc: '霞鹜文楷 TC',
  fontLxgwWenkaiTcDesc: '同一款楷体的繁体字形，适合习惯港台字形或阅读繁体文本时使用。',
  fontZcoolXiaowei: '站酷小薇体',
  fontZcoolXiaoweiDesc: '清瘦秀气的宋体变体，界面观感更轻盈；代价是细笔画在小字号下最先受损。',
  fontZcoolKuaile: '站酷快乐体',
  fontZcoolKuaileDesc: '笔画圆润均匀、略带倾斜的活泼字形，阅读仍算轻松，是装饰性字体里体积最小的一款。',
  fontMaShanZheng: '马善政楷书',
  fontMaShanZhengDesc: '毛笔楷书，起笔收笔明显，装饰性强，适合短句与标题。',
  fontZhiMangXing: '志莽行书',
  fontZhiMangXingDesc: '毛笔行书，连笔明显，是这里装饰性最强的一款，长文阅读吃力。',
  fontInter: 'Inter',
  fontInterDesc: '为屏幕设计的拉丁无衬线字体。中文回退到系统字体栈。',
  fontGeist: 'Geist',
  fontGeistDesc: '几何感较强的拉丁无衬线字体。中文回退到系统字体栈。',
  active: '使用中',
  cacheAbsent: '未下载',
  cachePresent: '已缓存 {size} · {cached}/{total} 片',
  unitKb: 'KB',
  unitMb: 'MB',
  unitGb: 'GB',
  unavailable: '宿主设置服务不可用，该选择无法保存。',
  readonly: '设置文档为只读，该选择无法保存。',
}

/** Every key this section's copy may use. */
export type FontSectionKey = keyof typeof en
