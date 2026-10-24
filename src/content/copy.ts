/**
 * 界面文案：各页面的短句、标签和说明都放在这里，方便审读的人在一处看完。
 * 别的文件已经有的不在这里重复：引导词在 scripts/，计划说明在 programs/，练习的名称、介绍和证据在 practices.ts，
 * 声音的名称、说明和锁屏提示在 sounds.ts，安全须知、停止指引、练完感觉、求助电话和免责声明在 safety.ts。
 *
 * 写法（PRODUCT.md §11）：你称；短句；全角标点；中文与数字、拉丁字母之间留一个空格；
 * 不用感叹号、表情、最高级和空泛的鼓励；说到效果时写明证据和比较对象。术语固定：正念、专注呼吸、开放觉察、
 * 身体扫描、慈心、自我关怀、数息、慢呼吸、周期性叹息、箱式呼吸、回神。函数只往固定的句子里填数字或名字。
 *
 * 日期和数字（DESIGN.md §4.4、§4.5）：日历上的日期写在一起，不加空格（「2026年10月」「5月1日起」，
 * 具体的日子由 lib/date 生成）；数量照常留空格（「8 周」「3 天」）。带「次/分」的呼吸频率一律保留一位小数（「6.0 次/分」）。
 * copy.test.ts 的内容检查会扫 src/content 下的全部文件。
 *
 * 各页的新说法按 DESIGN.md §14.3 补齐。为了不打断正在按现有接口写界面的人，旧键只增不改；
 * 和旧键同名、但旧键已经是一句话的分组，换了名字：PLAYER.unwellSheet（「不舒服？」面板）、PLAYER.pausePanel（暂停面板）。
 *
 * v1 没有语音引导（PRODUCT.md §0，2026-10-23 决定）：引导是屏幕上一句一句的文字。语音的设置和提示都删了
 * （SETTINGS.voice、PLAYER.notices.voiceUnavailable，界面上没有用到）；引导详细程度和「新的一句出现时轻提示」
 * 在 SETTINGS.guidance，怎样跟着文字练在 GUIDANCE_HOWTO。正念行走和睡前身体扫描 v1 不提供（practices.ts 的 V1_UNAVAILABLE）。
 */
import type { SoundMode } from '@/audio/types'
import type { DayPart } from '@/lib/date'
import type { CatalogPracticeId } from './practices'
import type { Grade, GuidanceLevel, ProgramId } from './types'

const HAN = /\p{Script=Han}/u
const ALNUM = /[A-Za-z0-9]/

/** 拼接两段文字：一边是汉字、一边是数字或拉丁字母时，中间留一个空格 */
function join(a: string, b: string): string {
  const x = a.slice(-1)
  const y = b.slice(0, 1)
  const gap = (HAN.test(x) && ALNUM.test(y)) || (ALNUM.test(x) && HAN.test(y))
  return gap ? `${a} ${b}` : a + b
}

/** 秒数等一般的数：4.5、6，最多一位小数，不写多余的 0 */
const decimal = (x: number): string => x.toFixed(1).replace(/\.0$/, '')

/** 呼吸频率：带「次/分」时一律一位小数，5.5、6.0（DESIGN.md §4.5），同一列的数字才对得齐 */
const rateText = (x: number): string => `${x.toFixed(1)} 次/分`

const minutesText = (n: number): string => `${Math.round(n)} 分钟`

const daysAndMinutes = (days: number, minutes: number): string =>
  `${Math.round(days)} 天 · ${minutesText(minutes)}`

/** 筛选里的「全部」，练习页和依据页共用 */
const ALL = '全部'

/** 指向依据页的链接 */
const ALL_EVIDENCE = '全部依据'

/** 今日页和计划页上，每周压力自评的入口 */
const WEEKLY_STRESS = '本周压力自评'

/** 不足 1 分钟的练习不记录：小结和结束确认里都这样说 */
const NOT_RECORDED = '不足 1 分钟，这次不记录。'

/** 依据每年复核一次（ux-nice-2022-esf）。日历上的月份写在一起 */
const REVIEWED_ON = '2026年10月'
const NEXT_REVIEW = '2027年10月'

/** 证据等级的名字（content/types.ts 的 Grade）。写在效果后面：「可能有一点帮助（证据：中等）」 */
export const GRADE_NAMES = {
  A: '强',
  B: '中等',
  C: '有限',
  D: '不足',
} as const satisfies Record<Grade, string>

/* ---------- 首次使用 ---------- */

/** 首次使用（/welcome）：回神是什么，三句；隐私承诺。之后是 safety.ts 里的「开始之前」 */
export const WELCOME = {
  /** 与 package.json、PWA 清单里的描述一致 */
  tagline: '依据研究设计的冥想、呼吸与声音练习',
  /** 第二句解释名字，说法与专注呼吸的引导词一致（meditation-hasenkamp-2012） */
  lines: [
    '冥想、呼吸和声音练习，多数在 10 分钟以内。',
    '心会走神，这很自然。发现了，再回来，这一下就叫回神。',
    '每个默认设置都写明依据；没有研究的地方，也照实说。',
  ],
  /** PRODUCT.md §0：自我练习工具，不是治疗 */
  scope: '回神是自我练习的工具，不能替代医生、心理治疗或药物。',
  privacy: {
    title: '你的数据',
    lines: ['不用注册账号。', '练习记录只保存在这台设备上，我们看不到。', '应用里没有统计、广告和追踪代码。'],
  },
  /** 第一次练习用一分钟停一停（ux.notes §2：60 秒内开始第一次练习） */
  start: '先练 1 分钟',
  browse: '看看全部练习',
} as const

/* ---------- 文字引导 ---------- */

/**
 * 怎样跟着文字练（PRODUCT.md §0、§5）：练习详情页上，有引导词的练习（专注呼吸、数息和各项引导练习）在「做法」下面显示；
 * 播放器第一次打开这类练习时，也在练习名下面显示一次（不显示 intro，引导已经在眼前）。
 * 句子按 practices.ts 的 adjustedDefaults(…).eyesOpen 选：数息、应对版和落地练习本来就睁着眼做，健康情况检查
 * 也可能建议睁眼，这时用 eyesOpen，不提闭眼。轻响一声的开关是 SETTINGS.guidance.captionCue，默认打开
 */
export const GUIDANCE_HOWTO = {
  intro: '引导是屏幕上一句一句出现的文字，没有语音。',
  closable:
    '目光放低，落在屏幕上就好。安静的时候可以闭上眼睛；新的一句如果隔了 20 秒以上才出现，会轻响一声，听到再看屏幕。',
  eyesOpen: '目光放低，落在屏幕上就好。这项练习全程睁着眼睛做。',
} as const

/* ---------- 今日 ---------- */

/**
 * 按时段推荐时写在练习名上方。只写时段、不写功效，因为练习时间对效果的影响，没有找到研究。
 * 都是一天里的时段，不写「今晚」「睡前」：深夜的推荐本身就叫「听声音 · 睡前」，再写睡前就重复了
 */
const SLOT_LABELS = {
  morning: '早上',
  midday: '午间',
  afternoon: '下午',
  evening: '晚上',
  night: '夜里',
} as const satisfies Record<DayPart, string>

