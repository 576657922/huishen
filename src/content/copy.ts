import { getLanguage } from '@/lib/locale'
import japanese from './locales/ja/copy.json'
import { createTranslator } from './translate'

const tr = createTranslator(japanese)

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
const rateText = (x: number): string => tr('{0} 次/分', x.toFixed(1))

const minutesText = (n: number): string => tr('{0} 分钟', Math.round(n))

const daysAndMinutes = (days: number, minutes: number): string =>
  tr('{0} 天 · {1}', Math.round(days), minutesText(minutes))

/** 筛选里的「全部」，练习页和依据页共用 */
const ALL = tr('全部')

/** 指向依据页的链接 */
const ALL_EVIDENCE = tr('全部依据')

/** 今日页和计划页上，每周压力自评的入口 */
const WEEKLY_STRESS = tr('本周压力自评')

/** 不足 1 分钟的练习不记录：小结和结束确认里都这样说 */
const NOT_RECORDED = tr('不足 1 分钟，这次不记录。')

/** 依据每年复核一次（ux-nice-2022-esf）。日历上的月份写在一起 */
const REVIEWED_ON = tr('2026年10月')
const NEXT_REVIEW = tr('2027年10月')

/** 证据等级的名字（content/types.ts 的 Grade）。写在效果后面：「可能有一点帮助（证据：中等）」 */
export const GRADE_NAMES = {
  A: tr('强'),
  B: tr('中等'),
  C: tr('有限'),
  D: tr('不足'),
} as const satisfies Record<Grade, string>

/* ---------- 首次使用 ---------- */

/** 首次使用（/welcome）：回神是什么，三句；隐私承诺。之后是 safety.ts 里的「开始之前」 */
export const WELCOME = {
  /** 与 package.json、PWA 清单里的描述一致 */
  tagline: tr('依据研究设计的冥想、呼吸与声音练习'),
  /** 第二句解释名字，说法与专注呼吸的引导词一致（meditation-hasenkamp-2012） */
  lines: [
    tr('冥想、呼吸和声音练习，多数在 10 分钟以内。'),
    tr('心会走神，这很自然。发现了，再回来，这一下就叫回神。'),
    tr('每个默认设置都写明依据；没有研究的地方，也照实说。'),
  ],
  /** PRODUCT.md §0：自我练习工具，不是治疗 */
  scope: tr('回神是自我练习的工具，不能替代医生、心理治疗或药物。'),
  privacy: {
    title: tr('你的数据'),
    lines: [
      tr('不用注册账号。'),
      tr('练习记录只保存在这台设备上，我们看不到。'),
      tr('应用里没有统计、广告和追踪代码。'),
    ],
  },
  /** 第一次练习用一分钟停一停（ux.notes §2：60 秒内开始第一次练习） */
  start: tr('先练 1 分钟'),
  browse: tr('看看全部练习'),
} as const

/* ---------- 文字引导 ---------- */

/**
 * 怎样跟着文字练（PRODUCT.md §0、§5）：练习详情页上，有引导词的练习（专注呼吸、数息和各项引导练习）在「做法」下面显示；
 * 播放器第一次打开这类练习时，也在练习名下面显示一次（不显示 intro，引导已经在眼前）。
 * 句子按 practices.ts 的 adjustedDefaults(…).eyesOpen 选：数息、应对版和落地练习本来就睁着眼做，健康情况检查
 * 也可能建议睁眼，这时用 eyesOpen，不提闭眼。轻响一声的开关是 SETTINGS.guidance.captionCue，默认打开
 */
export const GUIDANCE_HOWTO = {
  intro: tr('引导是屏幕上一句一句出现的文字，没有语音。'),
  closable: tr(
    '目光放低，落在屏幕上就好。安静的时候可以闭上眼睛；新的一句如果隔了 20 秒以上才出现，会轻响一声，听到再看屏幕。',
  ),
  eyesOpen: tr('目光放低，落在屏幕上就好。这项练习全程睁着眼睛做。'),
} as const

/* ---------- 今日 ---------- */

/**
 * 按时段推荐时写在练习名上方。只写时段、不写功效，因为练习时间对效果的影响，没有找到研究。
 * 都是一天里的时段，不写「今晚」「睡前」：深夜的推荐本身就叫「听声音 · 睡前」，再写睡前就重复了
 */
const SLOT_LABELS = {
  morning: tr('早上'),
  midday: tr('午间'),
  afternoon: tr('下午'),
  evening: tr('晚上'),
  night: tr('夜里'),
} as const satisfies Record<DayPart, string>

/** 今日页（PRODUCT.md §4）。推荐什么、按什么顺序，见 today.ts */
export const TODAY = {
  title: tr('今日'),
  /** 距上次练习满 3 天时的第一行。不写隔了几天（ux-buyalskaya-2023） */
  welcomeBack: tr('欢迎回来。先做 1 分钟？'),
  slots: SLOT_LABELS,
  change: tr('换一个'),
  start: tr('开始'),
  /** 「5 分钟」 */
  minutes: minutesText,
  /** 计划里的练习：这一天的、保底日的、可选的。漏了的日子不提（PRODUCT.md §3） */
  program: {
    day: (title: string, week: number, day: number): string =>
      tr('{0} · 第 {1} 周第 {2} 天', title, week, day),
    short: (title: string): string => tr('{0} · 保底日', title),
    extra: (title: string): string => tr('{0} · 可选练习', title),
    newWeek: (week: number): string => tr('第 {0} 周的第一天。练习前，先读一读本周说明，约 1 分钟。', week),
    doneToday: tr('今天的计划练完了。'),
    next: (week: number, day: number): string => tr('下次是第 {0} 周第 {1} 天。', week, day),
  },
  /**
   * 「只有几分钟」。structure 是行里显示的结构，与引导词的段落或节拍的几步一致；hint 是读屏读的说明（aria-describedby），
   * 与引导词里的做法一致
   */
  quick: {
    title: tr('只有几分钟'),
    pause: {
      label: tr('一分钟停一停'),
      structure: tr('停 · 吸 · 观 · 行'),
      hint: tr('停下手头的事，吸一口气，留意此刻，再接着做。'),
    },
    breathingSpace: {
      label: tr('三分钟呼吸空间'),
      structure: tr('觉察 · 集中 · 扩展'),
      hint: tr('先觉察此刻，再集中到呼吸，最后扩展到全身。'),
    },
    cyclicSigh: {
      label: tr('周期性叹息'),
      structure: tr('鼻吸 · 补吸 · 长呼'),
      hint: tr('用鼻子轻轻吸到七八成满，再补一小口，然后用嘴慢慢呼完。'),
    },
    /**
     * 健康情况检查不建议周期性叹息时（如惊恐发作），换成轻而慢的慢呼吸；hint 的后半句就是呼吸练习开头的那一句。
     * 每分钟 6 次、呼气更长，约吸 4 秒、呼 6 秒（practices.ts 的 LIGHT_SLOW_PACE）
     */
    lightSlow: {
      label: tr('慢呼吸'),
      structure: tr('吸 4 秒 · 呼 6 秒'),
      hint: tr('每分钟 6 次，轻柔地呼吸，不必吸得很深。'),
    },
  },
  /**
   * 「现在有点难」：都是睁着眼也能做的短练习，最后是求助方式。难受的人最常来这里，
   * 所以开头就说有伤害自己的念头时去哪里（safety.notes §8）
   */
  hard: {
    title: tr('现在有点难'),
    /**
     * 今日页上这一行的提示（DESIGN.md §13.2）。这是默认的面板；按健康情况换了练习或顺序时，
     * 用 today.ts 的 hardMoment(…).rowHint，那里按同样的写法拼出来
     */
    rowHint: tr('周期性叹息 · 落地练习 · 求助电话'),
    /** rowHint 的最后一项 */
    phones: tr('求助电话'),
    intro: tr('选一个就好。练着更难受，随时可以停下。有伤害自己的念头，请打开「求助方式」。'),
    sigh: { label: tr('周期性叹息'), hint: tr('用鼻子轻轻吸到七八成满，再补一小口，然后用嘴慢慢呼完。') },
    coping: {
      label: tr('三分钟呼吸空间 · 应对版'),
      hint: tr('给此刻的感受起个名字，找到它在身体的哪里，再回到呼吸或双脚。'),
    },
    grounding: {
      label: tr('落地练习'),
      duration: tr('60 秒'),
      hint: tr('睁着眼睛，踩稳双脚，看看四周，把注意力放到身体外面。'),
    },
    lightSlow: { label: tr('慢呼吸'), hint: tr('每分钟 6 次，轻柔地呼吸，不必吸得很深。') },
    help: { label: tr('求助方式'), hint: tr('心理援助热线和急救电话，不联网也能打开。') },
  },
  /** 本周：练习天数和分钟数，下面是周一到周日七个点 */
  week: { title: tr('本周'), value: daysAndMinutes },
  /** 推荐专注呼吸时，空的回神时间线下面的一句 */
  focusCaption: tr('每次回神，留一道竖线。'),
  /** 打开了每周压力自评、这周还没答时，「本周」一行右边的链接（DESIGN.md §13.7） */
  weeklyStress: WEEKLY_STRESS,
} as const

