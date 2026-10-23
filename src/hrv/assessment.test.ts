import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildPattern, patternAt } from '@/engine/patterns'
import {
  type AssessmentTrial,
  type ComfortRating,
  DEFAULT_ASSESSMENT,
  PACE_FINDER_ASSESSMENT,
  pickByComfort,
  pickResonance,
  planAssessment,
  SLOW_RATIO,
  scoreTrial,
  type TrialScore,
  targetVolume,
  trialAt,
} from './assessment'
import { type BeatTracker, createBeatTracker } from './beats'
import { lfPower } from './metrics'
import { createSimulatedHeartRate, type SimulatorOptions, type VolumeFn } from './simulator'
import type { Beat } from './types'

/** 按方案完整做一次测定：开始前先自然呼吸 30 秒 */
function simulate(options: SimulatorOptions, plan = planAssessment(), breathe?: VolumeFn): Beat[] {
  const sim = createSimulatedHeartRate({ start: -30, ...options })
  sim.setBreathing(breathe ?? (t => targetVolume(plan, t)))
  return sim.advance(plan.duration)
}

/** 第 i 搏换成提前四成出现的早搏：一短一长（代偿间歇），下一搏仍按原来的节律来。心搏数不变 */
function withPremature(beats: readonly Beat[], i: number): Beat[] {
  const a = beats[i]!
  const b = beats[i + 1]!
  const early = { t: a.t - (0.4 * a.rr) / 1000, rr: 0.6 * a.rr }
  return [...beats.slice(0, i), early, { t: b.t, rr: (b.t - early.t) * 1000 }, ...beats.slice(i + 2)]
}

const score = (
  rate: number,
  amplitude: number,
  lfPower: number,
  extra: Partial<TrialScore> = {},
): TrialScore => ({
  rate,
  amplitude,
  amplitudeSe: 0.5,
  lfPower,
  lfPeakHz: rate / 60,
  rmssd: 40,
  meanHr: 64,
  quality: 'good',
  issues: [],
  beats: 110,
  artifactRate: 0,
  coverage: 1,
  cycles: 9,
  ...extra,
})

