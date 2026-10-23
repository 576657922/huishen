/**
 * 声音目录：「练习」里的声音页、每个播放器里的声音选择、设置里「听声音」的默认背景声，都从这里读。
 * 只有数据和几个纯函数；名字、描述、依据说明和提示文案都放在这里，组件里不写死。
 *
 * 依据（PRODUCT.md §2 声音、§5、§8、§9；sound.notes §1、§4–§6、§8；safety.notes §5、§9、§12）：
 * - 自然声按证据排序（PRODUCT.md §2）。水声在前：一项汇总分析里，水声对健康和积极情绪指标的效应较大，
 *   但估计很不精确，很多研究拿自然声和噪声比，不和安静比（sound-buxton-2021）；流水声和安静休息相比，
 *   自评的紧张没有差别（sound-thoma-2013）。所以只说「许多人觉得自然声让人放松」，不写激素、心率一类的说法。
 *   林间见 sound-vanhedger-2019；鸟鸣只有 2 项研究（sound-buxton-2021），只用轻柔、清亮的鸣唱（sound-ratcliffe-2020）；
 *   风几乎没有专门研究，标「无健康声明」（sound.notes §4）。
 * - 鸟鸣只在放松模式里列出（PRODUCT.md §2）：叫声来得突然，声音层在睡前模式里不出鸟声。
 *   林间睡前也可以选：声音层在睡前模式里只放溪水和风，所以另有一句睡前的描述（descriptionFor）。
 * - 噪声只用来遮蔽环境噪音，标「证据很弱」（sound-riedy-2021、sound-capezuti-2022）。
 * - 音乐实时合成，没有节拍和人声。依据是一般的音乐聆听研究（sound-dewitte-2020、sound-panteleeva-2018、
 *   sound-adiasto-2022），这三种音乐本身没有专门研究；研究也没有发现速度、有没有歌词会明显改变效果
 *   （sound-dewitte-2020-moderators、sound-adiasto-2022），所以不说「照这些特点做」就有研究里的效果。
 *   五声只是风格，不做五行、脏腑对应（sound-li-2025）。
 * - 各项说明讲的是放松的研究。睡前的选择器里，组说明换成睡眠的证据（SOUND_GROUPS 的 note.sleep），
 *   免得拿放松的研究给睡眠充数。
 * - 「无」同样是正当的选择：健康成人压力过后听音乐，并不比安静休息恢复得更快（sound-adiasto-2022）。
 * - 时长取自练习目录（practices.ts），这里只加说明：放松默认 20 分钟（sound-yang-2025、sound-panteleeva-2018），
 *   睡前默认 45 分钟。睡前到点前的淡出时长与会话引擎的 NO_BELL_FADE_SEC 一致，测试会核对。
 * - 安全文案只有一个来源（safety.notes §12）：不限时的确认（含婴儿的提醒）、音量和耳机、整夜播放放在哪儿、
 *   噪声的说明、到点前的淡出和「睡眠门诊」那一句，都取自 safety.ts 的 SLEEP_SOUND_RULES，这里不另写。
 *   音量与耳机：世卫组织与国际电联的安全聆听标准 H.870（safety-itu-2018），轻的音量更适合放松（sound-staum-2000），
 *   整夜播放是额外的夜间声音暴露（sound-who-2018）。
 * - 两种模式的默认组合取自练习目录里「听声音」两项的默认声音（practices.ts），data/prefs.ts 的出厂默认与它相同。
 * - 在 iPhone 和 iPad 上，锁屏或切到别的应用后，浏览器里实时合成的声音会停（PRODUCT.md §5），在设置和第一次睡前播放时说明。
 * 文案只显示、不朗读，所以用阿拉伯数字，与汉字之间留空格（PRODUCT.md §11）。
 * 「（证据：X）」的等级只用 copy.ts 的 GRADE_NAMES，放在它所评价的那个结果后面（PRODUCT.md §9）。
 */
import type { AmbienceId, MusicId, SoundMix, SoundMode } from '@/audio/types'
import { type CatalogPracticeId, PRACTICE_BY_ID } from './practices'
import { SLEEP_SOUND_RULES } from './safety'

/* ---------- 类型 ---------- */

