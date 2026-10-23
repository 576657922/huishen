import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as catalogue from '@/content/practices'
import { LIGHT_SLOW_PACE, PRACTICE_BY_ID, PRACTICES, scriptIdFor } from '@/content/practices'
import { getScript } from '@/content/scripts'
import { DEFAULT_PREFS, type Prefs, type Screening } from '@/data'
import {
  buildTimeline,
  DEFAULT_FADE_IN_SEC,
  SIGH_CYCLE_MAX,
  SLOW_RATE_MAX,
  SLOW_RATE_MIN,
  WARMUP_START_RATE,
} from '@/engine'
import { PACE_FINDER_ASSESSMENT } from '@/hrv'
import { createTestSession } from '@/test/fakes'
import {
  afterQuestions,
  BEDTIME_FADE_IN_SEC,
  BOX_PHASE_SEC,
  buildPlan,
  DEFAULT_PERSONAL_RATE,
  defaultMinutes,
  fitMinutes,
  isBedtime,
  isOffered,
  PACE_FINDER_RATES,
  PACE_STEP_SEC,
  SHORT_END_BUFFER_SEC,
  SLOW_RATE,
  V1_UNAVAILABLE,
} from './plan'

/** 出厂偏好的可改副本 */
function prefs(patch: Partial<Prefs> = {}): Prefs {
  return { ...structuredClone(DEFAULT_PREFS), ...patch }
}

const NO_CONDITIONS: Screening = {
  pregnancy: false,
  heart: false,
  respiratory: false,
  psychosis: false,
  bipolar: false,
  epilepsy: false,
  trauma: false,
  panic: false,
}
const screen = (patch: Partial<Screening>): Screening => ({ ...NO_CONDITIONS, ...patch })

/** 出厂设置下引擎拿到的时间线选项：标准档、steady、每秒 3.6 字 */
const STANDARD = { level: 'standard', prosody: 'steady', charsPerSecond: 3.6 } as const

describe('每项练习 × 每个可选时长', () => {
  for (const p of PRACTICES) {
    for (const minutes of p.durations) {
      it(`${p.id} · ${minutes} 分钟`, () => {
        const plan = buildPlan(p.id, minutes, prefs(), null)
        const assessment = p.kind === 'assessment'
        expect(plan.practiceId).toBe(p.id)
        expect(plan.kind).toBe(p.kind)
        expect(plan.title).toBe(p.name)
        expect(plan.plannedSec).toBe(assessment ? PACE_STEP_SEC : minutes * 60)
        expect(plan.leadSec).toBe(DEFAULT_PREFS.leadIn)

        const scripted = !assessment && scriptIdFor(p.id, minutes) !== undefined
        expect(plan.timeline !== null).toBe(scripted)
        if (plan.timeline) expect(plan.timeline.duration).toBe(plan.plannedSec)
        // v1 没有语音引导：引导词只显示成文字；安静了 20 秒以上再出现的一句轻响一声（睡前不响）
        expect(plan.voice).toBe(false)
        expect(plan.captionCue).toBe(scripted && !isBedtime(p.id))
        expect(plan.bells).toBe(true)

        expect(plan.pattern !== null).toBe(p.paced !== undefined || assessment)
        expect(plan.pattern?.warmup !== undefined).toBe(p.id === 'slow')
        expect(plan.cueStyle).toBe(plan.pattern ? DEFAULT_PREFS.cueStyle : undefined)

        const bedtime = isBedtime(p.id)
        expect(plan.prosody).toBe(bedtime ? 'settle' : 'steady')
        expect(plan.fadeInSec).toBe(bedtime ? BEDTIME_FADE_IN_SEC : DEFAULT_FADE_IN_SEC)
        expect(plan.endBell).toBe(!bedtime && !assessment)
        expect(plan.cues).toBe(!bedtime && p.id !== 'pause')
        expect(plan.intervalSec).toBeNull()
        expect(plan.haptics).toBe(DEFAULT_PREFS.haptics)
        expect(plan.silentEnd).toBe(DEFAULT_PREFS.silentEnd)
        expect(plan.sound.mode).toBe(
          p.kind === 'sound' || bedtime ? (bedtime ? 'sleep' : 'relax') : undefined,
        )

        if (scripted) expect(plan.params.level).toBe(DEFAULT_PREFS.guidance)
        else expect(plan.params.level).toBeUndefined()
      })
    }
  }
})

