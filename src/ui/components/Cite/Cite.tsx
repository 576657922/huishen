import { Fragment, type ReactNode } from 'react'
import { cx } from '../../cx'
import { Icon } from '../../icons'
import { typeset } from '../../text'
import styles from './Cite.module.css'

export interface CiteProps {
  /** 注释序号，从 1 开始 */
  n: number
  /** 默认 #n1、#n2 … 指向页内的注释 */
  href?: string
  className?: string
}

/** 引用角标（DESIGN.md §8.10）：Inter 11 号三级墨色，抬高 0.55em，不加下划线；句中链接免 44 px 规则 */
export function Cite({ n, href, className }: CiteProps) {
  return (
    <a className={cx(styles.cite, className)} href={href ?? `#n${n}`}>
      {n}
    </a>
  )
}

export interface DoiLinkProps {
  /** 有 DOI 时只给它：链接到 doi.org，显示「doi:10.…」 */
  doi?: string
  /** 没有 DOI 的出处（官方网页、手册）：原网址和显示的字（content/evidence 的 citeHref、citeLabel） */
  href?: string
  label?: string
  className?: string
}

/** DOI 链接：Inter、次级墨色、外链图标 14；一行 24 高，::before 把点按区域补到 44；新标签页打开 */
/** 每个斜线后面给一个换行机会（<wbr>）：窄栏里 DOI 先在「10.1016/」这样的地方断开 */
function slashBreaks(text: string): ReactNode {
  const parts = text.split('/')
  return parts.map((part, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: 片段顺序固定，不会重排
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && (
        <>
          /<wbr />
        </>
      )}
    </Fragment>
  ))
}

export function DoiLink({ doi, href, label, className }: DoiLinkProps) {
  const url = href ?? (doi ? `https://doi.org/${doi}` : '')
  const text = label ?? (doi ? `doi:${doi}` : url)
  return (
    <a className={cx(styles.doi, className)} href={url} lang="en" target="_blank" rel="noopener noreferrer">
      <span className={styles.doiText}>{slashBreaks(text)}</span>
      <Icon name="external" size={14} className={styles.external} />
    </a>
  )
}

export interface SourceLineProps {
  /** 「Fincham 等 2023 · Scientific Reports」（content/evidence 的 citeLine） */
  cite: string
  doi?: string
  href?: string
  label?: string
  className?: string
}

/** 证据卡片里的出处行（相反证据、DOI 两栏）：13 号三级墨色的一行，下面是 DOI 链接（DESIGN.md §8.10） */
export function SourceLine({ cite, doi, href, label, className }: SourceLineProps) {
  return (
    <span className={cx(styles.source, className)}>
      <span className={styles.sourceCite}>{cite}</span>
      <DoiLink doi={doi} href={href} label={label} />
    </span>
  )
}

export interface NoteItem {
  /** 作者和年份：「Shaffer & Meehan 2020」「Fincham 等 2023」；含英文名时可传带 lang="en" 的节点 */
  who: ReactNode
  /** 研究类型：实践指南 · 元分析 · 随机对照试验 */
  type?: string
  /** 一句话：发现了什么 */
  what?: ReactNode
  /** 期刊（英文名放在 lang="en" 里） */
  venue?: string
  doi?: string
}

export interface NotesProps {
  items: readonly NoteItem[]
  /** 注释的 id 前缀，与 Cite 的 href 对应；默认 n（#n1） */
  idPrefix?: string
  className?: string
}

/** 注释列表：每条顶上一条细线，20 | 1fr，13 号字（DESIGN.md §8.10） */
export function Notes({ items, idPrefix = 'n', className }: NotesProps) {
  return (
    <ol className={cx(styles.notes, className)}>
      {items.map((item, i) => (
        <li key={item.doi ?? i} id={`${idPrefix}${i + 1}`} className={styles.note}>
          <span className={styles.no}>{i + 1}</span>
          <div>
            <p className={styles.who}>
              {item.who}
              {item.type && <span className={styles.type}>{item.type}</span>}
            </p>
            {item.what && (
              <p className={styles.what}>{typeof item.what === 'string' ? typeset(item.what) : item.what}</p>
            )}
            {(item.venue || item.doi) && (
              <p className={styles.src}>
                {item.venue && (
                  <span className={styles.venue} lang="en">
                    {item.venue}
                  </span>
                )}
                {item.doi && <DoiLink doi={item.doi} />}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
