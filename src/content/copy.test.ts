import { describe, expect, it } from 'vitest'
import type { Reminders, StorageMode, ThemePref } from '@/data/types'
import type { CueStyle } from '@/engine/types'
import * as copy from './copy'
import {
  ABOUT,
  CATALOGUE,
  DETAIL,
  EVIDENCE,
  GRADE_NAMES,
  GUIDANCE_HOWTO,
  PACE_FINDER,
  PLAYER,
  PROGRAM,
  RECORDS,
  SETTINGS,
  SUMMARY,
  SYSTEM,
  TODAY,
  WELCOME,
} from './copy'
import { CATEGORY_LABEL, isOffered, PRACTICE_BY_ID, PRACTICES } from './practices'
import { findForbidden, STOP_GUIDANCE } from './safety'
import type { Grade, GuidanceLevel } from './types'

/** 规格原文：等级定义、提醒句式要和它一字不差 */
const PRODUCT = Object.values(
  import.meta.glob<string>('/docs/PRODUCT.md', { eager: true, query: '?raw', import: 'default' }),
)[0]

/** 研究组定稿的证据库（已提交到仓库）。用相对路径：以 / 开头的写法在项目的 vite 配置下读不到 */
const EVIDENCE_FILES = import.meta.glob<unknown>('../../docs/research/evidence.json', {
  eager: true,
  import: 'default',
})

interface Found {
  path: string
  text: string
}