describe('assessment plan', () => {
  it('follows the default protocol: five rates, two minutes each, first 20 s discarded', () => {
    const plan = planAssessment()
    expect(plan.trials.map(t => t.rate)).toEqual([6.5, 6, 5.5, 5, 4.5])
    expect(plan.trials.map(t => t.start)).toEqual([0, 120, 240, 360, 480])
    expect(plan.trials.map(t => t.end)).toEqual([120, 240, 360, 480, 600])
    expect(plan.trials.map(t => t.cycles)).toEqual([13, 12, 11, 10, 9])
    expect(plan.trials.map(t => t.analysisStart)).toEqual([20, 140, 260, 380, 500])
    expect(plan.trials[2]?.paced).toEqual({ type: 'resonance', rate: 5.5, ratio: 'equal' })
    expect(plan.trials[2]?.period).toBeCloseTo(60 / 5.5, 12)
    expect(plan.duration).toBe(600)
    expect(plan.config).toEqual(DEFAULT_ASSESSMENT)
  })

  it('gives each trial the engine pattern for its rate', () => {
    for (const trial of planAssessment({ ratio: 'long' }).trials) {
      expect(trial.pattern).toEqual(buildPattern(trial.paced))
      expect(trial.pattern.T).toBeCloseTo(trial.period, 12)
    }
  })

  it('rounds each trial to whole breaths and honours rests and ratio', () => {
    const plan = planAssessment({ rates: [5.5, 6], trialSec: 100, restSec: 30, ratio: 'long' })
    const [a, b] = plan.trials
    expect(a?.cycles).toBe(9)
    expect(a?.end).toBeCloseTo((9 * 60) / 5.5, 9)
    expect(b?.start).toBeCloseTo(a!.end + 30, 9)
    expect(b?.cycles).toBe(10)
    expect(b?.paced.ratio).toBe('long')
    expect(plan.duration).toBeCloseTo(b!.end, 9)
    // 正好半轮时多呼吸一轮，不因浮点误差时多时少（100 秒 × 5.1 次 = 8.5 轮，× 3.3 次 = 5.5 轮）
    expect(planAssessment({ rates: [5.1, 3.3], trialSec: 100 }).trials.map(t => t.cycles)).toEqual([9, 6])
  })

  it('plans the pace finder: the same five rates, one minute each, first 10 s not analysed', () => {
    const plan = planAssessment(PACE_FINDER_ASSESSMENT)
    expect(plan.config).toEqual(PACE_FINDER_ASSESSMENT)
    expect(plan.trials.map(t => t.rate)).toEqual([6.5, 6, 5.5, 5, 4.5])
    // 按慢呼吸的默认比例（呼气更长）呼吸：测的是之后真正要练的呼吸，评分只看每轮的起点
    expect(SLOW_RATIO).toBe('long')
    for (const t of plan.trials) expect(t.paced).toEqual({ type: 'resonance', rate: t.rate, ratio: 'long' })
    // 取整到整轮、半轮进一：每档 60–67 秒，都在呼完气时换档
    expect(plan.trials.map(t => t.cycles)).toEqual([7, 6, 6, 5, 5])
    for (const t of plan.trials) {
      expect(t.end - t.start).toBeCloseTo(t.cycles * t.period, 9)
      expect(t.end - t.start).toBeGreaterThanOrEqual(60)
      expect(t.end - t.start).toBeLessThan(67)
      expect(t.analysisStart - t.start).toBeCloseTo(10, 9)
    }
    expect(plan.duration).toBeCloseTo(60 * (7 / 6.5 + 1 + 6 / 5.5 + 1 + 5 / 4.5), 9)
    expect(trialAt(plan, 9.9)).toMatchObject({ phase: 'settle', trial: { index: 0 } })
    expect(trialAt(plan, 10)).toMatchObject({ phase: 'measure', trial: { index: 0 } })
  })

  it('keeps the two-minute protocol as the default', () => {
    expect(planAssessment(DEFAULT_ASSESSMENT)).toEqual(planAssessment())
    expect(planAssessment().config.settleSec).toBe(20)
    // 预设冻结着，界面改不了别处共用的方案
    expect(Object.isFrozen(PACE_FINDER_ASSESSMENT)).toBe(true)
    expect(Object.isFrozen(PACE_FINDER_ASSESSMENT.rates)).toBe(true)
  })

  it('scales the settle to the trial length unless it is given', () => {
    expect(planAssessment({ trialSec: 60, ratio: SLOW_RATIO })).toEqual(
      planAssessment(PACE_FINDER_ASSESSMENT),
    )
    expect(planAssessment({ trialSec: 90 }).config.settleSec).toBe(15)
    // 心率跟上新频率的时间不随段长变：再长也只舍弃 20 秒
    expect(planAssessment({ trialSec: 300 }).config.settleSec).toBe(20)
    // 给了就照用
    expect(planAssessment({ trialSec: 60, settleSec: 20 }).trials[0]?.analysisStart).toBe(20)
    expect(planAssessment({ settleSec: 10 }).trials[1]?.analysisStart).toBe(130)
    // 显式的 undefined（比如还没设过的偏好）按没给处理
    const unset = planAssessment({ trialSec: 60, settleSec: undefined, rates: undefined, ratio: undefined })
    expect(unset.config).toEqual({ ...PACE_FINDER_ASSESSMENT, ratio: DEFAULT_ASSESSMENT.ratio })
  })

  it('rejects impossible settings', () => {
    expect(() => planAssessment({ rates: [] })).toThrow(RangeError)
    expect(() => planAssessment({ rates: [6, 0] })).toThrow(RangeError)
    expect(() => planAssessment({ rates: [Number.NaN] })).toThrow(RangeError)
    // 超出引擎节拍支持的范围
    expect(() => planAssessment({ rates: [12] })).toThrow(/3–10/)
    expect(() => planAssessment({ settleSec: 120 })).toThrow(RangeError)
    expect(() => planAssessment({ restSec: -1 })).toThrow(RangeError)
  })

  it('tells where in the protocol a moment falls', () => {
    const plan = planAssessment({ restSec: 10 })
    expect(trialAt(plan, -1)).toBeNull()
    expect(trialAt(plan, 5)).toMatchObject({
      phase: 'settle',
      elapsed: 5,
      remaining: 115,
      trial: { index: 0 },
    })
    expect(trialAt(plan, 60)).toMatchObject({ phase: 'measure', trial: { index: 0 } })
    expect(trialAt(plan, 125)).toBeNull()
    expect(trialAt(plan, 130)).toMatchObject({ phase: 'settle', elapsed: 0, trial: { index: 1 } })
    expect(trialAt(plan, plan.duration)).toBeNull()
  })

  it('reads the target lung volume from the engine pattern, restarting each trial on an inhale', () => {
    const plan = planAssessment({ restSec: 10 })
    expect(targetVolume(plan, 125)).toBeNull()
    // 第二段 6 次/分、吸呼各 5 秒：开始时呼空，2.5 秒时一半，5 秒时吸满
    expect(targetVolume(plan, 130)).toBeCloseTo(0, 12)
    expect(targetVolume(plan, 132.5)).toBeCloseTo(0.5, 12)
    expect(targetVolume(plan, 135)).toBeCloseTo(1, 12)
    // 呼气更长时吸气比一半短，比例以引擎为准
    const long = planAssessment({ rates: [6], ratio: 'long' })
    const inhale = long.trials[0]!.pattern.segs[0]!.dur
    expect(inhale).toBeLessThan(5)
    expect(targetVolume(long, inhale)).toBeCloseTo(1, 12)
    expect(targetVolume(long, 7)).toBeCloseTo(patternAt(long.trials[0]!.pattern, 7).y, 12)
  })
})

