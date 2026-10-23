/**
 * 三种音乐共用的后级：
 *   音符 → 低通（跟随节拍时随吸呼变亮变暗，不跟节拍时极慢地游移）→ 干声 + 卷积混响
 *   → 呼吸起伏（吸满时 +0.6 dB、呼空时 −0.6 dB）→ 宏观起伏（±1.2 dB 的慢速随机游走，跟随节拍时收起）→ 休止 → 输出
 * 「五声」「回响」底下还有一层很轻的持续音（pad）：它过自己的低通（700 Hz → 1.6 kHz 随吸呼），
 * 按自己的干湿比（混响很少）直接进呼吸起伏这一级，不走音符的低通和干湿比。
 * 拨弦、电钢琴是稀疏的单音，只有持续音能让呼吸带来的明暗一直听得见，音与音之间也不会掉进静默。
 * 研究建议放松用的音乐响度平稳、没有渐强：起伏主要靠亮度，电平只动一两 dB，而且都很慢。
 */
import type { Segment } from '@/engine/types'
import { clamp, easeInOut } from '@/lib/math'
import { createTrack, expMap, followBreath, type Track } from '../automation'
import { smoothNoise } from '../dsp/noise'
import { dbToGain } from '../dsp/util'
import { biquadNode, gainNode } from '../graph'
import { MUSIC, type ToneSpec } from '../params'
import { endRests, NO_RESTS, type RestPlan, restDensity, restEnd } from '../rests'
import type { LayerCore, LayerOptions } from './core'

export interface MusicChain {
  /** 音符接到这里 */
  readonly input: AudioNode
  /** 持续音接到这里（创建时给了 padTone 才有） */
  readonly padInput: AudioNode | null
  /** t 时刻音乐的密度（休止时降到 0）：音符层按它决定这个音还出不出 */
  density(t: number): number
  breath(seg: Segment, at: number): void
  freeRun(now: number, until: number): void
  level(y: number, at: number): void
  hold(at: number): void
  /** 把宏观起伏和休止排到 until */
  schedule(until: number): void
}

/** 自由游移时每隔多少秒取一个点：游移本身 30 秒以上一个来回，半秒足够平滑 */
const DRIFT_STEP = 0.5
/** 休止的曲线每隔多少秒取一个点 */
const REST_STEP = 0.25

/** 宏观起伏（dB）：几层很慢的值噪声加权平均，映射到 ±macroDb */
function macroDb(seed: number, t: number): number {
  let s = 0
  MUSIC.macroRates.forEach((rate, i) => {
    s += 2 * smoothNoise(seed + i * 977, t, rate) - 1
  })
  return (MUSIC.macroDb * s) / MUSIC.macroRates.length
}

/** 一个跟随呼吸、不跟节拍时慢慢游移的低通 */
interface Brightness {
  readonly track: Track
  readonly cutOf: (y: number) => number
  driftAt(t: number): number
}

function brightness(filter: BiquadFilterNode, spec: ToneSpec, seed: number, t0: number): Brightness {
  return {
    track: createTrack(filter.frequency, spec.filterIdle, t0),
    cutOf: y => expMap(spec.filterLo, spec.filterHi, y),
    driftAt: t => expMap(spec.driftLo, spec.driftHi, smoothNoise(seed, t, spec.driftRate)),
  }
}

