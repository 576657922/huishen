/**
 * 安全与求助内容：「开始之前」须知、健康情况检查、各练习的安全提示、停止指引、练完感觉与每月自查、
 * 求助电话、免责声明、睡前声音的说明，以及文案禁用词。纯数据加几个纯函数，界面和各处测试都从这里读。
 *
 * 依据：安全研究笔记 safety.notes（来源核实于 2026-10-22）与 PRODUCT.md §6、§10、§11；两者不一致时以 PRODUCT.md 为准。
 * 证据 id 写在 evidence 字段或注释里。标 [J] 的是没有直接证据的预防性设计判断，文案里照实说「预防性的安排」。
 * 上线前，全部安全文案须由精神科或临床心理医生审阅（safety.notes §12）。
 *
 * 分工：健康情况检查之后隐藏哪些练习、默认值怎样变，由 practices.ts 的 isHidden、adjustedDefaults、copingOptions 决定；
 * 这里只把这些调整讲清楚，测试逐项核对两边一致。「最近 3 次里 2 次」的判断在 data/stats.ts 的 recentDistress。
 * 内容层不依赖数据层（ARCHITECTURE.md），练完感觉和健康情况的键按结构写在这里，测试核对与 data/types.ts 一致。
 *
 * 写法：你称、短句、全角标点，中文与数字、拉丁字母之间留空格。不说「很安全」，也不吓人：
 * 不适并不少见，持久的伤害少见，两件事都要说（safety-farias-2020、safety-goldberg-2022、safety-hirshberg-2022）。
 */
import type { PracticeId } from '@/content/types'

/* ---------- 通用 ---------- */

/** 目录里现有的练习 id；旧 id 等各模块迁移完会从 PracticeId 里删掉，这里不为它们写提示 */
type CatalogueId = Exclude<PracticeId, 'resonance' | 'extended-exhale' | 'rf-assessment' | 'soundscape'>

/** 练完感觉的四个值，与 data/types.ts 的 Feeling 相同 */
export type FeelingValue = 'calmer' | 'same' | 'tenser' | 'unwell'

/** 健康情况检查保存的八项，与 data/types.ts 的 Screening、practices.ts 的 ScreeningItem 相同 */
export type ScreeningKey =
  | 'pregnancy'
  | 'heart'
  | 'respiratory'
  | 'psychosis'
  | 'bipolar'
  | 'epilepsy'
  | 'trauma'
  | 'panic'

/** 一段说明：可选小标题、段落和条目。条目由界面加项目符号，文案里不写「·」 */
export interface SafetySection {
  heading?: string
  paragraphs?: string[]
  items?: string[]
}

/** 安全文案是全局共享的常量：冻结后，误改会立刻报错，而不是悄悄改掉别的页面上的号码。正则不冻结 */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !(value instanceof RegExp) && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value) as unknown[]) deepFreeze(v)
  }
  return value
}

/* ---------- 求助电话 ---------- */

/**
 * 求助电话最后一次逐条核实的日期，界面显示为「最后核实：2026-10-22」。
 * 每 6 个月、以及官方号码变更后重新核实：抑郁与防自杀类 App 里，约 9% 给错过危机热线号码（safety-martinengo-2019）。
 */
export const LAST_VERIFIED = '2026-10-22'

export interface CrisisLine {
  name: string
  /** 显示的号码或网址 */
  display: string
  /** 电话为 tel: 加纯数字（按所在地区的本地拨法）；网站为 https: */
  href: string
  hours: string
  /** 一句话：这是什么电话、什么时候打 */
  description: string
  /** 核实所依据的来源，供下次复核；界面可以不显示 */
  source: string
}

export interface CrisisRegion {
  id: 'cn' | 'hk' | 'tw' | 'us' | 'other'
  name: string
  lines: CrisisLine[]
}

/**
 * 只列已核实的号码（safety.notes §8）。北京心理危机研究与干预中心的旧号码只见于2019年前后的名单，
 * 各地热线现已接入 12356，不再列出；测试会扫描 src/content 确认它们没有出现。
 * 地区名按大陆通行写法：中国大陆、中国香港、中国台湾。
 */
export const CRISIS_RESOURCES: CrisisRegion[] = deepFreeze<CrisisRegion[]>([
  {
    id: 'cn',
    name: '中国大陆',
    lines: [
      {
        name: '心理援助热线',
        display: '12356',
        href: 'tel:12356',
        hours: '各地每天不少于 18 小时，部分地区 24 小时',
        description: '全国统一号码，2025年5月1日起全国可拨打，由当地的心理援助热线接听。',
        source: '国家卫生健康委 国卫医政函〔2024〕259 号；新华社 2025-05-08；人民日报 2025-11-28',
      },
      {
        name: '希望24热线',
        display: '400-161-9995',
        href: 'tel:4001619995',
        hours: '24 小时',
        description: '由受训志愿者接听的心理援助热线。',
        source: 'hope9995.com（网站内容最后更新于2021年）；findahelpline.com',
      },
      {
        name: '急救',
        display: '120',
        href: 'tel:120',
        hours: '24 小时',
        description: '胸痛、晕厥、抽搐，或有人有生命危险时拨打。',
        source: '国家卫生健康委关于 110、119、120 联动的通知',
      },
      {
        name: '报警',
        display: '110',
        href: 'tel:110',
        hours: '24 小时',
        description: '人身安全受到威胁时拨打。',
        source: '国家卫生健康委关于 110、119、120 联动的通知',
      },
    ],
  },
  {
    id: 'hk',
    name: '中国香港',
    lines: [
      {
        name: '紧急求助',
        display: '999',
        href: 'tel:999',
        hours: '24 小时',
        description: '有生命危险时拨打，可接通警察、消防和救护车。',
        source: 'police.gov.hk；hkengage.gov.hk',
      },
      {
        name: '精神健康支援热线',
        display: '18111',
        href: 'tel:18111',
        hours: '24 小时',
        description: '香港特区政府设立的精神健康支援热线，2023年12月开通。',
        source: 'info.gov.hk 新闻公报 P2023122700238',
      },
      {
        name: '香港撒玛利亚防止自杀会',
        display: '2389 2222',
        href: 'tel:23892222',
        hours: '24 小时',
        description: '情绪支援与防止自杀热线，中文服务。',
        source: 'sbhk.org.hk',
      },
      {
        name: '香港撒玛利亚会',
        display: '2896 0000',
        href: 'tel:28960000',
        hours: '24 小时',
        description: '情绪支援热线，提供多种语言服务。',
        source: 'samaritans.org.hk',
      },
    ],
  },
  {
    id: 'tw',
    name: '中国台湾',
    lines: [
      {
        name: '安心专线',
        display: '1925',
        href: 'tel:1925',
        hours: '24 小时',
        description: '心理咨询热线，免费拨打。',
        source: 'mohw.gov.tw/cp-16-50587-1.html',
      },
      {
        name: '救护车与消防',
        display: '119',
        href: 'tel:119',
        hours: '24 小时',
        description: '有人受伤、晕厥或发生火灾时拨打。',
        // 核实用的是英文的紧急求助指南（safety.notes §8），这里只写其中当地大学的页面
        source: '当地大学公开的紧急电话页面',
      },
      {
        name: '报警',
        display: '110',
        href: 'tel:110',
        hours: '24 小时',
        description: '人身安全受到威胁时拨打。',
        source: '当地大学公开的紧急电话页面',
      },
    ],
  },
  {
    id: 'us',
    name: '美国',
    lines: [
      {
        name: '自杀与危机生命线',
        display: '988',
        href: 'tel:988',
        hours: '24 小时',
        description: '可以打电话、发短信或在线聊天。',
        source: '988lifeline.org',
      },
    ],
  },
  {
    id: 'other',
    name: '其他地区',
    lines: [
      {
        name: 'Find A Helpline',
        display: 'findahelpline.com',
        href: 'https://findahelpline.com',
        hours: '网站，需要联网',
        description: '国际求助热线目录，可以按国家或地区查找。',
        source: 'findahelpline.com',
      },
    ],
  },
])

/** 求助卡片的说明文字（safety.notes §8）。卡片在任何页面两步以内可达，离线可用 */
export const CRISIS_CARD = deepFreeze({
  title: '求助方式',
  body: '你不需要独自面对。下面的电话由专业人员或受训志愿者接听。',
  // 卡片也给香港、台湾和美国的人看，120 在那里打不通。美国的 911 还没有按 safety.notes §8 核实
  // （2026-10-23 官方页面无法访问），所以只列已核实的三地，句子先说「当地的急救电话」
  emergency:
    '如果你或身边的人有生命危险，请立即拨打当地的急救电话：中国大陆 120 或 110，中国香港 999，中国台湾 119 或 110。',
  // 12356、988 这类短号只在本地区有效，香港的号码在大陆拨要加区号
  dialing: '以下都是当地的拨打方式，在其他地区可能打不通。',
  // 不暗示与任何热线合作，也不承诺替用户做什么（safety.notes §11）
  footer: '回神不提供危机干预服务，也不会自动替你拨打电话。',
  verified: `最后核实：${LAST_VERIFIED}`,
})