describe('trial scoring', () => {
  const plan = planAssessment()

  it('scores clean trials as good, with the LF peak at the breathing rate', () => {
    const beats = simulate({ resonance: 5.5, seed: 1 })
    for (const trial of plan.trials) {
      const s = scoreTrial(beats, trial)
      expect(s.quality).toBe('good')
      expect(s.issues).toEqual([])
      expect(s.rate).toBe(trial.rate)
      expect(Math.abs(s.lfPeakHz - trial.rate / 60)).toBeLessThan(0.004)
      expect(s.cycles).toBe(trial.cycles - Math.ceil(20 / trial.period))
      expect(s.amplitudeSe).toBeGreaterThan(0)
      expect(s.amplitudeSe).toBeLessThan(0.2 * s.amplitude)
      expect(s.coverage).toBeGreaterThan(0.95)
      expect(s.meanHr).toBeGreaterThan(55)
      expect(s.meanHr).toBeLessThan(75)
      expect(s.rmssd).toBeGreaterThan(10)
    }
    const atResonance = scoreTrial(beats, plan.trials[2]!)
    expect(atResonance.amplitude).toBeGreaterThan(14)
    expect(atResonance.amplitude).toBeLessThan(20)
  })

  it('scores the same beats the same way whatever the inhale–exhale ratio of the plan', () => {
    // 评分只用每一轮的起点切分，吸呼比例只影响节拍的形状：舒适节律探索按呼气更长的比例呼吸，评分照旧
    const beats = simulate({ resonance: 5.5, seed: 3 })
    const long = planAssessment({ ratio: 'long' })
    for (const [i, trial] of plan.trials.entries()) {
      const other = long.trials[i]!
      expect(other.paced.ratio).toBe('long')
      expect(scoreTrial(beats, other)).toEqual(scoreTrial(beats, trial))
    }
  })

  it('marks trials with many artifacts as noisy', () => {
    const beats = simulate({ seed: 2, artifacts: 0.12 })
    const scores = plan.trials.map(t => scoreTrial(beats, t))
    expect(scores.every(s => s.quality === 'noisy' && s.issues.includes('artifacts'))).toBe(true)
    expect(scores.every(s => s.artifactRate > 0.05)).toBe(true)
  })

  it('marks trials without enough data as insufficient', () => {
    expect(scoreTrial([], plan.trials[0]!)).toMatchObject({
      quality: 'insufficient',
      beats: 0,
      coverage: 0,
      issues: ['gaps'],
    })
    expect(scoreTrial([], plan.trials[0]!).amplitude).toBeNaN()
    // 第二段中间断了 50 秒
    const beats = simulate({ seed: 3 }).filter(b => b.t < 160 || b.t > 210)
    const s = scoreTrial(beats, plan.trials[1]!)
    expect(s.quality).toBe('insufficient')
    expect(s.coverage).toBeLessThan(0.6)
    expect(scoreTrial(beats, plan.trials[0]!).quality).toBe('good')
  })

  it('does not let a run of false detections inflate the amplitude', () => {
    const trial = plan.trials[2]!
    const beats = simulate({ seed: 7, artifacts: 0 })
    const clean = scoreTrial(beats, trial)
    // 两搏被误检成三个短间期：三个挨在一起、彼此相近，逃得过五搏中位数
    const i = beats.findIndex(b => b.t > trial.analysisStart + 40)
    const a = beats[i]!
    const b = beats[i + 1]!
    const span = a.rr + b.rr
    const split = [0.34, 0.33, 0.33].map(f => f * span)
    const start = a.t - a.rr / 1000
    const run = split.map((rr, k) => ({
      rr,
      t: start + split.slice(0, k + 1).reduce((x, y) => x + y, 0) / 1000,
    }))
    const noisy = scoreTrial([...beats.slice(0, i), ...run, ...beats.slice(i + 2)], trial)
    expect(noisy.quality).toBe('noisy')
    expect(noisy.issues).toEqual(['artifacts'])
    expect(noisy.cycles).toBe(clean.cycles - 1)
    expect(Math.abs(noisy.amplitude - clean.amplitude)).toBeLessThan(1)
  })

  it('marks a short dropout as a gap without discarding the trial', () => {
    // 分析窗口 100 秒里断了 20 秒
    const beats = simulate({ seed: 3 }).filter(b => b.t < 170 || b.t > 190)
    const s = scoreTrial(beats, plan.trials[1]!)
    expect(s.quality).toBe('noisy')
    expect(s.issues).toEqual(['gaps'])
    expect(Number.isFinite(s.amplitude)).toBe(true)
  })

  it('flags a trial where the heart rate follows another rhythm than the pacer', () => {
    // 4.5 次/分那一段跟不上，实际按 5.5 次/分呼吸
    const tooSlow = buildPattern({ type: 'resonance', rate: 5.5, ratio: 'equal' })
    const beats = simulate({ seed: 5 }, plan, t => {
      const pos = trialAt(plan, t)
      if (!pos) return null
      return pos.trial.rate === 4.5
        ? patternAt(tooSlow, pos.elapsed).y
        : patternAt(pos.trial.pattern, pos.elapsed).y
    })
    const scores = plan.trials.map(t => scoreTrial(beats, t))
    expect(scores[4]).toMatchObject({ quality: 'noisy', issues: ['off-pace'] })
    expect(scores[4]!.lfPeakHz * 60).toBeCloseTo(5.5, 0)
    expect(scores.slice(0, 4).every(s => s.quality === 'good')).toBe(true)
  })

  it('uses beats just outside the window to judge the beats at its edges', () => {
    const beats = simulate({ seed: 4, artifacts: 0 })
    const trial = plan.trials[0]!
    const inside = beats.filter(b => b.t > trial.analysisStart && b.t <= trial.end)
    expect(scoreTrial(beats, trial).beats).toBe(inside.length)
    expect(scoreTrial(beats, trial).artifactRate).toBe(0)
  })

  it('does not pass off a trial that is still running as a result', () => {
    const trial = plan.trials[2]!
    const beats = simulate({ seed: 6 }).filter(b => b.t < trial.analysisStart + 45)
    const s = scoreTrial(beats, trial)
    expect(s.quality).toBe('insufficient')
    expect(s.coverage).toBeLessThan(0.5)
  })
})

