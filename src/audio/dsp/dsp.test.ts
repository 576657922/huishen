import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/lib/random'
import {
  ASSET_LUFS,
  ASSET_RMS,
  BELL,
  BIRDS,
  GLIDE,
  LOOP_RATE,
  ONESHOT_LUFS,
  PENTATONIC_NOTES,
  QA,
  RAIN,
  REVERB,
  WIND,
} from '../params'
import {
  bandEnergyDb,
  clickScore,
  dcOffset,
  estimatePitch,
  integratedLoudness,
  kWeightCoefs,
  loudnessRange,
  rmsDb,
  seamJump,
  spectralCentroid,
} from './analysis'
import {
  type AssetName,
  BIRD_ASSETS,
  CUE_ASSETS,
  DROP_ASSETS,
  isAssetName,
  LOOP_NAMES,
  MUSIC_ASSETS,
  playedMomentaryMax,
  renderAsset,
} from './assets'
import { biquad, biquadCoefs } from './filters'
import { hash01, smoothNoise, valueNoise } from './noise'
import { runSliced, runSync } from './task'
import { type Channels, gainToDb, loopify, midiToHz } from './util'
import { gustAt } from './wind'

const cache = new Map<string, Channels>()
const render = (name: AssetName, sr = LOOP_RATE): Channels => {
  const key = `${name}@${sr}`
  let chs = cache.get(key)
  if (!chs) {
    chs = runSync(renderAsset(name, sr))
    cache.set(key, chs)
  }
  return chs
}

function checksum(chs: Channels): number {
  let h = 0
  for (const a of chs) for (let i = 0; i < a.length; i += 7) h = (h * 31 + Math.round(a[i]! * 1e6)) | 0
  return h
}

const finite = (chs: Channels) => chs.every(a => a.every(Number.isFinite))

const sine = (sr: number, f: number, sec: number, amp = 1) =>
  Float32Array.from({ length: Math.round(sr * sec) }, (_, i) => amp * Math.sin((2 * Math.PI * f * i) / sr))

describe('filters and noise', () => {
  it('lowpass has unity gain at DC and bandpass peaks at 0 dB', () => {
    const lp = biquadCoefs('lowpass', 1000, 0.7, 48000)
    expect((lp.b0 + lp.b1 + lp.b2) / (1 + lp.a1 + lp.a2)).toBeCloseTo(1, 6)
    const bp = biquad('bandpass', 1000, 1, 48000)
    const x = sine(48000, 1000, 1)
    const y = x.map(v => bp(v))
    expect(rmsDb([y], 24000)).toBeCloseTo(rmsDb([x], 24000), 1)
  })

  it('value noise stays in [0, 1) and is reproducible', () => {
    const a = valueNoise(mulberry32(3), 5000, 1000, 2)
    const b = valueNoise(mulberry32(3), 5000, 1000, 2)
    expect(a).toEqual(b)
    expect(Math.min(...a)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...a)).toBeLessThan(1)
  })

  it('stateless noise is continuous and deterministic', () => {
    expect(hash01(5, 17)).toBe(hash01(5, 17))
    expect(hash01(5, 17)).not.toBe(hash01(6, 17))
    let jump = 0
    for (let t = 0; t < 60; t += 0.01)
      jump = Math.max(jump, Math.abs(smoothNoise(9, t + 0.01, 0.15) - smoothNoise(9, t, 0.15)))
    expect(jump).toBeLessThan(0.01)
    const g = Array.from({ length: 600 }, (_, i) => gustAt(i * 0.5, WIND.gust))
    expect(Math.min(...g)).toBeGreaterThan(0)
    expect(Math.max(...g)).toBeLessThan(1)
    expect(Math.max(...g) - Math.min(...g)).toBeGreaterThan(0.4)
  })

  it('equal-power loop crossfade keeps the seam continuous', () => {
    const rng = mulberry32(1)
    const raw = [Float32Array.from({ length: 1200 }, () => rng() * 2 - 1)]
    const [o] = loopify(raw, 1000, 200)
    // 末尾接回开头，正好是原素材里相邻的两个采样
    expect(o![999]).toBe(raw[0]![999])
    expect(o![0]).toBeCloseTo(raw[0]![1000]!, 6)
  })
})

describe('sliced generation', () => {
  it('gives the same result as running to completion', async () => {
    const a = runSync(renderAsset('cue:in', LOOP_RATE))
    const b = await runSliced(renderAsset('cue:in', LOOP_RATE), 2)
    expect(checksum(b)).toBe(checksum(a))
  })
})

