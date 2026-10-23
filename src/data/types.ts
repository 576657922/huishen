/**
 * 数据层的类型。练习记录存在 IndexedDB，偏好存在 localStorage；
 * 全部只在本机，可以导出、导入、清空。
 */
import type { AmbienceId, MusicId, SoundMix, SoundMode } from '@/audio/types'
import type { GuidanceLevel, PracticeId, PracticeKind, ProgramId } from '@/content/types'
import type { CueStyle } from '@/engine/types'

export const RECORD_VERSION = 1

/** 练完的感觉，一次点选：更平静 / 差不多 / 更紧张 / 很不舒服 */
export type Feeling = 'calmer' | 'same' | 'tenser' | 'unwell'

export interface SessionRecord {
  v: typeof RECORD_VERSION
  id: string
  practiceId: PracticeId
  kind: PracticeKind
  /** ISO 时间 */
  startedAt: string
  /** 开始时的本地日期 YYYY-MM-DD */
  date: string
  plannedSec: number
  actualSec: number
  completed: boolean
  /**
   * 用了什么背景声。mode 为声音的模式：听声音的记录总有（旧记录没有，按放松计）；
   * 其他练习只在计划里写明时才有。睡前之后不问练后的感受，统计也可以据此分开
   */
  sound: { ambience: AmbienceId; music: MusicId; mode?: SoundMode }
  /** 节拍参数等，如 { rate: 5.5, ratio: 'equal' } */
  params: Record<string, number | string>
  /** 专注：每次回神的练习秒数 */
  marks?: number[]
  /**
   * 数息。invalid 为点得太快、不可能是真实呼吸的轮数（cycles = correct + errors + invalid），
   * 引擎加上这一项之前的记录没有它，按 0 计
   */
  count?: { cycles: number; correct: number; errors: number; resets: number; invalid?: number }
  /** 跟随节拍：完成的轮数和每分钟次数（「有点急」调过时为最后稳定的速度，计划的速度在 params 里） */
  breaths?: number
  rate?: number
  /** 跟随节拍：「有点急」生效的次数。旧记录没有 */
  rateSteps?: number
  /** 引导练习里跳过的段落 id（如身体扫描的部位），按先后；没跳过时没有这一项 */
  skipped?: string[]
  /** 练习前后的紧张程度自评，0 = 完全放松，10 = 极度紧张 */
  checkin?: { pre?: number; post?: number }
  /** 练完的感觉；最近几次多是「更紧张」「很不舒服」时，应用会建议换更温和的练习 */
  feeling?: Feeling
  /** 连接心率带时的摘要 */
  hrv?: { meanHr?: number; rmssd?: number; amplitude?: number }
  note?: string
}

export interface SessionRepo {
  /** 按开始时间倒序 */
  all(): Promise<SessionRecord[]>
  add(record: SessionRecord): Promise<void>
  /**
   * 浅合并，值为 undefined 的项会被删除。checkin 例外，按 pre、post 分项合并：练习前后的自评分两次填，
   * 练完补上 { checkin: { post } } 不会丢掉练习前的分数；只想去掉一项时把它设为 undefined
   */
  update(id: string, patch: Partial<Omit<SessionRecord, 'id' | 'v'>>): Promise<void>
  remove(id: string): Promise<void>
  clear(): Promise<void>
  /** 按 id 去重合并 */
  importMany(records: SessionRecord[]): Promise<{ added: number; skipped: number }>
  /** 数据变化时通知（含其他标签页的变化） */
  subscribe(listener: () => void): () => void
}

/**
 * 记录实际存放的位置：indexeddb 为正常情况；local 表示 IndexedDB 不可用、退到 localStorage（最多保留 500 条）；
 * memory 表示连 localStorage 也写不进去，关闭页面后记录会丢失，设置页应提示用户导出。
 */
export type StorageMode = 'indexeddb' | 'local' | 'memory'

/* ---------- 偏好 ---------- */

/**
 * 偏好的格式版本。v1 的 checkin、safetyAck、plan、program 在读取时迁移成 v2 的形状。
 * v2 之内只增删可以缺省的项（不需要迁移）：旧数据里的 voice（v1 没有语音引导，已去掉）读取时直接忽略，
 * 新加的 captionCue、bells、practice[id].warmup、practice[id].phaseSec 缺了就用默认
 */
export const PREFS_VERSION = 2

export type ThemePref = 'system' | 'light' | 'dark'

/** 静坐计时的间隔钟声（分钟），0 为不响 */
export type IntervalBell = 0 | 5 | 10

export interface PracticePrefs {
  minutes?: number
  ambience?: AmbienceId
  music?: MusicId
  /** 慢呼吸（共振呼吸）的每分钟次数，4.5–7.0（engine 的 SLOW_RATE_MIN–SLOW_RATE_MAX，PRODUCT §2） */
  rate?: number
  ratio?: 'equal' | 'long'
  /** 慢呼吸开头约 90 秒从每分钟 8 次逐步放慢；没有这一项时按开（默认开） */
  warmup?: boolean
  /** 周期性叹息每轮秒数 */
  cycle?: number
  /** 箱式呼吸每一步（吸、停、呼、停）的秒数，3–6（engine 的 BOX_PHASE_MIN_SEC–BOX_PHASE_MAX_SEC）；没有时按 4 */
  phaseSec?: number
  /** @deprecated 静坐计时的间隔钟声改用 Prefs.intervalBell；旧数据里的值在迁移时搬过去 */
  interval?: number
}

