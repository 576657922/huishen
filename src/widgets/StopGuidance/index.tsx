/**
 * 停止指引全文（PRODUCT.md §5、DESIGN.md §8.15.16、§13.13）：什么时候停（· 列表）、停下以后（1 2 3）、
 * 跟着节拍呼吸时的补充、急救的那一句（120 可以直接拨打），可选「求助方式 ›」和键盘说明。
 * 用在暂停面板、/help#stop、设置 › 安全。文字取自 safety.ts，顺序、措辞都不改；口语的句子只在标点处换行
 */
import { CRISIS_CARD, STOP_GUIDANCE } from '@/content/safety'
import { clauses, cx, EmergencyLine, LinkMore } from '@/ui'
import styles from './StopGuidance.module.css'

export interface StopGuidanceProps {
  /** 标题的级别：面板里是 h3，/help 的一节里由那一节的标题代替（传 null 不出标题） */
  headingLevel?: 2 | 3 | null
  /** 顶上一条 1 px 墨线（暂停面板） */
  ruled?: boolean
  /** 末尾的「求助方式 ›」：没有标签栏的地方要有一条去求助方式的路 */
  helpLink?: boolean
  /** 只给用鼠标、触控板的设备看的键盘说明，如 PLAYER.pausePanel.keys（DESIGN.md §10.2） */
  keys?: string
  /** 锚点，如 'stop'（/help#stop） */
  id?: string
  className?: string
}

export function StopGuidance({
  headingLevel = 3,
  ruled = false,
  helpLink = false,
  keys,
  id,
  className,
}: StopGuidanceProps) {
  const H = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <div id={id} className={cx(ruled && styles.ruled, className)}>
      {headingLevel !== null && <H className={styles.title}>{STOP_GUIDANCE.title}</H>}
      <p className={styles.lead}>{clauses(STOP_GUIDANCE.when.lead)}</p>
      <ul className={cx(styles.list, styles.dots)}>
        {STOP_GUIDANCE.when.items.map(item => (
          <li key={item}>
            <span>{clauses(item)}</span>
          </li>
        ))}
      </ul>
      <p className={styles.lead}>{STOP_GUIDANCE.after.lead}</p>
      <ol className={styles.list}>
        {STOP_GUIDANCE.after.items.map(item => (
          <li key={item}>
            <span>{clauses(item)}</span>
          </li>
        ))}
      </ol>
      <p className={styles.para}>{clauses(STOP_GUIDANCE.breathing)}</p>
      <EmergencyLine text={STOP_GUIDANCE.emergency} className={styles.emergency} />
      {helpLink && <LinkMore to="/help">{CRISIS_CARD.title}</LinkMore>}
      {keys && (
        <p className={styles.keys} data-modality="fine">
          {keys}
        </p>
      )}
    </div>
  )
}