describe('assets', () => {
  it('validates asset names', () => {
    expect(isAssetName('flow')).toBe(true)
    expect(isAssetName('pluck:62')).toBe(true)
    expect(isAssetName('cue:ninth')).toBe(true)
    expect(isAssetName('bird:0')).toBe(true)
    expect(isAssetName(`bird:${BIRDS.songs.length}`)).toBe(false)
    expect(isAssetName('drop:1')).toBe(true)
    expect(isAssetName('cue:nope')).toBe(false)
    expect(isAssetName('pluck:abc')).toBe(false)
    expect(isAssetName('../etc')).toBe(false)
  })

  it.each(LOOP_NAMES)('%s is deterministic, finite, on level and seamless', name => {
    const chs = render(name)
    expect(chs).toHaveLength(2)
    expect(finite(chs)).toBe(true)
    expect(checksum(runSync(renderAsset(name, LOOP_RATE)))).toBe(checksum(chs))
    // 循环素材按综合响度归一：层内的配比因此直接是 LU 差
    expect(integratedLoudness(chs, LOOP_RATE)).toBeCloseTo(ASSET_LUFS, 1)
    expect(dcOffset(chs)).toBeLessThan(QA.maxDc)
    const q = Math.round(0.25 * LOOP_RATE)
    for (const a of chs) {
      expect(seamJump(a)).toBeLessThan(QA.maxSeam)
      // 把结尾和开头接起来测咔哒声
      const joined = new Float32Array(2 * q)
      joined.set(a.subarray(a.length - q))
      joined.set(a.subarray(0, q), q)
      expect(clickScore([joined], LOOP_RATE)).toBeLessThan(QA.maxClick)
      // 连续的声音（水体、雨幕、风）在接缝两侧的电平变化，不应大于素材内部任意位置的正常起伏；
      // 水泡、雨滴是稀疏事件，本来就忽有忽无，按构造首尾相接，不做这项比较
      if (name === 'bubbles' || name === 'rainDrops') continue
      const step = (p: number) => Math.abs(rmsDb([a], p, p + q) - rmsDb([a], p - q, p))
      const seam = Math.abs(rmsDb([a], 0, q) - rmsDb([a], a.length - q, a.length))
      const rng = mulberry32(5)
      const inner = Array.from({ length: 300 }, () => step(q + Math.floor(rng() * (a.length - 3 * q))))
      inner.sort((x, y) => x - y)
      expect(seam).toBeLessThanOrEqual(Math.max(1.5, inner[Math.floor(inner.length * 0.98)]!))
    }
  })

  it.each([...CUE_ASSETS, ...BIRD_ASSETS, ...DROP_ASSETS])(
    '%s is loudness-normalized, finite and click-free',
    name => {
      const chs = render(name)
      expect(finite(chs)).toBe(true)
      // 单次音按播放时的瞬时响度最大值归一，电平在 params.LEVELS 里按 LU 统一给
      expect(runSync(playedMomentaryMax(chs, LOOP_RATE))).toBeCloseTo(ONESHOT_LUFS, 1)
      expect(clickScore(chs, LOOP_RATE)).toBeLessThan(QA.maxClick)
      expect(dcOffset(chs)).toBeLessThan(QA.maxDc)
      // 结尾已经淡出到静默，截断不会咔哒
      for (const a of chs) expect(Math.abs(a[a.length - 1]!)).toBeLessThan(1e-3)
    },
  )

  it('the bowl has a soft mallet, a long decay and no harsh highs', () => {
    const chs = render('bell')
    const [l] = chs
    const sr = LOOP_RATE
    const tenMs = Math.round(0.01 * sr)
    // 软槌：起音的 10 ms 内不会立刻到峰值附近
    expect(rmsDb([l!], 0, tenMs)).toBeLessThan(rmsDb([l!], tenMs * 5, tenMs * 15))
    expect(spectralCentroid(chs, sr)).toBeLessThan(1200)
    // 4 kHz 以上的分音压低：比 200–800 Hz 低 30 dB 以上
    expect(bandEnergyDb(chs, sr, 4000, sr / 2) - bandEnergyDb(chs, sr, 200, 800)).toBeLessThan(-30)
    // 基音的 T60 在 6–12 秒：6 秒处还在，比开头低 20–45 dB
    const at = (t: number) => rmsDb([l!], Math.round(t * sr), Math.round((t + 0.5) * sr))
    const drop = at(0.2) - at(6)
    expect(drop).toBeGreaterThan(20)
    expect(drop).toBeLessThan(45)
    expect(BELL.f0).toBeGreaterThanOrEqual(180)
    expect(BELL.f0).toBeLessThanOrEqual(440)
  })

  it('the new-line cue is soft, short and warm, unlike the section chime', () => {
    const sr = LOOP_RATE
    const caption = render('cue:caption')
    const chime = render('cue:section')
    const [c] = caption
    const tenMs = Math.round(0.01 * sr)
    // 软起音：头 10 ms 远比 30–50 ms 处轻（段落小钟 3 ms 就到峰值附近）
    expect(rmsDb([c!], 0, tenMs) - rmsDb([c!], 3 * tenMs, 5 * tenMs)).toBeLessThan(-6)
    // 短：整段不到 2 秒，半秒以后已经轻了 20 dB 以上；段落小钟 5 秒以后还在响
    expect(c!.length / sr).toBeLessThan(2)
    expect(rmsDb([c!], Math.round(0.6 * sr), Math.round(0.8 * sr))).toBeLessThan(
      rmsDb([c!], Math.round(0.04 * sr), Math.round(0.24 * sr)) - 20,
    )
    expect(chime[0]!.length / sr).toBeGreaterThan(5)
    // 温暖：F♯4 上（在滑音的音域 A3–E4 之上），谐波很弱，比段落小钟（D5 和它的高分音）暗
    const pitch = estimatePitch(c!, sr, 100, 1000, Math.round(0.04 * sr), 2048)
    expect(Math.abs(pitch - 369.99)).toBeLessThan(4)
    expect(pitch).toBeGreaterThan(GLIDE.f0 * GLIDE.ratio)
    expect(spectralCentroid(caption, sr)).toBeLessThan(500)
    expect(spectralCentroid(caption, sr)).toBeLessThan(spectralCentroid(chime, sr) * 0.75)
    expect(bandEnergyDb(caption, sr, 1500, sr / 2) - bandEnergyDb(caption, sr, 200, 800)).toBeLessThan(-30)
  })

  it('bird songs stay in 2–6 kHz and last 0.5–2 s', () => {
    for (const [i, song] of BIRDS.songs.entries()) {
      const chs = render(`bird:${i}`)
      const sr = LOOP_RATE
      const secs = chs[0]!.length / sr
      expect(secs).toBeGreaterThan(0.45)
      expect(secs).toBeLessThan(2.1)
      for (const n of song) {
        for (const f of [n.f0, n.f1]) {
          expect(f).toBeGreaterThanOrEqual(2000)
          expect(f).toBeLessThanOrEqual(6000)
        }
      }
      // 能量集中在 2–6 kHz
      const inBand = bandEnergyDb(chs, sr, 1800, 6500)
      expect(bandEnergyDb(chs, sr, 0, 1800)).toBeLessThan(inBand - 20)
      expect(bandEnergyDb(chs, sr, 6500, sr / 2)).toBeLessThan(inBand - 15)
    }
  })

  it('rain drops are dense, short grains between 1 and 5 kHz', () => {
    const chs = render('rainDrops')
    const sr = LOOP_RATE
    expect(RAIN.drops.minRate).toBeGreaterThanOrEqual(80)
    expect(RAIN.drops.maxRate).toBeLessThanOrEqual(400)
    const mid = bandEnergyDb(chs, sr, 1000, 5000)
    expect(bandEnergyDb(chs, sr, 0, 500)).toBeLessThan(mid - 15)
  })
})