/* ---------- 开始之前 ---------- */

export interface FirstRunNotice {
  title: string
  sections: SafetySection[]
  /** 读到最后才可以点（界面负责判断是否读完） */
  confirm: string
  /** 还没读完时，确认按钮旁的提示 */
  readToEnd: string
  help: string
  evidence: string[]
}

/* 几处共用的说法：同一件事在须知、健康情况检查、每月自查和免责声明里用同样的话 */

/** 回神是什么、不是什么。「开始之前」和免责声明全文的第一段；可以描述的用途见 safety-fda-2026 */
const WHAT_IT_IS =
  '回神提供冥想、呼吸和声音练习，用于日常放松、减压、专注和睡前准备。它不是医疗器械，不能诊断或治疗疾病，也不能替代医生、心理治疗或药物。'

/** 对已经说出有危险的人：先给急救和报警（safety.notes §8） */
const DANGER = '如果你现在有危险，请立即拨打 120 或 110。'

/** 有伤害自己的念头时，先给热线，不先给 110。12356 有的地区夜里没人接，所以同时给 24 小时的希望24热线 */
const TALK =
  '也可以拨打心理援助热线 12356，和受过训练的人谈谈；有的地区不是 24 小时接听，打不通时，可以打 24 小时的希望24热线 400-161-9995。'

/** 正在伤害自己、有不想活的念头时 */
const PROFESSIONAL_FIRST = '这段时间，先找医生或心理专业人员，比一个人练习更重要。'

/**
 * 第一次开始练习前显示一次，不能自动跳过（safety.notes §3）。改写自 safety.notes 的中文稿：
 * - 两个比例都说明来历：综述约 8%，多数研究没有专门询问，所以可能偏低；人群调查里，只问一个总的问题约三分之一，
 *   逐项询问约一半（safety-farias-2020、safety-goldberg-2022；只问开放问题会漏掉约七成，safety-britton-2021）。
 *   「不适」是这里的统一说法，研究里的「不良反应」只在第一次出现时注明（safety.notes §13）。
 * - 「睡不好、情绪发木、不真实感」在 Britton 2021 里各不足 5%，所以写「少数人」，不和焦虑并列为常见。
 * - 加上相反的证据：老师带领的 8 周课程并没有让更多人变差（safety-hirshberg-2022）。不说「用 App 风险更大」：
 *   那个信号只来自 17 人，用过 App 的 199 人没有任何关联（safety-goldberg-2022 的 app_implication）。
 * - 要先问医生的情况分两组：癫痫、怀孕、心肺疾病是快速深呼吸的禁忌（safety-peltola-2023），只关系到呼吸练习；
 *   惊恐发作单列，不和创伤绑在一起，短时间的过度换气会诱发惊恐（safety-fincham-2023）；
 *   正在接受心理治疗的人，先和治疗师商量练习的时机（safety-oxfordmindfulness-2026）。
 * - 「使用药物后」容易被读成正在服药的人不能练，改为「影响清醒的药物」（safety-oxfordmindfulness-2026）。
 * - 水中、泡澡只限呼吸练习，与研究笔记一致：在浴缸里听雨声并不危险，先过度换气再屏气才危险（safety-boyd-2015）。
 * - 求助分层：有生命危险才给 120、110；有伤害自己的念头，先给心理援助热线（safety.notes §8 的原稿把两者并列，这里改了）。
 */
export const FIRST_RUN_NOTICE: FirstRunNotice = deepFreeze<FirstRunNotice>({
  title: '开始之前',
  sections: [
    { paragraphs: [WHAT_IT_IS] },
    {
      heading: '可能出现的不适',
      paragraphs: [
        '练习时出现不适并不少见（研究里称为「不良反应」）。一篇汇总 83 项研究的综述估计，约 8% 的参与者报告过；多数研究没有专门询问，这个数字可能偏低。一项美国人群调查里，练过冥想的人中，只问一个总的问题时约三分之一、逐项询问时约一半，有过至少一次与冥想有关的不适；约十分之一说它影响过日常生活，影响持续一个月或更久的约 1%。',
        '较常见的是紧张或焦虑、情绪低落、过去的痛苦记忆浮现。少数人会睡不好、情绪发木，或觉得自己和周围不真实。多数不适是暂时的。',
        '另一方面，在一项美国研究里，参加老师带领的 8 周正念课程的人，情况明显变差的比例并不比等待参加的人高。自己用手机练，身边没有老师提醒，知道怎样停下来就更重要，所以每次练习的屏幕上都有「不舒服？」。',
        '你可以随时睁开眼睛、调整姿势、换一种练习，或者停下来。不舒服时停下来，是合适的做法，不是失败。',
      ],
    },
    {
      heading: '做呼吸练习之前，建议先问问医生',
      items: ['癫痫，或有过抽搐发作', '怀孕', '心脏病、脑血管病、严重的肺部疾病，或血压控制不好'],
    },
    {
      heading: '以下情况，建议先和医生或心理专业人员谈谈',
      items: [
        '近 6 个月内有过躁狂或轻躁狂发作',
        '有过幻觉或妄想',
        '情绪低落到难以应付日常生活',
        '正在伤害自己，或有自杀的念头',
        '经历过创伤，常有闪回',
        '常有惊恐发作',
        '正在接受心理治疗（先和你的治疗师商量）',
        '使用胰岛素',
      ],
    },
    {
      heading: '这些时候不要练习',
      items: ['饮酒后，或用了影响清醒的药物后', '驾驶或操作机器时'],
      paragraphs: ['呼吸练习请坐着或躺着做，不要在水中或泡澡时做。'],
    },
    {
      heading: '需要帮助时',
      paragraphs: [
        '如果你或身边的人有生命危险，请立即拨打 120 或 110。如果你有伤害自己的念头，可以拨打全国统一心理援助热线 12356，和受过训练的人谈谈。每次练习的「不舒服？」和「设置」里，都能找到求助方式。',
      ],
    },
  ],
  confirm: '我已读完',
  readToEnd: '读到最后，才能确认。',
  help: '查看求助方式',
  evidence: [
    'safety-farias-2020',
    'safety-goldberg-2022',
    'safety-britton-2021',
    'safety-hirshberg-2022',
    'safety-nccih-2021-relaxation',
    'safety-oxfordmindfulness-2026',
    'safety-peltola-2023',
    'safety-fincham-2023',
    'safety-boyd-2015',
    'safety-nhc-2024',
    'safety-statecouncil-2021-medical-device',
  ],
})

/* ---------- 健康情况检查 ---------- */

/** 健康情况检查里会保存的一项，对应 Prefs.safety.screening 的键 */
export interface HealthCheckItem {
  id: ScreeningKey
  label: string
  /** 一句白话，帮人判断自己是否符合 */
  hint?: string
  /** 勾选以后，应用具体改了什么 */
  adaptation: string
  /** 为什么这样改，以及依据的局限 */
  why: string
  /** 勾选以后隐藏的练习，与 practices.ts 的 isHidden 一致 */
  hides: CatalogueId[]
  evidence: string[]
}

/** 不保存的一项：勾选时当场给出建议，不写进 screening */
export interface HealthCheckNotice {
  id: 'crisis' | 'depression' | 'insulin'
  label: string
  response: string[]
  /** 同时显示求助方式 */
  showHelp: boolean
  evidence: string[]
}

export interface HealthCheck {
  title: string
  intro: string
  privacy: string
  question: string
  items: HealthCheckItem[]
  notices: HealthCheckNotice[]
  /** 显示在不保存的几项旁边 */
  unsaved: string
  none: string
  skip: string
  save: string
}

/* 几种情况共用的调整说明，措辞与 practices.ts、today.ts 的实际行为逐项对应，测试核对 */

/**
 * copingOptions 换掉吸满再补一口的叹息（breathing.notes §6）；今日页随之不再推荐它，
 * 「只有几分钟」也换成同样时长的慢呼吸（today.ts 的 rulesFor、quickPicks）
 */
const LIGHT_SOS = '「今日」不再推荐周期性叹息，「只有几分钟」和「现在有点难」里换成轻柔的慢呼吸'
/**
 * adjustedDefaults：只留 10 分钟以内、睁眼、详细档（safety.notes §4、practice-baer-2019）。声音类不受影响。
 * 睡前身体扫描躺在床上做，不改成睁眼和详细档，只缩短；它在 v1 不提供（practices.ts 的 V1_UNAVAILABLE），
 * 说明里不提，重新提供时再写回「睡前身体扫描只缩短时长」
 */
const SHORT_OPEN =
  '冥想和呼吸练习默认睁着眼睛，时长只留 10 分钟以内的选项，有引导词的练习改用「详细」档，不留长时间的安静；听声音不受影响'
/** copingOptions：难受时先用睁眼、以身体外部为锚的落地练习 [J]（safety.notes §4「落地的出口一直在」） */
const GROUNDING_FIRST = '「现在有点难」把落地练习放在最前面'
/**
 * 与八周计划第 5 周的说明一致。开放觉察被隐藏（幻觉妄想、双相）或不推荐（创伤闪回，practices.ts 的 isDiscouraged）时，
 * 今日页用第 5 周可选练习里的专注呼吸顶替这一天（today.ts 的 programPicks）
 */
