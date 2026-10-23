/**
 * 「此刻有多紧张？」0–10（PRODUCT.md §6、DESIGN.md §8.16）：两行同一节距，点一下就提交，不预选，可跳过。
 * 问练习后时不给练习前的分数——这个组件也就没有地方显示它
 */
import { useId } from 'react'
import { SUMMARY } from '@/content/copy'
import { ScaleGroup } from '@/ui'
import { Question } from '../_shared/Question'

export interface CheckinScaleProps {
  /** 还没选时为 null */
  value: number | null
  /** 点了一个分数，或点了「跳过」（null） */
  onChange: (score: number | null) => void
  level?: 2 | 3
  className?: string
}

export const CHECKIN_ANCHORS = { low: SUMMARY.checkin.low, high: SUMMARY.checkin.high } as const

export function CheckinScale({ value, onChange, level = 2, className }: CheckinScaleProps) {
  const titleId = useId()
  return (
    <Question
      titleId={titleId}
      title={SUMMARY.checkin.question}
      level={level}
      skipLabel={SUMMARY.checkin.skip}
      onSkip={() => onChange(null)}
      className={className}
    >
      <ScaleGroup
        min={0}
        max={10}
        anchors={CHECKIN_ANCHORS}
        value={value}
        onChange={onChange}
        labelledBy={titleId}
      />
    </Question>
  )
}