describe('引擎接受每一项练习的默认计划', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  for (const p of PRACTICES) {
    it(p.id, async () => {
      const s = createTestSession()
      await s.ctrl.start(buildPlan(p.id, p.defaultMinutes, prefs(), null))
      expect(s.ctrl.getState().status).toBe('lead')
      await s.advanceTo(1)
      expect(s.ctrl.getState().status).toBe('running')
      s.ctrl.end()
      expect(s.ctrl.getState().status).toBe('done')
    })
  }
})

describe('引导时间线', () => {
  it('按偏好的引导详细程度排（不传时引擎会按「详细」排）', () => {
    const script = getScript('body-scan')
    const plan = buildPlan('body-scan', 10, prefs(), null)
    expect(plan.timeline).toEqual(buildTimeline(script, 10, STANDARD))
    expect(plan.timeline).not.toEqual(buildTimeline(script, 10))
    const quiet = buildPlan('body-scan', 10, prefs({ guidance: 'quiet' }), null)
    expect(quiet.timeline).toEqual(buildTimeline(script, 10, { ...STANDARD, level: 'quiet' }))
    expect(quiet.params.level).toBe('quiet')
  })

  it('这一次的引导详细程度覆盖偏好', () => {
    const plan = buildPlan('focus', 10, prefs(), null, { guidance: 'detailed' })
    expect(plan.timeline).toEqual(buildTimeline(getScript('focus'), 10, { ...STANDARD, level: 'detailed' }))
    expect(plan.params.level).toBe('detailed')
  })

  it('字速用引擎默认的每秒 3.6 字（v1 没有语音语速）', () => {
    const plan = buildPlan('focus', 10, prefs(), null)
    expect(plan.timeline).toEqual(buildTimeline(getScript('focus'), 10, STANDARD))
    expect(plan.timeline).toEqual(buildTimeline(getScript('focus'), 10, { level: 'standard' }))
  })

  it('一分钟的引导结尾只留 5 秒', () => {
    for (const id of ['pause', 'grounding', 'cyclic-sigh'] as const) {
      const plan = buildPlan(id, 1, prefs(), null)
      const expected = buildTimeline(getScript(id), 1, { ...STANDARD, endBufferSec: SHORT_END_BUFFER_SEC })
      expect(plan.timeline, id).toEqual(expected)
    }
    // 3 分钟起照常留 10 秒
    expect(buildPlan('cyclic-sigh', 3, prefs(), null).timeline).toEqual(
      buildTimeline(getScript('cyclic-sigh'), 3, STANDARD),
    )
  })

  it('三分钟呼吸空间选 5 分钟时读入门两步版', () => {
    const plan = buildPlan('breathing-space', 5, prefs(), null)
    expect(plan.timeline).toEqual(buildTimeline(getScript('breathing-space-intro'), 5, STANDARD))
  })

  it('睡前身体扫描按 settle 语气排：越往后越慢、越轻', () => {
    const plan = buildPlan('body-scan-sleep', 10, prefs(), null)
    expect(plan.timeline).toEqual(
      buildTimeline(getScript('body-scan-sleep'), 10, { ...STANDARD, prosody: 'settle' }),
    )
    const speaks = plan.timeline?.cues.filter(c => c.kind === 'speak') ?? []
    expect(speaks.at(-1)?.rate).toBeLessThan(1)
  })

  it('新的一句出现时轻提示照偏好；关掉时只显示文字', () => {
    expect(buildPlan('body-scan', 10, prefs(), null).captionCue).toBe(true)
    const off = buildPlan('body-scan', 10, prefs({ captionCue: false }), null)
    expect(off.captionCue).toBe(false)
    expect(off.timeline?.cues.some(c => c.kind === 'speak')).toBe(true)
    // 没有引导词的练习、听声音、睡前都不响
    expect(buildPlan('timer', 10, prefs(), null).captionCue).toBe(false)
    expect(buildPlan('listen', 20, prefs(), null).captionCue).toBe(false)
    expect(buildPlan('sleep', 45, prefs(), null).captionCue).toBe(false)
    // 带引导词的呼吸练习也响（节拍之外的那几句）
    expect(buildPlan('slow', 5, prefs(), null).captionCue).toBe(true)
  })

  it('v1 只有文字引导：时间线照排，不朗读', () => {
    const plan = buildPlan('body-scan', 10, prefs(), null)
    expect(plan.timeline?.cues.some(c => c.kind === 'speak')).toBe(true)
    expect(plan.voice).toBe(false)
  })

  it('带引导词的呼吸练习：时间线标出结尾的话开始的时刻，引擎从那里起停下节拍', () => {
    const plan = buildPlan('slow', 5, prefs(), null)
    const closing = plan.timeline?.closingT ?? Number.NaN
    expect(closing).toBeGreaterThan(200)
    expect(closing).toBeLessThan(plan.plannedSec)
    expect(plan.timeline?.cues.find(c => c.t === closing)?.text).toBe(
      '最后这一会儿，不用再跟着节拍，自然地呼吸就好。',
    )
  })
})

