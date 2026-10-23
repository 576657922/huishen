"""SVG drawn from real parameters.

Breath curves use the same segments and easing as src/engine/patterns.ts
(cosine in-out, sine out for the sigh's top-up), so what the mock-ups show
is what the engine will draw.
"""
import math
import random
from datetime import timedelta

from . import data as D


def n(x):
    """Compact number for SVG attributes."""
    s = f'{x:.2f}'
    return s.rstrip('0').rstrip('.') if '.' in s else s


# ---------------------------------------------------------------- patterns
def ease_inout(q):
    q = min(max(q, 0.0), 1.0)
    return (1 - math.cos(q * math.pi)) / 2


def ease_out(q):
    q = min(max(q, 0.0), 1.0)
    return math.sin(q * math.pi / 2)


def resonance(rate=5.5, ratio='equal'):
    T = 60 / rate
    i = T * (0.5 if ratio == 'equal' else 0.4)
    return [('吸', i, 0, 1, 'inout'), ('呼', T - i, 1, 0, 'inout')]


PATTERNS = {
    'resonance': resonance(5.5),
    'sigh': [('吸', 2.5, 0, .78, 'inout'), ('再吸', 1.0, .78, 1, 'out'), ('呼', 7.0, 1, 0, 'inout')],
    'long-exhale': [('吸', 4, 0, 1, 'inout'), ('呼', 6, 1, 0, 'inout')],
    'box': [('吸', 4, 0, 1, 'inout'), ('停', 4, 1, 1, 'flat'), ('呼', 4, 1, 0, 'inout'), ('停', 4, 0, 0, 'flat')],
}


def period(p):
    return sum(s[1] for s in p)


def at(p, t):
    """(level 0–1, segment index, segment start time) at time t."""
    T = period(p)
    k = math.floor(t / T)
    tc = t - k * T
    t0 = 0
    for idx, (lab, dur, y0, y1, e) in enumerate(p):
        if tc < t0 + dur or idx == len(p) - 1:
            q = (tc - t0) / dur if dur else 1
            f = {'inout': ease_inout, 'out': ease_out, 'flat': lambda q: 0}[e](q)
            return y0 + (y1 - y0) * f, idx, k * T + t0
        t0 += dur


def seg_starts(p, a, b):
    """Every segment start in [a, b): (time, label, level at start)."""
    T = period(p)
    out = []
    k = math.floor(a / T) - 1
    while k * T < b:
        t0 = k * T
        for lab, dur, y0, y1, e in p:
            if a <= t0 < b:
                out.append((t0, lab, y0))
            t0 += dur
        k += 1
    return out


def polyline(points):
    return 'M' + ' L'.join(f'{n(x)} {n(y)}' for x, y in points)


# ---------------------------------------------------------------- icons
ICONS = {
    # tabs: outline (inactive) and filled (active)
    'today': '<rect x="3.75" y="3.75" width="16.5" height="16.5"/><rect x="9.75" y="9.75" width="4.5" height="4.5"/>',
    'today-on': '<rect x="3.75" y="3.75" width="16.5" height="16.5"/><rect x="9" y="9" width="6" height="6" fill="currentColor" stroke="none"/>',
    'practice': '<path d="M2.75 18.25H5.5C8.43 18.25 9.08 6.25 12 6.25S15.57 18.25 18.5 18.25H21.25"/>',
    'practice-on': '<path d="M5.5 18.25C8.43 18.25 9.08 6.25 12 6.25S15.57 18.25 18.5 18.25Z" fill="currentColor"/><path d="M2.75 18.25H21.25"/>',
    'records': '<rect x="3.75" y="5.25" width="16.5" height="15"/><path d="M3.75 9.75H20.25M8.25 3V6.75M15.75 3V6.75"/><rect x="13.5" y="13.5" width="3" height="3" fill="currentColor" stroke="none"/>',
    'records-on': '<path d="M3 4.5H21V10.5H3Z" fill="currentColor" stroke="none"/><rect x="3.75" y="5.25" width="16.5" height="15"/><path d="M8.25 2.25V4.5M15.75 2.25V4.5"/><rect x="13" y="13" width="4" height="4" fill="currentColor" stroke="none"/>',
    'evidence': '<path d="M12 6.75L3.75 4.75V17.75L12 19.75L20.25 17.75V4.75Z"/><path d="M12 6.75V19.75"/>',
    'evidence-on': '<path d="M11.25 6.6L3 4.6V18.2L11.25 20.2Z" fill="currentColor" stroke="none"/><path d="M12.75 6.6L21 4.6V18.2L12.75 20.2Z" fill="currentColor" stroke="none"/>',
    # utility
    'settings': '<path d="M3.75 8.25H7.5M12.5 8.25H20.25M3.75 15.75H11.5M16.5 15.75H20.25"/><rect x="7.5" y="5.75" width="5" height="5"/><rect x="11.5" y="13.25" width="5" height="5"/>',
    'back': '<path d="M15 4.5L7.5 12L15 19.5"/>',
    'chevron': '<path d="M9.75 6.75L15 12L9.75 17.25"/>',
    'play': '<path d="M7.75 5.25V18.75L18.5 12Z"/>',
    'play-on': '<path d="M7.75 5.25V18.75L18.5 12Z" fill="currentColor"/>',
    'pause': '<path d="M8.75 5.25V18.75M15.25 5.25V18.75"/>',
    'pause-on': '<rect x="7" y="5.25" width="3.5" height="13.5" fill="currentColor" stroke="none"/><rect x="13.5" y="5.25" width="3.5" height="13.5" fill="currentColor" stroke="none"/>',
    'end': '<rect x="6.75" y="6.75" width="10.5" height="10.5"/>',
    'sound': '<path d="M3.75 9.25H7.25L12.25 5.25V18.75L7.25 14.75H3.75Z"/><path d="M15.5 9.5C16.25 10.25 16.75 11 16.75 12S16.25 13.75 15.5 14.5M18 6.75C19.5 8.25 20.25 10 20.25 12S19.5 15.75 18 17.25"/>',
    'close': '<path d="M6.25 6.25L17.75 17.75M17.75 6.25L6.25 17.75"/>',
    'export': '<path d="M12 3.75V14.25M7.75 8L12 3.75L16.25 8"/><path d="M4.75 12.75V20.25H19.25V12.75"/>',
    'search': '<rect x="4.25" y="4.25" width="11.5" height="11.5" rx="5.75"/><path d="M14.25 14.25L19.75 19.75"/>',
    'moon': '<path d="M19.25 14.5A7.75 7.75 0 1 1 9.5 4.75A6.25 6.25 0 0 0 19.25 14.5Z"/>',
    'bell': '<path d="M6.75 16.5V11.5A5.25 5.25 0 0 1 17.25 11.5V16.5"/><path d="M4.5 16.5H19.5M10.5 19.75H13.5"/>',
}