/** 今日页（PRODUCT.md §4）。推荐什么、按什么顺序，见 today.ts */
export const TODAY = {
  title: '今日',
  /** 距上次练习满 3 天时的第一行。不写隔了几天（ux-buyalskaya-2023） */
  welcomeBack: '欢迎回来。先做 1 分钟？',
  slots: SLOT_LABELS,
  change: '换一个',
  start: '开始',
  /** 「5 分钟」 */
  minutes: minutesText,
  /** 计划里的练习：这一天的、保底日的、可选的。漏了的日子不提（PRODUCT.md §3） */
  program: {
    day: (title: string, week: number, day: number): string => `${title} · 第 ${week} 周第 ${day} 天`,
    short: (title: string): string => `${title} · 保底日`,
    extra: (title: string): string => `${title} · 可选练习`,
    newWeek: (week: number): string => `第 ${week} 周的第一天。练习前，先读一读本周说明，约 1 分钟。`,
    doneToday: '今天的计划练完了。',
    next: (week: number, day: number): string => `下次是第 ${week} 周第 ${day} 天。`,
  },
  /**
   * 「只有几分钟」。structure 是行里显示的结构，与引导词的段落或节拍的几步一致；hint 是读屏读的说明（aria-describedby），
   * 与引导词里的做法一致
   */
  quick: {
    title: '只有几分钟',
    pause: {
      label: '一分钟停一停',
      structure: '停 · 吸 · 观 · 行',
      hint: '停下手头的事，吸一口气，留意此刻，再接着做。',
    },
    breathingSpace: {
      label: '三分钟呼吸空间',
      structure: '觉察 · 集中 · 扩展',
      hint: '先觉察此刻，再集中到呼吸，最后扩展到全身。',
    },
    cyclicSigh: {
      label: '周期性叹息',
      structure: '鼻吸 · 补吸 · 长呼',
      hint: '用鼻子轻轻吸到七八成满，再补一小口，然后用嘴慢慢呼完。',
    },
    /**
     * 健康情况检查不建议周期性叹息时（如惊恐发作），换成轻而慢的慢呼吸；hint 的后半句就是呼吸练习开头的那一句。
     * 每分钟 6 次、呼气更长，约吸 4 秒、呼 6 秒（practices.ts 的 LIGHT_SLOW_PACE）
     */
    lightSlow: {
      label: '慢呼吸',
      structure: '吸 4 秒 · 呼 6 秒',
      hint: '每分钟 6 次，轻柔地呼吸，不必吸得很深。',
    },
  },
  /**
   * 「现在有点难」：都是睁着眼也能做的短练习，最后是求助方式。难受的人最常来这里，
   * 所以开头就说有伤害自己的念头时去哪里（safety.notes §8）
   */
  hard: {
    title: '现在有点难',
    /**
     * 今日页上这一行的提示（DESIGN.md §13.2）。这是默认的面板；按健康情况换了练习或顺序时，
     * 用 today.ts 的 hardMoment(…).rowHint，那里按同样的写法拼出来
     */
    rowHint: '周期性叹息 · 落地练习 · 求助电话',
    /** rowHint 的最后一项 */
    phones: '求助电话',
    intro: '选一个就好。练着更难受，随时可以停下。有伤害自己的念头，请打开「求助方式」。',
    sigh: { label: '周期性叹息', hint: '用鼻子轻轻吸到七八成满，再补一小口，然后用嘴慢慢呼完。' },
    coping: {
      label: '三分钟呼吸空间 · 应对版',
      hint: '给此刻的感受起个名字，找到它在身体的哪里，再回到呼吸或双脚。',
    },
    grounding: {
      label: '落地练习',
      duration: '60 秒',
      hint: '睁着眼睛，踩稳双脚，看看四周，把注意力放到身体外面。',
    },
    lightSlow: { label: '慢呼吸', hint: '每分钟 6 次，轻柔地呼吸，不必吸得很深。' },
    help: { label: '求助方式', hint: '心理援助热线和急救电话，不联网也能打开。' },
  },
  /** 本周：练习天数和分钟数，下面是周一到周日七个点 */
  week: { title: '本周', value: daysAndMinutes },
  /** 推荐专注呼吸时，空的回神时间线下面的一句 */
  focusCaption: '每次回神，留一道竖线。',
  /** 打开了每周压力自评、这周还没答时，「本周」一行右边的链接（DESIGN.md §13.7） */
  weeklyStress: WEEKLY_STRESS,
} as const

/* ---------- 练习 ---------- */

/**
 * 练习页（DESIGN.md §13.3）。分组、顺序和按健康情况隐藏的练习见 practices.ts 的 catalogueSections；
 * 分类名是 practices.ts 的 CATEGORY_LABEL，前面加 all
 */
export const CATALOGUE = {
  title: '练习',
  all: ALL,
  /** 页头的说明：前半是练习页上列出的练习数（catalogueSections 里的项数，v1 不提供的不算），后半说明右边的时长 */
  folio: (n: number): string => `${Math.round(n)} 项练习`,
  folioEnd: '时长为默认值',
  /** 每一类标题右边的项数 */
  count: (n: number): string => `${Math.round(n)} 项`,
  /** 时长不固定的一行，如舒适节律探索「约 7 分钟」 */
  about: (minutes: number): string => `约 ${minutesText(minutes)}`,
  programs: {
    title: '计划',
    /** 漏了的日子不补，也不往后排，练完一天才算一天 */
    aside: '按完成的天数推进',
    /** 没开始的计划，行里写这一句 */
    plan: {
      'mindfulness-8w': '每周一个主题，每天 5–10 分钟',
      'breathing-4w': '节律逐周放慢，每天 5–10 分钟',
    } satisfies Record<ProgramId, string>,
    inProgress: (week: number, day: number): string =>
      `进行中 · 第 ${Math.round(week)} 周第 ${Math.round(day)} 天`,
    finished: '已完成 · 可以重新开始',
    /** 行的右边，如「8 周」 */
    weeks: (n: number): string => `${Math.round(n)} 周`,
  },
  /** 名称后面那个字母的读屏说法 */
  gradeLabel: (grade: Grade): string => `证据等级 ${grade}，${GRADE_NAMES[grade]}`,
  /** 页尾的说明，下面是 allEvidence 链接 */
  legend:
    '名称后的字母是证据等级：A 强、B 中等、C 有限、D 不足，只针对练习说明里写到的那个效果。静坐计时和舒适节律探索是工具，不评等级。',
  allEvidence: ALL_EVIDENCE,
  settingsSafety: '设置 › 安全',
  /** 按健康情况隐藏了练习时，这一类的最后写这一句；names 是被隐藏的练习名 */
  hidden: (names: readonly string[]): string =>
    `根据健康情况检查，隐藏了${names.join('、')}。可以在设置 › 安全里修改。`,
} as const

/* ---------- 练习详情 ---------- */

