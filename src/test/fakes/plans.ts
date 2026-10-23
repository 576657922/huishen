/**
 * 测试用的练习计划。默认值是一份 10 分钟、开着全部选项的专注练习（包括新的一句的轻提示和语音端口），按需覆盖字段；
 * 可选字段（cueStyle、endBell、bells、fadeInSec、prosody）不填，走引擎的默认值。
 *
 * @example
 * testPlan({ kind: 'timer', intervalSec: 120 })
 * pacedPlan({ type: 'sigh', cycle: 10.5 }, { plannedSec: 60, cueStyle: 'ping' })
 * slowPlan(5.5, { plannedSec: 300 })          // 慢呼吸，带开头放慢
 * guidedPlan(BREATHING_SPACE_SCRIPT, 3)
 * soundPlan({ plannedSec: 0, endBell: false }) // 不限时的睡前声音
 */
import type { SoundMix } from '@/audio/types'
import type { GuidedScript, PacedParams, PracticeId, ScriptId } from '@/content/types'
import { buildPattern, withWarmup } from '@/engine/patterns'
import { buildTimeline, type TimelineOptions } from '@/engine/timeline'
import type { SessionPlan } from '@/engine/types'

export const TEST_SOUND: Readonly<SoundMix> = {
  ambience: 'stream',
  music: 'none',
  ambienceVolume: 55,
  musicVolume: 40,
}

/** 不选背景声：出声时倒数不会被拉长到 3 秒，开始钟声就在计划的倒数之后 */
export const SILENT_SOUND: Readonly<SoundMix> = {
  ambience: 'none',
  music: 'none',
  ambienceVolume: 55,
  musicVolume: 40,
}

export function testPlan(overrides: Partial<SessionPlan> = {}): SessionPlan {
  return {
    practiceId: 'focus',
    kind: 'focus',
    title: '专注',
    plannedSec: 600,
    leadSec: 3,
    pattern: null,
    timeline: null,
    intervalSec: null,
    sound: { ...TEST_SOUND },
    cues: true,
    captionCue: true,
    voice: true,
    haptics: true,
    silentEnd: true,
    params: {},
    ...overrides,
  }
}

const PACED_PRACTICE: Record<PacedParams['type'], { id: PracticeId; title: string }> = {
  sigh: { id: 'cyclic-sigh', title: '周期性叹息' },
  resonance: { id: 'slow', title: '慢呼吸' },
  phases: { id: 'box', title: '箱式呼吸' },
}

export function pacedPlan(params: PacedParams, overrides: Partial<SessionPlan> = {}): SessionPlan {
  const practice = PACED_PRACTICE[params.type]
  return testPlan({
    practiceId: practice.id,
    kind: 'paced',
    title: practice.title,
    pattern: buildPattern(params),
    params: { ...params },
    ...overrides,
  })
}

/** 慢呼吸：吸 4.5 : 呼 6.5 的比例，开头从每分钟 8 次逐步放慢到 rate */
export function slowPlan(rate: number, overrides: Partial<SessionPlan> = {}): SessionPlan {
  const params: PacedParams = { type: 'resonance', rate, ratio: 'long' }
  return pacedPlan(params, { pattern: withWarmup(buildPattern(params)), ...overrides })
}

/** 只听声音：放松 20 分钟，无引导；睡前把 endBell 关掉、plannedSec 设为 0 即为不限时 */
export function soundPlan(overrides: Partial<SessionPlan> = {}): SessionPlan {
  return testPlan({
    practiceId: 'listen',
    kind: 'sound',
    title: '听声音',
    plannedSec: 1200,
    voice: false,
    haptics: false,
    ...overrides,
  })
}

/** 引导词所属的练习：变体（如入门版）归到主练习，其余与练习同名 */
function practiceOf(id: ScriptId): PracticeId {
  switch (id) {
    case 'breathing-space-intro':
      return 'breathing-space'
    default:
      return id
  }
}

export function guidedPlan(
  script: GuidedScript,
  minutes: number,
  overrides: Partial<SessionPlan> = {},
  options?: TimelineOptions,
): SessionPlan {
  const timeline = buildTimeline(script, minutes, options)
  return testPlan({
    practiceId: practiceOf(script.id),
    kind: 'guided',
    title: script.title,
    plannedSec: timeline.duration,
    timeline,
    ...(options?.prosody ? { prosody: options.prosody } : {}),
    ...overrides,
  })
}