def sprite():
    out = ['<svg class="sprite" width="0" height="0" aria-hidden="true" style="position:absolute"><defs>']
    for k, v in ICONS.items():
        out.append(f'<symbol id="i-{k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
                   f'stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter">{v}</symbol>')
    out.append('</defs></svg>')
    return ''.join(out)


def icon(name, cls='icon', size=None, label=None):
    a = f' role="img" aria-label="{label}"' if label else ' aria-hidden="true"'
    s = f' width="{size}" height="{size}"' if size else ''
    return f'<svg class="{cls}"{s}{a}><use href="#i-{name}"/></svg>'


# ---------------------------------------------------------------- logo
# 回 drawn with the logic of 宋体: verticals heavier than horizontals,
# the left stem running a little below the frame. The outer frame doubles
# as the border of a 朱文 seal.
MARK_RECTS = [
    (5, 5, 38, 3.4),        # outer top
    (5, 39.6, 38, 3.4),     # outer bottom
    (5, 5, 5.6, 40.6),      # outer left stem, overhangs
    (37.4, 5, 5.6, 38),     # outer right stem
    (18, 16.5, 12, 2.8),    # inner top
    (18, 27.7, 12, 2.8),    # inner bottom
    (18, 16.5, 4.4, 15.2),  # inner left, overhangs
    (25.6, 16.5, 4.4, 14),  # inner right
]


def mark(size=24, cls='mark', color='var(--zhu)', label='回神'):
    rects = ''.join(f'<rect x="{n(x)}" y="{n(y)}" width="{n(w)}" height="{n(h)}"/>' for x, y, w, h in MARK_RECTS)
    a = f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
    return (f'<svg class="{cls}" width="{size}" height="{size}" viewBox="0 0 48 48" {a}>'
            f'<g fill="{color}">{rects}</g></svg>')


WORDMARK_PATH = None  # filled in by build.py from 思源宋体 outlines (wght 600)
WORDMARK_VIEW = (0, 0, 100, 50)


def wordmark(height=20, color='currentColor', cls='wordmark'):
    x, y, w, h = WORDMARK_VIEW
    width = height * w / h
    return (f'<svg class="{cls}" width="{n(width)}" height="{height}" viewBox="{n(x)} {n(y)} {n(w)} {n(h)}" '
            f'role="img" aria-label="回神"><path fill="{color}" d="{WORDMARK_PATH}"/></svg>')


def lockup(height=20, gap=None):
    """Seal + wordmark, as on a signed page: name, then the seal."""
    gap = gap if gap is not None else round(height * .5)
    return (f'<span class="lockup" style="gap:{gap}px">{mark(round(height * 1.1), label=None)}'
            f'{wordmark(height)}</span>')


