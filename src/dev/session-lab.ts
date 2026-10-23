/**
 * 会话联调（只在开发服务器上有，不进正式构建）：用真的声音引擎和平台能力建一个会话控制器，
 * 在浏览器里跑几次很短的真实练习，确认引擎、声音、数据几个模块真的接得上：
 * 慢呼吸 40 秒（滑音，第 15 秒点「有点急」）、引导 30 秒（跳过可跳的一段）、专注 20 秒（回神三次）、
 * 不限时的听声音 15 秒后手动结束。结果挂在 window.sessionLab 上，e2e-audio/session.spec.ts 读它；
 * 页面上的按钮也可以手动点（第一次点击同时是解锁声音的用户手势）。
 *
 * 接线照应用的做法（src/app/services.ts、src/app/plan.ts）：控制器拿到声音、平台端口和不出声的语音端口
 * （v1 没有语音引导，NULL_VOICE），设置里的四个音量交给声音层，练完的结果用数据层转成记录。
 * 为了看得见，多了几处只读的观察，都不改变声音层和引擎的行为：输出先过一个分析器再到扬声器（量电平）；
 * 限幅器模块的载入结果、限幅器节点的建成和报到记下来；声音端口外面套一层计数。
 */
import { createAudioEngine } from '@/audio'
import type { Bus, SoundMix, SoundMode } from '@/audio/types'
import { loadLimiter } from '@/audio/worklet/load'
import { LIMITER_PROCESSOR, type LimiterMessage } from '@/audio/worklet/protocol'
import type { GuidedScript } from '@/content/types'
import { DEFAULT_PREFS } from '@/data/prefs'
import { isRecordable, resultToRecord } from '@/data/record'
import type { SessionRecord } from '@/data/types'
import {
  buildPattern,
  buildTimeline,
  createBrowserPlatform,
  createSessionController,
  DEFAULT_FADE_IN_SEC,
  NULL_VOICE,
  withWarmup,
} from '@/engine'
import type {
  AudioPort,
  EndReason,
  SessionPlan,
  SessionResult,
  SessionState,
  SessionStatus,
} from '@/engine/types'

export type RunName = 'slow' | 'guided' | 'focus' | 'sound'

export const RUN_NAMES: readonly RunName[] = ['slow', 'guided', 'focus', 'sound']

/** 整个页面的观察结果 */
export interface LabProbe {
  /** 限幅器模块载入的结果；还没载入为 null */
  limiterLoaded: boolean | null
  /** 建成的限幅器节点数：模块载入后混音台换上真峰值限幅器时建一个 */
  limiterNodes: number
  /** 限幅器在音频线程里报到过（处理器建成时发 ready） */
  limiterReady: boolean
  /** 音频环境经历过的状态 */
  contextStates: string[]
  sampleRate: number | null
  /** 不在任何一次练习里时收到的 onFinish */
  strayFinish: number
}

/** 电平都按 43 毫秒的 RMS 计（dBFS） */
export interface LabLevels {
  /** 进行中最响的一刻 */
  peakDb: number
  /** 背景声铺开之后电平的下四分位：提示音、钟声都短促，下四分位看的是一直在响的背景声 */
  bedDb: number
  /** 结束 TAIL_MS 毫秒之后 */
  tailDb: number
  /** 进行中最大的采样绝对值，1 为满刻度 */
  maxSample: number
}

/** SessionResult 去掉计划，便于传给测试 */
export type LabResult = Omit<SessionResult, 'plan'>

export interface LabRun {
  name: RunName
  done: boolean
  error: string | null
  plannedSec: number
  /** 这一次 onFinish 被调用的次数 */
  finishCalls: number
  /** 经历过的状态（相邻的相同状态只记一次），最后的 idle 来自 reset() */
  statuses: SessionStatus[]
  /** 进行中 SessionState.audio 最后的值 */
  audio: SessionState['audio'] | null
  endReason: EndReason | null
  /** SessionState.rate 先后的值 */
  rates: number[]
  /** 经过的段落 id */
  sections: string[]
  /** SessionState.endSec 先后的值 */
  endSecs: number[]
  /** 做过的操作和做的时刻（练习秒数） */
  actions: Record<string, number>
  /** 声音端口的调用次数，如 glide、cue:mark、bell:end */
  calls: Record<string, number>
  levels: LabLevels
  /** 从 start() 返回到 onFinish，声音时钟和墙上时钟各走了几秒 */
  audioElapsed: number
  wallElapsed: number
  /** onFinish 时音频环境的状态 */
  contextState: string
  result: LabResult | null
  /** 数据层由结果转成的记录 */
  record: SessionRecord | null
  /** 是否够格保存（不足 1 分钟的不存） */
  recordable: boolean | null
}