/** 列表上的图标名 */
export type SoundIcon = 'rain' | 'stream' | 'wave' | 'forest' | 'bird' | 'wind' | 'noise' | 'music'

/** 声音在哪一层：自然声和噪声共用声景这一层，选一个就替换另一个；音乐是另一层，可以和声景叠加 */
export type SoundSlot = 'ambience' | 'music'

export interface SoundFlags {
  /** 睡前模式里可选 */
  readonly sleepOk: boolean
  /** 白天的声音：只在放松模式里列出；睡前的选择器用 SOUND_COPY.dayOnly 说明为什么没有它 */
  readonly dayOnly: boolean
  /** 不说它比同类声音多出任何作用；标「无健康声明」 */
  readonly noHealthClaim: boolean
  /** 证据很弱；标「证据很弱」 */
  readonly weakEvidence: boolean
}

export interface SoundOption<Id extends AmbienceId | MusicId> {
  readonly id: Id
  readonly name: string
  /** 听起来是什么样，具体、可感，不超过 20 字 */
  readonly description: string
  /** 睡前模式里听起来不一样时用这一句（林间睡前没有鸟声）；用 descriptionFor 取 */
  readonly sleepDescription?: string
  /** 研究怎么说：和什么比、局限、证据强弱。选择器里可能单独显示，所以不依赖别的条目也能读懂 */
  readonly evidenceNote: string
  /** 支撑 evidenceNote 的证据 id，对应 docs/research/evidence.json；没有专门研究时为空 */
  readonly evidence: readonly string[]
  readonly flags: SoundFlags
  /** 名字旁的标注，与 flags 一致；没有为 null */
  readonly tag: string | null
  readonly icon: SoundIcon
}

/** 声景层：自然声和噪声都走这一层 */
export type AmbienceOption = SoundOption<Exclude<AmbienceId, 'none'>>
export type MusicOption = SoundOption<Exclude<MusicId, 'none'>>
export type AnySound = AmbienceOption | MusicOption

export type SoundGroupId = 'nature' | 'noise' | 'music'

/** 一组声音的标题和说明，声音页和选择器按组列出 */
export interface SoundGroup {
  readonly name: string
  readonly slot: SoundSlot
  /** 写在组名下面，按模式取：睡前讲睡眠的证据 */
  readonly note: Readonly<Record<SoundMode, string>>
  readonly evidence: Readonly<Record<SoundMode, readonly string[]>>
}

/** 某个模式下可选的声音，按组、按目录顺序 */
export interface SoundLists {
  readonly nature: readonly AmbienceOption[]
  readonly noise: readonly AmbienceOption[]
  readonly music: readonly MusicOption[]
}

/** 「无」这个选项 */
export interface NoneOption {
  /** 选择器里作为一个选项时的名字 */
  readonly name: string
  /** 选择器之外的摘要里怎么说，如播放器上的「雨 · 不加音乐」 */
  readonly summary: Readonly<Record<SoundSlot, string>>
  /** 写在「无」旁边：不放声音同样是正当的选择 */
  readonly note: string
  readonly evidence: readonly string[]
}

/** 默认组合；音量是用户设置，在 Prefs.sounds[mode]，不在预设里 */
export type SoundPreset = Readonly<Required<Pick<SoundMix, 'ambience' | 'music' | 'mode'>>>

export interface ListenSetup {
  /** 练习目录里对应的一项；时长取自它 */
  readonly practiceId: Extract<CatalogPracticeId, 'listen' | 'sleep'>
  readonly name: string
  /** 可选时长（分钟）；UNLIMITED 为不限时 */
  readonly minutes: readonly number[]
  readonly defaultMinutes: number
  readonly note: string
  readonly evidence: readonly string[]
}

export interface ConfirmCopy {
  readonly title: string
  /** 一段一行 */
  readonly paragraphs: readonly string[]
  readonly confirm: string
  readonly cancel: string
}

export interface CopyBlock {
  readonly title: string
  /** 一行一段 */
  readonly lines: readonly string[]
  readonly evidence: readonly string[]
}

export type SoundCopyId = 'volume' | 'iosLock' | 'noHealthClaim' | 'dayOnly' | 'sleep'

/* ---------- 目录 ---------- */