# ---------------------------------------------------------------- specimens
def _svg(w, h, body, cls='glyph', extra=''):
    return (f'<svg class="{cls}" width="{w}" height="{h}" viewBox="0 0 {w} {h}" aria-hidden="true" {extra}>'
            f'{body}</svg>')


def breath_glyph(pid, w=48, h=24, seconds=20):
    p = PATTERNS[pid]
    top, bot = 3.5, h - 3.5
    pts = []
    steps = 240
    for i in range(steps + 1):
        t = seconds * i / steps
        y = at(p, t)[0]
        pts.append((w * i / steps, bot - y * (bot - top)))
    return _svg(w, h, f'<path d="{polyline(pts)}" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>')


def pace_finder_glyph(w=48, h=24):
    rates = [6.5, 6.0, 5.5, 5.0, 4.5]
    gap = 2
    total = sum(60 / r for r in rates)
    k = (w - gap * (len(rates) - 1)) / total
    top, bot = 3.5, h - 3.5
    x0 = 0
    paths = []
    for r in rates:
        T = 60 / r
        p = resonance(r)
        pts = [(x0 + k * T * i / 60, bot - at(p, T * i / 60)[0] * (bot - top)) for i in range(61)]
        paths.append(polyline(pts))
        x0 += k * T + gap
    return _svg(w, h, f'<path d="{" ".join(paths)}" fill="none" stroke="currentColor" stroke-width="1.25"/>')


def med_glyph(pid, w=48, h=24):
    sw = 'stroke="currentColor" stroke-width="1.25" fill="none"'
    if pid == 'focus':
        ticks = [4.5, 12.5, 16.5, 26.5, 34.5, 43.5]
        d = 'M0 17.5H48 ' + ' '.join(f'M{n(x)} 17.5V8.5' for x in ticks)
        return _svg(w, h, f'<path d="{d}" {sw}/>')
    if pid == 'count':
        sw_ = 2.4
        d = 'M0 21'
        x = 0
        for cyc in range(2):
            for c in range(1, 10):
                y = 21 - c * 2
                d += f'V{n(y)}H{n(x + sw_)}'
                x += sw_
            d += 'V21'
            x += 2.4
        return _svg(w, h, f'<path d="{d}" {sw} stroke-linejoin="miter"/>')
    if pid == 'body-scan':
        # sections of the real script: weights and body height (0 feet – 1 head)
        secs = [(0.7, .48), (1.2, .1), (1.0, .1), (1.0, .42), (1.0, .64), (1.0, .56), (1.0, .9)]
        whole = 2.0
        total = sum(s[0] for s in secs) + whole
        k = w / total
        top, bot = 3, h - 3
        x = 0
        d = ''
        for wt, lv in secs:
            y = bot - lv * (bot - top)
            d += f'M{n(x)} {n(y)}H{n(x + wt * k - 1.5)}'
            x += wt * k
        for lv in (.1, .48, .9):
            y = bot - lv * (bot - top)
            d += f'M{n(x)} {n(y)}H{n(w)}'
        return _svg(w, h, f'<path d="{d}" {sw}/>')
    if pid == 'loving-kindness':
        dots = []
        for col in range(5):
            cnt = col + 1
            cx = 4 + col * 10
            for j in range(cnt):
                cy = 12 + (j - (cnt - 1) / 2) * 4
                dots.append(f'<circle cx="{n(cx)}" cy="{n(cy)}" r="1.3"/>')
        return _svg(w, h, f'<g fill="currentColor">{"".join(dots)}</g>')
    if pid == 'breathing-space':
        def half(x):
            # wide (觉察) → narrow (集中) → wide (扩展), thirds of the practice
            if x < 16:
                return 1.5 + 7.5 * (1 - ease_inout(x / 16))
            if x < 32:
                return 1.5
            return 1.5 + 7.5 * ease_inout((x - 32) / 16)
        top = [(x, 12 - half(x)) for x in [i * 0.5 for i in range(97)]]
        bot = [(x, 12 + half(x)) for x in [i * 0.5 for i in range(97)]]
        return _svg(w, h, f'<path d="{polyline(top)} {polyline(bot)}" {sw}/>')
    if pid == 'open-awareness':
        d = 'M0 12H17M20 12H24M26.5 12H29'
        pts = [(32, 10.5), (34.5, 14.5), (36.5, 8), (38.5, 17.5), (40, 12.5), (42.5, 6), (43.5, 15.5), (46, 10), (47, 19)]
        dots = ''.join(f'<circle cx="{x}" cy="{y}" r="1.1"/>' for x, y in pts)
        return _svg(w, h, f'<path d="{d}" {sw}/><g fill="currentColor">{dots}</g>')
    if pid == 'timer':
        d = 'M5.5 14H21.5M26.5 14H42.5'
        c = ('<circle cx="3.25" cy="14" r="2.25"/><circle cx="24" cy="14" r="1.6"/>'
             '<circle cx="44.75" cy="14" r="2.25"/>')
        return _svg(w, h, f'<path d="{d}" {sw}/><g {sw}>{c}</g>')
    raise KeyError(pid)


