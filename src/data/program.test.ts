import { describe, expect, it } from 'vitest'
import {
  DAYS_PER_WEEK,
  MAX_PROGRAM_WEEKS,
  nextProgramDay,
  parseProgramDay,
  programDayIndex,
  programDayKey,
} from './program'
import type { ProgramProgress } from './types'

const progress = (done: string[]): ProgramProgress => ({ startedOn: '2026-10-19', done })

/** 前 n 天的键，按先后 */
const firstDays = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => programDayKey(Math.floor(i / 7) + 1, (i % 7) + 1))

describe('program day keys', () => {
  it('round-trips week and day', () => {
    expect(programDayKey(3, 2)).toBe('w3d2')
    expect(parseProgramDay('w3d2')).toEqual({ week: 3, day: 2 })
    expect(parseProgramDay(programDayKey(MAX_PROGRAM_WEEKS, DAYS_PER_WEEK))).toEqual({ week: 52, day: 7 })
  })

  it('rejects keys outside a program calendar', () => {
    for (const key of ['w0d1', 'w1d0', 'w1d8', 'w53d1', 'w01d1', 'W1D1', 'w1d1 ', 'w1', 'd1', '', 3, null]) {
      expect(parseProgramDay(key), String(key)).toBeNull()
    }
    expect(() => programDayKey(0, 1)).toThrow(RangeError)
    expect(() => programDayKey(1, 8)).toThrow(RangeError)
    expect(() => programDayKey(1.5, 1)).toThrow(RangeError)
  })

  it('orders days through the program', () => {
    expect(programDayIndex({ week: 1, day: 1 })).toBe(0)
    expect(programDayIndex({ week: 1, day: 7 })).toBe(6)
    expect(programDayIndex({ week: 2, day: 1 })).toBe(7)
    expect(programDayIndex({ week: 8, day: 7 })).toBe(55)
  })
})

describe('nextProgramDay', () => {
  it('starts at the first day', () => {
    expect(nextProgramDay(undefined, 8)).toEqual({ week: 1, day: 1 })
    expect(nextProgramDay(progress([]), 4)).toEqual({ week: 1, day: 1 })
  })

  it('goes on with the next day not done, whatever the calendar says', () => {
    expect(nextProgramDay(progress(firstDays(3)), 8)).toEqual({ week: 1, day: 4 })
    expect(nextProgramDay(progress(firstDays(7)), 8)).toEqual({ week: 2, day: 1 })
  })

  it('comes back for a day that was left out', () => {
    expect(nextProgramDay(progress(['w1d1', 'w1d3', 'w2d1']), 8)).toEqual({ week: 1, day: 2 })
  })

  it('is null once every day is done, ignoring days beyond the program', () => {
    expect(nextProgramDay(progress(firstDays(28)), 4)).toBeNull()
    expect(nextProgramDay(progress([...firstDays(27), 'w5d1']), 4)).toEqual({ week: 4, day: 7 })
  })

  it('survives a nonsense number of weeks', () => {
    expect(nextProgramDay(undefined, Number.NaN)).toBeNull()
    expect(nextProgramDay(undefined, 0)).toBeNull()
    expect(nextProgramDay(progress(firstDays(7)), 1.9)).toBeNull()
    expect(nextProgramDay(progress(firstDays(MAX_PROGRAM_WEEKS * 7)), 100)).toBeNull()
  })
})
