import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
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
* The family name `assets/fonts/index.css` declares across all its
* `unicode-range` shards. Changing it here without regenerating that sheet
* silently leaves every `@font-face` unmatched.
*/
const FONT_FAMILY = "Noto Sans SC Variable";
/**
* The full stack written into `--dsw-font-family`. The bundled family comes
* first; everything after it is ui-theme's own fallback chain, kept so the GUI
* still renders while the shards load and if they never arrive.
*/
const FONT_STACK = `'${FONT_FAMILY}', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
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
//#region src/index.ts
/** Loader row name for this plugin. */
const name = "ui-beautify";
/** The font route only exists on a Web carrier, so wait for one. */
const inject = ["webServer"];
/**
* Host plugin body: claim the font directory's URL prefix.
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
export { FONTS_ROUTE, FONT_FAMILY, FONT_STACK, apply, fontFileFor, inject, name };