describe('scoring one-minute trials (pace finder)', () => {
  // 每档之后停下来打分，这 20 秒里自然呼吸
  const plan = planAssessment({ ...PACE_FINDER_ASSESSMENT, restSec: 20 })

  it('grades clean trials as good and checks every one of them against the pacer', () => {
    for (const seed of [1, 2, 3, 4]) {
      const beats = simulate({ seed, artifacts: 0 }, plan)
      for (const trial of plan.trials) {
        const s = scoreTrial(beats, trial)
        expect(s.quality).toBe('good')
        expect(s.issues).toEqual([])
        expect(s.cycles).toBe(trial.cycles - Math.ceil(10 / trial.period))
        expect(s.coverage).toBeGreaterThan(0.95)
        // 每一档都有频谱，都查了是否跟上节拍
        expect(Math.abs(s.lfPeakHz * 60 - trial.rate)).toBeLessThan(0.35)
        expect(s.lfPower).toBeGreaterThan(0)
      }
    }
  })

  it('borrows the end of the settle for the spectrum when the analysis window is exactly 50 s', () => {
    const beats = simulate({ seed: 8, artifacts: 0 }, plan)
    for (const trial of [plan.trials[1]!, plan.trials[3]!]) {
      expect(trial.end - trial.analysisStart).toBeCloseTo(50, 9)
      // 只用分析窗口里的心搏，跨度差一点不到 50 秒，频谱算不出来
      const inWindow = beats.filter(b => b.t > trial.analysisStart && b.t <= trial.end)
      expect(lfPower(inWindow).power).toBeNaN()
      expect(scoreTrial(beats, trial).lfPeakHz * 60).toBeCloseTo(trial.rate, 0)
    }
  })

  it('flags a trial breathed at another rhythm, even where the analysis window is exactly 50 s', () => {
    // 跟不上每分钟 5 次的节拍，自己按每分钟 6 次呼吸
    const five = plan.trials[3]!
    const faster = buildPattern({ type: 'resonance', rate: 6, ratio: 'equal' })
    const beats = simulate({ seed: 5, artifacts: 0 }, plan, t => {
      const pos = trialAt(plan, t)
      if (!pos) return null
      return patternAt(pos.trial === five ? faster : pos.trial.pattern, pos.elapsed).y
    })
    const scores = plan.trials.map(t => scoreTrial(beats, t))
    expect(scores[3]).toMatchObject({ quality: 'noisy', issues: ['off-pace'] })
    expect(scores[3]!.lfPeakHz * 60).toBeCloseTo(6, 0)
    expect(scores.filter(s => s.quality === 'good')).toHaveLength(4)
  })

  it('counts a short dropout as a gap, and a long one or a trial still running as insufficient', () => {
    const trial = plan.trials[2]!
    const beats = simulate({ seed: 6, artifacts: 0 }, plan)
    const without = (from: number, to: number) =>
      beats.filter(b => b.t < trial.start + from || b.t > trial.start + to)
    // 约 55 秒的分析窗口里断了 10 秒：还能用，但要说明
    const short = scoreTrial(without(30, 40), trial)
    expect(short).toMatchObject({ quality: 'noisy', issues: ['gaps'] })
    expect(Number.isFinite(short.amplitude)).toBe(true)
    // 断了 25 秒，将近一半
    expect(scoreTrial(without(25, 50), trial).quality).toBe('insufficient')
    // 这一档才练了一半多
    expect(scoreTrial(without(35, 999), trial).quality).toBe('insufficient')
  })

  it('tolerates one premature beat in a slow heart, but not two', () => {
    // 心率 45 上下，一分钟一档的分析窗口里不到 40 搏，一次早搏剔除的两搏就超过 5%
    const trial = plan.trials[1]!
    const beats = simulate({ seed: 7, baseHr: 45, artifacts: 0 }, plan)
    const at = (sec: number) => beats.findIndex(b => b.t > trial.analysisStart + sec)
    const clean = scoreTrial(beats, trial)
    const once = scoreTrial(withPremature(beats, at(10)), trial)
    // 早搏与代偿间歇两搏都被剔除，占不到 40 搏的 5% 以上
    expect(once.beats).toBeLessThan(40)
    expect(Math.round(once.artifactRate * once.beats)).toBe(2)
    expect(once.artifactRate).toBeGreaterThan(0.05)
    expect(once).toMatchObject({ quality: 'good', issues: [] })
    expect(Math.abs(once.amplitude - clean.amplitude)).toBeLessThan(1)
    const twice = scoreTrial(withPremature(withPremature(beats, at(10)), at(30)), trial)
    expect(Math.round(twice.artifactRate * twice.beats)).toBe(4)
    expect(twice.quality).toBe('noisy')
    // 心率慢时，剔除的两搏留下约 4 秒的空档，超过一轮的三成，那一轮也不算了：两次就缺了两轮
    expect(twice.issues).toEqual(['gaps', 'artifacts'])
  })

  it('finds the simulated resonance within one step, and is never confidently wrong', () => {
    const misses: string[] = []
    let n = 0
    let highWrong = 0
    for (const resonance of [4.5, 5, 5.5, 6, 6.5]) {
      for (let seed = 1; seed <= 10; seed++) {
        const beats = simulate({ resonance, seed }, plan)
        const pick = pickResonance(plan.trials.map(t => scoreTrial(beats, t)))
        n++
        expect(pick).not.toBeNull()
        expect(Math.abs(pick!.rate - resonance)).toBeLessThanOrEqual(0.5)
        if (pick!.rate === resonance) continue
        misses.push(`${resonance}/${seed}→${pick!.rate} (${pick!.confidence})`)
        if (pick!.confidence === 'high') highWrong++
      }
    }
    // 一档只有四五轮，比两分钟一段粗：命中约八成，错也只差一档。所以心率带在舒适节律探索里只作参考
    expect(misses.length / n, misses.join(', ')).toBeLessThanOrEqual(0.3)
    expect(highWrong, misses.join(', ')).toBe(0)
  }, 30000)
})