/** 目录是全局共享的常量：冻结后，误改会立刻报错，而不是悄悄改掉别处的默认值（与 practices.ts 相同） */
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const v of Object.values(value) as unknown[]) deepFreeze(v)
  }
  return value
}

/** 白天、睡前都可以用 */
const ANYTIME: SoundFlags = { sleepOk: true, dayOnly: false, noHealthClaim: false, weakEvidence: false }

const MASKING_TAG = '遮蔽环境噪音 · 证据很弱'

/** 自然声，按证据排序（PRODUCT.md §2）：水声在前，风在最后 */
export const AMBIENCES: readonly AmbienceOption[] = deepFreeze<AmbienceOption[]>([
  {
    id: 'rain',
    name: '雨',
    description: '细密的雨声连成一片，偶尔落下大颗雨滴',
    evidenceNote:
      '一项汇总分析发现，各类自然声里，水声对健康和积极情绪指标的效应较大（证据：有限）。不过这个估计很不精确；研究多在实验室或医院里做，很多是拿自然声和噪声比，和安静相比有没有差别，还不清楚。',
    evidence: ['sound-buxton-2021'],
    flags: ANYTIME,
    tag: null,
    icon: 'rain',
  },
  {
    id: 'stream',
    name: '溪流',
    description: '溪水不紧不慢地流，夹着细碎的叮咚声',
    // 这项试验用的正是潺潺流水声；只写自评结果，不写皮质醇（sound.notes §4：不做激素方面的说法）
    evidenceNote:
      '溪流属于水声。一项有 60 名健康女性参加的试验里，压力测试前听 10 分钟流水声的人，和安静休息的人相比，自评的紧张、焦虑没有差别（证据：有限）。',
    evidence: ['sound-thoma-2013'],
    flags: ANYTIME,
    tag: null,
    icon: 'stream',
  },
  {
    id: 'ocean',
    name: '海浪',
    description: '远处的浪涌上来，浪花轻轻碎开，又退下去',
    evidenceNote:
      '海浪属于水声。一项汇总分析发现，各类自然声里，水声对健康和积极情绪指标的效应较大（证据：有限）；但很多研究是拿自然声和噪声比，和安静相比有没有差别，还不清楚。',
    evidence: ['sound-buxton-2021'],
    flags: ANYTIME,
    tag: null,
    icon: 'wave',
  },
  {
    id: 'forest',
    name: '林间',
    description: '溪水流着，偶尔几声鸟鸣，风吹过树叶',
    // 声音层在睡前模式里不出鸟声（audio/layers/birds.ts），描述跟着换
    sleepDescription: '溪水流着，风吹过树叶',
    evidenceNote:
      '在一项有 63 人参加的实验里，听流水、鸟鸣、风声等自然声的人，注意力测验的成绩比听城市声音的人提高更多（证据：有限）；两组的情绪变化没有差别。',
    evidence: ['sound-vanhedger-2019'],
    flags: ANYTIME,
    tag: null,
    icon: 'forest',
  },
  {
    id: 'birds',
    name: '鸟鸣',
    description: '树叶轻响，几只小鸟隔一阵唱一句',
    evidenceNote:
      '一项汇总分析发现，鸟鸣可能减轻压力和烦躁（证据：有限），但这个结果只来自 2 项研究；汇总的研究里，很多是拿自然声和噪声比，不是和安静比。另一项研究里，人们觉得轻柔、清亮的鸣唱更让人放松，响而刺耳的叫声更让人紧张，所以这里只用前一种。',
    evidence: ['sound-buxton-2021', 'sound-ratcliffe-2020'],
    // 不加标注：睡前的选择器里本来就没有它，SOUND_COPY.dayOnly 在那里说明
    flags: { ...ANYTIME, sleepOk: false, dayOnly: true },
    tag: null,
    icon: 'bird',
  },
  {
    id: 'wind',
    name: '风',
    description: '风一阵阵吹过树林，树叶沙沙作响',
    evidenceNote: '几乎没有专门研究风声的试验。放在这里，只是因为有人喜欢它的声音。',
    evidence: [],
    flags: { ...ANYTIME, noHealthClaim: true },
    tag: '无健康声明',
    icon: 'wind',
  },
])