/* ---------- 练习 ---------- */

/**
 * 练习页（DESIGN.md §13.3）。分组、顺序和按健康情况隐藏的练习见 practices.ts 的 catalogueSections；
 * 分类名是 practices.ts 的 CATEGORY_LABEL，前面加 all
 */
export const CATALOGUE = {
  title: tr('练习'),
  all: ALL,
  /** 页头的说明：前半是练习页上列出的练习数（catalogueSections 里的项数，v1 不提供的不算），后半说明右边的时长 */
  folio: (n: number): string => tr('{0} 项练习', Math.round(n)),
  folioEnd: tr('时长为默认值'),
  /** 每一类标题右边的项数 */
  count: (n: number): string => tr('{0} 项', Math.round(n)),
  /** 时长不固定的一行，如舒适节律探索「约 7 分钟」 */
  about: (minutes: number): string => tr('约 {0}', minutesText(minutes)),
  programs: {
    title: tr('计划'),
    /** 漏了的日子不补，也不往后排，练完一天才算一天 */
    aside: tr('按完成的天数推进'),
    /** 没开始的计划，行里写这一句 */
    plan: {
      'mindfulness-8w': tr('每周一个主题，每天 5–10 分钟'),
      'breathing-4w': tr('节律逐周放慢，每天 5–10 分钟'),
    } satisfies Record<ProgramId, string>,
    inProgress: (week: number, day: number): string =>
      tr('进行中 · 第 {0} 周第 {1} 天', Math.round(week), Math.round(day)),
    finished: tr('已完成 · 可以重新开始'),
    /** 行的右边，如「8 周」 */
    weeks: (n: number): string => tr('{0} 周', Math.round(n)),
  },
  /** 名称后面那个字母的读屏说法 */
  gradeLabel: (grade: Grade): string => tr('证据等级 {0}，{1}', grade, GRADE_NAMES[grade]),
  /** 页尾的说明，下面是 allEvidence 链接 */
  legend: tr(
    '名称后的字母是证据等级：A 强、B 中等、C 有限、D 不足，只针对练习说明里写到的那个效果。静坐计时和舒适节律探索是工具，不评等级。',
  ),
  allEvidence: ALL_EVIDENCE,
  settingsSafety: tr('设置 › 安全'),
  /** 按健康情况隐藏了练习时，这一类的最后写这一句；names 是被隐藏的练习名 */
  hidden: (names: readonly string[]): string =>
    tr('根据健康情况检查，隐藏了{0}。可以在设置 › 安全里修改。', names.join('、')),
} as const

/* ---------- 练习详情 ---------- */

/** 练习详情页（DESIGN.md §13.4）。练习的名称、介绍、做法、结论和安全提示在 practices.ts */
export const DETAIL = {
  sections: { how: tr('做法'), settings: tr('设置'), evidence: tr('依据'), safety: tr('安全') },
  /** 「做法」右边：「3–20 分钟，默认 5 分钟」；只有一种时长时只写它 */
  durations: (min: number, max: number, defaultMinutes: number): string =>
    min === max
      ? minutesText(defaultMinutes)
      : tr('{0}–{1} 分钟，默认 {2}', min, max, minutesText(defaultMinutes)),
  /** 「设置」右边 */
  settingsAside: tr('改动会记住'),
  sessionOnly: tr('只用于本次练习。'),
  boxPhase: tr('每步（秒）'),
  /** 只有数字的分段选择，单位写在标签里 */
  durationLabel: tr('时长（分钟）'),
  /** 数息 15 分钟那一格下面的小字：想前后比较，每次都选 15 分钟 */
  measureLabel: tr('测量版'),
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
  notOffered: tr('这项练习不方便看着屏幕做，等请老师录好语音引导后再提供。'),
  /** 示意图的编号，后面接 figureCaption */
  figure: tr('图 1'),
  /**
   * 各练习示意图下面的说明（DESIGN.md §13.4）。图按默认时长画：慢呼吸画默认节律的 3 轮；
   * 身体扫描画台阶图，其他引导练习画分段条，每一段的长短就是它占的时间
   */
  figureCaption: {
    focus: tr('横线是练习的时长；每次回神，线上留一道竖线。'),
    'breath-count': tr('1–8 点左边，第 9 口气点右边。'),
    'body-scan': tr('先感受呼吸，再从左腿开始一处处往上，最后是全身。每一级的长短，是这一处的时间。'),
    'breathing-space': tr('三段：觉察、集中、扩展。每一段的长短，是它占的时间。'),
    'loving-kindness': tr('祝愿先给亲近的人和自己，再扩大到所有生命。每一段的长短，是它占的时间。'),
    'self-compassion': tr(
      '先想一件小事，再对自己说三句话，中间有一段安抚的触碰。每一段的长短，是它占的时间。',
    ),
    'open-awareness': tr('从呼吸开始，放宽到身体、声音、想法和情绪。每一段的长短，是它占的时间。'),
    walking: tr('先站稳，再放慢脚步、留意脚底，最后站定。每一段的长短，是它占的时间。'),
    pause: tr('四段：停、吸、观、行，一共 1 分钟。'),
    timer: tr('开始和结束各有钟声；间隔钟声默认关闭。'),
    slow: tr('默认节律的 3 轮，约 33 秒。曲线升高是吸气，降低是呼气。'),
    'cyclic-sigh': tr('可选节拍的一轮 10.5 秒：吸 2.5 秒，再吸 1 秒，呼 7 秒。曲线升高是吸气，降低是呼气。'),
    box: tr('默认一轮 16 秒：吸、停、呼、停，各 4 秒。曲线平的两段是停。'),
    'pace-finder': tr('5 档，每档 1 分钟，从每分钟 6.5 次慢到 4.5 次。'),
    listen: tr('音量保持不变，最后 1 分钟慢慢淡出。'),
    sleep: tr('音量保持不变，最后 2 分钟慢慢变轻，直到停下。'),
    'body-scan-sleep': tr('先感受呼吸，再从头部开始一处处往下，最后是全身。每一级的长短，是这一处的时间。'),
    'breathing-space-coping': tr('三段：觉察、集中、扩展。每一段的长短，是它占的时间。'),
    grounding: tr('60 秒：踩稳双脚，看看四周，听听声音。'),
  } satisfies Record<CatalogPracticeId, string>,
  /** 慢呼吸的设置（PRODUCT.md §2；breathing-shaffer-2020） */
  slow: {
    rate: tr('节律'),
    /** 「舒适节律探索」做成链接 */
    rateHint: tr(
      '成人适合的慢呼吸节律，多在每分钟 4.5–6.5 次之间。憋得慌就调快一点，也可以用舒适节律探索来选。',
    ),
    ratio: tr('吸与呼'),
    /** 呼气更长的一格，秒数随节律变：「吸 4.5 · 呼 6.5」 */
    ratioLong: (inhale: number, exhale: number): string =>
      tr('吸 {0} · 呼 {1}', decimal(inhale), decimal(exhale)),
    ratioEqual: tr('等长'),
    ratioLongLabel: tr('呼气更长'),
    /** 两项研究里，吸呼 1∶1 和 1∶2 的心率变异性没有差别（breathing-shaffer-2020） */
    ratioHint: tr('两种比例在研究里差别不大，选呼吸更舒服的一种。'),
    warmup: tr('开头 90 秒逐步放慢'),
    /** 两轮放慢 0.5 次：从 8 次到默认的 5.5 次约 87 秒（engine/pace.ts） */
    warmupHint: tr('从每分钟 8 次开始，每两轮慢 0.5 次，直到你选的节律；放慢到默认的 5.5 次，约需 90 秒。'),
  },
} as const

