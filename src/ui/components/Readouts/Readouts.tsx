import { cx } from '../../cx'
import styles from './Readouts.module.css'

export interface ReadoutItem {
  /** 「剩余」「节律」「轮数」 */
  label: string
  /** 「06:15」「5.5」「下一处」的文字 */
  value: string
  /** 「次/分」 */
  unit?: string
  /** 值是文字（引导练习的「下一处」）：界面字体 17 / 32，不用数字字体 */
  text?: boolean
}

export interface ReadoutsProps {
  items: readonly ReadoutItem[]
  /** player：播放器控制条上方，顶上一条细线；spec：小结的关键数字，上下各一条细线 */
  variant?: 'player' | 'spec'
  className?: string
}

/**
 * 读数（DESIGN.md §8.15.4，components.css .readouts / .specs）：等宽的几栏，栏间竖的细线；标签 13 号三级墨色，
 * 数值 Inter 300 24 / 32 等宽数字，单位 13 号次级墨色。读数不是实时区域：倒计时、频率都不播报
 */
export function Readouts({ items, variant = 'player', className }: ReadoutsProps) {
  return (
    <dl className={cx(styles.readouts, variant === 'spec' && styles.spec, className)}>
      {items.map(item => (
        <div key={item.label} className={styles.cell}>
          <dt className={styles.label}>{item.label}</dt>
          <dd className={cx(styles.value, item.text && styles.text)}>
            {item.value}
            {item.unit && <span className={styles.unit}>{item.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}