def sound_glyph(pid, w=48, h=24):
    rnd = random.Random(pid)
    xs = [1 + i * 2 for i in range(24)]
    amps = []
    for i, x in enumerate(xs):
        t = i / 23
        if pid == 'stream':
            a = .42 + .2 * math.sin(i * 1.7) * math.sin(i * .63) + rnd.uniform(-.12, .12)
        elif pid == 'waves':
            ph = (t * 20) % 7.0
            env = (ph / 2) if ph < 2 else math.exp(-(ph - 2) / 1.8)
            a = .12 + .78 * env + rnd.uniform(-.05, .05)
        elif pid == 'rain':
            a = .2 + rnd.uniform(0, .12) + (rnd.uniform(.25, .5) if rnd.random() < .22 else 0)
        elif pid == 'wind':
            a = .32 + .22 * math.sin(t * 5.1 + .4) + .12 * math.sin(t * 11.3) + rnd.uniform(-.04, .04)
        elif pid == 'sleep':
            a = (.5 + rnd.uniform(-.12, .12)) * max(0, 1 - t * 1.04)
        else:
            a = .3
        amps.append(max(.06, min(a, 1)))
    if pid in ('drone', 'pentatonic'):
        if pid == 'drone':
            d = 'M1 7.5H30M9 12H44M19 16.5H47'
            return _svg(w, h, f'<path d="{d}" stroke="currentColor" stroke-width="1.25" fill="none"/>'
                        f'<g fill="currentColor"><circle cx="1" cy="7.5" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="19" cy="16.5" r="1.4"/></g>')
        # 五声: plucked notes on five pitch rows, each a dot that decays into a short line
        rows = [20, 16, 12, 8, 4]
        notes = [(2, 2, 7), (10, 3, 6), (17, 1, 9), (27, 4, 5), (33, 2, 8), (42, 0, 5)]
        d = ''.join(f'M{x} {rows[r]}H{x + L}' for x, r, L in notes)
        dots = ''.join(f'<circle cx="{x}" cy="{rows[r]}" r="1.4"/>' for x, r, L in notes)
        return _svg(w, h, f'<path d="{d}" stroke="currentColor" stroke-width="1" fill="none" opacity=".55"/>'
                    f'<g fill="currentColor">{dots}</g>')
    d = ' '.join(f'M{x} {n(12 - a * 10)}V{n(12 + a * 10)}' for x, a in zip(xs, amps))
    end = '<path d="M47.25 6V18" stroke="currentColor" stroke-width="1.25"/>' if pid == 'sleep' else ''
    return _svg(w, h, f'<path d="{d}" stroke="currentColor" stroke-width="1" fill="none"/>{end}')


def glyph(pid):
    if pid in PATTERNS:
        return breath_glyph(pid)
    if pid == 'pace-finder':
        return pace_finder_glyph()
    if pid in ('stream', 'waves', 'rain', 'wind', 'drone', 'pentatonic', 'sleep'):
        return sound_glyph(pid)
    return med_glyph(pid)


# ---------------------------------------------------------------- breath instrument
def breath_instrument(w=390, h=244, elapsed=248.0, past=12.0, future=20.0, pid='resonance'):
    p = PATTERNS[pid]
    top, bot = 36, 188
    span = past + future
    xnow = w * past / span

    def X(t):
        return (t - (elapsed - past)) / span * w

    def Y(lv):
        return bot - lv * (bot - top)

    step = 0.05
    pts_past = []
    t = elapsed - past
    while t <= elapsed + 1e-9:
        pts_past.append((X(t), Y(at(p, t)[0])))
        t += step
    pts_future = []
    t = elapsed
    while t <= elapsed + future + 1e-9:
        pts_future.append((X(t), Y(at(p, t)[0])))
        t += step
    area = polyline(pts_past) + f' L{n(xnow)} {bot} L0 {bot} Z'
    lv_now = at(p, elapsed)[0]
    out = [
        f'<path d="M0 {bot}H{w}" stroke="var(--rule)" stroke-width="1"/>',
        f'<path d="{area}" fill="var(--wash)"/>',
        f'<path d="{polyline(pts_past)}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>',
        f'<path d="{polyline(pts_future)}" fill="none" stroke="var(--ink-3)" stroke-width="1.5" stroke-dasharray="1.5 5" stroke-linecap="round"/>',
    ]
    # phase labels at the start of each segment: 吸 sits under a trough, 呼 over a peak
    cur_idx = at(p, elapsed)[1]
    for ts, lab, lv in seg_starts(p, elapsed - past + 0.6, elapsed + future - 0.4):
        x = X(ts)
        if x < 10 or x > w - 10:
            continue
        y = Y(lv) + (24 if lv < .5 else -14)
        is_cur = abs(ts - at(p, elapsed)[2]) < 1e-6
        col = 'var(--ink)' if is_cur else 'var(--ink-3)'
        out.append(f'<text x="{n(x)}" y="{n(y)}" text-anchor="middle" class="phase-lab" fill="{col}">{lab}</text>')
        out.append(f'<circle cx="{n(x)}" cy="{n(Y(lv))}" r="2" fill="{col}"/>')
    # now
    out.append(f'<path d="M{n(xnow)} {top - 22}V{bot + 14}" stroke="var(--ink-3)" stroke-width="1"/>')
    out.append(f'<circle cx="{n(xnow)}" cy="{n(Y(lv_now))}" r="6.5" fill="var(--zhu)" stroke="var(--paper)" stroke-width="3"/>')
    # seconds ruler under the curve, anchored to session time
    ry = bot + 30
    t0 = math.ceil(elapsed - past)
    ticks = []
    for s_ in range(int(t0), int(elapsed + future) + 1):
        x = X(s_)
        if 0 <= x <= w:
            L = 7 if s_ % 5 == 0 else 3
            ticks.append(f'M{n(x)} {ry}V{ry + L}')
    out.append(f'<path d="{" ".join(ticks)}" stroke="var(--ink-3)" stroke-width="1"/>')
    return (f'<svg class="instrument" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" '
            f'aria-label="呼吸曲线：第 23 轮，正在呼气">{"".join(out)}</svg>')