/* ---------- 播放器 ---------- */

/** 播放器（PRODUCT.md §5）。节拍的大字「吸」「再吸」「停」「呼」在 engine/patterns.ts */
export const PLAYER = {
  pause: tr('暂停'),
  resume: tr('继续'),
  end: tr('结束'),
  sound: tr('声音'),
  /** 打开停止指引、60 秒落地练习和求助方式；内容在 safety.ts。也是那个面板的标题和按钮的读屏名称 */
  unwell: tr('不舒服？'),
  /** 手机竖着拿时，第三个控件上显示的字；读屏仍读 unwell（DESIGN.md §8.15.15） */
  unwellShort: tr('不舒服'),
  /**
   * 「不舒服？」面板（DESIGN.md §8.15.17）。标题是 unwell；停止指引、急救的那一句和求助电话在 safety.ts。
   * 「结束练习」不再弹确认：练满 60 秒照常记录，小结只问练完感觉
   */
  unwellSheet: {
    /** 后面接 STOP_GUIDANCE.short */
    paused: tr('练习已暂停。'),
    /** 「停下以后：」那一行右边，链到 /help#stop */
    fullGuidance: tr('停止指引全文'),
    endPractice: tr('结束练习'),
  },
  paused: tr('已暂停'),
  /**
   * 暂停面板（DESIGN.md §8.15.16）：标题 paused，下面一行「已练 03:45 · 还剩 06:15」，
   * 时间用 lib/time 的 fmtClock。keys 只在用鼠标、触控板的设备上显示（§10.2）
   */
  pausePanel: {
    elapsed: tr('已练'),
    left: tr('还剩'),
    meta: (elapsed: string, left: string): string => tr('已练 {0} · 还剩 {1}', elapsed, left),
    keys: tr('键盘：空格继续练习，Esc 关闭面板并继续。'),
  },
  /**
   * 点「结束」时的确认（DESIGN.md §8.15.15）。练满 60 秒时正文用 recorded，duration 用 lib/time 的 fmtMinutes，
   * 如「6 分钟」；不足 60 秒时用 notRecorded。开头倒数时结束不弹确认
   */
  endDialog: {
    title: tr('结束这次练习？'),
    recorded: (duration: string): string => tr('已练 {0}，会记在记录里。', duration),
    notRecorded: NOT_RECORDED,
    cancel: tr('继续练习'),
    confirm: tr('结束'),
  },
  /** 开头倒数时 */
  leadIn: tr('准备'),
  /** 结尾静默开始时：背景声在淡出，接下来是安静和结束钟声 */
  silentEnding: tr('背景声慢慢淡出，安静一会儿，然后是结束钟声。'),
  silentEndingNoBell: tr('背景声慢慢淡出，最后留一会儿安静。'),
  controls: tr('练习控制'),
  close: tr('关闭'),
  unlimited: tr('不限时'),
  units: { seconds: tr('秒'), rate: tr('次/分'), rounds: tr('轮'), times: tr('次') },
  /** 控件上方读数的标签（DESIGN.md §8.15.4）。引导练习的「这一处还剩」在 guided.sectionLeft */
  readouts: {
    left: tr('剩余'),
    rate: tr('节律'),
    rounds: tr('轮数'),
    step: tr('每步'),
    next: tr('下一处'),
    sat: tr('已坐'),
    nextBell: tr('下次钟声'),
  },
  focus: {
    mark: tr('回神'),
    /**
     * @deprecated 改用 markHintTouch / markHintKeys：触屏上不该出现按键的说明，用鼠标时也不该说「轻点屏幕」（DESIGN.md §10.2）
     */
    markHint: tr('也可以轻点屏幕或按空格'),
    /** 「回神」键下面的小字，触屏 */
    markHintTouch: tr('也可以轻点屏幕的任何地方'),
    /** 用鼠标、触控板的设备；后面跟一个键帽 markKey */
    markHintKeys: tr('也可以按'),
    markKey: tr('空格'),
    /** 读屏软件读到「回神」按钮时的说明 */
    markHelp: tr('发现走神时点一下，然后回到呼吸。'),
  },
  count: {
    breath: '1–8',
    ninth: '9',
    /** 两个键上数字下面的小字 */
    breathCaption: tr('第 1–8 口气'),
    ninthCaption: tr('第 9 口气'),
    reset: tr('数乱了'),
    hint: tr('第 1 到第 8 口气点左边，第 9 口气点右边。数乱了就点下面，从 1 重新数。练习中不显示计数。'),
    /** 用鼠标、触控板的设备上，键的下面（DESIGN.md §10.2） */
    keys: tr('也可以按 F 或 ← 记 1–8，J 或 → 记 9，退格键是数乱了。'),
  },
  paced: {
    figure: tr('跟随呼吸节拍的曲线'),
    boxFigure: tr('跟随呼吸节拍的方框'),
    next: tr('{seconds} 秒后{phase}'),
    phaseActions: { in: tr('吸气'), in2: tr('再吸'), hold: tr('停'), out: tr('呼气'), rest: tr('停') },
    side: tr('{phase} {seconds} 秒'),
    hurry: tr('有点急'),
    /** engine/pace.ts 的 stepBack：从下一轮起加快 0.5 次，保持到结束；记住速度由应用层负责（PRODUCT.md §2） */
    hurryHelp: tr(
      '节拍太慢、总想提前吸气时，点一下。从下一轮起，每分钟多呼吸 0.5 次，一直到练习结束；下次练慢呼吸，也从这个速度开始。',
    ),
    /** 「有点急」左边的说明（DESIGN.md §8.15.3） */
    hurryHint: tr('点一下，每分钟加快 0.5 次'),
    /** 点过以后显示 3 秒，代替 hurryHint */
    hurried: (rate: number): string => tr('已加快到 {0}', rateText(rate)),
    /** 到了上限、按钮不能再点时 */
    hurryMax: (rate: number): string => tr('已到上限：{0}', rateText(rate)),
    rate: (rate: number): string => rateText(rate),
    round: (n: number): string => tr('第 {0} 轮', Math.round(n)),
    /** 周期性叹息的曲线下面，代替「有点急」；与它做法里的说法一致 */
    selfPaced: tr('节拍只是参考，可以按自己的快慢来。'),
  },
  guided: {
    skip: tr('跳过这一处'),
    /** 跳过时，引擎把后面的时间整体提前，练习随之早结束 */
    skipHelp: tr('不想停在这一处，可以直接进到下一处，练习也会相应早一点结束。'),
    /** 读数的标签：这一段还剩多少时间（DESIGN.md §8.15.4） */
    sectionLeft: tr('这一处还剩'),
    /** 段落标题上面的一行：能跳过的部位写第几处，其余的写段落名 */
    where: (n: number, total: number): string =>
      tr('现在 · 第 {0} 处，共 {1} 处', Math.round(n), Math.round(total)),
    now: (title: string): string => tr('现在 · {0}', title),
    /**
     * 第一次打开有引导词的练习时，练习名下面显示一次（DESIGN.md §13.5.9 的单次提示）：
     * 按 adjustedDefaults(…).eyesOpen 选 eyesOpen 或 closable，不用 intro
     */
    howTo: GUIDANCE_HOWTO,
  },
  notices: {
    /** 正念行走开始后的前 10 秒，显示在练习名下面。v1 不提供正念行走（V1_UNAVAILABLE），留到有录音时用 */
    walking: tr('睁着眼睛，在安全、平坦的地方走。'),
    /** 浏览器拦下声音时，练习静音继续（engine/session.ts 的 AUDIO_START_GRACE_MS） */
    audioBlocked: tr('声音没能开始，练习照常进行。'),
    audioRetry: tr('再试一次'),
    awake: tr('练习时，屏幕会保持常亮。'),
    awakeUnsupported: tr(
      '这个浏览器不能让屏幕保持常亮，练习中屏幕可能自动熄灭。可以先在系统设置里，把自动锁定的时间调长一些。',
    ),
    /** 一句话版本，用在播放器和第一次听睡前声音之前；完整说明是 sounds.ts 的 SOUND_COPY.iosLock，说法与它一致 */
    iosLock: tr('在 iPhone 和 iPad 上，锁屏或切到别的应用后，回神的声音就会停下。练习时请让屏幕亮着。'),
  },
} as const