const WEEK5 = '八周计划第 5 周，请改练可选练习里的专注呼吸，「今日」也会改推它'
/** 外部的锚点，与专注呼吸的引导词一致（「也可以把注意力放在双脚、双手，或者声音上」） */
const ANCHOR_SWITCH = '把注意力换到双脚、双手或周围的声音上'
/** 幻觉妄想加重的信号 [J] */
const PERCEPTION = '如果异常的感知变多，请停下练习，并告诉你的医生。'
/**
 * 躁狂、轻躁狂的早期信号 [J]。与冥想有关的躁狂见于高强度练习或原有疾病的人（safety-lindahl-2017；safety.notes §1），
 * 写出具体的信号，本人和家人才知道要留意什么
 */
const MANIA = '如果连着几天睡得很少却不觉得累，或者话、念头和精力明显比平时多，请停下练习，并告诉你的医生。'
/** 哮喘、慢阻肺（safety.notes §4 的原句） */
const INHALER = '呼吸练习不能替代你的吸入药物；如果出现喘鸣或胸闷，请停止练习，按医嘱用药。'

/**
 * 可选的健康情况检查（safety.notes §4）。答案只存本机：健康信息属于敏感个人信息，
 * 处理需要单独同意（个人信息保护法第二十八、二十九条，ux-npc-2021-pipl）；只在本机就不经过任何人。
 *
 * 可见性规则与 practices.ts 一致：孕期、心脑血管病、哮喘或慢阻肺隐藏箱式呼吸；幻觉妄想或双相情感障碍隐藏开放觉察；
 * 常有创伤闪回时开放觉察仍看得到，但今日页不推荐（isDiscouraged）。
 * 其余各项只改默认值和提示，不改能不能练（breathing.notes §6：答案改变默认值和文案，而不是限制使用）。
 * 屏息和叹息的风险都没有直接研究，相应的隐藏和替换属于 [J]，文案里照说。
 */
export const HEALTH_CHECK: HealthCheck = deepFreeze<HealthCheck>({
  title: '健康情况检查',
  intro:
    '这一步可以跳过。回神会按你的回答，隐藏个别可能不适合的练习，并调整默认的时长、节奏、提示和「今日」的推荐。',
  privacy: '答案只保存在这台设备上，不会上传。可以随时在「设置」里修改或清除。',
  question: '以下情况，有符合你的吗？可以多选。',
  items: [
    {
      id: 'epilepsy',
      label: '癫痫，或有过抽搐发作',
      adaptation: `回神本来就不提供快速、用力的呼吸法，所以不隐藏任何练习。${LIGHT_SOS}；各项呼吸练习会提醒你，呼吸要轻、要慢，不要加快或加深。开始呼吸练习前，建议先问问神经科医生。`,
      why: '连续几分钟又深又快地呼吸，是医院做脑电图时诱发癫痫发作的方法。英国一项审计里，疑似癫痫的受检者约 2% 因此发作。周期性叹息每一轮都要吸得比平时满，换成更轻的慢呼吸，是预防性的安排。',
      hides: [],
      evidence: ['safety-peltola-2023', 'breathing-bscn-2013', 'safety-nccih-2021-relaxation'],
    },
    {
      id: 'pregnancy',
      label: '正在怀孕',
      adaptation: `隐藏箱式呼吸；${LIGHT_SOS}。各项呼吸练习会提醒你保持轻柔、不要憋气。开始呼吸练习前，可以先问问医生。`,
      why: '医院做脑电图时，孕期不做快速深呼吸的检查。箱式呼吸每一轮有两次停顿；孕期短暂屏息是否有害，目前没有直接研究。隐藏它、换掉要吸满的叹息，都是预防性的安排。',
      hides: ['box'],
      evidence: ['safety-peltola-2023', 'safety-fincham-2023'],
    },
    {
      id: 'heart',
      label: '心脏病或脑血管病，或血压控制不好',
      hint: '例如冠心病、心律失常、心力衰竭，或中风过',
      adaptation: `隐藏箱式呼吸；${LIGHT_SOS}。各项呼吸练习会提醒你保持轻柔、不要憋气；出现不适请停下，并咨询医生。`,
      // 高血压不在快速深呼吸的禁忌里，归入这一项是 breathing.notes §6 的预防性判断，所以「为什么」只讲严重心脏病和中风
      why: '医院做脑电图时，有严重心脏病、近期中风或心梗的人，不做快速深呼吸的检查。短暂屏息是否有害，目前没有直接研究；隐藏箱式呼吸、换掉要吸满的叹息，都是预防性的安排。',
      hides: ['box'],
      evidence: ['safety-peltola-2023', 'breathing-bscn-2013', 'safety-fincham-2023'],
    },
    {
      id: 'respiratory',
      label: '哮喘、慢阻肺，或其他较重的肺部疾病',
      adaptation: `隐藏箱式呼吸；${LIGHT_SOS}。${INHALER}`,
      // 相反的证据也写上：英国 655 人的哮喘试验，呼吸再训练里有受控屏息，严重不良事件 4% 对常规照护 8%（breathing-bruton-2018）
      why: '医院做脑电图时，有严重肺部疾病的人不做快速深呼吸的检查。英国一项 655 人的哮喘试验里，包含短暂屏息的呼吸训练，严重不良事件并不比常规照护多；慢阻肺和其他较重的肺病，我们没有找到这类研究。隐藏箱式呼吸是预防性的安排。',
      hides: ['box'],
      evidence: [
        'breathing-bruton-2018',
        'safety-peltola-2023',
        'breathing-bscn-2013',
        'breathing-santino-2020',
      ],
    },
    {
      id: 'bipolar',
      label: '双相情感障碍，或有过躁狂、轻躁狂发作',
      adaptation: `隐藏开放觉察。${SHORT_OPEN}。${GROUNDING_FIRST}。${WEEK5}。建议和你的医生一起决定怎么练。${MANIA}`,
      why: '牛津正念基金会的大众正念课程，不接收近 6 个月内有过躁狂或轻躁狂发作的人。这不是说正念帮不上忙，而是最好在了解你情况的专业人员带领下练。隐藏开放觉察是预防性的安排，没有直接研究。',
      hides: ['open-awareness'],
      evidence: [
        'safety-oxfordmindfulness-2026',
        'safety-obrienvenus-2024',
        'practice-baer-2019',
        'safety-lindahl-2017',
      ],
    },
    {
      id: 'psychosis',
      label: '有过幻觉或妄想',
      hint: '比如听到别人听不到的声音，或长时间坚信有人要害你',
      adaptation: `隐藏开放觉察。${SHORT_OPEN}。${GROUNDING_FIRST}。${WEEK5}。${PERCEPTION}`,
      // 只写证据库里有的：没有固定对象的觉察与类似精神病性体验的相关研究（Palmer 2024）还没有进入证据库，不引用。
      // 副作用不是「没有发生」，而是没有一项试验记录过（safety-obrienvenus-2024 的 app_implication：放心一些，但只是初步的）
      why: '针对精神分裂症等精神病性障碍的 39 项随机试验里，接受正念类疗法的一组，不良事件并不比对照组多。这些疗法多由专业人员带领、经过调整，练习通常更短；其中 11 项是接纳承诺疗法，不一定包含冥想练习。试验很少记录不良结局，没有一项专门记录过练习本身带来的不适，所以这个结果让人放心一些，但还只是初步的。隐藏开放觉察是预防性的安排，没有直接研究。',
      hides: ['open-awareness'],
      evidence: ['safety-obrienvenus-2024', 'practice-baer-2019', 'safety-oxfordmindfulness-2026'],
    },
    {
      id: 'trauma',
      label: '经历过创伤，常有闪回',
      // 与身体脱离的感觉（解离）也算：它和持久的不良影响有关（safety-britton-2021）
      hint: '痛苦的画面或感受突然重现，好像又经历了一次；或者常觉得自己和身体脱离',
      // 锚点可选：专注呼吸、呼吸空间等引导词都请人在呼吸、双脚、双手、声音里选（practice-deroche-2025）。
      // 开放觉察仍然看得到，但今日页和计划不再推荐（practices.ts 的 isDiscouraged）
      adaptation: `${SHORT_OPEN}。${GROUNDING_FIRST}。锚点可以选呼吸、双脚或声音；身体扫描的每一处都可以跳过。${WEEK5}。`,
      // 另有 Zhu 2019（Mindfulness，151 名学生）：创伤史预测短时静坐中的不适
      why: '童年不良经历越多的人，越容易在练习中出现不适（一项美国调查，相关较弱，r = 0.19）。这些调整来自针对创伤的正念教学建议，还没有专门的试验检验。',
      hides: [],
      evidence: [
        'safety-goldberg-2022',
        'safety-britton-2021',
        'safety-nccih-2021-relaxation',
        'practice-deroche-2025',
        'practice-baer-2019',
      ],
    },
    {
      id: 'panic',
      label: '常有惊恐发作',
      hint: '突然一阵强烈的恐慌，心跳很快、喘不上气，担心自己失控',
      // 睡前身体扫描不改成睁眼（adjustedDefaults），v1 不提供它，这里不提；重新提供时再写回「睡前身体扫描除外」
      adaptation: `${LIGHT_SOS}；慢呼吸的默认节奏改为稍快的每分钟 6 次。冥想和呼吸练习默认睁着眼睛；留意呼吸让你紧张时，可以${ANCHOR_SWITCH}。惊恐发作影响到生活的话，请找医生或心理专业人员。`,
      why: '呼吸过深过快，会带来和惊恐相似的身体感觉。研究中，短时间的过度换气让 16%–51% 有惊恐障碍的人出现了惊恐。针对惊恐的呼吸训练，原则是慢而轻，不求深，也不一开始就放到很慢。',
      hides: [],
      evidence: ['safety-fincham-2023', 'breathing-meuret-2008', 'safety-szulczewski-2019'],
    },
  ],
  notices: [
    {
      id: 'crisis',
      label: '正在伤害自己，或最近有不想活的念头',
      // 直接、平实地问不会增加风险（safety-blades-2018）；危险时先给急救和报警，练习只留睁眼的短练习
      response: [
        DANGER,
        `${TALK}下面还列有其他求助电话。`,
        `${PROFESSIONAL_FIRST}如果想练，只做 60 秒落地练习这样睁着眼的短练习。`,
      ],
      showHelp: true,
      evidence: ['safety-oxfordmindfulness-2026', 'safety-blades-2018'],
    },
    {
      id: 'depression',
      label: '情绪低落到难以应付日常生活',
      // 英国的抑郁症指南只把团体正念课程列为较轻抑郁的选择之一（meditation-nice-2022），放在证据页，不在这里讲
      response: [
        '现在不急着开始练习，先找医生或心理专业人员谈谈。',
        '如果想练，先只做 60 秒落地练习这样睁着眼的短练习。',
      ],
      showHelp: true,
      evidence: ['safety-oxfordmindfulness-2026', 'meditation-nice-2022'],
    },
    {
      id: 'insulin',
      label: '使用胰岛素',
      // 说清用量由医生定，免得有人自己改胰岛素
      response: [
        '练习内容不变。请告诉医生你在练习，因为压力的变化可能影响血糖和胰岛素用量。用量请按医嘱调整，不要自己改。',
      ],
      showHelp: false,
      evidence: ['safety-oxfordmindfulness-2026'],
    },
  ],
  unsaved: '这一项只用来当场给出建议，不会保存。',
  none: '都没有',
  skip: '跳过',
  save: '保存',
})