export interface SessionLab {
  readonly results: Partial<Record<RunName, LabRun>>
  readonly probe: LabProbe
  run(name: RunName): Promise<LabRun>
  runAll(): Promise<LabRun[]>
}

declare global {
  interface Window {
    sessionLab?: SessionLab
  }
}

const SAMPLE_MS = 50
/** 结束之后再等这么久：onFinish 若被叫第二次也记得下，手动停掉的背景声也该淡完了 */
const TAIL_MS = 3000
/** 背景声淡入 8 秒，之后才看它的电平 */
const BED_FROM_SEC = DEFAULT_FADE_IN_SEC
/** 有背景声又有开始钟声时引擎至少按 3 秒倒数；都用 3 秒，省时间 */
const LEAD_SEC = 3
const BUSES: readonly Bus[] = ['master', 'ambience', 'music', 'cues']

const round2 = (x: number): number => Math.round(x * 100) / 100

function lowerQuartile(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NEGATIVE_INFINITY
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor((s.length - 1) / 4)] ?? Number.NEGATIVE_INFINITY
}

/* ---------- 观察 ---------- */

const probe: LabProbe = {
  limiterLoaded: null,
  limiterNodes: 0,
  limiterReady: false,
  contextStates: [],
  sampleRate: null,
  strayFinish: 0,
}

let tap: AnalyserNode | null = null
const frame = new Float32Array(2048)

/** 输出先进一个分析器再到扬声器：引擎照常连 destination，连到的其实是分析器（与 src/audio/lab/live.ts 相同） */
function tappedContext(): AudioContext | null {
  let ctx: AudioContext
  try {
    ctx = new AudioContext({ latencyHint: 'playback' })
  } catch {
    return null
  }
  const analyser = ctx.createAnalyser()
  analyser.fftSize = frame.length
  analyser.connect(ctx.destination)
  Object.defineProperty(ctx, 'destination', { get: () => analyser })
  tap = analyser
  probe.sampleRate = ctx.sampleRate
  const note = (): void => {
    probe.contextStates.push(ctx.state)
  }
  note()
  ctx.addEventListener('statechange', note)
  return ctx
}

function level(): { db: number; max: number } {
  if (!tap) return { db: Number.NEGATIVE_INFINITY, max: 0 }
  tap.getFloatTimeDomainData(frame)
  let power = 0
  let max = 0
  for (const v of frame) {
    power += v * v
    max = Math.max(max, Math.abs(v))
  }
  return { db: 10 * Math.log10(power / frame.length + 1e-20), max }
}

/** 记下混音台建成的限幅器节点，以及处理器在音频线程里的报到。必须在声音引擎建混音台之前装上 */
function watchLimiterNodes(): void {
  const Native = globalThis.AudioWorkletNode
  if (typeof Native !== 'function') return
  class Watched extends Native {
    constructor(context: BaseAudioContext, name: string, options?: AudioWorkletNodeOptions) {
      super(context, name, options)
      if (name !== LIMITER_PROCESSOR) return
      probe.limiterNodes++
      // 混音台随后设 onmessage，端口那时才开始派发；这里另挂一个监听，不占它的位置
      this.port.addEventListener('message', (e: MessageEvent<LimiterMessage>) => {
        if (e.data?.type === 'ready') probe.limiterReady = true
      })
    }
  }
  globalThis.AudioWorkletNode = Watched
}

let current: LabRun | null = null

function bump(key: string): void {
  if (current) current.calls[key] = (current.calls[key] ?? 0) + 1
}