/* ---------- 练习后 ---------- */

/**
 * 练习后的小结（PRODUCT.md §6）。练完感觉、选了「很不舒服」之后的说明、反复不适时换更温和的练法，
 * 都在 safety.ts 的 AFTER_PRACTICE
 */
export const SUMMARY = {
  title: tr('这次练习'),
  /** 右上角的关闭按钮，读屏读这一句；和「完成」一样 */
  close: tr('关闭小结，回到今日'),
  /** duration 用 lib/time 的 fmtMinutes，如「10 分钟」 */
  practiced: (duration: string): string => tr('练了 {0}', duration),
  endedEarly: tr('提前结束了，练过的时间照样记下。'),
  notRecorded: NOT_RECORDED,
  week: (days: number, minutes: number): string => tr('本周累计 {0}', daysAndMinutes(days, minutes)),
  weekLabel: tr('本周累计'),
  marks: (n: number): string => tr('回神 {0} 次', Math.round(n)),
  /** 这次练习的回神时间线下面 */
  marksCaption: tr('每一道竖线是一次回神。'),
  marksNote: tr('次数多少没有好坏。'),
  /** 慢呼吸里点过「有点急」时，接在轮数和节律后面 */
  hurried: (rate: number): string => tr('有点急 · 加快到 {0}', rateText(rate)),
  /** 静坐计时的一行；没开间隔钟声时只写时长 */
  timer: (minutes: number, bells: number): string =>
    bells > 0
      ? tr('静坐 {0} · 间隔钟声 {1} 次', minutesText(minutes), Math.round(bells))
      : tr('静坐 {0}', minutesText(minutes)),
  count: (correct: number, errors: number, resets: number): string =>
    tr(
      '数对 {0} 轮 · 数错 {1} 轮 · 数乱了 {2} 次',
      Math.round(correct),
      Math.round(errors),
      Math.round(resets),
    ),
  invalid: (n: number): string => tr('另有 {0} 轮点得过快，不计入', Math.round(n)),
  /** rate 用 PLAYER.paced.rate 写好 */
  breaths: (rounds: number, rate: string): string => tr('{0} 轮 · {1}', Math.round(rounds), rate),
  /** 0–10 点选，不预选，可跳过；问练习后时不显示练习前的分数（ux-abend-2014）。睡前声音之后不问 */
  checkin: {
    question: tr('此刻有多紧张？'),
    low: tr('一点也不'),
    high: tr('非常紧张'),
    skip: tr('跳过'),
    before: tr('练习前'),
    after: tr('练习后'),
  },
  note: { label: tr('备注'), placeholder: tr('可以写一句，比如：走神多，一直在想工作。') },
  done: tr('完成'),
  again: tr('再来一次'),
  timeRange: tr('{month}月{day}日 {start}–{end}'),
  saveFailed: tr('没有保存成功，请再试一次。'),
} as const

/* ---------- 记录 ---------- */

/** 记录页（PRODUCT.md §7） */
export const RECORDS = {
  title: tr('记录'),
  month: tr('{month}月'),
  yearMonth: tr('{year}年{month}月'),
  dayUnit: tr('天'),
  date: tr('日期'),
  practice: tr('练习'),
  duration: tr('时长'),
  detail: tr('这次练习'),
  noData: tr('还没有这项练习的数据。'),
  hide: tr('收起'),
  deleted: tr('已删除这条记录。'),
  undo: tr('撤销'),
  cancel: tr('取消'),
  deleteRecord: tr('删除这条记录'),
  failed: tr('没有完成操作，请再试一次。'),
  complete: tr('已完成'),
  early: tr('提前结束'),
  skipped: tr('跳过的段落'),
  params: tr('练习参数'),
  planned: tr('计划时长'),
  hrvFields: { meanHr: tr('平均心率（次/分）'), rmssd: tr('RMSSD（毫秒）'), amplitude: tr('心率起伏幅度') },
  paramLabels: {
    rate: tr('节律'),
    ratio: tr('吸与呼'),
    cycle: tr('每轮（秒）'),
    phase: tr('每步（秒）'),
    inhale: tr('吸气（秒）'),
    holdIn: tr('吸后停顿（秒）'),
    exhale: tr('呼气（秒）'),
    holdOut: tr('呼后停顿（秒）'),
    level: tr('引导详细程度'),
    interval: tr('间隔钟声'),
    mode: tr('声音模式'),
    step: tr('探索档位'),
    program: tr('计划'),
    programDay: tr('计划进度'),
  },

  heartRate: tr('平均心率'),
  exportHelp: tr('练习记录和每周自评会一同导出。'),
  /** 页头的说明：前半是日期范围（lib/date）和 sessions，后半是 local（DESIGN.md §13.7） */
  local: tr('只在这台设备上'),
  sessions: (n: number): string => tr('{0} 次练习', Math.round(n)),
  /** 概览里天数是大字，分钟数写在下面 */
  totalMinutes: (minutes: number): string => tr('共 {0}', minutesText(minutes)),
  empty: { title: tr('还没有练习记录'), body: tr('练满 1 分钟的练习，会自动记在这里。') },
  /** 没有记录时，空状态下面唯一的链接，去「练习」 */
  goPractice: tr('去练习'),
  week: { title: tr('本周'), value: daysAndMinutes },
  /**
   * 概览下面默认收起的说明。偶尔漏一天不影响习惯（ux-lally-2010）；突出「连续中断」会让人练得更少，
   * 比不显示还少（ux-silverman-2023）
   */
  streakNote: {
    title: tr('为什么不显示连续天数'),
    body: tr(
      '偶尔漏掉一天，几乎不影响习惯的养成；「连续」一旦断掉，反而容易让人放弃。所以这里只记练过的日子，不数断了几天。',
    ),
    source: tr(
      'Lally 等 2010 · European Journal of Social Psychology；Silverman 与 Barasch 2023 · Journal of Consumer Research',
    ),
    evidence: ['ux-lally-2010', 'ux-silverman-2023'],
  },
  /** 月历的前后翻页按钮，读屏读这两个 */
  prevMonth: tr('上个月'),
  nextMonth: tr('下个月'),
  /** 月历点阵的说明；没练的日子不标红 */
  calendar: tr('练过的日子是实心点，没练的日子留空。'),
  byPractice: {
    title: tr('各练习'),
    row: (sessions: number, minutes: number): string =>
      tr('{0} 次 · {1}', Math.round(sessions), minutesText(minutes)),
  },
  /** 专注呼吸的回神次数，中性显示（meditation-hasenkamp-2012） */
  focus: {
    title: tr('回神次数'),
    unit: tr('每 10 分钟'),
    plotLabel: tr('每 10 分钟回神次数，{n} 次练习，范围 {min}–{max} 次。次数多少没有好坏。'),
    note: tr('次数多少没有好坏，更常发现走神也可能说明觉察更敏锐。'),
  },
  /**
   * 数息（meditation-levinson-2014、meditation-wong-2018、meditation-treves-2025）。不叫「正念分数」。
   * 准确率与 data/stats.ts 的 countAccuracy 相同：PRODUCT.md §7 的 1 −（错的第 9 次 + 数乱了）÷（全部第 9 次 + 数乱了），
   * 点得过快的轮次两边都不算
   */
  count: {
    title: tr('数息练习数据'),
    notEnough: tr('练满 3 次后显示趋势。同一个人每次的结果起伏不小，单看一次说明不了多少。'),
    /** 趋势线右边那个准确率下面的小字 */
    latest: tr('最近一次'),
    accuracy: tr('准确率'),
    resets: tr('数乱了'),
    /** explain 收在这个展开项里 */
    howCounted: tr('怎么算的'),
    explain: [
      tr('一轮从 1 数到 9，前 8 口气点左边，第 9 口气点右边。点右边之前正好点了 8 下左边，这一轮就算数对。'),
      tr('准确率 = 数对的轮数 ÷（数对的轮数 + 数错的轮数 + 「数乱了」的次数）。「数乱了」也算一次没数对。'),
      tr('「数乱了」单独列出，因为那是你自己发现的走神。没有察觉的数错，研究发现与注意力短暂中断有关。'),
      tr('点得过快的轮次不计入。一轮里平均每次点击间隔不到 1.5 秒，就不像是跟着呼吸点的。'),
      tr(
        '这不是正念分数。研究发现，数得准不准和自评的正念程度关系很弱；同一个人隔一周再测，结果也会有不小的出入，所以要看几次下来的趋势。',
      ),
    ],
  },
  /** 练习前后的自评（ux-goldberg-2022） */
  checkin: {
    title: tr('练习前后自评'),
    tag: tr('自评'),
    notEnough: tr('练习前后都自评满 5 次后，这里显示中位数和点图。'),
    before: tr('练习前'),
    after: tr('练习后'),
    median: tr('中位数'),
    plotLabel: tr('练习前后自评（0–10）：练习前中位数 {pre}，练习后中位数 {post}，各 {n} 次。'),
    noise: tr('前后相差 1 分以内，算作没有变化，因为自评本身就有这么大的误差。'),
    caveat: tr('变化也包含休息本身、期待和测量误差，不能证明是练习带来的。'),
  },
  /**
   * 每周压力自评（DESIGN.md §13.7；ux-elo-2003）：改编自已验证的单题量表，只用于比较人群，中文版没有单独验证。
   * 回答时只有题目、1–5 和两端的说明，不给结果、分数和评价；回答以后只说「已记下。」
   */
  weeklyStress: {
    title: tr('每周压力自评'),
    plotLabel: tr('每周压力自评：{points}。'),
    pointLabel: tr('{date}，{score} 分'),
    tag: tr('自评'),
    /** 今日页和计划页上的入口 */
    prompt: WEEKLY_STRESS,
    /** 计划页那一行的说明 */
    rowHint: tr('一道题，1–5'),
    question: tr('这些天你的压力有多大？'),
    low: tr('1 很小'),
    high: tr('5 很大'),
    skip: tr('跳过'),
    /** 回答后的提示 */
    saved: tr('已记下。'),
    /** 计划页上答过的那一行，不显示分数 */
    answered: tr('已记下'),
    notEnough: tr('答满 3 周后，这里显示每周的点。'),
    caveat: tr('这道题在研究里用来比较人群，放到一个人身上只能作参考；中文版还没有单独验证。'),
  },
  list: {
    title: tr('每次练习'),
    delete: tr('删除'),
    confirmDelete: tr('删除这条记录？删除后无法恢复。'),
    /** 先显示最近几条，按一下再显示更早的 */
    showEarlier: (n: number): string => tr('显示更早的 {0} 次', Math.round(n)),
  },
  export: tr('导出'),
} as const

