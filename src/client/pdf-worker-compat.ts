/**
 * PDF.js Worker compatibility for browsers that predate the newest JavaScript APIs.
 *
 * The Harness bundles PDF.js 6's default build. Its Worker computes every
 * document's `fingerprints` with `Uint8Array.prototype.toHex`, and both halves
 * call a set of APIs that only the newest engines ship, with no feature
 * detection between them:
 *
 *   - `Uint8Array.prototype.toHex` / `toBase64` / `fromBase64` (fingerprints,
 *     font faces, base64 transfer encoding)
 *   - `Math.sumPrecise` (font byte sizes)
 *   - `Promise.try` (the worker's message handler)
 *   - `Map`/`WeakMap.prototype.getOrInsertComputed` (the transport's memoized
 *     worker calls — `WorkerTransport#cacheSimpleMethod`, on the load path)
 *   - `URL.parse` (link and fetch-URL checks)
 *
 * A browser missing any of them fails *every* PDF — and therefore every Word or
 * PowerPoint preview too, since Office files reach the screen through the same
 * PDF body. The first phone to report this failed on `toHex`, then on
 * `getOrInsertComputed` once `toHex` was in place, which is why the whole set is
 * completed at once rather than one API per round. PDF.js's own `legacy/` build
 * carries the shims for exactly these runtimes.
 *
 * A plugin cannot replace a bundle inside the Harness, but it can reach the one
 * place the Worker source passes through on its way to the page: the Blob handed
 * to `URL.createObjectURL`, which the Harness then turns into
 *
 *     new Worker(url, { type: 'module', name: 'dsh-pdf' })
 *
 * So this module remembers the JavaScript Blob of that call and, when a module
 * Worker is built from it, hands the Worker a Blob with the shim prepended. The
 * page and its Worker share one engine, so the page's own feature detection
 * answers for both realms; the `Worker` bodies the Harness builds from other
 * Blobs (the spreadsheet parser, the file-upload hasher) are neither module
 * Workers nor in need of the shim, and are left exactly as they were.
 *
 * On a browser that already has the whole set the module is inert: no global is
 * wrapped, no prototype is touched.
 *
 * @module @guowenzhang/dsh-ui-beautify/pdf-worker-compat
 */

/** Globals the shim reads, described by hand because the same function ships as text. */
interface CompatGlobals {
  /** The typed-array constructor, used to build the decoded result of `fromBase64`. */
  Uint8Array: {
    new (size: number): { [index: number]: number; length: number }
    prototype: object
    fromBase64?: unknown
  }
  /** Where `sumPrecise` belongs; the rest of the namespace is not read. */
  Math: object
  /** The promise constructor `try` is installed on. */
  Promise: {
    new <T>(executor: (resolve: (value: T | PromiseLike<T>) => void) => void): Promise<T>
  }
  /** The collection constructors the upsert methods are installed on. */
  Map?: { prototype: object }
  WeakMap?: { prototype: object }
  /** Optional: a realm without `URL` simply takes no `URL.parse`. */
  URL?: { parse?: unknown }
}

/** The parts of a `Map`/`WeakMap` receiver the upsert shims call. */
interface UpsertReceiver {
  has(key: unknown): boolean
  get(key: unknown): unknown
  set(key: unknown, value: unknown): unknown
}

/** A Worker constructor as this patch calls it: one script URL and its options. */
interface WorkerConstructor {
  new (scriptURL: string | URL, options?: { readonly type?: string; readonly name?: string }): object
  prototype: object
}

/**
 * The page globals this patch reads and wraps.
 *
 * Structural on purpose: production passes the real `globalThis`, and the
 * regression test passes a stand-in realm it can inspect.
 */
export interface PdfWorkerCompatScope {
  Uint8Array: CompatGlobals['Uint8Array']
  Math: CompatGlobals['Math']
  Promise: CompatGlobals['Promise']
  Map?: { prototype: object }
  WeakMap?: { prototype: object }
  Blob?: { new (parts: unknown[], options?: { type?: string }): { type: string; size: number } }
  URL?: {
    parse?: unknown
    createObjectURL?: (input: unknown) => string
    revokeObjectURL?: (input: string) => void
  }
  Worker?: WorkerConstructor
}

/**
 * Marks the Worker constructor this module installed, so a second install (a
 * plugin re-apply that did not dispose) wraps nothing twice.
 */
const PATCH_MARKER = Symbol.for('@guowenzhang/dsh-ui-beautify/pdf-worker-compat')

