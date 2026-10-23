import type { KeyboardEvent, MouseEvent } from 'react'
import { cx } from '../../cx'
import { minutesText, TABLE } from '../../strings'
import { Button } from '../Button/Button'
import styles from './SessionsTable.module.css'

export interface SessionRow {
  id: string
  /** 「10月22日」 */
  date: string
  /** 「周四」 */
  weekday?: string
  /** 「07:42」 */
  start: string
  /** 练习名 */
  practice: string
  minutes: number
  /** 记录：「回神 4 次」「准确率 73%」「5.5 次/分 · 52 轮」 */
  data?: string
  /** 练完感觉的词；更紧张、很不舒服也是普通的墨色字 */
  feeling?: string
  before?: number | null
  after?: number | null
  note?: string
}

export interface SessionsTableProps {
  /** 新的在前，一次 50 条（页面分页） */
  rows: readonly SessionRow[]
  /** 打开这次练习的详情：点一行、行里的「详情」或焦点在行里时按 Enter */
  onOpen: (id: string) => void
  /** 删除（页面先弹确认对话框）：行里的「删除」或焦点在行里时按 Delete */
  onDelete: (id: string) => void
  /** 表格的名字（读屏）：一般是所在小节的标题 */
  labelledBy?: string
  /** 「显示更早的 50 次」：还有更早的记录时给 */
  more?: { label: string; onMore: () => void }
  className?: string
}

const DASH = '—'

/** 空值印三级墨色的「—」 */
function Value({ value }: { value: string | number | null | undefined }) {
  return value === undefined || value === null || value === '' ? (
    <span className={styles.muted}>{DASH}</span>
  ) : (
    value
  )
}

/**
 * 记录表（DESIGN.md §8.18，桌面的「每次练习」）：固定列宽；表头 13 号三级墨色压在 1 px 墨线上；每行 44 高、
 * 行间细线、不换行，长的记录和备注截断成 …（完整内容在详情里）；数字右对齐、等宽。
 * 指针停在行上（精细指针）或焦点在行里时，行尾出现「详情」「删除」。点一行打开详情。
 * 行里的两个按钮一直在 Tab 顺序里（透明而不是 visibility: hidden），焦点进来时显出来。
 */
export function SessionsTable({ rows, onOpen, onDelete, labelledBy, more, className }: SessionsTableProps) {
  const onRowClick = (id: string) => (e: MouseEvent<HTMLTableRowElement>) => {
    // 行里的按钮自己处理
    if ((e.target as HTMLElement).closest('button')) return
    onOpen(id)
  }
  const onRowKey = (id: string) => (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Delete') {
      e.preventDefault()
      onDelete(id)
    }
  }
  return (
    <div className={cx(styles.root, className)}>
      <table className={styles.table} aria-labelledby={labelledBy}>
        <colgroup>
          <col className={styles.cDate} />
          <col className={styles.cStart} />
          <col className={styles.cPractice} />
          <col className={styles.cDuration} />
          <col className={styles.cData} />
          <col className={styles.cFeeling} />
          <col className={styles.cScore} />
          <col className={styles.cScore} />
          <col />
          <col className={styles.cActions} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{TABLE.date}</th>
            <th scope="col">{TABLE.start}</th>
            <th scope="col">{TABLE.practice}</th>
            <th scope="col" className={styles.num}>
              {TABLE.duration}
            </th>
            <th scope="col" className={styles.text}>
              {TABLE.data}
            </th>
            <th scope="col">{TABLE.feeling}</th>
            <th scope="col" className={styles.num}>
              {TABLE.before}
            </th>
            <th scope="col" className={styles.num}>
              {TABLE.after}
            </th>
            <th scope="col" className={styles.text}>
              {TABLE.note}
            </th>
            <th scope="col">
              <span className="vh">{TABLE.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className={styles.row} onClick={onRowClick(r.id)} onKeyDown={onRowKey(r.id)}>
              <th scope="row">
                <span className={styles.day}>{r.date}</span>
                {r.weekday && <span className={styles.weekday}>{r.weekday}</span>}
              </th>
              <td className="tnum">{r.start}</td>
              <td>{r.practice}</td>
              <td className={styles.num}>{minutesText(r.minutes)}</td>
              <td className={cx(styles.text, styles.soft)} title={r.data}>
                <Value value={r.data} />
              </td>
              <td>
                <Value value={r.feeling} />
              </td>
              <td className={styles.num}>
                <Value value={r.before} />
              </td>
              <td className={styles.num}>
                <Value value={r.after} />
              </td>
              <td className={cx(styles.text, styles.soft)} title={r.note}>
                {r.note}
              </td>
              <td className={styles.actions}>
                <button type="button" className={styles.action} onClick={() => onOpen(r.id)}>
                  {TABLE.detail}
                </button>
                <button type="button" className={styles.action} onClick={() => onDelete(r.id)}>
                  {TABLE.delete}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {more && (
        <Button variant="quiet" className={styles.more} onClick={more.onMore}>
          {more.label}
        </Button>
      )}
    </div>
  )
}