/* ---------- 各练习的安全提示 ---------- */

/** 呼吸类练习开头 10 秒内的一句（PRODUCT.md §10）。一句提示就让呼气末二氧化碳的下降减少近一半（safety-szulczewski-2019） */
export const BREATH_OPENING_LINE = '轻柔地呼吸，不必吸得很深。'

/**
 * 呼吸过度的信号（safety-peltola-2023、breathing-bscn-2013）。头晕也可能有别的原因，所以说「多半是」，与停止指引一致；
 * 说「先不跟节拍」，与引导词一致，也不和箱式呼吸的「停」混淆
 */
const OVERBREATHING = '如果头晕，或手指、嘴唇发麻，多半是吸得太深或太快。先不跟节拍，恢复自然呼吸。'

/** safety.notes §5「慢节律呼吸」的完整一条 */
const GENTLE = `${BREATH_OPENING_LINE}${OVERBREATHING}`

/** 所有呼吸练习：先过度换气再屏气，可能在水中毫无预警地失去意识（safety-boyd-2015、safety-wimhofmethod-2026） */
const SIT_OR_LIE = '请坐着或躺着练习。不要在水中、泡澡、驾驶或操作机器时练习。'

/**
 * 冥想里较常见的不适和出口：睁眼、换到身体外面的锚点（safety-britton-2021、safety-nccih-2021-relaxation；meditation.notes §9）。
 * 焦虑是最常见的一类（safety-goldberg-2022：27%），所以不说「少数人」，与「开始之前」一致
 */
const UNSETTLED = `有的人练习时会更焦虑、心慌或情绪低落，多数是暂时的。出现这种情况，可以睁开眼睛，${ANCHOR_SWITCH}，也可以缩短练习或停下来。`

/** 不真实感、失眠、情绪发木持续超过一天，是 Britton 2021 里「暂停并找人帮忙」的信号（safety-britton-2021） */
const LASTING = '练完超过一天还没消退，请暂停练习，和医生或心理专业人员谈谈。'

/**
 * 身体扫描里最常浮现的两类：创伤记忆重现（safety-goldberg-2022：25.8%）和与身体脱离的感觉，后者与持久的不良影响有关
 * （safety-britton-2021）。出口与停止指引一致：睁眼、看看四周
 */
const MEMORIES = `如果浮现痛苦的记忆或画面，或者觉得和身体脱离，可以睁开眼睛，看看四周，或者停下来。这种感觉${LASTING}`

/** 容易勾起哀伤和自我批评的练习，给出求助入口（safety.notes §8） */
const SAD_HELP = '如果难过一直放不下，或冒出伤害自己的念头，请打开「求助方式」。'

/** 快要晕倒的人先放低身体，再做别的（停止指引的第一步，也是落地练习的提示） */
const DIZZY = '头晕的话，先坐下或躺下，缓过来再起身。'

/** 需要马上叫急救的情况（safety.notes §6） */
const CALL_120 = '如出现胸痛、晕厥或抽搐，请立即拨打 120。'

/** 睡眠问题指向专科，不和练习比较效果 */
const SLEEP_CLINIC = '长期睡不好，可以去医院的睡眠门诊看看。'

/** 听声音时的音量：比安静交谈更轻（sound-staum-2000；sound.notes §1） */
const QUIET_VOLUME = '音量调到比安静交谈更轻、但能听清的程度。'

/** 世卫组织对设备音量的建议（safety-itu-2018）：戴耳机时不超过最大音量的 60% */
const DEVICE_VOLUME_MAX = 60
const HEADPHONE_LIMIT = `戴耳机时，设备音量不要超过最大音量的 ${DEVICE_VOLUME_MAX}%。`

/** 整夜播放怎样放手机或音箱（safety.notes §5、§9）。没有证据说戴耳机睡觉有害，所以只给做法 */
const ALL_NIGHT_PLACEMENT =
  '整夜播放时，建议不戴耳机，用手机或音箱外放，放在离枕边远一些的地方，音量调到刚好能听见。'

/** 婴儿睡眠机最大音量可超过 85 dBA（safety-hugh-2014） */
const INFANTS =
  '不建议给婴儿长时间播放。如果要用，把手机或音箱放在远离婴儿的地方，不要放进婴儿床；音量调到最低，并设好定时。'

/**
 * 每个练习详情页显示的安全提示（safety.notes §5、breathing.notes §6、PRODUCT.md §10），措辞与 scripts/ 里引导词的说法一致，
 * 可直接作为 Practice.safety。跟随节拍的呼吸，第一条以 BREATH_OPENING_LINE 开头；
 * 周期性叹息例外：它本来就要吸得比平时满，引导词说「轻轻吸到七八成满，再补一小口」，这里照引导词写。
 * 「不必吸得很深」和「七八成满」放在一起自相矛盾，所以改规格而不是改文案：请产品在 PRODUCT §10 写明这个例外。
 */