# ---------------------------------------------------------------- focus timeline
FOCUS_CATCHES = [52, 131, 211, 245, 408, 537, 692]


def focus_timeline(w=350, h=64, total=1200, elapsed=705, catches=FOCUS_CATCHES):
    y = 36
    X = lambda t: t / total * w
    xn = X(elapsed)
    out = [
        f'<path d="M0 {y}H{n(xn)}" stroke="var(--ink)" stroke-width="1.5"/>',
        f'<path d="M{n(xn + 6)} {y}H{w}" stroke="var(--ink-3)" stroke-width="1.5" stroke-dasharray="1.5 4.5" stroke-linecap="round"/>',
    ]
    for i, c in enumerate(catches):
        hgt = 22 if i == len(catches) - 1 else 16
        out.append(f'<path d="M{n(X(c))} {y}V{y - hgt}" stroke="var(--zhu)" stroke-width="2"/>')
    out.append(f'<circle cx="{n(xn)}" cy="{y}" r="4.5" fill="var(--ink)" stroke="var(--paper)" stroke-width="2.5"/>')
    for t, lab, anchor in [(0, '0', 'start'), (600, '10′', 'middle'), (1200, '20′', 'end')]:
        out.append(f'<path d="M{n(X(t)) if t else 0.5} {y + 6}V{y + 10}" stroke="var(--ink-3)" stroke-width="1"/>')
        out.append(f'<text x="{n(X(t))}" y="{y + 26}" text-anchor="{anchor}" class="axis">{lab}</text>')
    return (f'<svg class="timeline" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" '
            f'aria-label="时间线：已练 11 分 45 秒，回神 7 次">{"".join(out)}</svg>')


# ---------------------------------------------------------------- body-scan map
BODY_SCAN = [  # label, weight, body height (0 feet – 1 head); from src/content/scripts/body-scan.ts
    ('呼吸', 0.7, .46), ('左腿', 1.2, .08), ('右腿', 1.0, .08), ('腹背', 1.0, .40),
    ('胸肩', 1.0, .62), ('手臂', 1.0, .52), ('头颈', 1.0, .90), ('全身', 2.0, None),
]


def body_scan_times(total=900, opening=60):
    wsum = sum(b[1] for b in BODY_SCAN)
    unit = (total - opening) / wsum
    t = opening
    out = []
    for lab, wt, lv in BODY_SCAN:
        out.append((lab, t, t + wt * unit, lv))
        t += wt * unit
    return out