/** 噪声：也走声景层，但单独成组，只作遮蔽（PRODUCT.md §2） */
export const NOISES: readonly AmbienceOption[] = deepFreeze<AmbienceOption[]>([
  {
    id: 'pink',
    name: '粉噪声',
    description: '均匀的沙沙声，比白噪声柔和',
    // 市面上「粉噪声加深睡眠」的说法多出自实验室里的短促脉冲，和连续播放不同（sound-capezuti-2022）。
    // 先给综述的结论，再说正面结果从哪来，免得读成「多数研究有效」
    evidenceNote:
      '一篇综述认为，没有强证据支持用声音帮助睡眠（证据：不足）。粉噪声的 11 项研究里，设计严谨的只有 2 项；正面的结果多来自睡眠实验室，有几项只有 4–16 人，只在某个睡眠阶段短促地播放，和整晚连续播放不是一回事。',
    evidence: ['sound-capezuti-2022'],
    flags: { ...ANYTIME, weakEvidence: true },
    tag: MASKING_TAG,
    icon: 'noise',
  },
  {
    id: 'brown',
    name: '棕噪声',
    description: '低沉的呼呼声，像远处的瀑布',
    // 等级只评「能改善睡眠」；对睡眠和听力的提醒不带等级，免得读成「有害的证据很弱」
    evidenceNote:
      '一篇纳入 38 项研究的综述里，有的研究发现持续噪声让人睡得更好，有的发现睡得更差；持续噪声能改善睡眠的证据质量极低（证据：不足）。作者也提醒，要留意持续噪声对睡眠和听力的影响。',
    evidence: ['sound-riedy-2021'],
    flags: { ...ANYTIME, weakEvidence: true },
    tag: MASKING_TAG,
    icon: 'noise',
  },
])

/** 音乐：实时合成，没有节拍，没有人声（PRODUCT.md §2） */
export const MUSIC: readonly MusicOption[] = deepFreeze<MusicOption[]>([
  {
    id: 'drone',
    name: '长音',
    description: '柔和的和弦缓缓流动，没有旋律',
    evidenceNote:
      '长音这种实时合成的音乐，本身没有专门研究过。它照研究里常用的放松音乐来做：慢，没有歌词，强弱平稳；不过研究没有发现速度快慢、有没有歌词会明显改变效果。',
    evidence: ['sound-jespersen-2022', 'sound-adiasto-2022', 'sound-dewitte-2020-moderators'],
    flags: ANYTIME,
    tag: null,
    icon: 'music',
  },
  {
    id: 'pentatonic',
    name: '五声',
    description: '像古筝的拨弦，五声音阶，隔几秒响一声',
    // 五行音乐的试验多与其他方法合用、又只和常规照护比，看不出「五音对五脏」本身的作用（sound-li-2025）
    evidenceNote:
      '只是一种音乐风格。回神不把五音和五行、脏腑对应起来，因为相关的试验多把音乐和其他方法合在一起用，又只和常规照护比较，看不出五音本身有什么作用。',
    evidence: ['sound-li-2025'],
    flags: { ...ANYTIME, noHealthClaim: true },
    tag: '风格 · 无健康声明',
    icon: 'music',
  },
  {
    id: 'phasing',
    name: '回响',
    description: '几个琴音各自循环，组合一直在变',
    evidenceNote:
      '回响这种写法没有专门的研究。它和长音一样慢，没有歌词，强弱平稳；几个音按不同的间隔各自重复，彼此交错。',
    evidence: ['sound-jespersen-2022', 'sound-adiasto-2022', 'sound-dewitte-2020-moderators'],
    flags: ANYTIME,
    tag: null,
    icon: 'music',
  },
])