/* ---------- 计划 ---------- */

/**
 * 计划页（DESIGN.md §13.10）。计划的名字、介绍、每周的说明和提示在 programs/；
 * 今日页上计划那一行的说法在 TODAY.program
 */
export const PROGRAM = {
  join: tr('加入计划'),
  day: tr('第 {week} 周第 {day} 天'),
  leave: tr('退出计划'),
  main: tr('主练习'),
  long: tr('20 分钟版'),
  choose: tr('今天练什么'),
  finished: tr('这个计划已完成。可以回看各周说明，或重新开始。'),
  joined: tr('按完成的天数推进，练完一天，再接着下一天。'),
  readingTime: tr('约 1 分钟'),
  paired: tr('主练习分两段：先做 5 分钟专注呼吸，再做 5 分钟自我关怀。忙的时候，只做自我关怀也算这一天。'),
  second: tr('接下来做自我关怀，5 分钟。'),
  leaveDialog: {
    title: tr('退出这个计划？'),
    body: tr('计划进度会移除，练习记录保留。以后可以重新加入。'),
    confirm: tr('退出计划'),
    cancel: tr('取消'),
  },

  /** 标题上面：「计划 · 8 周」 */
  kicker: (weeks: number): string => tr('计划 · {0} 周', Math.round(weeks)),
  /** 介绍只先显示前两句 */
  more: tr('展开全文'),
  /** 本周一节的标题：「第 3 周 · 身体扫描」 */
  week: (n: number, title: string): string => tr('第 {0} 周 · {1}', Math.round(n), title),
  /** 本周说明的展开项 */
  reading: tr('本周说明'),
  /** 本周的几项练习，行里的说明 */
  roles: { short: tr('保底日'), extra: tr('可选') },
  allWeeks: (n: number): string => tr('全部 {0} 周', Math.round(n)),
  /** 全部几周的列表里，正在练的那一周 */
  current: tr('进行中'),
  /** 计划页最后的安静按钮，点了先确认 */
  restart: {
    label: tr('重新开始计划'),
    title: tr('重新开始这个计划？'),
    body: tr('进度会回到第 1 周第 1 天，练习记录不受影响。'),
    confirm: tr('重新开始'),
    cancel: tr('取消'),
  },
} as const

/* ---------- 舒适节律探索 ---------- */

/**
 * 舒适节律探索（DESIGN.md §13.11、§8.15.12）。介绍、做法和安全提示在 practices.ts 的 pace-finder。
 * 每一档按轻松程度打 1–5 分，打分最高的一档作为慢呼吸的默认节律
 */
export const PACE_FINDER = {
  kicker: tr('呼吸 · 工具'),
  /** 开始按钮右边的时长 */
  duration: tr('约 {0}', minutesText(7)),
  /** 可选的心率带（实验功能）；浏览器不支持蓝牙时不显示 */
  strap: { label: tr('心率带（实验）'), connect: tr('连接') },
  strapInfo: {
    privacy: tr(
      '连接后，只在这台设备上接收心率。原始逐搏数据不会保存或上传；记录里只保留平均心率、心率变异的汇总值。',
    ),
    reference: tr(
      '心率带的数据只是实验性的参考。这次每档只有 1 分钟，仍按你觉得是否轻松来选，不据此判断健康状况。',
    ),
    disconnect: tr('断开'),
    reconnect: tr('重新连接'),
    disconnected: tr('心率带已断开，可以继续按轻松程度打分。'),
    connecting: tr('正在连接…'),
    demo: tr('模拟心率带（开发演示）'),
    signal: {
      waiting: tr('等待心率读数'),
      'no-contact': tr('心率带没有贴紧皮肤'),
      'no-rr': tr('设备仅提供心率，没有逐搏间期'),
      stale: tr('暂时收不到心率信号'),
      unstable: tr('信号不稳定，请检查心率带'),
      good: tr('心率信号正常'),
    },
    errors: {
      unsupported: tr('当前浏览器不支持连接心率带。'),
      unavailable: tr('蓝牙暂时不可用，可以先不连接。'),
      denied: tr('没有获得蓝牙权限，可以检查浏览器设置。'),
      'no-service': tr('这台设备没有提供标准心率服务。'),
      failed: tr('没有连上心率带，可以重试或直接开始。'),
    },
  },
  rateUnit: tr('次/分'),
  heartUnit: tr('次/分'),
  ratingLabel: tr('{score} 分'),
  easeValue: tr('{score} 分，共 5 分'),
  tableLabel: tr('各档轻松程度'),
  resultNote: tr(
    '按刚才的轻松程度选择；评分相同时，优先选接近每分钟 5.5 次的一档。你可以随时在慢呼吸详情里调整。',
  ),
  applied: tr('已设为慢呼吸的默认节律。'),
  saveFailed: tr('这次探索还没有保存，请再试一次。'),
  saved: tr('这次探索已记在本机。'),
  retry: tr('重新保存'),
  pauseMeta: tr('按自己的节奏呼吸，准备好再继续。'),
  /** 练习中练习名下面的一行，后面接 PLAYER.paced.rate：「第 2 档，共 5 档 · 6.0 次/分」 */
  step: (n: number, total: number): string => tr('第 {0} 档，共 {1} 档', Math.round(n), Math.round(total)),
  /** 每一档结束后的打分，不能跳过，点一下就进下一档 */
  rating: { question: tr('这一档呼吸起来有多轻松？'), low: tr('1 很吃力'), high: tr('5 很轻松') },
  result: {
    title: tr('你的舒适节律'),
    /** 结果表的三列；没有连心率带时不显示心率 */
    columns: { rate: tr('节律'), ease: tr('轻松程度'), heartRate: tr('平均心率') },
    apply: tr('设为慢呼吸的节律'),
    dismiss: tr('不用了'),
  },
} as const

/* ---------- 设置 ---------- */

