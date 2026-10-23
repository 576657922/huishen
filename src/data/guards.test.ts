import { describe, expect, it } from 'vitest'
import type { PracticeId } from '@/content/types'
import {
  bool,
  cleanText,
  dayKeyToUTC,
  finite,
  intIn,
  isAmbienceId,
  isClockTime,
  isCueStyle,
  isDayKey,
  isFeeling,
  isGuidanceLevel,
  isInstant,
  isMusicId,
  isPlainObject,
  isPracticeId,
  isPracticeKind,
  isProgramId,
  isSoundMode,
  isTheme,
  realIn,
  within,
} from './guards'

describe('membership guards', () => {
  it('accepts every practice in the catalog, so no practice loses its records', () => {
    // 目录（PRODUCT.md §2）里的全部练习，以及还在迁移中的旧 id
    const ids: PracticeId[] = [
      'focus',
      'breath-count',
      'body-scan',
      'body-scan-sleep',
      'loving-kindness',
      'self-compassion',
      'breathing-space',
      'breathing-space-coping',
      'open-awareness',
      'walking',
      'pause',
      'grounding',
      'timer',
      'slow',
      'cyclic-sigh',
      'box',
      'pace-finder',
      'listen',
      'sleep',
      'resonance',
      'extended-exhale',
      'rf-assessment',
      'soundscape',
    ]
    for (const id of ids) expect(isPracticeId(id), id).toBe(true)
  })

  it('accepts known ids only', () => {
    expect(isPracticeId('qigong')).toBe(false)
    expect(isPracticeId('Focus')).toBe(false)
    expect(isPracticeId(undefined)).toBe(false)
    expect(isPracticeKind('paced')).toBe(true)
    expect(isPracticeKind('breathing')).toBe(false)
    expect(isAmbienceId('rain')).toBe(true)
    expect(isAmbienceId('pad')).toBe(false)
    // 声音层后加的林间、鸟鸣和两种噪声
    expect(['forest', 'birds', 'pink', 'brown'].every(isAmbienceId)).toBe(true)
    expect(isMusicId('phasing')).toBe(true)
    expect(isMusicId(3)).toBe(false)
    expect(isFeeling('calmer')).toBe(true)
    expect(isFeeling('unwell')).toBe(true)
    expect(isFeeling('happy')).toBe(false)
    expect(isFeeling(null)).toBe(false)
  })

  it('knows the settings enums', () => {
    expect(['system', 'light', 'dark'].every(isTheme)).toBe(true)
    expect(isTheme('neon')).toBe(false)
    expect(['quiet', 'standard', 'detailed'].every(isGuidanceLevel)).toBe(true)
    expect(isGuidanceLevel('loud')).toBe(false)
    expect(['glide', 'ping', 'bed', 'off'].every(isCueStyle)).toBe(true)
    expect(isCueStyle('beep')).toBe(false)
    expect(isCueStyle(undefined)).toBe(false)
    expect(['relax', 'sleep'].every(isSoundMode)).toBe(true)
    expect(isSoundMode('nap')).toBe(false)
    expect(['mindfulness-8w', 'breathing-4w'].every(isProgramId)).toBe(true)
    expect(isProgramId('mbsr')).toBe(false)
  })

  it('is not fooled by inherited properties', () => {
    expect(isPracticeId('toString')).toBe(false)
    expect(isPracticeId('__proto__')).toBe(false)
    expect(isAmbienceId('constructor')).toBe(false)
    expect(isFeeling('hasOwnProperty')).toBe(false)
  })
})

describe('isPlainObject', () => {
  it('accepts JSON-like objects only', () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject(Object.create(null))).toBe(true)
    expect(isPlainObject(JSON.parse('{"a":1}'))).toBe(true)
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject(new Date())).toBe(false)
    expect(isPlainObject(new Map())).toBe(false)
    expect(isPlainObject('x')).toBe(false)
  })
})