/** 声音端口外面套一层计数，其余原样转给声音引擎（应用的 services.ts 也是这样转一层） */
function counted(a: AudioPort): AudioPort {
  return {
    unlock: () => {
      bump('unlock')
      return a.unlock()
    },
    now: () => a.now(),
    state: () => a.state(),
    onStateChange: listener => a.onStateChange(listener),
    startBed: (mix, at, fadeIn, plannedSec) => {
      bump('startBed')
      a.startBed(mix, at, fadeIn, plannedSec)
    },
    changeBed: mix => {
      bump('changeBed')
      a.changeBed(mix)
    },
    setVolume: (bus, volume) => a.setVolume(bus, volume),
    breath: (seg, at) => {
      bump('breath')
      a.breath(seg, at)
    },
    glide: (seg, at) => {
      bump('glide')
      return a.glide(seg, at)
    },
    freeRun: until => {
      bump('freeRun')
      a.freeRun(until)
    },
    cue: (kind, at) => {
      bump(`cue:${kind}`)
      return a.cue(kind, at)
    },
    bell: (kind, at) => {
      bump(`bell:${kind}`)
      return a.bell(kind, at)
    },
    fadeBedOut: (at, dur) => {
      bump('fadeBedOut')
      a.fadeBedOut(at, dur)
    },
    stopBed: fade => {
      bump('stopBed')
      a.stopBed(fade)
    },
    cancelScheduled: () => {
      bump('cancelScheduled')
      a.cancelScheduled()
    },
    suspend: () => a.suspend(),
    resume: () => a.resume(),
  }
}

/* ---------- 接线：与应用相同 ---------- */

watchLimiterNodes()

const audio = createAudioEngine({
  createContext: tappedContext,
  loadLimiter: c =>
    loadLimiter(c).then(ok => {
      probe.limiterLoaded = ok
      return ok
    }),
})
for (const bus of BUSES) audio.setVolume(bus, DEFAULT_PREFS.volume[bus])
const platform = createBrowserPlatform()
// v1 没有语音引导：和应用一样交给控制器不出声的语音端口
const controller = createSessionController({ audio: counted(audio), voice: NULL_VOICE, platform })

/* ---------- 四次练习 ---------- */

const mix = (ambience: SoundMix['ambience'], music: SoundMix['music'], mode?: SoundMode): SoundMix => ({
  ambience,
  music,
  ambienceVolume: DEFAULT_PREFS.volume.ambience,
  musicVolume: DEFAULT_PREFS.volume.music,
  ...(mode ? { mode } : {}),
})

const SOUNDS: Record<RunName, SoundMix> = {
  slow: mix('stream', 'drone'),
  guided: mix('rain', 'none'),
  focus: mix('ocean', 'none'),
  sound: mix('forest', 'pentatonic', 'relax'),
}

/** 一段很短的引导：开场、两段（第一段可以跳过）、结尾，按 30 秒排 */
const LAB_SCRIPT: GuidedScript = {
  id: 'body-scan',
  title: '联调引导',
  minMinutes: 0.5,
  maxMinutes: 1,
  opening: [{ text: '坐好，留意呼吸。' }],
  sections: [
    { id: 'feet', title: '双脚', weight: 1, intro: [{ text: '留意双脚。' }], skippable: true },
    { id: 'hands', title: '双手', weight: 1, intro: [{ text: '留意双手。' }] },
  ],
  closing: [{ text: '慢慢回来。' }],
}

/** 照 src/app/plan.ts 的 buildPlan 合成，取默认偏好；v1 只有文字引导，不朗读 */
function basePlan(
  p: Pick<SessionPlan, 'practiceId' | 'kind' | 'title' | 'plannedSec'> & Partial<SessionPlan>,
  name: RunName,
): SessionPlan {
  return {
    leadSec: LEAD_SEC,
    pattern: null,
    timeline: null,
    intervalSec: null,
    sound: SOUNDS[name],
    cues: DEFAULT_PREFS.cues,
    captionCue: DEFAULT_PREFS.captionCue,
    voice: false,
    haptics: DEFAULT_PREFS.haptics,
    silentEnd: DEFAULT_PREFS.silentEnd,
    params: {},
    endBell: true,
    fadeInSec: DEFAULT_FADE_IN_SEC,
    prosody: 'steady',
    ...p,
  }
}

