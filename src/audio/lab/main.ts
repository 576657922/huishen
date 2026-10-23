/**
 * 声音实验室（audio-lab.html）：开发和质检用的页面，不进正式构建。
 * 逐个试听声景、音乐、提示音和钟声，模拟跟随节拍的练习（含「有点急」的重排），跑离线质检和校准。
 * 端到端测试经 window.audioLab 调用同样的功能。
 */
import type { Segment } from '@/engine/types'
import { segment } from '../automation'
import { createBufferStore } from '../buffers'
import { integratedLoudness, type Metrics, measure, momentaryMax } from '../dsp/analysis'
import { CUE_KINDS } from '../dsp/assets'
import { createAudioEngine } from '../engine'
import { AMBIENCE_IDS, MUSIC_IDS } from '../layers'
import { createMixer } from '../mixer'
import { DEFAULT_VOLUMES } from '../params'
import type { AmbienceId, BellKind, Bus, MusicId, SoundMix, SoundMode } from '../types'
import { LIMITER_URL, loadLimiter } from '../worklet/load'
import { type LiveResult, liveCheck } from './live'
import {
  type CalibrationOptions,
  type CalibrationRow,
  calibrate,
  type QaCase,
  type QaOptions,
  type QaReport,
  renderScene,
  runQa,
  type Scene,
  trimsSource,
} from './qa'
import { encodeWav } from './wav'

const store = createBufferStore()
const engine = createAudioEngine({ store })

/* ---------- 小工具 ---------- */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  Object.assign(node, props)
  for (const c of children) node.append(c)
  return node
}

function button(label: string, onClick: () => void, title = ''): HTMLButtonElement {
  return el('button', { type: 'button', textContent: label, title, onclick: onClick })
}

function section(title: string, ...children: Node[]): HTMLElement {
  return el('section', {}, [el('h2', { textContent: title }), ...children])
}

function row(...children: (Node | string)[]): HTMLDivElement {
  return el('div', { className: 'row' }, children)
}

const fmt = (x: number, digits = 1): string => (Number.isFinite(x) ? x.toFixed(digits) : '—')

/* ---------- 当前组合 ---------- */

const state = {
  ambience: 'rain' as AmbienceId,
  music: 'drone' as MusicId,
  mode: 'relax' as SoundMode,
  volumes: { ...DEFAULT_VOLUMES } as Record<Bus, number>,
  playing: false,
}

const mix = (): SoundMix => ({
  ambience: state.ambience,
  music: state.music,
  ambienceVolume: state.volumes.ambience,
  musicVolume: state.volumes.music,
  mode: state.mode,
})

const status = el('p', { className: 'status' })

function refreshStatus(): void {
  const p = engine.previewing()
  status.textContent =
    `音频环境：${engine.state()} · 素材生成：${store.generator()} · 缓存 ${(store.bytes() / 1048576).toFixed(1)} MB` +
    (p ? ` · 试听中：${p.ambience} + ${p.music}` : '') +
    (state.playing ? ' · 背景声播放中' : '')
}
engine.onStateChange(refreshStatus)
engine.onPreviewChange(refreshStatus)
setInterval(refreshStatus, 1000)

function choice<T extends string>(
  name: string,
  ids: readonly T[],
  get: () => T,
  set: (v: T) => void,
): HTMLElement {
  const wrap = el('div', { className: 'choices' })
  for (const id of ids) {
    const input = el('input', { type: 'radio', name, value: id, checked: get() === id })
    input.addEventListener('change', () => {
      set(id)
      if (state.playing) engine.changeBed(mix())
    })
    wrap.append(el('label', {}, [input, ` ${id}`]))
  }
  return wrap
}

function slider(bus: Bus): HTMLElement {
  const out = el('output', { textContent: String(state.volumes[bus]) })
  const input = el('input', { type: 'range', min: '0', max: '100', value: String(state.volumes[bus]) })
  input.addEventListener('input', () => {
    state.volumes[bus] = Number(input.value)
    out.textContent = input.value
    engine.setVolume(bus, state.volumes[bus])
  })
  return el('label', { className: 'slider' }, [`${bus} `, input, out])
}