describe('sliced generation keeps the main thread free', () => {
  // 主线程后备路径按片执行：每一步都必须很短，才能保证任何一片不超过 50 ms
  it('no single step of any asset takes more than 50 ms', () => {
    const names: AssetName[] = [...LOOP_NAMES, 'bell', 'cue:section', 'pluck:50', 'ep:50', 'bird:1', 'drop:0']
    for (const name of names) {
      // 先跑一遍让 JIT 热起来，再计时
      runSync(renderAsset(name, LOOP_RATE))
      const task = renderAsset(name, LOOP_RATE)
      let worst = 0
      for (;;) {
        const t0 = performance.now()
        const r = task.next()
        worst = Math.max(worst, performance.now() - t0)
        if (r.done) break
      }
      expect(worst, name).toBeLessThan(50)
    }
    // 混响按设备的采样率给：48 kHz 直接生成，其他采样率还要重采样，两条路都要分得够细
    for (const sr of [48000, 44100]) {
      const ir = renderAsset('ir', sr)
      let worst = 0
      for (;;) {
        const t0 = performance.now()
        const r = ir.next()
        worst = Math.max(worst, performance.now() - t0)
        if (r.done) break
      }
      expect(worst, `ir @ ${sr}`).toBeLessThan(50)
    }
  }, 60_000)
})

