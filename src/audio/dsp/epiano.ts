/**
 * 柔和的调频电钢琴音（「回响」的声部用）：1:1 调制的温暖音体，调制指数随时间衰减，起音明亮、尾音近乎正弦；
 * 一层很轻的 1:14「音叉」声只在起音的几十毫秒里出现；另一个略微失谐的载波带来缓慢的拍。
 */
import { mulberry32 } from '@/lib/random'
import type { Task } from './task'
import { due, fadeEdges } from './util'

export interface EpParams {
  seconds: number
  seed: number
  index: number
  indexTau: number
  indexFloor: number
  tineRatio: number
  tineIndex: number
  tineTau: number
  tineLevel: number
  tineDecay: number
  attack: number
  fastShare: number
  fastTau: number
  slowTau: number
  chorusHz: number
  chorusLevel: number
  release: number
}

export function* fmTone(sr: number, freq: number, p: EpParams): Task<Float32Array> {
  const n = Math.floor(p.seconds * sr)
  const a = new Float32Array(n)
  const rng = mulberry32(p.seed + Math.round(freq * 10))
  const tau = 2 * Math.PI
  const w = (tau * freq) / sr
  const wc2 = (tau * (freq + p.chorusHz)) / sr
  // 高音衰减得快一些，像真的琴
  const slow = p.slowTau * (220 / freq) ** 0.3
  let phc = 0
  let phc2 = rng() * tau
  let phm = rng() * tau
  let pht = 0
  let phtm = 0
  for (let i = 0; i < n; i++) {
    const t = i / sr
    const atk = Math.min(1, t / p.attack)
    const index = p.indexFloor + p.index * Math.exp(-t / p.indexTau)
    const mod = index * Math.sin(phm)
    const body = Math.sin(phc + mod) + p.chorusLevel * Math.sin(phc2 + mod)
    const env = atk * (p.fastShare * Math.exp(-t / p.fastTau) + (1 - p.fastShare) * Math.exp(-t / slow))
    const tine = Math.sin(pht + p.tineIndex * Math.exp(-t / p.tineTau) * Math.sin(phtm))
    a[i] = env * body + atk * p.tineLevel * Math.exp(-t / p.tineDecay) * tine
    phc += w
    phc2 += wc2
    phm += w
    pht += w
    phtm += w * p.tineRatio
    if (due(i)) yield
  }
  return fadeEdges(a, sr, 0, p.release)
}