def body_scan_map(w=350, h=104, total=900, label_size='11'):
    top, bot = 10, 62
    X = lambda t: t / total * w
    Y = lambda lv: bot - lv * (bot - top)
    out = []
    # opening: a quiet dotted lead-in at mid height
    out.append(f'<path d="M0 {n(Y(.46))}H{n(X(60) - 4)}" stroke="var(--ink-3)" stroke-width="1.5" stroke-dasharray="1 3"/>')
    for lab, a, b, lv in body_scan_times(total):
        if lv is None:
            out.append(f'<rect x="{n(X(a))}" y="{top - 2}" width="{n(X(b) - X(a))}" height="{bot - top + 4}" fill="var(--wash)"/>')
            for l2 in (.08, .46, .90):
                out.append(f'<path d="M{n(X(a))} {n(Y(l2))}H{n(X(b))}" stroke="var(--ink)" stroke-width="2"/>')
            out.append(f'<text x="{n(X(a) + 6)}" y="{n(Y(.68) + 4)}" class="map-lab">{lab}</text>')
            continue
        out.append(f'<path d="M{n(X(a))} {n(Y(lv))}H{n(X(b) - 3)}" stroke="var(--ink)" stroke-width="2"/>')
        ly = Y(lv) + 15 if lv < .8 else Y(lv) + 15
        out.append(f'<text x="{n(X(a))}" y="{n(ly)}" class="map-lab">{lab}</text>')
    # time axis
    ay = bot + 18
    out.append(f'<path d="M0 {ay}H{w}" stroke="var(--rule)" stroke-width="1"/>')
    for m in (0, 5, 10, 15):
        x = X(m * 60)
        x = min(max(x, .5), w - .5)
        anchor = 'start' if m == 0 else ('end' if m == 15 else 'middle')
        out.append(f'<path d="M{n(x)} {ay}V{ay + 4}" stroke="var(--ink-3)" stroke-width="1"/>')
        lab = f'{m} 分钟' if m == 15 else str(m)
        out.append(f'<text x="{n(x)}" y="{ay + 18}" text-anchor="{anchor}" class="axis">{lab}</text>')
    return (f'<svg class="map" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" '
            f'aria-label="15 分钟里注意力依次经过：呼吸、左腿、右腿、腹背、胸肩、手臂、头颈、全身">{"".join(out)}</svg>')


# ---------------------------------------------------------------- one-minute figure (detail)
def minute_figure(w=342, h=132, rate=5.5, ratio='equal'):
    p = resonance(rate, ratio)
    T = period(p)
    top, bot = 22, 92
    X = lambda t: t / 60 * w
    Y = lambda lv: bot - lv * (bot - top)
    pts = [(X(60 * i / 600), Y(at(p, 60 * i / 600)[0])) for i in range(601)]
    out = [f'<path d="M0 {bot}H{w}" stroke="var(--rule)" stroke-width="1"/>',
           f'<path d="{polyline(pts)}" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-linejoin="round"/>']
    # annotate the first breath: 吸 / 呼 spans and the period bracket
    i_dur = p[0][1]
    out.append(f'<text x="{n(X(i_dur / 2))}" y="{bot - 8}" text-anchor="middle" class="axis strong">吸</text>')
    out.append(f'<text x="{n(X(i_dur + p[1][1] / 2))}" y="{bot - 8}" text-anchor="middle" class="axis strong">呼</text>')
    by = 10
    out.append(f'<path d="M{n(X(0))} {by + 4}V{by}H{n(X(T))}V{by + 4}" fill="none" stroke="var(--ink-3)" stroke-width="1"/>')
    out.append(f'<text x="{n(X(T) + 6)}" y="{by + 4}" class="axis">一轮 {T:.1f} 秒</text>')
    # axis: seconds
    ay = bot + 10
    for s_ in range(0, 61, 10):
        x = min(max(X(s_), .5), w - .5)
        out.append(f'<path d="M{n(x)} {bot}V{bot + 4}" stroke="var(--ink-3)" stroke-width="1"/>')
        anchor = 'start' if s_ == 0 else ('end' if s_ == 60 else 'middle')
        lab = '60 秒' if s_ == 60 else str(s_)
        out.append(f'<text x="{n(x)}" y="{ay + 14}" text-anchor="{anchor}" class="axis">{lab}</text>')
    return (f'<svg class="minute" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" '
            f'aria-label="一分钟的共振呼吸：5.5 轮，每轮吸 5.5 秒、呼 5.5 秒">{"".join(out)}</svg>')


# ---------------------------------------------------------------- 7-day strip and heatmap
def heat_level(m):
    if m <= 0:
        return 0
    if m < 10:
        return 1
    if m < 20:
        return 2
    return 3


def week_strip(cell=14, gap=6, labels=True):
    dm = D.daily_minutes()
    days = [D.TODAY - timedelta(days=6 - i) for i in range(7)]
    w = 7 * cell + 6 * gap
    h = cell + (20 if labels else 0)
    out = []
    for i, d in enumerate(days):
        x = i * (cell + gap)
        lv = heat_level(dm[d])
        if d == D.TODAY:
            out.append(f'<rect x="{x + 1}" y="1" width="{cell - 2}" height="{cell - 2}" fill="none" stroke="var(--zhu)" stroke-width="2"/>')
        elif lv == 0:
            out.append(f'<rect x="{x + .5}" y=".5" width="{cell - 1}" height="{cell - 1}" fill="none" stroke="var(--line)" stroke-width="1"/>')
        else:
            out.append(f'<rect x="{x}" y="0" width="{cell}" height="{cell}" fill="var(--heat-{lv})"/>')
        if labels:
            col = 'var(--ink)' if d == D.TODAY else 'var(--ink-3)'
            out.append(f'<text x="{x + cell / 2}" y="{cell + 16}" text-anchor="middle" class="axis" fill="{col}">{D.WEEKDAYS[d.weekday()]}</text>')
    title = '近 7 天：' + '，'.join(f'{d.month}月{d.day}日 {dm[d]} 分钟' for d in days)
    return (f'<svg class="strip" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{title}">'
            f'{"".join(out)}</svg>')


