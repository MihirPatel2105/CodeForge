"""Draw the CodeForge wordmark as SVG path data, from Roundex (the live logo, v4).

Laid out to the rules measured from the supplied lockup, so the wordmark sits beside the
unchanged icon exactly like the original: capitals at 0.472 of the icon's ink height and
centred on it (plus the original's 0.008 offset), the first letter's ink at x=464 (the
original 38px ink-to-ink gap). For an all-lowercase text the x-height band is centred instead.
All lengths are in the lockup's units: the icon's padded box is 447 tall.

Roundex is by Eko Bimantara (https://ekobimantara.com/), "All rights reserved". The project
owner holds a licence covering its use in this logo (confirmed 2026-11-15). The font file is
not stored in this repo; keep it out, and use your licensed copy to rebuild.

Usage:
    python -m venv .venv && .venv/bin/pip install fonttools uharfbuzz
    .venv/bin/python scripts/brand/wordmark-roundex.py path/to/Roundex.otf CODEFORGE 0.02 > wordmark.json
    node scripts/brand/build-lockup.mjs wordmark.json v4
"""

from __future__ import annotations

import json
import sys

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

BOX = 447.0
ICON_BOX_WIDTH = 437.76
INK_LEFT = 464.0  # first letter's ink, as in the supplied lockup
ICON_INK_TOP, ICON_INK_BOTTOM = 11.0, 435.0
ICON_INK = ICON_INK_BOTTOM - ICON_INK_TOP
CAP_HEIGHT = 0.472 * ICON_INK
BAND_CENTRE = (ICON_INK_TOP + ICON_INK_BOTTOM) / 2 + 0.008 * ICON_INK


def glyph_bounds(glyph_set, name: str) -> tuple[float, float, float, float]:
    pen = BoundsPen(glyph_set)
    glyph_set[name].draw(pen)
    return pen.bounds


def main() -> None:
    path, text, tracking_em = sys.argv[1], sys.argv[2], float(sys.argv[3])
    font = TTFont(path)
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm

    cap_top = glyph_bounds(glyph_set, cmap[ord("H")])[3]
    font_size = CAP_HEIGHT / (cap_top / upm)
    scale = font_size / upm
    band_top = glyph_bounds(glyph_set, cmap[ord("x")])[3] if text.islower() else cap_top
    baseline = BAND_CENTRE + (band_top * scale) / 2

    hb_font = hb.Font(hb.Face(hb.Blob(open(path, "rb").read())))
    buffer = hb.Buffer()
    buffer.add_str(text)
    buffer.guess_segment_properties()
    hb.shape(hb_font, buffer, {"kern": True, "liga": True})
    order = font.getGlyphOrder()
    glyphs = [
        (order[info.codepoint], pos.x_advance, pos.x_offset)
        for info, pos in zip(buffer.glyph_infos, buffer.glyph_positions)
    ]

    x = INK_LEFT - glyph_bounds(glyph_set, glyphs[0][0])[0] * scale
    path_pen = SVGPathPen(glyph_set, ntos=lambda value: f"{value:.2f}".rstrip("0").rstrip("."))
    bounds_pen = BoundsPen(glyph_set)
    for index, (name, advance, offset) in enumerate(glyphs):
        # Font units are y-up; SVG is y-down, so flip about the baseline.
        transform = (scale, 0, 0, -scale, x + offset * scale, baseline)
        glyph_set[name].draw(TransformPen(path_pen, transform))
        glyph_set[name].draw(TransformPen(bounds_pen, transform))
        x += advance * scale + (tracking_em * font_size if index < len(glyphs) - 1 else 0)

    x_min, y_min, x_max, y_max = bounds_pen.bounds
    json.dump(
        {
            "d": path_pen.getCommands(),
            "inkLeft": x_min,
            "inkRight": x_max,
            "inkTop": y_min,
            "inkBottom": y_max,
            "baseline": baseline,
            "fontSize": font_size,
            "box": BOX,
            "iconBoxWidth": ICON_BOX_WIDTH,
        },
        sys.stdout,
    )


if __name__ == "__main__":
    main()
