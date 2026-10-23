/**
 * 练习目录：每项练习的名称、做法、时长、证据等级与摘要、安全提示、默认声音和节拍。
 * 界面、引擎、计划和记录都从这里读，组件里不写死文案和参数。
 *
 * 依据与约定：
 * - 时长、默认时长和等级按 PRODUCT.md §2。PRODUCT 没写的几项（睡前身体扫描、应对版、落地练习，
 *   以及两种听声音的等级）在各自条目的注释里说明理由。等级只针对文案里提到的那个结果（PRODUCT §9），
 *   介绍里的「证据：中等」等字样与等级一一对应：A 强、B 中等、C 有限、D 不足。
 * - 证据 id 对应 docs/research/evidence.json，按证据强弱排列，强的在前。
 * - 每条好处都写明和什么比、幅度多大，措辞不超过所引的证据（meditation-vandam-2018）。
 *   介绍用白话说结论，详情页的结论（evidenceClaims）给数字和对照，两处不重复同一句话。
 *   结论一条只说一个结果、各带等级，强弱不同的结果不放进同一句（DESIGN.md §8.10）：同一项练习可以有一条 A、一条 D，
 *   比如课程本身的证据强、单独练这一项的证据不足。练习自己的等级仍是介绍里写到的那个结果的等级，至少有一条结论与它相同。
 * - todayLine 是今日页推荐时名字下面的一两句（DESIGN.md §13.2）：怎么做，再加一句让人放心的话。
 * - 安全提示直接取 safety.ts 的 TECHNIQUE_WARNINGS（safety.notes §5、breathing.notes §6），
 *   详情页和其他地方只有一个来源，不会各说各的。呼吸类的第一条都是「轻柔地呼吸，不必吸得很深。」，
 *   周期性叹息例外：它本来就要吸到七八成再补一口，引导词和安全提示都改说「吸气要轻，只到七八成满」；
 *   这个例外请产品写进 PRODUCT §10。
 * - 健康情况检查的分工：这里决定隐藏什么、不推荐什么、默认值怎样变（isHidden、isDiscouraged、adjustedDefaults、
 *   copingOptions），补充提示的文字取自 safety.ts 的 SCREENING_NOTES；safety.ts 的 HEALTH_CHECK 负责把这些调整
 *   讲给用户听，两边由测试核对。
 * - 名称、时长和做法与 scripts/ 里的引导词一致。v1 的引导是屏幕上一句一句的文字，没有语音（PRODUCT §0、§5），
 *   做法里写「目光落在屏幕上」，不写「听」引导。
 * - v1 暂不提供正念行走和睡前身体扫描（V1_UNAVAILABLE）：条目、引导词和安全提示都留着，等真人录音；
 *   练习页、今日页、两个快捷面板和计划都用 isOffered 过滤。
 * - 可选的健康情况检查怎样调整可见练习和默认值，在文件末尾（PRODUCT §10、safety.notes §4）。
 */
import type { SoundMode } from '@/audio/types'
import { SCREENING_NOTES, TECHNIQUE_WARNINGS } from './safety'
import type {
  Category,
  GradedClaim,
  GuidanceLevel,
  PacedParams,
  Practice,
  PracticeId,
  ScriptId,
} from './types'

/** 已经不在目录里的旧 id：旧记录里可能还有 */
export type LegacyPracticeId = 'resonance' | 'extended-exhale' | 'rf-assessment' | 'soundscape'

export type CatalogPracticeId = Exclude<PracticeId, LegacyPracticeId>

export type CatalogPractice = Practice & { id: CatalogPracticeId }

export const CATEGORY_LABEL: Readonly<Record<Category, string>> = Object.freeze({
  meditation: '冥想',
  breathing: '呼吸',
  sound: '声音',
})

/** 安全提示复制一份再放进目录：目录自己冻结自己的数据，不依赖、也不改动 safety.ts 的数组 */
const warnings = (id: CatalogPracticeId): string[] => [...TECHNIQUE_WARNINGS[id]]

/**
 * 详情页「依据」的结论：一条只说一个结果，各带自己的等级（DESIGN.md §8.10、§14.3）。
 * 旧的 evidenceSummary 由这几条用「；」连成一句，只留给还没改用 evidenceClaims 的代码
 */
function claims(...list: GradedClaim[]): Pick<Practice, 'evidenceClaims' | 'evidenceSummary'> {
  return {
    evidenceClaims: list,
    evidenceSummary: `${list.map(c => c.claim.replace(/。$/, '')).join('；')}。`,
  }
}

/* ---------- 默认的声音和节拍 ---------- */

/**
 * 水声在前（PRODUCT §2；sound-buxton-2021 里水声的效应较大，但估计很不精确）。引导类练习和「听声音 · 放松」
 * 默认溪流声、不加音乐（sounds.ts 的 SOUND_PRESETS.relax 从 listen 取）
 */
const STREAM = { ambience: 'stream', music: 'none' } as const
/** 呼吸练习和睡前：雨声是平稳的底，不像海浪那样有自己的起伏周期，不和节拍抢 */
const RAIN = { ambience: 'rain', music: 'none' } as const
/** 要听周围声音的、在户外走的、只有一分钟的练习、测量和舒适度测试：不放背景声 */
const QUIET = { ambience: 'none', music: 'none' } as const

/** 慢呼吸默认每分钟 5.5 次，吸 4.5 秒、呼 6.5 秒（PRODUCT §2） */
const SLOW_PACE: PacedParams = { type: 'resonance', rate: 5.5, ratio: 'long' }

/**
 * 轻而慢的呼吸：每分钟 6 次，约吸 4 秒、呼 6 秒。有惊恐发作时不再往更慢推，
 * 也用它代替「现在有点难」里周期性叹息的大口吸气（breathing.notes §6、breathing-meuret-2008）
 */
export const LIGHT_SLOW_PACE: PacedParams = { type: 'resonance', rate: 6, ratio: 'long' }

/** 键和 id 必须一致，漏写或写错一项都通不过类型检查 */
type Catalogue = { readonly [K in CatalogPracticeId]: CatalogPractice & { readonly id: K } }

/** 目录是全局共享的常量：冻结后，误改会立刻报错，而不是悄悄影响别的页面 */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value) as unknown[]) deepFreeze(v)
  }
  return value
}