/** 练习前后问什么。睡前的声音之后两样都不问（应用的逻辑，不用存） */
export interface CheckinPrefs {
  /** 练习前、练习后各问一次「此刻有多紧张？」0–10 */
  prePost: boolean
  /** 练习后点选一次「练完感觉」 */
  feeling: boolean
}

/** 一次每周压力自评 */
export interface StressRating {
  /** 自评那天的本地日期 YYYY-MM-DD */
  date: string
  /** 量表得分；用哪个量表由自评功能决定，这里只保证是 0–100 的有限数 */
  score: number
}

/** 某个模式默认的背景声：声景、音乐和各自音量，可以直接交给声音层 */
export interface SoundDefault extends SoundMix {
  mode: SoundMode
}

/**
 * 执行意图式的提醒（PRODUCT.md §8）：在【cue】，我会做【action】；如果【太累】，就只做【fallback】。
 * 设置页据此生成日历文件，工作日和周末各自一个时刻
 */
export interface Reminders {
  /** 触发练习的情境，如「刷牙后」；可以为空 */
  cue: string
  /** 打算做什么，如「3 分钟呼吸」 */
  action: string
  /** 太累时的保底，如「1 分钟」；可以为空 */
  fallback: string
  /** 周一到周五提醒的本地时刻 HH:MM；null 为工作日不提醒 */
  weekday: string | null
  /** 周六、周日提醒的本地时刻 HH:MM；null 为周末不提醒 */
  weekend: string | null
}

/** 健康情况检查（可选，只存本机）：true 表示有这种情况，应用据此调整默认值和可见的练习 */
export interface Screening {
  pregnancy: boolean
  heart: boolean
  respiratory: boolean
  psychosis: boolean
  bipolar: boolean
  epilepsy: boolean
  trauma: boolean
  panic: boolean
}

export interface SafetyPrefs {
  /** 读完「开始之前」须知的日期 */
  ackOn: string | null
  /** 没做过健康情况检查时为 null */
  screening: Screening | null
  /** 每月一次「练习后的变化自查」 */
  monthlyCheck: boolean
  /**
   * 最近一次做（或跳过）每月自查的日期 YYYY-MM-DD，据此一个月后再问；从没问过时没有这一项。
   * 只记日期，不存回答
   */
  monthlyCheckedOn?: string
}

/** 计划的进度：按完成了哪几天推进，不按日历；漏了的日子不算落后 */
export interface ProgramProgress {
  /** 加入的日期 YYYY-MM-DD */
  startedOn: string
  /** 完成的天，如 'w3d2' 为第 3 周第 2 天；按周、天先后排列，不重复 */
  done: string[]
  /**
   * 最近完成一天的日期 YYYY-MM-DD；还没完成过时没有这一项。
   * 今天已经完成一天时，今日页不接着推下一天（content/today.ts 的 lastCompletedOn）
   */
  lastDoneOn?: string
}

export interface Prefs {
  v: typeof PREFS_VERSION
  theme: ThemePref
  /** 0–100 */
  volume: { master: number; ambience: number; music: number; cues: number }
  /** 引导详细程度，默认标准 */
  guidance: GuidanceLevel
  /**
   * 文字引导：新的一句如果隔了 20 秒以上才出现，轻响一声（设置 › 文字引导「新的一句出现时轻提示」），默认开。
   * v1 没有语音朗读（PRODUCT §0），没有语音和语速的设置
   */
  captionCue: boolean
  /** 跟随节拍时怎样提示吸呼，默认滑音 */
  cueStyle: CueStyle
  /** 回神、数息、段落切换的提示音；节拍的提示看 cueStyle */
  cues: boolean
  /** 开始和结束的钟声（设置 › 声音 › 钟声），默认开。睡前的练习本来就不敲结束钟；间隔钟声看 intervalBell */
  bells: boolean
  /** 静坐计时的间隔钟声（设置 › 声音 › 间隔钟声），默认不响 */
  intervalBell: IntervalBell
  haptics: boolean
  /** 开头倒数秒数 */
  leadIn: number
  silentEnd: boolean
  /** 练习前后自评默认关，练完感觉默认开 */
  checkin: CheckinPrefs
  /** 邀请做每周压力自评，默认关 */
  weeklyStress: boolean
  /** 每周压力自评的结果，按日期先后，一天一次，最多保留最近 200 次 */
  stressRatings: StressRating[]
  /** 听声音时两种模式各自默认的背景声 */
  sounds: Record<SoundMode, SoundDefault>
  practice: Partial<Record<PracticeId, PracticePrefs>>
  /** 个人呼吸速度（次/分，4.5–7.0）：舒适节律探索的结果，或「有点急」之后记住的速度 */
  personalRate: number | null
  onboarded: boolean
  safety: SafetyPrefs
  /** 「何时、做什么、太累时做多少」的提醒计划 */
  reminders: Reminders | null
  /** 加入了的计划及其进度；没加入的计划没有这一项 */
  programs: Partial<Record<ProgramId, ProgramProgress>>
}
