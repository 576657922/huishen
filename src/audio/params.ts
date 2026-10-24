/**
 * 声音层的全部可调数值。改声音只改这个文件。
 *
 * 依据（详见 docs/research 与产品规格 §2、§5）：
 * - 响度按 EBU R 128 的做法管理：放松 −23 LUFS、睡前 −28 LUFS（在默认音量下），真峰值不超过 −3 dBTP；
 *   换声景或音乐时综合响度变化不超过 1.5 LU；短期响度 20 秒内不渐强超过 3 LU。
 * - 音乐无节拍、无人声、协和；和声 12 秒一换（睡前 16–24 秒），每次最多两个声部移动；跟随呼吸主要改亮度。
 * - 自然声以水声为主；冲击性的声音（雨滴、水泡、鸟鸣）比底子最多高 6 dB；钟声、提示音叠在底子上最多高 3 LU。
 * - 淡入淡出从不硬切：停止、暂停 1.5 秒，开始 8 秒（睡前 20 秒）。
 * 改动之后运行离线质检（npm run test:audio），确认响度、真峰值、直流、咔哒声和频谱都还在范围内；
 * 改了某一层的声音，要在实验室（audio-lab.html）里重新校准，把结果填进 LAYER_TRIMS。
 */
import type { CueKind, SoundMode } from './types'

/** 循环素材的采样率：自然声的有用频段在 16 kHz 以内，比 48 kHz 省三分之一内存 */
export const LOOP_RATE = 32000

/** 循环素材统一归一到这个综合响度（LUFS）：层内各部分的配比因此直接是 LU 差 */
export const ASSET_LUFS = -20

/** 单个乐音（拨弦、电钢琴）按开头一段的 RMS 归一到这个值（−20 dBFS），不同音高听起来一样响 */
export const ASSET_RMS = 0.1

/** 单次音（提示音、钟声、鸟鸣、雨滴）按播放时的瞬时响度最大值归一（LUFS；单声道素材按两个声道都响计） */
export const ONESHOT_LUFS = -20

/* ---------- 响度与校准 ---------- */

/** 默认音量（与 data/prefs.ts 的出厂设置一致）：响度目标都在这组音量下定义 */
export const DEFAULT_VOLUMES = { master: 80, ambience: 55, music: 45, cues: 70 } as const

export const LOUDNESS = {
  /** 声景 + 音乐在默认音量下的综合响度目标（LUFS） */
  target: { relax: -23, sleep: -28 } satisfies Record<SoundMode, number>,
  tolerance: 1,
  /** 换声景或音乐时，综合响度的最大变化（LU） */
  maxSwitch: 1.5,
  /** 响度范围上限（LU）：单独的声景、放松的组合、睡前的组合 */
  lra: { ambience: 4, relax: 6, sleep: 4 },
  /** 真峰值上限（dBTP） */
  truePeak: -3,
  /** 冲击：瞬时响度最大值比综合响度最多高这么多（LU） */
  impulse: 6,
  /** 钟声、提示音叠在背景声上，短期响度最多高出这么多（LU） */
  overBed: 3,
  /** 20 秒之内短期响度的最大升幅（LU）：不渐强 */
  maxRise: 3,
  /**
   * 30 秒之内短期响度的最大变化（LU，升降都算）：背景声要平稳（研究 §1）；跟随呼吸的起伏也算在里面（§3）。
   * 只管稳定播放的部分：开头淡入、结尾淡出和音乐中间的休止是有意的，不在此列
   */
  maxSwing: 3,
  /** 睡前：4 kHz 以上的能量至少比 200–800 Hz 低这么多（dB） */
  sleepHighVsMid: -20,
} as const

/**
 * 各层的校准修正（dB）：让每一层在默认音量下单独播放时，综合响度正好等于它在组合里分到的目标
 * （见 levels.ts 的 layerTarget：声景 + 音乐两层相加是 −23 LUFS，睡前 −28 LUFS）。
 * 由实验室的「校准」离线渲染 3 分钟实测得出；声音改了要重新校准。
 * sleep 一列另外补偿了睡前音色（低通、高架）损失的响度，以及睡前去掉的鸟鸣。
 */
export const LAYER_TRIMS: Record<LayerKey, Record<SoundMode, number>> = {
  rain: { relax: 2.8, sleep: 5.3 },
  stream: { relax: 1.6, sleep: 2.5 },
  ocean: { relax: 5.3, sleep: 5.3 },
  forest: { relax: 1.4, sleep: 2.3 },
  birds: { relax: 8.6, sleep: 8.7 },
  wind: { relax: 8.4, sleep: 8.6 },
  pink: { relax: 3.8, sleep: 5.7 },
  brown: { relax: 3.3, sleep: 3.6 },
  drone: { relax: -1.4, sleep: -1.6 },
  pentatonic: { relax: 4.7, sleep: 4.7 },
  phasing: { relax: 3, sleep: 3 },
}

/** 可以建层的声音：声景与音乐的全部 id（不含 none） */
export type LayerKey =
  | 'rain'
  | 'stream'
  | 'ocean'
  | 'forest'
  | 'birds'
  | 'wind'
  | 'pink'
  | 'brown'
  | 'drone'
  | 'pentatonic'
  | 'phasing'

/** 感知音量曲线：gain = (v/100)^exponent × boost（沿用原型）。总音量不乘 boost，100 即原样输出 */
export const VOLUME = {
  exponent: 1.6,
  boost: 1.4,
} as const

/* ---------- 输出链 ---------- */

