/**
 * 一组背景声：一层声景 + 一层音乐。练习里的背景声、空闲时的试听都是一组；离线质检也用它渲染，
 * 测到的就是正式播放的同一条链路。
 *
 *   每一层：层的输出 → 校准（LAYER_TRIMS，随模式）→ 交叉淡变（换声音时）
 *   每条母线：补位（只有一层时补上另一层的份额）→ 淡入 → 结尾淡出 → 混音台的母线
 *
 * 素材没到时先排好，到了再从当时的位置接上（补一个短淡入），不卡开始。
 * 换下的层淡完才停；层的节点在它自己结束后回收，这一组的节点在所有层都回收后断开。
 */
import type { Segment } from '@/engine/types'
import { easeInOut } from '@/lib/math'
import { breathY, createTrack, fadeOutCurve, powerIn, powerOut, segment, type Track } from './automation'
import type { BufferStore } from './buffers'
import { dbToGain } from './dsp/util'
import { disconnectAll, gainNode, quietly } from './graph'
import { type Buffers, type Layer, layerAssets, layerFactory, layerKey } from './layers'
import { type BedKind, layerTrim, presenceDb } from './levels'
import { FADES, type LayerKey, MODE, TIMING } from './params'
import { NO_RESTS, planRests, type RestPlan } from './rests'
import type { AmbienceId, MusicId, SoundMix, SoundMode } from './types'

const KINDS: readonly BedKind[] = ['ambience', 'music']

const other = (kind: BedKind): BedKind => (kind === 'ambience' ? 'music' : 'ambience')

export interface BedSetup {
  ctx: BaseAudioContext
  /** 两条母线的输入 */
  buses: Readonly<Record<BedKind, AudioNode>>
  store: BufferStore
  rng: () => number
  /** 新上的层马上排到这个时刻（前瞻排程的终点） */
  horizon: () => number
  /** 此刻能不能听见：挂起时换下的层直接拆掉，不必等淡出。离线渲染总是 true */
  audible: () => boolean
  /** 跟随呼吸时每隔多少秒取一个点；默认 TIMING.breathStep */
  breathStep?: number
  /** 质检用：层把内部的某一路交出来 */
  inspect?: (name: string, node: GainNode) => void
}

export interface BedStart {
  mix: SoundMix
  at: number
  /** 淡入秒数 */
  fadeIn: number
  /** 从 at 到练习结束的秒数，音乐据此安排休止（开始跟随节拍后就不再休止）；不限时不传 */
  plannedSec?: number
  /** 试听：层跳过长的引入，也不安排休止 */
  quick?: boolean
}

export interface Bed {
  /** 当前的组合（mode 已补上） */
  readonly mix: Readonly<Required<SoundMix>>
  readonly stopped: boolean
  /** 换声音或模式：换下的层淡出，换上的层淡入 */
  change(mix: Partial<SoundMix>): void
  breath(seg: Segment, at: number): void
  freeRun(now: number, until: number): void
  /** 撤销此刻以后排过的呼吸起伏，停在当前值 */
  hold(now: number): void
  /** 把各层的音符、随机事件和慢速起伏排到 until */
  schedule(until: number): void
  /** 从 at 起用 dur 秒淡到静默；再次调用时取代上一次，从当时的音量接着走 */
  fadeOut(at: number, dur: number): void
  /** 用 fade 秒淡出后停止 */
  stop(fade: number): void
  /** 立刻拆掉（只在听不见时用） */
  teardown(): void
  /** 这一组的节点全部断开后通知；已经断开时立刻通知 */
  onClosed(listener: () => void): void
}

interface Slot {
  kind: BedKind
  key: LayerKey
  /** 校准 */
  trim: GainNode
  trimTrack: Track
  /** 交叉淡变 */
  node: GainNode
  fade: Track
  layer: Layer | null
  /** 素材占用 */
  release: () => void
  /** 已经换下或整组已停：素材晚到也不再启动 */
  dead: boolean
  disposed: boolean
}

interface BusChain {
  presence: GainNode
  presenceTrack: Track
  fadeIn: GainNode
  ending: GainNode
  endingTrack: Track
}

