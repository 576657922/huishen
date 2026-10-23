/**
 * 内容层的类型：练习目录、引导词、八周计划、研究证据。
 * 内容是纯数据，界面和引擎都从这里读取，不在组件里写死文案和参数。
 */
import type { AmbienceId, MusicId } from '@/audio/types'

/** 证据等级：A 强、B 中等、C 有限、D 不足 */
export type Grade = 'A' | 'B' | 'C' | 'D'

export type Category = 'meditation' | 'breathing' | 'sound'

/**
 * focus：自然呼吸，记录每次回神
 * count：数息（1–9）
 * guided：有引导词的练习
 * timer：无引导静坐，可设间隔钟声
 * paced：跟随节拍呼吸
 * sound：只听声音（可定时）
 * assessment：共振频率测定
 */
export type PracticeKind = 'focus' | 'count' | 'guided' | 'timer' | 'paced' | 'sound' | 'assessment'

export type PracticeId =
  | 'focus'
  | 'breath-count'
  | 'body-scan'
  | 'body-scan-sleep'
  | 'loving-kindness'
  | 'self-compassion'
  | 'breathing-space'
  | 'breathing-space-coping'
  | 'open-awareness'
  | 'walking'
  | 'pause'
  | 'grounding'
  | 'timer'
  | 'slow'
  | 'cyclic-sigh'
  | 'box'
  | 'pace-finder'
  | 'listen'
  | 'sleep'
  // 旧 id，等各模块迁移完后删除
  | 'resonance'
  | 'extended-exhale'
  | 'rf-assessment'
  | 'soundscape'

export type ScriptId =
  | 'focus'
  | 'breath-count'
  | 'body-scan'
  | 'body-scan-sleep'
  | 'loving-kindness'
  | 'self-compassion'
  | 'breathing-space'
  | 'breathing-space-intro'
  | 'breathing-space-coping'
  | 'open-awareness'
  | 'walking'
  | 'pause'
  | 'grounding'
  | 'slow'
  | 'cyclic-sigh'
  | 'box'

/** 练习详情页「依据」里的一条结论 */
export interface GradedClaim {
  /** 一句话，写明和什么比、结果怎样，以句号结尾 */
  claim: string
  /** 只针对这一条结果的证据等级（PRODUCT.md §9） */
  grade: Grade
  /** 支撑这一条的证据 id，都在这项练习的 evidence 里，对应 docs/research/evidence.json */
  cites: string[]
}

/** 节拍参数 */
export type PacedParams =
  /** 周期性叹息：cycle 为一轮秒数，按固定比例分成吸、再吸、长呼 */
  | { type: 'sigh'; cycle: number }
  /** 共振呼吸：rate 为每分钟次数；equal 吸呼等长，long 呼气更长 */
  | { type: 'resonance'; rate: number; ratio: 'equal' | 'long' }
  /** 固定秒数：吸、吸满后屏息、呼、呼空后停（屏息为 0 表示没有） */
  | { type: 'phases'; inhale: number; holdIn: number; exhale: number; holdOut: number }

export interface Practice {
  id: PracticeId
  category: Category
  kind: PracticeKind
  /** 中文名 */
  name: string
  /** 一句话说明怎么做，用于列表 */
  short: string
  /** 一段介绍：是什么、研究怎么说 */
  description: string
  /** 做法，3–5 步 */
  steps: string[]
  /** 可选时长（分钟）；sound 类可含 0 表示不限时 */
  durations: number[]
  defaultMinutes: number
  /**
   * 今日页推荐这项练习时，名字下面的一两句：怎么做，再加一句让人放心的话（DESIGN.md §13.2）。
   * 身体扫描类的第一个部位词与进度图的第一级相同
   */
  todayLine: string
  /** 工具类（如测定）为 null */
  grade: Grade | null
  /**
   * 详情页「依据」里的结论（DESIGN.md §8.10）：一条只说一个结果，各带自己的等级，
   * 同一项练习的几条可以不同。至少有一条的等级就是 grade
   */
  evidenceClaims: GradedClaim[]
  /**
   * @deprecated 改用 evidenceClaims。由各条结论用「；」连成的一句，只留给还没改过来的代码；
   * 不要把它整句配一个等级显示（几条结论的等级可能不同）
   */
  evidenceSummary: string
  /** 支撑这个练习的证据 id，对应 docs/research/evidence.json */
  evidence: string[]
  /** 这项练习特有的安全提示 */
  safety: string[]
  /** 默认背景声 */
  sound: { ambience: AmbienceId; music: MusicId }
  paced?: PacedParams
  scriptId?: ScriptId
}

