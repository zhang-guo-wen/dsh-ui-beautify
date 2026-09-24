window.__ModuleLoader__.load({
	id: "@guowenzhang/dsh-ui-beautify",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		//#region src/fonts.ts
		/**
		* The font catalogue: every face the pickers offer, the CDN source each is
		* downloaded from, and the token each role rebinds.
		*
		* The plugin ships no font bytes. A row names an npm package and a pinned
		* version, so the Host half can fetch one stylesheet or one shard the first time
		* the browser asks for it and cache it afterwards. Adding a face means adding
		* one row here plus its copy in `src/client/locales.ts` — the picker, the
		* settings validation, and the download route all read this table.
		*
		* A *role* is one independently configured font slot: the interface's body text
		* and its code text are set separately, because a face that reads well in prose
		* is not the one that keeps a table of columns aligned. Each role owns its
		* catalogue, its fallback, and the custom properties it rebinds.
		*
		* Both halves read this module, so nothing added here may import a Host-only
		* package: the Client half bundles it into the browser.
		*/
		/** The stack the body faces fall back to, matching ui-theme's own declaration. */
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
		* The stack the code faces fall back to.
		*
		* This repeats ui-theme's `--ds-font-family-code` value rather than reaching for
		* it: the override is an inline style on `body`, so a `var()` pointing back at
		* the token it replaces would resolve to itself. It ends in `monospace` because
		* this stack is only ever used behind a downloaded face, never as the token's
		* own value — ui-theme omits that tail for Windows CJK reasons.
		*/
		const CODE_FALLBACK_STACK = [
			"'SF Mono'",
			"'JetBrains Mono'",
			"'Fira Code'",
			"Consolas",
			"'Liberation Mono'",
			"Menlo",
			"Courier",
			"monospace"
		].join(", ");
		/**
		* Id of the choice that downloads nothing at all.
		*
		* Selecting it removes the stylesheet links and the token override, so the
		* token resolves to whatever ui-theme declares. That is deliberately not the
		* same as overriding the token with a copy of ui-theme's stack: a copy would
		* freeze today's default into this plugin and stop following it.
		*/
		const SYSTEM_FONT_ID = "system";
		/**
		* The two roles, and the one place each of their differences lives.
		*
		* `--dsw-font-mono` is not declared by ui-theme today, and four components read
		* it with a fallback. Rebinding it alongside `--ds-font-family-code` costs
		* nothing and closes that gap, so the code choice reaches those components too.
		*/
		const FONT_ROLES = {
			body: {
				key: "font",
				tokens: ["--dsw-font-family"],
				fallback: FALLBACK_STACK,
				faces: [
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
						id: "lxgw-wenkai-screen",
						family: "LXGW WenKai Screen",
						group: "cjk",
						source: {
							package: "lxgw-wenkai-screen-webfont",
							version: "1.7.0",
							sheets: ["lxgwwenkaiscreen.css"]
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
						id: "zcool-qingke-huangyou",
						family: "ZCOOL QingKe HuangYou",
						group: "cjk",
						source: {
							package: "@fontsource/zcool-qingke-huangyou",
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
						id: "long-cang",
						family: "Long Cang",
						group: "cjk",
						source: {
							package: "@fontsource/long-cang",
							version: "5.3.0",
							sheets: ["index.css"]
						}
					},
					{
						id: "liu-jian-mao-cao",
						family: "Liu Jian Mao Cao",
						group: "cjk",
						source: {
							package: "@fontsource/liu-jian-mao-cao",
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
				],
				defaultId: "noto-sans-sc"
			},
			code: {
				key: "codeFont",
				tokens: ["--ds-font-family-code", "--dsw-font-mono"],
				fallback: CODE_FALLBACK_STACK,
				faces: [
					{
						id: "jetbrains-mono",
						family: "JetBrains Mono Variable",
						group: "latin",
						source: {
							package: "@fontsource-variable/jetbrains-mono",
							version: "5.3.0",
							sheets: ["index.css"]
						}
					},
					{
						id: "fira-code",
						family: "Fira Code Variable",
						group: "latin",
						source: {
							package: "@fontsource-variable/fira-code",
							version: "5.3.0",
							sheets: ["index.css"]
						}
					},
					{
						id: "geist-mono",
						family: "Geist Mono Variable",
						group: "latin",
						source: {
							package: "@fontsource-variable/geist-mono",
							version: "5.3.0",
							sheets: ["index.css"]
						}
					},
					{
						id: "noto-sans-mono",
						family: "Noto Sans Mono Variable",
						group: "latin",
						source: {
							package: "@fontsource-variable/noto-sans-mono",
							version: "5.3.0",
							sheets: ["index.css"]
						}
					},
					{
						id: "maple-mono-cn",
						family: "Maple Mono CN",
						group: "cjk",
						source: {
							package: "@mogeko/maple-mono-cn",
							version: "7.9.0",
							sheets: ["dist/font/result.css"]
						}
					}
				],
				defaultId: SYSTEM_FONT_ID
			}
		};
		FONT_ROLES.body.defaultId;
		FONT_ROLES.code.defaultId;
		/**
		* Every id one picker offers and the settings schema accepts, in presentation
		* order. The system default leads: it is the baseline the others depart from.
		* @param role - the role whose choices are listed.
		* @returns that role's ids.
		*/
		function choicesFor(role) {
			return [SYSTEM_FONT_ID, ...FONT_ROLES[role].faces.map((face) => face.id)];
		}
		choicesFor("body");
		choicesFor("code");
		/**
		* Resolve one stored value to a choice the picker and the applier both accept.
		*
		* A settings document is hand-editable, so an unknown id is a real input rather
		* than a type error: it resolves to the role's default instead of failing the
		* read or leaving the interface on a face nobody offers.
		* @param id - a stored value, or undefined when nothing is stored.
		* @param role - the role the value belongs to.
		* @returns a member of that role's choices.
		*/
		function resolveFontChoice(id, role) {
			return id !== void 0 && choicesFor(role).includes(id) ? id : FONT_ROLES[role].defaultId;
		}
		/**
		* Resolve one choice to the face it downloads.
		* @param id - a member of the role's choices.
		* @param role - the role the id belongs to.
		* @returns the matching face, or undefined for the system default.
		*/
		function faceById(id, role) {
			return FONT_ROLES[role].faces.find((face) => face.id === id);
		}
		/**
		* The value written into one of a role's tokens for a face.
		* @param face - the face to build a stack for.
		* @param role - the role whose fallback stack is appended.
		* @returns the downloaded family followed by that role's fallback chain.
		*/
		function fontStack(face, role) {
			return `'${face.family}', ${FONT_ROLES[role].fallback}`;
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
		//#region src/client/output-rate.ts
		/** How far back a rate reading averages, in milliseconds. */
		const RATE_WINDOW_MS = 900;
		/**
		* Characters per second at which the cyclist covers half of its speed range.
		*
		* Roughly 70 tokens per second at ordinary prose density, so the interesting
		* band of real output speeds lands across the middle of the curve rather than
		* pinned at either end.
		*/
		const SPEED_HALF_POINT = 220;
		/** Crossing time with nothing streaming: the cyclist keeps looping regardless. */
		const CRUISE_SPANS_PER_SECOND = .06;
		/**
		* Characters one assistant block contributes to the reading.
		*
		* Tool arguments are model output and stream the same way as prose, so they
		* count; images and unmodelled blocks are not text the model wrote.
		* @param block - one block of the in-flight assistant output.
		* @returns its character count.
		*/
		function blockChars(block) {
			switch (block.kind) {
				case "text":
				case "reasoning": return block.text.length;
				case "tool-call": return block.name.length + block.argsRaw.length;
				case "image":
				case "other": return 0;
			}
		}
		/**
		* Characters the in-flight assistant output has produced so far.
		* @param partial - the Chat target's streaming accumulator, or null between steps.
		* @returns the summed character count, 0 while nothing is streaming.
		*/
		function outputChars(partial) {
			if (partial === null) return 0;
			let total = 0;
			for (const block of partial.blocks) total += blockChars(block);
			return total;
		}
		/**
		* Fold one observation into the sample window.
		*
		* A count *below* the window's last one is a new step starting its own
		* accumulator, not negative output, so the window restarts instead of reading
		* the drop as negative speed.
		* @param samples - the current window, oldest first.
		* @param chars - output characters observed now.
		* @param time - observation time in `performance.now()` milliseconds.
		* @returns the window to use next, never spanning more than the rate window.
		*/
		function observeOutput(samples, chars, time) {
			const last = samples.at(-1);
			return [...last !== void 0 && chars < last.chars ? [] : samples.filter((sample) => sample.time > time - RATE_WINDOW_MS), {
				time,
				chars
			}];
		}
		/**
		* Output speed across the recent window.
		*
		* The elapsed time runs to `now` rather than to the newest sample, so a stream
		* that stopped decays to zero instead of freezing at its last reading.
		* @param samples - the window from {@link observeOutput}.
		* @param now - reading time in `performance.now()` milliseconds.
		* @returns characters per second, 0 before two samples bracket any output.
		*/
		function charsPerSecond(samples, now) {
			const last = samples.at(-1);
			const first = samples[0];
			if (last === void 0 || first === void 0) return 0;
			const elapsed = (now - first.time) / 1e3;
			if (elapsed <= 0) return 0;
			return Math.max(0, last.chars - first.chars) / elapsed;
		}
		/**
		* Turn an output rate into how fast the cyclist crosses the lane.
		*
		* The curve saturates rather than clamping: every further increase in output
		* speed still moves the cyclist a little faster, so a fast stream never looks
		* identical to a slightly faster one. Nothing streaming falls to the cruise
		* bound, which keeps the figure looping.
		* @param charsPerSecond - recent output speed from {@link charsPerSecond}.
		* @returns lane spans per second, between the cruise and sprint bounds.
		*/
		function laneSpeed(charsPerSecond) {
			const share = charsPerSecond / (charsPerSecond + SPEED_HALF_POINT);
			return CRUISE_SPANS_PER_SECOND + .44 * share;
		}
		//#endregion
		//#region \0dsh-css:C:\02-codespace\deepseek-harness\dsh-ui-beautify\src\client\BikeLane.module.css.mjs
		const css$1 = ".wtM5EW_lane{width:calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));max-width:calc(var(--dsh-composer-card-max-width) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));height:36px;color:var(--dsw-alias-label-tertiary);pointer-events:none;margin:0 auto;position:relative;overflow:hidden}.wtM5EW_rider{will-change:transform;width:66px;height:36px;position:absolute;top:0;left:0}.wtM5EW_bike{fill:none;stroke:currentColor;stroke-width:2px;stroke-linecap:round;stroke-linejoin:round;width:66px;height:36px;display:block}.wtM5EW_wheel{stroke-width:1.5px}.wtM5EW_frame{stroke-width:2.2px}.wtM5EW_riderBody{stroke-width:3px}.wtM5EW_crank{stroke-width:1.4px}.wtM5EW_leg{stroke-width:2.2px}.wtM5EW_legFar{opacity:.5}";
		const tagId$1 = "@guowenzhang/dsh-ui-beautify/BikeLane.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var BikeLane_module_css_default = {
			"bike": "wtM5EW_bike",
			"crank": "wtM5EW_crank",
			"frame": "wtM5EW_frame",
			"lane": "wtM5EW_lane",
			"leg": "wtM5EW_leg",
			"legFar": "wtM5EW_legFar",
			"rider": "wtM5EW_rider",
			"riderBody": "wtM5EW_riderBody",
			"wheel": "wtM5EW_wheel"
		};
		//#endregion
		//#region src/client/BikeLane.tsx
		/**
		* Drawing box the markup's `viewBox` declares.
		*
		* Every coordinate below is in these units; only the two rendered sizes are in
		* pixels, and `BikeLane.module.css` fixes those to the constants here.
		*/
		const VIEWBOX_WIDTH = 110;
		/** Rendered width of the cyclist, matching `.rider`/`.bike` in the stylesheet. */
		const BIKE_WIDTH_PX = 66;
		/** Rendered wheel radius: the drawing's radius scaled to that width. */
		const WHEEL_RADIUS_PX = 13 * (BIKE_WIDTH_PX / VIEWBOX_WIDTH);
		/** Wheel radius in drawing units. */
		const WHEEL_RADIUS = 13;
		/**
		* Rear hub, front hub, and the crank the legs turn around, in drawing units.
		*
		* The wheelbase is a little under five radii, which is what a real bicycle
		* measures; stretching it is what makes a drawn bike read as two circles joined
		* by a bar.
		*/
		const REAR_HUB = {
			x: 22,
			y: 45
		};
		const FRONT_HUB = {
			x: 84,
			y: 45
		};
		const CRANK = {
			x: 54,
			y: 43
		};
		/**
		* Hip joint both legs hang from; it sits on the saddle.
		*
		* The torso rises from here to a shoulder near the bars, so the rider occupies
		* about a third of the drawing's height. Anything less and the figure reads as a
		* head floating over a frame at the size this lane renders.
		*/
		const HIP = {
			x: 42,
			y: 22
		};
		/** Pedal circle radius in drawing units. */
		const CRANK_RADIUS = 7;
		/** How far the knee bows off the hip-to-pedal line, in drawing units. */
		const KNEE_BULGE = 5;
		/**
		* Longest step an animation frame may advance, in seconds.
		*
		* A backgrounded tab stops delivering frames; without this the cyclist would
		* teleport the whole elapsed distance the moment the tab is focused again.
		*/
		const MAX_FRAME_SECONDS = .1;
		/** Frame and saddle: rear triangle, down and top tubes, fork, bars, saddle. */
		const FRAME_PATH = [
			"M22 45 L54 43 L42 23 Z",
			"M54 43 L79 19",
			"M42 23 L79 19",
			"M79 19 L84 45",
			"M76 14 L85 17",
			"M79 19 L81 15",
			"M36 23 L48 22"
		].join(" ");
		/**
		* The rider's torso and the arm reaching the bars.
		*
		* The head is drawn separately, one radius past the shoulder rather than on it:
		* a head centred on the joint turns the whole figure into a line ending in a
		* circle, which at this size is the difference between a cyclist and a lollipop.
		*/
		const RIDER_PATH = "M42 22 L63 12 M63 12 L82 15.5";
		/** Head centre and radius, sitting forward of and above the shoulder. */
		const HEAD = {
			x: 69,
			y: 7,
			r: 4.4
		};
		/**
		* Read by `useChat`: how many characters the open step has produced.
		* @param snapshot - current Chat target snapshot.
		* @returns the in-flight assistant output's character count.
		*/
		function selectOutputChars(snapshot) {
			return outputChars(snapshot.legacy.partial);
		}
		/**
		* The four spoke diameters inside one wheel.
		* @param hub - wheel centre in drawing units.
		* @returns a path drawn through the hub at 45° steps.
		*/
		function spokes(hub) {
			const reach = 11.5;
			const parts = [];
			for (let turn = 0; turn < 4; turn += 1) {
				const angle = Math.PI / 4 * turn;
				const dx = Math.cos(angle) * reach;
				const dy = Math.sin(angle) * reach;
				parts.push(`M${hub.x - dx} ${hub.y - dy} L${hub.x + dx} ${hub.y + dy}`);
			}
			return parts.join(" ");
		}
		/**
		* One leg at a given crank angle.
		*
		* The knee is placed on the hip-to-pedal line bowed forwards rather than solved
		* properly: at this size the difference is invisible, and the bow is the whole
		* reason a pedalling pair reads as legs instead of a stick.
		* @param phase - crank angle in radians.
		* @returns the leg's polyline points, hip then knee then foot.
		*/
		function legPoints(phase) {
			const footX = CRANK.x + CRANK_RADIUS * Math.sin(phase);
			const footY = CRANK.y + CRANK_RADIUS * Math.cos(phase);
			const dx = footX - HIP.x;
			const dy = footY - HIP.y;
			const reach = Math.hypot(dx, dy);
			const kneeX = (HIP.x + footX) / 2 + dy / reach * KNEE_BULGE;
			const kneeY = (HIP.y + footY) / 2 - dx / reach * KNEE_BULGE;
			return `${HIP.x},${HIP.y} ${kneeX.toFixed(2)},${kneeY.toFixed(2)} ${footX.toFixed(2)},${footY.toFixed(2)}`;
		}
		/**
		* Whether a looping figure may run in this browser.
		*
		* The lane sits against the composer, where something that never stops moving
		* is exactly what the reduced-motion preference asks not to show. The entry is
		* left unregistered rather than drawn parked, so that preference gets the strip
		* as it was before this plugin.
		* @returns false when the browser reports a reduced-motion preference.
		*/
		function motionAllowed() {
			return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		}
		/**
		* The composer dock's lane.
		* @param props - composed slot props.
		* @returns the lane and the cyclist in it.
		*/
		function BikeLane({ useChat }) {
			const output = useChat(selectOutputChars);
			const samples = (0, react.useRef)([]);
			const lane = (0, react.useRef)(null);
			const rider = (0, react.useRef)(null);
			const rearWheel = (0, react.useRef)(null);
			const frontWheel = (0, react.useRef)(null);
			const nearLeg = (0, react.useRef)(null);
			const farLeg = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				samples.current = observeOutput(samples.current, output, performance.now());
			}, [output]);
			(0, react.useEffect)(() => {
				const laneElement = lane.current;
				const riderElement = rider.current;
				if (laneElement === null || riderElement === null) return;
				let frame = 0;
				let position = 0;
				let rotation = 0;
				let previous = performance.now();
				const step = (now) => {
					const elapsed = Math.min((now - previous) / 1e3, MAX_FRAME_SECONDS);
					previous = now;
					const span = laneElement.clientWidth + BIKE_WIDTH_PX;
					if (span > BIKE_WIDTH_PX) {
						const distance = laneSpeed(charsPerSecond(samples.current, now)) * span * elapsed;
						position = (position + distance) % span;
						rotation = (rotation + distance / WHEEL_RADIUS_PX * (180 / Math.PI)) % 360;
						riderElement.style.transform = `translate3d(${position - BIKE_WIDTH_PX}px, 0, 0)`;
						const turn = `rotate(${rotation}`;
						rearWheel.current?.setAttribute("transform", `${turn} ${REAR_HUB.x} ${REAR_HUB.y})`);
						frontWheel.current?.setAttribute("transform", `${turn} ${FRONT_HUB.x} ${FRONT_HUB.y})`);
						const phase = -(rotation * Math.PI) / 540;
						nearLeg.current?.setAttribute("points", legPoints(phase));
						farLeg.current?.setAttribute("points", legPoints(phase + Math.PI));
					}
					frame = requestAnimationFrame(step);
				};
				frame = requestAnimationFrame(step);
				return () => {
					cancelAnimationFrame(frame);
				};
			}, []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: BikeLane_module_css_default.lane,
				ref: lane,
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: BikeLane_module_css_default.rider,
					ref: rider,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
						className: BikeLane_module_css_default.bike,
						viewBox: `0 0 ${VIEWBOX_WIDTH} 60`,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
								className: BikeLane_module_css_default.wheel,
								ref: rearWheel,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
									cx: REAR_HUB.x,
									cy: REAR_HUB.y,
									r: WHEEL_RADIUS
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: spokes(REAR_HUB) })]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
								className: BikeLane_module_css_default.wheel,
								ref: frontWheel,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
									cx: FRONT_HUB.x,
									cy: FRONT_HUB.y,
									r: WHEEL_RADIUS
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: spokes(FRONT_HUB) })]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", {
								className: `${BikeLane_module_css_default.leg} ${BikeLane_module_css_default.legFar}`,
								ref: farLeg,
								points: legPoints(Math.PI)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
								className: BikeLane_module_css_default.crank,
								cx: CRANK.x,
								cy: CRANK.y,
								r: 4
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
								className: BikeLane_module_css_default.frame,
								d: FRAME_PATH
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", {
								className: BikeLane_module_css_default.leg,
								ref: nearLeg,
								points: legPoints(0)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
								className: BikeLane_module_css_default.riderBody,
								d: RIDER_PATH
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
								className: BikeLane_module_css_default.riderBody,
								cx: HEAD.x,
								cy: HEAD.y,
								r: HEAD.r
							})
						]
					})
				})
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* Locale-owned copy for the body-font row in General settings.
		*
		* Product-visible text lives here and reaches the component through the `t`
		* seat; the component itself carries no fallback strings. One name and one
		* description per catalogue row, so adding a face means adding two keys here.
		*
		* @module @guowenzhang/dsh-ui-beautify/client/locales
		*/
		/** Dictionary namespace owning this row's copy. */
		const NS = "settings.uiBeautify";
		/** English copy. */
		const en = {
			title: "Body font",
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
			fontLxgwWenkaiScreen: "LXGW WenKai Screen",
			fontLxgwWenkaiScreenDesc: "The same kai retuned for screens: strokes and weight are adjusted so small text holds up on lower-density displays.",
			fontZcoolXiaowei: "ZCOOL XiaoWei",
			fontZcoolXiaoweiDesc: "A thin, elegant serif variant. The interface looks lighter, and thin strokes are the first thing to suffer at small sizes.",
			fontZcoolKuaile: "ZCOOL KuaiLe",
			fontZcoolKuaileDesc: "Rounded, even strokes with a playful tilt. Still comfortable to read, and the smallest download of the display faces.",
			fontZcoolQingkeHuangyou: "ZCOOL QingKe HuangYou",
			fontZcoolQingkeHuangyouDesc: "Heavy and rounded, with the presence of a heading face. Readable, but dense as running body text.",
			fontMaShanZheng: "Ma Shan Zheng",
			fontMaShanZhengDesc: "Brush kai with visible stroke entry and exit. Decorative, and best kept to short passages.",
			fontZhiMangXing: "Zhi Mang Xing",
			fontZhiMangXingDesc: "Brush running script with joined strokes. The most decorative choice here, and hard to read across long text.",
			fontLongCang: "Long Cang",
			fontLongCangDesc: "Brush cursive with flowing, connected strokes. Decorative rather than readable; short headings only.",
			fontLiuJianMaoCao: "Liu Jian Mao Cao",
			fontLiuJianMaoCaoDesc: "Brush cursive with pronounced dry-brush strokes. The least legible face here, and the one to pick for ornament alone.",
			fontInter: "Inter",
			fontInterDesc: "Latin sans designed for screens. Chinese text falls back to the system stack.",
			fontGeist: "Geist",
			fontGeistDesc: "Geometric Latin sans. Chinese text falls back to the system stack.",
			codeTitle: "Code font",
			codeFontSystem: "System default",
			codeFontSystemDesc: "Downloads nothing. Code keeps the monospace stack DeepSeek Harness ships with, so it follows upstream changes.",
			codeFontJetbrainsMono: "JetBrains Mono",
			codeFontJetbrainsMonoDesc: "Tall, highly distinguishable letterforms built for long reading sessions. Latin only.",
			codeFontFiraCode: "Fira Code",
			codeFontFiraCodeDesc: "The classic programming face, whose ligatures merge `!=`, `=>` and friends into single glyphs. Latin only.",
			codeFontGeistMono: "Geist Mono",
			codeFontGeistMonoDesc: "Vercel's monospace: geometric, narrow, and quiet next to the interface. Latin only.",
			codeFontNotoSansMono: "Noto Sans Mono",
			codeFontNotoSansMonoDesc: "The monospace cut of the Noto family, so mixed text stays consistent with Source Han Sans. Still covers no CJK.",
			codeFontMapleMonoCn: "Maple Mono CN",
			codeFontMapleMonoCnDesc: "The only face here that covers Chinese, so Chinese comments keep their column alignment. Largest download, and served by jsDelivr alone.",
			cacheAbsent: "Not downloaded",
			cacheCached: "Cached {size}",
			cachePresent: "Cached {size} · {cached}/{total} shards",
			cacheHint: "read when this page opens; reload (F5) to refresh",
			unitKb: "KB",
			unitMb: "MB",
			unitGb: "GB",
			unavailable: "The Host settings service is unavailable, so this choice cannot be saved.",
			readonly: "The settings document is read-only, so this choice cannot be saved.",
			stale: "The Host is still running an older build of this plugin, whose schema has no field for this row. Restart dsh, then reload this page."
		};
		/** Chinese copy. */
		const zh = {
			title: "正文字体",
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
			fontLxgwWenkaiScreen: "霞鹜文楷 屏幕版",
			fontLxgwWenkaiScreenDesc: "同一款楷体的屏幕优化版：笔画与字重针对小字号重新调过，低分屏下更清晰。",
			fontZcoolXiaowei: "站酷小薇体",
			fontZcoolXiaoweiDesc: "清瘦秀气的宋体变体，界面观感更轻盈；代价是细笔画在小字号下最先受损。",
			fontZcoolKuaile: "站酷快乐体",
			fontZcoolKuaileDesc: "笔画圆润均匀、略带倾斜的活泼字形，阅读仍算轻松，是装饰性字体里体积最小的一款。",
			fontZcoolQingkeHuangyou: "站酷庆科黄油体",
			fontZcoolQingkeHuangyouDesc: "笔画粗壮饱满、圆润厚重，标题感很强；读得清，但铺成正文偏挤。",
			fontMaShanZheng: "马善政楷书",
			fontMaShanZhengDesc: "毛笔楷书，起笔收笔明显，装饰性强，适合短句与标题。",
			fontZhiMangXing: "志莽行书",
			fontZhiMangXingDesc: "毛笔行书，连笔明显，是这里装饰性最强的一款，长文阅读吃力。",
			fontLongCang: "龙藏体",
			fontLongCangDesc: "毛笔行草，笔画连绵飞动。装饰大于可读，只适合标题与短句。",
			fontLiuJianMaoCao: "柳建毛草",
			fontLiuJianMaoCaoDesc: "毛笔草书，飞白与连笔最夸张，是这批字体里识别度最低的一款，纯为观感而选。",
			fontInter: "Inter",
			fontInterDesc: "为屏幕设计的拉丁无衬线字体。中文回退到系统字体栈。",
			fontGeist: "Geist",
			fontGeistDesc: "几何感较强的拉丁无衬线字体。中文回退到系统字体栈。",
			codeTitle: "代码字体",
			codeFontSystem: "系统默认",
			codeFontSystemDesc: "不下载任何字体。代码沿用 DeepSeek Harness 内置的等宽字体栈，因此会跟随上游的变化。",
			codeFontJetbrainsMono: "JetBrains Mono",
			codeFontJetbrainsMonoDesc: "为长时间读代码设计，字形高挑、易区分；只覆盖拉丁字符。",
			codeFontFiraCode: "Fira Code",
			codeFontFiraCodeDesc: "经典编程字体，连字会把 `!=`、`=>` 之类合成单个字形；只覆盖拉丁字符。",
			codeFontGeistMono: "Geist Mono",
			codeFontGeistMonoDesc: "Vercel 的等宽字体：几何感强、字面偏窄，在界面里很安静。只覆盖拉丁字符。",
			codeFontNotoSansMono: "Noto Sans Mono",
			codeFontNotoSansMonoDesc: "思源家族的等宽体，中英混排时与思源黑体观感一致；同样不覆盖中文。",
			codeFontMapleMonoCn: "Maple Mono CN",
			codeFontMapleMonoCnDesc: "这里唯一覆盖中文的等宽字体，中文注释也能对齐；体积最大，且只有 jsDelivr 上能取到。",
			cacheAbsent: "未下载",
			cacheCached: "已缓存 {size}",
			cachePresent: "已缓存 {size} · {cached}/{total} 片",
			cacheHint: "打开本页时统计，刷新页面（F5）更新",
			unitKb: "KB",
			unitMb: "MB",
			unitGb: "GB",
			unavailable: "宿主设置服务不可用，该选择无法保存。",
			readonly: "设置文档为只读，该选择无法保存。",
			stale: "宿主仍在运行本插件的旧版本，它的配置里没有这一行对应的字段。重启 dsh 后再刷新本页。"
		};
		//#endregion
		//#region \0dsh-css:C:\02-codespace\deepseek-harness\dsh-ui-beautify\src\client\FontRows.module.css.mjs
		const css = ".BXG0aW_row{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}.BXG0aW_rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}.BXG0aW_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}.BXG0aW_desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}.BXG0aW_meta{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary);opacity:.75;font-size:12px;font-weight:400;line-height:18px}.BXG0aW_meta:empty{display:none}.BXG0aW_selector{background:var(--dsw-alias-bg-module-platform);height:36px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;border-radius:18px;align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.BXG0aW_selector:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.BXG0aW_selector:disabled{cursor:default;opacity:.6}.BXG0aW_chevron{flex:none}";
		const tagId = "@guowenzhang/dsh-ui-beautify/FontRows.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var FontRows_module_css_default = {
			"chevron": "BXG0aW_chevron",
			"desc": "BXG0aW_desc",
			"meta": "BXG0aW_meta",
			"row": "BXG0aW_row",
			"rowText": "BXG0aW_rowText",
			"selector": "BXG0aW_selector",
			"title": "BXG0aW_title"
		};
		//#endregion
		//#region src/client/FontRows.tsx
		/**
		* Copy keys per choice id. The catalogue owns the ids and families; the wording
		* lives in the locale dictionary, so this table is the one place the two meet.
		* Ids are unique across roles, so one table serves both rows.
		*/
		const CHOICE_COPY = {
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
			"lxgw-wenkai-screen": {
				name: "fontLxgwWenkaiScreen",
				desc: "fontLxgwWenkaiScreenDesc"
			},
			"zcool-xiaowei": {
				name: "fontZcoolXiaowei",
				desc: "fontZcoolXiaoweiDesc"
			},
			"zcool-kuaile": {
				name: "fontZcoolKuaile",
				desc: "fontZcoolKuaileDesc"
			},
			"zcool-qingke-huangyou": {
				name: "fontZcoolQingkeHuangyou",
				desc: "fontZcoolQingkeHuangyouDesc"
			},
			"ma-shan-zheng": {
				name: "fontMaShanZheng",
				desc: "fontMaShanZhengDesc"
			},
			"zhi-mang-xing": {
				name: "fontZhiMangXing",
				desc: "fontZhiMangXingDesc"
			},
			"long-cang": {
				name: "fontLongCang",
				desc: "fontLongCangDesc"
			},
			"liu-jian-mao-cao": {
				name: "fontLiuJianMaoCao",
				desc: "fontLiuJianMaoCaoDesc"
			},
			inter: {
				name: "fontInter",
				desc: "fontInterDesc"
			},
			geist: {
				name: "fontGeist",
				desc: "fontGeistDesc"
			},
			"jetbrains-mono": {
				name: "codeFontJetbrainsMono",
				desc: "codeFontJetbrainsMonoDesc"
			},
			"fira-code": {
				name: "codeFontFiraCode",
				desc: "codeFontFiraCodeDesc"
			},
			"geist-mono": {
				name: "codeFontGeistMono",
				desc: "codeFontGeistMonoDesc"
			},
			"noto-sans-mono": {
				name: "codeFontNotoSansMono",
				desc: "codeFontNotoSansMonoDesc"
			},
			"maple-mono-cn": {
				name: "codeFontMapleMonoCn",
				desc: "codeFontMapleMonoCnDesc"
			}
		};
		/**
		* Copy for the one choice that is not a catalogue row. The same id means
		* different things to the two roles — "leave the interface font alone" against
		* "leave the built-in code stack alone" — so it cannot live in the table above.
		*/
		const SYSTEM_COPY = {
			body: {
				name: "fontSystem",
				desc: "fontSystemDesc"
			},
			code: {
				name: "codeFontSystem",
				desc: "codeFontSystemDesc"
			}
		};
		/** The row title each role shows. */
		const ROW_TITLE = {
			body: "title",
			code: "codeTitle"
		};
		/** The copy for one choice, from the catalogue table or the system seat. */
		function copyFor(role, id) {
			return id === "system" ? SYSTEM_COPY[role] : CHOICE_COPY[id];
		}
		/**
		* A role's choices, grouped for presentation.
		*
		* The system default opens on its own because it is the baseline the rest
		* depart from; the catalogue then splits into the two writing systems a face
		* can cover.
		*/
		function groupsFor(role) {
			const faces = FONT_ROLES[role].faces;
			return [
				{
					label: "groupSystem",
					ids: [SYSTEM_FONT_ID]
				},
				{
					label: "groupCjk",
					ids: faces.filter((face) => face.group === "cjk").map((face) => face.id)
				},
				{
					label: "groupLatin",
					ids: faces.filter((face) => face.group === "latin").map((face) => face.id)
				}
			];
		}
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
		/** A byte count as `4.3 MB`, built from the dictionary's own units. */
		function readableSize(t, bytes) {
			const size = byteSize(bytes);
			return `${size.value} ${t(size.unit)}`;
		}
		/**
		* What one face holds in the cache, as one short phrase for a menu row.
		*
		* A face no stylesheet has been cached for has downloaded nothing at all: the
		* stylesheet is what names the shards, so its absence is the honest answer
		* rather than a zero byte count.
		* @param t - this row's translate seat.
		* @param usage - what the Host reported for this face, if anything.
		* @returns the phrase, e.g. `Cached 4.3 MB` or `Not downloaded`.
		*/
		function cachePhrase(t, usage) {
			if (usage === void 0 || usage.shardsTotal === 0) return t("cacheAbsent");
			return t("cacheCached", { size: readableSize(t, usage.bytes) });
		}
		/**
		* The line under the description for the chosen face: what it holds, how much
		* of it, and how to refresh a reading that was taken when this row rendered.
		* @param t - this row's translate seat.
		* @param usage - what the Host reported for the chosen face, if anything.
		* @returns the line's text.
		*/
		function cacheDetail(t, usage) {
			if (usage === void 0 || usage.shardsTotal === 0) return `${t("cacheAbsent")} · ${t("cacheHint")}`;
			return `${t("cachePresent", {
				size: readableSize(t, usage.bytes),
				cached: usage.shardsCached,
				total: usage.shardsTotal
			})} · ${t("cacheHint")}`;
		}
		/**
		* The line under the description.
		* @param t - this row's translate seat.
		* @param role - the role this row edits.
		* @param state - the snapshot this row renders.
		* @returns the note that applies, the chosen face's reading, or nothing for the
		* system default, which downloads no face to report on.
		*/
		function detailLine(t, role, state) {
			if (!state.available) return t("unavailable");
			if (!state.writable) return t("readonly");
			if (!state.fields[role]) return t("stale");
			const choice = state[FONT_ROLES[role].key];
			if (choice === "system") return "";
			return cacheDetail(t, state.cache[choice]);
		}
		/**
		* Build the menu: every choice, grouped, each downloadable face labelled with
		* what is already on disk.
		* @param t - this row's translate seat.
		* @param role - the role this row edits.
		* @param state - the snapshot this row renders.
		* @returns the menu entries.
		*/
		function menuEntries(t, role, state) {
			const entries = [];
			for (const { label, ids } of groupsFor(role)) {
				entries.push({
					type: "label",
					id: `group-${role}-${label}`,
					text: t(label)
				});
				for (const id of ids) {
					const copy = copyFor(role, id);
					if (copy === void 0) continue;
					const name = t(copy.name);
					entries.push({
						id,
						label: id === "system" ? name : `${name} · ${cachePhrase(t, state.cache[id])}`
					});
				}
			}
			return entries;
		}
		/**
		* One preference row.
		* @param props - the composed slot props plus the role this row edits.
		* @returns the row body.
		*/
		function FontPicker({ role, ...props }) {
			const { useFontSettings, t, choose, refreshCache } = props;
			const state = useFontSettings((snapshot) => snapshot);
			const [open, setOpen] = (0, react.useState)(false);
			const choice = state[FONT_ROLES[role].key];
			const selected = copyFor(role, choice);
			(0, react.useEffect)(() => {
				refreshCache();
			}, [refreshCache]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: FontRows_module_css_default.row,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: FontRows_module_css_default.rowText,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: FontRows_module_css_default.title,
							children: t(ROW_TITLE[role])
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: FontRows_module_css_default.desc,
							children: selected === void 0 ? "" : t(selected.desc)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: FontRows_module_css_default.meta,
							children: detailLine(t, role, state)
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
					open,
					onClose: () => {
						setOpen(false);
					},
					items: menuEntries(t, role, state),
					selectedId: choice,
					onSelect: (id) => {
						setOpen(false);
						choose(id);
					},
					align: "end",
					portal: true,
					anchor: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: FontRows_module_css_default.selector,
						"aria-haspopup": "menu",
						"aria-expanded": open,
						disabled: !state.available || !state.writable || !state.fields[role],
						onClick: () => {
							setOpen((previous) => !previous);
						},
						children: [selected === void 0 ? t(ROW_TITLE[role]) : t(selected.name), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { className: FontRows_module_css_default.chevron })]
					})
				})]
			});
		}
		/**
		* The body-font row.
		* @param props - composed slot props.
		* @returns the row.
		*/
		function FontRow(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FontPicker, {
				role: "body",
				...props
			});
		}
		/**
		* The code-font row.
		* @param props - composed slot props.
		* @returns the row.
		*/
		function CodeFontRow(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(FontPicker, {
				role: "code",
				...props
			});
		}
		//#endregion
		//#region src/client/settings-controller.ts
		/**
		* Controller bridging the Host `ui-beautify` settings namespace and its cache
		* read-out onto the General-settings rows' snapshots.
		*
		* It reads the stored face ids, writes a new one through the settings form, and
		* carries what the local cache holds for each face. Applying a choice to the
		* document is not this class's job — the plugin body owns that, so a row can
		* render a snapshot without touching the DOM.
		*
		* The cache reading is a sample, not a subscription: the Host answers when
		* asked, and a row asks when it renders and shortly after a choice lands, which
		* is when a download has had time to put something on disk. Both rows share one
		* reading, because they share one cache.
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
			/**
			* Build the renderer face for one row.
			* @param role - the role that row edits.
			* @returns its hooks and writers.
			*/
			inject(role) {
				return {
					hooks: { fontSettings: this.store },
					choose: (id) => {
						this.choose(role, id);
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
			choose(role, id) {
				const snapshot = this.scope.getSnapshot();
				if (snapshot.status !== "ready" || !snapshot.writable) return;
				const key = FONT_ROLES[role].key;
				if (snapshot.value?.[key] === id) return;
				this.scope.set(key, id);
			}
			projection() {
				const snapshot = this.scope.getSnapshot();
				const value = snapshot.value;
				return {
					available: snapshot.status === "ready",
					writable: snapshot.writable,
					fields: {
						body: value?.font !== void 0,
						code: value?.codeFont !== void 0
					},
					font: resolveFontChoice(value?.font, "body"),
					codeFont: resolveFontChoice(value?.codeFont, "code"),
					cache: this.cache
				};
			}
			publish() {
				this.store.set(this.projection());
			}
		};
		//#endregion
		//#region src/client/index.ts
		/** Identity of this plugin's stylesheet links and its theme override layer. */
		const PLUGIN_ID = "@guowenzhang/dsh-ui-beautify";
		/** The roles, in the order their rows appear and their tokens are installed. */
		const ROLE_ORDER = ["body", "code"];
		/**
		* Row positions in the General section.
		*
		* `11.5` and `11.6` place both inside the appearance group: directly under the
		* interface font size (11), above the transcript row (12). Whole steps there
		* would push them past the end of that group, and the two belong next to each
		* other because they are the same kind of choice.
		*/
		const ROW_ORDER = {
			body: 11.5,
			code: 11.6
		};
		/** The row id each role registers under. */
		const ROW_ID = {
			body: "ui-beautify",
			code: "ui-beautify-code"
		};
		/**
		* The lane's cell in the composer dock, and where it sits among the entries
		* already there.
		*
		* Behind the shipped queue, todo, and goal docks, so the figure rides closest to
		* the composer card whenever one of those cards is open.
		*/
		const LANE_ID = "ui-beautify-lane";
		const LANE_ORDER = 100;
		/**
		* Required services: the theme service owns the token overrides, slots and
		* locale carry the rows, and the configuration forms service is where the
		* choices live.
		*/
		const inject = [
			"theme",
			"slots",
			"locale",
			"configForms"
		];
		/**
		* Client plugin body: register one preference row per role, keep the document in
		* sync with the stored choices, and put the lane in the composer dock.
		* @param ctx - client cordis context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-beautify: dictionaries");
			const scope = ctx.configForms.get(FONT_SETTINGS_NS);
			const controller = new FontController(scope);
			ctx.effect(() => () => {
				controller.dispose();
			}, "ui-beautify: settings form");
			ctx.effect(() => applyFonts(ctx, scope), "ui-beautify: fonts");
			for (const role of ROLE_ORDER) ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: ROW_ID[role],
				order: ROW_ORDER[role],
				locale: NS,
				inject: () => controller.inject(role)
			}, role === "body" ? FontRow : CodeFontRow));
			if (motionAllowed()) ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: LANE_ID,
				order: LANE_ORDER
			}, BikeLane));
		}
		/**
		* Point the document at the stored choices and keep it there.
		*
		* Every role's links and tokens are installed in one pass, and the token
		* override is one call: the theme service keeps one layer per source, so a
		* second call would replace the first role's tokens rather than add to them.
		*
		* A role set to the system default contributes neither links nor tokens, which
		* is what lets its token resolve to ui-theme's own declaration — the only way
		* "off" tracks that declaration instead of freezing a copy of it.
		*
		* The first sync runs before the scope is ready, which resolves to the defaults
		* — the same ones a fresh install shows, so nothing shifts once the durable
		* values arrive.
		* @param ctx - client cordis context owning the effect.
		* @param scope - the `ui-beautify` configuration form holding the choices.
		* @returns disposer removing the links, the overrides, and the subscription.
		*/
		function applyFonts(ctx, scope) {
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
				const value = scope.getSnapshot().value;
				const choices = {
					body: resolveFontChoice(value?.font, "body"),
					code: resolveFontChoice(value?.codeFont, "code")
				};
				if (applied !== void 0 && ROLE_ORDER.every((role) => applied?.[role] === choices[role])) return;
				applied = choices;
				detach();
				const tokens = {};
				for (const role of ROLE_ORDER) {
					const face = faceById(choices[role], role);
					if (face === void 0) continue;
					const stack = fontStack(face, role);
					for (const token of FONT_ROLES[role].tokens) tokens[token] = {
						light: stack,
						dark: stack
					};
					for (const sheet of face.source.sheets) {
						const link = document.createElement("link");
						link.rel = "stylesheet";
						link.dataset.plugin = PLUGIN_ID;
						link.href = `${FONTS_ROUTE}/${face.id}/${sheet}`;
						document.head.appendChild(link);
						links.push(link);
					}
				}
				if (Object.keys(tokens).length > 0) releaseTokens = ctx.theme.overrideTokens(PLUGIN_ID, tokens);
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
