/**
 * 计划登记表：按 ProgramId 取计划。今日页、计划页和测试都从这里取，不直接引用各个文件。
 * 键和计划自己的 id 必须一致；漏登一份通不过类型检查，登错 id 通不过 programs.test.ts。
 */
import type { Program, ProgramId } from '@/content/types'
import { breathing4wProgram } from './breathing-4w'
import { mindfulness8wProgram } from './mindfulness-8w'

export const PROGRAMS: Readonly<Record<ProgramId, Program>> = Object.freeze({
  'mindfulness-8w': mindfulness8wProgram,
  'breathing-4w': breathing4wProgram,
})

/** 按 id 取计划；id 来自存储或路由、不在登记表里时抛出 RangeError */
export function getProgram(id: ProgramId): Program {
  if (!Object.hasOwn(PROGRAMS, id)) throw new RangeError(`没有这个计划：${id}`)
  return PROGRAMS[id]
}
