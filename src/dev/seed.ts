/**
 * 开发用的地址参数，只在开发构建里加载（main.tsx 在 import.meta.env.DEV 之下动态导入本文件，
 * 生产构建里既没有这个文件，也没有解析这些参数的代码）：
 * - ?seed=demo：清空本机数据，写入 8 周的演示数据，然后从地址里去掉这个参数（刷新不会再清一次）；
 * - ?speed=N：练习按 N 倍速走、不出声，供端到端测试和截图使用。
 *
 * 演示数据经由真实的数据接口写入：每次练习都用 buildPlan 排计划、拼成引擎的 SessionResult、
 * 再由 resultToRecord 转成记录，偏好和计划进度走偏好仓库的动作。最近三周照抄设计稿共用的那组数据
 * （docs/design/final/src/data.mjs），只是把「2026-10-22」换成今天：今天是八周正念第 3 周第 2 天，
 * 本周练了周一、周三、周四；今天早上的专注呼吸选了「更紧张」，加上昨天慢呼吸后的「很不舒服」，
 * 最近 3 次里有 2 次，小结会建议更温和的练法。更早的五周按固定种子随机生成。
 */
import { buildPlan } from '@/app/plan'
import { getRepo, setTimeScale } from '@/app/services'
import type { CatalogPracticeId } from '@/content/practices'
import { type Feeling, prefsStore, resultToRecord, type SessionRecord } from '@/data'
import type { SessionResult } from '@/engine'
import { addDays, dayKey } from '@/lib/date'
import { mulberry32 } from '@/lib/random'

interface SeedSession {
  /** 距今天几天 */
  ago: number
  /** 本地时刻 HH:MM */
  at: string
  id: CatalogPracticeId
  minutes: number
  feeling?: Feeling
  pre?: number
  post?: number
  note?: string
  /** 计划里的一天，如 'w1d1' */
  day?: string
  /** 回神次数，或每次回神的秒数 */
  marks?: number | number[]
  count?: { correct: number; errors: number; resets: number; invalid: number }
  paced?: { rate: number; rounds: number; steps?: number }
  /** 提前结束：实际练了几秒 */
  stoppedAt?: number
  skipped?: string[]
}

const S = (
  ago: number,
  at: string,
  id: CatalogPracticeId,
  minutes: number,
  extra: Partial<SeedSession> = {},
) => ({
  ago,
  at,
  id,
  minutes,
  ...extra,
})