def heatmap(cell=26, gap=4, left=44, right=44, top=22):
    dm = D.daily_minutes()
    weeks = []
    d = D.WINDOW_START
    while d <= D.TODAY:
        weeks.append(d)
        d += timedelta(days=7)
    pitch = cell + gap
    w = left + 7 * pitch - gap + right
    h = top + len(weeks) * pitch - gap
    out = []
    for j, wd in enumerate(D.WEEKDAYS):
        out.append(f'<text x="{left + j * pitch + cell / 2}" y="{top - 9}" text-anchor="middle" class="axis">{wd}</text>')
    for i, ws in enumerate(weeks):
        y = top + i * pitch
        lab = f'{ws.month}/{ws.day}'
        out.append(f'<text x="{left - 10}" y="{y + cell / 2 + 4}" text-anchor="end" class="axis tnum">{lab}</text>')
        tot = 0
        for j in range(7):
            day = ws + timedelta(days=j)
            x = left + j * pitch
            if day > D.TODAY:
                continue
            m = dm[day]
            tot += m
            lv = heat_level(m)
            if day == D.TODAY:
                out.append(f'<rect x="{x + 1}" y="{y + 1}" width="{cell - 2}" height="{cell - 2}" fill="none" stroke="var(--zhu)" stroke-width="2"><title>今天，还没练</title></rect>')
            elif lv == 0:
                out.append(f'<rect x="{x + .5}" y="{y + .5}" width="{cell - 1}" height="{cell - 1}" fill="none" stroke="var(--rule)" stroke-width="1"/>')
            else:
                out.append(f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" fill="var(--heat-{lv})"><title>{day.month}月{day.day}日 {m} 分钟</title></rect>')
        out.append(f'<text x="{left + 7 * pitch - gap + right}" y="{y + cell / 2 + 4}" text-anchor="end" class="axis tnum strong">{tot}</text>')
    return (f'<svg class="heatmap" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" '
            f'aria-label="近 8 周每天的练习分钟数，31 天有练习">{"".join(out)}</svg>')


# ---------------------------------------------------------------- small multiples
def _axis_y(w, y0, y1, ticks, Y, fmt=str, x0=0):
    out = []
    for v in ticks:
        y = Y(v)
        out.append(f'<path d="M{x0} {n(y)}H{w}" stroke="var(--rule)" stroke-width="1"/>')
        out.append(f'<text x="{x0 - 8}" y="{n(y + 4)}" text-anchor="end" class="axis tnum">{fmt(v)}</text>')
    return out


def chart_focus(w=300, h=150):
    rows = D.weekly_focus_rate()
    left, right, top, bot = 28, 34, 10, h - 26
    Y = lambda v: bot - v / 10 * (bot - top)
    X = lambda i: left + i / (len(rows) - 1) * (w - left - right)
    out = _axis_y(w - right + 14, 0, 10, [0, 5, 10], Y, x0=left)
    for i, (ws, mean, vals) in enumerate(rows):
        for k, v in enumerate(vals):
            dx = (k - (len(vals) - 1) / 2) * 5
            out.append(f'<circle cx="{n(X(i) + dx)}" cy="{n(Y(v))}" r="2.5" fill="var(--ink-3)" opacity=".55"/>')
    pts = [(X(i), Y(m)) for i, (ws, m, v) in enumerate(rows)]
    out.append(f'<path d="{polyline(pts)}" fill="none" stroke="var(--ink)" stroke-width="1.5"/>')
    for i, (x, y) in enumerate(pts):
        r = 4 if i in (0, len(pts) - 1) else 3
        out.append(f'<circle cx="{n(x)}" cy="{n(y)}" r="{r}" fill="var(--ink)" stroke="var(--paper)" stroke-width="2"/>')
    out.append(f'<text x="{n(pts[0][0])}" y="{n(pts[0][1] - 12)}" text-anchor="middle" class="val">{rows[0][1]:.1f}</text>')
    out.append(f'<text x="{n(pts[-1][0] + 10)}" y="{n(pts[-1][1] + 4)}" class="val">{rows[-1][1]:.1f}</text>')
    for i, (ws, m, v) in enumerate(rows):
        out.append(f'<text x="{n(X(i))}" y="{h - 6}" text-anchor="middle" class="axis tnum">{ws.month}/{ws.day}</text>')
    return f'<svg class="chart" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="每 10 分钟回神次数，按周：从 7.2 到 4.1">{"".join(out)}</svg>'


def chart_accuracy(w=300, h=150):
    rows = D.count_accuracy()
    left, right, top, bot = 34, 40, 10, h - 26
    d0 = D.WINDOW_START + timedelta(days=7)
    d1 = D.TODAY - timedelta(days=4)
    span = (d1 - d0).days
    X = lambda d: left + (d - d0).days / span * (w - left - right)
    Y = lambda v: bot - (v - 60) / 40 * (bot - top)
    out = _axis_y(w - right + 14, 60, 100, [60, 80, 100], Y, fmt=lambda v: f'{v}', x0=left)
    pts = [(X(d), Y(v)) for d, v in rows]
    out.append(f'<path d="{polyline(pts)}" fill="none" stroke="var(--ink)" stroke-width="1.5"/>')
    for i, (x, y) in enumerate(pts):
        out.append(f'<circle cx="{n(x)}" cy="{n(y)}" r="{4 if i in (0, len(pts) - 1) else 3}" fill="var(--ink)" stroke="var(--paper)" stroke-width="2"/>')
    out.append(f'<text x="{n(pts[0][0])}" y="{n(pts[0][1] + 20)}" text-anchor="middle" class="val">{rows[0][1]}%</text>')
    out.append(f'<text x="{n(pts[-1][0] + 10)}" y="{n(pts[-1][1] + 4)}" class="val">{rows[-1][1]}%</text>')
    for d in [D.WINDOW_START + timedelta(days=7 * k) for k in (1, 3, 5, 7)]:
        out.append(f'<text x="{n(X(d))}" y="{h - 6}" text-anchor="middle" class="axis tnum">{d.month}/{d.day}</text>')
    return f'<svg class="chart" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="数息准确率：从 78% 到 86%">{"".join(out)}</svg>'


def chart_tension(w=300, h=150):
    pairs = D.tension_pairs()
    left, top, bot = 28, 10, h - 26
    xa, xb = left + 46, w - 76
    Y = lambda v: bot - v / 10 * (bot - top)
    out = _axis_y(w - 40, 0, 10, [0, 5, 10], Y, x0=left)
    for d, a, b in pairs:
        out.append(f'<path d="M{xa} {n(Y(a))}L{xb} {n(Y(b))}" stroke="var(--ink-3)" stroke-width="1" opacity=".28"/>')
    ma = sum(a for _, a, _ in pairs) / len(pairs)
    mb = sum(b for _, _, b in pairs) / len(pairs)
    out.append(f'<path d="M{xa} {n(Y(ma))}L{xb} {n(Y(mb))}" stroke="var(--ink)" stroke-width="2"/>')
    out.append(f'<circle cx="{xa}" cy="{n(Y(ma))}" r="4" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5"/>')
    out.append(f'<circle cx="{xb}" cy="{n(Y(mb))}" r="4" fill="var(--ink)" stroke="var(--paper)" stroke-width="2"/>')
    out.append(f'<text x="{xa - 10}" y="{n(Y(ma) + 4)}" text-anchor="end" class="val">{ma:.1f}</text>')
    out.append(f'<text x="{xb + 10}" y="{n(Y(mb) + 4)}" class="val">{mb:.1f}</text>')
    out.append(f'<text x="{xa}" y="{h - 6}" text-anchor="middle" class="axis">练习前</text>')
    out.append(f'<text x="{xb}" y="{h - 6}" text-anchor="middle" class="axis">练习后</text>')
    return f'<svg class="chart" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="练习前后紧张度自评，18 次：平均从 {ma:.1f} 到 {mb:.1f}">{"".join(out)}</svg>'


def body_scan_strip(w=350, total=900, opening=60, axis=True):
    """The session as a row of chapters: width = minutes, in the order of the script."""
    X = lambda t: t / total * w
    ly, by = 12, 24          # label baseline, bar centre
    out = [f'<path d="M0 {by}H{n(X(opening) - 3)}" stroke="var(--line)" stroke-width="1"/>']
    for lab, a, b, lv in body_scan_times(total, opening):
        out.append(f'<path d="M{n(X(a))} {by}H{n(X(b) - 3)}" stroke="var(--ink)" stroke-width="2"/>')
        out.append(f'<text x="{n(X(a))}" y="{ly}" class="map-lab">{lab}</text>')
    if axis:
        ay = by + 10
        for m in (0, 5, 10, 15):
            x = min(max(X(m * 60), .5), w - .5)
            out.append(f'<path d="M{n(x)} {ay}V{ay + 4}" stroke="var(--ink-3)" stroke-width="1"/>')
            anchor = 'start' if m == 0 else ('end' if m == 15 else 'middle')
            out.append(f'<text x="{n(x)}" y="{ay + 17}" text-anchor="{anchor}" class="axis">{m if m < 15 else "15 分钟"}</text>')
    h = by + (31 if axis else 6)
    return (f'<svg class="strip-map" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" '
            f'aria-label="15 分钟里依次是：准备、呼吸、左腿、右腿、腹背、胸肩、手臂、头颈、全身">{"".join(out)}</svg>')