/* ---------- 引导词 ---------- */

/**
 * 引导详细程度：core 任何档位都说；standard 在「标准」「详细」档说；detailed 只在「详细」档说。
 * 依据：新手需要更连续的引导，熟练后逐步减少（MBSR 的做法）。
 */
export type GuidanceDetail = 'core' | 'standard' | 'detailed'

export type GuidanceLevel = 'quiet' | 'standard' | 'detailed'

export interface ScriptLine {
  text: string
  /** 这句之后的停顿秒数；不填时按标点估算 */
  pause?: number
  /** 默认 core */
  detail?: GuidanceDetail
  /** 练习时长不少于这个分钟数时才说，用于长版本里更细的引导 */
  minMinutes?: number
  /** 朗读用的文字，只在需要避开多音字误读时填写；字幕仍显示 text */
  say?: string
}

export interface ScriptSection {
  id: string
  /** 段落名，显示在播放器上，如「双脚」「把善意给自己」 */
  title: string
  /** 分到的弹性（静默）时间的权重 */
  weight: number
  /** 段落开头朗读的话 */
  intro: ScriptLine[]
  /** 段落中间的简短提醒，只在静默时间足够长时插入 */
  reminders?: string[]
  /** 这一段至少留多少秒静默 */
  minSilence?: number
  /** 时长不超过这个分钟数时省略此段 */
  omitAtOrBelow?: number
  /** 播放器上可以「跳过这一处」（身体扫描的部位、慈心里的困难对象） */
  skippable?: boolean
}

export interface GuidedScript {
  id: ScriptId
  title: string
  /** 支持的时长范围（分钟） */
  minMinutes: number
  maxMinutes: number
  opening: ScriptLine[]
  sections: ScriptSection[]
  /** 结尾的话，在结束钟声之前说完 */
  closing: ScriptLine[]
}

/* ---------- 计划 ---------- */

export type ProgramId = 'mindfulness-8w' | 'breathing-4w'

export interface ProgramItem {
  practiceId: PracticeId
  minutes: number
  /** 覆盖练习的默认参数，如四周呼吸里每周的频率 { rate: 6.5 } */
  params?: Record<string, number | string>
}

export interface ProgramWeek {
  week: number
  title: string
  /** 一句话：这一周练什么 */
  theme: string
  /** 这一周的阅读说明，约 300–500 字，第一天显示，整周可看 */
  reading: string
  /** 七天各一句提示，每句不超过 80 字 */
  tips: string[]
  /** 每天的主练习（同一周相同） */
  daily: ProgramItem
  /** 保底日的短版本 */
  short?: ProgramItem
  /** 可选的补充练习，如三分钟呼吸空间 */
  extra?: ProgramItem[]
}

export interface Program {
  id: ProgramId
  title: string
  /** 一段话介绍：结构、每天多久、何时可能看到变化 */
  summary: string
  weeks: ProgramWeek[]
  /** 支撑这个计划结构的证据 id */
  evidence: string[]
}

/* ---------- 研究证据 ---------- */

export type EvidenceDomain = 'meditation' | 'breathing' | 'sound' | 'safety' | 'ux' | 'practice'

export type EvidenceWeight = 'high' | 'moderate' | 'low' | 'very-low'

export interface Citation {
  authors: string
  year: number
  title: string
  venue: string
  doi: string
  url: string
  pmid: string
}

export interface EvidenceClaim {
  id: string
  domain: EvidenceDomain
  topic: string
  finding: string
  finding_zh: string
  study_type: string
  sample: string
  limitations: string
  evidence_weight: EvidenceWeight
  app_implication: string
  citation: Citation
  verification: { verdict: 'verified' | 'corrected'; checked_against: string; problems: string }
}

/* ---------- 证据卡片（依据页、练习详情页的出处） ---------- */