export const TECHNIQUE_WARNINGS: Record<CatalogueId, string[]> = deepFreeze<Record<CatalogueId, string[]>>({
  focus: [
    UNSETTLED,
    // safety.notes §5「静坐」的完整一条：时间感、自我感的变化，持续就换成有明确对象的练习（数息、听声音）并缩短时间
    // （safety-britton-2021）。引导词二十分钟起才讲不真实感，出口同样是睁眼、摸一摸身边的东西；短的练习只在这里说
    `练得久了，对时间的感觉可能会变，也可能觉得自己或周围不太真实。这时可以睁开眼睛，摸一摸身边的东西；这种感觉一直不消失，就换成数息或听声音，并缩短练习的时间。${LASTING}`,
  ],
  'breath-count': [
    '不用为了好数而放慢或加深呼吸，让它按自己的快慢来。',
    `如果头晕、心慌或很不舒服，就停下来，${ANCHOR_SWITCH}。`,
  ],
  'body-scan': [
    '如果留意某个部位让你难受，可以跳过它；也可以睁开眼睛，听听声音，或者感受双脚。',
    '疼的地方，先知道它在那里；疼得太厉害，就回到呼吸，或者跳过这一处。',
    MEMORIES,
  ],
  'body-scan-sleep': [
    '如果留意某个部位让你难受，可以跳过它；也可以睁开眼睛，听听房间里的声音。',
    '如果胸闷或心慌，就停下练习，睁开眼睛。',
    MEMORIES,
    // meditation-rusch-2019 研究的是有睡眠问题的人上几周的线下课程，不是睡前练习；与专门的方法相比没有差别（证据弱）
    `${SLEEP_CLINIC}研究里，几周的正念课程对睡眠的改善，并不比专门针对失眠的方法更好。`,
  ],
  'breathing-space': ['某种感受太强烈时，先回到双脚；也可以睁开眼睛，或者停下来。'],
  'breathing-space-coping': [
    '这个版本会请你留意难受的感受，和它一起待一会儿。太强烈时，只留意它的边缘，或者回到双脚；也可以随时停下来，睁开眼睛看看四周。',
    '一直缓不过来，或冒出伤害自己的念头，请打开「求助方式」。',
  ],
  'loving-kindness': [
    // safety.notes §5：慈心和自我关怀「有时会勾起悲伤或旧的痛苦，这很常见」，两项用同样的说法
    '这类练习有时会勾起旧的难过，这很常见。任何时候，都可以换个姿势、睁开眼睛，或者停下来。',
    '想到某个人让你难过，可以换一位；留意胸口让你不舒服，可以换成感受双脚。',
    // 难相处的人只在 20 分钟版、只选轻微的（practice-schroter-2022）
    '20 分钟版里「有点难相处的人」可以跳过；不要选曾经深深伤害过你的人。',
    SAD_HELP,
  ],
  'self-compassion': [
    // 善意勾起旧的痛苦，《静观自我关怀》称「回燃」
    '这个练习有时会勾起旧的难过，对自己好一点的时候反而更容易浮上来，这很常见。太强烈的话，回到双脚，或者睁开眼睛、停下来。',
    // 不超过 4 分（满分 10 分）：practice.notes §2.5 的设计值，未经试验检验；引导词说「三四分就够了」
    '先选一件小事，满分 10 分的话，三四分就够了。想到的事太重，就换一件小一点的。',
    SAD_HELP,
  ],
  'open-awareness': [
    `静坐时，对时间的感觉可能会变，有时也会觉得自己或周围不太真实。这种感觉一直不消失，就睁开眼睛，换成听声音或专注呼吸，也可以早点结束。${LASTING}`,
    '被想法卷走或感到不安时，回到呼吸或声音。',
    // 与八周计划第 5 周的说明一致。前两类做健康情况检查后看不到这项练习（isHidden）；
    // 常有创伤闪回的人仍看得到，但今日页不推荐（isDiscouraged）
    '有过幻觉或妄想、有双相情感障碍，或者常有创伤闪回的话，先不要练这一项，改练专注呼吸，并和医生商量。',
    // 没有固定对象的练习不推荐给新手（safety.notes §2）；八周计划第 5 周起才安排
    '建议先练几周专注呼吸，再练这一项。',
  ],
  walking: [
    '全程睁着眼睛。找一段平坦、没有障碍的路；在户外，避开车和人多的地方。',
    '担心站不稳，可以靠墙走、扶一下，或者坐着练，轮流抬脚、放脚。头晕、累了或者心里不舒服，随时停下来坐一会儿。',
  ],
  pause: [
    '吸气比平时稍满一点就好，不必很深；呼完让呼吸恢复平常。',
    // 一分钟停一停常在做事中途用。v1 是文字引导，要看着屏幕做，所以走路时先停下来，不边走边看
    '驾驶或操作机器时不要做。走路时，先停下脚步，站稳了再做。',
  ],
  grounding: [DIZZY, CALL_120, '还是很难受，可以找人说一说，或者打开「求助方式」。'],
  timer: [
    // 闭关级别的强度与更多不良体验有关，因果未定（safety-lindahl-2017、safety-matko-2026）
    '刚开始，每次 5–10 分钟就够了。每天练很久、像闭关那样高强度地练，可能更容易出现不适。',
    // 静坐没有引导词，出口用 safety.notes §5 的「有明确对象的练习」
    `静坐时，对时间的感觉可能会变，也可能觉得自己或周围不太真实。这种感觉一直不消失，就换成数息或听声音，并缩短时间。${LASTING}`,
    // safety.notes §4：幻觉妄想或双相病史，不做无引导的长静坐
    '有过幻觉或妄想，或有双相情感障碍的话，先不要做没有引导的长时间静坐。',
  ],
  slow: [GENTLE, SIT_OR_LIE],
  'cyclic-sigh': [
    // 节拍不提示吸到最满（safety.notes §2），与引导词的「轻轻吸到七八成满」一致
    '吸气要轻，只到七八成满，再补一小口；呼气慢慢呼完，不用往外挤。',
    OVERBREATHING,
    // 惊恐时慢而轻的呼吸更合适（breathing-meuret-2008）。说清是平时的建议，也说清勾选以后应用会怎么换
    `常有惊恐发作的话，更建议做轻柔的慢呼吸。在健康情况检查里选上「常有惊恐发作」后，${LIGHT_SOS}。`,
    SIT_OR_LIE,
  ],
  box: [
    GENTLE,
    '停顿时喉咙放松，不要用力憋气；觉得吃力，就停得短一些，或者不停。',
    '心慌或胸口发紧时，也先不跟节拍，自然地呼吸。',
    // [J] 屏息的风险没有直接研究；这几类人做健康情况检查后看不到这项练习
    '怀孕、有心脏或脑血管疾病、哮喘或慢阻肺的话，请改用没有停顿的慢呼吸。',
    SIT_OR_LIE,
  ],
  'pace-finder': [
    GENTLE,
    // 很慢的节奏也可能呼吸过度，这时改为更浅、更平顺的呼吸（breathing-shaffer-2020）。后面几档更慢、更容易憋闷，
    // 所以不叫人直接接着跟
    '节奏越慢，越容易不自觉地吸得太深。某一档让你头晕或憋闷，就先自然地呼吸，给它打低分。后面几档更慢，缓过来再跟；还是不舒服，就停下，不用测完。',
    SIT_OR_LIE,
  ],
  // 轻的音量更适合放松，更大声没有好处（sound-staum-2000）；WHO 建议设备音量不超过最大的 60%（safety-itu-2018）
  listen: [`${QUIET_VOLUME}${HEADPHONE_LIMIT}`],
  sleep: [
    '音量调到刚好能听见就好。建议设好定时，把手机或音箱放在离枕边远一些的地方。',
    // 婴儿睡眠机最大音量可超过 85 dBA（safety-hugh-2014）
    '不建议给婴儿长时间播放。',
    SLEEP_CLINIC,
  ],
})

const hasWarnings = (id: PracticeId): id is CatalogueId => Object.hasOwn(TECHNIQUE_WARNINGS, id)

/** 某个练习的安全提示；旧记录里的旧 id 没有提示，返回空数组 */
export function warningsFor(id: PracticeId): string[] {
  return hasWarnings(id) ? TECHNIQUE_WARNINGS[id] : []
}

/** 健康情况检查之后，练习详情页上接在安全提示后面的补充提示 */
export interface ScreeningNotes {
  /** 健康情况让一项冥想默认改成睁眼时 */
  eyesOpen: string
  trauma: string
  /** 幻觉妄想或双相 */
  psychosis: string
  /** 双相：躁狂、轻躁狂的早期信号 */
  mania: string
  /** 常有惊恐发作时的冥想 */
  panicAnchor: string
  panicBreathing: string
  /** 慢呼吸的默认节拍改为每分钟 6 次时 */
  panicSlow: string
  /** 需要轻柔呼吸时的周期性叹息 */
  sighLight: string
  epilepsy: string
  pregnancyHeart: string
  respiratory: string
}

/**
 * 补充提示的文字。用哪几条由 practices.ts 的 adjustedDefaults 决定；和健康情况检查里的调整说明用同样的话，
 * 两边只有一个来源（safety.notes §4、breathing.notes §6）
 */
export const SCREENING_NOTES: ScreeningNotes = deepFreeze<ScreeningNotes>({
  // 文字引导里，引导词会说安静时可以闭眼；这一条提醒这类情况安静时也睁着（与 copy.ts 的 GUIDANCE_HOWTO.eyesOpen 一致）
  eyesOpen: '按你填写的健康情况，建议全程睁着眼睛练：目光放低，落在屏幕上，安静的时候也不闭眼。',
  trauma: '有创伤经历的话，每次不超过 10 分钟；不舒服时，随时点「不舒服？」做落地练习。',
  psychosis: `有过幻觉或妄想，或有双相情感障碍的话，研究里多是经过调整、有专业人员支持的练习方式；建议和医生一起决定怎么练，每次短一些，不安的时候，把注意力放到声音或双脚上。${PERCEPTION}`,
  mania: MANIA,
  panicAnchor: `常有惊恐发作的话，留意呼吸让你紧张时，${ANCHOR_SWITCH}。`,
  panicBreathing: '常有惊恐发作的话，呼吸只求慢而轻，不求深；觉得憋闷，就先不跟节拍，自然地呼吸。',
  panicSlow:
    '常有惊恐发作的话，节拍默认稍快一些（每分钟 6 次，吸 4 秒、呼 6 秒），只求慢而轻，不求深；觉得憋闷，就点「有点急」，或者先不跟节拍，自然地呼吸。',
  sighLight: '按你填写的健康情况，更建议先做轻柔的慢呼吸；做周期性叹息的话，吸到舒服就好，补吸的那一口要小。',
  epilepsy: '有癫痫或抽搐史的话，呼吸要轻、要慢，不要加快或加深；开始前，建议先问问神经科医生。',
  pregnancyHeart: '怀孕或有心脏、脑血管疾病的话，呼吸保持轻柔，不要憋气；出现不适请停下，并咨询医生。',
  respiratory: INHALER,
})