const PLANS: Record<RunName, () => SessionPlan> = {
  slow: () => {
    const paced = { type: 'resonance' as const, rate: 5.5, ratio: 'long' as const }
    return basePlan(
      {
        practiceId: 'slow',
        kind: 'paced',
        title: '慢呼吸',
        plannedSec: 40,
        // 开头从每分钟 8 次逐步放慢：第 15 秒正在 7.5 次的一轮里，比「有点急」的上限 7 次还快，
        // 所以不往慢里调：节拍照常放慢，到 7 次的那一轮（第 31 秒）起停在 7 次，不再继续放慢
        pattern: withWarmup(buildPattern(paced)),
        params: { rate: paced.rate, ratio: paced.ratio },
        cueStyle: 'glide',
      },
      'slow',
    )
  },
  guided: () => {
    const level = DEFAULT_PREFS.guidance
    const timeline = buildTimeline(LAB_SCRIPT, 0.5, { level, prosody: 'steady', endBufferSec: 5 })
    return basePlan(
      {
        practiceId: 'body-scan',
        kind: 'guided',
        title: LAB_SCRIPT.title,
        plannedSec: timeline.duration,
        timeline,
        params: { level },
      },
      'guided',
    )
  },
  focus: () => basePlan({ practiceId: 'focus', kind: 'focus', title: '专注', plannedSec: 20 }, 'focus'),
  sound: () =>
    basePlan(
      {
        practiceId: 'listen',
        kind: 'sound',
        title: '听声音',
        plannedSec: 0,
        haptics: false,
        params: { mode: 'relax' },
      },
      'sound',
    ),
}

interface Action {
  name: string
  /** 练习第几秒起做 */
  at: number
  /** 另外要满足的条件 */
  when?: (s: SessionState) => boolean
  act: () => void
}

const ACTIONS: Record<RunName, readonly Action[]> = {
  slow: [{ name: 'stepBack', at: 15, act: () => controller.stepBack() }],
  guided: [
    {
      name: 'skipSection',
      at: 6,
      when: s => s.section?.id === 'feet' && s.section.skippable,
      act: () => controller.skipSection(),
    },
  ],
  focus: [5, 10, 15].map((at, i) => ({ name: `mark${i + 1}`, at, act: () => controller.mark() })),
  // 不限时的练习只能手动结束
  sound: [{ name: 'end', at: 15, act: () => controller.end() }],
}

/* ---------- 跑一次 ---------- */

const results: Partial<Record<RunName, LabRun>> = {}
let bedLevels: number[] = []
let started = { audio: 0, wall: 0 }
let finished: (() => void) | null = null

function pushNew<T>(xs: T[], x: T): void {
  if (xs[xs.length - 1] !== x) xs.push(x)
}

controller.subscribe(() => {
  const r = current
  if (!r) return
  const s = controller.getState()
  pushNew(r.statuses, s.status)
  if (s.status !== 'idle') r.audio = s.audio
  if (s.endReason) r.endReason = s.endReason
  if (s.rate !== null) pushNew(r.rates, s.rate)
  if (s.section) pushNew(r.sections, s.section.id)
  if (s.endSec !== null) pushNew(r.endSecs, round2(s.endSec))
  render()
})

controller.onFinish(result => {
  const r = current
  if (!r) {
    probe.strayFinish++
    return
  }
  r.finishCalls++
  if (r.finishCalls > 1) return
  r.audioElapsed = round2(audio.now() - started.audio)
  r.wallElapsed = round2((performance.now() - started.wall) / 1000)
  r.contextState = audio.state()
  r.result = {
    startedAt: result.startedAt,
    practicedSec: result.practicedSec,
    completed: result.completed,
    marks: result.marks,
    count: result.count,
    breaths: result.breaths,
    finalRate: result.finalRate,
    rateSteps: result.rateSteps,
    skipped: result.skipped,
  }
  try {
    r.record = resultToRecord(result)
    r.recordable = isRecordable(result)
  } catch (err) {
    r.error = `转成记录失败：${String(err)}`
  }
  finished?.()
})

function sample(r: LabRun): void {
  if (controller.getState().status !== 'running') return
  const { db, max } = level()
  r.levels.peakDb = Math.max(r.levels.peakDb, round2(db))
  r.levels.maxSample = Math.max(r.levels.maxSample, round2(max))
  if (controller.time() >= BED_FROM_SEC) bedLevels.push(db)
}