/* ---------- 跟随节拍的模拟 ---------- */

type Style = 'glide' | 'ping' | 'bed' | 'off'

const pacer = {
  rate: 5.5,
  ratio: 'long' as 'equal' | 'long',
  style: 'glide' as Style,
  timer: null as ReturnType<typeof setInterval> | null,
  /** 已经排到的段的终点（声音时钟） */
  next: 0,
  /** 下一段的序号：0 吸、1 呼 */
  phase: 0,
  /** 当前正在进行的段 */
  current: null as { seg: Segment; at: number } | null,
  queue: [] as { seg: Segment; at: number }[],
}

const phaseLabel = el('strong', { textContent: '—' })

function cycle(): Segment[] {
  const T = 60 / pacer.rate
  const inhale = T * (pacer.ratio === 'long' ? 4.5 / 11 : 0.5)
  return [segment('in', 0, 1, inhale), segment('out', 1, 0, T - inhale)]
}

function playSegment(seg: Segment, at: number): void {
  engine.breath(seg, at)
  if (pacer.style === 'glide') engine.glide(seg, at)
  else if (pacer.style === 'ping') engine.cue(seg.key, at)
}

function pacerTick(): void {
  const now = engine.now()
  if (pacer.style === 'off') {
    engine.freeRun(now + 12)
  } else {
    while (pacer.next < now + 2) {
      const seg = cycle()[pacer.phase]!
      pacer.queue.push({ seg, at: pacer.next })
      playSegment(seg, pacer.next)
      pacer.next += seg.dur
      pacer.phase = (pacer.phase + 1) % 2
    }
  }
  pacer.queue = pacer.queue.filter(s => s.at + s.seg.dur > now)
  const cur = pacer.queue.find(s => s.at <= now)
  pacer.current = cur ?? null
  phaseLabel.textContent = cur
    ? `${cur.seg.key === 'in' ? '吸' : '呼'} ${fmt(cur.at + cur.seg.dur - now)} 秒 · 每分钟 ${pacer.rate} 次`
    : '—'
}

function startPacer(): void {
  stopPacer()
  pacer.next = engine.now() + 0.2
  pacer.phase = 0
  pacer.queue = []
  pacer.timer = setInterval(pacerTick, 200)
  pacerTick()
}

function stopPacer(): void {
  if (pacer.timer) clearInterval(pacer.timer)
  pacer.timer = null
  phaseLabel.textContent = '—'
}

/** 「有点急」：下一轮起每分钟多 0.5 次；撤销已排的，当前这一段从此刻接着走完（与会话引擎的做法相同） */
function stepBack(): void {
  if (!pacer.timer || pacer.style === 'off') return
  pacer.rate = Math.min(8, pacer.rate + 0.5)
  const now = engine.now()
  engine.cancelScheduled()
  const cur = pacer.queue.find(s => s.at <= now && s.at + s.seg.dur > now)
  pacer.queue = []
  if (cur) {
    const rem = cur.at + cur.seg.dur - now
    const q = 1 - rem / cur.seg.dur
    const y = cur.seg.y0 + (cur.seg.y1 - cur.seg.y0) * ((1 - Math.cos(Math.PI * q)) / 2)
    const rest = segment(cur.seg.key, y, cur.seg.y1, rem)
    engine.breath(rest, now)
    if (pacer.style === 'glide' && rem >= 0.5) engine.glide(rest, now)
    pacer.queue.push({ seg: rest, at: now })
    pacer.next = now + rem
    pacer.phase = cur.seg.key === 'in' ? 1 : 0
  }
  pacerTick()
}

/* ---------- 质检报告 ---------- */

const qaOut = el('div', { className: 'qa' })
const progress = el('p', { className: 'progress' })
let lastReport: QaReport | null = null