/** 练习详情页（DESIGN.md §13.4）。练习的名称、介绍、做法、结论和安全提示在 practices.ts */
export const DETAIL = {
  sections: { how: '做法', settings: '设置', evidence: '依据', safety: '安全' },
  /** 「做法」右边：「3–20 分钟，默认 5 分钟」；只有一种时长时只写它 */
  durations: (min: number, max: number, defaultMinutes: number): string =>
    min === max ? minutesText(defaultMinutes) : `${min}–${max} 分钟，默认 ${minutesText(defaultMinutes)}`,
  /** 「设置」右边 */
  settingsAside: '改动会记住',
  sessionOnly: '只用于本次练习。',
  boxPhase: '每步（秒）',
  /** 只有数字的分段选择，单位写在标签里 */
  durationLabel: '时长（分钟）',
  /** 数息 15 分钟那一格下面的小字：想前后比较，每次都选 15 分钟 */
  measureLabel: '测量版',
  allEvidence: ALL_EVIDENCE,
  /**
   * 有引导词的练习，「做法」下面的一段：引导是屏幕上的文字，怎样边看边练。先 intro，
   * 再按 adjustedDefaults(…).eyesOpen 选 eyesOpen 或 closable
   */
  guidance: GUIDANCE_HOWTO,
  /**
   * v1 暂不提供的练习（practices.ts 的 V1_UNAVAILABLE：正念行走、睡前身体扫描）从旧链接打开详情页时，
   * 代替开始按钮的一句。两项都要边走边练或闭着眼练，等真人录音（PRODUCT.md §2）
   */
  notOffered: '这项练习不方便看着屏幕做，等请老师录好语音引导后再提供。',
  /** 示意图的编号，后面接 figureCaption */
  figure: '图 1',
  /**
   * 各练习示意图下面的说明（DESIGN.md §13.4）。图按默认时长画：慢呼吸画默认节律的 3 轮；
   * 身体扫描画台阶图，其他引导练习画分段条，每一段的长短就是它占的时间
   */
  figureCaption: {
    focus: '横线是练习的时长；每次回神，线上留一道竖线。',
    'breath-count': '1–8 点左边，第 9 口气点右边。',
    'body-scan': '先感受呼吸，再从左腿开始一处处往上，最后是全身。每一级的长短，是这一处的时间。',
    'breathing-space': '三段：觉察、集中、扩展。每一段的长短，是它占的时间。',
    'loving-kindness': '祝愿先给亲近的人和自己，再扩大到所有生命。每一段的长短，是它占的时间。',
    'self-compassion': '先想一件小事，再对自己说三句话，中间有一段安抚的触碰。每一段的长短，是它占的时间。',
    'open-awareness': '从呼吸开始，放宽到身体、声音、想法和情绪。每一段的长短，是它占的时间。',
    walking: '先站稳，再放慢脚步、留意脚底，最后站定。每一段的长短，是它占的时间。',
    pause: '四段：停、吸、观、行，一共 1 分钟。',
    timer: '开始和结束各有钟声；间隔钟声默认关闭。',
    slow: '默认节律的 3 轮，约 33 秒。曲线升高是吸气，降低是呼气。',
    'cyclic-sigh': '可选节拍的一轮 10.5 秒：吸 2.5 秒，再吸 1 秒，呼 7 秒。曲线升高是吸气，降低是呼气。',
    box: '默认一轮 16 秒：吸、停、呼、停，各 4 秒。曲线平的两段是停。',
    'pace-finder': '5 档，每档 1 分钟，从每分钟 6.5 次慢到 4.5 次。',
    listen: '音量保持不变，最后 1 分钟慢慢淡出。',
    sleep: '音量保持不变，最后 2 分钟慢慢变轻，直到停下。',
    'body-scan-sleep': '先感受呼吸，再从头部开始一处处往下，最后是全身。每一级的长短，是这一处的时间。',
    'breathing-space-coping': '三段：觉察、集中、扩展。每一段的长短，是它占的时间。',
    grounding: '60 秒：踩稳双脚，看看四周，听听声音。',
  } satisfies Record<CatalogPracticeId, string>,
  /** 慢呼吸的设置（PRODUCT.md §2；breathing-shaffer-2020） */
  slow: {
    rate: '节律',
    /** 「舒适节律探索」做成链接 */
    rateHint: '成人适合的慢呼吸节律，多在每分钟 4.5–6.5 次之间。憋得慌就调快一点，也可以用舒适节律探索来选。',
    ratio: '吸与呼',
    /** 呼气更长的一格，秒数随节律变：「吸 4.5 · 呼 6.5」 */
    ratioLong: (inhale: number, exhale: number): string => `吸 ${decimal(inhale)} · 呼 ${decimal(exhale)}`,
    ratioEqual: '等长',
    ratioLongLabel: '呼气更长',
    /** 两项研究里，吸呼 1∶1 和 1∶2 的心率变异性没有差别（breathing-shaffer-2020） */
    ratioHint: '两种比例在研究里差别不大，选呼吸更舒服的一种。',
    warmup: '开头 90 秒逐步放慢',
    /** 两轮放慢 0.5 次：从 8 次到默认的 5.5 次约 87 秒（engine/pace.ts） */
    warmupHint: '从每分钟 8 次开始，每两轮慢 0.5 次，直到你选的节律；放慢到默认的 5.5 次，约需 90 秒。',
  },
} as const

/* ---------- 播放器 ---------- */

/** 播放器（PRODUCT.md §5）。节拍的大字「吸」「再吸」「停」「呼」在 engine/patterns.ts */
export const PLAYER = {
  pause: '暂停',
  resume: '继续',
  end: '结束',
  sound: '声音',
  /** 打开停止指引、60 秒落地练习和求助方式；内容在 safety.ts。也是那个面板的标题和按钮的读屏名称 */
  unwell: '不舒服？',
  /** 手机竖着拿时，第三个控件上显示的字；读屏仍读 unwell（DESIGN.md §8.15.15） */
  unwellShort: '不舒服',
  /**
   * 「不舒服？」面板（DESIGN.md §8.15.17）。标题是 unwell；停止指引、急救的那一句和求助电话在 safety.ts。
   * 「结束练习」不再弹确认：练满 60 秒照常记录，小结只问练完感觉
   */
  unwellSheet: {
    /** 后面接 STOP_GUIDANCE.short */
    paused: '练习已暂停。',
    /** 「停下以后：」那一行右边，链到 /help#stop */
    fullGuidance: '停止指引全文',
    endPractice: '结束练习',
  },
  paused: '已暂停',
  /**
   * 暂停面板（DESIGN.md §8.15.16）：标题 paused，下面一行「已练 03:45 · 还剩 06:15」，
   * 时间用 lib/time 的 fmtClock。keys 只在用鼠标、触控板的设备上显示（§10.2）
   */
  pausePanel: {
    elapsed: '已练',
    left: '还剩',
    meta: (elapsed: string, left: string): string => `已练 ${elapsed} · 还剩 ${left}`,
    keys: '键盘：空格继续练习，Esc 关闭面板并继续。',
  },
  /**
   * 点「结束」时的确认（DESIGN.md §8.15.15）。练满 60 秒时正文用 recorded，duration 用 lib/time 的 fmtMinutes，
   * 如「6 分钟」；不足 60 秒时用 notRecorded。开头倒数时结束不弹确认
   */
  endDialog: {
    title: '结束这次练习？',
    recorded: (duration: string): string => `已练 ${duration}，会记在记录里。`,
    notRecorded: NOT_RECORDED,
    cancel: '继续练习',
    confirm: '结束',
  },
  /** 开头倒数时 */
  leadIn: '准备',
  /** 结尾静默开始时：背景声在淡出，接下来是安静和结束钟声 */
  silentEnding: '背景声慢慢淡出，安静一会儿，然后是结束钟声。',
  silentEndingNoBell: '背景声慢慢淡出，最后留一会儿安静。',
  controls: '练习控制',
  close: '关闭',
  unlimited: '不限时',
  units: { seconds: '秒', rate: '次/分', rounds: '轮', times: '次' },
  /** 控件上方读数的标签（DESIGN.md §8.15.4）。引导练习的「这一处还剩」在 guided.sectionLeft */
  readouts: {
    left: '剩余',
    rate: '节律',
    rounds: '轮数',
    step: '每步',
    next: '下一处',
    sat: '已坐',
    nextBell: '下次钟声',
  },
  focus: {
    mark: '回神',
    /**
     * @deprecated 改用 markHintTouch / markHintKeys：触屏上不该出现按键的说明，用鼠标时也不该说「轻点屏幕」（DESIGN.md §10.2）
     */
    markHint: '也可以轻点屏幕或按空格',
    /** 「回神」键下面的小字，触屏 */
    markHintTouch: '也可以轻点屏幕的任何地方',
    /** 用鼠标、触控板的设备；后面跟一个键帽 markKey */
    markHintKeys: '也可以按',
    markKey: '空格',
    /** 读屏软件读到「回神」按钮时的说明 */
    markHelp: '发现走神时点一下，然后回到呼吸。',
  },
  count: {
    breath: '1–8',
    ninth: '9',
    /** 两个键上数字下面的小字 */
    breathCaption: '第 1–8 口气',
    ninthCaption: '第 9 口气',
    reset: '数乱了',
    hint: '第 1 到第 8 口气点左边，第 9 口气点右边。数乱了就点下面，从 1 重新数。练习中不显示计数。',
    /** 用鼠标、触控板的设备上，键的下面（DESIGN.md §10.2） */
    keys: '也可以按 F 或 ← 记 1–8，J 或 → 记 9，退格键是数乱了。',
  },
  paced: {
    figure: '跟随呼吸节拍的曲线',
    boxFigure: '跟随呼吸节拍的方框',
    next: '{seconds} 秒后{phase}',
    phaseActions: { in: '吸气', in2: '再吸', hold: '停', out: '呼气', rest: '停' },
    side: '{phase} {seconds} 秒',
    hurry: '有点急',
    /** engine/pace.ts 的 stepBack：从下一轮起加快 0.5 次，保持到结束；记住速度由应用层负责（PRODUCT.md §2） */
    hurryHelp:
      '节拍太慢、总想提前吸气时，点一下。从下一轮起，每分钟多呼吸 0.5 次，一直到练习结束；下次练慢呼吸，也从这个速度开始。',
    /** 「有点急」左边的说明（DESIGN.md §8.15.3） */
    hurryHint: '点一下，每分钟加快 0.5 次',
    /** 点过以后显示 3 秒，代替 hurryHint */
    hurried: (rate: number): string => `已加快到 ${rateText(rate)}`,
    /** 到了上限、按钮不能再点时 */
    hurryMax: (rate: number): string => `已到上限：${rateText(rate)}`,
    rate: (rate: number): string => rateText(rate),
    round: (n: number): string => `第 ${Math.round(n)} 轮`,
    /** 周期性叹息的曲线下面，代替「有点急」；与它做法里的说法一致 */
    selfPaced: '节拍只是参考，可以按自己的快慢来。',
  },
  guided: {
    skip: '跳过这一处',
    /** 跳过时，引擎把后面的时间整体提前，练习随之早结束 */
    skipHelp: '不想停在这一处，可以直接进到下一处，练习也会相应早一点结束。',
    /** 读数的标签：这一段还剩多少时间（DESIGN.md §8.15.4） */
    sectionLeft: '这一处还剩',
    /** 段落标题上面的一行：能跳过的部位写第几处，其余的写段落名 */
    where: (n: number, total: number): string => `现在 · 第 ${Math.round(n)} 处，共 ${Math.round(total)} 处`,
    now: (title: string): string => `现在 · ${title}`,
    /**
     * 第一次打开有引导词的练习时，练习名下面显示一次（DESIGN.md §13.5.9 的单次提示）：
     * 按 adjustedDefaults(…).eyesOpen 选 eyesOpen 或 closable，不用 intro
     */
    howTo: GUIDANCE_HOWTO,
  },
  notices: {
    /** 正念行走开始后的前 10 秒，显示在练习名下面。v1 不提供正念行走（V1_UNAVAILABLE），留到有录音时用 */
    walking: '睁着眼睛，在安全、平坦的地方走。',
    /** 浏览器拦下声音时，练习静音继续（engine/session.ts 的 AUDIO_START_GRACE_MS） */
    audioBlocked: '声音没能开始，练习照常进行。',
    audioRetry: '再试一次',
    awake: '练习时，屏幕会保持常亮。',
    awakeUnsupported:
      '这个浏览器不能让屏幕保持常亮，练习中屏幕可能自动熄灭。可以先在系统设置里，把自动锁定的时间调长一些。',
    /** 一句话版本，用在播放器和第一次听睡前声音之前；完整说明是 sounds.ts 的 SOUND_COPY.iosLock，说法与它一致 */
    iosLock: '在 iPhone 和 iPad 上，锁屏或切到别的应用后，回神的声音就会停下。练习时请让屏幕亮着。',
  },
} as const

