import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import z from "@deepseek-ai/schemastery";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
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
* The charset a face id may use.
*
* The id is also a URL path segment, so the route refuses anything outside this
* charset as malformed rather than looking it up: `..`, a percent-encoded
* escape, and a separator can then never reach a lookup, a cache path, or a
* mirror URL.
*/
const FACE_ID_PATTERN = /^[a-z0-9-]+$/;
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
//#region src/source.ts
/**
* Registries tried in order, as `{package}` / `{version}` / `{path}` templates.
*
* npmmirror leads because it is the reachable registry from mainland China,
* where the interface this plugin dresses usually runs; jsDelivr covers the
* rest of the world and stays as the fallback.
*/
const DEFAULT_MIRRORS = ["https://registry.npmmirror.com/{package}/{version}/files/{path}", "https://cdn.jsdelivr.net/npm/{package}@{version}/{path}"];
/** Per-attempt ceiling; a mirror that has not answered by then is skipped. */
const DOWNLOAD_TIMEOUT_MS = 2e4;
/**
* Largest single file accepted.
*
* Every shard of a `unicode-range`-sliced face is far below this; the cap only
* bounds a mirror that streams something other than the file it was asked for.
*/
const MAX_FILE_BYTES = 8388608;
/**
* A download that no mirror could satisfy.
*
* `missing` separates the two answers the HTTP layer owes the browser: a file
* no mirror has is a 404, while an unreachable or unusable mirror is a 502 and
* stays retryable.
*/
var FontDownloadError = class extends Error {
	missing;
	/**
	* @param message - what failed, per mirror.
	* @param missing - whether every mirror agreed the file does not exist.
	*/
	constructor(message, missing) {
		super(message);
		this.missing = missing;
		this.name = "FontDownloadError";
	}
};
/**
* Build the request URL for one mirror template.
* @param template - a mirror entry from {@link DEFAULT_MIRRORS}.
* @param request - the package coordinates and package-relative path.
* @returns the absolute URL, with each path segment percent-encoded.
*/
function mirrorUrl(template, request) {
	const path = request.path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
	return template.replace("{package}", request.source.package).replace("{version}", request.source.version).replace("{path}", path);
}
/**
* Download one file, trying each mirror until one answers.
* @param request - the package coordinates and package-relative path.
* @param mirrors - mirror templates, in the order they are tried.
* @returns the file's bytes, already validated against its extension.
* @throws FontDownloadError when no mirror returned a usable file.
*/
async function downloadFile(request, mirrors) {
	const failures = [];
	let answered = false;
	for (const template of mirrors) {
		const url = mirrorUrl(template, request);
		try {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
				redirect: "follow"
			});
			if (response.status === 404 || response.status === 410) {
				failures.push(`${url}: ${String(response.status)}`);
				continue;
			}
			if (!response.ok) {
				failures.push(`${url}: ${String(response.status)}`);
				answered = true;
				continue;
			}
			answered = true;
			const bytes = await readBounded(response);
			validate(request.path, bytes);
			return bytes;
		} catch (error) {
			failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
			answered = true;
		}
	}
	throw new FontDownloadError(`no mirror served ${request.source.package}@${request.source.version}/${request.path} (${failures.join("; ")})`, !answered);
}
/**
* Read a response body, refusing to buffer more than {@link MAX_FILE_BYTES}.
* @param response - an OK response whose body is the file.
* @returns the body's bytes.
*/
async function readBounded(response) {
	const declared = Number(response.headers.get("content-length") ?? NaN);
	if (Number.isFinite(declared) && declared > 8388608) throw new Error(`declared ${String(declared)} bytes, over the ${String(MAX_FILE_BYTES)}-byte cap`);
	if (response.body === null) return Buffer.alloc(0);
	const reader = response.body.getReader();
	const chunks = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > 8388608) {
			await reader.cancel();
			throw new Error(`body passed the ${String(MAX_FILE_BYTES)}-byte cap`);
		}
		chunks.push(value);
	}
	return Buffer.concat(chunks);
}
/**
* Reject a payload that is not the kind of file its extension promises.
*
* A mirror answering 200 with an error page, a login form, or a truncated
* stream is the failure this catches, and it is caught before anything is
* written into the cache.
* @param path - the package-relative path the bytes were requested for.
* @param bytes - the body a mirror returned.
*/
function validate(path, bytes) {
	if (bytes.length === 0) throw new Error("empty body");
	if (path.endsWith(".woff2") && bytes.subarray(0, 4).toString("latin1") !== "wOF2") throw new Error("body is not a woff2 file");
	if (path.endsWith(".css")) {
		const text = bytes.toString("utf8");
		if (!text.includes("@font-face") && !text.includes("@import")) throw new Error("body is not a stylesheet");
	}
}
//#endregion
//#region src/serve.ts
/**
* The plugin's two HTTP surfaces.
*
* The browser fetches a face's stylesheets and shards from the application
* origin, so this plugin claims one `webServer` prefix and resolves each path
* against the face catalogue. The route mirrors the npm package layout exactly,
* which is what the stylesheets assume: a path requested here is the path the
* package holds, so no CSS has to be rewritten on the way through.
*
* The second surface is the cache read-out the picker labels each face with. It
* is a separate exact route, because nothing under the font prefix is a JSON
* document.
*
* Request paths are untrusted input and the resolved file is written to disk,
* so a path outside the route, a path that names no face, and a path that would
* escape its own generation directory are three different answers rather than
* one lookup.
*
* @module @guowenzhang/dsh-ui-beautify/serve
*/
/** Content types the font packages hold; anything else is served as bytes. */
const CONTENT_TYPES = {
	".css": "text/css; charset=utf-8",
	".woff2": "font/woff2"
};
/**
* Cache policy per extension.
*
* A shard's name carries the package version, so a year is safe for it. A
* stylesheet keeps its name across versions, and the pinned version can move
* under a running host, so the browser must revalidate it rather than keep it.
*/
const CACHE_CONTROL = {
	".css": "no-cache",
	".woff2": "public, max-age=31536000, immutable"
};
/**
* Resolve one request path to the face and package-relative file it names.
* @param pathname - the decoded request pathname.
* @returns the route, or undefined when the path is malformed or outside this route.
*/
function fontRouteFor(pathname) {
	if (!pathname.startsWith(`/plugins/dsh-ui-beautify/fonts/`)) return void 0;
	let decoded;
	try {
		decoded = decodeURIComponent(pathname.slice(31));
	} catch {
		return;
	}
	const segments = decoded.split("/");
	const id = segments.shift();
	if (id === void 0 || !FACE_ID_PATTERN.test(id)) return void 0;
	const path = segments.join("/");
	if (!isServablePath(path)) return void 0;
	const face = faceById(id);
	if (face === void 0) return {
		kind: "unknown-face",
		id
	};
	return {
		kind: "file",
		face,
		path
	};
}
/**
* Whether a package-relative path may be fetched and cached.
*
* Windows treats a backslash as a separator, so a path carrying one can climb
* out of the cache directory on that platform even though it looks inert here;
* it is refused as malformed rather than normalized.
* @param path - the path beneath the face id.
* @returns whether every segment is an ordinary name.
*/
function isServablePath(path) {
	if (path === "" || path.includes("\\") || path.includes("\0")) return false;
	if (path.startsWith("/")) return false;
	return path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}
