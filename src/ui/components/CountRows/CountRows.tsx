import { RECORDS } from '@/content/copy'
import { cx } from '../../cx'
import { accuracyPercent } from '../../figures/plots'
import { n } from '../../figures/svg'
import { timesText } from '../../strings'
import styles from './CountRows.module.css'

export interface CountRow {
  /** 显示用的日期：「10月18日」 */
  date: string
  /** 准确率 0–1 */
  accuracy: number
  /** 「数乱了」几次 */
  resets: number
}

export interface CountRowsProps {
  rows: readonly CountRow[]
  /**
   * true（桌面）：日期 | 50–100% 轨道上的点 | 准确率 | 数乱了；
   * false（手机）：日期 | 准确率 | 数乱了，行间细线，趋势由旁边的 Sparkline 画
   */
  dots?: boolean
  className?: string
}

const pct = (v: number): string => `${Math.round(v * 100)}%`
const GRID = [50, 75, 100] as const

/**
 * 数息练习数据（DESIGN.md §8.9 CountRows）：一次一行。桌面版每行在 50–100% 的轨道上画一个准确率的点，
 * 50 / 75 / 100 三条细的网格线贯穿各行，刻度标在最下面。表格是真的表格，读屏按行读；点只是示意（aria-hidden）。
 * 说明文字（RECORDS.count.explain，「这不是正念分数。」）由页面放在下面。
 */
export function CountRows({ rows, dots = true, className }: CountRowsProps) {
  const { accuracy, resets } = RECORDS.count
  return (
    <table className={cx(styles.table, dots ? styles.desk : styles.phone, className)}>
      <colgroup>
        <col className={styles.colDate} />
        {dots && <col />}
        <col className={styles.colAcc} />
        <col className={styles.colResets} />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">{RECORDS.date}</th>
          {dots && <td aria-hidden="true" />}
          <th scope="col" className={styles.num}>
            {accuracy}
          </th>
          <th scope="col" className={styles.num}>
            {resets}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 同一天可以有两次，按顺序区分
          <tr key={`${r.date}#${i}`}>
            <th scope="row">{r.date}</th>
            {dots && (
              <td className={styles.track} aria-hidden="true">
                <svg width="100%" height="32" className={styles.svg} aria-hidden="true">
                  {GRID.map(v => (
                    <line
                      key={v}
                      className={styles.grid}
                      x1={`${v * 2 - 100}%`}
                      x2={`${v * 2 - 100}%`}
                      y1="0"
                      y2="32"
                    />
                  ))}
                  <line className={styles.rail} x1="0" x2="100%" y1="16" y2="16" />
                  <circle className={styles.dot} cx={`${n(accuracyPercent(r.accuracy))}%`} cy="16" r="4" />
                </svg>
              </td>
            )}
            <td className={styles.num}>{pct(r.accuracy)}</td>
            <td className={styles.num}>{timesText(r.resets)}</td>
          </tr>
        ))}
      </tbody>
      {dots && (
        <tfoot aria-hidden="true">
          <tr>
            <td />
            <td className={styles.track}>
              <svg width="100%" height="22" className={styles.svg} aria-hidden="true">
                {GRID.map(v => (
                  <text
                    key={v}
                    className={styles.axis}
                    x={`${v * 2 - 100}%`}
                    y="16"
                    textAnchor={v === 50 ? 'start' : v === 100 ? 'end' : 'middle'}
                  >
                    {`${v}%`}
                  </text>
                ))}
              </svg>
            </td>
            <td />
            <td />
          </tr>
        </tfoot>
      )}
    </table>
  )
}