export const SOUND_GROUPS: Readonly<Record<SoundGroupId, SoundGroup>> = deepFreeze({
  nature: {
    name: '自然声',
    slot: 'ambience',
    note: {
      relax: '许多人觉得自然声让人放松。',
      sleep: '自然声能不能帮助睡眠，证据很弱。各项说明里的研究看的是放松，不是睡眠。',
    },
    evidence: { relax: ['sound-buxton-2021', 'sound-vanhedger-2019'], sleep: ['sound-capezuti-2022'] },
  },
  noise: {
    name: '噪声',
    slot: 'ambience',
    // 对睡眠和听力的提醒放在组上：选粉噪声的人也要看到（sound-riedy-2021）。文字归 safety.ts，两种模式相同
    note: { relax: SLEEP_SOUND_RULES.noise, sleep: SLEEP_SOUND_RULES.noise },
    evidence: {
      relax: ['sound-riedy-2021', 'sound-capezuti-2022'],
      sleep: ['sound-riedy-2021', 'sound-capezuti-2022'],
    },
  },
  music: {
    name: '音乐',
    slot: 'music',
    // 医疗场景的效应和健康成人的结果分开评级：后者小、不一致（sound-panteleeva-2018 小幅，sound-adiasto-2022 无差别）
    note: {
      relax:
        '在你的设备上实时合成，没有节拍，没有人声。在手术前后这类紧张的场景里，听舒缓的音乐可能让人感觉放松一些，效应小到中等（证据：中等）。健康成人身上效果更小。压力过后听音乐，并不比安静休息恢复得更快（证据：有限）。',
      sleep:
        '在你的设备上实时合成，没有节拍，没有人声。有失眠困扰的成人每晚听音乐、坚持几周，和不听音乐相比，自评的睡眠质量可能好一些（证据：中等）；但用仪器测量睡眠的 3 项研究没有看到改善。',
    },
    evidence: {
      relax: ['sound-dewitte-2020', 'sound-adiasto-2022', 'sound-panteleeva-2018'],
      sleep: ['sound-jespersen-2022'],
    },
  },
})

/** 不放声景或音乐 */
export const NONE: NoneOption = deepFreeze<NoneOption>({
  name: '无',
  summary: { ambience: '不放声景', music: '不加音乐' },
  // sound-adiasto-2022 的建议：把安静作为同样正当的选择列出来
  note: '不放声音也可以。在健康成人的研究里，听音乐或流水声的人，并不比安静休息的人更放松（证据：有限）。',
  evidence: ['sound-adiasto-2022', 'sound-thoma-2013'],
})

/* ---------- 默认组合与听声音 ---------- */

/**
 * 「听声音」两种模式的出厂默认，也是 Prefs.sounds 的初始值（data/types.ts：听声音时两种模式各自默认的背景声；
 * data/prefs.ts 的 DEFAULT_PREFS 与它相同）。只用于练习目录里的 listen 和 sleep 两项。
 * 不覆盖各练习自己的 Practice.sound：引导和呼吸练习各有默认，有几项故意不放背景声
 * （落地练习要听房间里本来的声音；正念行走在户外要听见车声，它在 v1 暂不提供）。音量不在预设里，在 Prefs.sounds[mode]。
 * 「睡前」这一组在练习页上只有听声音：睡前身体扫描 v1 不提供（practices.ts 的 V1_UNAVAILABLE、catalogueSections）。
 * 直接取练习目录里这两项的默认声音，详情页上「默认是溪流声」「默认是雨声」就不会和实际播放的对不上：
 * 放松是溪流、不加音乐（健康成人压力过后听音乐，并不比安静休息恢复得更快，sound-adiasto-2022，所以音乐由用户自己加）；
 * 睡前是雨、不加音乐，也不用棕噪声：噪声证据很弱，只在用户自己选时播放。
 */
export const SOUND_PRESETS: Readonly<Record<SoundMode, SoundPreset>> = deepFreeze({
  relax: { ...PRACTICE_BY_ID.listen.sound, mode: 'relax' },
  sleep: { ...PRACTICE_BY_ID.sleep.sound, mode: 'sleep' },
})

/** 不限时：一直播放到用户停下（与 Practice.durations 的约定一致，0 为不限时） */
export const UNLIMITED = 0