function act(r: LabRun, actions: readonly Action[]): void {
  const s = controller.getState()
  if (s.status !== 'running') return
  const t = controller.time()
  for (const a of actions) {
    if (r.actions[a.name] !== undefined || t < a.at || (a.when && !a.when(s))) continue
    r.actions[a.name] = round2(t)
    a.act()
  }
}

function blankRun(name: RunName, plan: SessionPlan): LabRun {
  return {
    name,
    done: false,
    error: null,
    plannedSec: plan.plannedSec,
    finishCalls: 0,
    statuses: [],
    audio: null,
    endReason: null,
    rates: [],
    sections: [],
    endSecs: [],
    actions: {},
    calls: {},
    levels: {
      peakDb: Number.NEGATIVE_INFINITY,
      bedDb: Number.NEGATIVE_INFINITY,
      tailDb: Number.NEGATIVE_INFINITY,
      maxSample: 0,
    },
    audioElapsed: 0,
    wallElapsed: 0,
    contextState: '',
    result: null,
    record: null,
    recordable: null,
  }
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

async function run(name: RunName): Promise<LabRun> {
  if (current) throw new Error(`还在跑「${current.name}」`)
  const plan = PLANS[name]()
  const r = blankRun(name, plan)
  results[name] = r
  current = r
  bedLevels = []
  const done = new Promise<void>(resolve => {
    finished = resolve
  })
  const sampler = setInterval(() => sample(r), SAMPLE_MS)
  const actor = setInterval(() => act(r, ACTIONS[name]), SAMPLE_MS)
  // 不限时的练习靠手动结束；万一没结束，到这个时候强行结束，测试照样能拿到结果
  const limitSec = (plan.plannedSec > 0 ? plan.plannedSec : 60) + LEAD_SEC + 30
  const guard = setTimeout(() => {
    r.error ??= '超时'
    controller.end()
  }, limitSec * 1000)
  render()
  try {
    // 和应用一样在点击的处理函数里同步调用 start()：声音在这个用户手势里解锁
    await controller.start(plan)
    started = { audio: audio.now(), wall: performance.now() }
    if (controller.getState().status === 'idle') throw new Error('练习没有开始')
    await done
    r.levels.bedDb = round2(lowerQuartile(bedLevels))
    await sleep(TAIL_MS)
    r.levels.tailDb = round2(level().db)
  } catch (err) {
    r.error ??= String(err)
    controller.end()
  } finally {
    clearInterval(sampler)
    clearInterval(actor)
    clearTimeout(guard)
    finished = null
    controller.reset()
    r.done = true
    current = null
    render()
  }
  return r
}

async function runAll(): Promise<LabRun[]> {
  const out: LabRun[] = []
  for (const name of RUN_NAMES) out.push(await run(name))
  return out
}

/* ---------- 页面 ---------- */

const LABELS: Record<RunName, string> = {
  slow: '慢呼吸 40 秒',
  guided: '引导 30 秒',
  focus: '专注 20 秒',
  sound: '听声音 15 秒',
}

const root = document.getElementById('lab')
const statusLine = document.createElement('p')
const output = document.createElement('pre')

function render(): void {
  const s = controller.getState()
  const t = s.status === 'idle' ? '' : ` · ${controller.time().toFixed(1)} 秒`
  statusLine.textContent = current ? `「${LABELS[current.name]}」：${s.status}${t}` : '空闲'
  output.textContent = JSON.stringify({ probe, results }, null, 2)
}

function button(id: string, label: string, onClick: () => Promise<unknown>): HTMLButtonElement {
  const b = document.createElement('button')
  b.id = id
  b.type = 'button'
  b.textContent = label
  b.addEventListener('click', () => {
    onClick().catch((err: unknown) => {
      statusLine.textContent = String(err)
    })
  })
  return b
}

if (root) {
  const h1 = document.createElement('h1')
  h1.textContent = '会话联调'
  const row = document.createElement('div')
  row.className = 'row'
  for (const name of RUN_NAMES) row.append(button(`run-${name}`, LABELS[name], () => run(name)))
  row.append(button('run-all', '全部依次', runAll))
  statusLine.className = 'status'
  root.append(h1, statusLine, row, output)
}

// 空闲时先把四次要用的素材生成好，开始时不用等（应用在选声音时也这样做）
for (const m of Object.values(SOUNDS)) audio.warm(m)

window.sessionLab = { results, probe, run, runAll }
render()