describe('睡前', () => {
  it('睡前身体扫描与听声音 · 睡前：settle、无提示音、无结束钟、淡入 20 秒、睡前模式', () => {
    for (const id of ['body-scan-sleep', 'sleep'] as const) {
      const plan = buildPlan(id, PRACTICE_BY_ID[id].defaultMinutes, prefs({ cues: true }), null)
      expect(plan.prosody, id).toBe('settle')
      expect(plan.cues, id).toBe(false)
      expect(plan.endBell, id).toBe(false)
      expect(plan.fadeInSec, id).toBe(20)
      expect(plan.sound.mode, id).toBe('sleep')
    }
  })

  it('不限时的睡前声音：计划时长为 0', () => {
    const plan = buildPlan('sleep', 0, prefs(), null)
    expect(plan.plannedSec).toBe(0)
    expect(plan.voice).toBe(false)
    expect(plan.params.mode).toBe('sleep')
  })

  it('睡前之后不问练完感觉和自评；舒适节律探索也不问', () => {
    const on = prefs({ checkin: { prePost: true, feeling: true } })
    expect(afterQuestions('body-scan-sleep', on)).toEqual({ feeling: false, checkin: false })
    expect(afterQuestions('sleep', on)).toEqual({ feeling: false, checkin: false })
    expect(afterQuestions('pace-finder', on)).toEqual({ feeling: false, checkin: false })
    expect(afterQuestions('focus', on)).toEqual({ feeling: true, checkin: true })
    expect(afterQuestions('listen', on)).toEqual({ feeling: true, checkin: true })
    expect(afterQuestions('focus', prefs())).toEqual({ feeling: true, checkin: false })
  })

  it('练完感觉没有开关：偏好里关着也照样问', () => {
    expect(afterQuestions('focus', prefs({ checkin: { prePost: false, feeling: false } })).feeling).toBe(true)
  })
})

describe('提示音', () => {
  it('一分钟停一停不响段落提示音，其他引导照偏好', () => {
    expect(buildPlan('pause', 1, prefs({ cues: true }), null).cues).toBe(false)
    expect(buildPlan('body-scan', 10, prefs({ cues: true }), null).cues).toBe(true)
    expect(buildPlan('focus', 10, prefs({ cues: false }), null).cues).toBe(false)
  })
})