/* ---------- 停止指引 ---------- */

export interface StopGuidance {
  title: string
  /** 播放器上的一句话版本 */
  short: string
  /** 什么时候停 */
  when: { lead: string; items: string[] }
  /** 停下以后做什么（不叫 then：带 then 的对象会被 await 当成 Promise） */
  after: { lead: string; items: string[] }
  /** 跟随节拍呼吸时的补充 */
  breathing: string
  emergency: string
  next: string
  actions: { grounding: string; switchPractice: string; help: string }
  evidence: string[]
}

/**
 * 停止指引全文，用在暂停面板和「不舒服？」面板（safety.notes §6，PRODUCT.md §5）。
 * 停下以后的顺序：先坐下或躺下（第一条停止的理由就是快要晕倒，站着练行走的人照顺序做也不会摔倒），
 * 再睁眼看四周、踩稳双脚、恢复自然呼吸、喝水、活动，与落地练习的引导词一致（「头晕就先躺着」在看四周之前）。
 * 喝水要坐着喝。
 * 「吸不够气」分两种说：伴头晕、发麻多半是吸得太多；只是憋得慌、总想提前吸气，多半是节拍对这个人太慢，
 * 而放轻的提示并不减少这种感觉（safety-szulczewski-2019）。两种情况的做法都是不跟节拍、按自己的快慢呼吸。
 */
export const STOP_GUIDANCE: StopGuidance = deepFreeze<StopGuidance>({
  title: '停止指引',
  short: '不舒服就停下，睁开眼睛，自然地呼吸。',
  when: {
    lead: '出现以下情况，请停止练习，睁开眼睛，恢复自然呼吸：',
    items: [
      '头晕、眼前发黑、快要晕倒',
      '手指或嘴唇周围发麻，手脚发紧',
      '心慌、心跳明显不规律、胸闷、呼吸困难或喘鸣',
      '强烈的恐慌或失控感',
      '创伤画面闯入，或强烈的不真实感、与身体脱离的感觉',
    ],
  },
  after: {
    lead: '停下以后：',
    items: [
      DIZZY,
      '睁开眼睛，慢慢看看四周，说出你看到的五样东西。',
      '双脚踩稳地面，感受身下的支撑。',
      '不用再跟着节拍或引导，用鼻子轻轻地、自然地呼吸。',
      '手边有水的话，坐着慢慢喝几口。',
      '缓过来以后，起来走一走，活动一下手脚。',
    ],
  },
  breathing:
    '跟着节拍呼吸时，如果头晕、心慌、手指或嘴唇发麻、手脚发紧，多半是吸得太深或太快。先不跟节拍，坐下或躺下，用鼻子小口、自然地呼吸，通常几分钟内会缓解。如果只是憋得慌、总想提前吸气，多半是节拍对你太慢。按自己的快慢呼吸几次；慢呼吸里也可以点「有点急」，节拍会快一点。',
  emergency: `${CALL_120}持续气促，或不适几分钟后仍不缓解，请及时就医。`,
  next: '还是很难受，可以做 60 秒落地练习，或者打开「求助方式」。',
  actions: { grounding: '60 秒落地练习', switchPractice: '换一个练习', help: '求助方式' },
  evidence: [
    'safety-peltola-2023',
    'safety-fincham-2023',
    'safety-britton-2021',
    'safety-nccih-2021-relaxation',
    'breathing-bscn-2013',
    'breathing-shaffer-2020',
    'safety-szulczewski-2019',
  ],
})

/* ---------- 练完以后 ---------- */

export interface FeelingOption {
  value: FeelingValue
  label: string
}

/**
 * 每月自查每一项的回答：没有 / 有，一天内就过去了、没再出现 / 有，持续或反复出现超过一天。
 * 惊恐发作和闯入的记忆是一阵一阵来的，所以「反复出现」也算 lasting
 */
export type MonthlyAnswer = 'no' | 'brief' | 'lasting'

export interface MonthlyCheck {
  title: string
  intro: string
  question: string
  items: { id: string; label: string }[]
  answers: { value: MonthlyAnswer; label: string }[]
  /** 按 monthlyCheckResult 的结论显示 */
  results: Record<MonthlyAnswer, string>
  selfHarm: { question: string; yes: string; no: string; response: string[] }
}

export interface AfterPractice {
  question: string
  skip: string
  options: FeelingOption[]
  /** 选了「很不舒服」：随后显示停止指引、落地练习和求助方式 */
  unwell: { title: string; paragraphs: string[] }
  /** 最近 3 次记下的感觉里至少 2 次「更紧张」或「很不舒服」（判断见 data/stats.ts 的 recentDistress） */
  gentler: {
    title: string
    paragraphs: string[]
    suggestions: { practiceId: CatalogueId; minutes: number }[]
    help: string
  }
  monthly: MonthlyCheck
  evidence: string[]
}

/**
 * 练完感觉、反复不适时的建议、每月自查（safety.notes §7、PRODUCT.md §6）。
 * 只问开放问题会漏掉约七成的不良反应，所以每月自查逐项问具体的变化（safety-britton-2021）；
 * 失眠、情绪发木、自我感改变、做事能力下降持续超过一天，与持久的不良影响有关，是暂停并找人帮忙的信号。
 * 「最近 3 次里 2 次」这个门槛是 [J]。
 */
export const AFTER_PRACTICE: AfterPractice = deepFreeze<AfterPractice>({
  question: '练完感觉怎么样？',
  skip: '跳过',
  options: [
    { value: 'calmer', label: '更平静' },
    { value: 'same', label: '差不多' },
    { value: 'tenser', label: '更紧张' },
    { value: 'unwell', label: '很不舒服' },
  ],
  unwell: {
    title: '先休息一下',
    paragraphs: [
      '练习后有时会很不舒服，这种不适多数是暂时的。',
      '现在先不用再练。睁开眼睛看看四周，双脚踩稳地面，手边有水的话，坐着慢慢喝几口；也可以跟着做 60 秒落地练习。',
      '如果这种感觉持续超过一天，或者让你担心，请和医生或心理专业人员谈谈。',
    ],
  },
  gentler: {
    title: '换一种更温和的练法',
    paragraphs: [
      '最近 3 次记下的练完感觉里，至少有 2 次是更紧张或很不舒服。这不代表你练错了。有的练法未必适合你，或者只是现在不适合。',
      '接下来可以试试更短、睁着眼、以声音为锚的练习，或者先停几天。',
      '如果紧张或不舒服一直影响生活，请和医生或心理专业人员谈谈。',
    ],
    // 落地练习睁着眼、听周围的声音；听声音只有声音，睁着眼也能做。两项都不会被健康情况检查隐藏
    suggestions: [
      { practiceId: 'grounding', minutes: 1 },
      { practiceId: 'listen', minutes: 10 },
    ],
    help: '求助方式',
  },
  monthly: {
    title: '练习后的变化自查',
    intro: '每月一次，可以跳过。逐项问，比只问「还好吗」更不容易漏掉变化。答案不会上传。',
    question: '最近一个月，练习以后有没有出现下面这些变化？',
    items: [
      { id: 'sleep', label: '睡得比以前差' },
      { id: 'function', label: '注意力难以集中，做事比以前吃力' },
      { id: 'blunting', label: '情绪发木，高兴或难过都不太感觉得到' },
      { id: 'unreal', label: '常觉得自己或周围不真实，或者觉得自己变得陌生' },
      { id: 'intrusion', label: '过去的痛苦记忆反复闯进来' },
      { id: 'anxiety', label: '一直很焦虑，或反复有惊恐发作' },
    ],
    answers: [
      { value: 'no', label: '没有' },
      { value: 'brief', label: '有，一天内就过去了，没再出现' },
      { value: 'lasting', label: '有，持续或反复出现超过一天' },
    ],
    results: {
      no: '没有需要留意的变化。下个月会再问一次。',
      brief: '只出现一会儿、很快过去的变化比较常见。下次可以缩短时间、睁着眼练，或者用声音作锚点。',
      lasting: '这些变化持续或反复出现超过一天，建议先暂停或减少练习，并和医生或心理专业人员谈谈。',
    },
    // 直接、平实地问不会增加风险（safety-blades-2018）。先给电话，再说清不会有人收到这个回答
    selfHarm: {
      question: '最近两周，你有没有过伤害自己或不想活的念头？',
      yes: '有',
      no: '没有',
      response: [`${DANGER}${TALK}`, PROFESSIONAL_FIRST, '这个回答不会上传，回神也不会替你联系任何人。'],
    },
  },
  evidence: ['safety-britton-2021', 'safety-blades-2018', 'safety-matko-2026'],
})

/** 每月自查的结论：有一项持续或反复出现超过一天，就按 lasting 处理 */
export function monthlyCheckResult(answers: readonly MonthlyAnswer[]): MonthlyAnswer {
  if (answers.includes('lasting')) return 'lasting'
  if (answers.includes('brief')) return 'brief'
  return 'no'
}

