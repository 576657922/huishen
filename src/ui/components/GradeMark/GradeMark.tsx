import type { Grade } from '@/content/types'
import { cx } from '../../cx'
import { gradeSpoken, UI } from '../../strings'
import styles from './GradeMark.module.css'

export interface GradeMarkProps {
  grade: Grade | null
  /** 前面加「证据」二字：今日、练习详情和证据卡片的 kicker */
  prefix?: boolean
  /**
   * 表格里这一栏必须有东西时（如工具没有等级），grade 为 null 也画一个线色的「—」框；
   * 其余地方 null 什么都不渲染
   */
  fill?: boolean
  className?: string
}

/**
 * 证据等级（DESIGN.md §8.5）：方框里的字母加等级词，从不按颜色区分、不做成胶囊。
 * 读屏听到「证据等级 B，中等」；方框本身对读屏隐藏。
 */
export function GradeMark({ grade, prefix = false, fill = false, className }: GradeMarkProps) {
  if (!grade) {
    if (!fill) return null
    return (
      <span className={cx(styles.grade, styles.none, className)}>
        <span className={styles.box} aria-hidden="true">
          —
        </span>
      </span>
    )
  }
  const spoken = gradeSpoken(grade)
  return (
    <span className={cx(styles.grade, className)}>
      {prefix && <span aria-hidden="true">{UI.evidence}</span>}
      <span className={styles.box} aria-hidden="true">
        {grade}
      </span>
      <span className={styles.word}>
        <span className="vh">{spoken.lead}</span>
        {spoken.word}
      </span>
    </span>
  )
}

export interface GradeBoxProps {
  grade: Grade
  className?: string
}

/** 只有字母的方框：练习目录的名称后面。读屏仍然听到完整的「证据等级 B，中等」 */
export function GradeBox({ grade, className }: GradeBoxProps) {
  const spoken = gradeSpoken(grade)
  return (
    <>
      <span className={cx(styles.box, styles.inline, className)} aria-hidden="true">
        {grade}
      </span>
      <span className="vh">{`${spoken.lead}${spoken.word}`}</span>
    </>
  )
}
