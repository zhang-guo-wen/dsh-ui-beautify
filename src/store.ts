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

import { createHash } from 'node:crypto'
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import type { FontFace } from './fonts.ts'
import { downloadFile } from './source.ts'

/** Cache root segment under the harness home, matching the harness' own layout. */
const CACHE_SEGMENTS = ['cache', 'ui-beautify', 'fonts'] as const

/** What the store needs that a deployment can change. */
export interface FontStoreOptions {
  /** Absolute directory holding every cached sheet and shard. */
  cacheDir: string
  /** Mirror templates tried in order for each download. */
  mirrors: readonly string[]
}

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
export function resolveCacheDir(configured: string): string {
  if (configured.trim() !== '') return resolve(expandHome(configured))
  const fromEnv = process.env.DSH_HOME
  const home = fromEnv !== undefined && fromEnv.trim() !== '' ? expandHome(fromEnv) : join(homedir(), '.dsh')
  return resolve(home, ...CACHE_SEGMENTS)
}

/**
 * Expand the `~`, `~/`, and `~\` prefixes against the operating-system home.
 * @param path - a configured path that may start with a supported prefix.
 * @returns the expanded path, unchanged when no supported prefix is present.
 */
function expandHome(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/') || path.startsWith('~\\')) return join(homedir(), path.slice(2))
  return path
}

/** The cache directory holding one face's files. */
export class FontStore {
  private readonly pending = new Map<string, Promise<string>>()
  private readonly swept = new Set<string>()

  /**
   * @param options - cache root and mirror templates.
   */
  constructor(private readonly options: FontStoreOptions) {}

  /**
   * Return the cached path of one package-relative file, downloading it first
   * when it is not there yet.
   * @param face - the face whose package holds the file.
   * @param path - package-relative path, already validated by the route parser.
   * @returns the absolute path of the file on disk.
   * @throws FontDownloadError when no mirror could serve the file.
   */
  async file(face: FontFace, path: string): Promise<string> {
    const target = this.targetFor(face, path)
    if (await isFile(target)) return target
    const inFlight = this.pending.get(target)
    if (inFlight !== undefined) return await inFlight
    const attempt = this.fetch(face, path, target)
    this.pending.set(target, attempt)
    try {
      return await attempt
    } finally {
      this.pending.delete(target)
    }
  }

  /**
   * Resolve one package-relative path inside the face's current generation.
   * @param face - the face whose cache directory is used.
   * @param path - package-relative path.
   * @returns the absolute path, proved to stay inside the generation directory.
   */
  private targetFor(face: FontFace, path: string): string {
    const root = resolve(this.options.cacheDir, face.id, generationOf(face))
    const target = resolve(root, path)
    if (!target.startsWith(root + sep)) {
      throw new Error(`ui-beautify: ${path} escapes the cache directory`)
    }
    return target
  }

  private async fetch(face: FontFace, path: string, target: string): Promise<string> {
    const bytes = await downloadFile({ source: face.source, path }, this.options.mirrors)
    await mkdir(dirname(target), { recursive: true })
    await writeAtomic(target, bytes)
    await this.sweep(face)
    return target
  }

  /**
   * Drop the face's other generations.
   *
   * A generation is only ever left behind by a plugin upgrade that changed the
   * pinned version, so this runs once per face per process, after the download
   * that proved the current generation is usable.
   * @param face - the face whose stale generations are removed.
   */
  private async sweep(face: FontFace): Promise<void> {
    if (this.swept.has(face.id)) return
    this.swept.add(face.id)
    const parent = join(this.options.cacheDir, face.id)
    let entries: string[]
    try {
      entries = await readdir(parent)
    } catch {
      // Nothing has been cached for this face yet; the files just written are
      // the only generation and there is nothing to compare against.
      return
    }
    const current = generationOf(face)
    for (const entry of entries) {
      if (entry === current) continue
      // A generation left in place costs disk and nothing else, so removal is
      // never allowed to fail the request that triggered it.
      await rm(join(parent, entry), { recursive: true, force: true }).catch(() => undefined)
    }
  }
}

/**
 * Compute the generation directory name for one face.
 * @param face - the face to key.
 * @returns a short hash of the pinned package coordinates and sheets.
 */
function generationOf(face: FontFace): string {
  const key = [face.source.package, face.source.version, ...face.source.sheets].join('\n')
  return createHash('sha256').update(key).digest('hex').slice(0, 16)
}

/**
 * Check whether a cached file is already on disk.
 * @param path - the absolute candidate path.
 * @returns whether a regular file exists there.
 */
async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    // Absence is the normal cold-cache answer, and the caller downloads instead.
    return false
  }
}

/** Distinguish concurrent scratch files written by one process. */
let scratchSequence = 0

/**
 * Write a file so that it either appears complete or does not appear at all.
 * @param target - the final absolute path.
 * @param bytes - the file's bytes.
 */
async function writeAtomic(target: string, bytes: Buffer): Promise<void> {
  scratchSequence += 1
  const scratch = `${target}.${String(process.pid)}.${String(scratchSequence)}.tmp`
  try {
    await writeFile(scratch, bytes)
    await rename(scratch, target)
  } catch (error) {
    // A failed download must not leave a partial file where the cache looks for
    // a hit, so the scratch file goes away even when the rename never ran.
    await rm(scratch, { force: true }).catch(() => undefined)
    throw error
  }
}
