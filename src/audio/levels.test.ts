import { describe, expect, it } from 'vitest'
import { gainToDb } from './dsp/util'
import {
  bellSpan,
  bellStrikes,
  cueGain,
  glideAmp,
  layerTarget,
  oneShotDb,
  presenceDb,
  volumeGain,
} from './levels'
import { BELL, LEVELS, LOUDNESS } from './params'

const power = (db: number): number => 10 ** (db / 10)

describe('volume curve', () => {
  it('maps 0–100 to gain with the master bus untouched at 100', () => {
    expect(volumeGain(0, 'ambience')).toBe(0)
    expect(volumeGain(100, 'master')).toBe(1)
    expect(volumeGain(100, 'music')).toBeCloseTo(1.4)
    expect(volumeGain(150, 'master')).toBe(1)
    expect(volumeGain(Number.NaN, 'cues')).toBe(0)
    let prev = -1
    for (let v = 0; v <= 100; v += 5) {
      const g = volumeGain(v, 'cues')
      expect(g).toBeGreaterThan(prev)
      prev = g
    }
  })
})

describe('bed loudness shares', () => {
  it('the two layers together add up to the target in either mode', () => {
    for (const mode of ['relax', 'sleep'] as const) {
      const sum = power(layerTarget('ambience', mode)) + power(layerTarget('music', mode))
      expect(10 * Math.log10(sum)).toBeCloseTo(LOUDNESS.target[mode], 6)
    }
  })

  it('a layer playing alone is lifted by exactly the other layer’s share', () => {
    expect(presenceDb('ambience', true)).toBe(0)
    expect(presenceDb('music', true)).toBe(0)
    for (const kind of ['ambience', 'music'] as const)
      expect(layerTarget(kind, 'relax') + presenceDb(kind, false)).toBeCloseTo(LOUDNESS.target.relax, 6)
  })
})

describe('one-shot levels', () => {
  it('cues sit relative to the bed target; the light ones are lighter', () => {
    expect(gainToDb(cueGain('in')) - gainToDb(cueGain('hold'))).toBeCloseTo(
      LEVELS.cues.in - LEVELS.cues.hold,
      6,
    )
    expect(cueGain('tap')).toBeLessThan(cueGain('in'))
    expect(cueGain('rest')).toBeLessThan(cueGain('out'))
    expect(gainToDb(cueGain('section'))).toBeCloseTo(oneShotDb(LEVELS.cues.section), 6)
  })

  it('the new-line cue of text guidance is very soft: well below the section chime and the 回神 cue', () => {
    expect(gainToDb(cueGain('caption'))).toBeCloseTo(oneShotDb(LEVELS.cues.caption), 6)
    expect(LEVELS.cues.section - LEVELS.cues.caption).toBeGreaterThanOrEqual(4)
    expect(cueGain('caption')).toBeLessThan(cueGain('mark'))
    expect(cueGain('caption')).toBeGreaterThan(cueGain('tap'))
  })

  it('bells: one strike to start, a softer one between, three strikes 7 s apart to end', () => {
    expect(bellStrikes('start')).toHaveLength(1)
    const [interval] = bellStrikes('interval')
    expect(interval![1]).toBeLessThan(bellStrikes('start')[0]![1])
    const end = bellStrikes('end')
    expect(end.map(([t]) => t)).toEqual([0, 7, 14])
    for (let i = 1; i < end.length; i++) expect(end[i]![1]).toBeLessThan(end[i - 1]![1])
    expect(bellSpan('end')).toBe(14 + BELL.seconds)
  })

  it('the glide tone is a positive, finite amplitude well below full scale', () => {
    const a = glideAmp()
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThan(0.5)
  })
})