export const PRACTICE_BY_ID: Catalogue = deepFreeze<Catalogue>({
  /* ---------- 冥想 ---------- */

  focus: {
    id: 'focus',
    category: 'meditation',
    kind: 'focus',
    name: '专注呼吸',
    short: '留意呼吸，走神了就回来',
    todayLine: '把注意力放在呼吸上。发现走神了，点一下「回神」，再回到呼吸。',
    description:
      '把注意力放在呼吸上；发现走神了，就轻轻放下念头，回到呼吸，这一来一回就是练习。' +
      // 课程的结果来自线下、老师带领的团体课，作者明说不能推到手机应用上（meditation-galante-2023）；应用的结果另说
      '老师带领的 8 周正念课程以它为基础，与不练习相比，压力、焦虑和低落情绪平均小到中等程度减轻；只用手机应用练习的研究里，焦虑和低落平均小幅减轻（证据：中等）。' +
      '两者都不比运动、心理咨询等方法更好，单独练专注呼吸的研究也还很少。' +
      // 10 分钟是 PRODUCT §2 的默认，不是研究给出的剂量：课程更长、练得更多，没有看到更大的好处（meditation-strohmaier-2020）
      '适合刚开始练习的人，可以从每天 10 分钟开始。',
    steps: [
      '坐着或躺着，目光落在屏幕上；安静的时候，可以闭上眼睛。',
      '找一处容易感觉到呼吸的地方：腹部、胸口或鼻孔边。',
      '不用控制呼吸，只是跟着一吸一呼。',
      '发现走神了，点「回神」、轻点屏幕或按空格键，再回到呼吸。',
      '结束前，把注意力放宽到整个身体。',
    ],
    durations: [5, 10, 15, 20, 30],
    defaultMinutes: 10,
    // B：作为正念课程的核心部分；单独练专注呼吸的结局研究很少（meditation.notes §2）
    grade: 'B',
    ...claims(
      // 课程本身的证据为 A（meditation.notes §2）；练习的等级 B 针对的是应用里的练法
      {
        claim:
          '13 项随机试验、2371 人的个体数据汇总里，老师带领的八周正念课程与不练习相比，心理困扰小到中等程度减轻（SMD −0.32）。',
        grade: 'A',
        cites: ['meditation-galante-2023'],
      },
      {
        claim: '其中设了运动、健康课程等积极对照的试验里，正念课程没有显示出额外的好处。',
        grade: 'B',
        cites: ['meditation-galante-2023'],
      },
      {
        claim: '45 项手机应用试验的汇总里，与等待名单等对照相比，抑郁和焦虑小幅减轻（g 约 0.25）。',
        grade: 'B',
        cites: ['meditation-linardon-2024'],
      },
    ),
    evidence: [
      'meditation-galante-2023',
      'meditation-linardon-2024',
      'meditation-goldberg-2022',
      'meditation-lindsay-2018',
      'meditation-hasenkamp-2012',
    ],
    safety: warnings('focus'),
    sound: STREAM,
    scriptId: 'focus',
  },

  'breath-count': {
    id: 'breath-count',
    category: 'meditation',
    kind: 'count',
    name: '数息',
    short: '默数呼吸，数到 9 再从 1 开始',
    todayLine: '每次呼完气，在心里数一个数，数到 9 再从 1 开始。数乱了，就从 1 重新数。',
    description:
      '一吸一呼算一口气，在心里从 1 数到 9，再从 1 开始：第 1–8 口气点左边，第 9 口气点右边，数乱了就点「数乱了」。' +
      '适合觉得只留意呼吸有点空、想有件具体的事可做的人。' +
      // 写出试验的剂量：每次 25 分钟，比这里的 10 分钟长得多（meditation-levinson-2014）
      '在一项小型随机试验里，连续 4 周、每个工作日练两次、每次 25 分钟，走神比不训练或做工作记忆训练的人减少得更多（证据：有限）。' +
      '练完看到的是数息练习数据，不是「正念分数」；想前后比较，每次都选 15 分钟。',
    steps: [
      '坐稳，眼睛至少半睁，目光放低，落在屏幕上。',
      '感受鼻孔和上唇之间，气息进来、出去。',
      '每次呼气结束，在心里数一个数；第 1–8 口气点左边，第 9 口气点右边。',
      '忘了数到几或数过了 9，点「数乱了」，从 1 重新数。',
      '屏幕上出现「数到这里就好」，就不用再点了，把注意力放宽到整个身体。',
    ],
    // 15 分钟是测量版（meditation-levinson-2014 研究 2）；5、10 分钟只算练习
    durations: [5, 10, 15],
    defaultMinutes: 10,
    grade: 'C',
    ...claims(
      {
        claim: '71 人的随机试验里，4 周数息训练比不训练或做工作记忆训练更能减少走神。',
        grade: 'C',
        cites: ['meditation-levinson-2014'],
      },
      {
        claim: '数得准不准与自评正念只有弱相关，不能当作正念分数。',
        grade: 'C',
        cites: ['meditation-levinson-2014', 'meditation-wong-2018', 'meditation-treves-2025'],
      },
    ),
    evidence: [
      'meditation-levinson-2014',
      'meditation-wong-2018',
      'meditation-treves-2025',
      'meditation-hasenkamp-2012',
    ],
    safety: warnings('breath-count'),
    // 测量版要每次条件相同，研究里也没有背景声；想听可以自己加
    sound: QUIET,
    scriptId: 'breath-count',
  },

  'body-scan': {
    id: 'body-scan',
    category: 'meditation',
    kind: 'guided',
    name: '身体扫描',
    short: '从左脚开始，一处处往上感受',
    todayLine: '从左腿开始，一处一处往上，留意身体的感觉。可以躺着练，睡着了也没关系。',
    description:
      '从左脚开始，把注意力一处一处往上移，感受每个部位此刻的样子，不需要放松，也不需要改变什么。' +
      '它是正念课程里的基础练习；单独练身体扫描的研究少、规模小，目前只看到正念水平略有提升（证据：有限）。' +
      '适合想更熟悉身体感觉的人。' +
      '躺着练可能会睡着，没关系；想保持清醒，可以坐着练。',
    steps: [
      '躺下或坐在椅子上，目光落在屏幕上；在一处停留时，可以闭上眼睛。',
      '先感受呼吸时腹部的起伏。',
      '从左脚开始，一处一处往上，在每个部位停一会儿。',
      '有感觉就留意它；没有感觉，知道没有感觉也可以。',
      '最后感受整个身体在呼吸。',
    ],
    durations: [5, 10, 20],
    defaultMinutes: 10,
    // C：只针对正念水平；单独练对健康结局的证据不足（practice-gan-2022），文案里不承诺健康效果
    grade: 'C',
    ...claims(
      {
        claim:
          '14 篇单独练身体扫描的随机试验汇总里，与不练习相比，正念水平小幅提升（g = 0.27），研究质量偏低。',
        grade: 'C',
        cites: ['practice-gan-2022'],
      },
      {
        claim: '同一汇总里，其他健康指标没有明确改善；作者认为，单独做身体扫描不足以带来健康上的好处。',
        grade: 'D',
        cites: ['practice-gan-2022'],
      },
    ),
    evidence: ['practice-santorelli-2017', 'practice-gan-2022', 'safety-nccih-2021-relaxation'],
    safety: warnings('body-scan'),
    sound: STREAM,
    scriptId: 'body-scan',
  },

  'breathing-space': {
    id: 'breathing-space',
    category: 'meditation',
    kind: 'guided',
    name: '三分钟呼吸空间',
    short: '觉察此刻，集中到呼吸，再扩展到全身',
    todayLine: '先觉察此刻，再集中到呼吸，最后扩展到全身。忙乱的时候，用它停一停。',
    description:
      '三步，像一个沙漏：先觉察此刻的念头、情绪和身体感觉，再把注意力集中到呼吸，最后扩展到整个身体。' +
      '它来自 MBCT（一种八周的正念课程），适合在忙碌或心烦时停一停。' +
      '短时间的正念练习对情绪可能只有很小的帮助，这三步本身也还没有单独的随机试验（证据：有限）。' +
      '5 分钟是入门两步版：先集中到呼吸，再扩展到全身，刚开始练更容易上手。',
    steps: [
      '坐直，不用僵硬；目光放低，落在屏幕上。',
      '觉察：此刻有什么念头、情绪和身体感觉，承认它们在。',
      '集中：把注意力收到腹部的呼吸上，也可以换成双脚。',
      '扩展：感受整个身体都在呼吸，带着这份觉察进入下一刻。',
    ],
    // 5 分钟读入门两步版（practice-mander-2019），见 scriptIdFor
    durations: [3, 5],
    defaultMinutes: 3,
    grade: 'C',
    ...claims(
      {
        claim:
          '65 项随机试验的汇总里，短时间的正念练习让负面情绪比对照小幅减轻（g = 0.21），校正发表偏倚后接近零。',
        grade: 'C',
        cites: ['meditation-schumer-2018'],
      },
      {
        claim: '一项 162 人的门诊试验里，每次会谈开头做 5 分钟改编版，并不比简短的放松练习更好。',
        grade: 'C',
        cites: ['practice-mander-2019'],
      },
    ),
    evidence: ['practice-mander-2019', 'meditation-schumer-2018', 'practice-deroche-2025'],
    safety: warnings('breathing-space'),
    sound: STREAM,
    scriptId: 'breathing-space',
  },

  'loving-kindness': {
    id: 'loving-kindness',
    category: 'meditation',
    kind: 'guided',
    name: '慈心',
    short: '默念祝愿，从亲近的人到所有生命',
    todayLine: '先把祝愿给一位让你心里一暖的人，再给自己和更多的人。没什么感觉也没关系。',
    description:
      '在心里默念几句祝愿，比如「愿你平安」，先给一位让你心里一暖的人，再给自己，然后扩大到更多的人。' +
      '与不练习相比，慈心练习可能让日常的积极情绪小到中等程度增加（证据：中等），但不比其他积极练习更好。' +
      '刚开始念起来生硬、没什么感觉，或者勾起难过，都很常见。' +
      '适合想多培养一些善意的人，建议先练过几次专注呼吸；「有点难相处的人」只在 20 分钟版出现，可以跳过。',
    steps: [
      '找个舒服的姿势，把注意力放到胸口附近。',
      '想起一个让你心里一暖的人，小动物也可以。',
      '在心里把祝愿慢慢说给对方：愿你平安，愿你健康，愿你内心安宁，愿你自在。',
      '再把同样的祝愿给自己，然后扩大到更多的人，直到所有生命。',
      '没有特别的感觉也没关系，有一点点善意就够了。',
    ],
    durations: [5, 10, 20],
    defaultMinutes: 10,
    // B：只针对日常积极情绪（meditation-zeng-2015）；不承诺减轻抑郁
    grade: 'B',
    // g 约 0.4 只来自 8 项以等待为对照的随机试验，24 篇文献里还有非随机研究（meditation-zeng-2015）；
    // 相反的结果也写上（practice-petrovic-2024：减少消极情绪不如其他疗法，6 项研究）
    ...claims(
      {
        claim: '8 项以等待为对照的随机试验里，慈心练习让日常积极情绪小到中等程度增加（g 约 0.4）。',
        grade: 'B',
        cites: ['meditation-zeng-2015'],
      },
      // 和积极对照的比较，每项只有 3–6 项研究
      {
        claim:
          '23 项随机试验的汇总里，它与其他积极练习相比没有明显差别，在减少消极情绪上还略不如其他心理方法（g = −0.19）。',
        grade: 'C',
        cites: ['practice-petrovic-2024'],
      },
    ),
    evidence: [
      'meditation-zeng-2015',
      'practice-petrovic-2024',
      'meditation-galante-2014',
      'practice-fredrickson-2008',
      'practice-schroter-2022',
    ],
    safety: warnings('loving-kindness'),
    sound: STREAM,
    scriptId: 'loving-kindness',
  },

  'self-compassion': {
    id: 'self-compassion',
    category: 'meditation',
    kind: 'guided',
    name: '自我关怀',
    short: '难受的时候，对自己说三句话',
    todayLine: '想一件有点烦心的小事，对自己说三句话。选的事不用太重，三四分就够了。',
    description:
      // 前两句是详情页的导语，讲清它是什么、三句话各在做什么（说法与八周正念第 7 周的说明一致）；做法在 steps
      '自我关怀，是在难受的时候，像对待好朋友那样对待自己，不再给自己多加一层自责。' +
      '练习里的三句话各有用处：「这很难受」，先承认此刻不好受；「有这种感受的，不只我一个」，想起谁都有难的时候；「愿我善待自己」，再问问自己，此刻需要听到什么。' +
      // 对照是等待名单或其他活动；只和积极活动比，自我批评不再显著。团体的优势只在「自我关怀」这一项（meditation-ferrari-2019）
      '与等待或其他活动相比，自我关怀类的课程和练习让自我批评和压力平均中等程度减少（证据：中等）；只和其他积极活动相比时，自我批评的差别就不明显了。' +
      '适合常常对自己很苛刻的人；选的事不用太重。',
    steps: [
      '想一件让你有点烦心、但不太重的小事。',
      '留意它在身体哪里，允许这个感觉在。',
      '对自己说：这很难受。',
      '再说：有这种感受的，不只我一个。手可以放在胸口，也可以不放。',
      '然后说：愿我善待自己。再问问自己，此刻需要听到什么。',
    ],
    durations: [5],
    defaultMinutes: 5,
    grade: 'B',
    ...claims(
      {
        claim:
          '27 项随机试验汇总，对照是等待名单或其他活动，自我批评（g = 0.56）和压力（g = 0.67，5 项试验）中等程度减少。',
        grade: 'B',
        cites: ['meditation-ferrari-2019'],
      },
      {
        claim: '以积极活动为对照时，自我批评的改善不再显著。',
        grade: 'C',
        cites: ['meditation-ferrari-2019'],
      },
      {
        claim: '团体形式对自我关怀的提升（g = 0.81）大于个人形式（g = 0.37）。',
        grade: 'C',
        cites: ['meditation-ferrari-2019'],
      },
      {
        claim: '这三步做法本身，还没有单独检验过。',
        grade: 'D',
        cites: ['practice-neff-2023'],
      },
    ),
    evidence: ['meditation-ferrari-2019', 'meditation-galante-2014', 'practice-neff-2023'],
    safety: warnings('self-compassion'),
    sound: STREAM,
    scriptId: 'self-compassion',
  },

  'open-awareness': {
    id: 'open-awareness',
    category: 'meditation',
    kind: 'guided',
    name: '开放觉察',
    short: '从呼吸开始，觉察范围一步步放宽',
    todayLine: '从呼吸开始，觉察的范围一步步放宽到身体、声音和想法。看着它们来，也看着它们走。',
    description:
      '从呼吸开始，觉察的范围一步步放宽到身体、声音、想法和情绪，看着它们来去；10 分钟起，最后有一段不选对象，有什么就觉察什么。' +
      '它是正念课程后半程的练习，单独练它的效果还很少有研究（证据：有限）。' +
      '适合已经练过几周专注呼吸的人，八周计划从第 5 周开始安排。',
    steps: [
      '坐稳，目光落在屏幕上，先留意呼吸。',
      '放宽到整个身体，留意压力、温度和重量（10 分钟起）。',
      '听声音：不用去找，让声音自己来。',
      '把想法当成字幕，看它出现，又过去。',
      '不特意选什么，此刻什么明显就觉察什么（10 分钟起）；最后回到呼吸。',
    ],
    durations: [5, 10, 20],
    defaultMinutes: 10,
    grade: 'C',
    ...claims(
      {
        claim:
          '开放觉察是 MBSR 等八周正念课程的一部分，这类课程与不练习相比，心理困扰平均小到中等程度减轻（13 项随机试验）。',
        grade: 'A',
        cites: ['meditation-galante-2023', 'practice-santorelli-2017'],
      },
      // safety-britton-2021 的试验里有只练开放觉察的一组，但三组都是正念课程，没有不练习的对照
      {
        claim: '单独练开放觉察的研究还很少，也还没有和不练习比较过。',
        grade: 'C',
        cites: ['safety-britton-2021', 'meditation-lutz-2008'],
      },
    ),
    evidence: [
      'meditation-galante-2023',
      'safety-britton-2021',
      'practice-santorelli-2017',
      'meditation-lutz-2008',
    ],
    safety: warnings('open-awareness'),
    // 练习本身要听周围的声音，不再叠一层背景声
    sound: QUIET,
    scriptId: 'open-awareness',
  },

  walking: {
    id: 'walking',
    category: 'meditation',
    kind: 'guided',
    name: '正念行走',
    short: '慢慢走，留意脚底的感觉',
    todayLine: '慢慢走，留意抬脚、移动、放下时脚底的感觉。全程睁着眼睛。',
    description:
      '睁着眼睛慢慢走，留意抬脚、移动、放下时脚底的感觉；10 分钟版后半段换成平常的步速，也留意声音和看到的东西。' +
      '适合坐不住，或者久坐后想动一动的人。' +
      '专门研究正念行走的试验很少，规模也小（证据：不足）。',
    steps: [
      '找一段平坦、没有障碍的路，能来回走五六步就行。',
      '站在路的一头，感受双脚承重。',
      '放慢脚步，留意抬起、移动、放下；到头先停稳，再转身。',
      '走神了，就回到脚底的感觉。',
      '站定，感受整个身体，再结束。',
    ],
    durations: [5, 10],
    defaultMinutes: 5,
    grade: 'D',
    ...claims(
      {
        claim:
          '一项 74 人、不设盲的随机试验里，每次课含 10 分钟正念行走的 4 周步行课，让自评压力比等待组下降更多（压力量表下降 8.8 分对 1.0 分）。',
        grade: 'C',
        cites: ['practice-teut-2013'],
      },
      {
        claim: '这项试验分不清作用来自走路、团体还是正念；单独检验正念行走的对照试验很少，规模也小。',
        grade: 'D',
        cites: ['practice-teut-2013', 'meditation-prakhinkit-2014'],
      },
    ),
    evidence: ['practice-teut-2013', 'meditation-prakhinkit-2014'],
    safety: warnings('walking'),
    // 可能在户外走，背景声会盖住车和人的声音
    sound: QUIET,
    scriptId: 'walking',
  },

  pause: {
    id: 'pause',
    category: 'meditation',
    kind: 'guided',
    name: '一分钟停一停',
    short: '停下来，吸一口气，看看此刻',
    todayLine: '停下手头的事，吸一口气，留意此刻，再接着做。跟着屏幕上的字做就好。',
    description:
      '四步：停下手头的事；吸一口比平时稍满、但不用力的气；留意身体、情绪和念头；再回到手头的事。' +
      '适合忙的时候随手做，坐在工位上也能做。' +
      '研究很少，单次的短练习能不能带来持久的变化，目前还不知道（证据：不足）。',
    steps: [
      '停：先停下手头的事。',
      '吸：吸一口比平时稍满的气，不必很深，再慢慢呼出去。',
      '观：留意身体哪里紧、哪里松，有什么情绪和念头。',
      '行：钟声响起后，回到手头的事。',
    ],
    durations: [1],
    defaultMinutes: 1,
    grade: 'D',
    ...claims(
      {
        claim:
          '目前找到的唯一一项随机试验（中国，1090 人）只测了摸脸的次数：与等待组相比，练习后摸脸略少，效应很小。',
        grade: 'C',
        cites: ['practice-tang-2022'],
      },
      {
        claim: '这项试验没有测压力和情绪，一分钟停一停能不能减压，还没有研究。',
        grade: 'D',
        cites: ['practice-tang-2022'],
      },
      {
        claim:
          '65 项随机试验的汇总里，短时间正念练习让负面情绪小幅减轻，过一天或更久再测，就不明显了（g = 0.08）。',
        grade: 'C',
        cites: ['meditation-schumer-2018'],
      },
    ),
    evidence: ['meditation-schumer-2018', 'practice-tang-2022'],
    safety: warnings('pause'),
    // 一分钟里，背景声的淡入淡出就要占去一半
    sound: QUIET,
    scriptId: 'pause',
  },

  timer: {
    id: 'timer',
    category: 'meditation',
    kind: 'timer',
    name: '静坐计时',
    short: '没有引导，只有钟声和计时',
    todayLine: '没有引导，只有开始和结束的钟声。用你熟悉的方法，安静地坐一会儿。',
    description:
      '没有引导语，只有开始和结束的钟声；间隔钟声默认关闭，可以设为每 5 或 10 分钟一次。' +
      '适合已经熟悉一种练习、想自己安静坐一会儿的人。' +
      '计时器只是工具，不评定证据等级；八周正念课程里，引导也是逐周减少，后期改为自己练。',
    steps: [
      '选好时长；需要的话，打开每 5 或 10 分钟一次的间隔钟声。',
      '开始的钟声响起后，用你熟悉的方法练，比如专注呼吸。',
      '走神了就回来，不用评判自己。',
      '结束的钟声响起后，慢慢活动身体。',
    ],
    durations: [1, 3, 5, 10, 15, 20, 30, 45, 60],
    defaultMinutes: 5,
    grade: null,
    ...claims(
      // 计时器是工具，不评等级；这里的等级只针对这条结果。多数剂量检验不显著，是「没有发现」，不是「证明一样」
      {
        claim: '203 项正念课程试验的汇总里，没有发现课程更长、练得更多的，心理上的好处比短课程更大。',
        grade: 'B',
        cites: ['meditation-strohmaier-2020'],
      },
    ),
    evidence: ['meditation-strohmaier-2020', 'safety-britton-2021', 'practice-santorelli-2017'],
    safety: warnings('timer'),
    // 静坐计时默认安静，只有钟声
    sound: QUIET,
  },

  /* ---------- 呼吸 ---------- */

  slow: {
    id: 'slow',
    category: 'breathing',
    kind: 'paced',
    name: '慢呼吸',
    short: '跟着节拍放慢呼吸，轻柔不深',
    todayLine: '跟着画面的起伏，让一吸一呼慢下来。轻柔地呼吸，不必吸得很深。',
    description:
      '跟着画面和提示音呼吸，默认每分钟 5.5 次：吸 4.5 秒、呼 6.5 秒；也可以选「等长」，吸、呼各 5.5 秒。' +
      '开头约 90 秒，节拍从每分钟 8 次逐步放慢。' +
      // 400 人的预注册安慰剂对照试验：5.5 次不比 12 次更好（breathing-fincham-2023-rct），所以不说「还没有定论」
      '练习时心率变异性中等程度增大；与不做呼吸练习相比，呼吸练习让压力小到中等程度减轻（证据：中等），但放慢到每分钟 5.5 次，目前没有证据显示比普通节奏的轻柔呼吸更好。' +
      '适合想找一种简单、每天能做的放松方法的人。',
    steps: [
      '坐着或躺着，用鼻子轻轻吸气，让腹部自然起伏。',
      '跟着画面吸、呼，不必吸得很深；开头节奏稍快，会一点点慢下来。',
      '觉得气不够、有点急，就点「有点急」，每分钟会多呼吸 0.5 次，下次也从这个节奏开始。',
      '节奏可以在每分钟 4.5–7.0 次之间调，也可以用舒适节律探索来选。',
      '最后一会儿不用跟节奏，自然地呼吸。',
    ],
    durations: [3, 5, 10, 15, 20],
    defaultMinutes: 5,
    grade: 'B',
    ...claims(
      {
        claim: '慢呼吸时心率变异性增大（练习时增幅中等，练完后增幅较小）。',
        grade: 'B',
        cites: ['breathing-laborde-2022-meta'],
      },
      {
        claim:
          '一项 400 人的安慰剂对照试验里，每分钟 5.5 次在压力、焦虑、抑郁和幸福感上，都不比每分钟 12 次的轻柔呼吸更好。',
        grade: 'B',
        cites: ['breathing-fincham-2023-rct'],
      },
    ),
    evidence: [
      'breathing-fincham-2023-rct',
      'breathing-laborde-2022-meta',
      'breathing-fincham-2023-meta',
      'breathing-shaffer-2020',
      'breathing-steffen-2021',
    ],
    safety: warnings('slow'),
    sound: RAIN,
    paced: SLOW_PACE,
    scriptId: 'slow',
  },

  'cyclic-sigh': {
    id: 'cyclic-sigh',
    category: 'breathing',
    kind: 'paced',
    name: '周期性叹息',
    short: '鼻吸，再补一小口，用嘴慢慢呼',
    todayLine: '用鼻子吸到七八成满，再补吸一小口，然后用嘴慢慢呼完。按自己的快慢来。',
    description:
      // 研究的做法是尽量吸满（breathing-balban-2023-protocol），证据针对的是那个版本，所以照实说
      '用鼻子轻轻吸到七八成满，再补吸一小口，然后用嘴慢慢呼完；研究里要尽量吸满，回神改得轻一些，免得头晕。' +
      '屏幕上的可选节拍是吸 2.5 秒、补吸 1 秒、呼 7 秒；研究里每个人按自己的快慢做，你也可以。' +
      // 比的是每次练习前后的变化；和另外两种呼吸法相比没有差别
      '在一项小型的探索性试验里，连续 28 天每天练 5 分钟，每次练完，积极情绪比练正念冥想的人提高得略多，焦虑的减轻则相近（证据：有限）。' +
      '1 分钟版适合紧张的当下缓一缓，不能代替每天的练习。',
    steps: [
      '坐着或躺着，用鼻子轻轻吸气，吸到七八成满。',
      '先不呼气，再用鼻子补吸一小口。',
      '用嘴慢慢呼完，不用往外挤；呼得比吸得长。',
      '节拍只是参考，可以按自己的快慢来；吃力的话，两轮之间歇一两口气。',
    ],
    durations: [1, 3, 5],
    defaultMinutes: 5,
    grade: 'C',
    ...claims(
      {
        claim:
          '108 人的探索性试验里，每天 5 分钟的周期性叹息，每次练习前后积极情绪的提升比正念冥想略多（与另外两种呼吸法没有差别），焦虑的减轻相近，心率变异性和睡眠没有差别。',
        grade: 'C',
        cites: ['breathing-balban-2023-protocol', 'breathing-balban-2023-nulls'],
      },
      {
        claim: '一项 47 人的试点研究里，紧张时做 1 分钟，比不做练习更能缓解当下的紧张，但做完后反应稍慢。',
        grade: 'C',
        cites: ['breathing-riedl-2026'],
      },
    ),
    evidence: ['breathing-balban-2023-protocol', 'breathing-balban-2023-nulls', 'breathing-riedl-2026'],
    safety: warnings('cyclic-sigh'),
    sound: RAIN,
    // 一轮 10.5 秒，按 2.5 : 1 : 7 分成吸、再吸、呼；研究里由练习者自己掌握快慢，界面标为「可选节拍」
    paced: { type: 'sigh', cycle: 10.5 },
    scriptId: 'cyclic-sigh',
  },

  box: {
    id: 'box',
    category: 'breathing',
    kind: 'paced',
    name: '箱式呼吸',
    short: '吸、停、呼、停，各 4 秒',
    todayLine: '吸、停、呼、停，四步一样长。停的时候喉咙放松，不用憋劲。',
    description:
      '吸气、停、呼气、停，每一步 4 秒，一轮 16 秒；停的时候喉咙放松，不用憋劲。' +
      '小型研究里，紧张时做 1 分钟，几分钟后的紧张程度比不做练习低（证据：有限），但做完后反应会稍慢。' +
      '适合喜欢固定、好记的节奏的人；考试、发言之前，更建议做慢呼吸。',
    steps: [
      '坐着或躺着，用鼻子轻轻吸气 4 秒。',
      '吸完停 4 秒，喉咙放松，不用憋劲。',
      '慢慢呼气 4 秒，呼完再停 4 秒。',
      // PRODUCT §2 的「每步 3–6 秒」还没有地方存（data 的 PracticePrefs 只有 rate、ratio、cycle），先不写可调
      '吃力的话，停得短一些，或者不停。',
    ],
    durations: [3, 5],
    defaultMinutes: 5,
    grade: 'C',
    ...claims(
      {
        claim: '47 人的试点研究里，紧张时做 1 分钟箱式呼吸，5 分钟后的状态焦虑比不做练习更低，但反应变慢。',
        grade: 'C',
        cites: ['breathing-riedl-2026'],
      },
      {
        claim: '30 人的实验里，它比延长呼气更能降低生理唤醒，任务表现却更差。',
        grade: 'C',
        cites: ['breathing-rottger-2021'],
      },
    ),
    evidence: ['breathing-riedl-2026', 'breathing-rottger-2021', 'breathing-balban-2023-protocol'],
    safety: warnings('box'),
    sound: RAIN,
    paced: { type: 'phases', inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
    scriptId: 'box',
  },

  'pace-finder': {
    id: 'pace-finder',
    category: 'breathing',
    kind: 'assessment',
    name: '舒适节律探索',
    short: '试 5 档节奏，选你觉得轻松的',
    todayLine: '5 档节奏，每档 1 分钟，一档比一档慢。每档结束，按轻松程度打分。',
    description:
      '依次以每分钟 6.5、6、5.5、5、4.5 次各呼吸 1 分钟，每一档结束后按轻松程度打 1–5 分，打分最高的一档会作为慢呼吸的默认节奏。' +
      '这是舒适度测试，不是共振频率测定；正式的测定要戴心率胸带，看心率的起伏。' +
      '适合想找到自己舒服节奏的人；研究里，个子高的人和男性适合的节奏往往偏慢。' +
      '支持的设备上，可以连接心率胸带作参考（实验功能）。',
    steps: [
      '坐着或躺着，跟着节拍轻轻呼吸，不必吸得很深。',
      '一共 5 档，每档 1 分钟，一档比一档慢。',
      '每档结束，按轻松程度打 1–5 分。',
      '打分最高的一档会作为慢呼吸的默认节奏，之后随时可以改。',
    ],
    // 5 档各 1 分钟，加上说明和打分，约 7 分钟（PRODUCT §2）。各档的节拍由测定方案生成，这里不设 paced
    durations: [7],
    defaultMinutes: 7,
    grade: null,
    ...claims(
      // 舒适节律探索是工具，不评等级；这里的等级只针对各条结果
      {
        claim: '成人适合的慢呼吸节奏在每分钟 4.5–6.5 次之间，因人而异，在同一个人身上比较稳定。',
        grade: 'C',
        cites: ['breathing-shaffer-2020', 'breathing-vaschillo-2006'],
      },
      {
        claim: '按个人节奏呼吸是否比固定每分钟 6 次更好，目前还没有定论。',
        grade: 'D',
        cites: ['breathing-shaffer-2020'],
      },
    ),
    evidence: ['breathing-laborde-2022-hrvb', 'breathing-shaffer-2020', 'breathing-vaschillo-2006'],
    safety: warnings('pace-finder'),
    // 打分只该反映节奏舒不舒服，不让背景声掺进来
    sound: QUIET,
  },

  /* ---------- 声音 ---------- */

  listen: {
    id: 'listen',
    category: 'sound',
    kind: 'sound',
    name: '听声音 · 放松',
    short: '听一段水声或音乐，定时淡出',
    todayLine: '选一种声音，听着就好，不用做什么。快到时间时，声音会慢慢淡出。',
    description:
      '选一种自然声或音乐，也可以两样叠加，各自调音量；快到时间时，声音会慢慢淡出。' +
      // 与 sounds.ts 的 SOUND_PRESETS.relax 一致（它从这里取）。sound-buxton-2021 说的是「很多」研究拿自然声和噪声比
      '默认是溪流声；许多人觉得水声放松，不过自然声的研究里，很多是拿它和噪声比，不是和安静比。' +
      '舒缓的音乐可能让人觉得放松一些，研究多在手术前等紧张场景；健康人在压力过后听音乐，并不比安静休息恢复得更快（证据：有限）。' +
      '适合想歇一会儿、不想跟着做任何练习的时候。',
    steps: [
      '选一种声音：雨、溪流、海浪等自然声，或长音、五声、回响等音乐，也可以叠加。',
      '各自调好音量，比安静交谈更轻、能听清就好。',
      '坐着或躺着，不用做什么，听着就好。',
      '快到时间时，声音会慢慢淡出。',
    ],
    // 20 分钟起的效应在术前研究里更大（sound-yang-2025），健康人的研究平均听 22–25 分钟（sound-panteleeva-2018）
    durations: [10, 20, 30],
    defaultMinutes: 20,
    // C：放松的证据多来自医疗场景，健康人的结果弱或不一致（sound-adiasto-2022、sound-panteleeva-2018）
    grade: 'C',
    ...claims(
      {
        claim:
          '104 项随机试验汇总，与常规照护等对照相比，音乐让自评的压力和紧张中等程度减轻，但多数在医疗场景。',
        grade: 'B',
        cites: ['sound-dewitte-2020'],
      },
      {
        claim: '健康成人的 14 项实验里，压力过后听音乐并不比安静休息或其他声音恢复得更快。',
        grade: 'C',
        cites: ['sound-adiasto-2022'],
      },
      {
        claim:
          '18 项研究的汇总里，自然声让压力和烦躁类的指标减轻（g = −0.60），在各类对照里，和噪声比时差别最大。',
        grade: 'C',
        cites: ['sound-buxton-2021'],
      },
    ),
    evidence: [
      'sound-dewitte-2020',
      'sound-adiasto-2022',
      'sound-yang-2025',
      'sound-buxton-2021',
      'sound-panteleeva-2018',
    ],
    safety: warnings('listen'),
    sound: STREAM,
  },

  sleep: {
    id: 'sleep',
    category: 'sound',
    kind: 'sound',
    name: '听声音 · 睡前',
    short: '睡前听雨声，定时慢慢淡出',
    todayLine: '躺下，听着就好。音量调到刚好能听见；快到时间时，声音慢慢变轻。',
    description:
      '睡前用的声音，默认是雨声，也可以换成其他自然声、噪声或音乐；快到时间时慢慢淡出，选「不限」要再确认一次。' +
      // 等级只评「能不能帮助入睡」；对睡眠和听力的提醒放在等级后面，免得读成「有害的证据不足」（sound-riedy-2021）
      '持续的自然声或噪声能不能帮助入睡，研究结果不一致，证据质量极低（证据：不足）；也有综述提醒，要留意持续的噪声对睡眠和听力的影响。' +
      '它更适合用来遮挡环境里断续的噪音，当作睡前的固定习惯。' +
      '想加音乐的话，研究里是坚持每晚听几周，改善的也只是自己感觉的睡眠质量；长期睡不好，可以去医院的睡眠门诊看看。',
    steps: [
      '选好声音和时长，默认 45 分钟。',
      '音量调到刚好能听见。',
      '手机或音箱放在离枕边远一些的地方。',
      '躺下，不用做什么，听着就好；快到时间时，声音会慢慢淡出。',
    ],
    // 0 为不限，需要再确认（PRODUCT §2）；默认 45 分钟并淡出（safety.notes §9）
    durations: [15, 30, 45, 60, 0],
    defaultMinutes: 45,
    // D：默认是雨声，持续声音助眠的证据质量极低、结果不一（sound-riedy-2021）；
    // 音乐对有失眠困扰者的自评睡眠有中等确定性的证据，但默认不放音乐，也不是这项的主要结果
    grade: 'D',
    ...claims(
      {
        claim: '38 项研究的综述认为，持续噪声改善睡眠的证据质量极低，结果从改善到干扰都有。',
        grade: 'D',
        cites: ['sound-riedy-2021'],
      },
      // Cochrane 综述，自评睡眠质量为中等确定性；默认不放音乐，所以这不是这一项等级针对的结果
      {
        claim: '有失眠困扰的人每晚听音乐，自评睡眠质量比常规照护好。',
        grade: 'B',
        cites: ['sound-jespersen-2022'],
      },
      {
        claim: '用仪器测量睡眠的 3 项研究里，听音乐没有让睡眠变好。',
        grade: 'C',
        cites: ['sound-jespersen-2022'],
      },
    ),
    evidence: ['sound-jespersen-2022', 'sound-capezuti-2022', 'sound-tang-2022', 'sound-riedy-2021'],
    safety: warnings('sleep'),
    sound: RAIN,
  },

  'body-scan-sleep': {
    id: 'body-scan-sleep',
    // 本身是冥想；目录里放在「声音 · 睡前」，睡前打开声音的人在那里找得到
    category: 'meditation',
    kind: 'guided',
    name: '睡前身体扫描',
    short: '躺着，从头顶一处处往下感受',
    todayLine: '躺在床上，从头部开始，一处一处往下，留意身体的感觉。睡着了也很好。',
    description:
      '在床上躺好，注意力从头顶开始，一处一处往下走，留意每个部位的重量、温度和接触；20 分钟起，扫完全身后会再慢慢走一遍。' +
      '不需要努力入睡，听着听着睡着了也很好。' +
      // meditation-rusch-2019 研究的是有睡眠问题的人上几周的线下课程，不是睡前单做一次
      '几周的正念课程可能让自评的睡眠质量小幅改善，但单独做身体扫描的研究很少（证据：有限）。' +
      '适合躺下以后脑子还停不下来、想把注意力放回身体的人。',
    steps: [
      '在床上躺好，怎么舒服就怎么躺。',
      '先感受身体躺在床上的重量，把重量交给床。',
      '注意力从头顶开始，一处一处往下走，直到双脚。',
      '如果留意某个部位让你难受，可以跳过它。',
      '不需要努力入睡；中途翻身也没关系。',
    ],
    // 引导词有 10 / 20 / 30 分钟三版。默认 10：与今日页深夜的推荐、提醒的预设（copy.ts）一致，也合 PRODUCT §0
    // 「默认短练习」；20 分钟起有给还醒着的人的第二遍，可以自己选
    durations: [10, 20, 30],
    defaultMinutes: 10,
    // C：正念对自评睡眠有中等证据（meditation-rusch-2019），但那是完整课程；单独的身体扫描证据有限
    grade: 'C',
    ...claims(
      {
        claim:
          '18 项随机试验汇总，有睡眠问题的人上几周正念课程，与时间、关注度相当的对照相比，自评睡眠质量小幅改善。',
        grade: 'B',
        cites: ['meditation-rusch-2019'],
      },
      {
        claim: '同一汇总里，与专门针对失眠的方法相比没有差别。',
        grade: 'C',
        cites: ['meditation-rusch-2019'],
      },
      {
        claim: '单独做身体扫描的随机试验很少，也没有发现它对健康指标有明确作用。',
        grade: 'D',
        cites: ['practice-gan-2022'],
      },
    ),
    evidence: ['meditation-rusch-2019', 'practice-gan-2022', 'practice-uclamarc-2016'],
    safety: warnings('body-scan-sleep'),
    sound: RAIN,
    scriptId: 'body-scan-sleep',
  },

  /* ---------- 不进目录的辅助练习 ---------- */

  'breathing-space-coping': {
    id: 'breathing-space-coping',
    category: 'meditation',
    kind: 'guided',
    // 与今日页「现在有点难」的名字一致（copy.ts）
    name: '三分钟呼吸空间 · 应对版',
    short: '给难受起个名字，再回到呼吸或双脚',
    todayLine: '给此刻的感受起个名字，找到它在身体的哪里，再回到呼吸或双脚。',
    description:
      '在有点难的时候用：先给此刻的感受起个名字，找到它在身体的哪里；再把注意力收回到呼吸或双脚；然后把难受的部分也包括进来，和它一起呼吸，最后想一想怎样照顾自己。' +
      '这个做法来自 MBCT 课程，单独的效果没有经过试验检验（证据：有限）。' +
      '感觉太强烈时，可以随时睁眼、停下，或者改做落地练习。',
    steps: [
      '坐着或站着，双脚踩稳地面；睁着眼睛，目光落在屏幕上。',
      '问问自己此刻在经历什么，给它起个名字，比如「这是担心」。',
      '找到它在身体的哪里；太强烈就只留意它的边缘，或者回到双脚。',
      '把注意力收回到呼吸或脚底，被拉走了就再回来。',
      '放宽到整个身体，再选一件照顾自己的小事。',
    ],
    // 从「现在有点难」进入，默认 3 分钟（PRODUCT §4）；引导词支持 3–5 分钟
    durations: [3, 5],
    defaultMinutes: 3,
    // 与三分钟呼吸空间同为 C：依据短程正念训练，这一版本身没有试验
    grade: 'C',
    ...claims(
      {
        claim: '65 项随机试验的汇总里，短时间的正念练习让负面情绪比对照小幅减轻，校正发表偏倚后接近零。',
        grade: 'C',
        cites: ['meditation-schumer-2018'],
      },
      {
        claim: '应对版本身没有单独的随机试验。',
        grade: 'D',
        cites: ['practice-deroche-2025'],
      },
    ),
    evidence: ['meditation-schumer-2018', 'practice-deroche-2025', 'practice-baer-2019'],
    safety: warnings('breathing-space-coping'),
    sound: STREAM,
    scriptId: 'breathing-space-coping',
  },

  grounding: {
    id: 'grounding',
    category: 'meditation',
    kind: 'guided',
    name: '落地练习',
    short: '睁开眼睛，双脚踩地，看看四周',
    todayLine: '睁着眼睛，踩稳双脚，看看四周，把注意力放到身体外面。',
    description:
      '60 秒，睁着眼睛，把注意力放到身体外面：双脚踩一踩地面，说出看到的五样东西，听一听周围的声音，慢慢喝一小口水。' +
      '它是「不舒服？」和「现在有点难」里的出口，用来在难受时先稳下来，不是日常练习。' +
      '没有专门检验它的对照试验（证据：不足）。',
    steps: [
      '睁开眼睛，呼吸不用刻意调整。',
      '双脚往下踩一踩，感受身下的支撑；头晕就先躺着。',
      '慢慢看看四周，说出看到的五样东西。',
      '听一听周围的声音；手边有水的话，坐着慢慢喝一小口。',
    ],
    durations: [1],
    defaultMinutes: 1,
    // D：常用的临床做法，没有对照试验（safety.notes §6）
    grade: 'D',
    ...claims(
      {
        claim: '这是临床上常用的稳定做法，还没有和其他做法比较过的对照试验。',
        grade: 'D',
        cites: ['practice-baer-2019'],
      },
      // 所以这里用睁眼和身体外部的锚点，不引导深呼吸（safety-nccih-2021-relaxation）
      {
        claim: '一项 434 人的调查里，童年不良经历越多的人，冥想时越容易出现不良反应。',
        grade: 'C',
        cites: ['safety-goldberg-2022'],
      },
    ),
    evidence: ['safety-goldberg-2022', 'safety-nccih-2021-relaxation', 'practice-baer-2019'],
    safety: warnings('grounding'),
    // 练习要听房间里本来的声音
    sound: QUIET,
    scriptId: 'grounding',
  },
})

/* ---------- 目录的分组和顺序 ---------- */

export interface CatalogueGroup {
  /** 小标题，如「睡前」；没有时不显示 */
  title?: string
  ids: CatalogPracticeId[]
}

export interface CatalogueSection {
  category: Category
  /** 冥想 / 呼吸 / 声音 */
  title: string
  groups: CatalogueGroup[]
  /**
   * 这一类里按健康情况检查隐藏了的练习，按目录顺序；没有时为空数组。
   * 界面在这一类的最后用 copy.ts 的 CATALOGUE.hidden 说明（DESIGN.md §13.3）
   */
  hidden: CatalogPracticeId[]
}

interface SectionSpec {
  category: Category
  groups: readonly { title?: string; ids: readonly CatalogPracticeId[] }[]
}

/**
 * 「练习」页的分组和顺序（PRODUCT §2）。睡前身体扫描本身是冥想，放在「声音 · 睡前」里。
 * v1 暂不提供的两项留在这里占好位置，由 catalogueSections 按 isOffered 去掉，录音做好后不用再排一次
 */
const SECTIONS: readonly SectionSpec[] = [
  {
    category: 'meditation',
    groups: [
      {
        ids: [
          'focus',
          'breath-count',
          'body-scan',
          'breathing-space',
          'loving-kindness',
          'self-compassion',
          'open-awareness',
          'walking',
          'pause',
          'timer',
        ],
      },
    ],
  },
  { category: 'breathing', groups: [{ ids: ['slow', 'cyclic-sigh', 'box', 'pace-finder'] }] },
  {
    category: 'sound',
    groups: [
      { title: '放松', ids: ['listen'] },
      { title: '睡前', ids: ['sleep', 'body-scan-sleep'] },
    ],
  },
]

/** 不进目录：只从「现在有点难」和「不舒服？」进入 */
const HELPERS: readonly CatalogPracticeId[] = ['breathing-space-coping', 'grounding']

/**
 * 全部练习的数据，按显示顺序：先是目录里的，最后是辅助练习。v1 暂不提供的两项也在里面（名称、图注、旧记录要用）；
 * 要列出能练的练习，用 catalogueSections 或 isOffered
 */
export const PRACTICES: readonly CatalogPractice[] = Object.freeze(
  [...SECTIONS.flatMap(s => s.groups.flatMap(g => g.ids)), ...HELPERS].map(id => PRACTICE_BY_ID[id]),
)

/** 路由参数、旧记录里的 id 是否在目录里（旧 id 不在） */
export function isCatalogPracticeId(id: string): id is CatalogPracticeId {
  return Object.hasOwn(PRACTICE_BY_ID, id)
}

/* ---------- v1 提供哪些练习 ---------- */

/**
 * v1 暂不提供的练习（PRODUCT.md §0、§2，2026-10-23 决定），全应用只认这一处：
 * v1 的引导是屏幕上的文字，正念行走要边走边练，睡前身体扫描要在床上闭着眼练，都看不了屏幕，要等真人录音。
 * 条目、引导词、安全提示和图注都保留；录音做好后，从这里删掉就重新上线
 */
export const V1_UNAVAILABLE: ReadonlySet<CatalogPracticeId> = new Set<CatalogPracticeId>([
  'walking',
  'body-scan-sleep',
])

/**
 * 这项练习在 v1 能不能开始：在目录里，且不在 V1_UNAVAILABLE 里。旧 id、不认识的 id 都为 false。
 * 练习页、今日页的推荐和「换一个」、「只有几分钟」「现在有点难」、计划都按它过滤；深链接和开始练习也该先问它
 */
export function isOffered(id: string): boolean {
  return isCatalogPracticeId(id) && !V1_UNAVAILABLE.has(id)
}

/**
 * 「练习」页的分组：去掉 v1 不提供的，做过健康情况检查时再去掉因此隐藏的。
 * hidden 只记健康情况检查隐藏的练习；v1 不提供的两项不算隐藏，页面上不提
 */
export function catalogueSections(screening?: ScreeningAnswers | null): CatalogueSection[] {
  return SECTIONS.map(s => ({
    category: s.category,
    title: CATEGORY_LABEL[s.category],
    groups: s.groups
      .map(g => {
        const ids = g.ids.filter(id => isOffered(id) && !isHidden(id, screening))
        return g.title === undefined ? { ids } : { title: g.title, ids }
      })
      .filter(g => g.ids.length > 0),
    hidden: s.groups.flatMap(g => g.ids.filter(id => isOffered(id) && isHidden(id, screening))),
  })).filter(s => s.groups.length > 0)
}

/** 这次练习读哪段引导词：三分钟呼吸空间选 5 分钟时，读入门两步版（PRODUCT §2、practice-mander-2019） */
export function scriptIdFor(id: CatalogPracticeId, minutes: number): ScriptId | undefined {
  if (id === 'breathing-space' && minutes === 5) return 'breathing-space-intro'
  return PRACTICE_BY_ID[id].scriptId
}

/** 背景声用哪种模式：睡前的更轻、更暗，淡入更慢，没有鸟声 */
export function soundModeOf(id: CatalogPracticeId): SoundMode {
  return id === 'sleep' || id === 'body-scan-sleep' ? 'sleep' : 'relax'
}

/* ---------- 健康情况检查（可选）带来的调整 ---------- */

/**
 * 与 data/types.ts 的 Screening 字段一致。内容层不依赖数据层（ARCHITECTURE.md 的依赖方向），
 * 所以这里按结构接收：Screening 可以直接传进来，没回答的项按「没有」处理
 */
export type ScreeningItem =
  | 'pregnancy'
  | 'heart'
  | 'respiratory'
  | 'psychosis'
  | 'bipolar'
  | 'epilepsy'
  | 'trauma'
  | 'panic'

export type ScreeningAnswers = Partial<Record<ScreeningItem, boolean>>

export const SCREENING_ITEMS: readonly ScreeningItem[] = Object.freeze([
  'pregnancy',
  'heart',
  'respiratory',
  'psychosis',
  'bipolar',
  'epilepsy',
  'trauma',
  'panic',
])

/**
 * 按健康情况隐藏的练习（PRODUCT §2、safety.notes §4），与 safety.ts 健康情况检查里各项的 hides 一致。
 * 其余情况只改默认值和提示，不改能不能练（breathing.notes §6）。旧 id 不在目录里，不算隐藏
 */
export function isHidden(id: PracticeId, screening?: ScreeningAnswers | null): boolean {
  if (!screening) return false
  switch (id) {
    // 这类人群的研究用的是经过调整、有专业支持的形式（safety-obrienvenus-2024）；隐藏是预防性的安排 [J]。
    // 没有固定对象的觉察与类似精神病性体验的相关研究（Palmer 2024）还没有进入证据库，不作依据
    case 'open-awareness':
      return screening.psychosis === true || screening.bipolar === true
    // 屏息的节律：预防性的判断，没有短暂屏息造成伤害的直接证据（breathing.notes §6）
    case 'box':
      return screening.pregnancy === true || screening.heart === true || screening.respiratory === true
    default:
      return false
  }
}

/**
 * 看得到、也能练，但今日页和计划不主动推荐（today.ts）。常有创伤闪回时的开放觉察：健康情况检查和八周计划第 5 周的
 * 说明都请这类人改练专注呼吸（睁眼、外部锚点、时间短），推荐就不能和说明打架 [J]（safety.notes §4、practice-baer-2019）
 */
export function isDiscouraged(id: PracticeId, screening?: ScreeningAnswers | null): boolean {
  return id === 'open-awareness' && screening?.trauma === true
}

export interface PracticeDefaults {
  /** 可选时长，保持原来的顺序 */
  durations: number[]
  /** 一定在 durations 里 */
  defaultMinutes: number
  paced?: PacedParams
  /**
   * 建议睁着眼睛练：练习本身要求睁眼，或健康情况提示睁眼更稳妥。
   * 文字引导里，安静的时候也不闭眼；界面据此选 copy.ts 的 GUIDANCE_HOWTO.eyesOpen
   */
  eyesOpen: boolean
  /** 建议的引导详细程度；没有时沿用设置 */
  guidance?: GuidanceLevel
  /**
   * 有创伤、幻觉妄想或双相时为 true：时长只留 10 分钟以内，今日页和计划推荐的时长也不超过 defaultMinutes
   * （慢呼吸的默认本来就是 5 分钟，没有这个标记，计划里的慢呼吸 10 分钟就漏过去了）
   */
  shortened: boolean
  /** 按健康情况补充的提示，接在这项练习的安全提示后面；文字取自 safety.ts 的 SCREENING_NOTES */
  notes: string[]
}

/**
 * 练习本身就睁眼做：数息的测量要求至少半睁（meditation-wong-2018），行走和落地练习不能闭眼；
 * 应对版用在难受的时候，引导词也先请人睁着眼（safety.notes §7）
 */
const EYES_OPEN = new Set<CatalogPracticeId>([
  'breath-count',
  'walking',
  'grounding',
  'breathing-space-coping',
])

/** 有创伤、精神病性症状或双相情感障碍时：每次不超过 10 分钟，默认不超过 5 分钟（safety.notes §4、practice-baer-2019） */
const SHORT_MAX = 10
const SHORT_DEFAULT = 5
/**
 * 有精神病性症状或双相情感障碍时，静坐计时最长 5 分钟：它没有任何引导，
 * 而这类人群用的是「全程有引导、不留长时间静默」的调整版（practice-baer-2019，safety.notes §4「不做长时间的静坐」）
 */
const SILENT_SIT_MAX = 5

/** 只留不超过 max 的时长，默认取不超过原默认、也不超过 5 分钟的最长一档 */
function capDurations(
  durations: readonly number[],
  def: number,
  max: number,
): Pick<PracticeDefaults, 'durations' | 'defaultMinutes'> {
  const timed = durations.filter(d => d > 0)
  const kept = timed.filter(d => d <= max)
  // 最短的一档也超过上限（如约 7 分钟的舒适节律探索）时，留下最短的那一档
  const list = kept.length > 0 ? kept : [Math.min(...timed)]
  const fit = list.filter(d => d <= Math.min(def, SHORT_DEFAULT))
  return { durations: list, defaultMinutes: fit.length > 0 ? Math.max(...fit) : Math.min(...list) }
}

/**
 * 周期性叹息要吸到七八成再补一口。癫痫、怀孕、心脑血管或较重的肺部疾病时，只建议轻柔的慢呼吸
 * （safety.notes §4「只做轻柔的慢呼吸」、breathing.notes §6），属于预防性的设计判断
 */
function needsGentleBody(s: ScreeningAnswers | null | undefined): boolean {
  if (!s) return false
  return s.epilepsy === true || s.pregnancy === true || s.heart === true || s.respiratory === true
}

/** 再加上惊恐发作：要吸满的呼吸会带来和惊恐相似的感觉，原则是慢而轻（breathing-meuret-2008） */
function prefersLightBreathing(s: ScreeningAnswers | null | undefined): boolean {
  return s?.panic === true || needsGentleBody(s)
}

/** 有创伤闪回、幻觉妄想或双相时，难受先用睁眼、以身体外部为锚的落地练习 [J]（safety.notes §4「落地的出口一直在」） */
function groundingFirst(s: ScreeningAnswers | null | undefined): boolean {
  return s?.trauma === true || s?.psychosis === true || s?.bipolar === true
}

/**
 * 按健康情况调整后的默认值和补充提示（safety.notes §4、breathing.notes §6）。
 * 只改默认，不替用户做决定：可选时长、节奏都还能在练习前改。
 * 声音类不受影响；落地练习本身就是出口，也不加限制。
 * 睡前身体扫描躺在床上、为了入睡而做：只缩短时长，不改成睁眼，也不改成说个不停的详细档；
 * 不安时睁眼、听房间里的声音，写在它自己的安全提示里。
 */
export function adjustedDefaults(
  id: CatalogPracticeId,
  screening?: ScreeningAnswers | null,
): PracticeDefaults {
  const p = PRACTICE_BY_ID[id]
  const out: PracticeDefaults = {
    durations: [...p.durations],
    defaultMinutes: p.defaultMinutes,
    eyesOpen: EYES_OPEN.has(id),
    shortened: false,
    notes: [],
  }
  if (p.paced) out.paced = p.paced
  if (!screening || p.category === 'sound' || id === 'grounding') return out

  const N = SCREENING_NOTES
  const breathing = p.category === 'breathing'
  const bedtime = soundModeOf(id) === 'sleep'
  const psychosis = screening.psychosis === true || screening.bipolar === true
  const panic = screening.panic === true

  // 短、睁眼、连续的引导，不留长时间静默（safety-goldberg-2022、practice-baer-2019）
  if (screening.trauma === true || psychosis) {
    const max = id === 'timer' && psychosis ? SILENT_SIT_MAX : SHORT_MAX
    Object.assign(out, capDurations(p.durations, p.defaultMinutes, max))
    out.shortened = true
    if (!bedtime) {
      out.eyesOpen = true
      if (p.scriptId) out.guidance = 'detailed'
    }
  }
  // 外部的锚点、睁眼，不提示深呼吸（safety-fincham-2023、safety-szulczewski-2019）
  if (panic && !bedtime) out.eyesOpen = true

  if (screening.trauma === true) out.notes.push(N.trauma)
  if (psychosis) out.notes.push(N.psychosis)
  if (screening.bipolar === true) out.notes.push(N.mania)
  // 健康情况把一项冥想改成睁眼时说一句；本来就睁眼做的、跟着画面呼吸的不用说
  if (out.eyesOpen && !EYES_OPEN.has(id) && !breathing) out.notes.push(N.eyesOpen)

  if (panic) {
    if (id === 'slow') {
      out.paced = LIGHT_SLOW_PACE
      out.notes.push(N.panicSlow)
    } else if (breathing) {
      // 周期性叹息的安全提示里已经有惊恐的那一条，不再说第二遍
      if (id !== 'cyclic-sigh') out.notes.push(N.panicBreathing)
    } else if (id !== 'walking' && !bedtime) {
      // 行走的锚点本来就是脚底；睡前身体扫描的安全提示里已经有「睁开眼睛，听听房间里的声音」
      out.notes.push(N.panicAnchor)
    }
  }

  if (breathing) {
    if (screening.epilepsy === true) out.notes.push(N.epilepsy)
    if (screening.pregnancy === true || screening.heart === true) out.notes.push(N.pregnancyHeart)
    if (screening.respiratory === true) out.notes.push(N.respiratory)
    if (id === 'cyclic-sigh' && needsGentleBody(screening)) out.notes.push(N.sighLight)
  }
  return out
}

/** 带参数启动一项练习 */
export interface PracticeLaunch {
  id: CatalogPracticeId
  minutes: number
  /** 覆盖练习默认的节拍 */
  paced?: PacedParams
}

/**
 * 「现在有点难」面板里的三项练习，按显示顺序（PRODUCT §4）；求助方式另列。
 * 需要轻柔呼吸的情况下，周期性叹息换成轻而慢的慢呼吸，取 3 分钟：这是它最短的一档，引导词也从 3 分钟起。
 * 有创伤闪回、幻觉妄想或双相时，落地练习排第一：应对版要人靠近难受的感受，不适合当第一步
 */
export function copingOptions(screening?: ScreeningAnswers | null): PracticeLaunch[] {
  const breath: PracticeLaunch = prefersLightBreathing(screening)
    ? { id: 'slow', minutes: 3, paced: LIGHT_SLOW_PACE }
    : { id: 'cyclic-sigh', minutes: 1 }
  const coping: PracticeLaunch = { id: 'breathing-space-coping', minutes: 3 }
  const grounding: PracticeLaunch = { id: 'grounding', minutes: 1 }
  const list = groundingFirst(screening) ? [grounding, breath, coping] : [breath, coping, grounding]
  // 三项在 v1 都提供；这里再按 isOffered 过一遍，以后改动 V1_UNAVAILABLE 时，面板里不会出现开始不了的练习
  return list.filter(o => isOffered(o.id))
}
