import { TODAY } from '@/content/copy'
import { cx } from '../../cx'
import { Icon } from '../../icons'
import { AppLink } from '../../link'
import { figureParts, minutesText } from '../../strings'
import styles from './StartBar.module.css'

export interface StartBarProps {
  /** 实际会练的分钟数：「10 分钟」 */
  minutes: number
  /** 时长不固定（舒适节律探索）：「约 7 分钟」 */
  approx?: boolean
  /** 去播放器的地址；和 onStart 至少给一个。给了 to 时 onStart 在跳转前调用 */
  to?: string
  onStart?: () => void
  className?: string
  /** data-* 原样放到开始条上 */
  [data: `data-${string}`]: string | undefined
}

/**
 * 开始条（DESIGN.md §8.4）：一页只有它一个主操作。左边 ▷ 开始，右边是真正会练的时长。
 * 从不禁用：声音起不来时练习照样静音开始，由播放器提示。
 */
export function StartBar({ minutes, approx = false, to, onStart, className, ...rest }: StartBarProps) {
  const data = Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith('data-')))
  const text = minutesText(minutes, approx)
  const parts = figureParts(text)
  const body = (
    <>
      <span className={styles.label}>
        <Icon name="play" size={20} />
        {TODAY.start}
      </span>
      <span className={styles.meta}>
        {parts ? (
          <>
            {parts.before && `${parts.before} `}
            <span className={cx('pnum', styles.figure)}>{parts.figure}</span>
            {` ${parts.unit}`}
          </>
        ) : (
          text
        )}
      </span>
    </>
  )
  if (to !== undefined) {
    return (
      <AppLink {...data} to={to} onClick={() => onStart?.()} className={cx(styles.bar, className)}>
        {body}
      </AppLink>
    )
  }
  return (
    <button {...data} type="button" onClick={() => onStart?.()} className={cx(styles.bar, className)}>
      {body}
    </button>
  )
}