/** 最近三周：与 docs/design/final/src/data.mjs 的 SESSIONS 一致（ago = 2026-10-22 减去那天） */
const RECENT: readonly SeedSession[] = [
  S(21, '12:35', 'slow', 5, { paced: { rate: 5.5, rounds: 29 }, feeling: 'calmer' }),
  S(20, '18:10', 'breathing-space', 3, { feeling: 'same' }),
  S(18, '21:40', 'body-scan', 10, { feeling: 'calmer' }),
  S(17, '07:45', 'focus', 10, { day: 'w1d1', marks: 9, feeling: 'same' }),
  S(16, '07:50', 'focus', 10, { day: 'w1d2', marks: 8, feeling: 'calmer' }),
  S(15, '12:50', 'cyclic-sigh', 5, { paced: { rate: 5.7, rounds: 27 }, feeling: 'calmer' }),
  S(15, '22:05', 'focus', 10, { day: 'w1d3', marks: 6, feeling: 'calmer' }),
  S(13, '23:10', 'focus', 5, {
    day: 'w1d4',
    marks: 3,
    feeling: 'same',
    pre: 6,
    post: 5,
    note: '很困，只做了 5 分钟。',
  }),
  S(12, '09:30', 'focus', 10, { day: 'w1d5', marks: 7, feeling: 'calmer', pre: 7, post: 5 }),
  S(12, '16:20', 'breath-count', 10, {
    count: { correct: 8, errors: 1, resets: 2, invalid: 0 },
    feeling: 'same',
    pre: 5,
    post: 5,
  }),
  S(11, '21:15', 'focus', 10, { day: 'w1d6', marks: 6, feeling: 'calmer', pre: 6, post: 4 }),
  S(10, '07:40', 'focus', 10, { day: 'w1d7', marks: 7, feeling: 'calmer', pre: 7, post: 5 }),
  S(10, '14:20', 'pause', 1, { feeling: 'same' }),
  S(9, '07:55', 'focus', 10, { day: 'w2d1', marks: 5, feeling: 'calmer', pre: 6, post: 4 }),
  S(8, '18:30', 'breathing-space', 3, { feeling: 'calmer', pre: 7, post: 6 }),
  S(8, '22:20', 'focus', 10, {
    day: 'w2d2',
    marks: 8,
    feeling: 'tenser',
    pre: 5,
    post: 6,
    note: '一直在想明天的汇报。',
  }),
  S(7, '07:50', 'focus', 10, { day: 'w2d3', marks: 6, feeling: 'calmer', pre: 6, post: 4 }),
  S(7, '20:40', 'breath-count', 15, {
    count: { correct: 13, errors: 1, resets: 2, invalid: 0 },
    feeling: 'calmer',
    pre: 5,
    post: 3,
  }),
  S(6, '07:45', 'focus', 10, { day: 'w2d4', marks: 6, feeling: 'same', pre: 6, post: 5 }),
  S(6, '12:40', 'slow', 5, { paced: { rate: 5.5, rounds: 29 }, feeling: 'calmer', pre: 7, post: 4 }),
  S(5, '09:10', 'focus', 10, { day: 'w2d5', marks: 4, feeling: 'calmer', pre: 4, post: 3 }),
  S(4, '16:00', 'breath-count', 10, {
    count: { correct: 10, errors: 1, resets: 1, invalid: 1 },
    feeling: 'same',
    pre: 5,
    post: 4,
  }),
  S(4, '21:30', 'focus', 10, { day: 'w2d6', marks: 5, feeling: 'same', pre: 6, post: 5 }),
  S(3, '07:52', 'focus', 15, {
    day: 'w2d7',
    marks: 11,
    feeling: 'calmer',
    pre: 6,
    post: 4,
    note: '第一次练 15 分钟，后半段有点困。',
  }),
  S(3, '14:10', 'pause', 1, { feeling: 'same' }),
  S(1, '12:40', 'slow', 5, {
    paced: { rate: 5.5, rounds: 29 },
    feeling: 'unwell',
    pre: 6,
    note: '节拍太慢，憋得慌，有点头晕。',
  }),
  S(1, '21:35', 'body-scan', 10, {
    day: 'w3d1',
    feeling: 'same',
    pre: 5,
    post: 4,
    note: '躺着练，到手臂那段睡着了。',
  }),
  S(0, '08:05', 'focus', 10, {
    marks: [96, 151, 188, 262, 319, 401, 478],
    feeling: 'tenser',
    pre: 6,
    post: 6,
  }),
  S(0, '12:40', 'cyclic-sigh', 5, { paced: { rate: 5.7, rounds: 28 }, feeling: 'calmer', pre: 6, post: 4 }),
]

/** 更早的五周（第 22–55 天前）：每周三到五次，种类、时刻和感觉按固定种子随机，有提前结束的、点过「有点急」的 */
function earlier(rand: () => number): SeedSession[] {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T
  const kinds: readonly (() => SeedSession)[] = [
    () => S(0, '', 'slow', pick([5, 5, 10]), { paced: { rate: 5.5, rounds: 0 } }),
    () => S(0, '', 'cyclic-sigh', pick([3, 5]), { paced: { rate: 5.7, rounds: 0 } }),
    () => S(0, '', 'focus', pick([5, 10]), { marks: 3 + Math.floor(rand() * 8) }),
    () => S(0, '', 'breathing-space', 3),
    () => S(0, '', 'pause', 1),
    () => S(0, '', 'body-scan', 10),
    () => S(0, '', 'listen', 20),
    () => S(0, '', 'sleep', 30),
    () => S(0, '', 'timer', pick([5, 10])),
    () => S(0, '', 'loving-kindness', 10),
    () => S(0, '', 'box', 5),
    () => {
      const errors = Math.floor(rand() * 3)
      const resets = Math.floor(rand() * 4)
      const invalid = rand() < 0.3 ? 1 : 0
      return S(0, '', 'breath-count', 10, {
        count: { correct: 9 - errors - invalid, errors, resets, invalid },
      })
    },
  ]
  const feelings: readonly Feeling[] = ['calmer', 'calmer', 'calmer', 'same', 'same', 'tenser']
  const times = ['07:30', '07:55', '08:20', '12:30', '12:45', '17:40', '21:10', '22:30', '23:05']
  const out: SeedSession[] = []
  for (let ago = 55; ago >= 22; ago--) {
    if (rand() > 0.55) continue
    const s = pick(kinds)()
    s.ago = ago
    s.at = s.id === 'sleep' ? '23:05' : pick(times)
    if (s.id !== 'sleep') s.feeling = pick(feelings)
    if (s.id === 'slow' && rand() < 0.3) s.paced = { rate: 6, rounds: 0, steps: 1 }
    if (rand() < 0.08 && s.minutes >= 5) s.stoppedAt = Math.round(s.minutes * 60 * (0.4 + rand() * 0.4))
    if (s.id === 'body-scan' && rand() < 0.4) s.skipped = ['right-leg']
    out.push(s)
  }
  return out
}

