/**
 * 证据的访问层：依据页的页面模型、练习详情页的出处、效应量和出处的写法（DESIGN.md §8.10、§13.4、§13.8）。
 *
 * 体积分三层，首屏的主包里只有第一层：
 * 1. 同步：分类、格式化函数和几句说明，很小。
 * 2. 卡片层 evidence-cards.ts：依据页和练习详情页要用时 loadEvidence() 动态加载，同一个 Promise 反复用，
 *    可以直接交给路由的 loader 或 React 的 use()。
 * 3. 证据库全文 docs/research/evidence.json（约 800 KB）：只有 loadClaims() / claimById() 用到，单独成块；
 *    没有地方调用时不会被打包。卡片已经带上了界面要的全部字段，正常浏览用不到它。
 */
import { EVIDENCE, GRADE_NAMES, type NotAdopted } from './copy'
import { type CatalogPracticeId, PRACTICES } from './practices'
import { PROGRAMS } from './programs'
import type {
  EffectDirection,
  EffectMetric,
  EffectOutcome,
  EvidenceCard,
  EvidenceCategory,
  EvidenceCite,
  EvidenceClaim,
  Grade,
  PracticeId,
  ProgramId,
  StudyUnit,
} from './types'

export type {
  ContraryEvidence,
  EffectDirection,
  EffectMetric,
  EffectOutcome,
  EvidenceCard,
  EvidenceCategory,
  EvidenceCite,
  EvidenceClaim,
  StudyUnit,
} from './types'

/* ---------- 分类 ---------- */

/** docs/research/evidence.json 里的结论条数，页头写「174 条出处，逐条核对」；测试核对它与证据库一致 */
export const CLAIM_COUNT = 174

/** 依据页分组的顺序 */
export const EVIDENCE_CATEGORIES: readonly EvidenceCategory[] = Object.freeze([
  'meditation',
  'breathing',
  'sound',
  'safety',
  'design',
])

/**
 * 每个分类的名字和一句说明，用在依据页「全部」下的分组。名字与 EVIDENCE.filters 相同；
 * 「设计」不在筛选里（DESIGN.md §8.19 只有冥想、呼吸、声音、安全），它的卡片只在「全部」下出现
 */
export const EVIDENCE_CATEGORY_INFO: Readonly<
  Record<EvidenceCategory, { label: string; description: string }>
> = Object.freeze({
  meditation: {
    label: EVIDENCE.filters.meditation,
    description: '正念课程、手机应用和各项冥想练习，与不练习或其他方法相比的结果。',
  },
  breathing: {
    label: EVIDENCE.filters.breathing,
    description: '慢呼吸、周期性叹息和箱式呼吸对压力、情绪和心率变异性的影响，以及节律怎么选。',
  },
  sound: {
    label: EVIDENCE.filters.sound,
    description: '音乐、自然声和噪声对压力和睡眠的影响；多数研究不在日常生活里做。',
  },
  safety: {
    label: EVIDENCE.filters.safety,
    description: '练习中的不适有多常见、会持续多久，以及哪些练法有风险。',
  },
  design: {
    label: '设计',
    description: '回神的用法为什么这样定：练多久、引导说多少、怎样记录和自评。',
  },
})

/** 依据页的筛选：全部、冥想、呼吸、声音、安全 */
export type EvidenceFilter = keyof typeof EVIDENCE.filters

export const EVIDENCE_FILTERS: readonly EvidenceFilter[] = Object.freeze([
  'all',
  'meditation',
  'breathing',
  'sound',
  'safety',
])

/** 深链接 /evidence#<id> 打开时要切到的筛选：卡片自己的分类；「设计」不在筛选里，用「全部」 */
export const filterFor = (card: Pick<EvidenceCard, 'category'>): EvidenceFilter =>
  card.category === 'design' ? 'all' : card.category

export const filterCards = (
  cards: readonly EvidenceCard[],
  filter: EvidenceFilter,
): readonly EvidenceCard[] => (filter === 'all' ? cards : cards.filter(c => c.category === filter))

/** 指向依据页上某张卡片的链接；卡片的 id 就是出处的 id */
export const cardHref = (id: string): string => `/evidence#${id}`