describe('慢呼吸', () => {
  it('默认 5.5 次/分、呼气更长，开头从 8 次/分逐步放慢', () => {
    const plan = buildPlan('slow', 5, prefs(), null)
    expect(plan.pattern?.rate).toBe(5.5)
    expect(plan.pattern?.warmup?.[0]?.rate).toBe(WARMUP_START_RATE)
    expect(plan.params).toEqual({ rate: 5.5, ratio: 'long', level: 'standard' })
  })

  it('用记住的速度和吸呼比', () => {
    const plan = buildPlan('slow', 5, prefs({ practice: { slow: { rate: 6, ratio: 'equal' } } }), null)
    expect(plan.pattern?.rate).toBe(6)
    expect(plan.params).toMatchObject({ rate: 6, ratio: 'equal' })
  })

  it('没有记住的速度时用个人速度', () => {
    expect(buildPlan('slow', 5, prefs({ personalRate: 5 }), null).pattern?.rate).toBe(5)
  })

  it('计划给的速度覆盖记住的速度；personal 用个人速度，没有时 5.5', () => {
    const own = prefs({ practice: { slow: { rate: 6 } }, personalRate: 5 })
    expect(buildPlan('slow', 5, own, null, { params: { rate: 7 } }).pattern?.rate).toBe(7)
    expect(buildPlan('slow', 10, own, null, { params: { rate: 'personal' } }).pattern?.rate).toBe(5)
    expect(buildPlan('slow', 10, prefs(), null, { params: { rate: 'personal' } }).pattern?.rate).toBe(
      DEFAULT_PERSONAL_RATE,
    )
    expect(buildPlan('slow', 5, own, null, { params: { rate: 7 } }).params.rate).toBe(7)
  })

  it('可以关掉开头的放慢：这一次的覆盖，或详情页记住的开关', () => {
    expect(buildPlan('slow', 5, prefs(), null, { warmup: false }).pattern?.warmup).toBeUndefined()
    const off = prefs({ practice: { slow: { warmup: false } } })
    expect(buildPlan('slow', 5, off, null).pattern?.warmup).toBeUndefined()
    expect(buildPlan('slow', 5, off, null, { warmup: true }).pattern?.warmup).toBeDefined()
  })

  it('超出范围的速度收回到慢呼吸的 4.5–7.0', () => {
    expect(SLOW_RATE).toEqual({ min: SLOW_RATE_MIN, max: SLOW_RATE_MAX, step: 0.5 })
    expect(SLOW_RATE).toMatchObject({ min: 4.5, max: 7 })
    expect(buildPlan('slow', 5, prefs(), null, { params: { rate: 12 } }).pattern?.rate).toBe(7)
    expect(buildPlan('slow', 5, prefs(), null, { params: { rate: 3 } }).pattern?.rate).toBe(4.5)
    expect(buildPlan('slow', 5, prefs({ personalRate: 7 }), null).pattern?.rate).toBe(7)
  })

  it('有惊恐发作时默认改为轻而慢的 6 次/分；自己选过的速度照旧', () => {
    const panic = screen({ panic: true })
    expect(buildPlan('slow', 5, prefs(), panic).pattern?.rate).toBe(
      LIGHT_SLOW_PACE.type === 'resonance' ? LIGHT_SLOW_PACE.rate : Number.NaN,
    )
    expect(buildPlan('slow', 5, prefs({ practice: { slow: { rate: 5 } } }), panic).pattern?.rate).toBe(5)
  })

  it('节拍提示照偏好', () => {
    expect(buildPlan('slow', 5, prefs({ cueStyle: 'ping' }), null).cueStyle).toBe('ping')
    expect(buildPlan('focus', 10, prefs({ cueStyle: 'ping' }), null).cueStyle).toBeUndefined()
  })
})

describe('周期性叹息', () => {
  it('默认一轮 10.5 秒，可以记住或覆盖，不放慢', () => {
    expect(buildPlan('cyclic-sigh', 5, prefs(), null).pattern?.T).toBe(10.5)
    const own = prefs({ practice: { 'cyclic-sigh': { cycle: 12 } } })
    expect(buildPlan('cyclic-sigh', 5, own, null).params.cycle).toBe(12)
    expect(buildPlan('cyclic-sigh', 5, own, null, { params: { cycle: 8 } }).pattern?.T).toBe(8)
    expect(buildPlan('cyclic-sigh', 5, prefs(), null, { params: { cycle: 30 } }).pattern?.T).toBe(
      SIGH_CYCLE_MAX,
    )
    expect(buildPlan('cyclic-sigh', 5, prefs(), null).pattern?.warmup).toBeUndefined()
  })
})

describe('箱式呼吸', () => {
  it('默认 4-4-4-4', () => {
    const plan = buildPlan('box', 5, prefs(), null)
    expect(plan.pattern?.T).toBe(16)
    expect(plan.params).toMatchObject({ inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 })
  })

  it('每步秒数可以覆盖，收在 3–6 秒', () => {
    expect(BOX_PHASE_SEC).toEqual({ min: 3, max: 6, default: 4 })
    expect(buildPlan('box', 5, prefs(), null, { params: { phase: 5 } }).pattern?.T).toBe(20)
    expect(buildPlan('box', 5, prefs(), null, { params: { phase: 10 } }).pattern?.T).toBe(24)
    expect(buildPlan('box', 5, prefs(), null, { params: { phase: 2 } }).pattern?.T).toBe(12)
  })

  it('用详情页记住的每步秒数；这一次的覆盖优先', () => {
    const own = prefs({ practice: { box: { phaseSec: 5 } } })
    expect(buildPlan('box', 5, own, null).pattern?.T).toBe(20)
    expect(buildPlan('box', 5, own, null).params).toMatchObject({
      inhale: 5,
      holdIn: 5,
      exhale: 5,
      holdOut: 5,
    })
    expect(buildPlan('box', 5, own, null, { params: { phase: 3 } }).pattern?.T).toBe(12)
  })

  it('也可以分别给出四步；屏息为 0 表示没有这一步', () => {
    const plan = buildPlan('box', 5, prefs(), null, {
      params: { inhale: 4, holdIn: 0, exhale: 6, holdOut: 0 },
    })
    expect(plan.pattern?.segs.map(s => s.key)).toEqual(['in', 'out'])
    expect(plan.params).toMatchObject({ inhale: 4, holdIn: 0, exhale: 6, holdOut: 0 })
  })
})