describe('picking the resonance rate', () => {
  it('takes the clearly largest peak-to-trough amplitude', () => {
    const scores = [score(6.5, 10, 3000), score(6, 12, 4000), score(5.5, 15, 5000), score(5, 13, 6000)]
    expect(pickResonance(scores)).toEqual({ rate: 5.5, basis: 'amplitude', confidence: 'high' })
  })

  it('is not confident when the lead is within the cycle-to-cycle spread', () => {
    const scores = [score(6, 13.2, 4000), score(5.5, 15, 5000), score(5, 11, 3000)].map(s => ({
      ...s,
      amplitudeSe: 1.2,
    }))
    expect(pickResonance(scores)).toEqual({ rate: 5.5, basis: 'amplitude', confidence: 'low' })
    const unknownSpread = [
      score(6, 12, 4000),
      score(5.5, 15, 5000, { amplitudeSe: Number.NaN }),
      score(5, 11, 3000),
    ]
    expect(pickResonance(unknownSpread)?.confidence).toBe('low')
  })

  it('breaks an amplitude tie with LF power, compared in heart-rate units', () => {
    const scores = [score(6.5, 10, 3000), score(6, 15, 3800), score(5.5, 14.5, 5000), score(5, 11, 3000)]
    expect(pickResonance(scores)).toEqual({ rate: 5.5, basis: 'lf', confidence: 'low' })
    // 6 次/分那一段的 ms² 更高，只是因为那时心率偏低；换算成心率单位，5.5 高出约四成
    const slower = [
      score(6, 14.8, 5200, { meanHr: 60 }),
      score(5.5, 15, 5000, { meanHr: 66 }),
      score(5, 10, 2000),
    ]
    expect(pickResonance(slower)).toMatchObject({ rate: 5.5, basis: 'lf' })
  })

  it('is confident in an LF tie-break only when the amplitude lead is also beyond the noise', () => {
    // 领先 1.7 次/分：不到一成，按低频功率定；但已超过取样误差和标准误
    const clear = [score(6, 18.3, 3000), score(5.5, 20, 5000), score(5, 12, 2000), score(4.5, 10, 1800)]
    const precise = clear.map(s => ({ ...s, amplitudeSe: 0.2 }))
    expect(pickResonance(precise)).toEqual({ rate: 5.5, basis: 'lf', confidence: 'high' })
    // 领先只有 1 次/分，标准误再小也在按心搏取样的误差之内
    const slight = [score(6, 14, 3000), score(5.5, 15, 5000), score(5, 10, 2000)].map(s => ({
      ...s,
      amplitudeSe: 0.1,
    }))
    expect(pickResonance(slight)).toEqual({ rate: 5.5, basis: 'lf', confidence: 'low' })
  })

  it('falls back to amplitude, then to comfort, when LF cannot separate them either', () => {
    const scores = [score(6, 14.5, 4900), score(5.5, 15, 5000), score(5, 10, 2000)]
    expect(pickResonance(scores)).toEqual({ rate: 5.5, basis: 'amplitude', confidence: 'low' })
    const ratings: ComfortRating[] = [
      { rate: 6, comfort: 5, ease: 5 },
      { rate: 5.5, comfort: 3, ease: 3 },
      { rate: 5, comfort: 5, ease: 5 },
    ]
    expect(pickResonance(scores, ratings)).toEqual({ rate: 6, basis: 'comfort', confidence: 'low' })
    const noLf = [score(6, 14.5, Number.NaN), score(5.5, 15, Number.NaN), score(5, 10, Number.NaN)]
    expect(pickResonance(noLf)).toEqual({ rate: 5.5, basis: 'amplitude', confidence: 'low' })
  })

  it('lets trials with removed artifacts compete, but is never confident in one', () => {
    const base = [score(6, 12, 4000), score(5.5, 15, 5000), score(5, 11, 3000)]
    const insufficient = score(4.5, 30, 9000, { quality: 'insufficient' })
    const lowNoisy = score(6.5, 9, 2000, { quality: 'noisy', issues: ['artifacts'] })
    expect(pickResonance([lowNoisy, ...base, insufficient])).toEqual({
      rate: 5.5,
      basis: 'amplitude',
      confidence: 'high',
    })
    // 有瑕疵的那一段峰谷差明显更大：伪迹已经剔除，它多半就是答案，只是数据不够干净
    const highNoisy = score(6.5, 20, 9000, { quality: 'noisy', issues: ['artifacts'] })
    expect(pickResonance([highNoisy, ...base, insufficient])).toEqual({
      rate: 6.5,
      basis: 'amplitude',
      confidence: 'low',
    })
  })

  it('leaves out trials whose heart rate did not follow the pacer', () => {
    // 4.5 次/分那一段其实是按别的频率呼吸的，量到的起伏不属于 4.5
    const offPace = score(4.5, 25, 9000, { quality: 'noisy', issues: ['off-pace'] })
    const scores = [
      score(6.5, 9, 2000),
      score(6, 12, 4000),
      score(5.5, 15, 5000),
      score(5, 11, 3000),
      offPace,
    ]
    expect(pickResonance(scores)).toEqual({ rate: 5.5, basis: 'amplitude', confidence: 'high' })
    expect(pickResonance([score(6, 12, 4000), offPace])).toBeNull()
  })

  it('is not confident when a neighbouring rate could not be measured', () => {
    // 5 次/分那一段没量成：峰可能正落在那里
    const scores = [
      score(6.5, 9, 2000),
      score(6, 12, 4000),
      score(5.5, 15, 5000),
      score(5, Number.NaN, Number.NaN, { quality: 'insufficient', issues: ['gaps'] }),
      score(4.5, 10, 2500),
    ]
    expect(pickResonance(scores)).toEqual({ rate: 5.5, basis: 'amplitude', confidence: 'low' })
    // 量成了而且更低，峰就在 5.5
    scores[3] = score(5, 12.5, 4200)
    expect(pickResonance(scores)).toEqual({ rate: 5.5, basis: 'amplitude', confidence: 'high' })
  })

  it('does not trust a small standard error from only a few cycles', () => {
    // 一分钟一段：每段三四轮。5.5 自己算出的标准误很小，但各段合起来看，轮与轮之间的出入要大得多
    const short = (rate: number, amplitude: number, amplitudeSe: number, cycles: number) =>
      score(rate, amplitude, Number.NaN, { amplitudeSe, cycles })
    const scores = [
      short(6.5, 12.5, 0.5, 4),
      short(6, 13.3, 1, 4),
      short(5.5, 14.6, 0.3, 4),
      short(5, 16.3, 0.17, 3),
      short(4.5, 9.6, 1, 3),
    ]
    expect(pickResonance(scores)).toEqual({ rate: 5, basis: 'amplitude', confidence: 'low' })
  })

  it('needs three good trials for a confident answer', () => {
    const twoGood = [score(6, 12, 4000), score(5.5, 15, 5000), score(5, 9, 3000, { quality: 'noisy' })]
    expect(pickResonance(twoGood)).toEqual({ rate: 5.5, basis: 'amplitude', confidence: 'low' })
    const noisyOnly = [score(6, 12, 4000, { quality: 'noisy' }), score(5.5, 15, 5000, { quality: 'noisy' })]
    expect(pickResonance(noisyOnly)).toEqual({ rate: 5.5, basis: 'amplitude', confidence: 'low' })
  })

  it('returns null without enough data, unless there are comfort ratings', () => {
    const scores = [
      score(6, 12, 4000),
      score(5.5, Number.NaN, 5000),
      score(5, 15, 5000, { quality: 'insufficient' }),
    ]
    expect(pickResonance(scores)).toBeNull()
    expect(pickResonance([])).toBeNull()
    expect(pickResonance(scores, [{ rate: 5, comfort: 4, ease: 5 }])).toEqual({
      rate: 5,
      basis: 'comfort',
      confidence: 'low',
    })
  })

  it('finds the simulated resonance across seeds, never more than one step off', () => {
    const plan = planAssessment()
    const misses: string[] = []
    let n = 0
    let high = 0
    let highWrong = 0
    for (const resonance of [4.5, 5, 5.5, 6, 6.5]) {
      for (let seed = 1; seed <= 20; seed++) {
        const beats = simulate({ resonance, seed }, plan)
        const pick = pickResonance(plan.trials.map(t => scoreTrial(beats, t)))
        n++
        expect(pick).not.toBeNull()
        expect(Math.abs(pick!.rate - resonance)).toBeLessThanOrEqual(0.5)
        if (pick!.confidence === 'high') high++
        if (pick!.rate === resonance) continue
        misses.push(`${resonance}/${seed}→${pick!.rate} (${pick!.confidence})`)
        if (pick!.confidence === 'high') highWrong++
      }
    }
    // 两分钟一段的测定本身有误差：命中约 97%；标为有把握的结论没有错的
    expect(misses.length / n, misses.join(', ')).toBeLessThanOrEqual(0.1)
    expect(highWrong, misses.join(', ')).toBe(0)
    expect(high / n).toBeGreaterThan(0.4)
  }, 30000)

  it('stays accurate when the strap adds artifacts', () => {
    const plan = planAssessment()
    const misses: string[] = []
    let n = 0
    let highWrong = 0
    for (const resonance of [4.5, 5.5, 6.5]) {
      for (let seed = 1; seed <= 20; seed++) {
        // 每搏 3% 的伪迹：每段都有好几处，不少段因此被标为有瑕疵
        const beats = simulate({ resonance, seed, artifacts: 0.03 }, plan)
        const pick = pickResonance(plan.trials.map(t => scoreTrial(beats, t)))
        n++
        expect(Math.abs(pick!.rate - resonance)).toBeLessThanOrEqual(0.5)
        if (pick!.rate === resonance) continue
        misses.push(`${resonance}/${seed}→${pick!.rate} (${pick!.confidence})`)
        if (pick!.confidence === 'high') highWrong++
      }
    }
    expect(misses.length / n, misses.join(', ')).toBeLessThanOrEqual(0.1)
    expect(highWrong, misses.join(', ')).toBe(0)
  }, 30000)

  it('rarely claims confidence when the heart-rate oscillation is weak', () => {
    const plan = planAssessment()
    let n = 0
    let high = 0
    let highWrong = 0
    for (const resonance of [4.5, 5.5, 6.5]) {
      for (let seed = 1; seed <= 20; seed++) {
        // 起伏只有默认的三分之一多一点，相邻频率之间的差别接近测量误差
        const beats = simulate({ resonance, seed, rsa: 6 }, plan)
        const pick = pickResonance(plan.trials.map(t => scoreTrial(beats, t)))
        n++
        expect(Math.abs(pick!.rate - resonance)).toBeLessThanOrEqual(0.5)
        if (pick?.confidence !== 'high') continue
        high++
        if (pick.rate !== resonance) highWrong++
      }
    }
    expect(high / n).toBeLessThan(0.2)
    expect(highWrong).toBeLessThanOrEqual(1)
  }, 30000)
})

