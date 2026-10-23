import { describe, expect, it } from 'vitest'
import { DETAIL, EVIDENCE } from './copy'
import {
  axisPosition,
  CLAIM_COUNT,
  cardById,
  cardHref,
  cardsFor,
  citeHref,
  citeLabel,
  citeLine,
  EVIDENCE_CATEGORIES,
  EVIDENCE_CATEGORY_INFO,
  EVIDENCE_FILTERS,
  effectAxis,
  effectNote,
  filterCards,
  filterFor,
  formatEffect,
  formatSize,
  loadEvidence,
  loadEvidencePage,
  metaLine,
  PROGRAM_EVIDENCE,
  SETTING_EVIDENCE,
} from './evidence'
import { EVIDENCE_CARDS, EVIDENCE_CITES } from './evidence-cards'
import { PRACTICES } from './practices'
import { findForbidden } from './safety'
import type { EffectOutcome, EvidenceCard, EvidenceClaim } from './types'

/* ---------- 测试数据 ---------- */

/** 研究组定稿的证据库。用相对路径：以 / 开头的写法在项目的 vite 配置下读不到 */
const FILES = import.meta.glob<{ claims: EvidenceClaim[] }>('../../docs/research/evidence.json', {
  eager: true,
  import: 'default',
})
const DATA = Object.values(FILES)[0]
const CLAIMS = new Map((DATA?.claims ?? []).map(c => [c.id, c]))

const PRODUCT = Object.values(
  import.meta.glob<string>('/docs/PRODUCT.md', { eager: true, query: '?raw', import: 'default' }),
)[0]

/** evidence.ts 的源码：检查它没有把卡片层和证据库静态打进去 */
const ACCESS_SOURCE = Object.values(
  import.meta.glob<string>('./evidence.ts', { eager: true, query: '?raw', import: 'default' }),
)[0]

const claim = (id: string): EvidenceClaim => {
  const c = CLAIMS.get(id)
  if (!c) throw new Error(`证据库里没有 ${id}`)
  return c
}

/* ---------- 数字核对 ---------- */

/** 带正负号的数字；数值相同即算一个（0.40 与 0.4 相同） */
interface Num {
  value: number
  negative: boolean
}

/**
 * 文字里的全部数字。「2,371」按 2371 算，「.673」按 0.673 算；
 * 「−」或「-」前面不是数字、字母和小数点时才是负号，所以「4-7-8」「DASS-21」里的数都是正数；
 * 「–」只当区间号（证据库里没有用它当负号的地方）
 */
function numbersIn(text: string): (Num & { at: number })[] {
  const plain = text.replace(/(\d),(?=\d{3}(?!\d))/g, '$1')
  const out: (Num & { at: number })[] = []
  for (const m of plain.matchAll(/(?<![\d.])(\d+(?:\.\d+)?|\.\d+)/g)) {
    const at = m.index ?? 0
    const sign = plain[at - 1]
    const before = plain[at - 2] ?? ''
    const negative = (sign === '−' || sign === '-') && !/[0-9A-Za-z.]/.test(before)
    out.push({ value: Number(m[1]), negative, at })
  }
  return out
}

/** 与卡片上的数正负号也相同 */
const same = (n: Num, value: number): boolean => n.value === Math.abs(value) && n.negative === value < 0

/**
 * 估计值和它的区间在原文里是不是一组：估计值后面 40 个字符之内是下限，下限后面 20 个字符之内是上限
 * （「g = 0.53（95%置信区间0.43–0.62）」）。只核对数字都出现过，抓不到把甲结果的区间安到乙结果上
 */
function together(o: Pick<EffectOutcome, 'g' | 'lo' | 'hi'>, source: string): boolean {
  const nums = numbersIn(source)
  return nums.some(
    g =>
      same(g, o.g) &&
      nums.some(
        lo =>
          same(lo, o.lo) &&
          lo.at > g.at &&
          lo.at - g.at <= 40 &&
          nums.some(hi => same(hi, o.hi) && hi.at > lo.at && hi.at - lo.at <= 20),
      ),
  )
}

const sourceText = (id: string): string => `${claim(id).finding}\n${claim(id).finding_zh}`