/** 各模式的音色与电平：睡前更暗、更轻 */
export const MODE = {
  /** 全部模式都滤掉 38 Hz 以下：耳机和手机喇叭放不出来，只会让限幅器白白动作 */
  highpass: 38,
  /** 模式切换时音色的过渡秒数 */
  ramp: 2,
  /** 放松：不加低通（截止频率取奈奎斯特频率时滤波器完全透明） */
  relax: { gainDb: 0, lowpass: Number.POSITIVE_INFINITY, shelfDb: 0 },
  /**
   * 睡前：低 5 LU；3 kHz 二阶低通（12 dB/倍频程，研究建议 3–5 kHz），再加一个 −12 dB 的高架。
   * 4 kHz 低通加 −9 dB 高架时，雨声、粉噪声 4 kHz 以上只比 200–800 Hz 低 14–16 dB（要求 20 dB 以上）；
   * 现在雨声约低 22 dB，响度只少 0.5 LU 左右（由 LAYER_TRIMS 的 sleep 一列补回）
   */
  sleep: { gainDb: -5, lowpass: 3000, shelfDb: -12 },
  shelfHz: 2600,
} as const satisfies { relax: ModeTone; sleep: ModeTone; highpass: number; ramp: number; shelfHz: number }

export interface ModeTone {
  gainDb: number
  lowpass: number
  shelfDb: number
}

/**
 * 柔和的安全压缩 + 真峰值限幅（AudioWorklet）：默认音量下都不动作；
 * 用户把各路音量都开到最大时，压缩器温和地收 1–2 dB，限幅器保证真峰值不过 −3 dBTP
 */
export const DYNAMICS = {
  threshold: -12,
  ratio: 2,
  knee: 6,
  attack: 0.03,
  release: 0.5,
  ceiling: -3,
  lookahead: 0.005,
  limitRelease: 0.15,
} as const

/**
 * 没有 AudioWorklet 的浏览器（旧版 iOS、非安全来源）用两个 DynamicsCompressorNode 代替。
 * 它们只看采样峰值，所以限幅阈值再低 1.5 dB，给采样之间的峰值留出余量
 */
export const FALLBACK_DYNAMICS = {
  compressor: { threshold: -12, knee: 0, ratio: 2, attack: 0.03, release: 0.5 },
  limiter: { threshold: -4.5, knee: 0, ratio: 20, attack: 0.001, release: 0.15 },
} as const

export const FADES = {
  /** 练习开始时背景声淡入的下限（秒）：睡前至少 20 秒；放松照引擎给的（默认 8 秒） */
  sessionIn: { relax: 0, sleep: 20 } satisfies Record<SoundMode, number>,
  /** 练习中换声音的交叉淡变 */
  change: 1.5,
  /** 停止背景声、暂停、继续：至少这么长，从不硬切 */
  stop: 1.5,
  /** 暂停：背景声 1.5 秒淡出后才挂起；提示音收得快一些，暂停之后不会再冒出一声；继续时提示音很快回来 */
  pause: 1.5,
  pauseCues: 0.4,
  resumeCues: 0.2,
  previewIn: 0.8,
  previewOut: 1.5,
  previewStop: 0.4,
  /** 新练习打断上一段还在淡出的背景声 */
  restart: 0.3,
  /** 任何「立即」停止也至少淡出这么久，避免咔哒声 */
  minStop: 0.03,
  /** 拖动音量时的平滑时间 */
  volume: 0.08,
  /** 声音素材晚到时补一个淡入 */
  late: 1.2,
  /** 限幅器从后备换成 Worklet 时两条路交叉淡变的秒数 */
  swap: 0.08,
} as const

/** 素材缓存与生成 */
export const CACHE = {
  /**
   * 缓存上限：一套声景加音乐约 10–25 MB，留得下当前和上一次用的两套，换回来不用重新生成；
   * 超出时淘汰最久没用、也没在播放的素材
   */
  budgetBytes: 48 * 1024 * 1024,
  /** Worker 空闲这么久就关掉，省下它的内存；下次要用再开 */
  workerIdleMs: 30_000,
  /** Worker 这么久没回音就当它坏了，改在主线程生成 */
  workerTimeoutMs: 20_000,
  /** 主线程后备路径每片的毫秒数：远低于 50 ms，滚动和点按不受影响 */
  sliceMs: 6,
} as const

/** 有人声时压低背景声（研究建议 6–8 dB，起 300 ms、回 1.5 s）。v1 没有语音引导，留给以后的真人录音 */
export const DUCK = {
  depthDb: -8,
  attack: 0.3,
  release: 1.5,
} as const

export const TIMING = {
  /** 生成式音乐、自动化提前排好的秒数 */
  horizon: 10,
  /** 页面在后台时计时器会被限流，排得更远 */
  hiddenHorizon: 75,
  tickMs: 1000,
  /** 没有声音多久之后挂起音频环境，省电 */
  idleSuspendSec: 20,
  /** 解锁、挂起、恢复最多等这么久；有的浏览器会让承诺永远不兑现 */
  unlockTimeoutMs: 1500,
  /** 限幅器的 Worklet 最多等这么久，超时先用后备的压缩器，载入后再换上 */
  workletTimeoutMs: 1200,
  /** 提示音来不及准时响就不响了：节拍提示晚了会误导呼吸 */
  lateCue: 0.15,
  lateBell: 1.5,
  /** 跟随呼吸的自动化每隔多少秒取一个点 */
  breathStep: 0.2,
  /** 默认试听时长 */
  preview: 7,
} as const

/* ---------- 单次音的电平（相对背景声目标的 LU，按瞬时响度最大值） ---------- */

export const LEVELS = {
  /**
   * 节拍、回神、数息、段落提示：叠在背景声上清楚但不突兀；屏息、停、数息的轻提示更轻。
   * 新的一句的轻提示（caption）很轻：闭着眼睛也听得到，又比段落提示音轻 5 LU，不惊扰
   */
  cues: {
    in: -4,
    in2: -6,
    out: -4,
    hold: -12,
    rest: -12,
    mark: -5,
    tap: -12,
    ninth: -4,
    section: -3,
    caption: -8,
  } satisfies Record<CueKind, number>,
  /** 钟声第一击：与背景声相加后短期响度最多高出 3 LU */
  bell: -1,
  /** 固定音高的柔音，综合响度约比背景声低 12 LU */
  glide: -12,
} as const

/* ---------- 声景 ---------- */

/** 带通噪声的一个频带：中心频率、Q、相对幅度、包络的涨落速率（Hz） */
export type Band = readonly [freq: number, q: number, amp: number, rate: number]