describe('demo flow', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('finds the resonance from a simulated strap streaming in real time through the beat tracker', () => {
    vi.useFakeTimers()
    const plan = planAssessment()
    for (const resonance of [4.5, 6]) {
      // 测定时钟：开始前先安静 30 秒，0 秒起按方案跟节拍
      let now = -30
      const sim = createSimulatedHeartRate({ resonance, seed: 11, now: () => now })
      sim.setBreathing(t => targetVolume(plan, t))
      const tracker = createBeatTracker()
      const off = sim.onReading(m => tracker.push(m, now))
      while (now < plan.duration + 1) {
        now += 1
        vi.advanceTimersByTime(1000)
      }
      off()
      const scores = plan.trials.map(t => scoreTrial(tracker.beats(), t))
      expect(scores.every(s => s.quality === 'good')).toBe(true)
      expect(pickResonance(scores)?.rate).toBe(resonance)
    }
  })

  it('runs the pace finder step by step, each on its own clock, with pauses to rate ease', () => {
    vi.useFakeTimers()
    const plan = planAssessment(PACE_FINDER_ASSESSMENT)
    const LEAD = 5
    let wall = 0
    // 正在练的一档：t0 为倒数之后节拍开始的时刻（墙上时钟）；打分时为 null
    let step: { trial: AssessmentTrial; t0: number; tracker: BeatTracker } | null = null
    const sim = createSimulatedHeartRate({ resonance: 5, seed: 4, artifacts: 0, now: () => wall })
    sim.setBreathing(t => (step && t >= step.t0 ? patternAt(step.trial.pattern, t - step.t0).y : null))
    // 每一档各用一个心搏记录，时刻为 trial.start 加上这一档自己的计时，倒数时为负
    sim.onReading(m => {
      if (step) step.tracker.push(m, step.trial.start + (wall - step.t0))
    })
    const wait = (sec: number) => {
      for (let i = 0; i < sec; i++) {
        wall += 1
        vi.advanceTimersByTime(1000)
      }
    }
    wait(30)
    const ease = [3, 4, 4, 5, 3]
    const ratings: ComfortRating[] = []
    const scores: TrialScore[] = []
    for (const trial of plan.trials) {
      step = { trial, t0: wall + LEAD, tracker: createBeatTracker() }
      wait(LEAD + Math.ceil(trial.end - trial.start))
      scores.push(scoreTrial(step.tracker.beats(), trial))
      step = null
      // 打分用的时间长短不一，计时不受影响
      wait(6 + 5 * trial.index)
      ratings.push({ rate: trial.rate, ease: ease[trial.index] })
    }
    expect(pickByComfort(ratings)).toBe(5)
    expect(scores.map(s => s.quality)).toEqual(['good', 'good', 'good', 'good', 'good'])
    for (const s of scores) expect(s.lfPeakHz * 60).toBeCloseTo(s.rate, 0)
    // 心率带只作参考：一档一分钟，结论可能差一档
    expect(Math.abs(pickResonance(scores)!.rate - 5)).toBeLessThanOrEqual(0.5)
  })
})

