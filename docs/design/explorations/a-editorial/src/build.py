#!/usr/bin/env python3
"""Build the mock-ups: expand {{ … }} in src/pages/*.html, subset fonts, render PNGs.

usage: python src/build.py [page …] [--no-shoot] [--fonts]
Templates may call anything in hs.draw, hs.parts and hs.data inside {{ }}.
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))

from hs import data, draw, parts  # noqa: E402

SCRATCH = Path('/private/tmp/claude-501/-Users-user-Workspace-projects---/f22b5159-9a91-45f0-86f3-be240492ba74/scratchpad')
FONT_SRC = SCRATCH / 'fonts'
SHOOT = SCRATCH / 'bin' / 'shoot.sh'

PAGES = {  # name: (width, height, scale)
    'today': (390, 844, 2),
    'practices': (390, 844, 2),
    'detail': (390, 2000, 2),
    'player-breath': (390, 844, 2),
    'player-focus': (390, 844, 2),
    'records': (1440, 900, 1),
    'today-desktop': (1440, 900, 1),
    'system': (1440, 2400, 1),
}


def wordmark_outline():
    """回神 in 思源宋体 SemiBold (wght 600), as outlines, tracked +0.12 em."""
    cache = HERE / 'wordmark.json'
    if cache.exists():
        return json.loads(cache.read_text())
    from fontTools import subset
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.pens.boundsPen import BoundsPen
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer
    f = TTFont(FONT_SRC / 'NotoSerifSC-VF.ttf')
    opts = subset.Options()
    opts.notdef_outline = False
    sub = subset.Subsetter(opts)
    sub.populate(text='回神')
    sub.subset(f)
    f = instancer.instantiateVariableFont(f, {'wght': 600})
    gs = f.getGlyphSet()
    cmap = f.getBestCmap()
    pen = SVGPathPen(gs)
    bpen = BoundsPen(gs)
    x = 0
    asc = 880
    for ch in '回神':
        g = cmap[ord(ch)]
        tp = TransformPen(pen, (1, 0, 0, -1, x, asc))
        gs[g].draw(tp)
        gs[g].draw(TransformPen(bpen, (1, 0, 0, -1, x, asc)))
        x += gs[g].width + 120
    xmin, ymin, xmax, ymax = bpen.bounds
    pad = 0
    view = [round(xmin - pad), round(ymin - pad), round(xmax - xmin + 2 * pad), round(ymax - ymin + 2 * pad)]
    out = {'d': pen.getCommands(), 'view': view}
    cache.write_text(json.dumps(out))
    return out


def expand(text):
    ns = {**{k: getattr(draw, k) for k in dir(draw) if not k.startswith('_')},
          **{k: getattr(parts, k) for k in dir(parts) if not k.startswith('_')},
          'data': data, 'D': data}

    def sub(m):
        return str(eval(m.group(1), ns))
    return re.sub(r'\{\{(.+?)\}\}', sub, text, flags=re.S)


def subset_fonts(chars):
    from fontTools import subset
    from fontTools.ttLib import TTFont
    jobs = [
        ('NotoSerifSC-VF.ttf', 'hs-song.woff', ''.join(c for c in chars if ord(c) > 0x2000) + '回神'),
        ('SourceSerif4-VF.ttf', 'hs-serif.woff', ''.join(chr(c) for c in range(0x20, 0x7F)) + ' °±× –′″−→↑↓'),
        ('LXGWWenKai-Regular.ttf', 'hs-kai.woff', ''.join(c for c in chars if ord(c) > 0x2000)),
    ]
    for src, dst, text in jobs:
        opts = subset.Options()
        opts.flavor = 'woff'
        opts.layout_features = ['*']
        opts.name_IDs = ['*']
        opts.name_languages = ['*']
        opts.notdef_outline = True
        f = TTFont(FONT_SRC / src)
        s = subset.Subsetter(opts)
        s.populate(text=text)
        s.subset(f)
        out = ROOT / 'fonts' / dst
        f.flavor = 'woff'
        f.save(out)
        print(f'  font {dst}: {out.stat().st_size // 1024} KB')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = {a for a in sys.argv[1:] if a.startswith('--')}
    print('data', data.checks())
    wm = wordmark_outline()
    draw.WORDMARK_PATH = wm['d']
    draw.WORDMARK_VIEW = tuple(wm['view'])
    names = args or list(PAGES)
    for name in names:
        src = HERE / 'pages' / f'{name}.html'
        if not src.exists():
            print('  skip', name)
            continue
        html = expand(src.read_text())
        (ROOT / f'{name}.html').write_text(html)
        print('  page', name)
    if '--fonts' in flags or not (ROOT / 'fonts' / 'hs-song.woff').exists():
        chars = set()
        for p in ROOT.glob('*.html'):
            chars |= set(p.read_text())
        for p in ROOT.glob('*.css'):
            chars |= set(p.read_text())
        chars |= set((HERE / 'hs' / 'data.py').read_text())
        subset_fonts(''.join(sorted(chars)))
    if '--no-shoot' not in flags:
        for name in names:
            if not (ROOT / f'{name}.html').exists():
                continue
            w, h, s = PAGES[name]
            r = subprocess.run([str(SHOOT), str(ROOT / f'{name}.html'), str(ROOT / f'{name}.png'), str(w), str(h), str(s)],
                               capture_output=True, text=True)
            print(' ', r.stdout.strip() or r.stderr.strip())


if __name__ == '__main__':
    main()
