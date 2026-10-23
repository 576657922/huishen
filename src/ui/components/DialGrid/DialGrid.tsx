import type { CrisisLine } from '@/content/safety'
import { cx } from '../../cx'
import { Icon } from '../../icons'
import { dialLabel } from '../../strings'
import styles from './DialGrid.module.css'

export interface DialGridProps {
  /** 中国大陆的四个号码：CRISIS_RESOURCES[0].lines（心理援助热线 · 希望24热线 · 急救 · 报警） */
  lines: readonly CrisisLine[]
  className?: string
}

/**
 * 拨号格（DESIGN.md §8.17，不舒服？和先休息一下的面板里）：画了细线的 2 × 2，没有外框；
 * 每格是 tel: 链接、至少 64 高：上面名称，下面号码和 16 的电话图标。焦点框画在格子外面——左列没有内边距，
 * 画在里面会切到名称。
 */
export function DialGrid({ lines, className }: DialGridProps) {
  return (
    <div className={cx(styles.dial, className)}>
      {lines.map(line => (
        <a
          key={line.href}
          href={line.href}
          aria-label={dialLabel(line.name, line.display)}
          className={styles.cell}
        >
          <span className={styles.name}>{line.name}</span>
          <span className={styles.num}>
            {line.display}
            <Icon name="phone" size={16} className={styles.icon} />
          </span>
        </a>
      ))}
    </div>
  )
}