export const LISTEN: Readonly<Record<SoundMode, ListenSetup>> = deepFreeze({
  relax: {
    practiceId: 'listen',
    name: '放松',
    minutes: PRACTICE_BY_ID.listen.durations,
    defaultMinutes: PRACTICE_BY_ID.listen.defaultMinutes,
    note: '研究里多是一次听 20 分钟左右，所以默认 20 分钟。也有试验比较过 15 分钟和 30 分钟，效果没有差别，选你方便的时长就好。',
    evidence: ['sound-yang-2025', 'sound-panteleeva-2018'],
  },
  sleep: {
    practiceId: 'sleep',
    name: '睡前',
    minutes: PRACTICE_BY_ID.sleep.durations,
    defaultMinutes: PRACTICE_BY_ID.sleep.defaultMinutes,
    // 25–60 分钟出自音乐的试验，默认的雨声、噪声没有对应的研究，照实说。淡出的说法取自 safety.ts
    note: `研究里，有失眠困扰的成人每晚听音乐 25–60 分钟不等，平均 36 分钟；雨声和噪声听多久合适，没有研究可以参考。${SLEEP_SOUND_RULES.timer}`,
    evidence: ['sound-jespersen-2022'],
  },
})

/** 选「不限」时先确认（PRODUCT.md §2）。文案归 safety.ts，最后一段是婴儿的提醒（safety.notes §5、§9） */
export const UNLIMITED_CONFIRM: ConfirmCopy = SLEEP_SOUND_RULES.allNight

/** 时长选项的文字 */
export function listenLabel(minutes: number): string {
  return minutes === UNLIMITED ? '不限' : `${minutes} 分钟`
}

/* ---------- 说明文字 ---------- */

export const SOUND_COPY: Readonly<Record<SoundCopyId, CopyBlock>> = deepFreeze({
  volume: {
    title: '音量与耳机',
    // 音量、耳机、整夜播放和婴儿这几句取自 safety.ts，与练习详情页、不限时的确认一字不差
    lines: [
      `${SLEEP_SOUND_RULES.volume}一项有 144 名大学生参加的研究里，多数人觉得轻的音量更适合放松。`,
      // 世卫组织给大众的建议（safety-itu-2018 的局限一栏）
      SLEEP_SOUND_RULES.headphones,
      '按世卫组织和国际电联的安全聆听标准，成人每周听 80 分贝的声音，累计不超过 40 小时；音量每高 3 分贝，能听的时间减半。',
      // 没有证据说戴耳机睡觉有害，所以只给做法，不说风险（safety.notes §9）
      SLEEP_SOUND_RULES.placement,
      SLEEP_SOUND_RULES.infants,
    ],
    evidence: ['sound-staum-2000', 'safety-itu-2018', 'sound-who-2018', 'safety-hugh-2014'],
  },
  iosLock: {
    title: '在 iPhone 和 iPad 上锁屏，回神的声音会停',
    lines: [
      '回神在浏览器里运行。在 iPhone 和 iPad 上，锁屏或切到别的应用后，回神的声音就会停下。',
      '练习和听声音时，请让屏幕亮着。回神会尽量让屏幕保持常亮，但不是每台设备都能做到。',
      '如果屏幕还是会自动熄灭，可以打开「设置」，在「显示与亮度」里把「自动锁定」暂时改成「永不」。这样计时结束后，屏幕也不会自己熄灭，用完记得改回来。',
      '打开了低电量模式时，「自动锁定」限制为 30 秒，要先关掉低电量模式才能改。',
      // 屏幕整夜亮着、又在充电：说清手机放哪儿，免得压在枕头下充电
      '整夜播放时，屏幕会一直亮着。把亮度调低，屏幕朝下，放在离枕边远一些的地方，再接上充电器；充电时不要把手机压在身下，也不要放在枕头下或被子里。',
    ],
    evidence: [],
  },
  noHealthClaim: {
    title: '无健康声明',
    lines: [
      '「无健康声明」的意思是：我们不说这种声音比同类的声音多出什么作用。',
      '比如五声，和长音、回响一样是舒缓的音乐。有些说法把五音和五行、脏腑对应起来，这没有可靠的研究支持，我们不这样做。',
      '选不选，看你喜不喜欢它的声音。',
    ],
    evidence: ['sound-li-2025'],
  },
  dayOnly: {
    title: '为什么睡前没有鸟鸣',
    lines: ['鸟鸣是白天的声音，叫声来得突然，睡前模式里不提供。', '林间在睡前模式里只有溪水和风，不出鸟叫。'],
    evidence: [],
  },
  sleep: {
    title: '声音与睡眠',
    // 先说默认的雨声、噪声这一类，免得把音乐的结果套到它们身上
    lines: [
      '自然声和噪声能不能帮助睡眠，证据很弱；也有综述提醒，要留意持续的噪声对睡眠和听力的影响。',
      '有失眠困扰的成人每晚听音乐、坚持几周，和不听音乐相比，自评的睡眠质量可能好一些（证据：中等）；但用仪器测量睡眠的 3 项研究没有看到改善。',
      '没有睡眠障碍的成人听音乐，和不听相比，睡眠质量整体上没有明显差别；只在坚持 3 周以上的 3 项研究里看到改善（证据：有限）。',
      SLEEP_SOUND_RULES.clinic,
    ],
    evidence: ['sound-jespersen-2022', 'sound-riedy-2021', 'sound-capezuti-2022', 'sound-tang-2022'],
  },
})

