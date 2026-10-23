"""Shared chrome: iOS status bar, tab bar, home indicator, desktop rail."""
from .draw import icon, lockup, mark


def statusbar(time='21:12'):
    # iPhone 390 × 844 status bar, drawn in currentColor so it follows the theme
    return f'''<svg class="statusbar" width="390" height="47" viewBox="0 0 390 47" aria-hidden="true">
  <text x="54" y="32" text-anchor="middle" class="sb-time">{time}</text>
  <g fill="currentColor">
    <rect x="296" y="25" width="3" height="4.5" rx="1"/><rect x="300.5" y="22.5" width="3" height="7" rx="1"/>
    <rect x="305" y="20" width="3" height="9.5" rx="1"/><rect x="309.5" y="17.5" width="3" height="12" rx="1"/>
  </g>
  <g fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
    <path d="M318.6 21.2a10.4 10.4 0 0 1 14.8 0"/><path d="M321.4 24.1a6.2 6.2 0 0 1 9.2 0"/>
  </g>
  <circle cx="326" cy="27.6" r="1.9" fill="currentColor"/>
  <rect x="340.5" y="17.5" width="24.5" height="12" rx="3.8" fill="none" stroke="currentColor" stroke-opacity=".38" stroke-width="1"/>
  <rect x="342.5" y="19.5" width="17" height="8" rx="2.2" fill="currentColor"/>
  <path d="M366.6 21.6v4.2a2.2 2.2 0 0 0 0-4.2z" fill="currentColor" fill-opacity=".45"/>
</svg>'''


TABS = [('today', '今日'), ('practice', '练习'), ('records', '记录'), ('evidence', '依据')]


def tabbar(active='today'):
    items = []
    for key, label in TABS:
        on = key == active
        cur = ' aria-current="page"' if on else ''
        items.append(f'<a class="tab" href="#"{cur}>{icon(key + ("-on" if on else ""))}<span>{label}</span></a>')
    return f'<nav class="tabbar" aria-label="主导航">{"".join(items)}</nav>'


def homebar():
    return '<div class="homebar" aria-hidden="true"></div>'


def rail(active='today'):
    items = []
    for i, (key, label) in enumerate(TABS, 1):
        on = key == active
        cur = ' aria-current="page"' if on else ''
        items.append(f'<li><a class="rail-item" href="#"{cur}>{icon(key + ("-on" if on else ""))}'
                     f'<span>{label}</span><kbd>{i}</kbd></a></li>')
    return f'''<nav class="rail" aria-label="主导航">
  <a class="rail-brand" href="#" aria-label="回神 · 今日">{lockup(22)}</a>
  <ul class="rail-list">{"".join(items)}</ul>
  <div class="rail-foot">
    <a class="rail-item" href="#">{icon("settings")}<span>设置</span></a>
    <p class="rail-note">离线可用。练习记录只存在这台设备上。</p>
  </div>
</nav>'''
