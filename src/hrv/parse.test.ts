import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/lib/random'
import { parseHeartRateMeasurement as parse } from './parse'

const packet = (...bytes: number[]) => new DataView(Uint8Array.from(bytes).buffer)
const u16 = (v: number) => [v & 0xff, v >> 8]
/** 设备上的原始 RR 值（1/1024 秒）换算成毫秒 */
const ms = (raw: number) => (raw * 1000) / 1024

describe('parseHeartRateMeasurement', () => {
  it('reads a uint8 heart rate', () => {
    expect(parse(packet(0x00, 72))).toEqual({ hr: 72, rr: [], contact: 'unsupported' })
  })

  it('reads a little-endian uint16 heart rate', () => {
    expect(parse(packet(0x01, 0x48, 0x00)).hr).toBe(72)
    expect(parse(packet(0x01, ...u16(266))).hr).toBe(266)
  })

  it('decodes the sensor contact bits', () => {
    expect(parse(packet(0x06, 60)).contact).toBe('detected')
    expect(parse(packet(0x04, 60)).contact).toBe('not-detected')
    // 「已接触」位只有在「支持接触检测」位置 1 时才有意义
    expect(parse(packet(0x02, 60)).contact).toBe('unsupported')
    expect(parse(packet(0x00, 60)).contact).toBe('unsupported')
  })

  it('reads energy expended', () => {
    expect(parse(packet(0x08, 70, 0x34, 0x12))).toEqual({
      hr: 70,
      rr: [],
      contact: 'unsupported',
      energy: 0x1234,
    })
  })

  it('converts every RR interval from 1/1024 s to ms', () => {
    expect(parse(packet(0x10, 60, ...u16(1024), ...u16(768), ...u16(1))).rr).toEqual([1000, 750, ms(1)])
  })

  it('reads all fields together, with energy before the RR intervals', () => {
    const m = parse(packet(0x1f, ...u16(65), ...u16(300), ...u16(950), ...u16(1000)))
    expect(m).toEqual({ hr: 65, rr: [ms(950), ms(1000)], contact: 'detected', energy: 300 })
  })

  it('ignores bytes that the flags do not announce', () => {
    expect(parse(packet(0x00, 60, ...u16(1024)))).toEqual({ hr: 60, rr: [], contact: 'unsupported' })
  })

  it('returns what it can from truncated packets', () => {
    expect(parse(new DataView(new ArrayBuffer(0)))).toEqual({ hr: 0, rr: [], contact: 'unsupported' })
    // 16 位心率只到了 1 个字节
    expect(parse(packet(0x07, 72))).toEqual({ hr: 0, rr: [], contact: 'detected' })
    // 能量字段不完整，后面的 RR 位置无从确定
    expect(parse(packet(0x18, 70, 0x10))).toEqual({ hr: 70, rr: [], contact: 'unsupported' })
    // 最后一个 RR 只到了半个
    expect(parse(packet(0x10, 70, ...u16(1024), 0x04)).rr).toEqual([1000])
    expect(parse(packet(0x10, 70)).rr).toEqual([])
  })

  it('reads relative to the view offset', () => {
    const bytes = Uint8Array.from([0xff, 0xff, 0x10, 60, ...u16(1024), 0xff])
    expect(parse(new DataView(bytes.buffer, 2, 4))).toEqual({ hr: 60, rr: [1000], contact: 'unsupported' })
  })

  it('never throws on random bytes', () => {
    const rand = mulberry32(7)
    for (let i = 0; i < 2000; i++) {
      const bytes = Array.from({ length: Math.floor(rand() * 12) }, () => Math.floor(rand() * 256))
      const m = parse(packet(...bytes))
      expect(m.hr).toBeGreaterThanOrEqual(0)
      expect(m.rr.every(x => x >= 0 && x < 65536)).toBe(true)
    }
  })
})