/** 一个值里的全部字符串和函数，带上路径，失败时能定位 */
function walk(value: unknown, path: string, strings: Found[], functions: string[]): void {
  if (typeof value === 'string') strings.push({ path, text: value })
  else if (typeof value === 'function') functions.push(path)
  else if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) walk(v, `${path}[${i}]`, strings, functions)
  } else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`, strings, functions)
  }
}

const STRINGS: Found[] = []
const FUNCTIONS: string[] = []
for (const [name, value] of Object.entries(copy)) walk(value, name, STRINGS, FUNCTIONS)

/** 每个文案函数都用典型的参数调用一次，拼出来的句子和固定的句子一样要过排版检查 */
const SAMPLES: Record<string, () => string | string[]> = {
  'TODAY.minutes': () => TODAY.minutes(5),
  'TODAY.program.day': () => TODAY.program.day('八周正念', 3, 2),
  'TODAY.program.short': () => TODAY.program.short('四周呼吸'),
  'TODAY.program.extra': () => TODAY.program.extra('八周正念'),
  'TODAY.program.newWeek': () => TODAY.program.newWeek(3),
  'TODAY.program.next': () => TODAY.program.next(2, 4),
  'TODAY.week.value': () => TODAY.week.value(3, 46),
  'CATALOGUE.folio': () => CATALOGUE.folio(17),
  'CATALOGUE.count': () => CATALOGUE.count(10),
  'CATALOGUE.about': () => CATALOGUE.about(7),
  'CATALOGUE.programs.inProgress': () => CATALOGUE.programs.inProgress(3, 2),
  'CATALOGUE.programs.weeks': () => CATALOGUE.programs.weeks(8),
  'CATALOGUE.gradeLabel': () => (['A', 'B', 'C', 'D'] as const).map(CATALOGUE.gradeLabel),
  'CATALOGUE.hidden': () => [CATALOGUE.hidden(['箱式呼吸']), CATALOGUE.hidden(['开放觉察', '箱式呼吸'])],
  'DETAIL.durations': () => [DETAIL.durations(3, 20, 5), DETAIL.durations(5, 5, 5)],
  'DETAIL.slow.ratioLong': () => [DETAIL.slow.ratioLong(4.5, 6.5), DETAIL.slow.ratioLong(4.09, 5.91)],
  'PLAYER.pausePanel.meta': () => PLAYER.pausePanel.meta('03:45', '06:15'),
  'PLAYER.endDialog.recorded': () => PLAYER.endDialog.recorded('6 分钟'),
  'PLAYER.paced.hurried': () => PLAYER.paced.hurried(6),
  'PLAYER.paced.hurryMax': () => PLAYER.paced.hurryMax(6.5),
  'PLAYER.paced.rate': () => [PLAYER.paced.rate(5.5), PLAYER.paced.rate(6), PLAYER.paced.rate(6.04)],
  'PLAYER.paced.round': () => PLAYER.paced.round(12),
  'PLAYER.guided.where': () => PLAYER.guided.where(4, 6),
  'PLAYER.guided.now': () => PLAYER.guided.now('呼吸'),
  'SUMMARY.practiced': () => SUMMARY.practiced('10 分钟'),
  'SUMMARY.week': () => SUMMARY.week(3, 46),
  'SUMMARY.marks': () => SUMMARY.marks(7),
  'SUMMARY.count': () => SUMMARY.count(20, 3, 2),
  'SUMMARY.invalid': () => SUMMARY.invalid(1),
  'SUMMARY.breaths': () => SUMMARY.breaths(52, PLAYER.paced.rate(5.5)),
  'SUMMARY.hurried': () => SUMMARY.hurried(6),
  'SUMMARY.timer': () => [SUMMARY.timer(20, 4), SUMMARY.timer(5, 0)],
  'RECORDS.sessions': () => RECORDS.sessions(29),
  'RECORDS.totalMinutes': () => RECORDS.totalMinutes(46),
  'RECORDS.list.showEarlier': () => RECORDS.list.showEarlier(23),
  'RECORDS.week.value': () => RECORDS.week.value(5, 64),
  'RECORDS.byPractice.row': () => RECORDS.byPractice.row(12, 118),
  'PROGRAM.kicker': () => PROGRAM.kicker(8),
  'PROGRAM.week': () => PROGRAM.week(3, '身体扫描'),
  'PROGRAM.allWeeks': () => PROGRAM.allWeeks(8),
  'PACE_FINDER.step': () => `${PACE_FINDER.step(2, 5)} · ${PLAYER.paced.rate(6)}`,
  'EVIDENCE.sources': () => EVIDENCE.sources(174),
  'EVIDENCE.method.more': () => EVIDENCE.method.more(EVIDENCE.method.lines.length - 1),
  'EVIDENCE.filterCount': () => EVIDENCE.filterCount(EVIDENCE.filters.breathing, 3),
  'EVIDENCE.notAdopted.count': () => EVIDENCE.notAdopted.count(EVIDENCE.notAdopted.items.length),
  'SYSTEM.documentTitle': () => SYSTEM.documentTitle(TODAY.title),
  'SETTINGS.sound.interval.every': () => SETTINGS.sound.interval.every(10),
  'SETTINGS.practice.leadIn.value': () => SETTINGS.practice.leadIn.value(5),
  'SETTINGS.reminder.actionText': () => [
    SETTINGS.reminder.actionText(5, '慢呼吸'),
    SETTINGS.reminder.actionText(1, '一分钟停一停'),
  ],
  'SETTINGS.data.import.result': () => SETTINGS.data.import.result(12, 3),
  'EVIDENCE.tag': () => (['A', 'B', 'C', 'D'] as const).map(EVIDENCE.tag),
  'ABOUT.version': () => ABOUT.version('1.0.0'),
}

const OUTPUTS: Found[] = Object.entries(SAMPLES).flatMap(([path, call]) => {
  const out = call()
  return (Array.isArray(out) ? out : [out]).map(text => ({ path: `${path}()`, text }))
})

/** 全部要审读的文字：导出的固定句子，加上函数拼出来的句子 */
const ALL: Found[] = [...STRINGS, ...OUTPUTS]

const HAN = /\p{Script=Han}/u
const offenders = (bad: (text: string) => boolean): string[] =>
  ALL.filter(({ text }) => bad(text)).map(({ path, text }) => `${path}：「${text}」`)

/**
 * 日历上的日期写在一起，前后都不加空格（DESIGN.md §4.4）：「最后核对：2026年10月」「检索到2022年2月」「5月1日起」。
 * 查中文和数字之间的空格以前，先把它们换成一个词
 */
const CALENDAR = /\d{4}年(?:\d{1,2}月(?:\d{1,2}日)?)?|\d{1,2}月(?:\d{1,2}日)?(?:–\d{1,2}日)?|\d{1,2}日/gu
const undated = (text: string): string => text.replace(CALENDAR, '某日')

/** 带「次/分」的频率里，有没有不是一位小数的（DESIGN.md §4.5：「6.0 次/分」） */
const badRates = (text: string): string[] =>
  [...text.matchAll(/(\d+(?:\.\d+)?)\s*次\/分/gu)].flatMap(m => (/^\d+\.\d$/.test(m[1] ?? '') ? [] : [m[0]]))

describe('覆盖', () => {
  it('每个文案函数都有样例', () => {
    expect(FUNCTIONS.sort()).toEqual(Object.keys(SAMPLES).sort())
  })

  it('读到了足够多的文字', () => {
    expect(STRINGS.length).toBeGreaterThan(200)
  })
})

describe('措辞', () => {
  it('没有禁用词（safety.ts 的 FORBIDDEN_TERMS）', () => {
    const bad = ALL.flatMap(({ path, text }) => {
      const hits = findForbidden(text)
      return hits.length ? [`${path}：${hits.join('、')}：「${text}」`] : []
    })
    expect(bad).toEqual([])
  })

  it('没有感叹号和表情符号', () => {
    expect(offenders(t => /[!！]/.test(t))).toEqual([])
    expect(offenders(t => /\p{Extended_Pictographic}/u.test(t))).toEqual([])
  })

  it('用「你」，不用「您」；术语不混用', () => {
    expect(offenders(t => t.includes('您'))).toEqual([])
    expect(offenders(t => t.includes('静观'))).toEqual([])
    // 不提示深吸、吸满（breathing.notes §5、safety.notes §2）；「未采用」里描述别的练法时可以说「深呼吸」
    expect(offenders(t => /深吸一口气|深呼吸一下|吸满/.test(t))).toEqual([])
    // 「正念分数」只出现在否定句里
    expect(offenders(t => /(?<!不是|不叫「?)正念分数/u.test(t))).toEqual([])
  })
})

describe('排版', () => {
  it('中文与数字、拉丁字母之间留空格；日历上的日期写在一起', () => {
    expect(offenders(t => /\p{Script=Han}[0-9A-Za-z%]|[0-9A-Za-z%]\p{Script=Han}/u.test(undated(t)))).toEqual(
      [],
    )
    expect(offenders(t => /\d[  ]+[年月日]/u.test(t))).toEqual([])
  })

  it('带「次/分」的频率都保留一位小数', () => {
    expect(offenders(t => badRates(t).length > 0)).toEqual([])
  })

  it('中文句子用全角标点、直角引号和中文省略号', () => {
    // 时刻和倒计时用半角冒号：「08:05」「已练 03:45」（DESIGN.md §4.4）
    expect(offenders(t => HAN.test(t) && /[,;:?!()]/.test(t.replace(/\d{1,2}:\d{2}/g, '')))).toEqual([])
    expect(offenders(t => /["'“”‘’]/.test(t))).toEqual([])
    expect(offenders(t => t.includes('...'))).toEqual([])
  })

  it('空格只用在该用的地方', () => {
    expect(offenders(t => t !== t.trim() || t.includes('  ') || t.includes('\n'))).toEqual([])
    expect(offenders(t => /\p{Script=Han} \p{Script=Han}/u.test(t))).toEqual([])
    expect(offenders(t => / [，。；：？、）」』】]|[（「『【] /u.test(t))).toEqual([])
  })

  it('完整的句子以句号或问号结尾，标签和短语不带句号', () => {
    const sentences = [
      ...WELCOME.lines,
      ...RECORDS.count.explain,
      ...SETTINGS.data.privacy.lines,
      ...SETTINGS.reminder.calendar.help,
      ...EVIDENCE.method.lines,
      ...EVIDENCE.unknown.lines,
      ...EVIDENCE.notAdopted.items.map(i => i.reason),
      ...Object.values(EVIDENCE.grades.definitions),
      TODAY.focusCaption,
      CATALOGUE.legend,
      CATALOGUE.hidden(['箱式呼吸']),
      ...Object.values(GUIDANCE_HOWTO),
      DETAIL.notOffered,
      SETTINGS.guidance.level.help,
      SETTINGS.guidance.level.note,
      SETTINGS.guidance.captionCue.help,
      ...Object.values(DETAIL.figureCaption),
      DETAIL.slow.rateHint,
      DETAIL.slow.ratioHint,
      DETAIL.slow.warmupHint,
      PLAYER.unwellSheet.paused,
      PLAYER.pausePanel.keys,
      PLAYER.endDialog.title,
      PLAYER.endDialog.recorded('6 分钟'),
      PLAYER.count.keys,
      PLAYER.paced.selfPaced,
      PLAYER.notices.walking,
      SUMMARY.marksCaption,
      RECORDS.streakNote.body,
      RECORDS.weeklyStress.question,
      RECORDS.weeklyStress.saved,
      RECORDS.weeklyStress.notEnough,
      RECORDS.weeklyStress.caveat,
      PROGRAM.restart.title,
      PROGRAM.restart.body,
      PACE_FINDER.rating.question,
      SYSTEM.error.body,
    ]
    for (const s of sentences) expect(s, s).toMatch(/[。？]$/u)
    const labels = [
      TODAY.title,
      TODAY.change,
      TODAY.hard.rowHint,
      TODAY.weeklyStress,
      ...[TODAY.quick.pause, TODAY.quick.breathingSpace, TODAY.quick.cyclicSigh, TODAY.quick.lightSlow].map(
        q => q.structure,
      ),
      PLAYER.focus.mark,
      PLAYER.focus.markHint,
      PLAYER.focus.markHintTouch,
      PLAYER.focus.markHintKeys,
      PLAYER.unwellShort,
      PLAYER.unwellSheet.fullGuidance,
      PLAYER.unwellSheet.endPractice,
      PLAYER.pausePanel.elapsed,
      PLAYER.pausePanel.left,
      PLAYER.endDialog.cancel,
      PLAYER.endDialog.confirm,
      PLAYER.paced.hurryHint,
      PLAYER.paced.hurried(6),
      PLAYER.paced.hurryMax(6.5),
      PLAYER.guided.skip,
      PLAYER.guided.sectionLeft,
      PLAYER.count.breathCaption,
      PLAYER.count.ninthCaption,
      ...Object.values(PLAYER.readouts),
      CATALOGUE.folioEnd,
      CATALOGUE.programs.aside,
      CATALOGUE.programs.finished,
      ...Object.values(CATALOGUE.programs.plan),
      DETAIL.durationLabel,
      DETAIL.slow.warmup,
      RECORDS.local,
      RECORDS.goPractice,
      RECORDS.streakNote.title,
      RECORDS.count.howCounted,
      RECORDS.count.latest,
      RECORDS.weeklyStress.rowHint,
      RECORDS.weeklyStress.answered,
      EVIDENCE.reviewedShort,
      EVIDENCE.method.more(3),
      PROGRAM.more,
      PACE_FINDER.kicker,
      PACE_FINDER.result.title,
      PACE_FINDER.result.apply,
      SYSTEM.notFound.title,
      SYSTEM.error.title,
      SYSTEM.update.message,
      ...Object.values(SETTINGS.sound.cueStyle.options).map(o => o.name),
      ...Object.values(SETTINGS.guidance.level.options).map(o => o.name),
      SETTINGS.guidance.title,
      SETTINGS.guidance.level.label,
      SETTINGS.guidance.captionCue.label,
    ]
    for (const s of labels) expect(s, s).not.toMatch(/[。，；]$/u)
  })

  it('函数填进去的数字照常排版', () => {
    expect(TODAY.minutes(5)).toBe('5 分钟')
    expect(TODAY.program.day('八周正念', 3, 2)).toBe('八周正念 · 第 3 周第 2 天')
    expect(TODAY.week.value(3, 46)).toBe('3 天 · 46 分钟')
    expect(PLAYER.paced.rate(5.5)).toBe('5.5 次/分')
    // 带「次/分」的频率一律一位小数（DESIGN.md §4.5）
    expect(PLAYER.paced.rate(6)).toBe('6.0 次/分')
    expect(PLAYER.paced.rate(6.04)).toBe('6.0 次/分')
    expect(SUMMARY.breaths(29, PLAYER.paced.rate(5.5))).toBe('29 轮 · 5.5 次/分')
    expect(SUMMARY.count(20, 3, 2)).toBe('数对 20 轮 · 数错 3 轮 · 数乱了 2 次')
    expect(SUMMARY.timer(20, 4)).toBe('静坐 20 分钟 · 间隔钟声 4 次')
    expect(SUMMARY.timer(5, 0)).toBe('静坐 5 分钟')
    expect(PLAYER.pausePanel.meta('03:45', '06:15')).toBe('已练 03:45 · 还剩 06:15')
    expect(PLAYER.guided.where(4, 6)).toBe('现在 · 第 4 处，共 6 处')
    expect(CATALOGUE.folio(17)).toBe('17 项练习')
    expect(CATALOGUE.about(7)).toBe('约 7 分钟')
    expect(CATALOGUE.gradeLabel('B')).toBe('证据等级 B，中等')
    expect(DETAIL.durations(3, 20, 5)).toBe('3–20 分钟，默认 5 分钟')
    expect(DETAIL.durations(5, 5, 5)).toBe('5 分钟')
    expect(DETAIL.slow.ratioLong(4.5, 6.5)).toBe('吸 4.5 · 呼 6.5')
    expect(RECORDS.sessions(29)).toBe('29 次练习')
    expect(RECORDS.totalMinutes(46)).toBe('共 46 分钟')
    expect(PROGRAM.kicker(8)).toBe('计划 · 8 周')
    expect(PROGRAM.week(3, '身体扫描')).toBe('第 3 周 · 身体扫描')
    expect(PACE_FINDER.step(2, 5)).toBe('第 2 档，共 5 档')
    expect(EVIDENCE.sources(174)).toBe('174 条出处，逐条核对')
    expect(SYSTEM.documentTitle('今日')).toBe('今日 · 回神')
    expect(SETTINGS.reminder.actionText(5, '慢呼吸')).toBe('5 分钟慢呼吸')
    expect(SETTINGS.reminder.actionText(1, '一分钟停一停')).toBe('一分钟停一停')
    expect(SETTINGS.reminder.actionText(3, '三分钟呼吸空间')).toBe('三分钟呼吸空间')
    expect(ABOUT.version('1.0.0')).toBe('版本 1.0.0')
  })
})

/* ---------- 内容检查（DESIGN.md §4.4） ---------- */

/** src/content 下的全部源文件，连注释一起：日期和频率的写法在哪里都一样。测试文件里有反例，不扫 */
const SOURCES = Object.entries(
  import.meta.glob<string>('./**/*.ts', { eager: true, query: '?raw', import: 'default' }),
).filter(([file]) => !file.endsWith('.test.ts'))

const sourceLines = (bad: (line: string) => boolean): string[] =>
  SOURCES.flatMap(([file, text]) =>
    text.split('\n').flatMap((line, i) => (bad(line) ? [`${file}:${i + 1}：${line.trim()}`] : [])),
  )

describe('内容检查：日期和频率', () => {
  it('扫的是 src/content 下的全部内容文件', () => {
    const files = SOURCES.map(([file]) => file)
    expect(files).toEqual(
      expect.arrayContaining(['./copy.ts', './practices.ts', './safety.ts', './sounds.ts']),
    )
    expect(files.some(f => f.startsWith('./scripts/'))).toBe(true)
    expect(files.some(f => f.startsWith('./programs/'))).toBe(true)
  })

  it('日历上的日期写在一起：数字和年、月、日之间不留空格', () => {
    expect(sourceLines(line => /\d[  ]+[年月日]/u.test(line))).toEqual([])
  })

  it('带「次/分」的频率保留一位小数', () => {
    expect(sourceLines(line => badRates(line).length > 0)).toEqual([])
  })

  it('检查本身认得出错的写法', () => {
    expect(/\d[  ]+[年月日]/u.test('最后核对：2026 年 10 月')).toBe(true)
    expect(/\d[  ]+[年月日]/u.test('最后核对：2026年10月')).toBe(false)
    expect(badRates('已到上限：6.5 次/分 · 6 次/分 · 5.55 次/分')).toEqual(['6 次/分', '5.55 次/分'])
    expect(undated('2025年5月1日起全国可拨打')).toBe('某日起全国可拨打')
  })
})

describe('规格点名的句子', () => {
  it('今日、播放器、记录页的固定说法', () => {
    expect(TODAY.welcomeBack).toBe('欢迎回来。先做 1 分钟？')
    expect(PLAYER.focus.markHint).toBe('也可以轻点屏幕或按空格')
    expect(PLAYER.paced.hurry).toBe('有点急')
    expect(PLAYER.guided.skip).toBe('跳过这一处')
    expect(PLAYER.unwell).toBe('不舒服？')
    expect(RECORDS.focus.note).toBe('次数多少没有好坏，更常发现走神也可能说明觉察更敏锐。')
    expect(RECORDS.count.title).toBe('数息练习数据')
    expect(RECORDS.checkin.caveat).toBe('变化也包含休息本身、期待和测量误差，不能证明是练习带来的。')
    expect(RECORDS.checkin.tag).toBe('自评')
  })

  it('设计稿要的说法（DESIGN.md §14.3），与 docs/design/final/src/content.mjs 的 NEW 一字不差', () => {
    expect(TODAY.hard.rowHint).toBe('周期性叹息 · 落地练习 · 求助电话')
    expect(TODAY.quick.pause.structure).toBe('停 · 吸 · 观 · 行')
    expect(TODAY.quick.breathingSpace.structure).toBe('觉察 · 集中 · 扩展')
    expect(TODAY.quick.cyclicSigh.structure).toBe('鼻吸 · 补吸 · 长呼')
    expect(TODAY.focusCaption).toBe('每次回神，留一道竖线。')
    expect(TODAY.weeklyStress).toBe('本周压力自评')
    expect(PLAYER.focus.markHintTouch).toBe('也可以轻点屏幕的任何地方')
    expect(PLAYER.focus.markHintKeys).toBe('也可以按')
    expect(PLAYER.focus.markKey).toBe('空格')
    expect(PLAYER.unwellShort).toBe('不舒服')
    expect(PLAYER.unwell).toBe('不舒服？')
    expect(PLAYER.unwellSheet).toEqual({
      paused: '练习已暂停。',
      fullGuidance: '停止指引全文',
      endPractice: '结束练习',
    })
    expect(PLAYER.paced.hurryHint).toBe('点一下，每分钟加快 0.5 次')
    expect(PLAYER.paced.hurried(6)).toBe('已加快到 6.0 次/分')
    expect(PLAYER.paced.hurryMax(6.5)).toBe('已到上限：6.5 次/分')
    expect(PLAYER.guided.sectionLeft).toBe('这一处还剩')
    expect(PLAYER.pausePanel.elapsed).toBe('已练')
    expect(PLAYER.pausePanel.left).toBe('还剩')
    expect(PLAYER.pausePanel.keys).toBe('键盘：空格继续练习，Esc 关闭面板并继续。')
    expect(PLAYER.count.keys).toBe('也可以按 F 或 ← 记 1–8，J 或 → 记 9，退格键是数乱了。')
    expect([PLAYER.count.breathCaption, PLAYER.count.ninthCaption]).toEqual(['第 1–8 口气', '第 9 口气'])
    expect(PLAYER.endDialog.title).toBe('结束这次练习？')
    expect(PLAYER.endDialog.recorded('6 分钟')).toBe('已练 6 分钟，会记在记录里。')
    expect([PLAYER.endDialog.cancel, PLAYER.endDialog.confirm]).toEqual(['继续练习', '结束'])
    expect(PLAYER.endDialog.notRecorded).toBe(SUMMARY.notRecorded)
    expect(PLAYER.notices.walking).toBe('睁着眼睛，在安全、平坦的地方走。')
    expect(SUMMARY.marksCaption).toBe('每一道竖线是一次回神。')
    expect(SUMMARY.hurried(6)).toBe('有点急 · 加快到 6.0 次/分')
    expect(CATALOGUE.folioEnd).toBe('时长为默认值')
    expect(CATALOGUE.programs.aside).toBe('按完成的天数推进')
    expect(CATALOGUE.programs.plan['breathing-4w']).toBe('节律逐周放慢，每天 5–10 分钟')
    expect(CATALOGUE.programs.inProgress(3, 2)).toBe('进行中 · 第 3 周第 2 天')
    expect(CATALOGUE.programs.finished).toBe('已完成 · 可以重新开始')
    expect(CATALOGUE.hidden(['箱式呼吸'])).toBe('根据健康情况检查，隐藏了箱式呼吸。可以在设置 › 安全里修改。')
    expect(DETAIL.durationLabel).toBe('时长（分钟）')
    expect(DETAIL.figureCaption.slow).toBe('默认节律的 3 轮，约 33 秒。曲线升高是吸气，降低是呼气。')
    expect(DETAIL.figureCaption['breath-count']).toBe('1–8 点左边，第 9 口气点右边。')
    expect(DETAIL.slow.ratioHint).toBe('两种比例在研究里差别不大，选呼吸更舒服的一种。')
    expect(DETAIL.slow.warmup).toBe('开头 90 秒逐步放慢')
    expect(RECORDS.local).toBe('只在这台设备上')
    expect(RECORDS.count.howCounted).toBe('怎么算的')
    expect(RECORDS.goPractice).toBe('去练习')
    expect([RECORDS.prevMonth, RECORDS.nextMonth]).toEqual(['上个月', '下个月'])
    expect(RECORDS.count.latest).toBe('最近一次')
    expect(RECORDS.list.showEarlier(23)).toBe('显示更早的 23 次')
    expect(RECORDS.streakNote.title).toBe('为什么不显示连续天数')
    expect(RECORDS.weeklyStress.question).toBe('这些天你的压力有多大？')
    expect([RECORDS.weeklyStress.low, RECORDS.weeklyStress.high]).toEqual(['1 很小', '5 很大'])
    expect(RECORDS.weeklyStress.saved).toBe('已记下。')
    expect(RECORDS.weeklyStress.notEnough).toBe('答满 3 周后，这里显示每周的点。')
    expect(RECORDS.weeklyStress.rowHint).toBe('一道题，1–5')
    expect(EVIDENCE.reviewedShort).toBe('最后核对：2026年10月')
    expect(EVIDENCE.method.reviewed).toBe('最后核对：2026年10月 · 下次核对：2027年10月')
    expect(EVIDENCE.method.reviewed.startsWith(EVIDENCE.reviewedShort)).toBe(true)
    expect(EVIDENCE.method.more(EVIDENCE.method.lines.length - 1)).toBe('展开其余 3 段')
    expect([EVIDENCE.card.expand, EVIDENCE.card.collapse]).toEqual(['展开', '收起'])
    expect(EVIDENCE.filterCount('呼吸', 3)).toBe('呼吸 · 3 条')
    expect(PACE_FINDER.kicker).toBe('呼吸 · 工具')
    expect(PACE_FINDER.duration).toBe('约 7 分钟')
    expect(PACE_FINDER.result).toMatchObject({
      title: '你的舒适节律',
      apply: '设为慢呼吸的节律',
      dismiss: '不用了',
    })
    expect(PROGRAM.more).toBe('展开全文')
    expect(SYSTEM.notFound).toEqual({ title: '找不到这个页面', home: '回到今日' })
    expect(SYSTEM.error).toEqual({
      title: '这个页面出了问题',
      body: '练习记录没有受影响。',
      home: '回到今日',
      reload: '重新加载',
    })
    expect(SYSTEM.update).toEqual({ message: '有新版本', action: '更新' })
  })

  it('说法之间对得上：分类名、等级名、图注和练习本身', () => {
    // 练习页、依据页的分类与练习目录的分类同名
    const filterLabels: readonly string[] = Object.values(EVIDENCE.filters)
    for (const label of Object.values(CATEGORY_LABEL)) expect(filterLabels, label).toContain(label)
    expect(EVIDENCE.filters.all).toBe(CATALOGUE.all)
    // 图例里的等级名就是 GRADE_NAMES；点名的两个工具确实没有等级
    for (const [g, name] of Object.entries(GRADE_NAMES)) expect(CATALOGUE.legend).toContain(`${g} ${name}`)
    for (const id of ['timer', 'pace-finder'] as const) {
      expect(PRACTICE_BY_ID[id].grade, id).toBeNull()
      expect(CATALOGUE.legend).toContain(PRACTICE_BY_ID[id].name)
    }
    // 每项练习都有图注；台阶图的第一个部位与今日页那一句、引导词的段落一致
    expect(Object.keys(DETAIL.figureCaption).sort()).toEqual(PRACTICES.map(p => p.id).sort())
    expect(DETAIL.figureCaption['body-scan']).toContain('从左腿开始')
    expect(DETAIL.figureCaption['body-scan-sleep']).toContain('从头部开始')
    // 「不舒服？」面板的第二行接停止指引的一句话版本
    expect(STOP_GUIDANCE.short.endsWith('。')).toBe(true)
    // 计划页、今日页的入口和记录页的小节说的是同一件事
    expect(RECORDS.weeklyStress.prompt).toBe(TODAY.weeklyStress)
  })

  it('按设计稿删掉的键不再出现（DESIGN.md §8.10、§13.9）', () => {
    expect(Object.keys(EVIDENCE.card)).not.toContain('certainty')
    expect(Object.keys(EVIDENCE)).not.toContain('weights')
    expect(Object.keys(EVIDENCE)).not.toContain('weightsNote')
    expect(Object.keys(SETTINGS.practice)).not.toContain('feeling')
    // 证据页上只有一套评级的说法：等级
    expect(offenders(t => t.includes('可信度'))).toEqual([])
  })

  it('v1 没有语音引导（PRODUCT.md §0）：语音的设置和提示都删了，文案里不提朗读、语速和在线语音', () => {
    expect(Object.keys(SETTINGS)).not.toContain('voice')
    expect(Object.keys(PLAYER.notices)).not.toContain('voiceUnavailable')
    expect(offenders(t => /朗读|语速|在线语音|字幕|Online|Google/u.test(t))).toEqual([])
    // 睡前身体扫描 v1 不提供，练习页上不再说它在哪里（PRODUCT.md §2）
    expect(Object.keys(CATALOGUE)).not.toContain('sleepScanNote')
  })

  it('文字引导：设置的两项和怎样跟着文字练（PRODUCT.md §5、§8）', () => {
    expect(SETTINGS.guidance.title).toBe('文字引导')
    expect(SETTINGS.guidance.level.label).toBe('引导详细程度')
    expect(SETTINGS.guidance.captionCue.label).toBe('新的一句出现时轻提示')
    for (const word of ['20 秒', '轻响', '默认打开'])
      expect(SETTINGS.guidance.captionCue.help).toContain(word)
    // 详情页和播放器第一次的提示用同一套话
    expect(DETAIL.guidance).toBe(GUIDANCE_HOWTO)
    expect(PLAYER.guided.howTo).toBe(GUIDANCE_HOWTO)
    for (const word of ['屏幕', '闭上眼睛', '20 秒', '轻响']) expect(GUIDANCE_HOWTO.closable).toContain(word)
    // 睁着眼做的练习（数息、应对版、落地练习，或健康情况建议睁眼）不提闭眼
    expect(GUIDANCE_HOWTO.eyesOpen).toContain('屏幕')
    expect(GUIDANCE_HOWTO.eyesOpen).not.toMatch(/闭/u)
    expect(GUIDANCE_HOWTO.intro).toContain('文字')
  })

  it('数息：用白话写出准确率的算法，说明点得过快的轮次不计入，也说明这不是正念分数', () => {
    const text = RECORDS.count.explain.join('')
    expect(text).toContain('准确率 = 数对的轮数 ÷（数对的轮数 + 数错的轮数 + 「数乱了」的次数）')
    expect(text).toContain('点得过快的轮次不计入')
    expect(text).toContain('1.5 秒')
    expect(text).toContain('这不是正念分数')
  })

  it('首次使用：三句话说清回神是什么，再说隐私', () => {
    expect(WELCOME.lines).toHaveLength(3)
    const privacy = WELCOME.privacy.lines.join('')
    for (const word of ['注册', '这台设备', '追踪']) expect(privacy).toContain(word)
  })

  it('等级定义与 PRODUCT.md §9 一字不差', () => {
    expect(PRODUCT).toBeDefined()
    for (const [grade, definition] of Object.entries(EVIDENCE.grades.definitions)) {
      expect(PRODUCT, grade).toContain(`**${grade}**：${definition}`)
    }
    expect(GRADE_NAMES).toEqual({ A: '强', B: '中等', C: '有限', D: '不足' })
    expect(EVIDENCE.tag('B')).toBe('证据：中等')
  })

  it('提醒句式就是规格里的那一句，几个空与 Reminders 对应', () => {
    const template = '在【刷牙后】，我会做【3 分钟呼吸】；如果【太累】，就只做【1 分钟】'
    expect(PRODUCT).toContain(template)
    expect(SETTINGS.reminder.template).toBe(`${template}。`)
    const presets: readonly Pick<Reminders, 'cue' | 'action' | 'fallback'>[] = SETTINGS.reminder.presets
    expect(presets.length).toBeGreaterThanOrEqual(3)
    for (const p of presets) {
      expect(SETTINGS.reminder.cues, p.cue).toContain(p.cue)
      expect(SETTINGS.reminder.fallbacks, p.fallback).toContain(p.fallback)
      // 「做什么」写的是目录里 v1 提供的练习，写了分钟数的话，是那项练习能选的时长
      const practice = PRACTICES.find(x => p.action.endsWith(x.name))
      expect(practice, p.action).toBeDefined()
      expect(practice && isOffered(practice.id), p.action).toBe(true)
      const minutes = /^(\d+) 分钟/.exec(p.action)?.[1]
      if (minutes !== undefined) expect(practice?.durations, p.action).toContain(Number(minutes))
    }
  })

  it('设置里的选项与各层的类型一一对应', () => {
    const cueStyles: Record<CueStyle, { name: string }> = SETTINGS.sound.cueStyle.options
    expect(Object.keys(cueStyles)).toEqual(['glide', 'ping', 'bed', 'off'])
    expect(Object.values(cueStyles).map(o => o.name)).toEqual(['柔音', '钟点', '仅背景', '静音'])
    const levels: Record<GuidanceLevel, { name: string }> = SETTINGS.guidance.level.options
    expect(Object.values(levels).map(o => o.name)).toEqual(['详细', '标准', '安静'])
    const themes: Record<ThemePref, string> = SETTINGS.appearance.theme
    expect(Object.keys(themes).sort()).toEqual(['dark', 'light', 'system'])
    const storage: Record<StorageMode, string> = {
      indexeddb: SETTINGS.data.storage.indexeddb,
      local: SETTINGS.data.storage.local,
      memory: SETTINGS.data.storage.memory,
    }
    expect(Object.values(storage).every(s => s.length > 0)).toBe(true)
  })

  it('删除全部数据要确认两次，第二次说清删不掉的东西', () => {
    const { first, second } = SETTINGS.data.deleteAll
    expect(first.confirm).not.toBe(second.confirm)
    expect(second.body).toContain('无法恢复')
    expect(second.body).toContain('日历')
  })

  it('隐私说明写明只在加载应用本身时联网；v1 没有在线语音，不再讲语音', () => {
    const text = SETTINGS.data.privacy.lines.join('')
    expect(text).toContain('回神只在加载应用本身时联网')
    expect(text).not.toContain('语音')
  })

  it('「现在有点难」开头就说有伤害自己的念头时去哪里', () => {
    expect(TODAY.hard.intro).toContain('「求助方式」')
  })

  it('时段的名字都是一天里的时段，不和「听声音 · 睡前」重复', () => {
    expect(Object.values(TODAY.slots)).toEqual(['早上', '午间', '下午', '晚上', '夜里'])
  })
})

describe('未采用', () => {
  const items = EVIDENCE.notAdopted.items

  it('PRODUCT.md §2 和声音规格里不提供的方法都在，各占一条', () => {
    const required = [
      '4-7-8',
      'Wim Hof',
      '过度换气后屏息',
      'Buteyko',
      '交替鼻孔',
      '长于 6 秒的屏息',
      '超觉静坐',
      'NSDR',
      '528 Hz',
      '双耳节拍',
    ]
    for (const name of required)
      expect(
        items.filter(i => i.name.includes(name)),
        name,
      ).toHaveLength(1)
    expect(items).toHaveLength(required.length)
  })

  it('等级与规格一致；原因是一段话，不太长', () => {
    const grade = (fragment: string): Grade | undefined => items.find(i => i.name.includes(fragment))?.grade
    expect(grade('4-7-8')).toBe('D')
    for (const i of items) {
      expect(i.reason.length, i.name).toBeLessThanOrEqual(120)
      expect(i.reason, i.name).not.toContain('\n')
    }
  })

  it('证据 id 格式正确、不重复', () => {
    for (const i of items) {
      expect(new Set(i.evidence).size, i.name).toBe(i.evidence.length)
      for (const id of i.evidence) {
        expect(id).toMatch(/^(safety|breathing|meditation|practice|sound|ux)-[a-z0-9]+(-[a-z0-9]+)*$/)
      }
    }
  })

  const data = Object.values(EVIDENCE_FILES)[0]
  it('只引用证据库里没有被否决的 id', () => {
    expect(data).toBeDefined()
    const list: unknown[] = Array.isArray(data)
      ? data
      : typeof data === 'object' && data !== null && 'claims' in data && Array.isArray(data.claims)
        ? data.claims
        : []
    const citable = new Set<string>()
    for (const claim of list) {
      if (typeof claim !== 'object' || claim === null || !('id' in claim) || typeof claim.id !== 'string')
        continue
      const verdict =
        'verification' in claim && typeof claim.verification === 'object' && claim.verification !== null
          ? (claim.verification as { verdict?: unknown }).verdict
          : undefined
      const rejected =
        ('rejected' in claim && claim.rejected === true) ||
        ('status' in claim && claim.status === 'rejected') ||
        verdict === 'rejected'
      if (!rejected) citable.add(claim.id)
    }
    expect(citable.size).toBeGreaterThan(100)
    for (const id of [...items.flatMap(i => i.evidence), ...RECORDS.streakNote.evidence])
      expect(citable.has(id), id).toBe(true)
  })
})