function caseRow(c: QaCase, index: number): HTMLTableRowElement {
  const m = c.metrics
  const failed = c.checks.filter(k => !k.ok)
  const detail = c.checks
    .map(k => `${k.ok ? '✓' : '✗'} ${k.name} ${fmt(k.value, 2)}（${k.limit}）`)
    .join('\n')
  const tr = el('tr', { className: c.ok ? 'ok' : 'bad', title: detail }, [
    el('td', { textContent: c.label }),
    el('td', { textContent: m ? fmt(m.lufs) : '' }),
    el('td', { textContent: m ? fmt(m.lra) : '' }),
    el('td', { textContent: m ? fmt(m.truePeak) : '' }),
    el('td', { textContent: m ? fmt(m.maxRise) : '' }),
    el('td', { textContent: m ? fmt(m.click) : '' }),
    el('td', { textContent: m ? fmt(m.centroid, 0) : '' }),
    el('td', { textContent: m ? fmt(m.highVsMid) : '' }),
    el('td', { textContent: fmt(c.limitDb, 2) }),
    el('td', { textContent: c.ok ? '合格' : failed.map(k => k.name).join('、') }),
  ])
  if (c.audio) {
    const cell = el('td')
    cell.append(button('WAV', () => downloadCase(index)))
    tr.append(cell)
  }
  return tr
}

function showReport(r: QaReport): void {
  lastReport = r
  const head = ['场景', 'LUFS', 'LRA', 'dBTP', '升幅', '咔哒', '质心 Hz', '高/中 dB', '限幅 dB', '结论']
  const table = el('table', {}, [
    el('thead', {}, [
      el(
        'tr',
        {},
        head.map(h => el('th', { textContent: h })),
      ),
    ]),
    el('tbody', {}, r.cases.map(caseRow)),
  ])
  qaOut.replaceChildren(
    el('p', {
      textContent: `${r.ok ? '全部合格' : `${r.cases.filter(c => !c.ok).length} 项不合格`} · ${r.cases.length} 个场景 · ${(r.ms / 1000).toFixed(0)} 秒`,
    }),
    table,
  )
}