export function createBed(setup: BedSetup, start: BedStart): Bed {
  const { ctx, store, rng } = setup
  const breathStep = setup.breathStep ?? TIMING.breathStep
  const t0 = ctx.currentTime
  let mix: Required<SoundMix> = { ...start.mix, mode: start.mix.mode ?? 'relax' }
  const rests: RestPlan = start.quick ? NO_RESTS : planRests(start.at, start.plannedSec, rng)
  const slots: Record<BedKind, Slot | null> = { ambience: null, music: null }
  const open = new Set<Slot>()
  const closedListeners: (() => void)[] = []
  let stopped = false
  let closed = false
  /** 跟随节拍时已经排过的段：中途换上的层从这里补上 */
  let segs: { seg: Segment; at: number }[] = []
  let pace: 'idle' | 'paced' | 'free' = 'idle'
  let freeUntil = 0

  const idOf = (kind: BedKind, m: Pick<SoundMix, 'ambience' | 'music'>): AmbienceId | MusicId =>
    kind === 'ambience' ? m.ambience : m.music
  const present = (kind: BedKind, m: Pick<SoundMix, 'ambience' | 'music'>): boolean =>
    layerKey(kind, idOf(kind, m)) !== null

  const chains = {} as Record<BedKind, BusChain>
  for (const kind of KINDS) {
    const presence = gainNode(ctx, 1)
    const fadeIn = gainNode(ctx, 0)
    const ending = gainNode(ctx, 1)
    presence.connect(fadeIn).connect(ending).connect(setup.buses[kind])
    const presenceTrack = createTrack(
      presence.gain,
      dbToGain(presenceDb(kind, present(other(kind), mix))),
      t0,
    )
    createTrack(fadeIn.gain, 0, t0).glide(
      1,
      start.at,
      start.at + Math.max(start.fadeIn, FADES.minStop),
      easeInOut,
    )
    chains[kind] = { presence, presenceTrack, fadeIn, ending, endingTrack: createTrack(ending.gain, 1, t0) }
  }

  function close(): void {
    if (closed || !stopped || open.size) return
    closed = true
    for (const kind of KINDS) {
      const c = chains[kind]
      disconnectAll([c.presence, c.fadeIn, c.ending])
    }
    for (const l of closedListeners.splice(0)) l()
  }

  function disposeSlot(slot: Slot): void {
    if (slot.disposed) return
    slot.disposed = true
    slot.dead = true
    disconnectAll([slot.trim, slot.node])
    slot.release()
    open.delete(slot)
    close()
  }

  /** 节拍里 t 时刻的位置；没有节拍时返回 null */
  function yAt(t: number): number | null {
    if (pace !== 'paced' || !segs.length) return null
    for (const { seg, at } of segs) if (t >= at && t < at + seg.dur) return breathY(seg, at, t)
    const first = segs[0]!
    if (t < first.at) return first.seg.y0
    return segs[segs.length - 1]!.seg.y1
  }

  /** 新上的层对齐这一组当前的起伏：节拍的位置、已排的段，或自由起伏 */
  function sync(layer: Layer, at: number): void {
    const now = ctx.currentTime
    if (pace === 'paced') {
      const y = yAt(Math.max(at, now))
      if (y !== null) layer.level(y, at)
      for (const { seg, at: t } of segs) if (t + seg.dur > at) layer.breath(seg, t)
    } else if (pace === 'free') layer.freeRun(now, freeUntil)
  }

  function launch(slot: Slot, bufs: Buffers, at: number, quick: boolean): void {
    const now = ctx.currentTime
    const begin = Math.max(at, now + 0.02)
    // 素材晚到：从现在的位置补一个短淡入接上，而不是突然冒出来
    if (begin > at + 0.05) {
      slot.fade.set(0, begin)
      slot.fade.glide(1, begin, begin + FADES.late, powerIn)
    }
    const layer = layerFactory(slot.key)(ctx, slot.trim, bufs, {
      rng,
      breathStep,
      mode: mix.mode,
      // 已经在跟随节拍：中途换上的音乐不休止（先上的那层在第一次跟随节拍时已经停了休止）
      rests: slot.kind === 'music' && pace !== 'paced' ? rests : null,
      onDisposed: () => disposeSlot(slot),
      inspect: setup.inspect,
    })
    slot.layer = layer
    layer.start(begin, quick)
    sync(layer, begin)
    layer.schedule(Math.max(setup.horizon(), begin))
  }

  function addSlot(
    kind: BedKind,
    id: AmbienceId | MusicId,
    at: number,
    quick: boolean,
    xf: number,
  ): Slot | null {
    const key = layerKey(kind, id)
    if (!key) return null
    const now = ctx.currentTime
    const node = gainNode(ctx, xf > 0 ? 0 : 1)
    node.connect(chains[kind].presence)
    const trim = gainNode(ctx, layerTrim(key, mix.mode))
    trim.connect(node)
    const fade = createTrack(node.gain, xf > 0 ? 0 : 1, now)
    if (xf > 0) fade.glide(1, at, at + xf, powerIn)
    const names = layerAssets(key)
    const slot: Slot = {
      kind,
      key,
      trim,
      trimTrack: createTrack(trim.gain, layerTrim(key, mix.mode), now),
      node,
      fade,
      layer: null,
      release: store.hold(names, ctx.sampleRate),
      dead: false,
      disposed: false,
    }
    open.add(slot)
    const ready = store.ready(names, ctx.sampleRate)
    if (ready) launch(slot, ready, at, quick)
    else {
      store.load(names, ctx.sampleRate, 'now').then(
        bufs => {
          if (!slot.dead) launch(slot, bufs, at, quick)
        },
        // 素材生成失败：这一层不出声，其余照常
        () => disposeSlot(slot),
      )
    }
    return slot
  }

  /** 换下一层：等功率淡出，淡完停止 */
  function retire(slot: Slot, fade: number): void {
    slot.dead = true
    if (!slot.layer) {
      disposeSlot(slot)
      return
    }
    if (!setup.audible()) {
      slot.layer.dispose()
      return
    }
    const now = ctx.currentTime
    slot.fade.glide(0, now, now + fade, powerOut)
    slot.layer.stop(now + fade)
  }

  function livingLayers(): Layer[] {
    const out: Layer[] = []
    for (const s of open) if (s.layer && !s.dead) out.push(s.layer)
    return out
  }

  /** 补位跟着选了哪些层走，与换层的交叉淡变同时完成，整体响度不跳 */
  function updatePresence(dur: number): void {
    const now = ctx.currentTime
    for (const kind of KINDS) {
      const target = dbToGain(presenceDb(kind, slots[other(kind)] !== null))
      chains[kind].presenceTrack.glide(target, now, now + dur, easeInOut, 8)
      chains[kind].presenceTrack.forget(now - 1)
    }
  }

  function setMode(next: SoundMode): void {
    if (next === mix.mode) return
    mix = { ...mix, mode: next }
    const now = ctx.currentTime
    for (const s of open) {
      if (s.dead) continue
      s.trimTrack.glide(layerTrim(s.key, next), now, now + MODE.ramp, easeInOut, 8)
      s.layer?.setMode(next)
    }
  }

  function teardown(): void {
    stopped = true
    for (const slot of [...open]) {
      slot.dead = true
      if (slot.layer) slot.layer.dispose()
      disposeSlot(slot)
    }
    close()
  }

  for (const kind of KINDS) slots[kind] = addSlot(kind, idOf(kind, mix), start.at, start.quick ?? false, 0)

  return {
    get mix() {
      return mix
    },
    get stopped() {
      return stopped
    },
    change(next) {
      if (stopped) return
      if (next.mode !== undefined) setMode(next.mode)
      const now = ctx.currentTime
      let changed = false
      for (const kind of KINDS) {
        const id = kind === 'ambience' ? next.ambience : next.music
        if (id === undefined || id === idOf(kind, mix)) continue
        mix = { ...mix, [kind]: id }
        const old = slots[kind]
        if (old) retire(old, FADES.change)
        slots[kind] = addSlot(kind, id, now + 0.02, true, FADES.change)
        changed = true
      }
      if (changed) updatePresence(FADES.change)
      const { ambienceVolume, musicVolume } = next
      if (ambienceVolume !== undefined) mix = { ...mix, ambienceVolume }
      if (musicVolume !== undefined) mix = { ...mix, musicVolume }
    },
    breath(seg, at) {
      if (stopped) return
      const now = ctx.currentTime
      pace = 'paced'
      segs = segs.filter(s => s.at + s.seg.dur > now - 1)
      segs.push({ seg, at })
      for (const layer of livingLayers()) layer.breath(seg, at)
    },
    freeRun(now, until) {
      if (stopped) return
      pace = 'free'
      freeUntil = Math.max(freeUntil, until)
      for (const layer of livingLayers()) layer.freeRun(now, until)
    },
    hold(now) {
      const y = yAt(now)
      // 撤销之后，中途换上的层停在同一个位置，不再补排被撤销的那些段
      segs = y === null ? [] : [{ seg: segment('hold', y, y, 0, 'flat'), at: now }]
      for (const layer of livingLayers()) layer.hold(now)
    },
    schedule(until) {
      for (const layer of livingLayers()) layer.schedule(until)
    },
    fadeOut(at, dur) {
      const now = ctx.currentTime
      const from = Math.max(at, now)
      for (const kind of KINDS) {
        const track = chains[kind].endingTrack
        // 先停在此刻的音量：上一次排下、还没开始的淡出作废，已经开始的停在半路，再从那里接着淡
        track.cancelFrom(now)
        track.glide(0, from, from + Math.max(dur, FADES.minStop), fadeOutCurve, 24)
        track.forget(now - 1)
      }
    },
    stop(fade) {
      if (stopped) return
      if (!setup.audible()) {
        teardown()
        return
      }
      stopped = true
      const now = ctx.currentTime
      const end = now + Math.max(fade, FADES.minStop)
      for (const kind of KINDS) chains[kind].endingTrack.glide(0, now, end, fadeOutCurve, 16)
      for (const slot of [...open]) {
        slot.dead = true
        if (slot.layer) slot.layer.stop(end)
        else disposeSlot(slot)
      }
      close()
    },
    teardown,
    onClosed(listener) {
      if (closed) quietly(listener)
      else closedListeners.push(listener)
    },
  }
}