describe('Karplus–Strong plucks', () => {
  it.each(PENTATONIC_NOTES)('midi %i is in tune within 1%', midi => {
    const [a] = render(`pluck:${midi}`)
    const f = midiToHz(midi)
    const est = estimatePitch(a!, LOOP_RATE, f * 0.7, f * 1.4, Math.round(0.05 * LOOP_RATE))
    expect(Math.abs(est / f - 1)).toBeLessThan(0.01)
  })

  it('decays and is normalized by its opening second', () => {
    const [a] = render('pluck:57')
    const sr = LOOP_RATE
    expect(rmsDb([a!], 0, sr)).toBeCloseTo(gainToDb(ASSET_RMS), 0)
    expect(rmsDb([a!], 3 * sr, 4 * sr)).toBeLessThan(rmsDb([a!], 0, sr) - 15)
    expect(dcOffset([a!])).toBeLessThan(QA.maxDc)
    expect(clickScore([a!], sr)).toBeLessThan(QA.maxClick)
  })

  it('electric-piano tones are finite, in tune and quiet at the end', () => {
    for (const name of MUSIC_ASSETS.phasing.filter(n => n !== 'ir')) {
      const [a] = render(name)
      const midi = Number(name.split(':')[1])
      const f = midiToHz(midi)
      expect(finite([a!])).toBe(true)
      const est = estimatePitch(a!, LOOP_RATE, f * 0.7, f * 1.4, Math.round(0.3 * LOOP_RATE))
      expect(Math.abs(est / f - 1), name).toBeLessThan(0.01)
      expect(Math.abs(a![a!.length - 1]!)).toBeLessThan(1e-3)
    }
  })
})

describe('reverb impulse response', () => {
  it.each([44100, 48000, 96000])('honours the %i Hz sample rate', sr => {
    const chs = render('ir', sr)
    expect(chs).toHaveLength(2)
    for (const a of chs) {
      expect(a.length).toBe(Math.floor(REVERB.seconds * sr))
      expect(finite([a])).toBe(true)
      // 在生成的采样率上按能量归一：卷积后湿声与输入的宽带电平相当。其他采样率是它重采样来的，
      // 保持的是频响（resample.test.ts 逐个频率比），能量随采样率和截掉的超声部分变
      if (sr === REVERB.rate) expect(a.reduce((s, v) => s + v * v, 0)).toBeCloseTo(1, 3)
      const q = Math.floor(a.length / 10)
      expect(rmsDb([a], a.length - q) - rmsDb([a], 0, q)).toBeLessThan(-40)
    }
    // 两个声道不相关，混响才有宽度
    const [l, r] = chs
    let c = 0
    for (let i = 0; i < l!.length; i++) c += l![i]! * r![i]!
    expect(Math.abs(c)).toBeLessThan(0.2)
  })
})

describe('analysis', () => {
  it('K-weighting matches the BS.1770 coefficients at 48 kHz', () => {
    const [shelf, hp] = kWeightCoefs(48000)
    expect(shelf.b0).toBeCloseTo(1.53512485958697, 8)
    expect(shelf.b1).toBeCloseTo(-2.69169618940638, 8)
    expect(shelf.b2).toBeCloseTo(1.19839281085285, 8)
    expect(shelf.a1).toBeCloseTo(-1.69065929318241, 8)
    expect(shelf.a2).toBeCloseTo(0.73248077421585, 8)
    expect(hp.a1).toBeCloseTo(-1.99004745483398, 8)
    expect(hp.a2).toBeCloseTo(0.99007225036621, 8)
  })

  it('a full-scale 1 kHz sine in both channels reads about 0 LUFS', () => {
    const x = sine(48000, 1000, 5)
    expect(integratedLoudness([x, x], 48000)).toBeCloseTo(0, 0)
    expect(rmsDb([x])).toBeCloseTo(-3.01, 1)
    expect(loudnessRange([x, x], 48000)).toBeLessThan(0.1)
  })

  it('loudness range sees a 6 dB step', () => {
    const sr = 48000
    const x = sine(sr, 500, 20, 0.1)
    for (let i = 10 * sr; i < x.length; i++) x[i] = x[i]! * 2
    const lra = loudnessRange([x], sr)
    expect(lra).toBeGreaterThan(5)
    expect(lra).toBeLessThan(7)
  })

  it('click score flags a discontinuity but not smooth or noisy signals', () => {
    const sr = 48000
    const x = sine(sr, 220, 1, 0.3)
    expect(clickScore([x], sr)).toBeLessThan(3)
    const rng = mulberry32(2)
    const lp = biquad('lowpass', 2000, 0.7, sr)
    const n = Float32Array.from({ length: sr * 2 }, () => lp(rng() * 2 - 1))
    expect(clickScore([n], sr)).toBeLessThan(QA.maxClick)
    const broken = x.slice()
    for (let i = sr / 2; i < broken.length; i++) broken[i] = broken[i]! + 0.05
    expect(clickScore([broken], sr)).toBeGreaterThan(QA.maxClick * 2)
  })

  it('estimates pitch and centroid', () => {
    expect(estimatePitch(sine(32000, 293.66, 0.5), 32000, 150, 600)).toBeCloseTo(293.66, 0)
    expect(spectralCentroid([sine(48000, 1000, 1)], 48000)).toBeCloseTo(1000, -1)
  })
})
