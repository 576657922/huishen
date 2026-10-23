#!/usr/bin/env python3
"""Build logo.svg, app-icon.svg and favicon.svg.

The mark is 回 drawn as a 朱文 seal with the logic of a 宋体 glyph: verticals heavier than
horizontals, and the left stems running a little below their frames, as a brush stroke does.
The wordmark is 回神 set in 思源宋体 (Noto Serif SC) SemiBold, converted to outlines so the
files need no font. Run with the scratchpad venv (fontTools):
    python src/logo.py
"""
from pathlib import Path

from fontTools import subset
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

HERE = Path(__file__).resolve().parent
FINAL = HERE.parent
FONT = Path('/private/tmp/claude-501/-Users-user-Workspace-projects---/f22b5159-9a91-45f0-86f3-be240492ba74/scratchpad/fonts/NotoSerifSC-VF.ttf')

ZHU, ZHU_DARK = '#B33A21', '#E2683F'
INK, INK_DARK = '#1B1916', '#EDE7DB'
PAPER = '#F4F1EA'


def n(x):
    s = f'{x:.2f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


# ---- the mark, on a 48-unit square (outer frame 6..42) -----------------------------
# (x, y, w, h). Verticals 5.6 / 3.8, horizontals 3.4 / 2.6, left stems overhang.
MARK = [
    (6, 6, 36, 3.4),          # outer top
    (6, 38.6, 36, 3.4),       # outer bottom
    (6, 6, 5.6, 38.4),        # outer left stem, runs 2.4 below the frame
    (36.4, 6, 5.6, 36),       # outer right stem
    (15.7, 15, 16.6, 2.6),    # inner top
    (15.7, 28.8, 16.6, 2.6),  # inner bottom
    (15.7, 15, 3.8, 17.8),    # inner left, runs 1.4 below
    (28.5, 15, 3.8, 16.4),    # inner right
]


def mark_path(scale=1.0, dx=0.0, dy=0.0):
    d = []
    for x, y, w, h in MARK:
        X, Y, W, H = x * scale + dx, y * scale + dy, w * scale, h * scale
        d.append(f'M{n(X)} {n(Y)}H{n(X + W)}V{n(Y + H)}H{n(X)}Z')
    return ''.join(d)


# ---- the wordmark -------------------------------------------------------------------
def wordmark(text='回神', wght=600, tracking=0.12):
    f = TTFont(FONT)
    opts = subset.Options()
    opts.notdef_outline = False
    opts.layout_features = []
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(f)
    f = instancer.instantiateVariableFont(f, {'wght': wght})
    gs = f.getGlyphSet()
    cmap = f.getBestCmap()
    upm = f['head'].unitsPerEm
    pen = SVGPathPen(gs)
    bounds = BoundsPen(gs)
    x = 0
    asc = 880  # typo ascender: glyphs drawn with the em box top at y = 0
    for i, ch in enumerate(text):
        g = cmap[ord(ch)]
        t = (1, 0, 0, -1, x, asc)
        gs[g].draw(TransformPen(pen, t))
        gs[g].draw(TransformPen(bounds, t))
        x += gs[g].width + (tracking * upm if i < len(text) - 1 else 0)
    return pen.getCommands(), bounds.bounds, upm


def main():
    d, (x0, y0, x1, y1), upm = wordmark()
    wm_w, wm_h = x1 - x0, y1 - y0
    # Lockup: the seal is as tall as the 回 of the wordmark; gap = 0.42 em.
    unit = 0.92 * wm_h / 36.0    # mark frame (36 units) = 92 % of the wordmark's ink height
    mark_w = 36 * unit
    gap = 0.42 * upm
    total_w = mark_w + gap + wm_w
    # mark frame spans 6..42 → shift so the frame starts at x = 0, y = 0
    mark_d = mark_path(unit, -6 * unit, -6 * unit)
    over = 2.4 * unit            # the left stem's overhang below the frame
    frame_h = 36 * unit
    top = (wm_h - frame_h) / 2   # centre the frame on the wordmark
    mark_d = mark_path(unit, -6 * unit, top - 6 * unit)
    H = max(wm_h, top + frame_h + over)
    wm_dx = mark_w + gap - x0
    wm_dy = -y0
    logo = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n(total_w)} {n(H)}" width="{n(total_w / H * 40)}" height="40" role="img" aria-label="回神">
  <title>回神</title>
  <style>
    .zhu {{ fill: {ZHU} }} .ink {{ fill: {INK} }}
    @media (prefers-color-scheme: dark) {{ .zhu {{ fill: {ZHU_DARK} }} .ink {{ fill: {INK_DARK} }} }}
  </style>
  <!-- seal: 回 as a 朱文 seal; wordmark: 思源宋体 SemiBold outlines, tracked +0.12 em -->
  <path class="zhu" d="{mark_d}"/>
  <path class="ink" transform="translate({n(wm_dx)} {n(wm_dy)})" d="{d}"/>
</svg>
'''
    (FINAL / 'logo.svg').write_text(logo)

    # Mark alone (for the in-app lockup, which sets the wordmark as live text or outline)
    mark_only = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="6 6 36 38.4" width="36" height="38.4" role="img" aria-label="回神">
  <style>.zhu {{ fill: {ZHU} }} @media (prefers-color-scheme: dark) {{ .zhu {{ fill: {ZHU_DARK} }} }}</style>
  <path class="zhu" d="{mark_path()}"/>
</svg>
'''
    (FINAL / 'mark.svg').write_text(mark_only)

    # App icon, 1024: paper ground, the seal centred at 50 % of the side.
    # Maskable safe zone = circle of radius 40 %; a square of side s fits when s/√2 ≤ 0.4 → s ≤ 56.6 %.
    S = 1024
    side = 0.50 * S
    u = side / 36
    bbox_h = 38.4 * u
    dx = (S - side) / 2 - 6 * u
    dy = (S - bbox_h) / 2 - 6 * u + 0.6 * u  # optical: sit the frame a hair low of the bbox centre
    icon = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}" width="{S}" height="{S}">
  <title>回神</title>
  <!-- maskable: full-bleed paper; the seal ({n(side / S * 100)} % of the side) sits inside the central 80 % circle -->
  <rect width="{S}" height="{S}" fill="{PAPER}"/>
  <path fill="{ZHU}" d="{mark_path(u, dx, dy)}"/>
</svg>
'''
    (FINAL / 'app-icon.svg').write_text(icon)

    # Favicon, 32 grid: same seal, thicker strokes for 16 px, on a paper tile so it reads
    # on both light and dark browser chrome.
    fav = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <title>回神</title>
  <rect width="32" height="32" rx="7" fill="{PAPER}"/>
  <g fill="{ZHU}">
    <path d="M6 6H26V8.2H6Z M6 23.8H26V26H6Z M6 6H9.2V27.4H6Z M22.8 6H26V26H22.8Z"/>
    <path d="M11.4 11H20.6V13H11.4Z M11.4 18.2H20.6V20.2H11.4Z M11.4 11H13.8V21H11.4Z M18.2 11H20.6V20.2H18.2Z"/>
  </g>
</svg>
'''
    (FINAL / 'favicon.svg').write_text(fav)
    print('wordmark ink', round(wm_w), 'x', round(wm_h), 'units; lockup', n(total_w), 'x', n(H))


if __name__ == '__main__':
    main()