/* ---------- 练习后 ---------- */

/**
 * 练习后的小结（PRODUCT.md §6）。练完感觉、选了「很不舒服」之后的说明、反复不适时换更温和的练法，
 * 都在 safety.ts 的 AFTER_PRACTICE
 */
export const SUMMARY = {
  title: '这次练习',
  /** 右上角的关闭按钮，读屏读这一句；和「完成」一样 */
  close: '关闭小结，回到今日',
  /** duration 用 lib/time 的 fmtMinutes，如「10 分钟」 */
  practiced: (duration: string): string => `练了 ${duration}`,
  endedEarly: '提前结束了，练过的时间照样记下。',
  notRecorded: NOT_RECORDED,
  week: (days: number, minutes: number): string => `本周累计 ${daysAndMinutes(days, minutes)}`,
  weekLabel: '本周累计',
  marks: (n: number): string => `回神 ${Math.round(n)} 次`,
  /** 这次练习的回神时间线下面 */
  marksCaption: '每一道竖线是一次回神。',
  marksNote: '次数多少没有好坏。',
  /** 慢呼吸里点过「有点急」时，接在轮数和节律后面 */
  hurried: (rate: number): string => `有点急 · 加快到 ${rateText(rate)}`,
  /** 静坐计时的一行；没开间隔钟声时只写时长 */
  timer: (minutes: number, bells: number): string =>
    bells > 0
      ? `静坐 ${minutesText(minutes)} · 间隔钟声 ${Math.round(bells)} 次`
      : `静坐 ${minutesText(minutes)}`,
  count: (correct: number, errors: number, resets: number): string =>
    `数对 ${Math.round(correct)} 轮 · 数错 ${Math.round(errors)} 轮 · 数乱了 ${Math.round(resets)} 次`,
  invalid: (n: number): string => `另有 ${Math.round(n)} 轮点得过快，不计入`,
  /** rate 用 PLAYER.paced.rate 写好 */
  breaths: (rounds: number, rate: string): string => `${Math.round(rounds)} 轮 · ${rate}`,
  /** 0–10 点选，不预选，可跳过；问练习后时不显示练习前的分数（ux-abend-2014）。睡前声音之后不问 */
  checkin: {
    question: '此刻有多紧张？',
    low: '一点也不',
    high: '非常紧张',
    skip: '跳过',
    before: '练习前',
    after: '练习后',
  },
  note: { label: '备注', placeholder: '可以写一句，比如：走神多，一直在想工作。' },
  done: '完成',
  again: '再来一次',
  timeRange: '{month}月{day}日 {start}–{end}',
  saveFailed: '没有保存成功，请再试一次。',
} as const

/* ---------- 记录 ---------- */