/**
 * 卡片的分类，也是依据页分组的顺序。design 是回神用法的依据（练多久、怎样记录、怎样自评）；
 * 依据页的筛选只有冥想、呼吸、声音、安全（DESIGN.md §8.19），design 只在「全部」里出现
 */
export type EvidenceCategory = 'meditation' | 'breathing' | 'sound' | 'safety' | 'design'

/** 效应量的写法；三种都是标准化均数差，所以能用同一句「约 0.2 算小……」来读 */
export type EffectMetric = 'g' | 'd' | 'SMD'

/**
 * 正负号的含义，决定轴下的那句说明。各研究记正负的方式不同，不说清楚，同一个 −0.3 可能是变好也可能是变差：
 * lower 小于 0 表示比对照减轻；higher 大于 0 表示比对照增加；better 原文把改善记为正数
 */
export type EffectDirection = 'lower' | 'higher' | 'better'

/** 效应量那一行里研究数的单位：项试验、项研究、项比较 */
export type StudyUnit = 'trials' | 'studies' | 'comparisons'

/** 卡片上的一行效应量。数字照抄来源研究的 finding / finding_zh，测试逐个核对 */
export interface EffectOutcome {
  /** 结果的名字，如「压力」 */
  name: string
  /** 研究数，单位见 EvidenceCard.unit */
  k?: number
  /** 人数 */
  n?: number
  /** 估计值（g、d 或 SMD，见 EvidenceCard.metric） */
  g: number
  /** 95% 置信区间；原文没有区间的结果不进这里，改写在 stat，绝不补画区间 */
  lo: number
  hi: number
}

/** 相反证据：不支持这条结论的结果。原文同一篇里的阴性结果也可以引自己 */
export interface ContraryEvidence {
  claimId: string
  text: string
}

/** 出处的简写，组成「Fincham 等 2023 · Scientific Reports」和 DOI 链接 */
export interface EvidenceCite {
  /** 一位作者写姓，两位写「甲 & 乙」，三位及以上写「甲 等」；机构写简称 */
  who: string
  year: number
  /** 刊物或机构，取自 evidence.json 的 venue（去掉卷期页码） */
  venue: string
  /** 官方网页、课程手册没有 DOI，为空字符串，链接用 url */
  doi: string
  url: string
}

/**
 * 证据卡片（DESIGN.md §8.10、§14.3；字段顺序按 PRODUCT.md §9）。evidence.json 没有效应量、置信区间、
 * 对照句和相反证据，这一层逐条人工整理；数字只取自来源研究的 finding / finding_zh
 */
export interface EvidenceCard {
  /** 与 source 相同：深链接 /evidence#<id>，练习详情页的出处也按它找卡片 */
  id: string
  category: EvidenceCategory
  /** 卡片上方的题目：「呼吸练习 · 压力」 */
  topic: string
  /** 回神对 claim 所说那个结果的等级（PRODUCT.md §9），不是照搬 evidence_weight */
  grade: Grade
  /** 一句话结论，写明和什么比较 */
  claim: string
  /** 研究类型，收起时说明行的前半：「元分析」 */
  kind: string
  /** 规模，收起时说明行的后半：「223 项研究」 */
  size?: string
  /** 效应量；一张卡片的各行共用一条轴，正负号含义相同。与 stat 至少有一项 */
  outcomes?: readonly EffectOutcome[]
  /** 默认 g */
  metric?: EffectMetric
  /** 有 outcomes 时必填 */
  direction?: EffectDirection
  /** 默认 trials */
  unit?: StudyUnit
  /** 原文报告的其他统计量，或没有效应量时的一句说明：「ηp² < 0.001，p = 0.765」 */
  stat?: string
  /** 研究类型、样本与对照 */
  design: string
  /** 局限，一两句 */
  limits: string
  /** 相反证据；证据库里没有时为空 */
  contrary: readonly ContraryEvidence[]
  /** 来源研究的 id，对应 docs/research/evidence.json */
  source: string
  /** 在应用中：这条研究落在哪个默认值或做法上 */
  use?: string
  /**
   * 练习详情页注释里「发现了什么」的一句（DESIGN.md §8.10 Notes）。练习页上方的结论已经说了主要结果，
   * 注释补上剂量、关键数字或主要局限，不重复结论；练习引用到的卡片都要有
   */
  note?: string
}