describe('picking by comfort', () => {
  it('takes the highest comfort plus ease', () => {
    expect(
      pickByComfort([
        { rate: 6.5, comfort: 3, ease: 4 },
        { rate: 6, comfort: 4, ease: 5 },
        { rate: 5.5, comfort: 4, ease: 4 },
        { rate: 5, comfort: 2, ease: 2 },
      ]),
    ).toBe(6)
  })

  it('breaks ties toward 5.5, then toward the faster rate', () => {
    expect(
      pickByComfort([
        { rate: 6.5, comfort: 4, ease: 4 },
        { rate: 5, comfort: 4, ease: 4 },
        { rate: 4.5, comfort: 4, ease: 4 },
      ]),
    ).toBe(5)
    expect(
      pickByComfort([
        { rate: 5, comfort: 5, ease: 3 },
        { rate: 6, comfort: 4, ease: 4 },
      ]),
    ).toBe(6)
  })

  it('works when only ease is asked', () => {
    expect(
      pickByComfort([
        { rate: 6.5, ease: 3 },
        { rate: 6, ease: 4 },
        { rate: 5.5, ease: 4 },
        { rate: 5, ease: 5 },
        { rate: 4.5, ease: 2 },
      ]),
    ).toBe(5)
    // 两项都评与只评一项的，按同一把尺子比
    expect(
      pickByComfort([
        { rate: 6, ease: 4 },
        { rate: 5, comfort: 5, ease: 2 },
      ]),
    ).toBe(6)
  })

  it('picks the easiest step from ease ratings alone, as the pace finder asks', () => {
    const pick = (...ease: number[]) =>
      pickByComfort(PACE_FINDER_ASSESSMENT.rates.map((rate, i) => ({ rate, ease: ease[i] })))
    expect(pick(3, 4, 5, 4, 2)).toBe(5.5)
    expect(pick(2, 3, 3, 4, 5)).toBe(4.5)
    // 平分时取最接近 5.5 的
    expect(pick(2, 2, 2, 4, 4)).toBe(5)
    expect(pick(3, 3, 3, 3, 3)).toBe(5.5)
    // 一样接近时取较快的：5 与 6 都差 0.5，6.5 与 4.5 都差 1
    expect(pick(5, 5, 4, 5, 5)).toBe(6)
    expect(pick(4, 3, 3, 3, 4)).toBe(6.5)
  })

  it('leaves out steps that were not rated', () => {
    // 5.5 那一档觉得憋闷，提前停下，没有打分
    const ratings: ComfortRating[] = [
      { rate: 6.5, ease: 3 },
      { rate: 6, ease: 4 },
      { rate: 5.5 },
      { rate: 5, ease: 4 },
      { rate: 4.5, ease: 2 },
    ]
    expect(pickByComfort(ratings)).toBe(6)
    expect(pickByComfort(ratings.slice(2, 3))).toBeNull()
    // 没连心率带时，测定的结论只能按轻松度
    expect(pickResonance([], ratings)).toEqual({ rate: 6, basis: 'comfort', confidence: 'low' })
  })

  it('does not let rounding in an average decide a tie', () => {
    // 1.1 与 1.3 的平均算出来是 1.2000000000000002，与 1.2 算同分，再取最接近 5.5 的
    expect(
      pickByComfort([
        { rate: 6, comfort: 1.1, ease: 1.3 },
        { rate: 5.5, ease: 1.2 },
      ]),
    ).toBe(5.5)
  })

  it('averages repeated ratings, clamps the scale and skips entries without a rating', () => {
    expect(
      pickByComfort([
        { rate: 6, comfort: 5, ease: 5 },
        { rate: 6, comfort: 1, ease: 1 },
        { rate: 5.5, comfort: 4, ease: 4 },
        { rate: 5, comfort: 99, ease: 99 },
        { rate: Number.NaN, comfort: 5, ease: 5 },
        { rate: 4.5, comfort: Number.NaN, ease: Number.NaN },
        { rate: 4 },
      ]),
    ).toBe(5)
    expect(pickByComfort([])).toBeNull()
    expect(pickByComfort([{ rate: 5 }])).toBeNull()
  })
})