/* ---------- 效应量的写法（DESIGN.md §4.4、§8.10） ---------- */

const MINUS = '−'

/** 一个数在原文里写了几位小数（照抄的数字就是原文的写法） */
function decimals(x: number): number {
  const s = String(Math.abs(x))
  const dot = s.indexOf('.')
  return dot < 0 ? 0 : s.length - dot - 1
}

/** 负数用减号 U+2212，不用连字符 */
function fixed(x: number, digits: number): string {
  const s = Math.abs(x).toFixed(digits)
  return x < 0 && Number(s) !== 0 ? `${MINUS}${s}` : s
}

/**
 * 「g = −0.35（−0.55 至 −0.14）」。row 是卡片里的效应量行，栏目名已经写了「95% CI」；
 * note 用在练习详情页的注释里：「g = 0.53（95% CI 0.43–0.62）」。
 * 区间里有负数时用「至」，否则用「–」：「−0.55–−0.14」会把减号和区间号读混。
 * 三个数取同样的小数位，至少两位（0.40 不写成 0.4），原文写到三位的照写
 */
export function formatEffect(
  o: EffectOutcome,
  metric: EffectMetric = 'g',
  style: 'row' | 'note' = 'row',
): string {
  const digits = Math.max(2, decimals(o.g), decimals(o.lo), decimals(o.hi))
  const lo = fixed(o.lo, digits)
  const hi = fixed(o.hi, digits)
  const range = o.lo < 0 || o.hi < 0 ? `${lo} 至 ${hi}` : `${lo}–${hi}`
  return `${metric} = ${fixed(o.g, digits)}（${style === 'note' ? `95% CI ${range}` : range}）`
}

const UNIT_LABEL: Readonly<Record<StudyUnit, string>> = Object.freeze({
  trials: '项试验',
  studies: '项研究',
  comparisons: '项比较',
})

/** 效应量行左边的规模：「12 项试验 · 785 人」；都没有时为空字符串 */
export function formatSize(o: Pick<EffectOutcome, 'k' | 'n'>, unit: StudyUnit = 'trials'): string {
  const parts: string[] = []
  if (o.k !== undefined) parts.push(`${o.k} ${UNIT_LABEL[unit]}`)
  if (o.n !== undefined) parts.push(`${o.n} 人`)
  return parts.join(' · ')
}

/** 收起的卡片下面的说明行：「元分析 · 223 项研究」 */
export const metaLine = (card: Pick<EvidenceCard, 'kind' | 'size'>): string =>
  card.size ? `${card.kind} · ${card.size}` : card.kind

const DIRECTION_NOTE: Readonly<Record<EffectDirection, string>> = Object.freeze({
  lower: '小于 0 表示比对照减轻。',
  higher: '大于 0 表示比对照增加。',
  better: '大于 0 表示比对照改善。',
})

const SIZE_NOTE = '效应量约 0.2 算小，约 0.5 算中等，0.8 以上算大。'

/** 效应量轴下面的说明（DESIGN.md §8.10）；没有效应量行的卡片没有轴，也没有这句 */
export function effectNote(card: Pick<EvidenceCard, 'outcomes' | 'direction'>): string | undefined {
  if (!card.outcomes?.length || !card.direction) return undefined
  return `${DIRECTION_NOTE[card.direction]}${SIZE_NOTE}`
}

export interface EffectAxis {
  /** 轴的两端，可能比最外的刻度多出一段（见 effectAxis） */
  min: number
  max: number
  /** 刻度：0，以及 ±0.2、±0.5、±0.8 这几个「小、中、大」的分界，区间更宽时再往外延 */
  ticks: readonly number[]
}

const AXIS_STEPS = [0.2, 0.5, 0.8, 1, 1.5, 2, 2.5, 3, 4, 5]
const EPS = 1e-9

/** 刚好盖住 x 的那一档刻度 */
const reach = (x: number): number => AXIS_STEPS.find(s => s >= x - EPS) ?? Math.ceil(x)

/** 区间都在 0 的一侧时，轴在 0 的另一侧多留的一段，免得 0 的竖线和「0」贴在边上（draw.mjs 的 ciAxis） */
const AXIS_MARGIN = 0.2

