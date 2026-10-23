import { Children, isValidElement, type ReactNode, useId } from 'react'
import type { Practice } from '@/content/types'
import { cx } from '../../cx'
import { type GlyphId, isGlyphId } from '../../figures/glyphs'
import { Icon } from '../../icons'
import { AppLink } from '../../link'
import { figureParts, minutesText, weeksText } from '../../strings'
import { typeset } from '../../text'
import { BreathGlyph } from '../BreathGlyph/BreathGlyph'
import { GradeBox } from '../GradeMark/GradeMark'
import styles from './PracticeRow.module.css'

export type PracticeRowEnd = 'duration' | 'weeks' | 'chevron' | 'none'

export interface PracticeRowProps {
  /** 目录里的练习；名称、说明、等级和字形默认都从它取 */
  practice?: Pick<Practice, 'id' | 'name' | 'short' | 'grade'>
  name?: string
  /** 默认 practice.short；今日「只有几分钟」传结构短句（「停 · 吸 · 观 · 行」） */
  description?: string
  /** 较长的说明：不显示，作为 aria-describedby 读出来 */
  hint?: string
  /** 默认用练习 id 对应的字形；计划传 { weeks } */
  glyph?: GlyphId | { weeks: number }
  /** 练习目录：名称后跟等级字母（§8.5） */
  showGrade?: boolean
  /** 行尾：时长、周数、箭头，或什么都没有 */
  end?: PracticeRowEnd
  minutes?: number
  weeks?: number
  /** 现成的行尾文字，如「60 秒」「约 7 分钟」；数字和单位分开排版 */
  endText?: string
  /** nav：今日的「现在有点难」——界面字体 15 / 24 600 的标签、三级墨色的提示、箭头 */
  variant?: 'practice' | 'nav'
  to?: string
  onClick?: () => void
  /** 打开面板的行（「现在有点难」）：aria-haspopup="dialog" */
  opensDialog?: boolean
  className?: string
  /** data-* 原样放到行上（测试、组件目录里强制状态） */
  [data: `data-${string}`]: string | undefined
}

/** 「10 分钟」「约 7 分钟」「60 秒」：数字 15 墨色、单位 13 次级墨色，中间不换行 */
function Figure({ text }: { text: string }) {
  const parts = figureParts(text)
  if (!parts) return <span className={styles.dur}>{text}</span>
  return (
    <span className={styles.dur}>
      {parts.before && `${parts.before}\u00A0`}
      <span className={cx('pnum', styles.figure)}>{parts.figure}</span>
      {`\u00A0${parts.unit}`}
    </span>
  )
}

function endOf(props: PracticeRowProps): ReactNode {
  const { end = 'duration', minutes, weeks, endText } = props
  if (end === 'none') return null
  if (end === 'chevron') return <Icon name="chevron-right" size={16} className={styles.chevron} />
  if (endText) return <Figure text={endText} />
  if (end === 'weeks' && weeks !== undefined) return <Figure text={weeksText(weeks)} />
  if (end === 'duration' && minutes !== undefined) return <Figure text={minutesText(minutes)} />
  return null
}

/**
 * 练习行（DESIGN.md §8.6）：48 px 的字形栏、16 间距、名称和一句说明、右边的时长。
 * 整行是一个链接（或打开面板的按钮）；悬停和按下的底色铺到屏幕两边，焦点框收在边距以内。
 */
export function PracticeRow(props: PracticeRowProps) {
  const { practice, variant = 'practice', showGrade = false, to, onClick, opensDialog, className } = props
  const data = Object.fromEntries(Object.entries(props).filter(([k]) => k.startsWith('data-')))
  const hintId = useId()
  const name = props.name ?? practice?.name ?? ''
  const description = props.description ?? practice?.short
  const glyph = props.glyph ?? (practice && isGlyphId(practice.id) ? practice.id : undefined)
  const grade = showGrade ? practice?.grade : null

  const content = (
    <>
      {typeof glyph === 'object' ? (
        <BreathGlyph weeks={glyph.weeks} />
      ) : glyph ? (
        <BreathGlyph id={glyph} />
      ) : (
        // 没有字形时也占住 48 px 的字形栏，文字仍对齐在 x = 84（§1.2）；从不放通用图标
        <span aria-hidden="true" />
      )}
      <span className={styles.text}>
        <span className={styles.name}>
          {name}
          {grade && <GradeBox grade={grade} />}
        </span>
        {description && <span className={styles.desc}>{typeset(description)}</span>}
        {/* hidden：不进链接的名称（否则读两遍），aria-describedby 直接引用时照样读出 */}
        {props.hint && (
          <span id={hintId} hidden>
            {props.hint}
          </span>
        )}
      </span>
      <span className={styles.end}>{endOf(props)}</span>
    </>
  )
  const cls = cx(styles.row, variant === 'nav' && styles.nav, className)
  const describedBy = props.hint ? hintId : undefined
  if (to !== undefined) {
    return (
      <AppLink
        {...data}
        to={to}
        className={cls}
        data-row=""
        aria-describedby={describedBy}
        aria-haspopup={opensDialog ? 'dialog' : undefined}
      >
        {content}
      </AppLink>
    )
  }
  if (onClick) {
    return (
      <button
        {...data}
        type="button"
        className={cls}
        data-row=""
        onClick={onClick}
        aria-describedby={describedBy}
        aria-haspopup={opensDialog ? 'dialog' : undefined}
      >
        {content}
      </button>
    )
  }
  return (
    <div {...data} className={cls} data-row="">
      {content}
    </div>
  )
}

export interface PracticeListProps {
  children: ReactNode
  /** 列表的读屏名称；一般由所在小节的标题提供（aria-labelledby） */
  labelledBy?: string
  className?: string
}

/** 一组练习行：ul / li，最后一行下面不画细线 */
export function PracticeList({ children, labelledBy, className }: PracticeListProps) {
  return (
    <ul className={cx(styles.list, className)} aria-labelledby={labelledBy}>
      {Children.map(children, child =>
        isValidElement(child) ? <li className={styles.item}>{child}</li> : null,
      )}
    </ul>
  )
}
