import { describe, expect, it } from 'vitest'
import { PRACTICES } from '@/content/practices'
import { buildPattern, patternAt } from '@/engine/patterns'
import { GLYPH_IDS, glyphShape, isGlyphId, programGlyph } from './glyphs'

/** 路径里所有的坐标点（绝对坐标的 M / L / H / V / C / S 命令） */
function points(d: string): [number, number][] {
  const out: [number, number][] = []
  let x = 0
  let y = 0
  for (const [, cmd, args] of d.matchAll(/([MLHVCSZhvZ])([^MLHVCSZhvZ]*)/g)) {
    const nums = (args ?? '')
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
    if (cmd === 'H') x = nums[0] ?? x
    else if (cmd === 'V') y = nums[0] ?? y
    else if (cmd === 'h') x += nums[0] ?? 0
    else if (cmd === 'v') y += nums[0] ?? 0
    else if (cmd === 'Z') continue
    else {
      x = nums[nums.length - 2] ?? x
      y = nums[nums.length - 1] ?? y
    }
    out.push([x, y])
  }
  return out
}

describe('呼吸字形（DESIGN.md §8.6）', () => {
  it('每个练习都有自己的字形，全部画在 48 × 24 的绘制区里（y 3.5–20.5）', () => {
    expect(GLYPH_IDS).toHaveLength(19)
    for (const id of GLYPH_IDS) {
      const pts = points(glyphShape(id).d)
      expect(pts.length, id).toBeGreaterThan(1)
      for (const [x, y] of pts) {
        expect(x, id).toBeGreaterThanOrEqual(0)
        expect(x, id).toBeLessThanOrEqual(48)
        expect(y, id).toBeGreaterThanOrEqual(3.5 - 1e-9)
        expect(y, id).toBeLessThanOrEqual(20.5 + 1e-9)
      }
    }
  })

  it('目录里每个练习都能找到字形（目录行从不画通用图标）', () => {
    for (const p of PRACTICES) expect(isGlyphId(p.id), p.id).toBe(true)
  })

  it('跟节拍的字形取自引擎的真实节拍：慢呼吸 24 秒画满 48 px', () => {
    const slow = PRACTICES.find(p => p.id === 'slow')?.paced
    if (!slow) throw new Error('慢呼吸没有节拍参数')
    const pattern = buildPattern(slow)
    const pts = points(glyphShape('slow').d)
    // 第 120 个取样点在 12 秒处
    const [x, y] = pts[120] ?? [0, 0]
    expect(x).toBeCloseTo(24, 2)
    expect(y).toBeCloseTo(20.5 - patternAt(pattern, 12).y * 17, 2)
  })

  it('周期性叹息只画一整轮：结尾回到起点的高度', () => {
    const pts = points(glyphShape('cyclic-sigh').d)
    expect(pts[0]?.[1]).toBeCloseTo(pts[pts.length - 1]?.[1] ?? 0, 5)
    expect(Math.min(...pts.map(p => p[1]))).toBeCloseTo(3.5, 1)
  })

  it('身体扫描：九级台阶从左下到右上，台阶宽度是 10 分钟版的真实段落时长（与设计稿 BODY_SCAN_10 一致）', () => {
    // 设计稿 draw.mjs 的 BODY_SCAN_10：各段起点（秒），总长 600
    const reference = [0, 71.5, 138.4, 218.2, 271.4, 327.6, 384.8, 435.7, 503.0]
    const starts = [...glyphShape('body-scan').d.matchAll(/[ML]([\d.]+) ([\d.]+)H/g)].map(m => Number(m[1]))
    expect(starts).toHaveLength(reference.length)
    starts.forEach((x, i) => {
      expect(x).toBeCloseTo(((reference[i] ?? 0) / 600) * 47 + 0.5, 0)
    })
    expect(glyphShape('body-scan').d.endsWith('H47.5')).toBe(true)
  })

  it('计划：每周一个 4.5 px 的小方块，左对齐', () => {
    const eight = programGlyph(8).d.match(/M/g) ?? []
    const four = programGlyph(4).d.match(/M/g) ?? []
    expect(eight).toHaveLength(8)
    expect(four).toHaveLength(4)
    expect(programGlyph(4).d.startsWith('M1 14.25h4.5v4.5h-4.5Z')).toBe(true)
  })
})
