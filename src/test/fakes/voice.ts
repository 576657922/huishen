/**
 * 假的语音端口：不出声，按顺序记录朗读和打断。
 *
 * @example
 * const voice = new FakeVoice()
 * voice.spoken      // ['找一个舒服的坐姿。', ...]
 * voice.log         // 含 cancel 和每句的语速、音量倍数，用来检查「暂停后不再朗读」「越说越轻」
 */
import type { SpeakOptions, VoicePort } from '@/engine/types'

export type VoiceEvent =
  | { type: 'speak'; text: string; at: number; opts?: SpeakOptions }
  | { type: 'cancel'; at: number }

export interface FakeVoiceOptions {
  /** 设备是否有可用的中文语音，默认有 */
  available?: boolean
  /** 毫秒时钟，用来给事件打时间戳；默认 () => performance.now() */
  perfNow?: () => number
}

export class FakeVoice implements VoicePort {
  /** 可在测试中途修改，模拟语音被系统收回 */
  isAvailable: boolean
  /** 按顺序记录的朗读与打断，at 为毫秒时钟；朗读带了倍数时记在 opts */
  readonly log: VoiceEvent[] = []
  private readonly perfNow: () => number

  constructor(options: FakeVoiceOptions = {}) {
    this.isAvailable = options.available ?? true
    this.perfNow = options.perfNow ?? (() => performance.now())
  }

  available(): boolean {
    return this.isAvailable
  }

  speak(text: string, opts?: SpeakOptions): void {
    const at = this.perfNow()
    this.log.push(
      opts === undefined ? { type: 'speak', text, at } : { type: 'speak', text, at, opts: { ...opts } },
    )
  }

  cancel(): void {
    this.log.push({ type: 'cancel', at: this.perfNow() })
  }

  /** 朗读过的文字，按顺序 */
  get spoken(): string[] {
    return this.log.flatMap(e => (e.type === 'speak' ? [e.text] : []))
  }

  /** 被打断的次数 */
  get cancels(): number {
    return this.log.filter(e => e.type === 'cancel').length
  }
}