/**
 * 一张卡片各行共用的轴（DESIGN.md §8.10、§14.2 第 8 条）：一定包含 0，有数据的一端停在刻度上。
 * 例：Fincham 等 2023 的三行在 −0.58 到 −0.14 之间，刻度为 −0.8 · −0.5 · −0.2 · 0，轴从 −0.8 到 0.2
 */
export function effectAxis(outcomes: readonly Pick<EffectOutcome, 'lo' | 'hi'>[]): EffectAxis {
  const lo = Math.min(0, ...outcomes.map(o => o.lo))
  const hi = Math.max(0, ...outcomes.map(o => o.hi))
  const low = lo < 0 ? -reach(-lo) : 0
  const high = hi > 0 ? reach(hi) : 0
  const below = AXIS_STEPS.filter(s => s <= -low + EPS)
    .map(s => -s)
    .reverse()
  const above = AXIS_STEPS.filter(s => s <= high + EPS)
  return {
    min: low < 0 ? low : -AXIS_MARGIN,
    max: high > 0 ? high : AXIS_MARGIN,
    ticks: [...below, 0, ...above],
  }
}

/** 一个值在轴上的位置：min 为 0，max 为 1。画图时乘以去掉两边留白的宽度（draw.mjs 的 ciBar） */
export const axisPosition = (axis: Pick<EffectAxis, 'min' | 'max'>, value: number): number =>
  (value - axis.min) / (axis.max - axis.min)

/* ---------- 出处的写法 ---------- */

/** 「Fincham 等 2023 · Scientific Reports」 */
export const citeLine = (cite: EvidenceCite): string => `${cite.who} ${cite.year} · ${cite.venue}`

/** 出处的链接：有 DOI 时走 doi.org，官方网页和手册用原网址 */
export const citeHref = (cite: EvidenceCite): string => (cite.doi ? `https://doi.org/${cite.doi}` : cite.url)

/**
 * 链接上显示的字：「doi:10.1038/s41598-022-27247-y」。没有 DOI 时只写网站：链接一行不折行，
 * 完整网址（最长约 70 个字符）在手机上会撑出栏外；具体是哪一页由链接本身带着
 */
export const citeLabel = (cite: EvidenceCite): string =>
  cite.doi ? `doi:${cite.doi}` : new URL(cite.url).hostname.replace(/^www\./, '')

/* ---------- 计划的出处 ---------- */

/** 两份计划各自依据的卡片（programs/ 里的 evidence 留给证据库填，界面可以直接用这里） */
export const PROGRAM_EVIDENCE: Readonly<Record<ProgramId, readonly string[]>> = Object.freeze({
  'mindfulness-8w': Object.freeze([
    'meditation-galante-2023',
    'practice-santorelli-2017',
    'meditation-basso-2019',
    'meditation-strohmaier-2020',
    'meditation-lutz-2008',
  ]),
  'breathing-4w': Object.freeze([
    'breathing-fincham-2023-meta',
    'breathing-fincham-2023-rct',
    'breathing-steffen-2021',
    'breathing-shaffer-2020',
    'safety-szulczewski-2019',
  ]),
})

/* ---------- 练习详情页「设置」里的出处 ---------- */

/**
 * 「设置」里说到研究的说明，和它们的出处（detail-slow.png：节律的说明带注释 1）。
 * 键与 copy.ts 里 DETAIL[练习 id] 的说明同名：slow 的 rate 对应 rateHint，ratio 对应 ratioHint
 */
export const SETTING_EVIDENCE: Readonly<
  Partial<Record<CatalogPracticeId, Readonly<Record<string, readonly string[]>>>>
> = Object.freeze({
  slow: Object.freeze({
    rate: Object.freeze(['breathing-shaffer-2020']),
    ratio: Object.freeze(['breathing-shaffer-2020']),
  }),
})

/* ---------- 卡片层（动态加载） ---------- */