/** 记录页（PRODUCT.md §7） */
export const RECORDS = {
  title: '记录',
  month: '{month}月',
  yearMonth: '{year}年{month}月',
  dayUnit: '天',
  date: '日期',
  practice: '练习',
  duration: '时长',
  detail: '这次练习',
  noData: '还没有这项练习的数据。',
  hide: '收起',
  deleted: '已删除这条记录。',
  undo: '撤销',
  cancel: '取消',
  deleteRecord: '删除这条记录',
  failed: '没有完成操作，请再试一次。',
  complete: '已完成',
  early: '提前结束',
  skipped: '跳过的段落',
  params: '练习参数',
  planned: '计划时长',
  hrvFields: { meanHr: '平均心率（次/分）', rmssd: 'RMSSD（毫秒）', amplitude: '心率起伏幅度' },
  paramLabels: {
    rate: '节律',
    ratio: '吸与呼',
    cycle: '每轮（秒）',
    phase: '每步（秒）',
    inhale: '吸气（秒）',
    holdIn: '吸后停顿（秒）',
    exhale: '呼气（秒）',
    holdOut: '呼后停顿（秒）',
    level: '引导详细程度',
    interval: '间隔钟声',
    mode: '声音模式',
    step: '探索档位',
    program: '计划',
    programDay: '计划进度',
  },

  heartRate: '平均心率',
  exportHelp: '练习记录和每周自评会一同导出。',
  /** 页头的说明：前半是日期范围（lib/date）和 sessions，后半是 local（DESIGN.md §13.7） */
  local: '只在这台设备上',
  sessions: (n: number): string => `${Math.round(n)} 次练习`,
  /** 概览里天数是大字，分钟数写在下面 */
  totalMinutes: (minutes: number): string => `共 ${minutesText(minutes)}`,
  empty: { title: '还没有练习记录', body: '练满 1 分钟的练习，会自动记在这里。' },
  /** 没有记录时，空状态下面唯一的链接，去「练习」 */
  goPractice: '去练习',
  week: { title: '本周', value: daysAndMinutes },
  /**
   * 概览下面默认收起的说明。偶尔漏一天不影响习惯（ux-lally-2010）；突出「连续中断」会让人练得更少，
   * 比不显示还少（ux-silverman-2023）
   */
  streakNote: {
    title: '为什么不显示连续天数',
    body: '偶尔漏掉一天，几乎不影响习惯的养成；「连续」一旦断掉，反而容易让人放弃。所以这里只记练过的日子，不数断了几天。',
    source:
      'Lally 等 2010 · European Journal of Social Psychology；Silverman 与 Barasch 2023 · Journal of Consumer Research',
    evidence: ['ux-lally-2010', 'ux-silverman-2023'],
  },
  /** 月历的前后翻页按钮，读屏读这两个 */
  prevMonth: '上个月',
  nextMonth: '下个月',
  /** 月历点阵的说明；没练的日子不标红 */
  calendar: '练过的日子是实心点，没练的日子留空。',
  byPractice: {
    title: '各练习',
    row: (sessions: number, minutes: number): string =>
      `${Math.round(sessions)} 次 · ${minutesText(minutes)}`,
  },
  /** 专注呼吸的回神次数，中性显示（meditation-hasenkamp-2012） */
  focus: {
    title: '回神次数',
    unit: '每 10 分钟',
    plotLabel: '每 10 分钟回神次数，{n} 次练习，范围 {min}–{max} 次。次数多少没有好坏。',
    note: '次数多少没有好坏，更常发现走神也可能说明觉察更敏锐。',
  },
  /**
   * 数息（meditation-levinson-2014、meditation-wong-2018、meditation-treves-2025）。不叫「正念分数」。
   * 准确率与 data/stats.ts 的 countAccuracy 相同：PRODUCT.md §7 的 1 −（错的第 9 次 + 数乱了）÷（全部第 9 次 + 数乱了），
   * 点得过快的轮次两边都不算
   */
  count: {
    title: '数息练习数据',
    notEnough: '练满 3 次后显示趋势。同一个人每次的结果起伏不小，单看一次说明不了多少。',
    /** 趋势线右边那个准确率下面的小字 */
    latest: '最近一次',
    accuracy: '准确率',
    resets: '数乱了',
    /** explain 收在这个展开项里 */
    howCounted: '怎么算的',
    explain: [
      '一轮从 1 数到 9，前 8 口气点左边，第 9 口气点右边。点右边之前正好点了 8 下左边，这一轮就算数对。',
      '准确率 = 数对的轮数 ÷（数对的轮数 + 数错的轮数 + 「数乱了」的次数）。「数乱了」也算一次没数对。',
      '「数乱了」单独列出，因为那是你自己发现的走神。没有察觉的数错，研究发现与注意力短暂中断有关。',
      '点得过快的轮次不计入。一轮里平均每次点击间隔不到 1.5 秒，就不像是跟着呼吸点的。',
      '这不是正念分数。研究发现，数得准不准和自评的正念程度关系很弱；同一个人隔一周再测，结果也会有不小的出入，所以要看几次下来的趋势。',
    ],
  },
  /** 练习前后的自评（ux-goldberg-2022） */
  checkin: {
    title: '练习前后自评',
    tag: '自评',
    notEnough: '练习前后都自评满 5 次后，这里显示中位数和点图。',
    before: '练习前',
    after: '练习后',
    median: '中位数',
    plotLabel: '练习前后自评（0–10）：练习前中位数 {pre}，练习后中位数 {post}，各 {n} 次。',
    noise: '前后相差 1 分以内，算作没有变化，因为自评本身就有这么大的误差。',
    caveat: '变化也包含休息本身、期待和测量误差，不能证明是练习带来的。',
  },
  /**
   * 每周压力自评（DESIGN.md §13.7；ux-elo-2003）：改编自已验证的单题量表，只用于比较人群，中文版没有单独验证。
   * 回答时只有题目、1–5 和两端的说明，不给结果、分数和评价；回答以后只说「已记下。」
   */
  weeklyStress: {
    title: '每周压力自评',
    plotLabel: '每周压力自评：{points}。',
    pointLabel: '{date}，{score} 分',
    tag: '自评',
    /** 今日页和计划页上的入口 */
    prompt: WEEKLY_STRESS,
    /** 计划页那一行的说明 */
    rowHint: '一道题，1–5',
    question: '这些天你的压力有多大？',
    low: '1 很小',
    high: '5 很大',
    skip: '跳过',
    /** 回答后的提示 */
    saved: '已记下。',
    /** 计划页上答过的那一行，不显示分数 */
    answered: '已记下',
    notEnough: '答满 3 周后，这里显示每周的点。',
    caveat: '这道题在研究里用来比较人群，放到一个人身上只能作参考；中文版还没有单独验证。',
  },
  list: {
    title: '每次练习',
    delete: '删除',
    confirmDelete: '删除这条记录？删除后无法恢复。',
    /** 先显示最近几条，按一下再显示更早的 */
    showEarlier: (n: number): string => `显示更早的 ${Math.round(n)} 次`,
  },
  export: '导出',
} as const

/* ---------- 计划 ---------- */

/**
 * 计划页（DESIGN.md §13.10）。计划的名字、介绍、每周的说明和提示在 programs/；
 * 今日页上计划那一行的说法在 TODAY.program
 */
export const PROGRAM = {
  join: '加入计划',
  day: '第 {week} 周第 {day} 天',
  leave: '退出计划',
  main: '主练习',
  long: '20 分钟版',
  choose: '今天练什么',
  finished: '这个计划已完成。可以回看各周说明，或重新开始。',
  joined: '按完成的天数推进，练完一天，再接着下一天。',
  readingTime: '约 1 分钟',
  paired: '主练习分两段：先做 5 分钟专注呼吸，再做 5 分钟自我关怀。忙的时候，只做自我关怀也算这一天。',
  second: '接下来做自我关怀，5 分钟。',
  leaveDialog: {
    title: '退出这个计划？',
    body: '计划进度会移除，练习记录保留。以后可以重新加入。',
    confirm: '退出计划',
    cancel: '取消',
  },

  /** 标题上面：「计划 · 8 周」 */
  kicker: (weeks: number): string => `计划 · ${Math.round(weeks)} 周`,
  /** 介绍只先显示前两句 */
  more: '展开全文',
  /** 本周一节的标题：「第 3 周 · 身体扫描」 */
  week: (n: number, title: string): string => `第 ${Math.round(n)} 周 · ${title}`,
  /** 本周说明的展开项 */
  reading: '本周说明',
  /** 本周的几项练习，行里的说明 */
  roles: { short: '保底日', extra: '可选' },
  allWeeks: (n: number): string => `全部 ${Math.round(n)} 周`,
  /** 全部几周的列表里，正在练的那一周 */
  current: '进行中',
  /** 计划页最后的安静按钮，点了先确认 */
  restart: {
    label: '重新开始计划',
    title: '重新开始这个计划？',
    body: '进度会回到第 1 周第 1 天，练习记录不受影响。',
    confirm: '重新开始',
    cancel: '取消',
  },
} as const

/* ---------- 舒适节律探索 ---------- */

/**
 * 舒适节律探索（DESIGN.md §13.11、§8.15.12）。介绍、做法和安全提示在 practices.ts 的 pace-finder。
 * 每一档按轻松程度打 1–5 分，打分最高的一档作为慢呼吸的默认节律
 */
export const PACE_FINDER = {
  kicker: '呼吸 · 工具',
  /** 开始按钮右边的时长 */
  duration: `约 ${minutesText(7)}`,
  /** 可选的心率带（实验功能）；浏览器不支持蓝牙时不显示 */
  strap: { label: '心率带（实验）', connect: '连接' },
  strapInfo: {
    privacy:
      '连接后，只在这台设备上接收心率。原始逐搏数据不会保存或上传；记录里只保留平均心率、心率变异的汇总值。',
    reference:
      '心率带的数据只是实验性的参考。这次每档只有 1 分钟，仍按你觉得是否轻松来选，不据此判断健康状况。',
    disconnect: '断开',
    reconnect: '重新连接',
    disconnected: '心率带已断开，可以继续按轻松程度打分。',
    connecting: '正在连接…',
    demo: '模拟心率带（开发演示）',
    signal: {
      waiting: '等待心率读数',
      'no-contact': '心率带没有贴紧皮肤',
      'no-rr': '设备仅提供心率，没有逐搏间期',
      stale: '暂时收不到心率信号',
      unstable: '信号不稳定，请检查心率带',
      good: '心率信号正常',
    },
    errors: {
      unsupported: '当前浏览器不支持连接心率带。',
      unavailable: '蓝牙暂时不可用，可以先不连接。',
      denied: '没有获得蓝牙权限，可以检查浏览器设置。',
      'no-service': '这台设备没有提供标准心率服务。',
      failed: '没有连上心率带，可以重试或直接开始。',
    },
  },
  rateUnit: '次/分',
  heartUnit: '次/分',
  ratingLabel: '{score} 分',
  easeValue: '{score} 分，共 5 分',
  tableLabel: '各档轻松程度',
  resultNote:
    '按刚才的轻松程度选择；评分相同时，优先选接近每分钟 5.5 次的一档。你可以随时在慢呼吸详情里调整。',
  applied: '已设为慢呼吸的默认节律。',
  saveFailed: '这次探索还没有保存，请再试一次。',
  saved: '这次探索已记在本机。',
  retry: '重新保存',
  pauseMeta: '按自己的节奏呼吸，准备好再继续。',
  /** 练习中练习名下面的一行，后面接 PLAYER.paced.rate：「第 2 档，共 5 档 · 6.0 次/分」 */
  step: (n: number, total: number): string => `第 ${Math.round(n)} 档，共 ${Math.round(total)} 档`,
  /** 每一档结束后的打分，不能跳过，点一下就进下一档 */
  rating: { question: '这一档呼吸起来有多轻松？', low: '1 很吃力', high: '5 很轻松' },
  result: {
    title: '你的舒适节律',
    /** 结果表的三列；没有连心率带时不显示心率 */
    columns: { rate: '节律', ease: '轻松程度', heartRate: '平均心率' },
    apply: '设为慢呼吸的节律',
    dismiss: '不用了',
  },
} as const

