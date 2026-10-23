/**
 * 声音层的公共类型。实现见 ./engine.ts；会话引擎只通过 engine/types.ts 里的 AudioPort 调用它。
 */
import type { AudioPort } from '@/engine/types'

/**
 * 自然声与噪声：雨、溪流、海浪、林间（溪流 + 鸟 + 风）、鸟鸣（白天；睡前模式不出鸟声）、风，
 * 以及粉噪声、棕噪声（遮蔽环境噪音，证据很弱）
 */
export type AmbienceId = 'none' | 'rain' | 'stream' | 'ocean' | 'forest' | 'birds' | 'wind' | 'pink' | 'brown'

/** 生成式音乐：长音、五声（风格，无健康声明）、回响 */
export type MusicId = 'none' | 'drone' | 'pentatonic' | 'phasing'

/**
 * relax：放松与冥想（−23 LUFS）；sleep：睡前（再轻 5 LU，3 kHz 低通，淡入 20 秒，和声 16–24 秒一换，没有鸟声）
 */
export type SoundMode = 'relax' | 'sleep'

/** 一次练习里的背景声组合：一层声景加一层音乐，各自音量 0–100 */
export interface SoundMix {
  ambience: AmbienceId
  music: MusicId
  ambienceVolume: number
  musicVolume: number
  /** 默认 relax */
  mode?: SoundMode
}

export type Bus = 'master' | 'ambience' | 'music' | 'cues'

/**
 * 节拍提示音：吸、再吸、屏息、呼、停，以及回神、数息、段落切换；
 * caption 为文字引导里安静了 20 秒以上、再出现新的一句时很轻的一声（PRODUCT §5）
 */
export type CueKind =
  | 'in'
  | 'in2'
  | 'hold'
  | 'out'
  | 'rest'
  | 'mark'
  | 'tap'
  | 'ninth'
  | 'section'
  | 'caption'

/** 钟声：开始、结束、间隔 */
export type BellKind = 'start' | 'end' | 'interval'

export interface Scheduled {
  /** 撤销尚未响起的声音；已经响起的会快速淡出 */
  cancel(): void
}

/* ---------- 声音层对外的完整接口（会话引擎只用其中的 AudioPort 部分） ---------- */

/** 正在试听的组合 */
export interface PreviewState {
  ambience: AmbienceId
  music: MusicId
}

/** 浏览器里的声音引擎：AudioPort 加上试听、预热、人声压低 */
export interface AudioEngine extends AudioPort {
  /**
   * 有人声时把声景和音乐压低 8 dB（0.3 秒压下，1.5 秒恢复）。v1 没有语音引导，应用不调用它；
   * 留给以后的真人录音（PRODUCT §0）
   */
  setDuck(on: boolean): void
  /** 空闲时试听一个组合，默认 7 秒，带淡入淡出；必须在用户手势里调用。练习进行中不试听 */
  preview(mix: SoundMix, seconds?: number): void
  stopPreview(): void
  previewing(): PreviewState | null
  /** 试听开始或结束时通知（试听到时自己结束，界面要据此更新） */
  onPreviewChange(listener: () => void): () => void
  /** 空闲时预先生成这个组合要用的素材，开始练习时不用等 */
  warm(mix: Pick<SoundMix, 'ambience' | 'music'>): void
  /** 停止一切并关闭音频环境；之后不能再用 */
  dispose(): void
}