/** 练习详情页「依据」下的一条注释（DESIGN.md §8.10 Notes） */
export interface EvidenceNote {
  /** 注释编号，从 1 起，按页面上第一次引用的顺序：先「设置」，再「依据」的结论 */
  number: number
  /** 卡片 id，也是出处 id；链接到 cardHref(id) */
  id: string
  /** 「Laborde 等」 */
  who: string
  year: number
  /** 注释开头的作者和年份：「Laborde 等 2022」（ui 的 NoteItem.who） */
  byline: string
  /** 研究类型和规模：「元分析」「223 项研究」 */
  kind: string
  size?: string
  /** 作者后面那一小段：「元分析，223 项研究」；没有规模时只有类型 */
  type: string
  /** 发现了什么：卡片的 note，已含关键数字；补的是结论没说的剂量、数字或局限，不重复结论 */
  what: string
  venue: string
  /** 有 DOI 时是 DOI；官方网页、课程手册没有，为空字符串，链接用 href */
  doi: string
  /** 链接上显示的字和地址 */
  label: string
  href: string
}

/** 练习详情页上带注释的部分：「设置」的说明和「依据」的结论，各带注释编号；下面是注释 */
export interface PracticeEvidence {
  /** 键同 SETTING_EVIDENCE；没有带出处的设置时为空对象 */
  settings: Readonly<Record<string, readonly number[]>>
  claims: readonly { claim: string; grade: Grade; notes: readonly number[] }[]
  notes: readonly EvidenceNote[]
}

export interface EvidenceIndex {
  /** 全部卡片，按依据页的顺序 */
  readonly cards: readonly EvidenceCard[]
  card(id: string): EvidenceCard | undefined
  /** 卡片来源和相反证据的出处 */
  cite(claimId: string): EvidenceCite | undefined
  /** 这项练习引用的卡片，按练习 evidence 的顺序（强的在前） */
  forPractice(id: PracticeId): readonly EvidenceCard[]
  forProgram(id: ProgramId): readonly EvidenceCard[]
  /** 练习详情页「设置」的说明、「依据」的结论和注释 */
  notesFor(id: PracticeId): PracticeEvidence
}

function noteOf(card: EvidenceCard, cite: EvidenceCite | undefined, number: number): EvidenceNote {
  return {
    number,
    id: card.id,
    who: cite?.who ?? '',
    year: cite?.year ?? 0,
    byline: cite ? `${cite.who} ${cite.year}` : '',
    kind: card.kind,
    size: card.size,
    // 规模里的「·」改成顿号，免得和「，」混在一小段里：「元分析，27 项试验、1480 人」
    type: card.size ? `${card.kind}，${card.size.replaceAll(' · ', '、')}` : card.kind,
    what: card.note ?? card.claim,
    venue: cite?.venue ?? '',
    doi: cite?.doi ?? '',
    label: cite ? citeLabel(cite) : '',
    href: cite ? citeHref(cite) : '',
  }
}

function buildIndex(
  cards: readonly EvidenceCard[],
  cites: Readonly<Record<string, EvidenceCite>>,
): EvidenceIndex {
  const byId = new Map(cards.map(c => [c.id, c]))
  const card = (id: string): EvidenceCard | undefined => byId.get(id)
  const known = (ids: readonly string[]): EvidenceCard[] =>
    ids.flatMap(id => {
      const c = byId.get(id)
      return c ? [c] : []
    })
  const practice = (id: PracticeId) => PRACTICES.find(p => p.id === id)

  return Object.freeze({
    cards,
    card,
    cite: (claimId: string) => (Object.hasOwn(cites, claimId) ? cites[claimId] : undefined),
    forPractice: (id: PracticeId) => known(practice(id)?.evidence ?? []),
    forProgram: (id: ProgramId) => known(PROGRAM_EVIDENCE[id] ?? []),
    notesFor(id: PracticeId): PracticeEvidence {
      const p = practice(id)
      if (!p) return { settings: {}, claims: [], notes: [] }
      // 手机上「设置」在「依据」之前，注释按页面上第一次被引用的顺序编号；
      // 引到、但没有卡片的 id 不编号（测试保证不会发生）
      const settings = Object.entries(SETTING_EVIDENCE[p.id] ?? {})
      const order: string[] = []
      for (const ids of [...settings.map(([, ids]) => ids), ...p.evidenceClaims.map(c => c.cites)])
        for (const cite of ids) if (!order.includes(cite)) order.push(cite)
      const numbered = known(order)
      const numberOf = new Map(numbered.map((c, i) => [c.id, i + 1]))
      const numbers = (ids: readonly string[]): number[] =>
        ids.flatMap(cite => {
          const n = numberOf.get(cite)
          return n === undefined ? [] : [n]
        })
      return {
        settings: Object.fromEntries(settings.map(([key, ids]) => [key, numbers(ids)])),
        claims: p.evidenceClaims.map(c => ({ claim: c.claim, grade: c.grade, notes: numbers(c.cites) })),
        notes: numbered.map((c, i) => noteOf(c, cites[c.source], i + 1)),
      }
    },
  })
}