/** 引导详细程度（practice.notes §1 的三档；data/prefs.ts 默认标准）。说的是屏幕上出现多少句、中间安静多久 */
const GUIDANCE_LEVELS = {
  detailed: { name: tr('详细'), help: tr('说明多，安静的间隔短。适合刚开始练，或心里乱的时候。') },
  standard: { name: tr('标准'), help: tr('讲清做法，中间留出较长的安静。默认用这一档。') },
  quiet: {
    name: tr('安静'),
    help: tr('只在开头、结尾和少数地方有提示，中间可能几分钟没有新的一句。适合练熟以后。'),
  },
} as const satisfies Record<GuidanceLevel, { name: string; help: string }>

/**
 * 跟随节拍时怎样提示吸呼，与 engine/types.ts 的 CueStyle 一一对应（测试核对）；默认木音，保留 glide 偏好键。
 * 做法见 engine/session.ts 的 playSegment 和 audio/params.ts 的 CUES
 */
const CUE_STYLES = {
  glide: {
    name: tr('木音'),
    help: tr(
      '吸气、补吸和呼气开始时各响一声木质短音，吸气的音高一些，呼气的音低一些，中间留白。屏息和停顿时不响，背景声仍随吸呼起伏。默认用这一种。',
    ),
  },
  ping: {
    name: tr('钟点'),
    help: tr('每一步开始时轻响一声，吸气的音高一些，呼气的音低一些，停顿只有很轻的一下。背景声也跟着起伏。'),
  },
  bed: { name: tr('仅背景'), help: tr('没有提示音，只有背景声随吸呼起伏。没开背景声时，就只有画面和振动。') },
  off: { name: tr('静音'), help: tr('声音不跟节拍，只看画面和振动。') },
} as const

/** 设置页（PRODUCT.md §8） */
export const SETTINGS = {
  title: tr('设置'),
  navigation: tr('设置分组'),
  actions: {
    save: tr('保存'),
    cancel: tr('取消'),
    clear: tr('清除回答'),
    preview: tr('试听'),
    stopPreview: tr('停止试听'),
    presets: tr('一键填入'),
    version: tr('版本'),
    licenses: tr('开源字体许可'),
    saved: tr('已保存。'),
  },
  reminderSentence: {
    before: tr('在'),
    action: tr('，我会做'),
    fallback: tr('；如果太累，就只做'),
    end: getLanguage() === 'ja' ? 'だけにします。' : '。',
  },
  importPartial: tr('另有 {count} 条无法识别的记录，已跳过。'),
  importWeekly: tr('每周自评已一同导入。'),
  calendarEmpty: tr('先为工作日或周末选一个提醒时间。'),
  operationFailed: tr('没有完成操作，请再试一次。'),
  appearance: {
    title: tr('外观'),
    /** 与 data/types.ts 的 ThemePref 一一对应 */
    theme: { system: tr('跟随系统'), light: tr('浅色'), dark: tr('深色') },
  },
  /** 声景、音乐的名称和说明在 sounds.ts */
  sound: {
    title: tr('声音'),
    /** 对应 data/types.ts 的 Prefs.sounds：听声音时两种模式各自默认的组合 */
    defaults: {
      label: tr('默认背景声'),
      help: tr('听声音时默认用的声景和音乐，放松、睡前各一组。每次播放时都可以换。'),
    },
    volume: {
      master: tr('总音量'),
      ambience: tr('声景音量'),
      music: tr('音乐音量'),
      cues: tr('提示音与钟声音量'),
    },
    mode: { relax: tr('放松'), sleep: tr('睡前') } satisfies Record<SoundMode, string>,
    cueStyle: {
      label: tr('节拍提示'),
      help: tr('跟随节拍呼吸时，用什么声音提示吸和呼。'),
      options: CUE_STYLES,
    },
    /** audio/params.ts：开始一击，结束三击、一击比一击轻；睡前的声音不响钟（engine/types.ts 的 endBell） */
    bells: {
      label: tr('钟声'),
      help: tr(
        '开始时响一声，在背景声响起约 3 秒后；结束时响三声，一声比一声轻。睡前的声音不响钟，快到时间时慢慢变轻，直到停下。',
      ),
    },
    interval: {
      label: tr('间隔钟声'),
      help: tr('静坐计时中，每隔一段时间轻响一声。默认关闭。'),
      off: tr('关闭'),
      every: (minutes: number): string => tr('每 {0} 分钟', Math.round(minutes)),
    },
    cues: { label: tr('操作提示音'), help: tr('点「回神」、数息和段落切换时的轻声提示。') },
    haptics: {
      label: tr('振动'),
      help: tr('跟随节拍时，每次吸、呼开始轻振一下。部分手机和浏览器不支持，比如 iPhone 上的浏览器。'),
    },
  },
  /**
   * 文字引导（PRODUCT.md §5、§8）。v1 没有语音朗读，没有语音和语速的选项；引导怎样跟着练见 GUIDANCE_HOWTO
   */
  guidance: {
    title: tr('文字引导'),
    level: {
      label: tr('引导详细程度'),
      help: tr('练习中出现多少提示、留多长的安静。'),
      options: GUIDANCE_LEVELS,
      /** 这两段是难受时的出口，引导词里写明任何档位都完整引导 */
      note: tr('落地练习和呼吸空间的应对版，在任何档位都完整引导。'),
    },
    /** 安静了 20 秒以上、再出现新的一句时，轻响一声（PRODUCT.md §5）；默认打开 */
    captionCue: {
      label: tr('新的一句出现时轻提示'),
      help: tr('新的一句如果隔了 20 秒以上才出现，会轻响一声。闭着眼睛练的时候，听到再看屏幕。默认打开。'),
    },
  },
  practice: {
    title: tr('练习'),
    leadIn: {
      label: tr('开头倒数'),
      help: tr('开始前留几秒坐好，默认 5 秒。'),
      value: (seconds: number): string => tr('{0} 秒', Math.round(seconds)),
    },
    silentEnd: {
      label: tr('结尾静默'),
      help: tr('最后一分钟里，背景声在半分钟内淡出，安静一会儿，再响结束钟声。'),
    },
    checkin: {
      label: tr('练习前后自评'),
      help: tr(
        '练习前、后各问一次「此刻有多紧张？」，从 0 到 10 点一个数，可以跳过。问练习后时，不显示你练习前的分数。睡前声音之后不问。默认关闭。',
      ),
    },
    /*
     * 没有「练完感觉」的开关（DESIGN.md §13.9）：关掉它，「最近 3 次里有 2 次更紧张或很不舒服就建议换更温和的练法」
     * 这条安全规则也会跟着悄悄失效。练完感觉每次都可以跳过；选项和说明在 safety.ts 的 AFTER_PRACTICE
     */
    /** ux-elo-2003：改编自已验证的单题量表，中文版没有单独验证，只用于比较人群。题目在 RECORDS.weeklyStress */
    weekly: {
      label: tr('每周压力自评'),
      help: tr(
        '每周问一道题：这些天你的压力有多大，从 1 到 5。这道题在研究里用来比较人群，放到一个人身上只能作参考；中文版还没有单独验证。默认关闭。',
      ),
    },
  },
  /**
   * 提醒（PRODUCT.md §8；ux-gollwitzer-2006、ux-stawarz-2015）：执行意图式的一句话计划。
   * 各项对应 data/types.ts 的 Reminders（cue、action、fallback），整句由 data/ics.ts 的 planSentence 拼出，
   * 「太累」是那里的固定说法（PLAN_OBSTACLE），不能另选
   */
  reminder: {
    title: tr('提醒'),
    intro: tr('写下一个具体的计划：在哪件事之后练，练什么，太累时只做多少。'),
    template: tr('在【刷牙后】，我会做【3 分钟呼吸】；如果【太累】，就只做【1 分钟】。'),
    fields: {
      cue: tr('在什么之后'),
      action: tr('做什么'),
      fallback: tr('太累时只做'),
      time: tr('提醒时间'),
      weekday: tr('工作日'),
      weekend: tr('周末'),
      off: tr('不提醒'),
      custom: tr('自己写'),
    },
    /** 情境的菜单（ux.notes §5） */
    cues: [tr('起床后'), tr('刷牙后'), tr('午饭后'), tr('到公司后'), tr('关灯前')],
    /** 5 分钟是八周正念的保底日 */
    fallbacks: [tr('1 分钟'), tr('3 分钟'), tr('5 分钟')],
    /**
     * 一键填入的计划，三个空和 Reminders 同名。第一条就是规格里的例子；
     * 第二条与八周正念第 1 周第 1 天的提示一致
     */
    presets: [
      { cue: tr('刷牙后'), action: tr('3 分钟慢呼吸'), fallback: tr('1 分钟') },
      { cue: tr('起床后'), action: tr('10 分钟专注呼吸'), fallback: tr('5 分钟') },
      { cue: tr('午饭后'), action: tr('三分钟呼吸空间'), fallback: tr('1 分钟') },
      { cue: tr('关灯前'), action: tr('5 分钟慢呼吸'), fallback: tr('1 分钟') },
    ],
    /** 「做什么」由练习和时长拼成：「5 分钟慢呼吸」；名字里已经带时长（如「一分钟停一停」）时只用名字 */
    actionText: (minutes: number, name: string): string =>
      getLanguage() === 'ja'
        ? name.includes('分')
          ? name
          : `${minutesText(minutes)}の「${name}」`
        : name.includes(tr('分钟'))
          ? name
          : join(minutesText(minutes), name),
    calendar: {
      button: tr('生成日历文件'),
      help: [
        tr('回神不能在后台给你发通知。生成的日历文件（.ics）导入手机或电脑的日历后，由日历按时提醒你。'),
        tr('工作日和周末可以设不同的时间。'),
        tr('改了计划，重新生成并导入就好。日历通常会更新原来的提醒；如果出现两条，删掉旧的那条。'),
        tr('如果到时没有提醒，请在日历里为这个日程打开通知。'),
        tr('在微信里打开时可能无法下载文件，请先选择在浏览器中打开。'),
      ],
    },
  },
  /** 健康情况检查、停止指引、求助电话和每月自查的内容都在 safety.ts */
  safety: {
    why: tr('为什么这样调整'),
    title: tr('安全'),
    screening: {
      label: tr('健康情况检查'),
      help: tr(
        '可选。回答几个关于健康情况的问题，回神会据此调整推荐和默认时长，并隐藏个别可能不适合你的练习。答案只保存在这台设备上。',
      ),
    },
    stop: { label: tr('停止指引'), help: tr('什么情况下应该停下来，停下来之后怎么做。') },
    help: { label: tr('求助方式'), help: tr('心理援助热线和急救电话，不联网也能打开。') },
    /** safety-britton-2021：逐项问具体的变化，持续超过一天就建议暂停 */
    monthly: {
      label: tr('练习后的变化自查'),
      help: tr(
        '每月一次，可以跳过。逐项问问练习以后有没有出现睡眠变差、情绪发木这类变化。有一项持续或反复出现超过一天，回神会建议你暂停或减少练习，并和医生或心理专业人员谈谈。',
      ),
    },
  },
  data: {
    title: tr('数据'),
    /** 与 data/types.ts 的 StorageMode 一一对应 */
    storage: {
      label: tr('存储方式'),
      indexeddb: tr('练习记录保存在这台设备的浏览器里。'),
      local: tr('这个浏览器暂时不能使用本地数据库，记录改存在浏览器的本地存储里，最多保留最近 500 条。'),
      memory: tr(
        '这个浏览器不允许保存数据（常见于无痕模式），关闭页面后记录会丢失。需要保留的话，请先导出。',
      ),
      clearWarning: tr('清除浏览器的网站数据，会同时删除这里的记录。换设备或清理浏览器之前，请先导出。'),
    },
    export: {
      label: tr('导出'),
      json: tr('导出完整备份（JSON）'),
      csv: tr('导出表格（CSV）'),
      help: tr(
        'JSON 文件包含全部记录，可以在另一台设备上导入；CSV 文件可以用表格软件打开，但不能导入。导出的文件请自己保管。',
      ),
    },
    import: {
      label: tr('导入备份'),
      help: tr('从回神导出的 JSON 文件导入，已有的记录不会重复。'),
      result: (added: number, skipped: number): string =>
        tr('导入 {0} 条，跳过已有的 {1} 条。', Math.round(added), Math.round(skipped)),
      invalid: tr('这个文件无法导入。只支持回神导出的 JSON 文件。'),
    },
    /** 二次确认（ux-npc-2021-pipl）：第一步说清删什么，第二步说清删不掉什么 */
    deleteAll: {
      label: tr('删除全部数据'),
      first: {
        title: tr('删除全部数据？'),
        body: tr(
          '这会删除这台设备上的练习记录、计划进度、设置、提醒计划和健康情况检查的回答。需要的话，先导出一份备份。',
        ),
        confirm: tr('继续'),
        cancel: tr('取消'),
      },
      second: {
        title: tr('再确认一次'),
        body: tr('删除后无法恢复。已经导入日历的提醒不会跟着删除，需要在日历里自己删掉。'),
        confirm: tr('删除全部'),
        cancel: tr('取消'),
      },
      done: tr('已删除全部数据。'),
    },
    /** 列出应用发出的全部网络请求（ux-apa-2026-app-evaluation-model、ux-huckvale-2019） */
    privacy: {
      label: tr('隐私说明'),
      lines: [
        tr(
          '回神没有账号，也没有保存你数据的服务器。练习记录、计划进度、设置和健康情况检查的回答，都只保存在这台设备的浏览器里。',
        ),
        tr('回神只在加载应用本身时联网：第一次打开，以及检查和下载新版本的时候。加载完成后，断网也能练习。'),
        tr('和打开任何网页一样，提供下载的服务器能看到你的 IP 地址；这些请求里没有你的练习数据。'),
        tr('应用里没有统计、广告或追踪代码，不使用第三方服务；字体也随应用一起下载。'),
        tr('连接心率带时，数据通过蓝牙直接传到这台设备，不经过网络。'),
      ],
    },
  },
} as const