/* ---------- 设置 ---------- */

/** 引导详细程度（practice.notes §1 的三档；data/prefs.ts 默认标准）。说的是屏幕上出现多少句、中间安静多久 */
const GUIDANCE_LEVELS = {
  detailed: { name: '详细', help: '说明多，安静的间隔短。适合刚开始练，或心里乱的时候。' },
  standard: { name: '标准', help: '讲清做法，中间留出较长的安静。默认用这一档。' },
  quiet: {
    name: '安静',
    help: '只在开头、结尾和少数地方有提示，中间可能几分钟没有新的一句。适合练熟以后。',
  },
} as const satisfies Record<GuidanceLevel, { name: string; help: string }>

/**
 * 跟随节拍时怎样提示吸呼，与 engine/types.ts 的 CueStyle 一一对应（测试核对）；默认柔音，保留 glide 偏好键。
 * 做法见 engine/session.ts 的 playSegment 和 audio/params.ts 的 CUES
 */
const CUE_STYLES = {
  glide: {
    name: '柔音',
    help: '音高保持不变，吸气时声音渐强，呼气时渐弱，停顿时安静。背景声也跟着起伏。默认用这一种。',
  },
  ping: {
    name: '钟点',
    help: '每一步开始时轻响一声，吸气的音高一些，呼气的音低一些，停顿只有很轻的一下。背景声也跟着起伏。',
  },
  bed: { name: '仅背景', help: '没有提示音，只有背景声随吸呼起伏。没开背景声时，就只有画面和振动。' },
  off: { name: '静音', help: '声音不跟节拍，只看画面和振动。' },
} as const

