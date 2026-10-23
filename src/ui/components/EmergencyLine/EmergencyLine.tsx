import { CRISIS_RESOURCES } from '@/content/safety'
import { cx } from '../../cx'
import { clauses } from '../../text'
import styles from './EmergencyLine.module.css'

export interface EmergencyLineProps {
  /** STOP_GUIDANCE.emergency */
  text: string
  /** 要变成 tel: 链接的号码；默认是句子里出现的中国大陆求助号码（120、110 等） */
  tel?: readonly string[]
  className?: string
}

const MAINLAND = CRISIS_RESOURCES[0]?.lines.map(l => l.display) ?? []

/**
 * 紧急提示（DESIGN.md §8.17）：正文字号、墨色——安全面板上最紧急的一句从不是最小最淡的那句；
 * 按标点分句换行；号码是 tel: 链接，Inter 600，墨色下划线
 */
export function EmergencyLine({ text, tel, className }: EmergencyLineProps) {
  const numbers = tel ?? MAINLAND.filter(num => text.includes(num))
  return <p className={cx(styles.emergency, className)}>{clauses(text, { tel: numbers })}</p>
}