/**
 * Marks a realm whose engine was born without the APIs.
 *
 * The page realm has them after the first install, which would make a later
 * install — the one a plugin reload performs after disposing this one — read the
 * engine as modern and leave the Worker unpatched. The mark outlives both the
 * module instance and the dispose, so the answer stays the engine's own.
 */
const MISSING_MARKER = Symbol.for('@guowenzhang/dsh-ui-beautify/pdf-api-missing')

/** JavaScript Blob types whose Worker could be the PDF one. */
const SCRIPT_BLOB_TYPES = ['text/javascript', 'application/javascript']

/**
 * Install the typed-array and promise APIs PDF.js 6 calls without feature
 * detection, in the page realm and — through its own source text — in the PDF
 * Worker.
 *
 * Takes its globals as an argument rather than closing over them, because the
 * Worker receives only this function's `toString()`: the shipped text is
 * `(<this function>)(globalThis)`.
 *
 * @param globals - the realm to complete.
 */
function installPdfApis(globals: CompatGlobals): void {
  const bytes = globals.Uint8Array
  const prototype = bytes.prototype as unknown as Record<string, unknown>
  const math = globals.Math as unknown as Record<string, unknown>
  const promise = globals.Promise as unknown as Record<string, unknown>
  const base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const base64Url = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

  const define = (target: object, name: string, value: unknown): void => {
    Object.defineProperty(target, name, { value, configurable: true, writable: true })
  }

  /**
   * The receiver as an indexable byte sequence, or the same TypeError the
   * built-in would throw. `Object.prototype.toString` is used instead of
   * `instanceof` so a stand-in realm's arrays are accepted too.
   * @param value - the receiver under test.
   * @param name - the method name for the error message.
   * @returns the receiver, indexable.
   */
  const receiver = (value: unknown, name: string): { [index: number]: number | undefined; length: number } => {
    if (Object.prototype.toString.call(value) !== '[object Uint8Array]') {
      throw new TypeError(`Uint8Array.prototype.${name} called on an incompatible receiver`)
    }
    return value as { [index: number]: number | undefined; length: number }
  }

  /** The alphabet a `toBase64`/`fromBase64` call selected, or a TypeError. */
  const alphabetOf = (options: unknown, fallback: string): string => {
    const settings = (options ?? {}) as { alphabet?: unknown }
    if (settings.alphabet === undefined) return fallback
    const chosen = String(settings.alphabet)
    if (chosen !== 'base64' && chosen !== 'base64url') throw new TypeError(`Unsupported base64 alphabet: ${chosen}`)
    return chosen === 'base64' ? base64 : base64Url
  }

  if (typeof prototype.toHex !== 'function') define(prototype, 'toHex', function toHex(this: unknown): string {
    const values = receiver(this, 'toHex')
    let text = ''
    for (let at = 0; at < values.length; at += 1) {
      text += (values[at] ?? 0).toString(16).padStart(2, '0')
    }
    return text
  })

  if (typeof prototype.toBase64 !== 'function') define(prototype, 'toBase64', function toBase64(this: unknown, options?: unknown): string {
    const table = alphabetOf(options, base64)
    const omitPadding = (options as { omitPadding?: unknown } | undefined)?.omitPadding === true
    const values = receiver(this, 'toBase64')
    let text = ''
    for (let at = 0; at < values.length; at += 3) {
      const first = values[at] ?? 0
      const second = values[at + 1]
      const third = values[at + 2]
      text += table.charAt(first >> 2)
      text += table.charAt(((first & 0b11) << 4) | ((second ?? 0) >> 4))
      if (second === undefined) {
        if (!omitPadding) text += '=='
        break
      }
      text += table.charAt(((second & 0b1111) << 2) | ((third ?? 0) >> 6))
      if (third === undefined) {
        if (!omitPadding) text += '='
        break
      }
      text += table.charAt(third & 0b111111)
    }
    return text
  })

  if (typeof bytes.fromBase64 !== 'function') define(bytes, 'fromBase64', function fromBase64(this: unknown, text: unknown, options?: unknown): unknown {
    const table = alphabetOf(options, base64)
    const handling = String((options as { lastChunkHandling?: unknown } | undefined)?.lastChunkHandling ?? 'loose')
    const codes = new Array<number>(128).fill(-1)
    for (let at = 0; at < table.length; at += 1) codes[table.charCodeAt(at)] = at
    const clean = String(text).replace(/[\t\n\f\r ]/gu, '')
    const output: number[] = []
    let buffer = 0
    let bits = 0
    let padding = 0
    for (let at = 0; at < clean.length; at += 1) {
      const code = clean.charCodeAt(at)
      if (code === 0x3d) {
        padding += 1
        continue
      }
      if (padding > 0) throw new SyntaxError('Invalid base64 input: data after padding')
      const value = code < codes.length ? codes[code] ?? -1 : -1
      if (value < 0) throw new SyntaxError('Invalid base64 input')
      buffer = (buffer << 6) | value
      bits += 6
      if (bits >= 8) {
        bits -= 8
        output.push((buffer >> bits) & 0xff)
        buffer &= (1 << bits) - 1
      }
    }
    if (padding > 2 || (padding > 0 && bits >= 6)) throw new SyntaxError('Invalid base64 input')
    if (bits > 0 && handling === 'strict' && buffer !== 0) {
      throw new SyntaxError('Invalid base64 input: trailing bits are not zero')
    }
    const result = new bytes(output.length)
    for (let at = 0; at < output.length; at += 1) result[at] = output[at] ?? 0
    return result
  })

  if (typeof math.sumPrecise !== 'function') define(math, 'sumPrecise', function sumPrecise(values: unknown): number {
    if (values === null || values === undefined
      || typeof (values as { [Symbol.iterator]?: unknown })[Symbol.iterator] !== 'function') {
      throw new TypeError('Math.sumPrecise requires an iterable of numbers')
    }
    // Neumaier summation: the firmware reports font byte sizes in integers, but
    // a compensated sum keeps any future float use as accurate as the proposal.
    let sum = 0
    let correction = 0
    for (const value of values as Iterable<unknown>) {
      if (typeof value !== 'number') throw new TypeError('Math.sumPrecise requires an iterable of numbers')
      const next = sum + value
      correction += Math.abs(sum) >= Math.abs(value) ? (sum - next) + value : (value - next) + sum
      sum = next
    }
    return sum + correction
  })

  if (typeof promise.try !== 'function') define(promise, 'try', function tryMethod(callback: unknown, ...args: unknown[]): unknown {
    if (typeof callback !== 'function') throw new TypeError('Promise.try requires a function')
    const PromiseConstructor = globals.Promise
    return new PromiseConstructor((resolve) => {
      resolve((callback as (...values: unknown[]) => unknown)(...args))
    })
  })

  /**
   * The upsert pair, which PDF.js uses to memoize per-key work: the transport
   * caches simple worker calls (`getOrInsertComputed`) on document load, and the
   * viewer's editor does the same.
   * @param prototype - `Map.prototype` or `WeakMap.prototype`.
   */
  const installUpsert = (prototype: object): void => {
    if (typeof (prototype as Record<string, unknown>).getOrInsert !== 'function') {
      define(prototype, 'getOrInsert', function getOrInsert(this: unknown, key: unknown, value: unknown): unknown {
        const map = this as UpsertReceiver
        if (map.has(key)) return map.get(key)
        map.set(key, value)
        return value
      })
    }
    if (typeof (prototype as Record<string, unknown>).getOrInsertComputed !== 'function') {
      define(prototype, 'getOrInsertComputed', function getOrInsertComputed(this: unknown, key: unknown, callback: unknown): unknown {
        if (typeof callback !== 'function') throw new TypeError('getOrInsertComputed requires a function')
        const map = this as UpsertReceiver
        if (map.has(key)) return map.get(key)
        const value = (callback as (key: unknown) => unknown)(key)
        map.set(key, value)
        return value
      })
    }
  }
  if (globals.Map !== undefined) installUpsert(globals.Map.prototype)
  if (globals.WeakMap !== undefined) installUpsert(globals.WeakMap.prototype)

  // `URL.parse` returns null where the constructor throws; PDF.js uses it for
  // link and fetch-URL checks, which would otherwise throw on a relative or
  // malformed annotation target.
  const Url = globals.URL
  if (Url !== undefined && typeof Url.parse !== 'function') {
    define(Url, 'parse', function parse(input: unknown, base?: unknown): unknown {
      const UrlConstructor = Url as unknown as new (input: string, base?: string) => object
      try {
        return base === undefined ? new UrlConstructor(String(input)) : new UrlConstructor(String(input), String(base))
      } catch {
        return null
      }
    })
  }
}

