"""One dataset for every screen, so the numbers agree with each other.

Today is 2026-10-22 (星期四). The 8-week window starts Monday 2026-08-31,
so it holds 53 days (7 full weeks + Mon–Thu of this week).
Checks at the bottom are run by build.py; the build fails if a total drifts.
"""
from datetime import date, timedelta

TODAY = date(2026, 10, 22)
WINDOW_START = date(2026, 8, 31)
WEEKDAYS = '一二三四五六日'

# practice ids → names, as the app names them
NAMES = {
    'focus': '专注呼吸', 'count': '数息', 'body-scan': '身体扫描', 'loving-kindness': '慈心',
    'breathing-space': '三分钟呼吸空间', 'open-awareness': '开放觉察', 'timer': '静坐计时',
    'sigh': '周期性叹息', 'resonance': '共振呼吸', 'long-exhale': '呼气延长', 'box': '箱式呼吸',
    'pace-finder': '共振频率测定',
}

# (date, time, practice, minutes, extra)
#   extra: catches (回神 count) for focus, accuracy (%) for count,
#          rounds for paced breathing, tension (before, after) when rated, note.
S = []
def s(m, d, hm, pid, minutes, **extra):
    S.append(dict(date=date(2026, m, d), time=hm, pid=pid, minutes=minutes, **extra))

# week of 8/31 — first week with the app
s(8, 31, '22:05', 'focus', 5, catches=4)
s(9, 2, '21:50', 'resonance', 5, rounds=27)
s(9, 5, '10:20', 'body-scan', 15)
# 9/7
s(9, 7, '22:10', 'focus', 10, catches=8)
s(9, 9, '07:50', 'breathing-space', 3)
s(9, 9, '22:00', 'focus', 10, catches=7)
s(9, 11, '12:40', 'sigh', 5, rounds=28)
s(9, 13, '21:30', 'focus', 15, catches=10)
# 9/14
s(9, 14, '22:15', 'focus', 10, catches=7)
s(9, 16, '21:45', 'count', 10, accuracy=78)
s(9, 18, '12:30', 'resonance', 10, rounds=55)
s(9, 20, '09:10', 'focus', 20, catches=13)
# 9/21 — pre/post tension ratings switched on
s(9, 21, '22:00', 'focus', 10, catches=6, tension=(6, 4))
s(9, 22, '07:45', 'breathing-space', 3, tension=(7, 5))
s(9, 24, '21:40', 'count', 10, accuracy=80, tension=(5, 3))
s(9, 26, '10:00', 'body-scan', 15, tension=(8, 5))
# 9/28 — 国庆, travelling
s(9, 28, '22:20', 'focus', 10, catches=5, tension=(4, 3))
s(9, 29, '12:50', 'sigh', 5, rounds=28, tension=(6, 3))
s(10, 3, '23:10', 'sigh', 5, rounds=28)
s(10, 3, '23:16', 'breathing-space', 3, tension=(5, 4))
# 10/5
s(10, 5, '08:30', 'focus', 20, catches=10, tension=(7, 5))
s(10, 6, '21:30', 'loving-kindness', 12, tension=(6, 4))
s(10, 8, '07:40', 'breathing-space', 3)
s(10, 8, '22:05', 'focus', 10, catches=6, tension=(5, 2))
s(10, 9, '12:35', 'resonance', 15, rounds=82, tension=(4, 3))
s(10, 11, '09:20', 'focus', 20, catches=9, tension=(7, 4))
s(10, 11, '16:05', 'count', 10, accuracy=83)
# 10/12
s(10, 12, '22:10', 'focus', 15, catches=5, tension=(6, 5))
s(10, 13, '21:50', 'count', 15, accuracy=86, tension=(5, 3))
s(10, 15, '12:40', 'resonance', 10, rounds=55)
s(10, 15, '22:00', 'focus', 10, catches=5, tension=(6, 3))
s(10, 16, '22:30', 'focus', 10, catches=4)
s(10, 18, '10:15', 'focus', 10, catches=4)
s(10, 18, '16:20', 'resonance', 5, rounds=27)
s(10, 18, '21:40', 'breathing-space', 3)
# 10/19 — this week
s(10, 19, '07:55', 'breathing-space', 3)
s(10, 19, '22:10', 'focus', 10, catches=4, tension=(8, 6))
s(10, 20, '12:35', 'sigh', 5, rounds=28, tension=(7, 4))
s(10, 20, '18:40', 'breathing-space', 3)
s(10, 21, '21:40', 'body-scan', 15, tension=(5, 3), note='躺着练的，到头和脸的时候已经有点困。')

SESSIONS = S


def daily_minutes():
    out = {}
    d = WINDOW_START
    while d <= TODAY:
        out[d] = 0
        d += timedelta(days=1)
    for x in SESSIONS:
        out[x['date']] += x['minutes']
    return out


def week_start(d):
    return d - timedelta(days=d.weekday())


def weekly_focus_rate():
    """Mean of per-session 回神-per-10-min, by week; the running week is left out."""
    weeks = {}
    for x in SESSIONS:
        if x['pid'] == 'focus' and 'catches' in x:
            w = week_start(x['date'])
            weeks.setdefault(w, []).append(x['catches'] / x['minutes'] * 10)
    cur = week_start(TODAY)
    rows = [(w, sum(v) / len(v), v) for w, v in sorted(weeks.items()) if w != cur]
    return rows[-6:]


def count_accuracy():
    return [(x['date'], x['accuracy']) for x in SESSIONS if x['pid'] == 'count']


def tension_pairs():
    return [(x['date'], *x['tension']) for x in SESSIONS if 'tension' in x]


def by_practice(since=None):
    out = {}
    for x in SESSIONS:
        if since and x['date'] < since:
            continue
        n, m = out.get(x['pid'], (0, 0))
        out[x['pid']] = (n + 1, m + x['minutes'])
    return sorted(out.items(), key=lambda kv: -kv[1][1])


def checks():
    dm = daily_minutes()
    days = [d for d, m in dm.items() if m > 0]
    last7 = [TODAY - timedelta(days=i) for i in range(7)]
    oct_total = sum(m for d, m in dm.items() if d.month == 10)
    l7 = sum(dm[d] for d in last7)
    l7days = sum(1 for d in last7 if dm[d] > 0)
    rates = weekly_focus_rate()
    acc = count_accuracy()
    t = tension_pairs()
    mean_diff = sum(a - b for _, b, a in [(d, b, a) for d, b, a in t]) / len(t)
    result = dict(
        window_days=len(dm), practiced_days=len(days), oct_total=oct_total,
        last7_total=l7, last7_days=l7days,
        focus_first=round(rates[0][1], 1), focus_last=round(rates[-1][1], 1),
        acc_first=acc[0][1], acc_last=acc[-1][1],
        tension_n=len(t), tension_before=sum(b for _, b, _ in t) / len(t),
        tension_after=sum(a for _, _, a in t) / len(t), tension_diff=mean_diff,
        total_minutes=sum(dm.values()), sessions=len(SESSIONS),
    )
    assert result['window_days'] == 53, result
    assert result['practiced_days'] == 31, result
    assert result['oct_total'] == 212, result
    assert result['last7_total'] == 64 and result['last7_days'] == 5, result
    assert result['focus_first'] == 7.2 and result['focus_last'] == 4.1, rates
    assert result['acc_first'] == 78 and result['acc_last'] == 86, acc
    assert round(result['tension_diff'], 1) == -2.1, result
    return result


if __name__ == '__main__':
    import pprint
    pprint.pprint(checks())
    pprint.pprint(by_practice())
    pprint.pprint(weekly_focus_rate())