describe('舒适节律探索', () => {
  it('每次排一档：60 秒、固定速度、不放慢、不敲钟、没有引导词', () => {
    const plan = buildPlan('pace-finder', 7, prefs(), null, {
      params: { rate: PACE_FINDER_RATES[2], step: 3 },
    })
    expect(plan.kind).toBe('assessment')
    expect(plan.plannedSec).toBe(PACE_STEP_SEC)
    expect(plan.pattern?.rate).toBe(5.5)
    expect(plan.pattern?.warmup).toBeUndefined()
    expect(plan.timeline).toBeNull()
    expect(plan.endBell).toBe(false)
    expect(plan.params).toMatchObject({ rate: 5.5, step: 3 })
  })

  it('不给速度时从第一档 6.5 开始；第二档起可以缩短倒数', () => {
    expect(buildPlan('pace-finder', 7, prefs(), null).pattern?.rate).toBe(6.5)
    expect(buildPlan('pace-finder', 7, prefs(), null, { leadSec: 3 }).leadSec).toBe(3)
  })

  it('五档只有一份：就是心率模块的 PACE_FINDER_ASSESSMENT.rates', () => {
    expect(PACE_FINDER_RATES).toBe(PACE_FINDER_ASSESSMENT.rates)
    expect(PACE_FINDER_RATES).toEqual([6.5, 6, 5.5, 5, 4.5])
  })

  it('按之后真正要练的慢呼吸比例呼吸：记住的比例，没有就用慢呼吸的默认（呼气更长）', () => {
    expect(buildPlan('pace-finder', 7, prefs(), null).params.ratio).toBe('long')
    expect(PACE_FINDER_ASSESSMENT.ratio).toBe('long')
    const equal = prefs({ practice: { slow: { ratio: 'equal' } } })
    expect(buildPlan('pace-finder', 7, equal, null).params.ratio).toBe('equal')
  })
})

describe('静坐计时', () => {
  it('间隔钟声照偏好或这一次的选择，到结束的那一下由结束钟声接管', () => {
    expect(buildPlan('timer', 10, prefs({ intervalBell: 5 }), null).intervalSec).toBe(300)
    expect(buildPlan('timer', 10, prefs({ intervalBell: 5 }), null).params.interval).toBe(5)
    expect(buildPlan('timer', 10, prefs(), null).intervalSec).toBeNull()
    expect(buildPlan('timer', 20, prefs(), null, { intervalBell: 10 }).intervalSec).toBe(600)
    expect(buildPlan('timer', 5, prefs({ intervalBell: 5 }), null).intervalSec).toBeNull()
  })
})

describe('背景声', () => {
  it('引导和呼吸练习：练习的默认声音和设置里的音量，按放松播放', () => {
    const p = prefs({ volume: { master: 80, ambience: 40, music: 30, cues: 70 } })
    expect(buildPlan('focus', 10, p, null).sound).toEqual({
      ambience: 'stream',
      music: 'none',
      ambienceVolume: 40,
      musicVolume: 30,
    })
    expect(buildPlan('pause', 1, p, null).sound.ambience).toBe('none')
  })

  it('用这项练习记住的声景和音乐；这一次的选择覆盖它们', () => {
    const p = prefs({ practice: { focus: { ambience: 'rain', music: 'drone' } } })
    expect(buildPlan('focus', 10, p, null).sound).toMatchObject({ ambience: 'rain', music: 'drone' })
    const once = buildPlan('focus', 10, p, null, { sound: { music: 'none', musicVolume: 120 } })
    expect(once.sound).toMatchObject({ ambience: 'rain', music: 'none', musicVolume: 100 })
  })

  it('听声音用设置里这个模式的默认组合和音量', () => {
    const p = prefs()
    p.sounds.relax = {
      ambience: 'ocean',
      music: 'pentatonic',
      ambienceVolume: 60,
      musicVolume: 35,
      mode: 'relax',
    }
    expect(buildPlan('listen', 20, p, null).sound).toEqual({
      ambience: 'ocean',
      music: 'pentatonic',
      ambienceVolume: 60,
      musicVolume: 35,
      mode: 'relax',
    })
    expect(buildPlan('listen', 20, p, null).params.mode).toBe('relax')
  })

  it('睡前没有鸟鸣：换成睡前的默认声音', () => {
    const p = prefs({ practice: { 'body-scan-sleep': { ambience: 'birds' } } })
    p.sounds.sleep = { ...p.sounds.sleep, ambience: 'birds' }
    expect(buildPlan('sleep', 45, p, null).sound.ambience).toBe('rain')
    expect(buildPlan('body-scan-sleep', 10, p, null).sound).toMatchObject({ ambience: 'rain', mode: 'sleep' })
    expect(
      buildPlan('focus', 10, prefs({ practice: { focus: { ambience: 'birds' } } }), null).sound.ambience,
    ).toBe('birds')
  })
})