/** The shim as Worker-ready text: the same function, called on that realm's globals. */
export function pdfWorkerCompatSource(): string {
  return `;(${installPdfApis.toString()})(globalThis);\n`
}

/**
 * Complete the page realm and slip the same shim in front of the PDF Worker.
 *
 * Does nothing at all when the page already has every API — modern browsers pay
 * neither the wrapper nor the extra Blob. A realm that was born without them
 * stays marked (see `MISSING_MARKER`), so the install that follows a plugin
 * reload patches the Worker again even though the APIs are present by then.
 * @param scope - the page globals; defaults to the real ones.
 * @returns disposer restoring the wrapped globals and releasing patched Blobs.
 */
export function installPdfWorkerCompat(scope: PdfWorkerCompatScope = globalThis as unknown as PdfWorkerCompatScope): () => void {
  const needsShim = (): boolean => {
    const marked = scope as unknown as Record<PropertyKey, unknown>
    if (marked[MISSING_MARKER] === true) return true
    const prototype = scope.Uint8Array.prototype as unknown as Record<string, unknown>
    const upsert = (collection: { prototype: object } | undefined): unknown =>
      collection === undefined ? undefined : (collection.prototype as Record<string, unknown>).getOrInsertComputed
    const missing = typeof prototype.toHex !== 'function'
      || typeof prototype.toBase64 !== 'function'
      || typeof scope.Uint8Array.fromBase64 !== 'function'
      || typeof (scope.Math as unknown as Record<string, unknown>).sumPrecise !== 'function'
      || typeof (scope.Promise as unknown as Record<string, unknown>).try !== 'function'
      || typeof upsert(scope.Map) !== 'function'
      || typeof upsert(scope.WeakMap) !== 'function'
    if (missing) Object.defineProperty(scope, MISSING_MARKER, { value: true, configurable: true })
    return missing
  }
  if (!needsShim()) return () => {}
  // An earlier install that was never disposed (a plugin re-apply) already owns
  // these globals; wrapping twice would build the patched Blob twice.
  if ((scope.Worker as Record<PropertyKey, unknown> | undefined)?.[PATCH_MARKER] === true) return () => {}
  installPdfApis(scope)

  const url = scope.URL
  const NativeWorker = scope.Worker
  const BlobClass = scope.Blob as unknown as Function | undefined
  if (url === undefined || typeof url.createObjectURL !== 'function' || typeof url.revokeObjectURL !== 'function'
    || NativeWorker === undefined || BlobClass === undefined) return () => {}

  const create = url.createObjectURL
  const revoke = url.revokeObjectURL
  /** Blob URLs made from a JavaScript Blob, which is what a Worker is built from. */
  const scripts = new Map<string, unknown>()
  /** Original Blob URL -> the shim-carrying Blob URL a Worker was given. */
  const substituted = new Map<string, string>()

  /** The shim-carrying Blob URL for one remembered script Blob. */
  const substitute = (key: string): string => {
    const existing = substituted.get(key)
    if (existing !== undefined) return existing
    const source = scripts.get(key)
    if (source === undefined) return key
    const patched = create.call(url, new (BlobClass as { new (parts: unknown[], options?: { type?: string }): unknown })([
      pdfWorkerCompatSource(), source,
    ], { type: 'text/javascript' }))
    substituted.set(key, patched)
    return patched
  }

  url.createObjectURL = (input: unknown): string => {
    const key = create.call(url, input)
    if (input !== null && typeof input === 'object' && input instanceof BlobClass
      && SCRIPT_BLOB_TYPES.includes((input as { type: string }).type)) scripts.set(key, input)
    return key
  }
  url.revokeObjectURL = (input: string): void => {
    revoke.call(url, input)
    const patched = substituted.get(input)
    if (patched !== undefined) {
      revoke.call(url, patched)
      substituted.delete(input)
    }
    scripts.delete(input)
  }

  const PatchedWorker = function (this: unknown, scriptURL: string | URL, options?: { readonly type?: string }): object {
    const key = String(scriptURL)
    const target = options?.type === 'module' ? substitute(key) : key
    return new NativeWorker(target, options)
  } as unknown as WorkerConstructor
  PatchedWorker.prototype = NativeWorker.prototype
  Object.defineProperty(PatchedWorker, PATCH_MARKER, { value: true })
  scope.Worker = PatchedWorker

  return () => {
    for (const patched of substituted.values()) revoke.call(url, patched)
    substituted.clear()
    scripts.clear()
    url.createObjectURL = create
    url.revokeObjectURL = revoke
    if (scope.Worker === PatchedWorker) scope.Worker = NativeWorker
  }
}