let evidencePromise: Promise<EvidenceIndex> | undefined

/**
 * 加载卡片层。同一个 Promise 反复返回，可以直接交给 React 的 use()；
 * 加载失败（离线且没有缓存）时清掉缓存，下次调用会重试
 */
export function loadEvidence(): Promise<EvidenceIndex> {
  evidencePromise ??= import('./evidence-cards').then(
    m => buildIndex(m.EVIDENCE_CARDS, m.EVIDENCE_CITES),
    (error: unknown) => {
      evidencePromise = undefined
      throw error
    },
  )
  return evidencePromise
}

export const cardById = (id: string): Promise<EvidenceCard | undefined> =>
  loadEvidence().then(e => e.card(id))

export const cardsFor = (id: PracticeId): Promise<readonly EvidenceCard[]> =>
  loadEvidence().then(e => e.forPractice(id))

/* ---------- 依据页的页面模型 ---------- */

export interface EvidenceSection {
  id: EvidenceCategory
  label: string
  description: string
  cards: readonly EvidenceCard[]
}

/** 卡片在应用里的位置：引用它的练习和计划，以及它落在哪个默认值或做法上 */
export interface EvidenceInApp {
  practices: readonly { id: CatalogPracticeId; name: string }[]
  programs: readonly { id: ProgramId; title: string }[]
  use?: string
}

export interface EvidencePage {
  title: string
  /** 页头下的一行：「174 条出处，逐条核对」 · 「最后核对：2026年10月」 */
  folio: { start: string; end: string }
  intro: string
  /** 这些结论是怎么来的：先显示第一段，「展开其余 3 段」显示其余 */
  method: { title: string; first: string; rest: readonly string[]; more: string; reviewed: string }
  /** 「结论」一节的标题；右边是 filterCount */
  conclusionsTitle: string
  filters: readonly { id: EvidenceFilter; label: string; count: number }[]
  /** 「呼吸 · 3 条」 */
  filterCount: (filter: EvidenceFilter) => string
  sections: readonly EvidenceSection[]
  cards: readonly EvidenceCard[]
  /** 按卡片 id */
  inApp: Readonly<Record<string, EvidenceInApp>>
  /** 卡片各栏的名字（PRODUCT.md §9 的顺序）和展开、收起 */
  fields: typeof EVIDENCE.card
  /** 卡片上回神自己加的两处：「在应用中」一栏的名字，没有相反证据时的那句话 */
  labels: { inApp: string; noContrary: string }
  grades: {
    title: string
    items: readonly { grade: Grade; name: string; definition: string }[]
    scope: string
  }
  unknown: { title: string; lines: readonly string[] }
  notAdopted: {
    title: string
    count: string
    intro: string
    /** cards：这一项引用的研究里有卡片的那些 id */
    items: readonly (NotAdopted & { cards: readonly string[] })[]
  }
  empty: typeof EVIDENCE.empty
}

const GRADES: readonly Grade[] = ['A', 'B', 'C', 'D']

/** 回神自己加的两处说法，DESIGN.md 没有规定，写在这里 */
const LABELS = Object.freeze({
  inApp: '在应用中',
  noContrary: '我们没有找到相反的结果。',
})

function inAppOf(card: EvidenceCard): EvidenceInApp {
  const practices = PRACTICES.filter(
    p => p.evidence.includes(card.id) || p.evidenceClaims.some(c => c.cites.includes(card.id)),
  ).map(p => ({ id: p.id, name: p.name }))
  const programs = (Object.keys(PROGRAM_EVIDENCE) as ProgramId[])
    .filter(id => PROGRAM_EVIDENCE[id].includes(card.id))
    .map(id => ({ id, title: PROGRAMS[id].title }))
  return { practices, programs, use: card.use }
}