export const STREAM = {
  flow: {
    seconds: 17,
    crossfade: 1.5,
    seed: 11,
    /** 300 Hz–3 kHz 里的四个频带，各自以 0.05–0.3 Hz 缓慢涨落 */
    bands: [
      [420, 0.9, 1.0, 0.11],
      [760, 1.1, 0.85, 0.17],
      [1350, 1.3, 0.6, 0.23],
      [2400, 1.5, 0.38, 0.29],
    ] as readonly Band[],
    /**
     * 各频带包络的起伏深度：0.75 时每个频带涨落 12 dB，离线渲染 10 分钟里短期响度在 20 秒内最多升 4.4 LU；
     * 0.5（6 dB）时 2.7 LU（要求 ≤ 3），仍听得出水流的涌动
     */
    depth: 0.5,
    hp: 300,
    lp: 3000,
    controlStep: 64,
  },
  bubbles: {
    seconds: 13,
    seed: 23,
    /** 每秒个数随慢速密度在 min–max 之间变 */
    minRate: 8,
    maxRate: 30,
    /** 水泡：400–1500 Hz、5–20 ms 的上滑正弦 */
    fLo: 400,
    fHi: 1500,
    durLo: 0.005,
    durHi: 0.02,
    riseLo: 0.2,
    riseHi: 0.8,
    hp: 260,
    lp: 4000,
    /** 峰值压到 RMS 的这个倍数以内，避免个别水泡太尖 */
    peakRatio: 3.2,
  },
  /** 水泡比水体低 6 LU */
  mix: { flowDb: 0, bubblesDb: -6 },
  /**
   * 实时的慢速涨落：整体 ±dB（速率 Hz），一个峰值滤波在 lo–hi 之间游移（速率 Hz）。
   * 叠在素材自己的涨落上，所以都很浅
   */
  swayDb: 0.4,
  swayRate: 0.07,
  focusLo: 500,
  focusHi: 1800,
  focusRate: 0.11,
  focusDb: 2,
  focusQ: 0.7,
} as const

export const OCEAN = {
  bed: { seconds: 12, crossfade: 2, seed: 5 },
  foam: { seconds: 7, crossfade: 1, seed: 8, hp: 1200, lp: 3000 },
  /** 浪的低通截止频率随浪高在 lo–hi 之间指数变化：浪起时变亮；整体限在 3 kHz 以下 */
  cutLo: 420,
  cutHi: 1700,
  cutQ: 0.5,
  /**
   * 浪的增益 = lo + (1 − lo) × y^exp；lo 不能太低，否则每一浪的响度起伏超过 3 LU。
   * 箱式呼吸屏息在浪顶、浪底，起伏走得最满，再加上滑音；屏息越长，短期响度在两头停得越久。
   * 30 秒内的变化（8 个种子里最大）：lo 为 0.86 时 4 秒一步 2.76 LU、6 秒一步 2.94；0.88 时 6 秒一步 2.78
   */
  gainLo: 0.88,
  gainExp: 1.3,
  /** 浪花：呼气（退浪）开始时涌起，再慢慢消散 */
  foamDb: -2,
  foamBand: 2000,
  foamQ: 0.7,
  foamPeak: 0.42,
  foamRise: 0.12,
  foamHold: 0.6,
  /** 消散的时间常数 = max(min, 段长 × ratio) */
  foamDecayMin: 0.5,
  foamDecayRatio: 0.3,
  /** 只有从浪顶开始退的那一段才碎出浪花；中途接上的半段不再碎一次 */
  foamFromY: 0.9,
  /** 不跟节拍时自己起伏：每浪 8–12 秒，涨潮占 42% */
  free: { minPeriod: 8, maxPeriod: 12, rise: 0.42 },
} as const

export const RAIN = {
  bed: {
    seconds: 13,
    crossfade: 1.5,
    seed: 31,
    /** 雨幕：粉红噪声，低通 7 kHz，滤掉 150 Hz 以下 */
    hp: 150,
    lp: 7000,
  },
  drops: {
    seconds: 17,
    seed: 37,
    /** 细密雨滴：泊松分布，每秒 80–400 个之间缓慢变化 */
    minRate: 110,
    maxRate: 320,
    densityRate: 0.08,
    /** 每颗是 1–5 kHz、3–30 ms 的小颗粒：多数是带共鸣的噪声，一部分是带音高的「滴」 */
    fLo: 1000,
    fHi: 5000,
    durLo: 0.003,
    durHi: 0.03,
    tonal: 0.25,
    qLo: 4,
    qHi: 10,
    hp: 400,
    lp: 7500,
    peakRatio: 4,
  },
  /** 偶尔的大雨滴：更低、更圆，带一点溅水声；实时随机安排，不随循环重复 */
  heavy: {
    variants: 4,
    seed: 41,
    fLo: 600,
    fHi: 1300,
    tauLo: 0.02,
    tauHi: 0.035,
    splash: 0.35,
    splashHp: 2000,
    splashTau: 0.008,
    /** 平均每秒几颗（泊松） */
    rate: 0.35,
    /** 一颗的瞬时响度最大值比雨幕的综合响度低这么多（LU）；它很短，听起来比这个数清楚得多 */
    levelDb: -14,
    jitterDb: 4,
    /** 播放速率（音高与长短）的随机范围 */
    rateLo: 0.9,
    rateHi: 1.1,
    pan: 0.8,
  },
  /** 雨滴比雨幕低 5 LU */
  mix: { bedDb: 0, dropsDb: -5 },
  /** 跟随呼吸只改亮度：高架滤波在 y = 0 时 lo dB、y = 1 时 hi dB */
  shelfHz: 2500,
  shelfLo: -1.5,
  shelfHi: 0.5,
  /** 雨势的慢速涨落（实时，不随循环重复） */
  swayDb: 0.5,
  swayRate: 0.06,
} as const