/** 设置页（PRODUCT.md §8） */
export const SETTINGS = {
  title: '设置',
  navigation: '设置分组',
  actions: {
    save: '保存',
    cancel: '取消',
    clear: '清除回答',
    preview: '试听',
    stopPreview: '停止试听',
    presets: '一键填入',
    version: '版本',
    licenses: '开源字体许可',
    saved: '已保存。',
  },
  reminderSentence: { before: '在', action: '，我会做', fallback: '；如果太累，就只做', end: '。' },
  importPartial: '另有 {count} 条无法识别的记录，已跳过。',
  importWeekly: '每周自评已一同导入。',
  calendarEmpty: '先为工作日或周末选一个提醒时间。',
  operationFailed: '没有完成操作，请再试一次。',
  appearance: {
    title: '外观',
    /** 与 data/types.ts 的 ThemePref 一一对应 */
    theme: { system: '跟随系统', light: '浅色', dark: '深色' },
  },
  /** 声景、音乐的名称和说明在 sounds.ts */
  sound: {
    title: '声音',
    /** 对应 data/types.ts 的 Prefs.sounds：听声音时两种模式各自默认的组合 */
    defaults: {
      label: '默认背景声',
      help: '听声音时默认用的声景和音乐，放松、睡前各一组。每次播放时都可以换。',
    },
    volume: { master: '总音量', ambience: '声景音量', music: '音乐音量', cues: '提示音与钟声音量' },
    mode: { relax: '放松', sleep: '睡前' } satisfies Record<SoundMode, string>,
    cueStyle: { label: '节拍提示', help: '跟随节拍呼吸时，用什么声音提示吸和呼。', options: CUE_STYLES },
    /** audio/params.ts：开始一击，结束三击、一击比一击轻；睡前的声音不响钟（engine/types.ts 的 endBell） */
    bells: {
      label: '钟声',
      help: '开始时响一声，在背景声响起约 3 秒后；结束时响三声，一声比一声轻。睡前的声音不响钟，快到时间时慢慢变轻，直到停下。',
    },
    interval: {
      label: '间隔钟声',
      help: '静坐计时中，每隔一段时间轻响一声。默认关闭。',
      off: '关闭',
      every: (minutes: number): string => `每 ${Math.round(minutes)} 分钟`,
    },
    cues: { label: '操作提示音', help: '点「回神」、数息和段落切换时的轻声提示。' },
    haptics: {
      label: '振动',
      help: '跟随节拍时，每次吸、呼开始轻振一下。部分手机和浏览器不支持，比如 iPhone 上的浏览器。',
    },
  },
  /**
   * 文字引导（PRODUCT.md §5、§8）。v1 没有语音朗读，没有语音和语速的选项；引导怎样跟着练见 GUIDANCE_HOWTO
   */
  guidance: {
    title: '文字引导',
    level: {
      label: '引导详细程度',
      help: '练习中出现多少提示、留多长的安静。',
      options: GUIDANCE_LEVELS,
      /** 这两段是难受时的出口，引导词里写明任何档位都完整引导 */
      note: '落地练习和呼吸空间的应对版，在任何档位都完整引导。',
    },
    /** 安静了 20 秒以上、再出现新的一句时，轻响一声（PRODUCT.md §5）；默认打开 */
    captionCue: {
      label: '新的一句出现时轻提示',
      help: '新的一句如果隔了 20 秒以上才出现，会轻响一声。闭着眼睛练的时候，听到再看屏幕。默认打开。',
    },
  },
  practice: {
    title: '练习',
    leadIn: {
      label: '开头倒数',
      help: '开始前留几秒坐好，默认 5 秒。',
      value: (seconds: number): string => `${Math.round(seconds)} 秒`,
    },
    silentEnd: { label: '结尾静默', help: '最后一分钟里，背景声在半分钟内淡出，安静一会儿，再响结束钟声。' },
    checkin: {
      label: '练习前后自评',
      help: '练习前、后各问一次「此刻有多紧张？」，从 0 到 10 点一个数，可以跳过。问练习后时，不显示你练习前的分数。睡前声音之后不问。默认关闭。',
    },
    /*
     * 没有「练完感觉」的开关（DESIGN.md §13.9）：关掉它，「最近 3 次里有 2 次更紧张或很不舒服就建议换更温和的练法」
     * 这条安全规则也会跟着悄悄失效。练完感觉每次都可以跳过；选项和说明在 safety.ts 的 AFTER_PRACTICE
     */
    /** ux-elo-2003：改编自已验证的单题量表，中文版没有单独验证，只用于比较人群。题目在 RECORDS.weeklyStress */
    weekly: {
      label: '每周压力自评',
      help: '每周问一道题：这些天你的压力有多大，从 1 到 5。这道题在研究里用来比较人群，放到一个人身上只能作参考；中文版还没有单独验证。默认关闭。',
    },
  },
  /**
   * 提醒（PRODUCT.md §8；ux-gollwitzer-2006、ux-stawarz-2015）：执行意图式的一句话计划。
   * 各项对应 data/types.ts 的 Reminders（cue、action、fallback），整句由 data/ics.ts 的 planSentence 拼出，
   * 「太累」是那里的固定说法（PLAN_OBSTACLE），不能另选
   */
  reminder: {
    title: '提醒',
    intro: '写下一个具体的计划：在哪件事之后练，练什么，太累时只做多少。',
    template: '在【刷牙后】，我会做【3 分钟呼吸】；如果【太累】，就只做【1 分钟】。',
    fields: {
      cue: '在什么之后',
      action: '做什么',
      fallback: '太累时只做',
      time: '提醒时间',
      weekday: '工作日',
      weekend: '周末',
      off: '不提醒',
      custom: '自己写',
    },
    /** 情境的菜单（ux.notes §5） */
    cues: ['起床后', '刷牙后', '午饭后', '到公司后', '关灯前'],
    /** 5 分钟是八周正念的保底日 */
    fallbacks: ['1 分钟', '3 分钟', '5 分钟'],
    /**
     * 一键填入的计划，三个空和 Reminders 同名。第一条就是规格里的例子；
     * 第二条与八周正念第 1 周第 1 天的提示一致
     */
    presets: [
      { cue: '刷牙后', action: '3 分钟慢呼吸', fallback: '1 分钟' },
      { cue: '起床后', action: '10 分钟专注呼吸', fallback: '5 分钟' },
      { cue: '午饭后', action: '三分钟呼吸空间', fallback: '1 分钟' },
      { cue: '关灯前', action: '5 分钟慢呼吸', fallback: '1 分钟' },
    ],
    /** 「做什么」由练习和时长拼成：「5 分钟慢呼吸」；名字里已经带时长（如「一分钟停一停」）时只用名字 */
    actionText: (minutes: number, name: string): string =>
      name.includes('分钟') ? name : join(minutesText(minutes), name),
    calendar: {
      button: '生成日历文件',
      help: [
        '回神不能在后台给你发通知。生成的日历文件（.ics）导入手机或电脑的日历后，由日历按时提醒你。',
        '工作日和周末可以设不同的时间。',
        '改了计划，重新生成并导入就好。日历通常会更新原来的提醒；如果出现两条，删掉旧的那条。',
        '如果到时没有提醒，请在日历里为这个日程打开通知。',
        '在微信里打开时可能无法下载文件，请先选择在浏览器中打开。',
      ],
    },
  },
  /** 健康情况检查、停止指引、求助电话和每月自查的内容都在 safety.ts */
  safety: {
    why: '为什么这样调整',
    title: '安全',
    screening: {
      label: '健康情况检查',
      help: '可选。回答几个关于健康情况的问题，回神会据此调整推荐和默认时长，并隐藏个别可能不适合你的练习。答案只保存在这台设备上。',
    },
    stop: { label: '停止指引', help: '什么情况下应该停下来，停下来之后怎么做。' },
    help: { label: '求助方式', help: '心理援助热线和急救电话，不联网也能打开。' },
    /** safety-britton-2021：逐项问具体的变化，持续超过一天就建议暂停 */
    monthly: {
      label: '练习后的变化自查',
      help: '每月一次，可以跳过。逐项问问练习以后有没有出现睡眠变差、情绪发木这类变化。有一项持续或反复出现超过一天，回神会建议你暂停或减少练习，并和医生或心理专业人员谈谈。',
    },
  },
  data: {
    title: '数据',
    /** 与 data/types.ts 的 StorageMode 一一对应 */
    storage: {
      label: '存储方式',
      indexeddb: '练习记录保存在这台设备的浏览器里。',
      local: '这个浏览器暂时不能使用本地数据库，记录改存在浏览器的本地存储里，最多保留最近 500 条。',
      memory: '这个浏览器不允许保存数据（常见于无痕模式），关闭页面后记录会丢失。需要保留的话，请先导出。',
      clearWarning: '清除浏览器的网站数据，会同时删除这里的记录。换设备或清理浏览器之前，请先导出。',
    },
    export: {
      label: '导出',
      json: '导出完整备份（JSON）',
      csv: '导出表格（CSV）',
      help: 'JSON 文件包含全部记录，可以在另一台设备上导入；CSV 文件可以用表格软件打开，但不能导入。导出的文件请自己保管。',
    },
    import: {
      label: '导入备份',
      help: '从回神导出的 JSON 文件导入，已有的记录不会重复。',
      result: (added: number, skipped: number): string =>
        `导入 ${Math.round(added)} 条，跳过已有的 ${Math.round(skipped)} 条。`,
      invalid: '这个文件无法导入。只支持回神导出的 JSON 文件。',
    },
    /** 二次确认（ux-npc-2021-pipl）：第一步说清删什么，第二步说清删不掉什么 */
    deleteAll: {
      label: '删除全部数据',
      first: {
        title: '删除全部数据？',
        body: '这会删除这台设备上的练习记录、计划进度、设置、提醒计划和健康情况检查的回答。需要的话，先导出一份备份。',
        confirm: '继续',
        cancel: '取消',
      },
      second: {
        title: '再确认一次',
        body: '删除后无法恢复。已经导入日历的提醒不会跟着删除，需要在日历里自己删掉。',
        confirm: '删除全部',
        cancel: '取消',
      },
      done: '已删除全部数据。',
    },
    /** 列出应用发出的全部网络请求（ux-apa-2026-app-evaluation-model、ux-huckvale-2019） */
    privacy: {
      label: '隐私说明',
      lines: [
        '回神没有账号，也没有保存你数据的服务器。练习记录、计划进度、设置和健康情况检查的回答，都只保存在这台设备的浏览器里。',
        '回神只在加载应用本身时联网：第一次打开，以及检查和下载新版本的时候。加载完成后，断网也能练习。',
        '和打开任何网页一样，提供下载的服务器能看到你的 IP 地址；这些请求里没有你的练习数据。',
        '应用里没有统计、广告或追踪代码，不使用第三方服务；字体也随应用一起下载。',
        '连接心率带时，数据通过蓝牙直接传到这台设备，不经过网络。',
      ],
    },
  },
} as const

/* ---------- 依据 ---------- */

/** 等级的定义，与 PRODUCT.md §9 一字不差（测试核对） */
const GRADE_DEFINITIONS = {
  A: '多项低偏倚随机试验一致，或有指南推荐。',
  B: '有元分析支持但异质性或偏倚有疑虑，或至少一项大型严格随机试验；方向一致。',
  C: '有限或不一致：小型或探索性试验、试点、机制上合理；不能证明比更简单的做法好。',
  D: '几乎没有对照证据、证据显示没有优势，或风险大于收益。',
} as const satisfies Record<Grade, string>

/** 证据页「未采用」的一项 */
export interface NotAdopted {
  name: string
  /** 针对减压、放松这一类结果的等级 */
  grade: Grade
  /** 一句话原因 */
  reason: string
  /** 证据库里的 id；没有可引的研究时为空 */
  evidence: readonly string[]
}

/**
 * 不提供的方法（PRODUCT.md §2 的「不提供」，外加声音里不采用的两项），原因与研究笔记一致：
 * breathing.notes §3、meditation.notes §2、sound.notes §7、safety.notes §2
 */
