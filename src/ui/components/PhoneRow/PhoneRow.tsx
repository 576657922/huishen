import type { CrisisLine } from '@/content/safety'
import { cx } from '../../cx'
import { Icon } from '../../icons'
import { dialLabel } from '../../strings'
import { typeset } from '../../text'
import styles from './PhoneRow.module.css'

export interface PhoneRowProps {
  line: CrisisLine
  className?: string
}

/**
 * 求助电话行（DESIGN.md §8.17，/help 与 设置 › 安全）：整行是 tel: 链接，读作「心理援助热线 12356，拨打」。
 * 左边名称 15 / 600 和说明（含接听时间），右边号码 Inter 17 等宽加 20 的电话图标。网址类的行在新标签页打开。
 */
export function PhoneRow({ line, className }: PhoneRowProps) {
  const tel = line.href.startsWith('tel:')
  return (
    <a
      href={line.href}
      className={cx(styles.row, className)}
      aria-label={tel ? dialLabel(line.name, line.display) : `${line.name} ${line.display}`}
      {...(tel ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
    >
      <span>
        <span className={styles.name}>{line.name}</span>
        <span className={styles.desc}>{typeset(line.description)}</span>
        <span className={styles.desc}>{typeset(line.hours)}</span>
      </span>
      <span className={styles.num}>
        {line.display}
        <Icon name={tel ? 'phone' : 'external'} size={20} className={styles.icon} />
      </span>
    </a>
  )
}