describe('健康情况检查', () => {
  it('有创伤经历：时长不超过 10 分钟，引导改为详细', () => {
    const plan = buildPlan('focus', 20, prefs({ guidance: 'quiet' }), screen({ trauma: true }))
    expect(plan.plannedSec).toBe(600)
    expect(plan.params.level).toBe('detailed')
  })

  it('幻觉妄想或双相：静坐计时最长 5 分钟', () => {
    expect(buildPlan('timer', 20, prefs(), screen({ psychosis: true })).plannedSec).toBe(300)
  })

  it('隐藏的练习照样能排（界面负责不提供入口）', () => {
    expect(() => buildPlan('box', 5, prefs(), screen({ heart: true }))).not.toThrow()
  })
})

describe('时长', () => {
  const focus = { durations: [5, 10, 15, 20, 30], defaultMinutes: 10 }

  it('fitMinutes：在可选时长里照办，否则取不超过它的最长一档，再没有就用默认', () => {
    expect(fitMinutes(15, focus)).toBe(15)
    expect(fitMinutes(12, focus)).toBe(10)
    expect(fitMinutes(3, focus)).toBe(10)
    expect(fitMinutes(Number.NaN, focus)).toBe(10)
    expect(fitMinutes(0, { durations: [15, 30, 45, 60, 0], defaultMinutes: 45 })).toBe(0)
  })

  it('defaultMinutes：上次选的时长优先，按健康情况检查收回', () => {
    expect(defaultMinutes('focus', prefs(), null)).toBe(10)
    expect(defaultMinutes('focus', prefs({ practice: { focus: { minutes: 15 } } }), null)).toBe(15)
    expect(defaultMinutes('focus', prefs({ practice: { focus: { minutes: 7 } } }), null)).toBe(10)
    expect(
      defaultMinutes('focus', prefs({ practice: { focus: { minutes: 20 } } }), screen({ trauma: true })),
    ).toBe(5)
  })
})

describe('其他偏好', () => {
  it('开头倒数、振动、结尾静默', () => {
    const plan = buildPlan('focus', 10, prefs({ leadIn: 8, haptics: false, silentEnd: false }), null)
    expect(plan).toMatchObject({ leadSec: 8, haptics: false, silentEnd: false })
    expect(buildPlan('focus', 10, prefs({ leadIn: 99 }), null).leadSec).toBe(30)
  })

  it('设置里关掉钟声时开始、结束都不敲；结尾的安排不变', () => {
    const off = buildPlan('focus', 10, prefs({ bells: false }), null)
    expect(off.bells).toBe(false)
    // endBell 说的是结尾怎么安排（睡前不响钟、慢慢淡出），与这个开关无关
    expect(off.endBell).toBe(true)
    expect(buildPlan('focus', 10, prefs(), null).bells).toBe(true)
  })
})

describe('v1 提供的练习', () => {
  it('名单和判断都来自内容层', () => {
    expect(isOffered).toBe(catalogue.isOffered)
    expect(V1_UNAVAILABLE).toBe(catalogue.V1_UNAVAILABLE)
    expect(isOffered('walking')).toBe(false)
    expect(isOffered('body-scan-sleep')).toBe(false)
    expect(isOffered('focus')).toBe(true)
    // 不认识的 id 也不提供（播放器的深链接按 404 处理）
    expect(isOffered('qigong')).toBe(false)
  })
})