/**
* Answer one request for a font file, downloading it when the cache is cold.
*
* A prefix route is consulted for everything under its path, including paths
* whose `..` segments a client sent: URL parsing collapses those before this
* handler runs, so a request can arrive that no longer names this route at all.
* Such a request is refused rather than answered with some other file.
* @param req - the incoming request.
* @param res - the response to own.
* @param store - the cache the file is read from or downloaded into.
*/
async function serveFontFile(req, res, store) {
	const pathname = new URL(req.url ?? "/", "http://x").pathname;
	const route = fontRouteFor(pathname);
	if (route === void 0) {
		res.writeHead(403).end("forbidden");
		return;
	}
	if (route.kind === "unknown-face") {
		res.writeHead(404).end("not found");
		return;
	}
	let file;
	try {
		file = await store.file(route.face, route.path);
	} catch (error) {
		if (error instanceof FontDownloadError && error.missing) {
			res.writeHead(404).end("not found");
			return;
		}
		res.writeHead(502, { "cache-control": "no-store" }).end("font source unavailable");
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
/**
* Answer one request for the cache read-out.
*
* The picker asks for this when it opens and after a face is applied, so the
* answer must describe the disk as it is right now: it is never cached.
* @param req - the incoming request.
* @param res - the response to own.
* @param store - the cache being reported on.
*/
async function serveCacheUsage(req, res, store) {
	if (req.method !== "GET" && req.method !== "HEAD") {
		res.writeHead(405, { allow: "GET, HEAD" }).end("method not allowed");
		return;
	}
	const body = JSON.stringify({ faces: await store.usage() });
	res.writeHead(200, {
		"content-type": "application/json; charset=utf-8",
		"content-length": String(Buffer.byteLength(body)),
		"cache-control": "no-store"
	});
	res.end(req.method === "HEAD" ? void 0 : body);
}
//#endregion
//#region src/settings.ts
/** Schema served to settings clients.
* The inferred type is the source of truth: `.volatile()` produces the `Volatile` accessor above. */
const Config = z.object({
	font: z.string().default(DEFAULT_FONT_ID).volatile(),
	mirrors: z.array(z.string()).default([...DEFAULT_MIRRORS]),
	cacheDir: z.string().default("")
});
//#endregion
//#region src/store.ts
/**
* The on-disk cache between the browser and the CDNs.
*
* Every downloaded file lands at `<cacheDir>/<face>/<generation>/<package path>`,
* so the directory mirrors the package layout the stylesheets already assume:
* a relative `url(./files/x.woff2)` inside a sheet resolves to the same path
* here that it names inside the package. That is what lets the route stay a
* pass-through proxy with no CSS rewriting.
*
* The generation directory is a hash of the pinned `package@version` and the
* sheets, so a plugin upgrade that moves either one starts from an empty
* directory instead of serving bytes from the previous generation. Sibling
* generations are removed once the new one is written.
*
* Cold requests are the point of the plugin, so the store is written for them:
* one in-flight download per path, and every file appears atomically or not at
* all, because a half-written shard in the cache would outlive the failure that
* produced it.
*
* @module @guowenzhang/dsh-ui-beautify/store
*/
/** Cache root segment under the harness home, matching the harness' own layout. */
const CACHE_SEGMENTS = [
	"cache",
	"ui-beautify",
	"fonts"
];
/**
* Resolve the cache directory once, at host start.
*
* An empty configured value follows the harness home: `$DSH_HOME` when it names
* a usable directory, otherwise `~/.dsh`. The plugin expands the `~` prefixes
* itself because `@deepseek-ai/dsh-home-paths` is a harness-internal package and
* the loader resolves this plugin's imports from the profile, where that package
* is not installed.
* @param configured - the `cacheDir` config field.
* @returns the absolute cache root.
*/
function resolveCacheDir(configured) {
	if (configured.trim() !== "") return resolve(expandHome(configured));
	const fromEnv = process.env.DSH_HOME;
	const home = fromEnv !== void 0 && fromEnv.trim() !== "" ? expandHome(fromEnv) : join(homedir(), ".dsh");
	return resolve(home, ...CACHE_SEGMENTS);
}
/**
* Expand the `~`, `~/`, and `~\` prefixes against the operating-system home.
* @param path - a configured path that may start with a supported prefix.
* @returns the expanded path, unchanged when no supported prefix is present.
*/
function expandHome(path) {
	if (path === "~") return homedir();
	if (path.startsWith("~/") || path.startsWith("~\\")) return join(homedir(), path.slice(2));
	return path;
}
/** The cache directory holding one face's files. */
var FontStore = class {
	options;
	pending = /* @__PURE__ */ new Map();
	swept = /* @__PURE__ */ new Set();
	/**
	* @param options - cache root and mirror templates.
	*/
	constructor(options) {
		this.options = options;
	}
	/**
	* Return the cached path of one package-relative file, downloading it first
	* when it is not there yet.
	* @param face - the face whose package holds the file.
	* @param path - package-relative path, already validated by the route parser.
	* @returns the absolute path of the file on disk.
	* @throws FontDownloadError when no mirror could serve the file.
	*/
	async file(face, path) {
		const target = this.targetFor(face, path);
		if (await isFile(target)) return target;
		const inFlight = this.pending.get(target);
		if (inFlight !== void 0) return await inFlight;
		const attempt = this.fetch(face, path, target);
		this.pending.set(target, attempt);
		try {
			return await attempt;
		} finally {
			this.pending.delete(target);
		}
	}
	/**
	* Resolve one package-relative path inside the face's current generation.
	* @param face - the face whose cache directory is used.
	* @param path - package-relative path.
	* @returns the absolute path, proved to stay inside the generation directory.
	*/
	targetFor(face, path) {
		const root = resolve(this.options.cacheDir, face.id, generationOf(face));
		const target = resolve(root, path);
		if (!target.startsWith(root + sep)) throw new Error(`ui-beautify: ${path} escapes the cache directory`);
		return target;
	}
	async fetch(face, path, target) {
		const bytes = await downloadFile({
			source: face.source,
			path
		}, this.options.mirrors);
		await mkdir(dirname(target), { recursive: true });
		await writeAtomic(target, bytes);
		await this.sweep(face);
		return target;
	}
	/**
	* Drop the face's other generations.
	*
	* A generation is only ever left behind by a plugin upgrade that changed the
	* pinned version, so this runs once per face per process, after the download
	* that proved the current generation is usable.
	* @param face - the face whose stale generations are removed.
	*/
	async sweep(face) {
		if (this.swept.has(face.id)) return;
		this.swept.add(face.id);
		const parent = join(this.options.cacheDir, face.id);
		let entries;
		try {
			entries = await readdir(parent);
		} catch {
			return;
		}
		const current = generationOf(face);
		for (const entry of entries) {
			if (entry === current) continue;
			await rm(join(parent, entry), {
				recursive: true,
				force: true
			}).catch(() => void 0);
		}
	}
	/**
	* Report what each face occupies in the cache.
	*
	* Read from the directory rather than from bookkeeping: the browser decides
	* which shards get fetched, so the filesystem is the only record of what
	* actually arrived. A face's shard total comes from the stylesheets that are
	* cached, which is what makes "3 of 101" mean anything.
	* @returns one entry per face id holding at least one file.
	*/
	async usage() {
		let names;
		try {
			names = await readdir(this.options.cacheDir);
		} catch {
			return {};
		}
		const report = {};
		for (const name of names) {
			const usage = await this.measure(name);
			if (usage !== void 0) report[name] = usage;
		}
		return report;
	}
	/**
	* Measure one face directory.
	* @param id - the directory name, which is the face id.
	* @returns its usage, or undefined when the directory holds no file.
	*/
	async measure(id) {
		const root = join(this.options.cacheDir, id);
		let entries;
		try {
			entries = await readdir(root, { recursive: true });
		} catch {
			return;
		}
		const face = faceById(id);
		let bytes = 0;
		const generations = /* @__PURE__ */ new Map();
		for (const entry of entries) {
			const info = await stat(join(root, entry)).catch(() => void 0);
			if (info === void 0 || !info.isFile()) continue;
			bytes += info.size;
			const [generation, ...rest] = entry.split(sep);
			if (generation === void 0 || rest.length === 0) continue;
			const present = generations.get(generation) ?? /* @__PURE__ */ new Set();
			present.add(rest.join("/"));
			generations.set(generation, present);
		}
		if (bytes === 0) return void 0;
		let best = {
			bytes,
			shardsCached: 0,
			shardsTotal: 0
		};
		for (const [generation, present] of generations) {
			if (face === void 0) break;
			const declared = await declaredShards(join(root, generation), face);
			if (declared === void 0) continue;
			const shardsCached = [...declared].filter((shard) => present.has(shard)).length;
			if (declared.size > best.shardsTotal) best = {
				bytes,
				shardsCached,
				shardsTotal: declared.size
			};
		}
		return best;
	}
};
/**
* Collect the package-relative shard paths a face's cached stylesheets declare.
*
* The stylesheet is the only place that names a shard, so this doubles as the
* test for whether a face has been downloaded at all.
* @param generationDir - absolute path of one generation directory.
* @param face - the face whose sheets are read.
* @returns the declared shard paths, or undefined when no sheet is cached.
*/
async function declaredShards(generationDir, face) {
	const shards = /* @__PURE__ */ new Set();
	let found = false;
	for (const sheet of face.source.sheets) {
		let css;
		try {
			css = await readFile(join(generationDir, sheet), "utf8");
		} catch {
			continue;
		}
		found = true;
		for (const match of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
			const reference = match[2];
			if (reference === void 0 || !reference.endsWith(".woff2")) continue;
			if (/^([a-z]+:|\/)/i.test(reference)) continue;
			shards.add(resolveFromSheet(sheet, reference));
		}
	}
	return found ? shards : void 0;
}
/**
* Resolve one sheet's relative reference against the directory that sheet is in.
* @param sheet - the sheet's package-relative path.
* @param reference - the reference as written in the sheet.
* @returns the referenced file's package-relative path.
*/
function resolveFromSheet(sheet, reference) {
	const segments = sheet.split("/").slice(0, -1);
	for (const segment of reference.split("/")) {
		if (segment === "" || segment === ".") continue;
		if (segment === "..") segments.pop();
		else segments.push(segment);
	}
	return segments.join("/");
}
/**
* Compute the generation directory name for one face.
* @param face - the face to key.
* @returns a short hash of the pinned package coordinates and sheets.
*/
function generationOf(face) {
	const key = [
		face.source.package,
		face.source.version,
		...face.source.sheets
	].join("\n");
	return createHash("sha256").update(key).digest("hex").slice(0, 16);
}
/**
* Check whether a cached file is already on disk.
* @param path - the absolute candidate path.
* @returns whether a regular file exists there.
*/
async function isFile(path) {
	try {
		return (await stat(path)).isFile();
	} catch {
		return false;
	}
}
/** Distinguish concurrent scratch files written by one process. */
let scratchSequence = 0;
/**
* Write a file so that it either appears complete or does not appear at all.
* @param target - the final absolute path.
* @param bytes - the file's bytes.
*/
async function writeAtomic(target, bytes) {
	scratchSequence += 1;
	const scratch = `${target}.${String(process.pid)}.${String(scratchSequence)}.tmp`;
	try {
		await writeFile(scratch, bytes);
		await rename(scratch, target);
	} catch (error) {
		await rm(scratch, { force: true }).catch(() => void 0);
		throw error;
	}
}
//#endregion
//#region src/index.ts
/** Loader row name for this plugin. */
const name = "ui-beautify";
/** The font route only exists on a Web carrier, so wait for one. */
const inject = ["webServer"];
/**
* Host plugin body: claim the font directory's URL prefix and the cache
* read-out the picker labels each face with. The chosen face lives in this
* row's volatile Config, which the settings page edits directly; the mirrors
* and cache directory are read once here, at host start.
* @param ctx - host cordis context.
* @param config - this row's parsed configuration.
*/
function apply(ctx, config) {
	const store = new FontStore({
		cacheDir: resolveCacheDir(config.cacheDir),
		mirrors: config.mirrors
	});
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: FONTS_ROUTE,
		handler: (req, res) => serveFontFile(req, res, store)
	}), "ui-beautify: font assets");
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: CACHE_ROUTE,
		handler: (req, res) => serveCacheUsage(req, res, store)
	}), "ui-beautify: cache read-out");
}
//#endregion
export { CACHE_ROUTE, Config, DEFAULT_FONT_ID, DEFAULT_MIRRORS, FACE_ID_PATTERN, FONTS_ROUTE, FONT_CHOICES, FONT_FACES, FONT_SETTINGS_NS, FontStore, SYSTEM_FONT_ID, apply, downloadFile, faceById, fontRouteFor, fontStack, inject, mirrorUrl, name, resolveCacheDir, resolveFontChoice, serveCacheUsage, serveFontFile };