/** 依据页要的全部内容，由卡片层和 copy.ts 的 EVIDENCE 合成 */
export function buildEvidencePage(index: EvidenceIndex): EvidencePage {
  const { cards } = index
  const [first = '', ...rest] = EVIDENCE.method.lines
  const labelOf = (filter: EvidenceFilter): string => EVIDENCE.filters[filter]
  return {
    title: EVIDENCE.title,
    folio: { start: EVIDENCE.sources(CLAIM_COUNT), end: EVIDENCE.reviewedShort },
    intro: EVIDENCE.intro,
    method: {
      title: EVIDENCE.method.title,
      first,
      rest,
      more: EVIDENCE.method.more(rest.length),
      reviewed: EVIDENCE.method.reviewed,
    },
    conclusionsTitle: EVIDENCE.card.conclusion,
    filters: EVIDENCE_FILTERS.map(id => ({ id, label: labelOf(id), count: filterCards(cards, id).length })),
    filterCount: filter => EVIDENCE.filterCount(labelOf(filter), filterCards(cards, filter).length),
    sections: EVIDENCE_CATEGORIES.map(id => ({
      id,
      ...EVIDENCE_CATEGORY_INFO[id],
      cards: cards.filter(c => c.category === id),
    })),
    cards,
    inApp: Object.fromEntries(cards.map(c => [c.id, inAppOf(c)])),
    fields: EVIDENCE.card,
    labels: LABELS,
    grades: {
      title: EVIDENCE.grades.title,
      items: GRADES.map(grade => ({
        grade,
        name: GRADE_NAMES[grade],
        definition: EVIDENCE.grades.definitions[grade],
      })),
      scope: EVIDENCE.grades.scope,
    },
    unknown: EVIDENCE.unknown,
    notAdopted: {
      title: EVIDENCE.notAdopted.title,
      count: EVIDENCE.notAdopted.count(EVIDENCE.notAdopted.items.length),
      intro: EVIDENCE.notAdopted.intro,
      items: EVIDENCE.notAdopted.items.map(item => ({
        ...item,
        cards: item.evidence.filter(id => index.card(id) !== undefined),
      })),
    },
    empty: EVIDENCE.empty,
  }
}

let pagePromise: Promise<EvidencePage> | undefined

/** 依据页的页面模型；和 loadEvidence() 一样只加载一次 */
export function loadEvidencePage(): Promise<EvidencePage> {
  pagePromise ??= loadEvidence().then(buildEvidencePage, (error: unknown) => {
    pagePromise = undefined
    throw error
  })
  return pagePromise
}

/* ---------- 证据库全文（单独成块，按需加载） ---------- */

/** 用 glob 而不是 import()：类型检查不去推断 800 KB 的 JSON，构建时仍然单独成块 */
const CLAIM_FILES = import.meta.glob<{ claims: readonly EvidenceClaim[] }>(
  '../../docs/research/evidence.json',
  {
    import: 'default',
  },
)

let claimsPromise: Promise<ReadonlyMap<string, EvidenceClaim>> | undefined

/**
 * evidence.json 的全部结论，按 id；研究用的原文、核查记录都在这里。
 * 界面要的字段卡片里都有，不要为了显示去调它：只要有一处调用，构建就会多出一个约 800 KB 的块，
 * 而 PWA 预缓存全部 js，每个人安装时都要下载
 */
export function loadClaims(): Promise<ReadonlyMap<string, EvidenceClaim>> {
  const load = Object.values(CLAIM_FILES)[0]
  if (!load) return Promise.reject(new Error('构建里没有 docs/research/evidence.json'))
  claimsPromise ??= load().then(
    data => new Map(data.claims.map(c => [c.id, c])),
    (error: unknown) => {
      claimsPromise = undefined
      throw error
    },
  )
  return claimsPromise
}

export const claimById = (id: string): Promise<EvidenceClaim | undefined> => loadClaims().then(m => m.get(id))