/* ---------- 查询 ---------- */

const ALL: readonly AnySound[] = [...AMBIENCES, ...NOISES, ...MUSIC]
const BY_ID = new Map<AmbienceId | MusicId, AnySound>(ALL.map(s => [s.id, s]))
// 按层分开查：放错层的 id（声景里存了 'drone'）当作不认识
const AMBIENCE_BY_ID = new Map<AmbienceId, AmbienceOption>([...AMBIENCES, ...NOISES].map(s => [s.id, s]))
const MUSIC_BY_ID = new Map<MusicId, MusicOption>(MUSIC.map(s => [s.id, s]))

const fits = (s: AnySound | undefined, mode: SoundMode): boolean =>
  s !== undefined && (mode === 'relax' || s.flags.sleepOk)

const listsFor = (mode: SoundMode): SoundLists => ({
  nature: AMBIENCES.filter(s => fits(s, mode)),
  noise: NOISES.filter(s => fits(s, mode)),
  music: MUSIC.filter(s => fits(s, mode)),
})

// 每个模式只算一次：每次返回同一组数组，界面可以直接拿来比较、做依赖
const LISTS: Readonly<Record<SoundMode, SoundLists>> = deepFreeze({
  relax: listsFor('relax'),
  sleep: listsFor('sleep'),
})

/** 这个模式下可选的声音，按组、按目录顺序 */
export function soundsFor(mode: SoundMode = 'relax'): SoundLists {
  return LISTS[mode]
}

/** 这个声音能不能在这个模式里用。'none' 总是可以；不认识的 id（如旧版本存下的）不可以 */
export function isAllowed(id: AmbienceId | MusicId, mode: SoundMode = 'relax'): boolean {
  return id === 'none' || fits(BY_ID.get(id), mode)
}

/** 这个模式下怎么描述它：林间睡前没有鸟声 */
export function descriptionFor(s: AnySound, mode: SoundMode = 'relax'): string {
  return mode === 'sleep' ? (s.sleepDescription ?? s.description) : s.description
}

/**
 * 让存下的组合在这个模式里能用：'none' 和可用的 id 原样保留；其余（睡前的鸟鸣、旧版本的 id、放错层的 id）
 * 换成这个模式的默认（SOUND_PRESETS）。模式不写时看 mix.mode，再没有按放松。
 * 只返回两层的 id，音量等其他项由调用方自己保留：{ ...mix, ...fitMix(mix) }
 */
export function fitMix(
  mix: Pick<SoundMix, 'ambience' | 'music' | 'mode'>,
  mode: SoundMode = mix.mode ?? 'relax',
): Pick<SoundMix, 'ambience' | 'music'> {
  const preset = SOUND_PRESETS[mode]
  return {
    ambience:
      mix.ambience === 'none' || fits(AMBIENCE_BY_ID.get(mix.ambience), mode)
        ? mix.ambience
        : preset.ambience,
    music: mix.music === 'none' || fits(MUSIC_BY_ID.get(mix.music), mode) ? mix.music : preset.music,
  }
}

/** 按 id 找目录里的声音；'none' 和不认识的 id 为 undefined */
export function findSound(id: AmbienceId | MusicId): AnySound | undefined {
  return BY_ID.get(id)
}

/** 声音的中文名，'none' 为「无」；不认识的 id 为 undefined */
export function soundName(id: AmbienceId | MusicId): string | undefined {
  return id === 'none' ? NONE.name : BY_ID.get(id)?.name
}