/* ---------- 免责声明 ---------- */

export interface Disclaimers {
  /** 每个练习页和应用商店页 */
  short: string
  /** 「关于」和「安全与证据」 */
  full: {
    title: string
    paragraphs: string[]
    /** 界面显示为「最后更新：2026-10-23」 */
    updated: string
  }
  evidence: string[]
}

/**
 * 免责声明（safety.notes §10）。短版改写自研究笔记的原句：「回神为一般健康与放松练习」把应用说成了练习，是译文腔；
 * 可以描述的用途只写放松、减压、专注和睡前准备（safety-fda-2026）。
 * 长版回答 APA 评估模型关心的几件事：是不是医疗用途、证据的局限、怎样应对安全问题、数据怎么删、用不用 AI（safety-apa-2026）。
 * 还缺「怎样报告不适、报告怎样处理」（safety.notes §7.3）：要等产品定下真实的联系方式，不写占位文字。
 * 研究来源：正念研究半数以上来自北美，来自亚洲的只有 8.1%（meditation-goldberg-2022）。
 */
export const DISCLAIMERS: Disclaimers = deepFreeze<Disclaimers>({
  short:
    '回神提供日常放松练习，不是医疗器械，不能诊断或治疗疾病，也不能替代专业医疗。紧急情况请拨打 120 或 110；心理援助热线 12356。',
  full: {
    title: '免责声明',
    paragraphs: [
      WHAT_IT_IS,
      '我们引用的研究各有局限，结果不一定适用于每个人；证据页会同时列出不支持或相互矛盾的结果。正念研究里，半数以上来自北美，来自亚洲的不到十分之一。',
      '请不要因为使用回神而推迟就医、自行停药或更改治疗方案。',
      '每次练习都能随时打开停止指引和求助方式；最近 3 次记下的练完感觉里，至少有 2 次是更紧张或很不舒服时，回神会建议换一种更温和的练法。回神不提供危机干预服务，也不会自动替你拨打电话。',
      '你的练习记录只保存在这台设备上，我们看不到。可以在「设置」的「数据」里导出记录，或删除全部数据。',
      // v1 的引导是屏幕上的文字，不用在线语音，应用只在加载自己时联网（与设置里的隐私说明一致），这里不再讲语音
      '回神不会用 AI 分析你的记录。',
    ],
    updated: '2026-10-23',
  },
  evidence: [
    'safety-nccih-2022-meditation',
    'safety-apa-2026',
    'safety-fda-2026',
    'safety-statecouncil-2021-medical-device',
    'safety-npc-2021-advertising-law',
    'meditation-goldberg-2022',
  ],
})

/* ---------- 睡前声音 ---------- */

/** 声音的安全说明，以睡前为主。sounds.ts 的确认框、音量说明和噪声说明都从这里取，不另写一份 */
export interface SleepSoundRules {
  /** 设备（手机、音箱、耳机）音量的建议上限，占最大音量的百分比 */
  deviceVolumeMax: number
  /** 定时默认分钟数 */
  defaultMinutes: number
  /** 听声音时的音量：比安静交谈更轻 */
  volume: string
  /** 戴耳机时设备音量的上限 */
  headphones: string
  /** 睡前声音页常驻的音量提示 */
  volumeTip: string
  /** 定时说明：快到时间时怎样淡出 */
  timer: string
  /** 整夜播放时，手机或音箱放在哪儿、戴不戴耳机 */
  placement: string
  /** 选「不限」时的确认；婴儿的提醒是最后一段 */
  allNight: { title: string; paragraphs: string[]; confirm: string; cancel: string }
  /** 噪声这一组的说明 */
  noise: string
  infants: string
  /** 长期睡不好时去哪里 */
  clinic: string
  evidence: string[]
}

/**
 * 睡前声音的说明（safety.notes §9）。研究笔记写的「默认设备音量 30%、超过 60% 提醒」，浏览器做不到：
 * 网页读不到也改不了设备音量，应用内的音量（总音量默认 80）又不是设备音量，套用同一个数字会让每个人一打开就被提醒。
 * 所以设备音量只用文案提醒（60% 来自 WHO 对设备音量的建议，safety-itu-2018）；睡前模式本身由声音层压低。
 * 定时默认 45 分钟、「不限」须确认（PRODUCT.md §2）。到点前的淡出是 2 分钟，与会话引擎的 NO_BELL_FADE_SEC 一致，sounds.test.ts 核对。
 * 声音暴露是累积的（safety-itu-2018，即 H.870 标准；sound-who-2018）；婴儿睡眠机最大音量可超过 85 dBA（safety-hugh-2014）；
 * 持续噪声改善睡眠的证据极低，也要留意它对睡眠和听力的影响（sound-riedy-2021）。
 * 戴耳机整夜听有没有害，没有直接研究：照实说，不编造风险。
 * 噪声的说明不用「（证据：X）」：等级名只用 GRADE_NAMES，「证据很弱」是 PRODUCT §2 给噪声的标注，这里写成白话。
 */
export const SLEEP_SOUND_RULES: SleepSoundRules = deepFreeze<SleepSoundRules>({
  deviceVolumeMax: DEVICE_VOLUME_MAX,
  defaultMinutes: 45,
  volume: QUIET_VOLUME,
  headphones: HEADPHONE_LIMIT,
  volumeTip: `音量调到刚好能听见就好。睡前的声音要放很久，比白天更需要小声；手机或音箱本身的音量，也尽量不超过最大音量的 ${DEVICE_VOLUME_MAX}%。`,
  timer: '快到时间时，声音会用 2 分钟慢慢变轻，直到停下。',
  placement: ALL_NIGHT_PLACEMENT,
  allNight: {
    title: '不限时播放',
    paragraphs: [
      '声音会一直放到你停下为止。耳朵会连着听上几个小时，声音对听力的影响是累积的。',
      ALL_NIGHT_PLACEMENT,
      '目前没有研究直接说明戴耳机睡觉有什么风险，这样建议，是为了让整夜的声音轻一些。',
      INFANTS,
    ],
    confirm: '不限时播放',
    cancel: '改用定时',
  },
  noise:
    '用来盖住车声、人声这类断续的环境噪音。它们能不能让人睡得更好，证据很弱；也有综述提醒，要留意持续的噪声对睡眠和听力的影响。',
  infants: INFANTS,
  clinic: SLEEP_CLINIC,
  evidence: [
    'safety-itu-2018',
    'safety-hugh-2014',
    'sound-who-2018',
    'sound-riedy-2021',
    'sound-capezuti-2022',
    'sound-staum-2000',
  ],
})

/* ---------- 文案禁用词 ---------- */

export interface ForbiddenTerm {
  /** 规则名，也是 findForbidden 返回的值 */
  term: string
  /** 匹配的写法；不填时按 term 原样查找。不能带 g、y 标志（test 会记住位置） */
  pattern?: RegExp
  /** 出现在这些固定说法里时不算：多为否定句，或指医生、心理治疗等别的服务 */
  allowedIn?: string[]
  /** 为什么不能用 */
  reason: string
}

/**
 * 文案里永远不说的词（PRODUCT.md §10、§11；safety.notes §11；各研究笔记的禁用表）。
 * 规则针对「声明」而不是字面：「不能诊断或治疗疾病」「心理治疗」可以出现，「治疗失眠」不行。
 * 只在规格或研究笔记点名的地方放宽，免得禁用表变成猜测；需要新的固定说法时加进 allowedIn。
 * 「其他治疗」「积极治疗」「失眠治疗」「睡眠治疗」不放宽：和它们比，等于把回神说成一种治疗；
 * 规格的说法是「其他积极方法」「专门针对失眠的方法」。
 */