export const WIND = {
  bed: {
    seconds: 19,
    crossfade: 2,
    seed: 41,
    hp: 60,
    lp: 2400,
    /** 左右声道缓慢漂移，像风从一侧移到另一侧 */
    driftRate: 0.025,
    driftDepth: 0.22,
  },
  leaves: {
    seconds: 11,
    crossfade: 1,
    seed: 43,
    hp: 2500,
    lp: 8000,
    /** 树叶的快速抖动：两个速率的值噪声相乘 */
    flutterRates: [9, 17] as readonly number[],
    flutterDepth: 0.75,
    swayRate: 0.4,
  },
  /** 阵风：0.03–0.15 Hz 的几层慢速值噪声，按时间直接求值，实时排程，不随循环重复 */
  gust: {
    seed: 47,
    rates: [0.03, 0.07, 0.15] as readonly number[],
    weights: [0.5, 0.33, 0.17] as readonly number[],
    /** S 形映射的陡度：越大，平静与阵风分得越开 */
    contrast: 7,
    /** 跟随呼吸时，阵风对齐呼气的比重（其余仍是自然的随机阵风） */
    breathMix: 0.6,
    /** 还没有收到节拍或自由起伏之前的静态强度 */
    idle: 0.35,
    step: 0.25,
  },
  /** 风体：带通中心频率随阵风在 lo–hi 之间变，增益 lo–1 */
  bodyLo: 420,
  bodyHi: 900,
  bodyQ: 0.6,
  bodyGainLo: 0.74,
  /** 枝间的轻微呼啸：窄带，阵风强时才明显 */
  whistleLo: 1100,
  whistleHi: 1700,
  whistleQ: 3,
  whistleDb: -18,
  /** 树叶沙沙：增益随阵风平方，乘在 −10 dB 上 */
  leavesDb: -10,
  leavesFloor: 0.2,
} as const

/** 鸟鸣的一个音：起止频率、时长、到下一个音的空隙，颤音的速率与深度、相对幅度 */
export interface BirdNote {
  f0: number
  f1: number
  dur: number
  gap: number
  /** 颤音速率（Hz）与深度（Hz） */
  vib?: number
  vibDepth?: number
  amp?: number
}

const note = (f0: number, f1: number, dur: number, gap: number, extra: Partial<BirdNote> = {}): BirdNote => ({
  f0,
  f1,
  dur,
  gap,
  ...extra,
})

/** 颤音：count 个短音，音高从 hi 慢慢落到 lo，每个音自己再往下滑一点 */
function trill(count: number, hi: number, lo: number, dur: number, gap: number): BirdNote[] {
  return Array.from({ length: count }, (_, i) => {
    const f = hi + ((lo - hi) * i) / (count - 1)
    return note(f, f * 0.93, dur, i === count - 1 ? 0 : gap, {
      amp: 0.75 + 0.25 * Math.sin((Math.PI * i) / count),
    })
  })
}

export const BIRDS = {
  seed: 53,
  /**
   * 六种叫声，都在 2–6 kHz、0.5–2 秒、和谐柔和：两声口哨、婉转的短句、轻颤音、上扬的长笛音、下行的一串、几声轻啁啾。
   * 不含警报声、乌鸦、海鸥、猛禽
   */
  songs: [
    [note(3500, 3400, 0.32, 0.09), note(2950, 2900, 0.38, 0, { amp: 0.9 })],
    [
      note(2600, 2900, 0.14, 0.06),
      note(3300, 3100, 0.12, 0.05, { amp: 0.85 }),
      note(2800, 3200, 0.16, 0.07),
      note(3600, 3400, 0.11, 0.05, { amp: 0.8 }),
      note(3000, 2800, 0.15, 0.06, { amp: 0.9 }),
      note(3200, 3500, 0.18, 0),
    ],
    trill(12, 4600, 3800, 0.045, 0.022),
    [
      note(2400, 3100, 0.42, 0.08, { vib: 28, vibDepth: 40 }),
      note(3900, 3800, 0.14, 0.05, { amp: 0.8 }),
      note(3300, 3350, 0.22, 0, { vib: 22, vibDepth: 30, amp: 0.9 }),
    ],
    [
      note(5200, 5000, 0.09, 0.06, { amp: 0.8 }),
      note(4800, 4600, 0.09, 0.06, { amp: 0.85 }),
      note(4400, 4200, 0.09, 0.06, { amp: 0.9 }),
      note(4000, 3800, 0.09, 0.06),
      note(3700, 3500, 0.1, 0),
    ],
    [
      note(2900, 3700, 0.06, 0.08, { amp: 0.8 }),
      note(3000, 3800, 0.06, 0.08, { amp: 0.8 }),
      note(3100, 3900, 0.06, 0.12, { amp: 0.85 }),
      note(3300, 3200, 0.26, 0, { vib: 18, vibDepth: 25 }),
    ],
  ] as readonly (readonly BirdNote[])[],
  /** 每个音的起音、收音（秒）：都是升余弦，不会咔哒 */
  attack: 0.008,
  release: 0.02,
  /** 二次谐波的相对幅度：一点点就够「和谐」，太多会尖 */
  harmonic: 0.06,
  /** 低指数调频带来的一点「哨音」质感 */
  fmRatio: 2,
  fmIndex: 0.15,
  /** 一句之后隔 4–15 秒再来一句 */
  gapLo: 4,
  gapHi: 15,
  firstLo: 1.5,
  firstHi: 5,
  /** 同一只鸟有时会把同一句再唱一遍，隔 0.8–2 秒 */
  repeatChance: 0.3,
  repeatLo: 0.8,
  repeatHi: 2,
  /** 每次播放的变化：音高（播放速率）、电平、声像、远近（低通） */
  rateLo: 0.95,
  rateHi: 1.05,
  levelJitterDb: 2,
  pan: 0.7,
  nearCut: 9000,
  farCut: 3500,
  /** 鸟鸣的瞬时响度比底子低这么多（LU）：研究建议 12–18 dB；加上随机的远近、轻重，最响的一句约低 14 dB */
  underBedDb: -16,
} as const

/** 鸟鸣这一声景的底子：比「风」更静的树叶与空气声 */
export const BIRD_BED = {
  /** 阵风强度压缩到这个比例：几乎只剩轻轻的沙沙声 */
  calm: 0.4,
  /** 底子的综合响度（层内电平，LUFS），鸟鸣按它定电平；改了底子要在实验室重新实测（质检的「鸟鸣电平」会报出来） */
  bedLufs: -25.1,
} as const