/* ---------- 依据 ---------- */

/** 等级的定义，与 PRODUCT.md §9 一字不差（测试核对） */
const GRADE_DEFINITIONS = {
  A: tr('多项低偏倚随机试验一致，或有指南推荐。'),
  B: tr('有元分析支持但异质性或偏倚有疑虑，或至少一项大型严格随机试验；方向一致。'),
  C: tr('有限或不一致：小型或探索性试验、试点、机制上合理；不能证明比更简单的做法好。'),
  D: tr('几乎没有对照证据、证据显示没有优势，或风险大于收益。'),
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
    name: tr('4-7-8 呼吸'),
    grade: 'D',
    reason: tr(
      '只找到一项没有对照组的单次研究（43 人），心率变异性的结果有升有降；7 秒的屏息也超过了回神 6 秒的上限。',
    ),
    evidence: ['breathing-vierra-2022'],
  },
  {
    name: tr('Wim Hof 及过度换气法'),
    grade: 'D',
    reason:
      // 这项试验只报告了各组的平均值，没有检验它和其他组的差别（breathing-balban-2023-nulls），所以只说平均幅度
      tr(
        '每分钟 15–30 次的深呼吸，是医院做脑电图时诱发癫痫发作的方法，常带来头晕、手脚发麻；一项探索性试验比较了几种练法，它让焦虑减轻的平均幅度比其他几种都小。',
      ),
    evidence: [
      'safety-peltola-2023',
      'breathing-bscn-2013',
      'safety-fincham-2023',
      'breathing-kox-2014',
      'breathing-balban-2023-nulls',
    ],
  },
  {
    name: tr('过度换气后屏息'),
    grade: 'D',
    reason: tr(
      '先快速深呼吸再屏息，会推迟身体「该换气了」的信号，人可能毫无预兆地失去意识；在水里可能致命。',
    ),
    evidence: ['breathing-boyd-2015', 'safety-boyd-2015', 'safety-wimhofmethod-2026'],
  },
  {
    name: tr('布泰科呼吸法（Buteyko）'),
    grade: 'D',
    reason: tr(
      '没有找到把它当作减压方法的研究，相关的试验只有一两项，都针对哮喘。它讲究的轻柔、用鼻子、不用力，慢呼吸里也是这样做的。',
    ),
    evidence: ['breathing-santino-2020'],
  },
  {
    name: tr('交替鼻孔呼吸'),
    grade: 'D',
    reason: tr('没有找到符合纳入标准的系统综述，暂不提供。'),
    evidence: [],
  },
  {
    name: tr('长于 6 秒的屏息'),
    grade: 'D',
    // 箱式呼吸每步可在本次练习中调到 6 秒，上限来自产品的谨慎安排。
    reason: tr(
      '没有找到更长的屏息有额外好处的证据。回神里最长的停顿是箱式呼吸的 6 秒；6 秒这个上限是我们的谨慎判断，不是研究结论。',
    ),
    evidence: [],
  },
  {
    name: tr('咒语冥想 / 超觉静坐'),
    grade: 'D',
    reason: tr(
      '一篇汇总 47 项随机试验的综述里，以咒语为主的冥想（包括超觉静坐）在各项结果上都没有显示改善，不过这类试验很少。超觉静坐是认证老师面授的专有课程，应用无法照做。',
    ),
    evidence: ['meditation-goyal-2014', 'meditation-brook-2013'],
  },
  {
    name: tr('瑜伽休息术（NSDR）'),
    grade: 'C',
    reason: tr(
      '73 项研究汇总出的效果看起来中到大，但研究质量低，作者认为很可能被高估；以「NSDR」为名的做法没有单独检验过。',
    ),
    evidence: ['meditation-ghai-2026'],
  },
  {
    name: tr('528 Hz / 索尔费吉奥频率'),
    grade: 'D',
    reason: tr(
      '支持它的研究只有 9 人、每次听 5 分钟，也没有直接比较 528 Hz 和 440 Hz。回神的音乐按 440 Hz 的标准音调音。',
    ),
    evidence: ['sound-akimoto-2018'],
  },
  {
    name: tr('双耳节拍'),
    grade: 'C',
    reason: tr(
      '有元分析报告了正面结果，但多数研究的对照没能把节拍和声音本身分开；14 项脑电研究里只有 5 项看到大脑活动跟着节拍走，2026年一项 90 人的随机试验也没有发现它减轻焦虑。暂列为待观察。',
    ),
    evidence: ['sound-garciaargibay-2019', 'sound-xiong-2025', 'sound-ingendoh-2023', 'sound-akkurt-2026'],
  },
] as const satisfies readonly NotAdopted[]