/** 卡片文字里有、来源原文里没有的数字。负数要原文里也是负数；正数可以对应原文的负数（「降低 0.7 分」） */
function strangers(text: string, source: string): string[] {
  const known = numbersIn(source)
  return numbersIn(text)
    .filter(n => !known.some(k => k.value === n.value && (!n.negative || k.negative)))
    .map(n => `${n.negative ? '−' : ''}${n.value}`)
}

/** 卡片上写给人看的全部文字，带上位置，失败时能定位 */
function cardTexts(card: EvidenceCard): { where: string; text: string }[] {
  const texts = [
    { where: 'topic', text: card.topic },
    { where: 'claim', text: card.claim },
    { where: 'kind', text: card.kind },
    { where: 'design', text: card.design },
    { where: 'limits', text: card.limits },
  ]
  if (card.size) texts.push({ where: 'size', text: card.size })
  if (card.stat) texts.push({ where: 'stat', text: card.stat })
  if (card.note) texts.push({ where: 'note', text: card.note })
  for (const [i, o] of (card.outcomes ?? []).entries())
    texts.push({ where: `outcomes[${i}].name`, text: o.name })
  return texts.map(t => ({ ...t, where: `${card.id}.${t.where}` }))
}

/* ---------- 排版检查（PRODUCT.md §11、DESIGN.md §4.3–4.5） ---------- */

/** 日历上的日期写在一起（「检索到2022年2月」「2017年版」），不算中文与数字之间漏了空格 */
const CALENDAR = /\d{4}年(?:\d{1,2}月)?|\d{1,2}月(?:\d{1,2}日)?|\d{1,2}日/gu