/** 林间 = 溪流 + 鸟鸣 + 树叶 + 轻风；各部分相对溪流的电平（dB） */
export const FOREST = {
  brookDb: 0,
  windDb: -7,
  /** 鸟鸣比底子低 16 LU */
  birdsUnderBedDb: -16,
  /** 林间的风比单独的风更静 */
  calm: 0.6,
  /** 底子（溪流 + 风）的综合响度（层内电平，LUFS），鸟鸣按它定电平；改了底子要在实验室重新实测 */
  bedLufs: -17.3,
} as const

export const NOISE = {
  pink: { seconds: 13, crossfade: 1, seed: 61, hp: 30, lp: 8000 },
  brown: { seconds: 17, crossfade: 1.5, seed: 67, hp: 30, lp: 8000 },
} as const

/* ---------- 钟声与提示音 ---------- */

/** 颂钵的一组分音：频率比、相对幅度、T60（秒）、拍频（Hz） */
export type Partial4 = readonly [ratio: number, amp: number, t60: number, beat: number]

export const BELL = {
  seconds: 13,
  seed: 4242,
  /** A3：D 大调的属音，与三种音乐都协和；在研究建议的 180–440 Hz 之内 */
  f0: 220,
  /** 颂钵的 5 个非谐波分音，最高约 2.9 kHz；基音 T60 11 秒，高分音更短 */
  partials: [
    [1, 1, 11, 0.6],
    [2.76, 0.48, 8, 1.1],
    [5.4, 0.2, 5, 1.9],
    [8.93, 0.08, 3, 2.6],
    [13.34, 0.035, 2, 3.3],
  ] as readonly Partial4[],
  /** 软槌：基音起音 12 ms，高分音 8 ms（研究建议 5–15 ms） */
  attack: 0.012,
  attackHigh: 0.008,
  /** 毡槌的轻击声：低通噪声 */
  malletCutoff: 900,
  malletDecay: 0.006,
  malletLevel: 0.04,
  /** 4 kHz 以上的成分再压低 */
  lowpass: 4000,
  /** 从这里开始用余弦淡出到结尾 */
  fadeStart: 10.5,
  /** 每一击：相对开始时刻的秒数、相对第一击的 dB。结束是三击、相隔 7 秒、一击比一击轻 */
  strikes: {
    start: [[0, 0]],
    interval: [[0, -4]],
    end: [
      [0, 0],
      [7, -3],
      [14, -6],
    ],
  } as Record<'start' | 'interval' | 'end', readonly (readonly [number, number])[]>,
} as const

export type CueSpec =
  | { type: 'ping'; freq: number; dur: number; glide?: number }
  | { type: 'tick'; freq: number; decay: number }
  | { type: 'pair'; freqs: readonly [number, number]; gap: number; dur: number }
  | { type: 'chime'; freq: number; partials: readonly Partial4[] }
  /** 软起音的短音：升余弦起音 attack 秒，各谐波（倍数、幅度）按 decay ÷ 倍数指数衰减 */
  | {
      type: 'soft'
      freq: number
      attack: number
      decay: number
      partials: readonly (readonly [number, number])[]
    }

/**
 * 提示音都在 D 大调五声音阶里，和背景音乐协和：吸气 A4 高一点，呼气 D4 低一点；
 * 屏息、停、数息是很轻的短音，不抢注意力。
 * 新的一句的轻提示（caption）是 F♯4 上很短、温暖的一声：35 ms 的软起音（节拍提示音 8 ms、段落小钟 3 ms），
 * 谐波很弱，不到半秒就轻下去，没有钟声的余音，比段落小钟（D5）低一个小六度，一听就分得开；
 * 音高在节拍柔音的 D4 之上，带引导词的呼吸练习里不会混进节拍，手机扬声器也放得出来
 */
export const CUES: Record<CueKind, CueSpec> = {
  in: { type: 'ping', freq: 440, dur: 0.9 },
  in2: { type: 'ping', freq: 493.88, dur: 0.45 },
  out: { type: 'ping', freq: 293.66, dur: 1.2 },
  hold: { type: 'tick', freq: 220, decay: 0.035 },
  rest: { type: 'tick', freq: 185, decay: 0.04 },
  mark: { type: 'ping', freq: 329.63, dur: 0.35, glide: 0.89 },
  tap: { type: 'tick', freq: 587.33, decay: 0.015 },
  ninth: { type: 'pair', freqs: [440, 587.33], gap: 0.14, dur: 0.6 },
  section: {
    type: 'chime',
    freq: 587.33,
    partials: [
      [1, 1, 11, 0],
      [2, 0.3, 6, 0.6],
      [3.01, 0.12, 3.5, 0],
      [4.2, 0.05, 2, 0],
    ],
  },
  caption: {
    type: 'soft',
    freq: 369.99,
    attack: 0.035,
    decay: 0.22,
    partials: [
      [1, 1],
      [2, 0.22],
      [3, 0.06],
    ],
  },
}

/** 原型提示音的音色：起音 8 ms，主音按 dur/4 衰减，二次泛音（×2.01）按 dur/10 衰减 */
export const PING = {
  attack: 0.008,
  partial: 2.01,
  partialGain: 0.25,
  glideTime: 0.09,
  tail: 0.4,
} as const

/** 节拍柔音：D4 固定音高，无扫频；只用音量起伏跟随吸呼。GLIDE 为兼容原有标识保留 */
export const GLIDE = {
  frequency: 293.66,
  /** 呼气末端保留少量音量，不在每轮边界突然断开 */
  floor: 0.35,
  /** 周期波形的谐波幅度：基音、二次、三次 */
  harmonics: [1, 0.08, 0.015] as readonly number[],
  attack: 0.6,
  release: 0.8,
  /** 撤销时从当前电平淡出 */
  cancelFade: 0.4,
  /** 前一段刚结束、下一段马上开始（间隔不超过这么多秒）时连成一个长音，转折处不断开 */
  join: 0.05,
  /** 屏息、停的段不出声 */
  holdTone: false,
} as const

