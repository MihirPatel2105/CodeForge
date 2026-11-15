"""Draw the CodeForge wordmark as SVG path data, from Newsreader ExtraBold.

The layout reproduces the approved /preview/logo geometry, which was measured against the
supplied lockup so the new wordmark sits beside the unchanged icon exactly like the old one:
capitals 0.472 of the icon's ink height and centred on it, the same ink-to-ink gap.

All lengths are in the lockup's own units: the icon's padded box is 447 tall (the supplied
image's height), so the output drops straight into a 447-tall SVG viewBox.

Usage:
    python -m venv .venv && .venv/bin/pip install fonttools uharfbuzz
    .venv/bin/python scripts/brand/wordmark.py path/to/Newsreader[opsz,wght].ttf > wordmark.json

Newsreader: https://github.com/google/fonts/tree/main/ofl/newsreader (SIL OFL 1.1).
"""

from __future__ import annotations

import io
import json
import sys

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

TEXT = "CodeForge"
LOCATION = {"wght": 800.0, "opsz": 72.0}  # ExtraBold, display optical size

BOX = 447.0  # icon's padded box height = lockup height
ICON_BOX_WIDTH = 437.76  # left 24% of the supplied 1824-wide lockup
FONT_SIZE = 0.604 * BOX  # capitals at 0.472 of the icon's ink height
GAP = 0.04 * BOX  # with the icon's margin and the C's side bearing: same ink gap as before
TRACKING_EM = -0.025
# Hand-tuned pair spacing, in em, added before the glyph at that index. At this weight and
# tracking the e's terminal touches the F's serif; this opens the "eF" join to the ~7px the
# other letters keep (e.g. o→d), so "Code" and "Forge" read as one word without colliding.
EXTRA_BEFORE = {4: 0.035}
# CSS line box of 1em (ascent 0.74 + descent 0.26) centred on the icon, then shifted 0.148em
# so the capitals' middle sits on the icon's middle, as in the supplied lockup.
BASELINE = BOX / 2 + (0.74 - 0.5 + 0.148) * FONT_SIZE


def static_instance(path: str) -> TTFont:
    font = instantiateVariableFont(TTFont(path), LOCATION)
    buffer = io.BytesIO()
    font.save(buffer)
    buffer.seek(0)
    return TTFont(buffer)


def shaped_glyphs(font: TTFont) -> list[tuple[str, float, float]]:
    """(glyph name, x advance, x offset) in font units, with the font's own kerning."""
    buffer = io.BytesIO()
    font.save(buffer)
    hb_font = hb.Font(hb.Face(hb.Blob(buffer.getvalue())))
    hb_buffer = hb.Buffer()
    hb_buffer.add_str(TEXT)
    hb_buffer.guess_segment_properties()
    hb.shape(hb_font, hb_buffer, {"kern": True, "liga": True})
    order = font.getGlyphOrder()
    return [
        (order[info.codepoint], float(pos.x_advance), float(pos.x_offset))
        for info, pos in zip(hb_buffer.glyph_infos, hb_buffer.glyph_positions)
    ]


def main() -> None:
    font = static_instance(sys.argv[1])
    glyph_set = font.getGlyphSet()
    scale = FONT_SIZE / font["head"].unitsPerEm
    tracking = TRACKING_EM * FONT_SIZE

    path_pen = SVGPathPen(glyph_set, ntos=lambda value: f"{value:.2f}".rstrip("0").rstrip("."))
    bounds_pen = BoundsPen(glyph_set)
    x = ICON_BOX_WIDTH + GAP
    glyphs = shaped_glyphs(font)
    for index, (name, advance, offset) in enumerate(glyphs):
        x += EXTRA_BEFORE.get(index, 0) * FONT_SIZE
        # Font units are y-up; SVG is y-down, so flip about the baseline.
        transform = (scale, 0, 0, -scale, x + offset * scale, BASELINE)
        glyph_set[name].draw(TransformPen(path_pen, transform))
        glyph_set[name].draw(TransformPen(bounds_pen, transform))
        x += advance * scale + (tracking if index < len(glyphs) - 1 else 0)

    x_min, y_min, x_max, y_max = bounds_pen.bounds
    json.dump(
        {
            "d": path_pen.getCommands(),
            "inkLeft": x_min,
            "inkRight": x_max,
            "inkTop": y_min,
            "inkBottom": y_max,
            "baseline": BASELINE,
            "fontSize": FONT_SIZE,
            "box": BOX,
            "iconBoxWidth": ICON_BOX_WIDTH,
        },
        sys.stdout,
    )


if __name__ == "__main__":
    main()