function downloadCase(index: number): void {
  const c = lastReport?.cases[index]
  if (!c?.audio || !lastReport) return
  const url = URL.createObjectURL(encodeWav(c.audio, lastReport.sampleRate))
  const a = el('a', { href: url, download: `${c.label.replace(/[^\w一-鿿-]+/g, '_')}.wav` })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function showCalibration(rows: readonly CalibrationRow[]): void {
  const table = el('table', {}, [
    el('thead', {}, [
      el(
        'tr',
        {},
        ['层', '模式', '实测 LUFS', '目标', '现值 dB', '建议 dB'].map(h => el('th', { textContent: h })),
      ),
    ]),
    el(
      'tbody',
      {},
      rows.map(r =>
        el('tr', {}, [
          el('td', { textContent: r.key }),
          el('td', { textContent: r.mode }),
          el('td', { textContent: fmt(r.measured, 2) }),
          el('td', { textContent: fmt(r.target) }),
          el('td', { textContent: fmt(r.trim) }),
          el('td', { textContent: fmt(r.suggested) }),
        ]),
      ),
    ),
  ])
  const source = el('textarea', { value: trimsSource(rows), rows: 14, readOnly: true })
  qaOut.replaceChildren(table, source)
}

const onProgress = (done: number, total: number, label: string): void => {
  progress.textContent = done < total ? `${done + 1} / ${total}：${label}` : ''
}

/* ---------- 冒烟检查：构建产物里的 Worklet 与 Worker ---------- */

export interface SmokeResult {
  limiterUrl: string
  /** 离线、实时两种音频环境里限幅器 Worklet 都载入成功 */
  offlineWorklet: boolean
  realtimeWorklet: boolean
  /** 限幅器在离线渲染里真的在处理（输出不是静音） */
  offlineProcessed: boolean
  /** 素材在 Worker 里生成（不是主线程后备路径） */
  generator: 'worker' | 'main'
  generated: boolean
}

async function smoke(): Promise<SmokeResult> {
  const offline = new OfflineAudioContext({ numberOfChannels: 2, length: 4800, sampleRate: 48000 })
  const offlineWorklet = await loadLimiter(offline)
  let offlineProcessed = false
  if (offlineWorklet) {
    const mixer = createMixer(offline, { dynamics: 'worklet' })
    const osc = offline.createOscillator()
    osc.connect(mixer.buses.ambience)
    osc.start()
    const out = await offline.startRendering()
    offlineProcessed = mixer.dynamics() === 'worklet' && out.getChannelData(0).some(v => Math.abs(v) > 1e-4)
  }
  const live = new AudioContext()
  const realtimeWorklet =
    (await loadLimiter(live)) && createMixer(live, { dynamics: 'worklet' }).dynamics() === 'worklet'
  void live.close()
  const buffers = await store.load(['cue:in'], 48000, 'now')
  return {
    limiterUrl: LIMITER_URL,
    offlineWorklet,
    realtimeWorklet,
    offlineProcessed,
    generator: store.generator(),
    generated: buffers('cue:in').length > 0,
  }
}

/* ---------- 页面 ---------- */

function build(): void {
  const root = document.getElementById('lab')
  if (!root) return
  const modeChoice = choice(
    'mode',
    ['relax', 'sleep'] as const,
    () => state.mode,
    v => {
      state.mode = v
    },
  )
  const ambChoice = choice(
    'ambience',
    ['none', ...AMBIENCE_IDS] as AmbienceId[],
    () => state.ambience,
    v => {
      state.ambience = v
    },
  )
  const musChoice = choice(
    'music',
    ['none', ...MUSIC_IDS] as MusicId[],
    () => state.music,
    v => {
      state.music = v
    },
  )

  const transport = row(
    button('试听 7 秒', () => engine.preview(mix())),
    button('停止试听', () => engine.stopPreview()),
    button('开始背景声', async () => {
      await engine.unlock()
      engine.startBed(mix(), engine.now() + 0.1, state.mode === 'sleep' ? 20 : 8)
      state.playing = true
      refreshStatus()
    }),
    button('停止（1.5 秒）', () => {
      stopPacer()
      engine.cancelScheduled()
      engine.stopBed(1.5)
      state.playing = false
      refreshStatus()
    }),
    button('结尾淡出 30 秒', () => engine.fadeBedOut(engine.now(), 30)),
    button('暂停', () => void engine.suspend()),
    button('继续', () => void engine.resume()),
  )

  // v1 没有语音引导；压低留给以后的真人录音，这里可以手动试听压低的效果
  let ducked = false
  const duck = button('人声压低', () => {
    ducked = !ducked
    engine.setDuck(ducked)
    duck.classList.toggle('on', ducked)
  })

  const rate = el('input', { type: 'range', min: '4', max: '8', step: '0.5', value: String(pacer.rate) })
  const rateOut = el('output', { textContent: String(pacer.rate) })
  rate.addEventListener('input', () => {
    pacer.rate = Number(rate.value)
    rateOut.textContent = rate.value
  })
  const style = choice(
    'style',
    ['glide', 'ping', 'bed', 'off'] as const,
    () => pacer.style,
    v => {
      pacer.style = v
    },
  )
  const ratio = choice(
    'ratio',
    ['long', 'equal'] as const,
    () => pacer.ratio,
    v => {
      pacer.ratio = v
    },
  )

  const cueButtons = row(...CUE_KINDS.map(k => button(k, () => engine.cue(k, engine.now() + 0.05))))
  const bellButtons = row(
    ...(['start', 'interval', 'end'] as BellKind[]).map(k =>
      button(`钟 ${k}`, () => engine.bell(k, engine.now() + 0.1)),
    ),
  )

  root.append(
    el('h1', { textContent: '回神 · 声音实验室' }),
    status,
    section(
      '组合',
      row('模式', modeChoice),
      row('声景', ambChoice),
      row('音乐', musChoice),
      transport,
      row(duck),
    ),
    section('音量', row(...(['master', 'ambience', 'music', 'cues'] as Bus[]).map(slider))),
    section(
      '跟随节拍',
      row('每分钟', rate, rateOut, '次', ratio),
      row('提示', style),
      row(
        button('开始节拍', startPacer),
        button('有点急', stepBack),
        button('停止节拍', () => {
          stopPacer()
          engine.cancelScheduled()
        }),
        phaseLabel,
      ),
    ),
    section('提示音与钟声', cueButtons, bellButtons),
    section(
      '离线质检',
      row(
        button('运行质检', async () => showReport(await runQa({ store, keepAudio: true, onProgress }))),
        button('只测声景', async () =>
          showReport(
            await runQa({ store, keepAudio: true, onProgress, only: l => l.startsWith('ambience/') }),
          ),
        ),
        button('校准（每层 3 分钟）', async () => showCalibration(await calibrate({ store, onProgress }))),
      ),
      progress,
      qaOut,
    ),
  )
  refreshStatus()
}

/** 一个场景的测量结果；minus 为同一场景去掉某一路之后的渲染，差就是那一路本身 */
export interface SceneMeasure {
  metrics: Metrics
  limitDb: number
  /** 有 minus 时：那一路的瞬时响度最大值、综合响度，以及去掉它之后的综合响度 */
  part?: { momentaryMax: number; lufs: number; restLufs: number }
}

async function measureScene(scene: Scene, fromSec = 12, minus?: Partial<Scene>): Promise<SceneMeasure> {
  const r = await renderScene(scene, store)
  const from = Math.round(fromSec * r.sampleRate)
  const out: SceneMeasure = { metrics: measure(r.audio, r.sampleRate, from), limitDb: r.stats.limitDb }
  if (minus) {
    const rest = await renderScene({ ...scene, ...minus }, store)
    const part = r.audio.map((a, c) => a.subarray(from).map((v, i) => v - rest.audio[c]![from + i]!))
    out.part = {
      momentaryMax: momentaryMax(part, r.sampleRate),
      lufs: integratedLoudness(part, r.sampleRate),
      restLufs: integratedLoudness(rest.audio, r.sampleRate, from),
    }
  }
  return out
}

/** 端到端测试用的接口：报告里不带渲染结果 */
export interface AudioLab {
  runQa(options?: Omit<QaOptions, 'store' | 'keepAudio' | 'only'> & { only?: string }): Promise<QaReport>
  calibrate(options?: Omit<CalibrationOptions, 'store'>): Promise<{ rows: CalibrationRow[]; source: string }>
  smoke(): Promise<SmokeResult>
  /** 实时冒烟：在真的 AudioContext 里把 AudioPort 的调用走一遍，听输出端该响时响、该静时静 */
  live(): Promise<LiveResult>
  /** 调声音时用：渲染任意场景并测量（fromSec 之前不计） */
  measureScene(scene: Scene, fromSec?: number, minus?: Partial<Scene>): Promise<SceneMeasure>
}

const lab: AudioLab = {
  async runQa(options = {}) {
    const { only, ...rest } = options
    const report = await runQa({
      ...rest,
      store,
      onProgress: (d, t, l) => {
        onProgress(d, t, l)
        console.info(`[audio-qa] ${d}/${t} ${l}`)
      },
      only: only ? l => new RegExp(only).test(l) : undefined,
    })
    showReport(report)
    return report
  },
  async calibrate(options = {}) {
    const rows = await calibrate({ ...options, store, onProgress })
    showCalibration(rows)
    return { rows, source: trimsSource(rows) }
  },
  smoke,
  live: () => liveCheck(store),
  measureScene,
}

declare global {
  interface Window {
    audioLab?: AudioLab
  }
}

window.audioLab = lab
build()