export function createMusicChain(
  core: LayerCore,
  ir: AudioBuffer,
  spec: ToneSpec,
  opts: LayerOptions,
  padTone?: ToneSpec,
): MusicChain {
  const { ctx } = core
  const t0 = ctx.currentTime
  const swellDb = spec.swellDb ?? MUSIC.swellDb
  const swellOf = (y: number): number => dbToGain(swellDb * (y - 0.5))
  const filter = core.keep(biquadNode(ctx, 'lowpass', spec.filterIdle, spec.filterQ))
  const dry = core.keep(gainNode(ctx, spec.dry))
  const wet = core.keep(gainNode(ctx, spec.wet))
  const conv = core.keep(ctx.createConvolver())
  const swell = core.keep(gainNode(ctx, 1))
  const macro = core.keep(gainNode(ctx, 1))
  const rest = core.keep(gainNode(ctx, 1))
  // 冲激响应已按能量归一；关掉浏览器自带的归一，湿声电平才与参数一致
  conv.normalize = false
  conv.buffer = ir
  filter.connect(dry).connect(swell)
  filter.connect(conv).connect(wet).connect(swell)
  swell.connect(macro).connect(rest).connect(core.out)

  const seed = Math.floor(opts.rng() * 1e6)
  const tones: Brightness[] = [brightness(filter, spec, seed, t0)]
  let padInput: BiquadFilterNode | null = null
  if (padTone) {
    // 持续音自己的干湿声，不走音符的那一路：长混响的频响在细处起伏很大，持续的纯音落在哪个峰谷上，
    // 湿声就差好几 dB，揉音再让音高来回扫过这些峰谷，短期响度跟着慢慢起伏（湿声 0.85 时约 1.5 LU）
    padInput = core.keep(biquadNode(ctx, 'lowpass', padTone.filterIdle, padTone.filterQ))
    padInput.connect(core.keep(gainNode(ctx, padTone.dry))).connect(swell)
    padInput.connect(core.keep(gainNode(ctx, padTone.wet))).connect(conv)
    tones.push(brightness(padInput, padTone, seed + 1, t0))
  }
  const cuts = tones.map(b => b.track)
  const swellTrack = createTrack(swell.gain, 1, t0)
  // 宏观起伏从曲线上当时的值开始，开头不会有一个跳变
  const macroTrack = createTrack(macro.gain, dbToGain(macroDb(seed, t0)), t0)
  const restTrack = createTrack(rest.gain, 1, t0)
  let rests = opts.rests ?? NO_RESTS
  let mode: 'idle' | 'paced' | 'free' = 'idle'
  let freeAt = 0
  let macroAt = t0
  let restAfter = t0 - 1
  /** 开始跟随节拍的时刻；还没跟随为 null */
  let pacedAt: number | null = null

  /**
   * 跟随节拍时，起伏交给呼吸：宏观起伏在 macroFade 秒里缓缓收到 0。两种起伏各自都不大，
   * 但碰巧叠在一起时（箱式呼吸屏息在吸满处、只有一层音乐、再加滑音），30 秒内的短期响度会超过 3 LU
   */
  const macroScale = (t: number): number =>
    pacedAt === null ? 1 : 1 - easeInOut(clamp((t - pacedAt) / MUSIC.macroFade, 0, 1))

  function forget(now: number): void {
    for (const t of [...cuts, swellTrack, macroTrack, restTrack]) t.forget(now - 1)
  }

  /**
   * 开始跟随节拍：不再休止。仅背景提示（bed）时，音乐随呼吸的起伏就是唯一的节拍提示，休止会让它整段静下来半分钟；
   * 其他提示方式下它也是节拍的一部分。已经排下、还没开始的休止撤掉；正在休止中的，从当前位置按休止回来的速度缓缓回来
   */
  function stopResting(at: number): void {
    rests = endRests(rests, at)
    restTrack.cancelFrom(at)
    if (restTrack.valueAt(at) < 1) restTrack.glide(1, at, at + MUSIC.rest.back, easeInOut, 8)
  }

  function scheduleRest(plan: RestPlan, until: number): void {
    for (let r = plan.next(restAfter); r && r.at < until; r = plan.next(restAfter)) {
      restAfter = r.at
      const end = restEnd(r)
      restTrack.cancelFrom(r.at)
      for (let t = r.at + REST_STEP; t < end + REST_STEP; t += REST_STEP) {
        const tt = Math.min(t, end)
        restTrack.rampTo(restDensity(r, tt), tt)
      }
    }
  }

  return {
    input: filter,
    padInput,
    density: t => rests.density(t),
    breath(seg, at) {
      const now = ctx.currentTime
      if (mode === 'free') for (const c of cuts) c.cancelFrom(Math.max(at, now))
      mode = 'paced'
      if (pacedAt === null) {
        // 已经排到前面的宏观起伏作废，从此刻起按收起的曲线重排（下一次 schedule 接上，曲线连续）
        pacedAt = now
        macroTrack.cancelFrom(now)
        macroAt = now
        stopResting(now)
      }
      followBreath(seg, at, now, opts.breathStep, [
        ...tones.map(b => [b.track, b.cutOf] as const),
        [swellTrack, swellOf],
      ])
      forget(now)
    },
    freeRun(now, until) {
      if (mode === 'paced') return
      if (mode === 'idle') {
        // 从静止的亮度平滑过渡到游移曲线上
        freeAt = now
        for (const c of cuts) c.cancelFrom(now)
      }
      mode = 'free'
      for (freeAt = Math.max(freeAt, now); freeAt < until; ) {
        freeAt += DRIFT_STEP
        for (const b of tones) b.track.rampTo(b.driftAt(freeAt), freeAt)
      }
      forget(now)
    },
    level(y, at) {
      for (const b of tones) b.track.set(b.cutOf(y), at)
      swellTrack.set(swellOf(y), at)
    },
    hold(at) {
      for (const c of cuts) c.cancelFrom(at)
      swellTrack.cancelFrom(at)
      // 不跟节拍时，游移从停住的地方接着走
      if (mode === 'free') freeAt = at
    },
    schedule(until) {
      const now = ctx.currentTime
      for (macroAt = Math.max(macroAt, now); macroAt < until; ) {
        macroAt += MUSIC.macroStep
        macroTrack.rampTo(dbToGain(macroDb(seed, macroAt) * macroScale(macroAt)), macroAt)
      }
      scheduleRest(rests, until)
      forget(now)
    },
  }
}
