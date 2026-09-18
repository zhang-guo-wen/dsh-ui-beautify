window.__ModuleLoader__.load({
	id: "@zhang-guo-wen/dsh-ui-beautify",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region src/params.ts
		/**
		* The URL and font-family identities both halves must agree on.
		*
		* The route lives under `/plugins` because that is the origin the app already
		* serves plugin-owned assets from, and `webServer` resolves it longest-prefix-first,
		* so it wins over the client-modules bundle route on `/plugins`.
		*/
		/** URL prefix the bundled font directory is served under, with no trailing slash. */
		const FONTS_ROUTE = "/plugins/dsh-ui-beautify/fonts";
		/**
		* The full stack written into `--dsw-font-family`. The bundled family comes
		* first; everything after it is ui-theme's own fallback chain, kept so the GUI
		* still renders while the shards load and if they never arrive.
		*/
		const FONT_STACK = `'Noto Sans SC Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
		//#endregion
		//#region src/client/index.ts
		/** Identity of this plugin's stylesheet link and its theme override layer. */
		const PLUGIN_ID = "@zhang-guo-wen/dsh-ui-beautify";
		/**
		* The font override is applied through the theme service, which writes it as an
		* inline style on `body` — the only layer that outranks the `:root` declaration
		* in ui-theme's own sheet regardless of plugin activation order. Wait for it.
		*/
		const inject = ["theme"];
		/**
		* Client plugin body: link the shard stylesheet, then rebind the body font.
		* @param ctx - client cordis context.
		*/
		function apply(ctx) {
			ctx.effect(() => {
				const link = document.createElement("link");
				link.rel = "stylesheet";
				link.href = `${FONTS_ROUTE}/index.css`;
				link.dataset.plugin = PLUGIN_ID;
				document.head.appendChild(link);
				return () => {
					link.remove();
				};
			}, "ui-beautify: font shard stylesheet");
			ctx.effect(() => ctx.theme.overrideTokens(PLUGIN_ID, { "--dsw-font-family": {
				light: FONT_STACK,
				dark: FONT_STACK
			} }), "ui-beautify: body font family");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