export const FORBIDDEN_TERMS: ForbiddenTerm[] = deepFreeze<ForbiddenTerm[]>([
  // 疾病与医疗声明（广告法第十七条，safety-npc-2021-advertising-law；医疗器械监督管理条例，safety-statecouncil-2021-medical-device）
  {
    term: '治疗',
    allowedIn: [
      '不能诊断或治疗',
      '不能治疗',
      '不用于治疗',
      '不是治疗',
      '不能替代治疗',
      '不能代替治疗',
      '心理治疗',
      '药物治疗',
      '专业治疗',
      '音乐治疗',
      '治疗方案',
      '治疗师',
      '接受治疗',
      '遵医嘱治疗',
    ],
    reason: '不说能治疗任何疾病；只用在否定句里，或指医生、心理治疗等别的服务',
  },
  { term: '治愈', pattern: /治愈|治好|根治/, reason: '医疗承诺，否定句里也不用' },
  {
    term: '缓解疾病',
    pattern:
      /(缓解|改善|减轻|预防|对抗|控制)(你的)?(失眠|焦虑症|抑郁症|惊恐障碍|惊恐症|创伤后应激障碍|多动症|高血压|哮喘|慢阻肺|癫痫|疾病)/,
    reason: '把练习说成能缓解、改善或预防某种疾病',
  },
  {
    term: '消除焦虑',
    pattern: /(消除|告别|摆脱|战胜|根除|远离)(你的)?(焦虑|压力|失眠|抑郁|烦恼|负面情绪|坏情绪)/,
    reason: '结果承诺；研究里的效果是与不练习相比平均小幅到中等的减轻',
  },
  { term: '疗效', reason: '医学用语' },
  { term: '疗程', reason: '医学用语；说「课程」或「计划」' },
  { term: '处方', reason: '医学用语' },
  { term: '医用级', pattern: /临床级|医用级|医疗级/, reason: '医学用语' },
  { term: '数字疗法', reason: '医学用语' },
  {
    term: '音乐治疗',
    pattern: /音乐(治疗|疗法)/,
    allowedIn: ['不是音乐治疗', '不是音乐疗法', '不提供音乐治疗', '不提供音乐疗法'],
    reason: '回神提供的是听音乐，不是治疗师带领的音乐治疗（sound-bradt-2021）',
  },
  {
    term: '医生推荐',
    pattern: /(医生|医师|专家|教授|名医)(推荐|认证|背书|力荐)/,
    reason: '医生或专家背书',
  },
  {
    term: '替代药物',
    pattern: /(代替|替代|取代)(药物|吃药|就医|医生|心理治疗|治疗)|不用吃药|不必吃药|停药|减药/,
    allowedIn: ['不能替代', '不能代替', '不可以替代', '自行停药', '不要停药', '不要自己停药', '自行减药'],
    reason: '暗示可以替代药物、医生或心理治疗（safety-nccih-2022-meditation）',
  },
  {
    term: '诊断用语',
    pattern: /你(可能|也许|或许)?(有|患有|得了)(焦虑症|抑郁症|失眠症|惊恐障碍|强迫症|双相|精神病)/,
    reason: '不从自评结果给人下诊断',
  },
  {
    term: '危机干预',
    allowedIn: ['不提供危机干预'],
    reason: '回神不提供危机干预，也不暗示与任何热线合作',
  },

  // 绝对化与无法验证的说法（广告法第二十八条）
  {
    term: '零副作用',
    pattern: /零副作用|无副作用|没有任何副作用|毫无副作用|绝对安全|完全安全|很安全|非常安全|十分安全/,
    reason:
      '练习中的不适并不少见（safety-farias-2020、safety-goldberg-2022）；说「通常风险不大，但研究不多」',
  },
  {
    term: '100% 有效',
    pattern: /(100\s*[%％]|百分之百|百分百)\s*(有效|见效|安全|成功)/,
    reason: '绝对化承诺',
  },
  {
    term: '保证见效',
    pattern: /保证(见效|有效|效果)|包你|立刻见效|立即见效|马上见效|立竿见影/,
    reason: '绝对化承诺',
  },
  {
    term: 'X 天见效',
    pattern:
      /([0-9０-９]+|[一二三四五六七八九十百两几]+)\s*(天|周|个月)(内|之内)?(就能|就会|即可|就)?(见效|养成)/,
    reason: '变化通常在第 8 周前后才出现，习惯养成的时间因人而异（meditation-basso-2019、ux-lally-2010）',
  },
  {
    term: '科学证明',
    pattern: /科学证明|科学证实|临床证明|临床证实/,
    reason: '说「研究发现」，并给出效应大小和出处',
  },

  // 生理与大脑（safety.notes §11；meditation.notes §9；sound.notes §8）
  { term: '提高免疫力', pattern: /(提高|增强|提升|改善)(你的)?免疫/, reason: '没有依据的生理承诺' },
  {
    term: '降血压',
    pattern: /降(低)?血压|降压(?!药)/,
    reason: '血压研究结果不一致，不作任何血压声明（breathing.notes §0）',
  },
  { term: '重塑大脑', pattern: /重塑(你的)?大脑|改变(你的)?大脑/, reason: '没有依据的大脑说法' },
  { term: '排毒', reason: '没有依据的生理说法' },
  { term: '抗炎', pattern: /抗炎|消炎/, reason: '没有依据的生理说法' },
  { term: '提高血氧', pattern: /(提高|提升|增加)(你的)?血氧/, reason: '没有依据的生理说法' },
  {
    term: '调节自主神经',
    pattern: /调节(你的)?(自主|植物|迷走)神经/,
    reason: '把生理过程说成可以调节，有医疗器械的意味',
  },
  { term: '激活', reason: '如「激活迷走神经」，没有依据的生理说法' },
  {
    term: '降低皮质醇',
    pattern: /降低(你的)?皮质醇|皮质醇(水平)?(降低|下降)/,
    reason: '多数研究拿自然声与城市噪声比，不是与安静比',
  },
  { term: '修复 DNA', pattern: /修复\s*DNA/i, reason: '没有依据的说法' },
  { term: '心率同步', pattern: /心率同步|心跳同步/, reason: '心率并不跟着音乐节奏走（sound-juslin-2026）' },
  {
    term: '脑波同步',
    pattern: /脑波|[αβθδ]\s*波|阿尔法波|西塔波/,
    reason: '脑电同步的证据不一致（sound-ingendoh-2023）',
  },

  // 呼吸提示（breathing.notes §5）
  {
    term: '深吸一口气',
    pattern: /深吸一口气|深深地?吸一口气|吸一大口气/,
    allowedIn: ['不说「深吸一口气」'],
    reason: '提示吸深会让二氧化碳降得更多；说「轻柔地呼吸，不必吸得很深」（safety-szulczewski-2019）',
  },

  // 营销腔与模板话（PRODUCT.md §11；ux.notes §10）
  { term: '疗愈', reason: '包括「疗愈之旅」「频率疗愈」「疗愈频率」' },
  { term: '能量', reason: '含「能量」的说法一律不用' },
  { term: '振动频率', pattern: /振动频率|高频振动/, reason: '伪科学说法' },
  { term: '开启', reason: '模板话，如「开启……之旅」；打开设置写「打开」' },
  { term: '解锁', reason: '模板话，如「解锁更好的自己」' },
  { term: '赋能', reason: '营销腔' },
  {
    term: '觉醒',
    allowedIn: ['夜间觉醒', '夜里觉醒', '觉醒次数'],
    reason: '灵性夸张说法；睡眠研究里的「夜间觉醒」除外',
  },
  { term: '宇宙', reason: '空泛的灵性说法' },
  { term: '瞬间', reason: '夸张（breathing.notes §8）' },
  { term: '改变人生', pattern: /改变(你的)?人生/, reason: '夸张' },
  { term: '更好的自己', reason: '模板话，如「遇见更好的自己」' },
  { term: '让我们', reason: '模板话，如「让我们一起」' },
  { term: '快节奏', reason: '套话，如「在快节奏的现代生活中」' },
  {
    term: '静观',
    allowedIn: ['《静观自我关怀》'],
    reason: '术语固定用「正念」，不混用；只在引用书名时出现',
  },
  {
    term: '最高级',
    pattern: /最有效|最科学|最专业|最放松|顶级|极致|终极|世界上最|全网最|史上最/,
    reason: '不用最高级（sound.notes §7：没有「最放松的歌」）',
  },
  {
    term: '空泛的鼓励',
    pattern: /加油|太棒了|真棒|好棒|你一定可以|你一定行|为你骄傲|坚持就是胜利/,
    reason: '每句话都要具体',
  },
  { term: '感叹号', pattern: /[!！]/, reason: '不用感叹号' },
  {
    term: '表情符号',
    pattern: /\p{Extended_Pictographic}\u{FE0F}|\p{Emoji_Presentation}/u,
    reason: '不用表情符号',
  },
  {
    term: '已经 X 天没练习',
    pattern: /已经\s*([0-9０-９]+|[一二三四五六七八九十两几]+)\s*天没有?(练|打开|来)/,
    reason: '不计算没练的天数（PRODUCT.md §4，ux-buyalskaya-2023）',
  },
])

/** 把允许的固定说法换成占位符，免得其中的字被当成禁用词；长度不变 */
const mask = (text: string, phrases: readonly string[]): string =>
  phrases.reduce((t, phrase) => t.split(phrase).join('\u0000'.repeat(phrase.length)), text)

/** 文字里出现的禁用词，按 FORBIDDEN_TERMS 的顺序返回规则名；没有时返回空数组 */
export function findForbidden(text: string): string[] {
  return FORBIDDEN_TERMS.filter(({ term, pattern, allowedIn = [] }) => {
    const masked = mask(text, allowedIn)
    return pattern ? pattern.test(masked) : masked.includes(term)
  }).map(({ term }) => term)
}

/* ---------- 自由文字里的求助信号 ---------- */

/** 常见的说法；宁可多弹一次求助卡片，也不漏掉 */
const SELF_HARM =
  /自杀|自残|自伤|轻生|寻死|想死|不想活|活不下去|活着没(意思|意义)|没有?活下去的|死了算了|不如死|想消失|撑不下去|结束(自己的)?生命|结束这一切|伤害(我)?自己|割腕|跳楼|跳河|上吊|烧炭/

/**
 * 用户写的备注等自由文字是否提到伤害自己。命中时只显示求助卡片：不拦截输入、不上报、不保存这个判断 [J]
 * （safety.notes §8）
 */
export const mentionsSelfHarm = (text: string): boolean => SELF_HARM.test(text)