/* ---------- 音乐 ---------- */

/** D 宫五声：D E F♯ A B，D3–B4 两个八度 */
export const PENTATONIC_NOTES = [50, 52, 54, 57, 59, 62, 64, 66, 69, 71] as const

/** 一个和弦：低音（MIDI）与四个中声部（从低到高） */
export interface ChordSpec {
  name: string
  bass: number
  pads: readonly [number, number, number, number]
}

/** 跟随呼吸、自由游移的亮度，干湿声，以及跟随呼吸的电平起伏 */
export interface ToneSpec {
  filterIdle: number
  filterLo: number
  filterHi: number
  filterQ: number
  driftLo: number
  driftHi: number
  driftRate: number
  dry: number
  wet: number
  /** 吸满时比呼空时响多少 dB；不填用 MUSIC.swellDb。只看一条链路的主音色（持续音的那份不用） */
  swellDb?: number
}

/** 三种音乐共用：呼吸带来的电平起伏和缓慢的宏观起伏 */
export const MUSIC = {
  /**
   * 吸满时比呼空时响多少 dB（围绕原电平上下各一半，平均不变）。研究建议 +2 dB，但它加在亮度、滑音之上：
   * 箱式呼吸屏息在两头，短期响度能完整地走到两头。只有一层音乐再加滑音时（宏观起伏已收起），
   * 30 秒内的变化：2 dB 时「回响」3.3 LU、「五声」3.1（要求 ≤ 3）；1.2 dB 时 2.8、2.5。
   * 跟随呼吸主要靠亮度（700 Hz → 1.6 kHz），电平只是辅助。各层可以在自己的音色里另设（ToneSpec.swellDb）
   */
  swellDb: 1.2,
  /** 宏观起伏：两层很慢的随机游走，±dB，周期都长于 30 秒；20 秒内的升幅不到 3 dB */
  macroDb: 1.2,
  macroRates: [1 / 50, 1 / 90] as readonly number[],
  macroStep: 1,
  /**
   * 开始跟随节拍后，宏观起伏用这么多秒收起，起伏交给呼吸。箱式呼吸 + 滑音、只有「回响」一层时，
   * 30 秒内短期响度的变化：保留宏观起伏 2.6–3.2 LU（随种子），收起后 2.7–2.9（要求 ≤ 3）
   */
  macroFade: 12,
  /** 中间的休止：音乐在 8–10 秒里变稀、静下来，停 20–40 秒，再慢慢回来；自然声照常 */
  rest: {
    /** 至少这么长的练习才安排休止；更长的安排两次 */
    minSession: 600,
    twoFrom: 1200,
    fadeLo: 8,
    fadeHi: 10,
    holdLo: 20,
    holdHi: 40,
    /** 回来时的淡入：比静下来更慢，不形成渐强 */
    back: 12,
    /** 离开头、结尾至少这么远 */
    margin: 150,
    /** 不限时的练习每隔这么久（± 抖动）一次 */
    every: 900,
    jitter: 180,
  },
} as const

export const DRONE = {
  /**
   * D 大调里的柔和和弦，都只用八度、五度、加二、加六、加九这类协和音程；
   * 中声部 A3 一直保持，换和弦时只有低音和一个中声部移动
   */
  chords: [
    { name: 'Dadd9', bass: 38, pads: [50, 57, 64, 66] },
    { name: 'Dsus2', bass: 38, pads: [50, 57, 64, 69] },
    { name: 'Gmaj7', bass: 43, pads: [50, 57, 62, 66] },
    { name: 'G6/9', bass: 43, pads: [50, 57, 64, 66] },
    { name: 'Bm11', bass: 35, pads: [50, 57, 64, 66] },
    { name: 'Bm7', bass: 35, pads: [50, 57, 62, 66] },
    { name: 'A6', bass: 33, pads: [49, 57, 64, 66] },
    { name: 'Asus4', bass: 33, pads: [50, 57, 64, 69] },
    { name: 'E9sus4', bass: 40, pads: [50, 57, 62, 66] },
    { name: 'F#m7', bass: 42, pads: [49, 57, 64, 66] },
  ] as readonly ChordSpec[],
  /** 和弦之间的走向与权重；最多两个声部移动的限制由代码再检查一遍 */
  moves: {
    Dadd9: { Gmaj7: 3, Bm11: 2, 'G6/9': 2, Dsus2: 1, E9sus4: 1 },
    Dsus2: { Dadd9: 2, Asus4: 2, 'G6/9': 1 },
    Gmaj7: { Bm7: 2, Dadd9: 2, E9sus4: 2 },
    'G6/9': { Bm11: 2, Dadd9: 2, A6: 1 },
    Bm11: { A6: 2, 'G6/9': 2, 'F#m7': 1 },
    Bm7: { Gmaj7: 2, E9sus4: 1, Bm11: 1 },
    A6: { Dadd9: 3, 'F#m7': 1, Asus4: 1 },
    Asus4: { Dadd9: 2, Dsus2: 1 },
    E9sus4: { Gmaj7: 2, Bm7: 1 },
    'F#m7': { Bm11: 2, A6: 1 },
  } as Readonly<Record<string, Readonly<Record<string, number>>>>,
  /** 和声节奏：放松 12 秒一换；睡前 16–24 秒 */
  hold: { relax: [12, 12], sleep: [16, 24] } satisfies Record<SoundMode, readonly [number, number]>,
  /** 移动的声部交叉淡变 3–6 秒；保持的声部不动 */
  crossfade: 4.5,
  /** 第一个和弦的淡入：正式开始时由整体淡入负责，这里只要不突兀；试听时要几秒内就听到 */
  firstIn: 3,
  quickIn: 1.2,
  /**
   * 每个音由同音高的正弦和三角波组成，彼此不失谐：原先两者相差 8 音分，以 0.3–1 Hz 拍出约 7 dB 深的起伏，
   * 持续音单独就能在 20 秒内升 2.6 LU。声音的活气交给慢揉音、亮度游移、换和弦和混响（见 layers/pad.ts）
   */
  voices: [
    { type: 'sine', weight: 0.62 },
    { type: 'triangle', weight: 0.3 },
  ] as readonly { type: OscillatorType; weight: number }[],
  /** 四个中声部的相对幅度（从低到高）与声像 */
  padAmps: [0.85, 0.75, 0.62, 0.48] as readonly number[],
  padPans: [-0.3, 0.2, -0.15, 0.35] as readonly number[],
  /** 低音比中声部整体低 12 dB（研究建议 10–14 dB），基音在 55–110 Hz，加一点二次谐波让小喇叭也听得出 */
  bassUnderPadsDb: -12,
  bassHarmonic: 0.3,
  /** 揉音：≤ 5 音分、0.1–0.3 Hz；两个错开的低频振荡器相加，所有音一起摆（各摆各的会互相拍出响度起伏） */
  vibratoCents: 4,
  vibratoRates: [0.13, 0.21] as readonly number[],
  oscGain: 0.22,
  tone: {
    filterIdle: 1000,
    filterLo: 700,
    filterHi: 1600,
    filterQ: 0.3,
    driftLo: 850,
    driftHi: 1250,
    driftRate: 0.03,
    /** 混响少一些：持续的纯音泡在长混响里，各和弦落在混响频响的峰谷上，响度会差近 2 LU */
    dry: 0.9,
    wet: 0.25,
  } satisfies ToneSpec,
} as const

