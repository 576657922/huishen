/**
 * 引导词登记表：按 ScriptId 取引导词。播放器、计划和测试都从这里取，不直接引用各个文件。
 * 键和引导词自己的 id 必须一致；漏登一份通不过类型检查，登错 id 通不过 scripts.test.ts。
 */
import type { GuidedScript, ScriptId } from '@/content/types'
import { bodyScanScript } from './body-scan'
import { bodyScanSleepScript } from './body-scan-sleep'
import { breathCountScript } from './breath-count'
import { boxScript, cyclicSighScript, slowScript } from './breathing'
import {
  breathingSpaceCopingScript,
  breathingSpaceIntroScript,
  breathingSpaceScript,
} from './breathing-space'
import { focusScript } from './focus'
import { groundingScript } from './grounding'
import { lovingKindnessScript } from './loving-kindness'
import { openAwarenessScript } from './open-awareness'
import { pauseScript } from './pause'
import { selfCompassionScript } from './self-compassion'
import { walkingScript } from './walking'

export const SCRIPTS: Readonly<Record<ScriptId, GuidedScript>> = Object.freeze({
  focus: focusScript,
  'breath-count': breathCountScript,
  'body-scan': bodyScanScript,
  'body-scan-sleep': bodyScanSleepScript,
  'loving-kindness': lovingKindnessScript,
  'self-compassion': selfCompassionScript,
  'breathing-space': breathingSpaceScript,
  'breathing-space-intro': breathingSpaceIntroScript,
  'breathing-space-coping': breathingSpaceCopingScript,
  'open-awareness': openAwarenessScript,
  walking: walkingScript,
  pause: pauseScript,
  grounding: groundingScript,
  slow: slowScript,
  'cyclic-sigh': cyclicSighScript,
  box: boxScript,
})

/** 按 id 取引导词；id 来自存储或路由、不在登记表里时抛出 RangeError */
export function getScript(id: ScriptId): GuidedScript {
  if (!Object.hasOwn(SCRIPTS, id)) throw new RangeError(`没有这份引导词：${id}`)
  return SCRIPTS[id]
}
