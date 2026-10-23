/**
 * 练完感觉（PRODUCT.md §6、DESIGN.md §8.16）：更平静 / 差不多 / 更紧张 / 很不舒服，点一下就提交，不预选；
 * 右边是「跳过」。选了「很不舒服」时由页面打开「先休息一下」；更紧张和很不舒服的样子与其他选项一样
 */
import { useId } from 'react'
import { AFTER_PRACTICE } from '@/content/safety'
import type { Feeling } from '@/data'
import { ChoiceGroup } from '@/ui'
import { Question } from '../_shared/Question'

export interface FeelingChoiceProps {
  /** 还没选时为 null */
  value: Feeling | null
  /** 点了一个感觉，或点了「跳过」（null） */
  onChange: (feeling: Feeling | null) => void
  /** 问题的标题级别，小结里是 h2 */
  level?: 2 | 3
  className?: string
}

export function FeelingChoice({ value, onChange, level = 2, className }: FeelingChoiceProps) {
  const titleId = useId()
  return (
    <Question
      titleId={titleId}
      title={AFTER_PRACTICE.question}
      level={level}
      skipLabel={AFTER_PRACTICE.skip}
      onSkip={() => onChange(null)}
      className={className}
    >
      <ChoiceGroup options={AFTER_PRACTICE.options} value={value} onChange={onChange} labelledBy={titleId} />
    </Question>
  )
}