/** 持续音的一个声部：音高（MIDI）、振幅、声像，低音可加一点二次谐波 */
export interface PedalVoice {
  midi: number
  amp: number
  pan: number
  harmonic?: number
}

/**
 * 「五声」「回响」底下很轻的持续音：音与音之间不掉进静默，呼吸带来的明暗也一直听得见。
 * 它有自己的低通，跟「长音」一样随吸呼从 700 Hz 开到 1.6 kHz（研究建议的范围）。
 * 混响只给一点：持续的纯音泡在长混响里，揉音扫过混响频响的峰谷，短期响度会跟着起伏
 */
export const PEDAL = {
  tone: {
    filterIdle: 1000,
    filterLo: 700,
    filterHi: 1600,
    filterQ: 0.3,
    driftLo: 850,
    driftHi: 1250,
    driftRate: 0.03,
    dry: 1,
    wet: 0.3,
  } satisfies ToneSpec,
  fadeIn: 6,
  quickIn: 1.2,
} as const

export const PLUCK = {
  seconds: 6,
  seed: 61,
  /** 基频衰减 60 dB 的时间，低音更长：t60 × (146.8 / f)^t60Slope */
  t60: 7,
  t60Slope: 0.4,
  /** 拨弦力度（0–1，越小越暗）与拨弦位置（弦长比例） */
  brightness: 0.45,
  position: 0.13,
  /** 琴身共鸣：峰值滤波 [频率, Q, 增益 dB] */
  body: [
    [180, 1.4, 5],
    [420, 1.6, 4],
    [1100, 1.2, 2],
  ] as readonly (readonly [number, number, number])[],
  /** 高频搁架衰减，木质、温和 */
  shelfHz: 3500,
  shelfDb: -6,
  /** 起音磨圆到 6 ms（研究建议 5–10 ms）；结尾 1.5 秒淡出 */
  attack: 0.006,
  release: 1.5,
} as const

export const PENTA = {
  /**
   * 起音间隔：均值 3.2 秒的指数分布（泊松过程），截在 min–max 之间，无节拍；睡前最短 2.2 秒（每秒不到 0.5 个）。
   * 上限 5.5 秒：再长，拨弦的余音和混响都散尽了，短期响度会掉下去好几个 LU
   */
  meanGap: 3.2,
  minGap: { relax: 1.1, sleep: 2.2 } satisfies Record<SoundMode, number>,
  maxGap: 5.5,
  /** 底下的持续音：D2、D3、A3 的空五度，比拨弦的平均电平低几 dB */
  pedal: [
    { midi: 38, amp: 0.32, pan: 0, harmonic: 0.3 },
    { midi: 50, amp: 0.48, pan: -0.25 },
    { midi: 57, amp: 0.38, pan: 0.25 },
  ] as readonly PedalVoice[],
  /** 旋律走向的权重：音阶步数 → 权重；偏向级进 */
  steps: [
    [-3, 0.04],
    [-2, 0.13],
    [-1, 0.3],
    [0, 0.04],
    [1, 0.3],
    [2, 0.13],
    [3, 0.04],
  ] as readonly (readonly [number, number])[],
  /** 把旋律拉回中间音区的力度 */
  gravity: 0.08,
  /** 偶尔的和音（五度或八度），稍晚一点、轻一点 */
  dyadChance: 0.18,
  dyadDelayLo: 0.02,
  dyadDelayHi: 0.06,
  dyadDb: -6,
  velocityLo: 0.5,
  velocityHi: 0.85,
  /**
   * 拨弦整体比持续音轻：短期响度的底子由持续音撑着，几个音挤在一起也只多出一两个 LU
   * （研究要求 20 秒内的升幅不超过 3 LU）。拨弦有起音、音区也高，比电平数字听起来清楚
   */
  noteDb: -5,
  /** 力度调节：近 3 秒的能量偏高时把下一个音调轻，最多到原力度的 0.5 倍 */
  governorTau: 3,
  governorFloor: 0.5,
  pan: 0.6,
  panJitter: 0.15,
  /** 力度越小音色越暗：每个音的低通在 lo–hi 之间 */
  noteCutLo: 2400,
  noteCutHi: 6000,
  firstNote: 1.2,
  quickFirstNote: 0.25,
  /** 拨弦的亮度跟随呼吸用更高的一段：700 Hz 会把起音闷掉 */
  tone: {
    filterIdle: 2600,
    filterLo: 1600,
    filterHi: 3600,
    filterQ: 0.5,
    driftLo: 2200,
    driftHi: 3200,
    driftRate: 0.025,
    dry: 0.75,
    wet: 0.7,
  } satisfies ToneSpec,
} as const