const NOT_ADOPTED = [
  {
    name: '4-7-8 呼吸',
    grade: 'D',
    reason:
      '只找到一项没有对照组的单次研究（43 人），心率变异性的结果有升有降；7 秒的屏息也超过了回神 6 秒的上限。',
    evidence: ['breathing-vierra-2022'],
  },
  {
    name: 'Wim Hof 及过度换气法',
    grade: 'D',
    reason:
      // 这项试验只报告了各组的平均值，没有检验它和其他组的差别（breathing-balban-2023-nulls），所以只说平均幅度
      '每分钟 15–30 次的深呼吸，是医院做脑电图时诱发癫痫发作的方法，常带来头晕、手脚发麻；一项探索性试验比较了几种练法，它让焦虑减轻的平均幅度比其他几种都小。',
    evidence: [
      'safety-peltola-2023',
      'breathing-bscn-2013',
      'safety-fincham-2023',
      'breathing-kox-2014',
      'breathing-balban-2023-nulls',
    ],
  },
  {
    name: '过度换气后屏息',
    grade: 'D',
    reason: '先快速深呼吸再屏息，会推迟身体「该换气了」的信号，人可能毫无预兆地失去意识；在水里可能致命。',
    evidence: ['breathing-boyd-2015', 'safety-boyd-2015', 'safety-wimhofmethod-2026'],
  },
  {
    name: '布泰科呼吸法（Buteyko）',
    grade: 'D',
    reason:
      '没有找到把它当作减压方法的研究，相关的试验只有一两项，都针对哮喘。它讲究的轻柔、用鼻子、不用力，慢呼吸里也是这样做的。',
    evidence: ['breathing-santino-2020'],
  },
  {
    name: '交替鼻孔呼吸',
    grade: 'D',
    reason: '没有找到符合纳入标准的系统综述，暂不提供。',
    evidence: [],
  },
  {
    name: '长于 6 秒的屏息',
    grade: 'D',
    // 箱式呼吸每步可在本次练习中调到 6 秒，上限来自产品的谨慎安排。
    reason:
      '没有找到更长的屏息有额外好处的证据。回神里最长的停顿是箱式呼吸的 6 秒；6 秒这个上限是我们的谨慎判断，不是研究结论。',
    evidence: [],
  },
  {
    name: '咒语冥想 / 超觉静坐',
    grade: 'D',
    reason:
      '一篇汇总 47 项随机试验的综述里，以咒语为主的冥想（包括超觉静坐）在各项结果上都没有显示改善，不过这类试验很少。超觉静坐是认证老师面授的专有课程，应用无法照做。',
    evidence: ['meditation-goyal-2014', 'meditation-brook-2013'],
  },
  {
    name: '瑜伽休息术（NSDR）',
    grade: 'C',
    reason:
      '73 项研究汇总出的效果看起来中到大，但研究质量低，作者认为很可能被高估；以「NSDR」为名的做法没有单独检验过。',
    evidence: ['meditation-ghai-2026'],
  },
  {
    name: '528 Hz / 索尔费吉奥频率',
    grade: 'D',
    reason:
      '支持它的研究只有 9 人、每次听 5 分钟，也没有直接比较 528 Hz 和 440 Hz。回神的音乐按 440 Hz 的标准音调音。',
    evidence: ['sound-akimoto-2018'],
  },
  {
    name: '双耳节拍',
    grade: 'C',
    reason:
      '有元分析报告了正面结果，但多数研究的对照没能把节拍和声音本身分开；14 项脑电研究里只有 5 项看到大脑活动跟着节拍走，2026年一项 90 人的随机试验也没有发现它减轻焦虑。暂列为待观察。',
    evidence: ['sound-garciaargibay-2019', 'sound-xiong-2025', 'sound-ingendoh-2023', 'sound-akkurt-2026'],
  },
] as const satisfies readonly NotAdopted[]

/** 依据页（PRODUCT.md §9） */
export const EVIDENCE = {
  title: '依据',
  /** 页头的说明：前半是出处的条数，后半是 reviewedShort（DESIGN.md §13.8） */
  sources: (n: number): string => `${Math.round(n)} 条出处，逐条核对`,
  /** method.reviewed 的简写，用在页头 */
  reviewedShort: `最后核对：${REVIEWED_ON}`,
  intro:
    '回神的默认设置，找得到研究的都列在这里；找不到的，写明是我们的安排。每条结论都写明和什么比较、效果多大、有什么局限，以及不支持它的结果。',
  method: {
    title: '这些结论是怎么来的',
    lines: [
      '我们检索系统综述、随机对照试验和临床指南，逐条对照原文或摘要，核对样本、对照组和数字。找不到出处的说法不用。',
      '效应量约 0.2 算小，约 0.5 算中等，0.8 以上算大。和不练习相比，效果通常显得更大；和运动、心理咨询等其他积极的方法相比，差别往往很小。所以每条结论都写明比较对象。',
      // meditation-goldberg-2022
      '这些研究大多来自欧美。一篇汇总正念研究的综述里，来自亚洲的研究只占 8.1%，这些结论放在中国人身上是否一样，还缺少研究。',
      '「今日」按时段推荐练习，是我们自己的安排；练习时间对效果有没有影响，我们没有找到研究。',
    ],
    /** 每年复核一次（ux-nice-2022-esf） */
    reviewed: `最后核对：${REVIEWED_ON} · 下次核对：${NEXT_REVIEW}`,
    /** 只显示第一段时，展开其余几段的按钮：methodMore(lines.length - 1) */
    more: (n: number): string => `展开其余 ${Math.round(n)} 段`,
  },
  grades: {
    title: '证据等级',
    names: GRADE_NAMES,
    definitions: GRADE_DEFINITIONS,
    scope: '等级只针对文案里提到的那个结果，不代表这项练习整体的好坏。',
  },
  /** 写在效果后面的括注，如「可能有一点帮助（证据：中等）」 */
  tag: (grade: Grade): string => `证据：${GRADE_NAMES[grade]}`,
  /** 结论一节的分类，与卡片的类别对应；「全部」在最前 */
  filters: { all: ALL, meditation: '冥想', breathing: '呼吸', sound: '声音', safety: '安全' },
  /** 结论一节标题右边：当前的分类和卡片数，「呼吸 · 3 条」 */
  filterCount: (label: string, n: number): string => `${label} · ${Math.round(n)} 条`,
  /**
   * 证据卡片的各栏，按 PRODUCT.md §9 的顺序。没有「可信度」一栏（DESIGN.md §8.10）：等级之外再给一个高低，
   * 读起来像同一件事说了两遍；单项研究本身的分量，写在「研究类型」或「局限」里
   */
  card: {
    conclusion: '结论',
    effect: '效应量与 95% CI',
    design: '研究类型、样本与对照',
    grade: '等级',
    limits: '局限',
    contrary: '相反证据',
    source: 'DOI',
    /** 收起的卡片右下角的展开按钮 */
    expand: '展开',
    collapse: '收起',
  },
  unknown: {
    title: '我们还不知道的',
    lines: [
      '回神本身没有做过试验。只用手机应用练习的研究里，焦虑和低落平均只是小幅减轻。',
      '三分钟呼吸空间还没有单独的随机试验；包含它的完整课程有研究支持，不等于它单独也有效。',
      '坐着还是躺着、睁眼还是闭眼更好，没有找到比较研究。',
      '数息准确率能不能反映正念程度，研究结论不一致。',
      '练习前后自评和每周压力自评的题目，还没有中文版的验证。',
    ],
  },
  notAdopted: {
    title: '未采用',
    /** 标题右边的项数 */
    count: (n: number): string => `${Math.round(n)} 项`,
    intro: '下面这些方法，回神不提供，原因写在各自下面。',
    items: NOT_ADOPTED,
  },
  empty: { title: '没有符合条件的研究', body: '换一个分类或等级再看看。' },
} as const

/* ---------- 关于 ---------- */

/** 关于（PRODUCT.md §8）。免责声明全文在 safety.ts 的 DISCLAIMERS，求助电话只放在「求助方式」一处 */
export const ABOUT = {
  title: '关于回神',
  lines: [
    '回神免费，不用注册；打开过一次之后，没有网络也能用。',
    '所有声音都在你的设备上实时合成，没有用录音素材。引导是屏幕上的文字，暂时没有语音。',
  ],
  version: (version: string): string => join('版本', version),
  /** 字体见 docs/design/final/tokens.css：标题和数字用随应用发布的子集，正文用系统字体 */
  fonts: {
    title: '字体',
    body: '标题使用思源宋体（Noto Serif SC），数字和拉丁字母使用 Inter，两者都按 SIL Open Font License 1.1 授权；随应用发布的只是界面用到的那部分字。正文使用设备自带的字体。',
  },
  deleteData: '删除全部数据：设置 › 数据 › 删除全部数据。',
} as const

/* ---------- 系统 ---------- */

/** 找不到页面、页面出错、有新版本（DESIGN.md §13.14），以及浏览器标签上的标题（§13.1） */
export const SYSTEM = {
  /** 「今日 · 回神」；首次使用页只写「回神」 */
  documentTitle: (page: string): string => `${page} · 回神`,
  notFound: { title: '找不到这个页面', home: '回到今日' },
  error: {
    title: '这个页面出了问题',
    body: '练习记录没有受影响。',
    home: '回到今日',
    reload: '重新加载',
  },
  /** 练习中不弹，等小结关掉以后再说 */
  update: { message: '有新版本', action: '更新' },
} as const
export const HELP = { sources: '来源' } as const
