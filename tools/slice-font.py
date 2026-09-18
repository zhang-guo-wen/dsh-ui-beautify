#!/usr/bin/env python3
"""Slice a font face into unicode-range shards laid out like Noto Sans SC.

Why this exists: ``@fontsource/lxgw-wenkai`` ships monolithic woff2 files
(6.9-8.4 MB each) with no ``unicode-range`` splitting at all, so a browser has to
download a whole face before it can render a single glyph. Splitting the face
across the same ranges ``@fontsource-variable/noto-sans-sc`` uses lets the
browser fetch only the ranges a page actually renders — roughly 200 KB instead
of 8.4 MB on first paint.

The shard layout is read from the reference sheet rather than invented here, so
every face in this plugin cuts the character space the same way; switching faces
costs no extra requests for ranges already in flight.

Several weights of one face share an output directory and one stylesheet, which
is what the browser needs to pick a weight per range by itself.

Run once per font revision; the generated shards are committed to the repository.

Usage:
    python tools/slice-font.py \
        --reference assets/fonts/noto-sans-sc/index.css \
        --face 500=path/to/lxgw-wenkai-500.woff2 \
        --face 700=path/to/lxgw-wenkai-700.woff2 \
        --out-dir assets/fonts/lxgw-wenkai/files \
        --css-out assets/fonts/lxgw-wenkai/index.css \
        --family "LXGW WenKai" \
        --slug lxgw-wenkai
"""

from __future__ import annotations

import argparse
import io
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from fontTools.ttLib import TTFont

# `unicode-range: U+1f1e9-1f1f5,U+1f1f7-1f1ff,...` inside a @font-face block.
RANGE_RE = re.compile(r"unicode-range:\s*([^;}]+)", re.IGNORECASE)


def shard_key(url: str, reference_face: str) -> str | None:
    """Extract a shard's key from the file name a reference @font-face names.

    Keys are either a block number (`42`) or a script tag (`latin`,
    `latin-ext`). Both must be carried over: a layout read from the numbered
    blocks alone silently drops the Latin shards, and a CJK face without them
    falls back to a system font for every Latin letter and digit.
    """
    prefix = f"{reference_face}-"
    suffix = "-wght-normal.woff2"
    if not url.startswith(prefix) or not url.endswith(suffix):
        return None
    key = url[len(prefix):-len(suffix)]
    return key or None


def read_shard_ranges(reference: Path, reference_face: str) -> list[tuple[str, str]]:
    """Read the reference sheet's shard ranges in declaration order."""
    css = reference.read_text(encoding="utf-8")
    shards: list[tuple[str, str]] = []
    for block in css.split("@font-face")[1:]:
        url = re.search(r"url\(\./files/([^)]+)\)", block)
        rng = RANGE_RE.search(block)
        if url is None or rng is None:
            continue
        key = shard_key(url.group(1), reference_face)
        if key is None:
            continue
        shards.append((key, rng.group(1).strip()))
    return shards


def glyph_count(path: Path) -> int:
    """Count a produced shard's cmap entries; zero means nothing was kept."""
    with TTFont(path, lazy=True) as font:
        return sum(len(table.cmap) for table in font["cmap"].tables)


def decompress_to_ttf(source: Path, workdir: Path) -> Path:
    """Expand a woff2 source once, so every shard skips the brotli decode.

    A face here is sliced ~100 times; decoding it on every call dominates the
    run.
    """
    if source.suffix != ".woff2":
        return source
    font = TTFont(source)
    font.flavor = None
    target = workdir / f"{source.stem}.ttf"
    font.save(target)
    font.close()
    return target


def slice_shard(source: Path, out: Path, unicodes: str, layout_features: str) -> int:
    """Cut one unicode range out of the source face and write it as woff2."""
    command = [
        sys.executable, "-m", "fontTools.subset", str(source),
        f"--unicodes={unicodes}",
        f"--layout-features={layout_features}",
        "--flavor=woff2",
        f"--output-file={out}",
        "--name-IDs=*",
        "--drop-tables+=DSIG",
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f"pyftsubset failed for {out.name}:\n{result.stderr}")
    return glyph_count(out)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument(
        "--reference-face", default="noto-sans-sc",
        help="package name whose shard file names the reference sheet uses",
    )
    parser.add_argument(
        "--face", action="append", required=True, metavar="WEIGHT=PATH",
        help="source file for one weight, repeatable (e.g. 500=lxgw-500.woff2)",
    )
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--css-out", type=Path, required=True)
    parser.add_argument("--family", required=True)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--layout-features", default="*")
    args = parser.parse_args()

    faces: list[tuple[str, Path]] = []
    for entry in args.face:
        weight, separator, raw_path = entry.partition("=")
        if separator == "" or not weight.isdigit():
            raise SystemExit(f'--face expects WEIGHT=PATH, got "{entry}"')
        path = Path(raw_path)
        if not path.is_file():
            raise SystemExit(f"source face not found: {path}")
        faces.append((weight, path))

    shards = read_shard_ranges(args.reference, args.reference_face)
    if not shards:
        raise SystemExit(f"no unicode-range shards found in {args.reference}")
    print(f"reference layout: {len(shards)} shards, {len(faces)} weight(s)")

    if args.out_dir.exists():
        shutil.rmtree(args.out_dir)
    args.out_dir.mkdir(parents=True)

    blocks: list[str] = []
    with tempfile.TemporaryDirectory(prefix="slice-font-") as tmp:
        workdir = Path(tmp)
        for weight, source in faces:
            expanded = decompress_to_ttf(source, workdir)
            kept = skipped = glyphs = 0
            total = 0
            for key, unicodes in shards:
                name = f"{args.slug}-{key}-wght{weight}.woff2"
                out = args.out_dir / name
                count = slice_shard(expanded, out, unicodes, args.layout_features)
                if count == 0:
                    # The face has no glyphs in this range; dropping the shard
                    # and its @font-face lets those characters fall through to
                    # the fallback stack instead of resolving to an empty face.
                    out.unlink()
                    skipped += 1
                    continue
                kept += 1
                glyphs += count
                total += out.stat().st_size
                blocks.append("\n".join([
                    f"/* {args.slug}-[{key}]-wght{weight} — {count} glyphs */",
                    "@font-face {",
                    f"  font-family: '{args.family}';",
                    "  font-style: normal;",
                    "  font-display: swap;",
                    f"  font-weight: {weight};",
                    f"  src: url(./files/{name}) format('woff2');",
                    f"  unicode-range: {unicodes};",
                    "}",
                    "",
                ]))
            print(
                f"weight {weight}: kept {kept}, skipped {skipped} empty ranges, "
                f"{total / 1024 / 1024:.2f} MB, {glyphs} glyph slots",
            )

    args.css_out.parent.mkdir(parents=True, exist_ok=True)
    args.css_out.write_text("\n".join(blocks), encoding="utf-8")
    print(f"wrote {args.css_out} ({len(blocks)} @font-face rules)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
