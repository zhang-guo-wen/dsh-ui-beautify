window.__ModuleLoader__.load({
	id: "@guowenzhang/dsh-ui-beautify",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		//#region src/fonts.ts
		/**
		* The body-font catalogue: every face the picker offers, and the CDN source it
		* is downloaded from.
		*
		* The plugin ships no font bytes. A row names an npm package and a pinned
		* version, so the Host half can fetch one stylesheet or one shard the first time
		* the browser asks for it and cache it afterwards. Adding a face means adding
		* one row here plus its copy in `src/client/locales.ts` — the picker, the
		* settings validation, and the download route all read this table.
		*
		* Both halves read this module, so nothing added here may import a Host-only
		* package: the Client half bundles it into the browser.
		*/
		/** The stack every downloaded face falls back to, matching ui-theme's own default. */
		const FALLBACK_STACK = [
			"-apple-system",
			"BlinkMacSystemFont",
			"'Segoe UI'",
			"'PingFang SC'",
			"'Hiragino Sans GB'",
			"'Microsoft YaHei'",
			"'Helvetica Neue'",
			"Helvetica",
			"Arial",
			"sans-serif"
		].join(", ");
		/**
		* Id of the choice that downloads nothing at all.
		*
		* Selecting it removes the stylesheet links and the token override, so
		* `--dsw-font-family` resolves to whatever ui-theme declares. That is
		* deliberately not the same as overriding the token with a copy of ui-theme's
		* stack: a copy would freeze today's default into this plugin and stop
		* following it.
		*/
		const SYSTEM_FONT_ID = "system";
		/**
		* Every face the plugin can download, in the order the picker presents them.
		*
		* All of these fonts are SIL Open Font License 1.1; the two `lxgw-wenkai`
		* packages are MIT wrappers around OFL fonts. Each package lays its sheets out
		* as `<package>/<sheet>` beside a directory of `unicode-range` shards, with
		* every `url()` in those sheets relative to the sheet's own directory — which
		* is what lets the route double as a pass-through proxy.
		*/
		const FONT_FACES = [
			{
				id: "noto-sans-sc",
				family: "Noto Sans SC Variable",
				group: "cjk",
				source: {
					package: "@fontsource-variable/noto-sans-sc",
					version: "5.3.0",
					sheets: ["index.css"]
				}
			},
			{
				id: "noto-serif-sc",
				family: "Noto Serif SC Variable",
				group: "cjk",
				source: {
					package: "@fontsource-variable/noto-serif-sc",
					version: "5.3.0",
					sheets: ["index.css"]
				}
			},
			{
				id: "lxgw-wenkai",
				family: "LXGW WenKai",
				group: "cjk",
				source: {
					package: "lxgw-wenkai-webfont",
					version: "1.7.0",
					sheets: ["lxgwwenkai-regular.css", "lxgwwenkai-bold.css"]
				}
			},
			{
				id: "lxgw-wenkai-tc",
				family: "LXGW WenKai TC",
				group: "cjk",
				source: {
					package: "lxgw-wenkai-tc-webfont",
					version: "1.2.0",
					sheets: ["lxgwwenkaitc-regular.css", "lxgwwenkaitc-bold.css"]
				}
			},
			{
				id: "zcool-xiaowei",
				family: "ZCOOL XiaoWei",
				group: "cjk",
				source: {
					package: "@fontsource/zcool-xiaowei",
					version: "5.3.0",
					sheets: ["index.css"]
				}
			},
			{
				id: "zcool-kuaile",
				family: "ZCOOL KuaiLe",
				group: "cjk",
				source: {
					package: "@fontsource/zcool-kuaile",
					version: "5.3.0",
					sheets: ["index.css"]
				}
			},
			{
				id: "ma-shan-zheng",
				family: "Ma Shan Zheng",
				group: "cjk",
				source: {
					package: "@fontsource/ma-shan-zheng",
					version: "5.3.1",
					sheets: ["index.css"]
				}
			},
			{
				id: "zhi-mang-xing",
				family: "Zhi Mang Xing",
				group: "cjk",
				source: {
					package: "@fontsource/zhi-mang-xing",
					version: "5.3.0",
					sheets: ["index.css"]
				}
			},
			{
				id: "inter",
				family: "Inter Variable",
				group: "latin",
				source: {
					package: "@fontsource-variable/inter",
					version: "5.3.0",
					sheets: ["index.css"]
				}
			},
			{
				id: "geist",
				family: "Geist Variable",
				group: "latin",
				source: {
					package: "@fontsource-variable/geist",
					version: "5.3.0",
					sheets: ["index.css"]
				}
			}
		];
		/**
		* Every id the picker offers and the settings schema accepts, in presentation
		* order. The system default leads: it is the baseline the others depart from.
		*/
		const FONT_CHOICES = [SYSTEM_FONT_ID, ...FONT_FACES.map((face) => face.id)];
		/** The choice used when the settings document holds no usable value. */
		const DEFAULT_FONT_ID = "noto-sans-sc";
		/**
		* Resolve one stored value to a choice the picker and the applier both accept.
		*
		* A settings document is hand-editable, so an unknown id is a real input rather
		* than a type error: it resolves to the default instead of failing the read or
		* leaving the interface on a face nobody offers.
		* @param id - a stored value, or undefined when nothing is stored.
		* @returns a member of {@link FONT_CHOICES}.
		*/
		function resolveFontChoice(id) {
			return id !== void 0 && FONT_CHOICES.includes(id) ? id : DEFAULT_FONT_ID;
		}
		/**
		* Resolve one choice to the face it downloads.
		* @param id - a member of {@link FONT_CHOICES}.
		* @returns the matching face, or undefined for the system default.
		*/
		function faceById(id) {
			return FONT_FACES.find((face) => face.id === id);
		}
		/**
		* The value written into `--dsw-font-family` for one face.
		* @param face - the face to build a stack for.
		* @returns the downloaded family followed by the shared fallback chain.
		*/
		function fontStack(face) {
			return `'${face.family}', ${FALLBACK_STACK}`;
		}
		//#endregion
		//#region src/params.ts
		/**
		* The identities both halves must agree on: where the faces are downloaded from,
		* and which settings namespace records the choice.
		*
		* Nothing here may import a Host-only package. The Client half reads this file,
		* so anything added has to stay resolvable in the browser bundle.
		*
		* The route lives under `/plugins` because that is the origin the app already
		* serves plugin-owned assets from, and `webServer` resolves it
		* longest-prefix-first, so it wins over the client-modules bundle route on
		* `/plugins`. Every face is served beneath it as `<FONTS_ROUTE>/<face>/<path>`,
		* where `<path>` is the file's own path inside the face's npm package.
		*/
		/** URL prefix font files are served under, with no trailing slash. */
		const FONTS_ROUTE = "/plugins/dsh-ui-beautify/fonts";
		/**
		* Exact path reporting what the cache holds.
		*
		* The picker reads it to label each face, so it is an exact route of its own
		* rather than a member of the font namespace: nothing under `FONTS_ROUTE` is a
		* JSON document, and a face id can never reach this path.
		*/
		const CACHE_ROUTE = "/plugins/dsh-ui-beautify/cache";
		/**
		* Settings namespace owned by this plugin.
		*
		* The Host half registers it and the Client half binds it, so the literal has
		* exactly one definition: a mismatch would leave the picker reading a namespace
		* nobody owns.
		*/
		const FONT_SETTINGS_NS = "ui-beautify";
		//#endregion
		//#region src/client/locales.ts
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
		const NS = "settings.uiBeautify";
		/** English copy. */
		const en = {
			nav: "Page beautification",
			intro: "Choose the typeface the interface uses for body text. Nothing is installed on this machine: a face is downloaded the first time it is used, then served from a local cache.",
			cacheHint: "The cache figures below are read when this page opens. Fonts keep downloading on demand in the background, so reload the page (F5) for the current state.",
			groupSystem: "Baseline",
			groupCjk: "Chinese faces",
			groupLatin: "Latin faces",
			fontSystem: "System default",
			fontSystemDesc: "Downloads nothing. The interface keeps whatever stack DeepSeek Harness ships with, so it follows upstream changes.",
			fontNotoSansSc: "Source Han Sans",
			fontNotoSansScDesc: "Sans-serif with even strokes and squared forms; the most neutral choice for interface text. One variable file per shard covers every weight.",
			fontNotoSerifSc: "Source Han Serif",
			fontNotoSerifScDesc: "Serif with thin horizontals and thick verticals. Long prose reads closer to print, at the cost of a softer small-size rendering.",
			fontLxgwWenkai: "LXGW WenKai",
			fontLxgwWenkaiDesc: "Handwritten kai style, warm and open. Easier on long prose than a sans at the same size.",
			fontLxgwWenkaiTc: "LXGW WenKai TC",
			fontLxgwWenkaiTcDesc: "The traditional-glyph cut of the same kai face, for readers used to Hong Kong or Taiwan forms.",
			fontZcoolXiaowei: "ZCOOL XiaoWei",
			fontZcoolXiaoweiDesc: "A thin, elegant serif variant. The interface looks lighter, and thin strokes are the first thing to suffer at small sizes.",
			fontZcoolKuaile: "ZCOOL KuaiLe",
			fontZcoolKuaileDesc: "Rounded, even strokes with a playful tilt. Still comfortable to read, and the smallest download of the display faces.",
			fontMaShanZheng: "Ma Shan Zheng",
			fontMaShanZhengDesc: "Brush kai with visible stroke entry and exit. Decorative, and best kept to short passages.",
			fontZhiMangXing: "Zhi Mang Xing",
			fontZhiMangXingDesc: "Brush running script with joined strokes. The most decorative choice here, and hard to read across long text.",
			fontInter: "Inter",
			fontInterDesc: "Latin sans designed for screens. Chinese text falls back to the system stack.",
			fontGeist: "Geist",
			fontGeistDesc: "Geometric Latin sans. Chinese text falls back to the system stack.",
			active: "In use",
			cacheAbsent: "Not downloaded",
			cachePresent: "Cached {size} · {cached}/{total} shards",
			unitKb: "KB",
			unitMb: "MB",
			unitGb: "GB",
			unavailable: "The Host settings service is unavailable, so this choice cannot be saved.",
			readonly: "The settings document is read-only, so this choice cannot be saved."
		};
		/** Chinese copy. */
		const zh = {
			nav: "页面美化",
			intro: "选择界面正文使用的字体。无需在本机安装：字体在首次使用时下载，之后由本地缓存提供。",
			cacheHint: "下方缓存数字是本页打开时读取的快照。字体仍在后台按需下载，刷新页面（F5）即可看到最新状态。",
			groupSystem: "基准",
			groupCjk: "中文字体",
			groupLatin: "拉丁字体",
			fontSystem: "系统默认",
			fontSystemDesc: "不下载任何字体。界面沿用 DeepSeek Harness 自带的系统字体栈，因此会跟随上游的变化。",
			fontNotoSansSc: "思源黑体",
			fontNotoSansScDesc: "无衬线，笔画粗细均匀、字形方正，界面文本最中性稳妥。可变字体，每个分片一份文件即覆盖全部字重。",
			fontNotoSerifSc: "思源宋体",
			fontNotoSerifScDesc: "衬线，横细竖粗、起收有笔锋，长文阅读更接近印刷品；代价是小字号下笔画偏软。",
			fontLxgwWenkai: "霞鹜文楷",
			fontLxgwWenkaiDesc: "手写楷体，笔画舒展温润。同字号下长文阅读比黑体轻松。",
			fontLxgwWenkaiTc: "霞鹜文楷 TC",
			fontLxgwWenkaiTcDesc: "同一款楷体的繁体字形，适合习惯港台字形或阅读繁体文本时使用。",
			fontZcoolXiaowei: "站酷小薇体",
			fontZcoolXiaoweiDesc: "清瘦秀气的宋体变体，界面观感更轻盈；代价是细笔画在小字号下最先受损。",
			fontZcoolKuaile: "站酷快乐体",
			fontZcoolKuaileDesc: "笔画圆润均匀、略带倾斜的活泼字形，阅读仍算轻松，是装饰性字体里体积最小的一款。",
			fontMaShanZheng: "马善政楷书",
			fontMaShanZhengDesc: "毛笔楷书，起笔收笔明显，装饰性强，适合短句与标题。",
			fontZhiMangXing: "志莽行书",
			fontZhiMangXingDesc: "毛笔行书，连笔明显，是这里装饰性最强的一款，长文阅读吃力。",
			fontInter: "Inter",
			fontInterDesc: "为屏幕设计的拉丁无衬线字体。中文回退到系统字体栈。",
			fontGeist: "Geist",
			fontGeistDesc: "几何感较强的拉丁无衬线字体。中文回退到系统字体栈。",
			active: "使用中",
			cacheAbsent: "未下载",
			cachePresent: "已缓存 {size} · {cached}/{total} 片",
			unitKb: "KB",
			unitMb: "MB",
			unitGb: "GB",
			unavailable: "宿主设置服务不可用，该选择无法保存。",
			readonly: "设置文档为只读，该选择无法保存。"
		};
		//#endregion
		//#region \0dsh-css:C:\02-codespace\deepseek-harness\dsh-ui-beautify\src\client\FontSection.module.css.mjs
		const css = ".S1NWwG_section{flex-direction:column;gap:16px;width:100%;max-width:720px;display:flex}.S1NWwG_panel{flex-direction:column;gap:16px;display:flex}.S1NWwG_intro{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;border-radius:12px;margin:0;padding:14px 16px;font-size:13px;line-height:22px}.S1NWwG_group{flex-direction:column;gap:8px;display:flex}.S1NWwG_groupLabel{text-transform:uppercase;letter-spacing:.06em;color:var(--dsw-alias-label-tertiary);margin:4px 0 0;font-size:11px;font-weight:600}.S1NWwG_cards{flex-direction:column;gap:10px;display:flex}.S1NWwG_card{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);text-align:left;cursor:pointer;width:100%;transition:border-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease), background var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease);border-radius:12px;flex-direction:column;gap:4px;margin:0;padding:14px 16px;font-family:inherit;display:flex}.S1NWwG_card:hover:not(:disabled){border-color:var(--dsw-alias-border-l2)}.S1NWwG_card:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.S1NWwG_card[data-active=true]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}.S1NWwG_card:disabled{cursor:default;opacity:.6}.S1NWwG_cardHead{align-items:center;gap:10px;display:flex}.S1NWwG_cardName{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600}.S1NWwG_cardDesc{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;font-size:12px;line-height:19px}.S1NWwG_cardMeta{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary);margin-top:2px;font-size:11px;line-height:17px}.S1NWwG_note{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px}";
		const tagId = "@guowenzhang/dsh-ui-beautify/FontSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var FontSection_module_css_default = {
			"card": "S1NWwG_card",
			"cardDesc": "S1NWwG_cardDesc",
			"cardHead": "S1NWwG_cardHead",
			"cardMeta": "S1NWwG_cardMeta",
			"cardName": "S1NWwG_cardName",
			"cards": "S1NWwG_cards",
			"group": "S1NWwG_group",
			"groupLabel": "S1NWwG_groupLabel",
			"intro": "S1NWwG_intro",
			"note": "S1NWwG_note",
			"panel": "S1NWwG_panel",
			"section": "S1NWwG_section"
		};
		//#endregion
		//#region src/client/FontSection.tsx
		/**
		* Copy keys per choice id. The registry in `fonts.ts` owns the ids and families;
		* the wording lives in the locale dictionary, so this table is the one place
		* the two meet. The system default is a choice like any other here — it is the
		* only one that downloads no face.
		*/
		const CHOICE_COPY = {
			system: {
				name: "fontSystem",
				desc: "fontSystemDesc"
			},
			"noto-sans-sc": {
				name: "fontNotoSansSc",
				desc: "fontNotoSansScDesc"
			},
			"noto-serif-sc": {
				name: "fontNotoSerifSc",
				desc: "fontNotoSerifScDesc"
			},
			"lxgw-wenkai": {
				name: "fontLxgwWenkai",
				desc: "fontLxgwWenkaiDesc"
			},
			"lxgw-wenkai-tc": {
				name: "fontLxgwWenkaiTc",
				desc: "fontLxgwWenkaiTcDesc"
			},
			"zcool-xiaowei": {
				name: "fontZcoolXiaowei",
				desc: "fontZcoolXiaoweiDesc"
			},
			"zcool-kuaile": {
				name: "fontZcoolKuaile",
				desc: "fontZcoolKuaileDesc"
			},
			"ma-shan-zheng": {
				name: "fontMaShanZheng",
				desc: "fontMaShanZhengDesc"
			},
			"zhi-mang-xing": {
				name: "fontZhiMangXing",
				desc: "fontZhiMangXingDesc"
			},
			inter: {
				name: "fontInter",
				desc: "fontInterDesc"
			},
			geist: {
				name: "fontGeist",
				desc: "fontGeistDesc"
			}
		};
		/**
		* The picker's blocks, in presentation order.
		*
		* The system default opens on its own because it is the baseline the rest
		* depart from; the catalogue then splits into the two writing systems a face
		* can cover.
		*/
		const BLOCKS = [
			{
				label: "groupSystem",
				ids: [SYSTEM_FONT_ID]
			},
			{
				label: "groupCjk",
				ids: FONT_FACES.filter((face) => face.group === "cjk").map((face) => face.id)
			},
			{
				label: "groupLatin",
				ids: FONT_FACES.filter((face) => face.group === "latin").map((face) => face.id)
			}
		];
		/** The unit a byte count is shown in, named by its dictionary key. */
		function byteSize(bytes) {
			if (bytes >= 1024 ** 3) return {
				value: (bytes / 1024 ** 3).toFixed(1),
				unit: "unitGb"
			};
			if (bytes >= 1024 ** 2) return {
				value: (bytes / 1024 ** 2).toFixed(1),
				unit: "unitMb"
			};
			return {
				value: String(Math.max(1, Math.round(bytes / 1024))),
				unit: "unitKb"
			};
		}
		/**
		* The cache line under one card.
		*
		* A face no stylesheet has been cached for has downloaded nothing at all: the
		* stylesheet is what names the shards, so its absence is the honest answer
		* rather than a zero byte count.
		* @param t - this section's translate seat.
		* @param usage - what the Host reported for this face, if anything.
		* @returns the line's text.
		*/
		function cacheLabel(t, usage) {
			if (usage === void 0 || usage.shardsTotal === 0) return t("cacheAbsent");
			const size = byteSize(usage.bytes);
			return t("cachePresent", {
				size: `${size.value} ${t(size.unit)}`,
				cached: usage.shardsCached,
				total: usage.shardsTotal
			});
		}
		/** The settings section body. */
		function FontSection(props) {
			const { useFontSettings, t, choose, refreshCache } = props;
			const state = useFontSettings((snapshot) => snapshot);
			const disabled = !state.available || !state.writable;
			(0, react.useEffect)(() => {
				refreshCache();
			}, [refreshCache]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: FontSection_module_css_default.section,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: FontSection_module_css_default.panel,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: FontSection_module_css_default.intro,
							children: t("intro")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: FontSection_module_css_default.note,
							children: t("cacheHint")
						}),
						BLOCKS.map(({ label, ids }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: FontSection_module_css_default.group,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: FontSection_module_css_default.groupLabel,
								children: t(label)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: FontSection_module_css_default.cards,
								children: ids.map((id) => {
									const copy = CHOICE_COPY[id];
									if (copy === void 0) return null;
									const active = id === state.font;
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: FontSection_module_css_default.card,
										"data-active": active,
										"aria-pressed": active,
										disabled,
										onClick: () => {
											choose(id);
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: FontSection_module_css_default.cardHead,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: FontSection_module_css_default.cardName,
													children: t(copy.name)
												}), active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
													tone: "success",
													children: t("active")
												}) : null]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: FontSection_module_css_default.cardDesc,
												children: t(copy.desc)
											}),
											id === "system" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: FontSection_module_css_default.cardMeta,
												children: cacheLabel(t, state.cache[id])
											})
										]
									}, id);
								})
							})]
						}, label)),
						!state.available ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: FontSection_module_css_default.note,
							children: t("unavailable")
						}) : null,
						state.available && !state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: FontSection_module_css_default.note,
							children: t("readonly")
						}) : null
					]
				})
			});
		}
		//#endregion
		//#region src/client/settings-controller.ts
		/**
		* Controller bridging the Host `ui-beautify` settings namespace and its cache
		* read-out onto the Page beautification section snapshot.
		*
		* It reads the stored face id, writes a new one through the settings form, and
		* carries what the local cache holds for each face. Applying a choice to the
		* document is not this class's job — the plugin body owns that, so the section
		* can render a snapshot without touching the DOM.
		*
		* The cache reading is a sample, not a subscription: the Host answers when
		* asked, and the section asks when it opens and shortly after a choice lands,
		* which is when a download has had time to put something on disk.
		*
		* @module @guowenzhang/dsh-ui-beautify/client/settings-controller
		*/
		/**
		* How long after a committed choice the cache is read again.
		*
		* Applying a face is what starts its download, so the read that follows the
		* click has to wait long enough for the first files to land.
		*/
		const CACHE_REREAD_DELAY_MS = 1500;
		/** Owner handle over the `ui-beautify` namespace and its cache read-out. */
		var FontController = class {
			scope;
			store;
			unsubscribe;
			cache = {};
			pending;
			/**
			* @param scope - the `ui-beautify` configuration form.
			*/
			constructor(scope) {
				this.scope = scope;
				this.store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(this.projection());
				this.unsubscribe = scope.subscribe(() => {
					this.publish();
					this.scheduleCacheRead();
				});
			}
			/** Stop observing settings and drop the pending cache read. */
			dispose() {
				this.unsubscribe();
				if (this.pending !== void 0) clearTimeout(this.pending);
			}
			/** Build the renderer face for this section. */
			inject() {
				return {
					hooks: { fontSettings: this.store },
					choose: (id) => {
						this.choose(id);
					},
					refreshCache: () => {
						this.refreshCache();
					}
				};
			}
			/** Read the cache once and publish what it holds. */
			refreshCache() {
				this.read();
			}
			async read() {
				let report;
				try {
					const response = await fetch(CACHE_ROUTE, { headers: { accept: "application/json" } });
					if (!response.ok) return;
					report = (await response.json()).faces ?? {};
				} catch {
					return;
				}
				this.cache = report;
				this.publish();
			}
			scheduleCacheRead() {
				if (this.pending !== void 0) clearTimeout(this.pending);
				this.pending = setTimeout(() => {
					this.pending = void 0;
					this.refreshCache();
				}, CACHE_REREAD_DELAY_MS);
			}
			choose(id) {
				const snapshot = this.scope.getSnapshot();
				if (snapshot.status !== "ready" || !snapshot.writable) return;
				if (snapshot.value?.font === id) return;
				this.scope.set("font", id);
			}
			projection() {
				const snapshot = this.scope.getSnapshot();
				return {
					available: snapshot.status === "ready",
					writable: snapshot.writable,
					font: resolveFontChoice(snapshot.value?.font),
					cache: this.cache
				};
			}
			publish() {
				this.store.set(this.projection());
			}
		};
		//#endregion
		//#region src/client/index.ts
		/** Identity of this plugin's stylesheet link and its theme override layer. */
		const PLUGIN_ID = "@guowenzhang/dsh-ui-beautify";
		/**
		* Required services: the theme service owns the token override, slots and locale
		* carry the section, and the configuration forms service is where the choice lives.
		*/
		const inject = [
			"theme",
			"slots",
			"locale",
			"configForms"
		];
		/**
		* Client plugin body: register the section and keep the document in sync with
		* the stored choice.
		* @param ctx - client cordis context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-beautify: dictionaries");
			const t = ctx.locale.bind(NS);
			const scope = ctx.configForms.get(FONT_SETTINGS_NS);
			const controller = new FontController(scope);
			ctx.effect(() => () => {
				controller.dispose();
			}, "ui-beautify: settings form");
			ctx.effect(() => applyBodyFont(ctx, scope), "ui-beautify: body font");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "ui-beautify",
				order: 12,
				label: () => t("nav"),
				locale: NS,
				inject: () => controller.inject()
			}, FontSection));
		}
		/**
		* Point the document at the stored choice and keep it there.
		*
		* The stylesheet links and the token override are swapped together on every
		* committed change, so the document never references a family whose shards are
		* not being served. The system default applies neither: it drops both and lets
		* `--dsw-font-family` resolve to ui-theme's own declaration, which is the only
		* way "off" tracks that declaration instead of freezing a copy of it.
		*
		* The first sync runs before the scope is ready, which resolves to the default
		* choice — the same one a fresh install shows, so nothing shifts once the
		* durable value arrives.
		* @param ctx - client cordis context owning the effect.
		* @param scope - the `ui-beautify` configuration form holding the choice.
		* @returns disposer removing the links, the override, and the subscription.
		*/
		function applyBodyFont(ctx, scope) {
			let applied;
			let releaseTokens;
			let links = [];
			const detach = () => {
				releaseTokens?.();
				releaseTokens = void 0;
				for (const link of links) link.remove();
				links = [];
			};
			const sync = () => {
				const choice = resolveFontChoice(scope.getSnapshot().value?.font);
				if (choice === applied) return;
				applied = choice;
				detach();
				const face = faceById(choice);
				if (face === void 0) return;
				links = face.source.sheets.map((sheet) => {
					const link = document.createElement("link");
					link.rel = "stylesheet";
					link.dataset.plugin = PLUGIN_ID;
					link.href = `${FONTS_ROUTE}/${face.id}/${sheet}`;
					document.head.appendChild(link);
					return link;
				});
				releaseTokens = ctx.theme.overrideTokens(PLUGIN_ID, { "--dsw-font-family": {
					light: fontStack(face),
					dark: fontStack(face)
				} });
			};
			sync();
			const stop = scope.subscribe(sync);
			return () => {
				stop();
				detach();
			};
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
