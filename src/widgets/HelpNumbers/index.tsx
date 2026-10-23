/**
 * 求助电话（PRODUCT.md §10、DESIGN.md §8.17）：随应用打包、离线可用，号码可以直接拨打，
 * 旁边总写着「最后核实：2026-10-22」。只列 safety.ts 里核实过的号码，顺序照抄（中国大陆在前）。
 * - grid：中国大陆的四个号码排成 2 × 2，上面是「求助方式 ›」（链到 /help）——不舒服？、先休息一下、现在有点难；
 * - rows：按地区分组，每个号码一行，有说明和时段——/help、设置 › 安全
 */
import { useId } from 'react'
import { CRISIS_CARD, CRISIS_RESOURCES } from '@/content/safety'
import { AppLink, cx, DialGrid, GroupTitle, Icon, PhoneRow, SectionHead } from '@/ui'
import styles from './HelpNumbers.module.css'

export interface HelpNumbersProps {
  variant?: 'grid' | 'rows'
  /** grid 的小节标题级别（面板标题是 h2，这里默认 h3）；rows 的地区标题级别 */
  level?: 2 | 3
  className?: string
}

const MAINLAND = CRISIS_RESOURCES[0]?.lines ?? []

export function HelpNumbers({ variant = 'grid', level = 3, className }: HelpNumbersProps) {
  const headingId = useId()
  if (variant === 'rows') {
    return (
      <div className={className}>
        {CRISIS_RESOURCES.map(region => (
          <section key={region.id} aria-labelledby={`${headingId}-${region.id}`}>
            <GroupTitle level={level} id={`${headingId}-${region.id}`}>
              {region.name}
            </GroupTitle>
            <div className={styles.rows}>
              {region.lines.map(line => (
                <PhoneRow key={line.href} line={line} />
              ))}
            </div>
          </section>
        ))}
        <p className={styles.verified}>{CRISIS_CARD.verified}</p>
      </div>
    )
  }
  return (
    <section className={cx(styles.help, className)} aria-labelledby={headingId}>
      <SectionHead
        level={level}
        id={headingId}
        className={styles.head}
        title={
          <AppLink to="/help" className={styles.link}>
            {CRISIS_CARD.title}
            <Icon name="chevron-right" size={18} className={styles.chevron} />
          </AppLink>
        }
        aside={CRISIS_CARD.verified}
      />
      <DialGrid lines={MAINLAND} />
    </section>
  )
}