/** 某天某个时刻 */
function startOf(now: Date, s: SeedSession): Date {
  const [h = 0, m = 0] = s.at.split(':').map(Number)
  const d = addDays(now, -s.ago)
  d.setHours(h, m, 0, 0)
  return d
}

/** n 次回神，均匀散在练习里，各有一点抖动 */
function spread(n: number, sec: number, rand: () => number): number[] {
  const gap = sec / (n + 1)
  return Array.from(
    { length: n },
    (_, i) => Math.round((gap * (i + 1) + (rand() - 0.5) * gap * 0.6) * 10) / 10,
  )
}

function toRecord(s: SeedSession, now: Date, rand: () => number): SessionRecord {
  const prefs = prefsStore.getState()
  const overrides = s.paced && s.id === 'slow' ? { params: { rate: s.paced.rate } } : {}
  const plan = buildPlan(s.id, s.minutes, prefs, null, overrides)
  const practicedSec = s.stoppedAt ?? plan.plannedSec
  const pattern = plan.pattern
  const rounds = s.paced?.rounds || (pattern ? Math.floor(practicedSec / pattern.T) : 0)
  const result: SessionResult = {
    plan,
    startedAt: startOf(now, s).toISOString(),
    practicedSec,
    completed: s.stoppedAt === undefined,
    marks: typeof s.marks === 'number' ? spread(s.marks, practicedSec, rand) : (s.marks ?? []),
    count: s.count
      ? { current: 0, cycles: s.count.correct + s.count.errors + s.count.invalid, ...s.count }
      : null,
    breaths: pattern ? rounds : null,
    finalRate: pattern ? (s.paced?.steps ? s.paced.rate + 0.5 * s.paced.steps : pattern.rate) : null,
    rateSteps: s.paced?.steps ?? 0,
    skipped: s.skipped ?? [],
  }
  const checkin = s.pre === undefined && s.post === undefined ? undefined : { pre: s.pre, post: s.post }
  return resultToRecord(result, {
    ...(checkin ? { checkin } : {}),
    ...(s.feeling ? { feeling: s.feeling } : {}),
    ...(s.note ? { note: s.note } : {}),
  })
}

/** 清空本机数据，写入演示数据。now 为「今天」，默认此刻；晚于此刻的练习不写 */
export async function seedDemo(now: Date = new Date()): Promise<number> {
  const repo = getRepo()
  await repo.clear()
  const prefs = prefsStore.getState()
  prefs.reset()
  prefs.set({
    onboarded: true,
    safety: { ackOn: dayKey(addDays(now, -56)) },
    checkin: { prePost: true },
    weeklyStress: true,
  })
  prefs.setPractice('slow', { rate: 5.5 })
  for (const [ago, score] of [
    [21, 4],
    [14, 3],
    [7, 3],
    [0, 2],
  ] as const) {
    prefs.addStressRating(score, dayKey(addDays(now, -ago)))
  }

  const rand = mulberry32(20261022)
  const sessions = [...earlier(rand), ...RECENT].filter(s => startOf(now, s) <= now)
  const records = sessions.map(s => toRecord(s, now, rand))

  // 八周正念从 17 天前开始，做完了前两周和第 3 周第 1 天：今天是第 3 周第 2 天
  prefs.startProgram('mindfulness-8w', dayKey(addDays(now, -17)))
  for (const s of RECENT) {
    if (s.day && startOf(now, s) <= now)
      prefs.completeProgramDay('mindfulness-8w', s.day, dayKey(addDays(now, -s.ago)))
  }
  const { added } = await repo.importMany(records)
  return added
}

/** 处理开发用的地址参数（见文件头）。在第一次渲染之前调用 */
export async function applyDevParams(location: Location = window.location): Promise<void> {
  const params = new URLSearchParams(location.search)
  const speed = Number(params.get('speed'))
  if (speed > 0 && speed !== 1) setTimeScale(speed)
  if (params.get('seed') === 'demo') {
    await seedDemo()
    params.delete('seed')
    const query = params.toString()
    history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`)
  }
}