const typeset = (text: string): string[] => {
  const problems: string[] = []
  const undated = text.replace(CALENDAR, '某日')
  if (/\p{Script=Han}[0-9A-Za-z%]|[0-9A-Za-z%]\p{Script=Han}/u.test(undated))
    problems.push('中文与数字、字母之间没空格')
  if (/\p{Script=Han}/u.test(text) && /[,;:?!()]/.test(text)) problems.push('中文里用了半角标点')
  if (/["'“”‘’]/.test(text) || text.includes('...')) problems.push('引号或省略号不对')
  if (text !== text.trim() || /\s{2,}|\n/.test(text)) problems.push('多余的空白')
  if (/\p{Script=Han} \p{Script=Han}/u.test(text)) problems.push('两个汉字之间有空格')
  if (/ [，。；：？、）」』]|[（「『] /u.test(text)) problems.push('全角标点旁有空格')
  if (/(^|[\s=（：，、])-\d/.test(text)) problems.push('负号用了连字符')
  if (/\d-\d/.test(text)) problems.push('区间用了连字符')
  if (/\d[  ]+[年月日]/u.test(text)) problems.push('日期里有空格')
  if (/(?<![.\d])\d+(?:\.\d{2,})? 次\/分/.test(text)) problems.push('次/分 不是一位小数')
  if (/[!！]|\p{Extended_Pictographic}/u.test(text)) problems.push('感叹号或表情')
  if (/您|静观/.test(text)) problems.push('称呼或术语不对')
  return problems
}

const ALL_TEXTS = [
  ...EVIDENCE_CARDS.flatMap(cardTexts),
  ...EVIDENCE_CARDS.flatMap(c =>
    c.contrary.map((x, i) => ({ where: `${c.id}.contrary[${i}]`, text: x.text })),
  ),
  ...EVIDENCE_CARDS.flatMap(c => (c.use ? [{ where: `${c.id}.use`, text: c.use }] : [])),
  ...Object.entries(EVIDENCE_CATEGORY_INFO).flatMap(([id, info]) => [
    { where: `${id}.label`, text: info.label },
    { where: `${id}.description`, text: info.description },
  ]),
  ...EVIDENCE_CARDS.flatMap(c => {
    const note = effectNote(c)
    return note ? [{ where: `${c.id}.effectNote`, text: note }] : []
  }),
]

/* ---------- 卡片层 ---------- */

describe('卡片层', () => {
  it('读到了证据库', () => {
    expect(CLAIMS.size).toBe(CLAIM_COUNT)
  })

  it('张数在规划之内，每个分类都有卡片', () => {
    // 规划是 35–60 张；练习引用的 53 条都要有卡片，再加各领域的关键结论和回神自己用法的依据，上限放到 64
    expect(EVIDENCE_CARDS.length).toBeGreaterThanOrEqual(35)
    expect(EVIDENCE_CARDS.length).toBeLessThanOrEqual(64)
    for (const category of EVIDENCE_CATEGORIES)
      expect(EVIDENCE_CARDS.filter(c => c.category === category).length, category).toBeGreaterThanOrEqual(3)
  })

  it('一条研究一张卡片：id 不重复，等于来源 id，来源在证据库里', () => {
    const ids = EVIDENCE_CARDS.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const c of EVIDENCE_CARDS) {
      expect(c.source, c.id).toBe(c.id)
      expect(CLAIMS.has(c.source), c.source).toBe(true)
    }
  })

  it('相反证据引的研究都在证据库里', () => {
    for (const c of EVIDENCE_CARDS)
      for (const x of c.contrary) expect(CLAIMS.has(x.claimId), `${c.id} → ${x.claimId}`).toBe(true)
  })

  it('等级、分类和效应量的写法合法', () => {
    for (const c of EVIDENCE_CARDS) {
      expect(['A', 'B', 'C', 'D'], c.id).toContain(c.grade)
      expect(EVIDENCE_CATEGORIES, c.id).toContain(c.category)
      // 效应量和统计量至少有一样；有效应量就要说清正负号的含义
      expect(Boolean(c.outcomes?.length) || Boolean(c.stat), c.id).toBe(true)
      if (c.outcomes) {
        expect(c.outcomes.length, c.id).toBeGreaterThan(0)
        expect(['lower', 'higher', 'better'], c.id).toContain(c.direction)
        for (const o of c.outcomes) {
          expect(o.lo, `${c.id} ${o.name}`).toBeLessThanOrEqual(o.g)
          expect(o.g, `${c.id} ${o.name}`).toBeLessThanOrEqual(o.hi)
        }
      } else {
        expect(c.direction, c.id).toBeUndefined()
      }
      if (c.metric) expect(['g', 'd', 'SMD'], c.id).toContain(c.metric)
      if (c.unit) expect(['trials', 'studies', 'comparisons'], c.id).toContain(c.unit)
    }
  })

  it('有阴性和相反的结果：多数卡片写了相反证据，至少几张卡片的结论就是「没有差别」', () => {
    const withContrary = EVIDENCE_CARDS.filter(c => c.contrary.length > 0).length
    expect(withContrary / EVIDENCE_CARDS.length).toBeGreaterThan(0.6)
    const nulls = EVIDENCE_CARDS.filter(c => /没有(显著)?差别|并不比|不比/.test(c.claim))
    expect(nulls.length).toBeGreaterThanOrEqual(5)
  })

  it('设计稿的示范卡片：Fincham 等 2023 元分析，相反证据是同年的 400 人试验', () => {
    const card = EVIDENCE_CARDS.find(c => c.id === 'breathing-fincham-2023-meta')
    expect(card?.grade).toBe('B')
    expect(card?.outcomes?.[0]).toEqual({ name: '压力', k: 12, n: 785, g: -0.35, lo: -0.55, hi: -0.14 })
    expect(card?.contrary.map(x => x.claimId)).toEqual(['breathing-fincham-2023-rct'])
    expect(card?.claim).toBe('与不做呼吸练习的对照相比，呼吸练习让自评压力小到中等程度减轻。')
  })
})

/* ---------- 数字只来自原文 ---------- */

describe('数字只来自来源研究的 finding / finding_zh', () => {
  it('效应量：估计值、区间、研究数和人数都能在原文里找到', () => {
    const bad = EVIDENCE_CARDS.flatMap(c =>
      (c.outcomes ?? []).flatMap(o => {
        const known = numbersIn(sourceText(c.source))
        const signed = (value: number) =>
          known.some(k => k.value === Math.abs(value) && k.negative === value < 0)
        const plain = (value: number) => known.some(k => k.value === value)
        const missing = [
          ...[o.g, o.lo, o.hi].filter(v => !signed(v)),
          ...[o.k, o.n].filter((v): v is number => v !== undefined && !plain(v)),
        ]
        return missing.length ? [`${c.id} ${o.name}：${missing.join('、')}`] : []
      }),
    )
    expect(bad).toEqual([])
  })

  it('效应量：估计值和区间在原文里是同一组数，没有张冠李戴', () => {
    const bad = EVIDENCE_CARDS.flatMap(c =>
      (c.outcomes ?? []).flatMap(o => (together(o, sourceText(c.source)) ? [] : [`${c.id} ${o.name}`])),
    )
    expect(bad).toEqual([])
  })

  it('卡片上每一处文字里的数字都能在原文里找到', () => {
    const bad = EVIDENCE_CARDS.flatMap(c =>
      cardTexts(c).flatMap(({ where, text }) => {
        const s = strangers(text, sourceText(c.source))
        return s.length ? [`${where}：${s.join('、')}`] : []
      }),
    )
    expect(bad).toEqual([])
  })

  it('相反证据里的数字能在它引的那条研究里找到', () => {
    const bad = EVIDENCE_CARDS.flatMap(c =>
      c.contrary.flatMap((x, i) => {
        const s = strangers(x.text, sourceText(x.claimId))
        return s.length ? [`${c.id}.contrary[${i}]（${x.claimId}）：${s.join('、')}`] : []
      }),
    )
    expect(bad).toEqual([])
  })

  it('「在应用中」说的是回神的默认值，数字能在 PRODUCT.md 里找到', () => {
    expect(PRODUCT).toBeDefined()
    const bad = EVIDENCE_CARDS.flatMap(c => {
      const s = c.use ? strangers(c.use, PRODUCT ?? '') : []
      return s.length ? [`${c.id}.use：${s.join('、')}`] : []
    })
    expect(bad).toEqual([])
  })

  it('检查本身认得出编出来的数字', () => {
    expect(strangers('g = −0.35（−0.55 至 −0.14）', 'g = −0.35 (95% CI −0.55 to −0.14)')).toEqual([])
    expect(strangers('2371 人', '2,371 participants')).toEqual([])
    expect(strangers('p = 0.673', 'p = .673')).toEqual([])
    expect(strangers('g = 0.35', 'g = −0.35')).toEqual([])
    expect(strangers('g = −0.35', 'g = 0.35')).toEqual(['−0.35'])
    expect(strangers('4-7-8 呼吸', '4, 7 and 8')).toEqual([])
    expect(strangers('g = 0.36', 'g = 0.35')).toEqual(['0.36'])
    const pair = 'anxiety: g = −0.32 (−0.48 to −0.16); depressive symptoms: g = −0.40 (−0.58 to −0.22)'
    expect(together({ g: -0.32, lo: -0.48, hi: -0.16 }, pair)).toBe(true)
    expect(together({ g: -0.32, lo: -0.58, hi: -0.22 }, pair)).toBe(false)
    expect(together({ g: 0.32, lo: 0.48, hi: 0.16 }, pair)).toBe(false)
  })
})

/* ---------- 出处 ---------- */

describe('出处', () => {
  const used = new Set(EVIDENCE_CARDS.flatMap(c => [c.source, ...c.contrary.map(x => x.claimId)]))

  it('卡片来源和相反证据引的每条研究都有出处简写，没有多余的', () => {
    for (const id of used) expect(Object.hasOwn(EVIDENCE_CITES, id), id).toBe(true)
    expect(Object.keys(EVIDENCE_CITES).sort()).toEqual([...used].sort())
  })

  it('年份、DOI、网址与证据库一致，DOI 格式正确', () => {
    for (const [id, cite] of Object.entries(EVIDENCE_CITES)) {
      const c = claim(id).citation
      expect(cite.year, id).toBe(c.year)
      expect(cite.doi, id).toBe(c.doi)
      expect(cite.url, id).toBe(c.url)
      expect(cite.url, id).toMatch(/^https:\/\/\S+$/)
      if (cite.doi) {
        expect(cite.doi, id).toMatch(/^10\.\d{4,9}\/\S+$/)
        expect(cite.url, id).toBe(`https://doi.org/${cite.doi}`)
      }
    }
  })

  it('作者和刊物取自原条目：姓氏在作者里，刊物是原刊物名去掉卷期', () => {
    for (const [id, cite] of Object.entries(EVIDENCE_CITES)) {
      const c = claim(id).citation
      const names = cite.who.replace(/ 等$/, '').split(' & ')
      for (const name of names) expect(c.authors, `${id}：${name}`).toContain(name)
      expect(c.venue, id).toContain(cite.venue)
      // 三位及以上作者写「等」，两位写「&」（DESIGN.md §8.10 的注释写法）
      if (/et al|,.*,/.test(c.authors.replace(/\(.*?\)/g, ''))) expect(cite.who, id).toMatch(/ 等$/)
    }
  })

  it('出处行和链接的写法', () => {
    const cite = EVIDENCE_CITES['breathing-fincham-2023-meta']
    expect(cite).toBeDefined()
    if (!cite) return
    expect(citeLine(cite)).toBe('Fincham 等 2023 · Scientific Reports')
    expect(citeLabel(cite)).toBe('doi:10.1038/s41598-022-27247-y')
    expect(citeHref(cite)).toBe('https://doi.org/10.1038/s41598-022-27247-y')
    const page = EVIDENCE_CITES['practice-neff-2023']
    expect(page && citeHref(page)).toBe(
      'https://self-compassion.org/exercises/exercise-2-self-compassion-break/',
    )
    expect(page && citeLabel(page)).toBe('self-compassion.org')
    for (const c of Object.values(EVIDENCE_CITES)) expect(citeLabel(c).length, c.url).toBeLessThanOrEqual(40)
  })
})

/* ---------- 练习和计划都有卡片 ---------- */

describe('练习和计划引用的研究都有卡片', () => {
  const ids = new Set(EVIDENCE_CARDS.map(c => c.id))

  it('每项练习的 evidence 和 evidenceClaims 引到的 id 都有卡片', () => {
    const missing = PRACTICES.flatMap(p =>
      [...p.evidence, ...p.evidenceClaims.flatMap(c => c.cites)]
        .filter(id => !ids.has(id))
        .map(id => `${p.id} → ${id}`),
    )
    expect(missing).toEqual([])
  })

  it('两份计划的出处都有卡片', () => {
    for (const [program, list] of Object.entries(PROGRAM_EVIDENCE)) {
      expect(list.length, program).toBeGreaterThan(0)
      for (const id of list) expect(ids.has(id), `${program} → ${id}`).toBe(true)
    }
  })

  it('cardsFor 按练习 evidence 的顺序给出卡片', async () => {
    const slow = PRACTICES.find(p => p.id === 'slow')
    expect(slow).toBeDefined()
    const cards = await cardsFor('slow')
    expect(cards.map(c => c.id)).toEqual(slow?.evidence)
    expect(await cardsFor('resonance')).toEqual([])
    expect((await cardById('breathing-laborde-2022-meta'))?.kind).toBe('元分析')
    expect(await cardById('nope')).toBeUndefined()
  })

  it('练习详情页的结论和注释：编号从 1 起，每条结论都有注释', async () => {
    const index = await loadEvidence()
    for (const p of PRACTICES) {
      const { settings, claims, notes } = index.notesFor(p.id)
      expect(claims.length, p.id).toBe(p.evidenceClaims.length)
      expect(
        notes.map(n => n.number),
        p.id,
      ).toEqual(notes.map((_, i) => i + 1))
      for (const c of claims) expect(c.notes.length, `${p.id}：${c.claim}`).toBeGreaterThan(0)
      for (const list of Object.values(settings)) expect(list.length, p.id).toBeGreaterThan(0)
      for (const n of notes) {
        expect(n.who, n.id).not.toBe('')
        expect(n.href, n.id).toMatch(/^https:\/\//)
        expect(n.what, n.id).toBe(index.card(n.id)?.note)
        expect(n.type, n.id).toBe(n.size ? `${n.kind}，${n.size.replaceAll(' · ', '、')}` : n.kind)
      }
    }
  })

  it('注释按页面上第一次出现的顺序编号：先「设置」的说明，再「依据」的结论', async () => {
    const index = await loadEvidence()
    for (const p of PRACTICES) {
      const { settings, claims, notes } = index.notesFor(p.id)
      const seen = [...Object.values(settings), ...claims.map(c => c.notes)].flat()
      expect([...new Set(seen)], p.id).toEqual(notes.map(n => n.number))
    }
  })

  it('慢呼吸和设计稿一样：节律说明的出处是注释 1（Shaffer & Meehan 2020）', async () => {
    const index = await loadEvidence()
    const { settings, notes } = index.notesFor('slow')
    expect(settings).toEqual({ rate: [1], ratio: [1] })
    expect(notes[0]?.byline).toBe('Shaffer & Meehan 2020')
    expect(notes[0]?.type).toBe('实践指南')
    expect(index.card('breathing-laborde-2022-meta')?.note).toBe(
      '练习中 RMSSD 增大，g = 0.53（95% CI 0.43–0.62）；练完即刻只剩 g = 0.14。多数研究偏倚风险高。',
    )
    expect(index.notesFor('focus').settings).toEqual({})
  })

  it('「设置」引到的研究都有卡片，键是 DETAIL 里那项练习的说明', () => {
    for (const [practice, map] of Object.entries(SETTING_EVIDENCE))
      for (const [key, list] of Object.entries(map ?? {})) {
        expect(Object.keys(DETAIL[practice as 'slow'] ?? {}), practice).toContain(`${key}Hint`)
        for (const id of list) expect(ids.has(id), `${practice}.${key} → ${id}`).toBe(true)
      }
  })
})

/* ---------- 练习详情页的注释 ---------- */

/** 两段文字最长的共同片段：注释照抄练习页上的结论，读起来像机器拼的 */
function longestShared(a: string, b: string): string {
  let best = ''
  const row = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = 0
    for (let j = 1; j <= b.length; j++) {
      const above = row[j] ?? 0
      row[j] = a[i - 1] === b[j - 1] ? diagonal + 1 : 0
      if ((row[j] ?? 0) > best.length) best = a.slice(i - (row[j] ?? 0), i)
      diagonal = above
    }
  }
  return best
}

describe('练习详情页的注释（DESIGN.md §8.10 Notes）', () => {
  const byId = new Map(EVIDENCE_CARDS.map(c => [c.id, c]))
  const settingIds = Object.values(SETTING_EVIDENCE).flatMap(map => Object.values(map ?? {}).flat())
  const citing = new Map<string, string[]>()
  for (const p of PRACTICES)
    for (const c of p.evidenceClaims)
      for (const id of c.cites) citing.set(id, [...(citing.get(id) ?? []), c.claim])

  it('练习的结论和「设置」引到的卡片都有注释', () => {
    const missing = [...citing.keys(), ...settingIds].filter(id => !byId.get(id)?.note)
    expect(missing).toEqual([])
  })

  it('注释是一两句短话，不超过 70 个字', () => {
    for (const c of EVIDENCE_CARDS) {
      if (!c.note) continue
      expect(c.note.length, c.id).toBeLessThanOrEqual(70)
      expect(c.note.split('。').length - 1, c.id).toBeGreaterThanOrEqual(1)
      expect(c.note.split('。').length - 1, c.id).toBeLessThanOrEqual(2)
    }
  })

  it('注释不照抄引用它的练习结论', () => {
    const copied = [...citing].flatMap(([id, claims]) => {
      const note = byId.get(id)?.note ?? ''
      return claims.flatMap(claim => {
        const shared = longestShared(note, claim)
        return shared.length >= 12 ? [`${id}：「${shared}」`] : []
      })
    })
    expect(copied).toEqual([])
  })
})

/* ---------- 文字 ---------- */

describe('文字', () => {
  it('没有禁用词（safety.ts 的 findForbidden）', () => {
    const bad = ALL_TEXTS.flatMap(({ where, text }) => {
      const hits = findForbidden(text)
      return hits.length ? [`${where}：${hits.join('、')}`] : []
    })
    expect(bad).toEqual([])
  })

  it('排版：空格、全角标点、负号和区间号、日期、频率', () => {
    const bad = ALL_TEXTS.flatMap(({ where, text }) => {
      const problems = typeset(text)
      return problems.length ? [`${where}：${problems.join('、')}：「${text}」`] : []
    })
    expect(bad).toEqual([])
  })

  it('结论、设计、局限、相反证据和「在应用中」都是完整的句子；题目和类型不带句号', () => {
    for (const c of EVIDENCE_CARDS) {
      for (const s of [
        c.claim,
        c.design,
        c.limits,
        ...c.contrary.map(x => x.text),
        ...(c.use ? [c.use] : []),
        ...(c.note ? [c.note] : []),
      ])
        expect(s, c.id).toMatch(/。$/u)
      for (const s of [c.topic, c.kind, c.size ?? '']) expect(s, c.id).not.toMatch(/[。，；]$/u)
      expect(c.topic, c.id).toMatch(/^\S.* · \S.*$/u)
    }
  })

  it('结论是一句话，不太长：卡片上用 17 号粗体，超过 70 个字就要五六行', () => {
    for (const c of EVIDENCE_CARDS) {
      expect(c.claim.length, c.id).toBeLessThanOrEqual(70)
      expect(c.claim.split('。').length, c.id).toBe(2)
    }
  })

  it('检查本身认得出错的写法', () => {
    expect(typeset('检索到2022年2月，纳入 12 项试验')).toEqual([])
    expect(typeset('纳入12项试验')).toContain('中文与数字、字母之间没空格')
    expect(typeset('g = -0.35')).toContain('负号用了连字符')
    expect(typeset('2022 年')).toContain('日期里有空格')
    expect(typeset('每分钟 6 次 · 6 次/分')).toContain('次/分 不是一位小数')
  })
})

/* ---------- 写法 ---------- */

describe('效应量和规模的写法（DESIGN.md §8.10）', () => {
  it('卡片里的效应量行：负数用减号，区间有负数时用「至」', () => {
    expect(formatEffect({ name: '压力', g: -0.35, lo: -0.55, hi: -0.14 })).toBe('g = −0.35（−0.55 至 −0.14）')
    expect(formatEffect({ name: '抑郁症状', g: -0.4, lo: -0.58, hi: -0.22 })).toBe(
      'g = −0.40（−0.58 至 −0.22）',
    )
    expect(formatEffect({ name: '', g: 0.04, lo: -0.01, hi: 0.09 })).toBe('g = 0.04（−0.01 至 0.09）')
  })

  it('注释里写明 95% CI，正数区间用「–」；原文写到三位小数的照写', () => {
    expect(formatEffect({ name: '', g: 0.53, lo: 0.43, hi: 0.62 }, 'g', 'note')).toBe(
      'g = 0.53（95% CI 0.43–0.62）',
    )
    expect(formatEffect({ name: '', g: 0.395, lo: 0.258, hi: 0.533 })).toBe('g = 0.395（0.258–0.533）')
    expect(formatEffect({ name: '', g: 0.38, lo: 0.296, hi: 0.465 }, 'd')).toBe('d = 0.380（0.296–0.465）')
    expect(formatEffect({ name: '', g: -0.32, lo: -0.41, hi: -0.24 }, 'SMD')).toBe(
      'SMD = −0.32（−0.41 至 −0.24）',
    )
  })

  it('规模、说明行和轴', () => {
    expect(formatSize({ k: 12, n: 785 })).toBe('12 项试验 · 785 人')
    expect(formatSize({ k: 71 }, 'studies')).toBe('71 项研究')
    expect(formatSize({ n: 400 })).toBe('400 人')
    expect(formatSize({})).toBe('')
    expect(metaLine({ kind: '元分析', size: '223 项研究' })).toBe('元分析 · 223 项研究')
    expect(metaLine({ kind: '实践指南' })).toBe('实践指南')
    const fincham = EVIDENCE_CARDS.find(c => c.id === 'breathing-fincham-2023-meta')
    // 与 draw.mjs 的 ciAxis 默认值一样：刻度到 0，轴在 0 的右边多留 0.2
    expect(effectAxis(fincham?.outcomes ?? [])).toEqual({ min: -0.8, max: 0.2, ticks: [-0.8, -0.5, -0.2, 0] })
    expect(effectAxis([{ lo: 0.03, hi: 0.62 }])).toEqual({ min: -0.2, max: 0.8, ticks: [0, 0.2, 0.5, 0.8] })
    expect(effectAxis([{ lo: -0.21, hi: 0.52 }])).toEqual({
      min: -0.5,
      max: 0.8,
      ticks: [-0.5, -0.2, 0, 0.2, 0.5, 0.8],
    })
    expect(axisPosition({ min: -0.8, max: 0.2 }, 0)).toBeCloseTo(0.8)
    expect(effectNote(fincham ?? { outcomes: [], direction: 'lower' })).toBe(
      '小于 0 表示比对照减轻。效应量约 0.2 算小，约 0.5 算中等，0.8 以上算大。',
    )
  })

  it('每张有效应量的卡片：轴包含 0 和全部区间，刻度从小到大', () => {
    for (const c of EVIDENCE_CARDS) {
      if (!c.outcomes) continue
      const axis = effectAxis(c.outcomes)
      expect(axis.ticks, c.id).toContain(0)
      // 刻度都在轴上，有数据的一端停在最外的刻度
      expect(Math.min(...axis.ticks), c.id).toBeGreaterThanOrEqual(axis.min)
      expect(Math.max(...axis.ticks), c.id).toBeLessThanOrEqual(axis.max)
      expect(axis.min, c.id).toBeLessThanOrEqual(Math.min(...c.outcomes.map(o => o.lo)))
      expect(axis.max, c.id).toBeGreaterThanOrEqual(Math.max(...c.outcomes.map(o => o.hi)))
      expect(
        [...axis.ticks].sort((a, b) => a - b),
        c.id,
      ).toEqual(axis.ticks)
      expect(effectNote(c), c.id).toBeDefined()
    }
  })
})

/* ---------- 依据页 ---------- */

describe('依据页的页面模型', () => {
  it('页头、方法、筛选和分组', async () => {
    const page = await loadEvidencePage()
    expect(page.folio).toEqual({ start: '174 条出处，逐条核对', end: EVIDENCE.reviewedShort })
    expect(page.method.first).toBe(EVIDENCE.method.lines[0])
    expect(page.method.more).toBe(EVIDENCE.method.more(EVIDENCE.method.lines.length - 1))
    expect(page.filters.map(f => f.id)).toEqual([...EVIDENCE_FILTERS])
    expect(page.filters[0]).toEqual({ id: 'all', label: '全部', count: EVIDENCE_CARDS.length })
    expect(page.sections.map(s => s.id)).toEqual([...EVIDENCE_CATEGORIES])
    expect(page.sections.flatMap(s => s.cards).length).toBe(EVIDENCE_CARDS.length)
    const breathing = page.cards.filter(c => c.category === 'breathing').length
    expect(page.filterCount('breathing')).toBe(`呼吸 · ${breathing} 条`)
    expect(page.grades.items.map(g => `${g.grade}${g.name}`)).toEqual(['A强', 'B中等', 'C有限', 'D不足'])
    expect(page.notAdopted.count).toBe(`${EVIDENCE.notAdopted.items.length} 项`)
  })

  it('在应用中：卡片对应到引用它的练习和计划', async () => {
    const page = await loadEvidencePage()
    expect(page.inApp['breathing-fincham-2023-rct']?.practices.map(p => p.name)).toContain('慢呼吸')
    expect(page.inApp['meditation-basso-2019']?.programs.map(p => p.id)).toEqual(['mindfulness-8w'])
    for (const c of page.cards) expect(page.inApp[c.id], c.id).toBeDefined()
  })

  it('深链接切到卡片自己的分类；设计类不在筛选里，用「全部」', () => {
    expect(filterFor({ category: 'breathing' })).toBe('breathing')
    expect(filterFor({ category: 'design' })).toBe('all')
    expect(cardHref('breathing-fincham-2023-meta')).toBe('/evidence#breathing-fincham-2023-meta')
    for (const f of EVIDENCE_FILTERS)
      if (f !== 'all') expect(filterCards(EVIDENCE_CARDS, f).length, f).toBeGreaterThan(0)
  })

  it('evidence.ts 不把卡片层和证据库静态打进主包', () => {
    expect(ACCESS_SOURCE).toBeDefined()
    expect(ACCESS_SOURCE).not.toMatch(/^import[^\n]*from '\.\/evidence-cards'/m)
    expect(ACCESS_SOURCE).not.toMatch(/^import[^\n]*evidence\.json/m)
    expect(ACCESS_SOURCE).toContain("import('./evidence-cards')")
  })
})
