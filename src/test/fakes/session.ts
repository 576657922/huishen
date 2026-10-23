/**
 * 把会话控制器和三个假端口接在一起，供引擎、界面和集成测试使用。
 * 需要先调用 vi.useFakeTimers()：假声音时钟由 performance.now() 推动。
 *
 * @example
 * vi.useFakeTimers()
 * const s = createTestSession()
 * await s.ctrl.start(testPlan({ plannedSec: 60 }))
 * await s.advanceTo(30)          // 练习进行到第 30 秒
 * s.ctrl.mark()
 * await s.advanceTo(60)
 * s.results[0]?.completed        // true
 */
import { vi } from 'vitest'
import { createSessionController, leadFor, type SessionOptions, START_DELAY_SEC } from '@/engine/session'
import type { SessionController, SessionPlan, SessionResult, SessionState } from '@/engine/types'
import { FAKE_AUDIO_START, type FakeAudioOptions, FakeAudioPort } from './audio'
import { FakePlatform, type FakePlatformOptions } from './platform'
import { FakeVoice, type FakeVoiceOptions } from './voice'

export interface TestSessionOptions {
  audio?: FakeAudioOptions
  voice?: FakeVoiceOptions
  platform?: FakePlatformOptions
  session?: SessionOptions
}

export interface TestSession {
  ctrl: SessionController
  audio: FakeAudioPort
  voice: FakeVoice
  platform: FakePlatform
  /** 每次通知时的状态快照，按顺序 */
  states: SessionState[]
  /** onFinish 收到的结果 */
  results: SessionResult[]
  /** 推进假计时器若干毫秒，期间的定时器和微任务都会跑完 */
  advance(ms: number): Promise<void>
  /** 推进到练习的第 sec 秒（倒数期间为负）；已经过了就什么也不做 */
  advanceTo(sec: number): Promise<void>
}

export function createTestSession(options: TestSessionOptions = {}): TestSession {
  const audio = new FakeAudioPort(options.audio)
  const voice = new FakeVoice(options.voice)
  const platform = new FakePlatform(options.platform)
  const ctrl = createSessionController({ audio, voice, platform }, options.session)
  const states: SessionState[] = []
  const results: SessionResult[] = []
  ctrl.subscribe(() => states.push(ctrl.getState()))
  ctrl.onFinish(r => results.push(r))
  const scale = options.session?.timeScale ?? 1

  const advance = async (ms: number): Promise<void> => {
    await vi.advanceTimersByTimeAsync(ms)
  }

  return {
    ctrl,
    audio,
    voice,
    platform,
    states,
    results,
    advance,
    async advanceTo(sec) {
      const st = ctrl.getState().status
      if (st !== 'lead' && st !== 'running') return
      const ms = ((sec - ctrl.time()) * 1000) / scale
      if (ms > 0) await advance(Math.ceil(ms))
    },
  }
}

/**
 * 出声的练习里，练习第 0 秒在假声音时钟上的位置。
 * 只对「新建测试会话后马上开始」的练习成立：那时假声音时钟还停在起点 audioStart
 */
export function practiceOrigin(plan: SessionPlan, audioStart: number = FAKE_AUDIO_START): number {
  return audioStart + START_DELAY_SEC + leadFor(plan, true)
}
