import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/lib/random'
import { segment } from '../automation'
import { DRONE, MUSIC, TIMING } from '../params'
import { planRests, type RestPlan } from '../rests'
import { createCore } from './core'
import { createMusicChain, type MusicChain } from './music'

/** 只记下排过的自动化点（撤销会删掉后面的），够看出增益曲线有没有掉下去 */
class FakeParam {
  events: [number, number][] = []
  value: number
  constructor(value: number) {
    this.value = value
  }
  setValueAtTime(v: number, t: number): this {
    this.events.push([t, v])
    return this
  }
  linearRampToValueAtTime(v: number, t: number): this {
    this.events.push([t, v])
    return this
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    this.events.push([t, v])
    return this
  }
  cancelScheduledValues(t: number): this {
    this.events = this.events.filter(([at]) => at < t)
    return this
  }
}

class FakeNode {
  to: FakeNode | null = null
  gain = new FakeParam(1)
  frequency = new FakeParam(350)
  Q = new FakeParam(1)
  type = ''
  normalize = true
  buffer: unknown = null
  connect<T extends FakeNode>(dest: T): T {
    this.to = dest
    return dest
  }
  disconnect(): void {
    this.to = null
  }
}

function fakeContext() {
  const nodes: FakeNode[] = []
  const make = (): FakeNode => {
    const n = new FakeNode()
    nodes.push(n)
    return n
  }
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    createGain: make,
    createBiquadFilter: make,
    createConvolver: make,
  }
  return { ctx, nodes }
}

/** 一条音乐链路（长音的音色），休止按 900 秒的练习安排 */
function setup(seed: number): {
  ctx: { currentTime: number }
  chain: MusicChain
  rest: FakeParam
  plan: RestPlan
} {
  const { ctx, nodes } = fakeContext()
  const dest = new FakeNode()
  const audio = ctx as unknown as BaseAudioContext
  const core = createCore(audio, dest as unknown as AudioNode)
  const plan = planRests(0, 900, mulberry32(seed))
  const chain = createMusicChain(core, {} as AudioBuffer, DRONE.tone, {
    rng: mulberry32(seed + 100),
    breathStep: TIMING.breathStep,
    mode: 'relax',
    rests: plan,
  })
  // 休止的增益是接到层输出前的最后一级
  const rest = nodes.find(
    n => n !== (core.out as unknown as FakeNode) && n.to === (core.out as unknown),
  )!.gain
  return { ctx, chain, rest, plan }
}

/** 像引擎那样每秒前瞻 10 秒排一次，一直排到 until */
function run(ctx: { currentTime: number }, chain: MusicChain, from: number, until: number): void {
  for (let t = from; t <= until; t += 1) {
    ctx.currentTime = t
    chain.schedule(t + TIMING.horizon)
  }
}

const lowest = (p: FakeParam, from = Number.NEGATIVE_INFINITY): number =>
  Math.min(...p.events.filter(([t]) => t >= from).map(([, v]) => v))

describe('music rests and breath pacing', () => {
  it('rests silence the music when it is not following a pace', () => {
    const { ctx, chain, rest, plan } = setup(1)
    chain.freeRun(0, 900)
    run(ctx, chain, 0, 900)
    const r = plan.next(-1)!
    expect(lowest(rest)).toBeLessThan(0.01)
    expect(chain.density(r.at + r.fade + 1)).toBe(0)
  })

  it('a paced bed never rests: the music is the pacing cue', () => {
    for (const seed of [1, 2, 3]) {
      const { ctx, chain, rest } = setup(seed)
      chain.breath(segment('in', 0, 1, 5), 0)
      run(ctx, chain, 0, 900)
      expect(lowest(rest)).toBeGreaterThan(0.999)
      for (let t = 0; t < 900; t += 0.5) expect(chain.density(t)).toBe(1)
    }
  })

  it('pacing that starts during a rest brings the music back and cancels the rest of it', () => {
    const { ctx, chain, rest, plan } = setup(2)
    const r = plan.next(-1)!
    const mid = Math.ceil(r.at + r.fade + 2)
    chain.freeRun(0, 900)
    run(ctx, chain, 0, mid)
    expect(lowest(rest)).toBeLessThan(0.01)
    ctx.currentTime = mid
    chain.breath(segment('in', 0, 1, 5), mid)
    run(ctx, chain, mid, 900)
    expect(lowest(rest, mid + MUSIC.rest.back)).toBeGreaterThan(0.999)
    expect(rest.events.at(-1)![1]).toBe(1)
    expect(chain.density(mid + MUSIC.rest.back)).toBe(1)
  })
})
