import type { Grade } from '@/content/types'
import { bindUnits, keep } from '../../text'
import { Cite } from '../Cite/Cite'
import { GradeMark } from '../GradeMark/GradeMark'
import styles from './Claims.module.css'

export interface ClaimItem {
  /** 一句带比较对象的结论，以句号结尾（content 的 GradedClaim.claim） */
  claim: string
  /** 只针对这一条的等级 */
  grade: Grade
  /** 注释序号：放在句末标点之前，链接到页内的注释 */
  cites?: readonly number[]
}

export interface ClaimsProps {
  claims: readonly ClaimItem[]
  /** 列表下面的一行说明：EVIDENCE.grades.scope */
  scope?: string
  /** 注释的链接：默认 #n1、#n2 … */
  citeHref?: (n: number) => string
  className?: string
}

const END = /[。？！]$/

/**
 * 一条结论：注释编号在句末标点之前；最后四个字（编号不算字，§4.3）连同编号绑在一起，不会只剩两三个字一行
 */
function ClaimText({
  claim,
  cites = [],
  citeHref,
}: Pick<ClaimItem, 'claim' | 'cites'> & {
  citeHref?: (n: number) => string
}) {
  const text = bindUnits(claim)
  const chars = [...text]
  const end = END.test(text) ? (chars.pop() ?? '') : ''
  // 从末尾往前数，凑够四个看得见的字（句末标点算一个，空白不算）
  let at = chars.length
  for (let count = end ? 1 : 0; at > 0 && count < 4; ) {
    at--
    if (!/\s/.test(chars[at] ?? '')) count++
  }
  const head = chars.slice(0, at).join('')
  const tail = chars.slice(at).join('')
  return (
    <>
      {head}
      <span className="keep">
        {tail}
        {cites.map(n => (
          <Cite key={n} n={n} href={citeHref?.(n)} />
        ))}
        {end}
      </span>
    </>
  )
}

/**
 * 依据（DESIGN.md §8.10 Claims，练习详情）：一行一条有等级的结论——17 / 28 600 的结论，下一行是带「证据」的
 * 等级；条与条之间细线，列表下面是 EVIDENCE.grades.scope。不同强度的两个结果从不放在同一句、同一个等级下。
 */
export function Claims({ claims, scope, citeHref, className }: ClaimsProps) {
  return (
    <div className={className}>
      <ol className={styles.claims}>
        {claims.map(c => (
          <li key={c.claim} className={styles.item}>
            <p className={styles.text}>
              <ClaimText claim={c.claim} cites={c.cites} citeHref={citeHref} />
            </p>
            <p className={styles.grade}>
              <GradeMark grade={c.grade} prefix />
            </p>
          </li>
        ))}
      </ol>
      {scope && <p className={styles.scope}>{keep(bindUnits(scope))}</p>}
    </div>
  )
}