describe('numbers', () => {
  it('finite rejects NaN, Infinity and numeric strings', () => {
    expect(finite(1.5)).toBe(1.5)
    expect(finite(Number.NaN)).toBeNull()
    expect(finite(Number.POSITIVE_INFINITY)).toBeNull()
    expect(finite('3')).toBeNull()
  })

  it('intIn rounds and clamps', () => {
    expect(intIn(4.6, 0, 10)).toBe(5)
    expect(intIn(-3, 0, 10)).toBe(0)
    expect(intIn(99, 0, 10)).toBe(10)
    expect(intIn(null, 0, 10)).toBeNull()
  })

  it('realIn keeps two decimals and clamps', () => {
    expect(realIn(0.9000000001, 0.5, 1.5)).toBe(0.9)
    expect(realIn(5.456, 3, 10)).toBe(5.46)
    expect(realIn(20, 3, 10)).toBe(10)
  })

  it('within rejects out-of-range values instead of clamping', () => {
    expect(within(60, 25, 240)).toBe(60)
    expect(within(300, 25, 240)).toBeNull()
    expect(within(-1, 0, 10)).toBeNull()
  })

  it('bool falls back for non-booleans', () => {
    expect(bool(false, true)).toBe(false)
    expect(bool('false', true)).toBe(true)
    expect(bool(0, true)).toBe(true)
  })
})

describe('dates and times', () => {
  it('validates calendar day keys', () => {
    expect(isDayKey('2026-10-22')).toBe(true)
    expect(isDayKey('2024-02-29')).toBe(true)
    expect(isDayKey('2026-02-29')).toBe(false)
    expect(isDayKey('2026-13-01')).toBe(false)
    expect(isDayKey('2026-1-1')).toBe(false)
    expect(isDayKey('2026-10-22T00:00')).toBe(false)
    expect(isDayKey(20261022)).toBe(false)
  })

  it('maps day keys to UTC midnight regardless of the local zone', () => {
    expect(dayKeyToUTC('2026-10-22')).toBe(Date.UTC(2026, 9, 22))
    expect(dayKeyToUTC('0099-01-01')).toBe(new Date('0099-01-01T00:00:00Z').getTime())
    expect(dayKeyToUTC('nope')).toBeNull()
  })

  it('validates 24-hour clock times', () => {
    expect(isClockTime('07:30')).toBe(true)
    expect(isClockTime('23:59')).toBe(true)
    expect(isClockTime('24:00')).toBe(false)
    expect(isClockTime('7:30')).toBe(false)
    expect(isClockTime('07:60')).toBe(false)
  })

  it('accepts ISO date-times only, not whatever Date.parse can read', () => {
    expect(isInstant('2026-10-22T07:30:00.000Z')).toBe(true)
    expect(isInstant('2026-10-22T07:30+08:00')).toBe(true)
    for (const x of ['1', '2026', '2026-10-22', 'Oct 22 2026', '2026-10-22 07:30', '2026-13-22T07:30Z', 7]) {
      expect(isInstant(x), String(x)).toBe(false)
    }
    expect(isInstant(`2026-10-22T07:30:00.000Z${' '.repeat(40)}`)).toBe(false)
  })
})

describe('cleanText', () => {
  it('strips control characters and trims', () => {
    expect(cleanText('  早上\u0000好\u0007 ', 20)).toBe('早上好')
    expect(cleanText('a\tb', 20)).toBe('a b')
    expect(cleanText('   ', 20)).toBeNull()
    expect(cleanText(42, 20)).toBeNull()
  })

  it('keeps newlines only when multiline', () => {
    expect(cleanText('一\r\n二\r三', 20, true)).toBe('一\n二\n三')
    expect(cleanText('一\n二', 20)).toBe('一二')
  })

  it('truncates by characters without splitting surrogate pairs', () => {
    expect(cleanText('🌊🌊🌊', 2)).toBe('🌊🌊')
    expect(cleanText('回神回神', 3)).toBe('回神回')
  })

  it('drops lone surrogates', () => {
    expect(cleanText('a\ud800b', 10)).toBe('ab')
  })
})