export const EP = {
  seconds: 10,
  seed: 71,
  /** 调频电钢琴：调制比 1:1 的温暖音体，指数衰减的调制指数 */
  index: 1.6,
  indexTau: 0.35,
  indexFloor: 0.25,
  /** 1:14 的「音叉」起音，很轻、很快消失 */
  tineRatio: 14,
  tineIndex: 1.2,
  tineTau: 0.03,
  tineLevel: 0.06,
  tineDecay: 0.08,
  /** 两段衰减：快段占比与时间常数、慢段时间常数（低音更长） */
  attack: 0.006,
  fastShare: 0.15,
  fastTau: 0.5,
  slowTau: 4.5,
  /** 失谐的第二个载波：缓慢的拍，听起来更暖 */
  chorusHz: 0.6,
  chorusLevel: 0.4,
  release: 1.5,
} as const

export interface PhasingVoice {
  midi: number
  period: number
  offset: number
  pan: number
}

export const PHASING = {
  /** 每个声部只重复一个音，周期互不成整数比（17–31 秒），组合永远在变；都在 D 宫五声里 */
  voices: [
    { midi: 50, period: 29.9, offset: 0.8, pan: -0.15 },
    { midi: 57, period: 21.7, offset: 2.6, pan: 0.35 },
    { midi: 66, period: 19.7, offset: 4.3, pan: -0.45 },
    { midi: 62, period: 17.3, offset: 6.1, pan: 0.1 },
    { midi: 59, period: 26.3, offset: 7.7, pan: 0.5 },
    { midi: 64, period: 23.9, offset: 9.4, pan: -0.3 },
  ] as readonly PhasingVoice[],
  /** 试听时声部进得更快 */
  quickScale: 0.35,
  /** 底下的持续音：D3、A3、E4（挂二），很轻，像余响连成的一片 */
  pedal: [
    { midi: 50, amp: 0.6, pan: -0.3 },
    { midi: 57, amp: 0.5, pan: 0.3 },
    { midi: 64, amp: 0.32, pan: 0 },
  ] as readonly PedalVoice[],
  velocityJitterDb: 1.5,
  /**
   * 电钢琴整体比持续音轻：周期互不成整数比，难免有十来秒没有音、随后三五个音挤在一起的时候，
   * 这时短期响度从持续音的底子升上去，力度调节只压得住挤在一起的音，压不住空了很久之后的第一个音。
   * 离线渲染 10 分钟，20 秒内的最大升幅：−9 dB 时 3.1 LU，−10 dB 时 2.9，−11 dB 时 2.7（要求 ≤ 3）。
   * 起音清楚，比平均电平听起来显眼得多
   */
  noteDb: -11,
  governorTau: 3,
  governorFloor: 0.5,
  tone: {
    filterIdle: 2200,
    filterLo: 1300,
    filterHi: 3000,
    filterQ: 0.5,
    driftLo: 1800,
    driftHi: 2600,
    driftRate: 0.02,
    dry: 0.6,
    wet: 0.85,
    /**
     * 电平起伏只用共用值的一半：电钢琴的亮度起伏（1.3 → 3 kHz，又在 K 计权抬高的频段）本身就大。
     * 箱式呼吸 + 滑音、只有这一层时，30 秒内的变化（8 个种子里最大）：1.2 dB 时 3 秒一步 3.08 LU、
     * 6 秒一步 3.18（要求 ≤ 3，产品允许每步 3–6 秒）；0.6 dB 时 2.72、2.75
     */
    swellDb: 0.6,
  } satisfies ToneSpec,
} as const

/** 三种音乐共用的混响冲激响应；必须按音频环境的采样率生成 */
export const REVERB = {
  /**
   * 冲激响应只在这个采样率生成（各层的校准 LAYER_TRIMS 就是用它做的），设备是别的采样率时由它带限重采样得到。
   * 直接按设备的采样率生成，噪声落在不同的采样上、阻尼按采样算，持续音碰上的峰谷全变了：44.1 kHz 上音乐响 1–2 LU
   */
  rate: 48000,
  seconds: 4.8,
  rt60: 4.2,
  seed: 99,
  predelay: 0.012,
  attack: 0.006,
  /** 随时间变暗：一阶低通的系数从 start 降到 end */
  dampStart: 0.8,
  dampEnd: 0.25,
  dampTau: 1.2,
  early: 10,
  fadeTail: 0.06,
} as const

/* ---------- 离线质检 ---------- */

export const QA = {
  sampleRate: 48000,
  /**
   * 另一个常见的设备采样率（很多 Windows、USB、蓝牙设备和旧 Mac）：经过卷积混响的音乐层在这里也要落在同样的电平上。
   * 混响的冲激响应是唯一随采样率生成的素材，其余素材都是固定采样率、由浏览器重采样播放
   */
  altRate: 44100,
  /** 同一层在两个采样率上的综合响度最多差这么多 LU */
  maxRateDiff: 0.3,
  /**
   * 跟随节拍的最坏情况（箱式呼吸 + 滑音、只有一层）：每步秒数，和各换几个随机种子。产品允许每步 3–6 秒（默认 4），
   * 屏息越长，短期响度在两头停得越久；起伏又随种子（音符、浪的细节）差 0.3 LU 左右。两头多测几个种子，余量是测出来的
   */
  boxRuns: [
    [3, 3],
    [4, 1],
    [6, 3],
  ] as readonly (readonly [step: number, seeds: number])[],
  /** 每个场景测 60 秒；前面留 12 秒给淡入、和弦与声部进入 */
  seconds: 60,
  preroll: 12,
  maxDc: 0.002,
  /** 咔哒声评分：单个采样的二阶差分相对附近 ±2 ms 的倍数 */
  maxClick: 10,
  /** 循环接缝：首尾样本差相对一阶差分 RMS 的倍数 */
  maxSeam: 6,
  /** 默认音量下限幅器不该动作（dB） */
  maxLimitDb: 0.5,
  seed: 1234,
  /** 校准时每层渲染的秒数：生成式音乐要够长才能测准平均响度 */
  calibrateSeconds: 180,
} as const
