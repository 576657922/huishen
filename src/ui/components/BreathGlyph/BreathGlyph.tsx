import { cx } from '../../cx'
import {
  GLYPH_H,
  GLYPH_W,
  type GlyphId,
  type GlyphShape,
  glyphShape,
  programGlyph,
} from '../../figures/glyphs'
import styles from './BreathGlyph.module.css'

export interface BreathGlyphProps {
  /** 练习 id；计划用 weeks */
  id?: GlyphId
  /** 计划：每周一个小方块（八周正念 8、四周呼吸 4） */
  weeks?: number
  /**
   * 今日页和练习详情的大图用 4 倍（192 × 96）。形状放大，描边不放大：仍是字形的 1.25 px
   * （DESIGN.md §8.9「glyph strokes 1.25 px」），放大的描边会变成粗笨的图标
   */
  scale?: 1 | 4
  className?: string
}

/**
 * 练习的呼吸字形（DESIGN.md §8.6）：48 × 24，描边 1.25，圆头圆角，currentColor，不填充。
 * 纯装饰：练习名就在旁边，所以对读屏隐藏。
 */
export function BreathGlyph({ id, weeks, scale = 1, className }: BreathGlyphProps) {
  const shape: GlyphShape | null = id ? glyphShape(id) : weeks ? programGlyph(weeks) : null
  if (!shape) return null
  const vectorEffect = scale === 1 ? undefined : 'non-scaling-stroke'
  return (
    <svg
      className={cx(styles.glyph, className)}
      width={GLYPH_W * scale}
      height={GLYPH_H * scale}
      viewBox={`0 0 ${GLYPH_W} ${GLYPH_H}`}
      aria-hidden="true"
      focusable="false"
      data-glyph={id ?? `program-${weeks}`}
    >
      <path d={shape.d} vectorEffect={vectorEffect} />
      {shape.circles?.map(c => (
        <circle key={`${c.cx}-${c.cy}`} cx={c.cx} cy={c.cy} r={c.r} vectorEffect={vectorEffect} />
      ))}
    </svg>
  )
}
