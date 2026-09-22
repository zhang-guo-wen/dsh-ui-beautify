import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";
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
//#region src/serve.ts
/**
* Serving the bundled font directory.
*
* The browser fetches the shards from the application origin, so this plugin
* claims one `webServer` prefix instead of relying on any implicit asset
* mapping. Every served path is resolved against the font root and rejected
* unless it stays inside it, because the request path is untrusted input.
*/
/** Absolute path of the font directory that ships beside this module. */
const FONT_ROOT = resolve(fileURLToPath(new URL("../assets/fonts", import.meta.url)));
/** Content types the font directory holds; anything else is served as bytes. */
const CONTENT_TYPES = {
	".css": "text/css; charset=utf-8",
	".woff2": "font/woff2"
};
/**
* Cache policy per extension. The shard names are content-addressed by font
* version, so a year is safe for them; the stylesheet keeps its name across
* regenerations, so it must be revalidated or a font swap would stay invisible.
*/
const CACHE_CONTROL = {
	".css": "no-cache",
	".woff2": "public, max-age=31536000, immutable"
};
/**
* Resolve one request path to a file inside the font root.
* @param pathname - the decoded request pathname.
* @returns the absolute file path, or undefined when it is outside this route.
*/
function fontFileFor(pathname) {
	if (!pathname.startsWith(`/plugins/dsh-ui-beautify/fonts/`)) return void 0;
	const relative = pathname.slice(31);
	if (relative === "") return void 0;
	let decoded;
	try {
		decoded = decodeURIComponent(relative);
	} catch {
		return;
	}
	const candidate = resolve(FONT_ROOT, normalize(decoded));
	if (!candidate.startsWith(FONT_ROOT + sep)) return void 0;
	return candidate;
}
/**
* Answer one request for a font file.
*
* A prefix route is consulted for everything under its path, including paths
* whose `..` segments a client sent: URL parsing collapses those before this
* handler runs, so a request can arrive that no longer names this route at all.
* Such a request is refused rather than answered with some other file.
* @param req - the incoming request.
* @param res - the response to own.
*/
async function serveFontFile(req, res) {
	const pathname = new URL(req.url ?? "/", "http://x").pathname;
	const file = fontFileFor(pathname);
	if (file === void 0) {
		res.writeHead(403).end("forbidden");
		return;
	}
	let size;
	try {
		const info = await stat(file);
		if (!info.isFile()) throw new Error("not a file");
		size = info.size;
	} catch {
		res.writeHead(404).end("not found");
		return;
	}
	const extension = extname(file).toLowerCase();
	res.writeHead(200, {
		"content-type": CONTENT_TYPES[extension] ?? "application/octet-stream",
		"content-length": String(size),
		"cache-control": CACHE_CONTROL[extension] ?? "no-cache"
	});
	await new Promise((settle) => {
		res.on("finish", settle);
		res.on("close", settle);
		const stream = createReadStream(file);
		stream.on("error", () => {
			res.destroy();
			settle();
		});
		stream.pipe(res);
	});
}
//#endregion
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
//#region src/settings.ts
/** Schema served to settings clients.
* The inferred type is the source of truth: `.volatile()` produces the `Volatile` accessor above. */
const Config = z.object({ font: z.string().default(DEFAULT_FONT_ID).volatile() });
//#endregion
//#region src/index.ts
/** Loader row name for this plugin. */
const name = "ui-beautify";
/** The font route only exists on a Web carrier, so wait for one. */
const inject = ["webServer"];
/**
* Host plugin body: claim the font directory's URL prefix. The chosen face
* lives in this row's volatile Config, which the settings page edits directly.
* @param ctx - host cordis context.
*/
function apply(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: FONTS_ROUTE,
		handler: serveFontFile
	}), "ui-beautify: font assets");
}
//#endregion
export { BUNDLED_FACES, Config, DEFAULT_FONT_ID, FONTS_ROUTE, FONT_CHOICES, FONT_SETTINGS_NS, SYSTEM_FONT_ID, apply, bundledFaceById, fontFileFor, fontStack, inject, name, resolveFontChoice, serveFontFile };