/** 依据页（PRODUCT.md §9） */
export const EVIDENCE = {
  title: tr('依据'),
  /** 页头的说明：前半是出处的条数，后半是 reviewedShort（DESIGN.md §13.8） */
  sources: (n: number): string => tr('{0} 条出处，逐条核对', Math.round(n)),
  /** method.reviewed 的简写，用在页头 */
  reviewedShort: tr('最后核对：{0}', REVIEWED_ON),
  intro: tr(
    '回神的默认设置，找得到研究的都列在这里；找不到的，写明是我们的安排。每条结论都写明和什么比较、效果多大、有什么局限，以及不支持它的结果。',
  ),
  method: {
    title: tr('这些结论是怎么来的'),
    lines: [
      tr(
        '我们检索系统综述、随机对照试验和临床指南，逐条对照原文或摘要，核对样本、对照组和数字。找不到出处的说法不用。',
      ),
      tr(
        '效应量约 0.2 算小，约 0.5 算中等，0.8 以上算大。和不练习相比，效果通常显得更大；和运动、心理咨询等其他积极的方法相比，差别往往很小。所以每条结论都写明比较对象。',
      ),
      // meditation-goldberg-2022
      tr(
        '这些研究大多来自欧美。一篇汇总正念研究的综述里，来自亚洲的研究只占 8.1%，这些结论放在中国人身上是否一样，还缺少研究。',
      ),
      tr('「今日」按时段推荐练习，是我们自己的安排；练习时间对效果有没有影响，我们没有找到研究。'),
    ],
    /** 每年复核一次（ux-nice-2022-esf） */
    reviewed: tr('最后核对：{0} · 下次核对：{1}', REVIEWED_ON, NEXT_REVIEW),
    /** 只显示第一段时，展开其余几段的按钮：methodMore(lines.length - 1) */
    more: (n: number): string => tr('展开其余 {0} 段', Math.round(n)),
  },
  grades: {
    title: tr('证据等级'),
    names: GRADE_NAMES,
    definitions: GRADE_DEFINITIONS,
    scope: tr('等级只针对文案里提到的那个结果，不代表这项练习整体的好坏。'),
  },
  /** 写在效果后面的括注，如「可能有一点帮助（证据：中等）」 */
  tag: (grade: Grade): string => tr('证据：{0}', GRADE_NAMES[grade]),
  /** 结论一节的分类，与卡片的类别对应；「全部」在最前 */
  filters: { all: ALL, meditation: tr('冥想'), breathing: tr('呼吸'), sound: tr('声音'), safety: tr('安全') },
  /** 结论一节标题右边：当前的分类和卡片数，「呼吸 · 3 条」 */
  filterCount: (label: string, n: number): string => tr('{0} · {1} 条', label, Math.round(n)),
  /**
   * 证据卡片的各栏，按 PRODUCT.md §9 的顺序。没有「可信度」一栏（DESIGN.md §8.10）：等级之外再给一个高低，
   * 读起来像同一件事说了两遍；单项研究本身的分量，写在「研究类型」或「局限」里
   */
  card: {
    conclusion: tr('结论'),
    effect: tr('效应量与 95% CI'),
    design: tr('研究类型、样本与对照'),
    grade: tr('等级'),
    limits: tr('局限'),
    contrary: tr('相反证据'),
    source: 'DOI',
    /** 收起的卡片右下角的展开按钮 */
    expand: tr('展开'),
    collapse: tr('收起'),
  },
  unknown: {
    title: tr('我们还不知道的'),
    lines: [
      tr('回神本身没有做过试验。只用手机应用练习的研究里，焦虑和低落平均只是小幅减轻。'),
      tr('三分钟呼吸空间还没有单独的随机试验；包含它的完整课程有研究支持，不等于它单独也有效。'),
      tr('坐着还是躺着、睁眼还是闭眼更好，没有找到比较研究。'),
      tr('数息准确率能不能反映正念程度，研究结论不一致。'),
      tr('练习前后自评和每周压力自评的题目，还没有中文版的验证。'),
    ],
  },
  notAdopted: {
    title: tr('未采用'),
    /** 标题右边的项数 */
    count: (n: number): string => tr('{0} 项', Math.round(n)),
    intro: tr('下面这些方法，回神不提供，原因写在各自下面。'),
    items: NOT_ADOPTED,
  },
  empty: { title: tr('没有符合条件的研究'), body: tr('换一个分类或等级再看看。') },
} as const

/* ---------- 关于 ---------- */

/** 关于（PRODUCT.md §8）。免责声明全文在 safety.ts 的 DISCLAIMERS，求助电话只放在「求助方式」一处 */
export const ABOUT = {
  title: tr('关于回神'),
  lines: [
    tr('回神免费，不用注册；打开过一次之后，没有网络也能用。'),
    tr('所有声音都在你的设备上实时合成，没有用录音素材。引导是屏幕上的文字，暂时没有语音。'),
  ],
  version: (version: string): string => join(tr('版本'), version),
  /** 字体见 docs/design/final/tokens.css：标题和数字用随应用发布的子集，正文用系统字体 */
  fonts: {
    title: tr('字体'),
    body: tr(
      '标题使用思源宋体（Noto Serif SC），数字和拉丁字母使用 Inter，两者都按 SIL Open Font License 1.1 授权；随应用发布的只是界面用到的那部分字。正文使用设备自带的字体。',
    ),
  },
  deleteData: tr('删除全部数据：设置 › 数据 › 删除全部数据。'),
} as const

/* ---------- 系统 ---------- */

/** 找不到页面、页面出错、有新版本（DESIGN.md §13.14），以及浏览器标签上的标题（§13.1） */
export const SYSTEM = {
  /** 「今日 · 回神」；首次使用页只写「回神」 */
  documentTitle: (page: string): string => tr('{0} · 回神', page),
  notFound: { title: tr('找不到这个页面'), home: tr('回到今日') },
  error: {
    title: tr('这个页面出了问题'),
    body: tr('练习记录没有受影响。'),
    home: tr('回到今日'),
    reload: tr('重新加载'),
  },
  /** 练习中不弹，等小结关掉以后再说 */
  update: { message: tr('有新版本'), action: tr('更新') },
} as const
export const HELP = { sources: tr('来源') } as const
export const LANGUAGE = {
  japanese: tr('日本語'),
  chinese: tr('中文'),
  toJapanese: tr('切换到日语'),
  toChinese: tr('中国語に切り替える'),
} as const
