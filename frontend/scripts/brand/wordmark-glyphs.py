"""Export per-letter outlines of the CodeForge wordmark for the footer's animated wordmark.

The footer's TechText effect inspects letters one by one. Given these outlines it draws each
letter as a vector path instead of typing it with a font, so the site never serves the Roundex
font file. Output is in font units, laid out with the logo's kerning and tracking; paths are
flipped to y-down so they draw straight onto a canvas at the baseline.

Usage:
    .venv/bin/python scripts/brand/wordmark-glyphs.py path/to/Roundex.otf CODEFORGE 0.02 \
        > components/marketing/footer-wordmark-glyphs.json

Roundex is by Eko Bimantara; licensed by the project owner for the logo. Keep the font file
itself out of the repo.
"""

from __future__ import annotations

import json
import sys

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont


def number(value: float) -> str:
    return f"{value:.1f}".rstrip("0").rstrip(".")


def main() -> None:
    path, text, tracking_em = sys.argv[1], sys.argv[2], float(sys.argv[3])
    font = TTFont(path)
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm

    def bounds(name: str) -> list[float]:
        pen = BoundsPen(glyph_set)
        glyph_set[name].draw(pen)
        return [round(v, 1) for v in pen.bounds]

    hb_font = hb.Font(hb.Face(hb.Blob(open(path, "rb").read())))
    buffer = hb.Buffer()
    buffer.add_str(text)
    buffer.guess_segment_properties()
    hb.shape(hb_font, buffer, {"kern": True, "liga": True})
    order = font.getGlyphOrder()

    glyphs, x = [], 0.0
    pairs = list(zip(buffer.glyph_infos, buffer.glyph_positions))
    for index, (info, pos) in enumerate(pairs):
        name = order[info.codepoint]
        pen = SVGPathPen(glyph_set, ntos=number)
        glyph_set[name].draw(TransformPen(pen, (1, 0, 0, -1, 0, 0)))
        glyphs.append({
            "char": text[info.cluster],
            "x": round(x + pos.x_offset, 1),
            "path": pen.getCommands(),
            "bounds": bounds(name),
        })
        x += pos.x_advance + (tracking_em * upm if index < len(pairs) - 1 else 0)

    def top(char: str) -> float:
        return bounds(cmap[ord(char)])[3]

    json.dump(
        {
            "font": "Roundex",
            "unitsPerEm": upm,
            # Guide lines, in font units above the baseline (descender negative).
            "metrics": {
                "xHeight": top("x"),
                "capHeight": top("H"),
                "ascender": top("d"),
                "descender": bounds(cmap[ord("p")])[1],
            },
            "glyphs": glyphs,
        },
        sys.stdout,
        separators=(",", ":"),
    )


if __name__ == "__main__":
    main()
