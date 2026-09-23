window.__ModuleLoader__.load({
	id: "@guowenzhang/dsh-ui-beautify",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		//#region src/fonts.ts
		/**
		* The body-font choices, and the one fallback chain the bundled ones end with.
		*
		* Both halves read this table: the Host half serves every bundled face's shards
		* and validates the stored choice against these ids, and the Client half renders
		* the picker from it and resolves an id to the family it must put in
		* `--dsw-font-family`. Adding a face means adding one row here plus its
		* `assets/fonts/<dir>/` directory — nothing else in the plugin enumerates faces.
		*
		* The list holds one choice that is not a bundled face: the system default,
		* which leaves the interface's own font stack untouched rather than overriding
		* it with an equivalent one. Keeping it a real choice means "off" is reachable
		* from the picker instead of requiring the plugin to be uninstalled.
		*/
		/** The stack every bundled face falls back to, matching ui-theme's own default. */
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
		* Id of the choice that applies no bundled face at all.
		*
		* Selecting it removes the stylesheet link and the token override, so
		* `--dsw-font-family` resolves to whatever ui-theme declares. That is
		* deliberately not the same as overriding the token with a copy of ui-theme's
		* stack: a copy would freeze today's default into this plugin and stop
		* following it.
		*/
		const SYSTEM_FONT_ID = "system";
		/** Every face this plugin ships, in the order the picker presents them. */
		const BUNDLED_FACES = [{
			id: "noto-sans-sc",
			dir: "noto-sans-sc",
			family: "Noto Sans SC Variable"
		}, {
			id: "lxgw-wenkai",
			dir: "lxgw-wenkai",
			family: "LXGW WenKai"
		}];
		/**
		* Every id the picker offers and the settings schema accepts, in presentation
		* order. The system default leads: it is the baseline the others depart from.
		*/
		const FONT_CHOICES = [SYSTEM_FONT_ID, ...BUNDLED_FACES.map((face) => face.id)];
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
		* Resolve one choice to the bundled face it applies.
		* @param id - a member of {@link FONT_CHOICES}.
		* @returns the matching face, or undefined for the system default.
		*/
		function bundledFaceById(id) {
			return BUNDLED_FACES.find((face) => face.id === id);
		}
		/**
		* The value written into `--dsw-font-family` for one bundled face.
		* @param face - the face to build a stack for.
		* @returns the bundled family followed by the shared fallback chain.
		*/
		function fontStack(face) {
			return `'${face.family}', ${FALLBACK_STACK}`;
		}
		//#endregion
		//#region src/params.ts
		/**
		* The identities both halves must agree on: where the faces are served from, and
		* which settings namespace records the choice.
		*
		* Nothing here may import a Host-only package. The Client half reads this file,
		* so anything added has to stay resolvable in the browser bundle.
		*
		* The route lives under `/plugins` because that is the origin the app already
		* serves plugin-owned assets from, and `webServer` resolves it
		* longest-prefix-first, so it wins over the client-modules bundle route on
		* `/plugins`. Every face is served beneath it as `<FONTS_ROUTE>/<dir>/…`.
		*/
		/** URL prefix the bundled font directory is served under, with no trailing slash. */
		const FONTS_ROUTE = "/plugins/dsh-ui-beautify/fonts";
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
		* seat; the component itself carries no fallback strings.
		*
		* @module @guowenzhang/dsh-ui-beautify/client/locales
		*/
		/** Dictionary namespace owning this section's copy. */
		const NS = "settings.uiBeautify";
		/** English copy. */
		const en = {
			nav: "Page beautification",
			intro: "Choose the typeface the interface uses for body text. The fonts ship with this plugin, so no system installation is needed.",
			fontSection: "Body font",
			fontSystem: "System default",
			fontSystemDesc: "Applies no bundled font. The interface keeps whatever stack DeepSeek Harness ships with, so it follows upstream changes.",
			fontNotoSansSc: "Source Han Sans",
			fontNotoSansScDesc: "Sans-serif. Even stroke weight and squared-off forms; the most neutral choice for interface text.",
			fontLxgwWenkai: "LXGW WenKai",
			fontLxgwWenkaiDesc: "Handwritten kai style. Warmer and easier to read in long prose, at the cost of a heavier download.",
			active: "In use",
			unavailable: "The Host settings service is unavailable, so this choice cannot be saved.",
			readonly: "The settings document is read-only, so this choice cannot be saved.",
			loading: "Loading the font…"
		};
		/** Chinese copy. */
		const zh = {
			nav: "页面美化",
			intro: "选择界面正文使用的字体。字体随插件分发，无需在系统里安装。",
			fontSection: "正文字体",
			fontSystem: "系统默认",
			fontSystemDesc: "不应用任何内置字体。界面沿用 DeepSeek Harness 自带的系统字体栈，因此会跟随上游的变化。",
			fontNotoSansSc: "思源黑体",
			fontNotoSansScDesc: "无衬线。笔画粗细均匀、字形方正，界面文本最中性稳妥的选择。",
			fontLxgwWenkai: "霞鹜文楷",
			fontLxgwWenkaiDesc: "手写楷体。长文阅读更温润舒适，代价是首次下载体积更大。",
			active: "使用中",
			unavailable: "宿主设置服务不可用，该选择无法保存。",
			readonly: "设置文档为只读，该选择无法保存。",
			loading: "字体加载中…"
		};
		//#endregion
		//#region \0dsh-css:C:\02-codespace\deepseek-harness\dsh-ui-beautify\src\client\FontSection.module.css.mjs
		const css = ".S1NWwG_section{flex-direction:column;gap:16px;width:100%;max-width:720px;display:flex}.S1NWwG_panel{flex-direction:column;gap:16px;display:flex}.S1NWwG_intro{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;border-radius:12px;margin:0;padding:14px 16px;font-size:13px;line-height:22px}.S1NWwG_groupLabel{text-transform:uppercase;letter-spacing:.06em;color:var(--dsw-alias-label-tertiary);margin:4px 0 0;font-size:11px;font-weight:600}.S1NWwG_cards{flex-direction:column;gap:10px;display:flex}.S1NWwG_card{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);text-align:left;cursor:pointer;width:100%;transition:border-color var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease), background var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease);border-radius:12px;flex-direction:column;gap:4px;margin:0;padding:14px 16px;font-family:inherit;display:flex}.S1NWwG_card:hover:not(:disabled){border-color:var(--dsw-alias-border-l2)}.S1NWwG_card:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.S1NWwG_card[data-active=true]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}.S1NWwG_card:disabled{cursor:default;opacity:.6}.S1NWwG_cardHead{align-items:center;gap:10px;display:flex}.S1NWwG_cardName{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600}.S1NWwG_cardDesc{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;font-size:12px;line-height:19px}.S1NWwG_note{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px}";
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
			"cardName": "S1NWwG_cardName",
			"cards": "S1NWwG_cards",
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
		* only one that applies no bundled face.
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
			"lxgw-wenkai": {
				name: "fontLxgwWenkai",
				desc: "fontLxgwWenkaiDesc"
			}
		};
		/** The settings section body. */
		function FontSection(props) {
			const { useFontSettings, t, choose } = props;
			const state = useFontSettings((snapshot) => snapshot);
			const disabled = !state.available || !state.writable;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: FontSection_module_css_default.section,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: FontSection_module_css_default.panel,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: FontSection_module_css_default.intro,
							children: t("intro")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: FontSection_module_css_default.groupLabel,
							children: t("fontSection")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: FontSection_module_css_default.cards,
							children: FONT_CHOICES.map((id) => {
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
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: FontSection_module_css_default.cardHead,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: FontSection_module_css_default.cardName,
											children: t(copy.name)
										}), active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
											tone: "success",
											children: t("active")
										}) : null]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: FontSection_module_css_default.cardDesc,
										children: t(copy.desc)
									})]
								}, id);
							})
						}),
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
		* Controller bridging the Host `ui-beautify` settings namespace onto the Page
		* beautification section snapshot.
		*
		* It reads the stored face id and writes a new one through the settings form.
		* Applying a choice to the document is not this class's job — the plugin body
		* owns that, so the section can render a snapshot without touching the DOM.
		*
		* @module @guowenzhang/dsh-ui-beautify/client/settings-controller
		*/
		/** Owner handle over the `ui-beautify` namespace. */
		var FontController = class {
			scope;
			store;
			unsubscribe;
			/**
			* @param scope - the `ui-beautify` configuration form.
			*/
			constructor(scope) {
				this.scope = scope;
				this.store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(this.projection());
				this.unsubscribe = scope.subscribe(() => {
					this.publish();
				});
			}
			/** Stop observing settings. */
			dispose() {
				this.unsubscribe();
			}
			/** Build the renderer face for this section. */
			inject() {
				return {
					hooks: { fontSettings: this.store },
					choose: (id) => {
						this.choose(id);
					}
				};
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
					font: resolveFontChoice(snapshot.value?.font)
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
		* The stylesheet link and the token override are swapped together on every
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
		* @returns disposer removing the link, the override, and the subscription.
		*/
		function applyBodyFont(ctx, scope) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.dataset.plugin = PLUGIN_ID;
			document.head.appendChild(link);
			let applied;
			let releaseTokens;
			const sync = () => {
				const choice = resolveFontChoice(scope.getSnapshot().value?.font);
				if (choice === applied) return;
				applied = choice;
				releaseTokens?.();
				releaseTokens = void 0;
				link.removeAttribute("href");
				const face = bundledFaceById(choice);
				if (face === void 0) return;
				link.href = `${FONTS_ROUTE}/${face.dir}/index.css`;
				releaseTokens = ctx.theme.overrideTokens(PLUGIN_ID, { "--dsw-font-family": {
					light: fontStack(face),
					dark: fontStack(face)
				} });
			};
			sync();
			const stop = scope.subscribe(sync);
			return () => {
				stop();
				releaseTokens?.();
				link.remove();
			};
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
