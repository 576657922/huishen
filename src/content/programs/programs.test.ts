/**
 * 计划的总检，取代原来 scripts/__checks__ 里的两份计划自检。
 *
 * 1. 登记：PROGRAMS 收齐每个 ProgramId，键和计划的 id 一致。
 * 2. 结构：周次从 1 起连续编号，标题不重复；每周一句主题、一段约 300–500 字的阅读说明（分段）、
 *    七天各一条提示（每条不超过 80 字，整个计划不重复）。
 * 3. 练习：每一项都在练习目录里、v1 提供（不用正念行走和睡前身体扫描，practices.ts 的 isOffered），
 *    时长是目录里的可选时长；有引导词的，时长在引导词支持的范围内，
 *    三个档位下的时间线都成立：提示时间严格递增、一句不压到下一句、结尾在结束钟声前的留白之前出完、一句不少。
 * 4. 文案：全角标点，中文与数字、字母之间留空格，引号用「」，没有感叹号和表情；没有禁用词
 *    （safety.ts 的 findForbidden，加上写作规则里的 必须、应该、频率、深呼吸 等）；术语固定；
 *    MBSR / MBCT 只在说明「借鉴」的那句话里出现；v1 的引导是屏幕上的文字，不说「录音」。
 * 5. 与产品规格和引导词一致：八周正念的周次顺序（PRODUCT §3）、每周可以加做三分钟呼吸空间、开放觉察不早于第 5 周；
 *    阅读说明里讲到的引导内容（段落顺序、短版省掉的段、四句祝愿、自我关怀三步）对得上引导词；
 *    四周呼吸的节拍逐周放慢、说明和主题里的速度与参数一致、第 4 周先做舒适节律探索；
 *    持续超过一天就暂停、找专业人员；变化约在第 8 周前后才出现。
 * 这些文字只显示、不朗读，所以按 PRODUCT §11 用阿拉伯数字。
 */
import { describe, expect, it } from 'vitest'
import { isCatalogPracticeId, isOffered, PRACTICE_BY_ID, scriptIdFor } from '@/content/practices'
import { getProgram, PROGRAMS } from '@/content/programs'
import { findForbidden } from '@/content/safety'
import { SCRIPTS } from '@/content/scripts'
import type {
  GuidanceDetail,
  GuidanceLevel,
  GuidedScript,
  Program,
  ProgramId,
  ProgramItem,
  ProgramWeek,
  ScriptLine,
} from '@/content/types'
import {
  buildTimeline,
  DEFAULT_CHARS_PER_SECOND,
  DEFAULT_END_BUFFER_SEC,
  spokenChars,
} from '@/engine/timeline'
import type { TimelineCue } from '@/engine/types'

const IDS: readonly ProgramId[] = ['mindfulness-8w', 'breathing-4w']
const WEEKS: Readonly<Record<ProgramId, number>> = { 'mindfulness-8w': 8, 'breathing-4w': 4 }

const READING_CHARS = [300, 500] as const
const TIP_MAX_CHARS = 80
const TIPS_PER_WEEK = 7
const THEME_MAX_CHARS = 40
const SUMMARY_CHARS = [120, 200] as const

const LEVELS: readonly GuidanceLevel[] = ['quiet', 'standard', 'detailed']
const DETAIL_RANK: Readonly<Record<GuidanceDetail, number>> = { core: 0, standard: 1, detailed: 2 }
const LEVEL_RANK: Readonly<Record<GuidanceLevel, number>> = { quiet: 0, standard: 1, detailed: 2 }
const CPS = DEFAULT_CHARS_PER_SECOND
const EPS = 1e-6

/** findForbidden 之外，写作规则不许出现的说法和固定术语的别名 */
const BANNED: readonly string[] = [
  '必须',
  '应该',
  '频率',
  '深吸',
  '深呼吸',
  '屏息',
  '屏住',
  '循环叹息',
  '方块呼吸',
  '慢节律呼吸',
  '共振呼吸',
  '呼吸计数',
  '正念呼吸',
  '慈爱',
  '自我同情',
  '节律探测',
  '过度呼吸',
]

/** 不含空白的字数（含标点） */
const chars = (s: string): number => s.replace(/\s/gu, '').length

const itemsOf = (w: ProgramWeek): ProgramItem[] => [
  w.daily,
  ...(w.short ? [w.short] : []),
  ...(w.extra ?? []),
]

const weekOf = (p: Program, n: number): ProgramWeek => {
  const w = p.weeks.find(x => x.week === n)
  if (!w) throw new Error(`${p.id} 缺第 ${n} 周`)
  return w
}

interface Text {
  where: string
  text: string
}

const textsOf = (p: Program): Text[] => [
  { where: '计划名', text: p.title },
  { where: '简介', text: p.summary },
  ...p.weeks.flatMap((w): Text[] => [
    { where: `第 ${w.week} 周标题`, text: w.title },
    { where: `第 ${w.week} 周主题`, text: w.theme },
    ...w.reading.split('\n\n').map((text, i) => ({ where: `第 ${w.week} 周说明第 ${i + 1} 段`, text })),
    ...w.tips.map((text, i) => ({ where: `第 ${w.week} 周第 ${i + 1} 天提示`, text })),
  ]),
]

/* ---------- 练习的时间线 ---------- */

const spokenAt = (l: ScriptLine, minutes: number, level: GuidanceLevel): boolean =>
  DETAIL_RANK[l.detail ?? 'core'] <= LEVEL_RANK[level] && (l.minMinutes ?? 0) <= minutes

/** 这个时长、这个档位应当说出的字幕，按顺序 */
function expectedTexts(s: GuidedScript, minutes: number, level: GuidanceLevel): string[] {
  const kept = s.sections.filter(x => x.omitAtOrBelow === undefined || x.omitAtOrBelow < minutes)
  return [...s.opening, ...kept.flatMap(x => x.intro), ...s.closing]
    .filter(l => spokenAt(l, minutes, level) && spokenChars(l.say ?? l.text) > 0)
    .map(l => l.text)
}

const occupiedSec = (c: TimelineCue): number =>
  Math.max(spokenChars(c.text ?? ''), spokenChars(c.say ?? '')) / (CPS * (c.rate ?? 1))

/** 计划里一项练习用哪份引导词；计时、测定没有引导词 */
function scriptOf(item: ProgramItem): GuidedScript | null {
  if (!isCatalogPracticeId(item.practiceId)) return null
  const sid = scriptIdFor(item.practiceId, item.minutes)
  return sid ? SCRIPTS[sid] : null
}

/** 某个时长、标准档实际排出的段落名，按顺序 */
const sectionTitles = (s: GuidedScript, minutes: number): string[] =>
  buildTimeline(s, minutes, { level: 'standard' }).sections.map(x => x.title)

const alwaysSaid = (l: ScriptLine): boolean => (l.detail ?? 'core') === 'core' && l.minMinutes === undefined

/* ---------- 测试 ---------- */

/** safety.test.ts 会把 programs/ 下的每个文件都导入一遍来扫描禁用词，本文件也在其中；只在本文件自己运行时登记测试 */
const testPath = expect.getState().testPath
const importedElsewhere = typeof testPath === 'string' && !testPath.endsWith('programs.test.ts')

describe.skipIf(importedElsewhere)('计划', () => {
  it('PROGRAMS 收齐每个 ProgramId，键和计划的 id 一致', () => {
    expect(Object.keys(PROGRAMS).sort()).toEqual([...IDS].sort())
    for (const id of IDS) {
      expect(PROGRAMS[id].id).toBe(id)
      expect(getProgram(id)).toBe(PROGRAMS[id])
    }
    expect(() => getProgram('toString' as ProgramId)).toThrow(RangeError)
  })

  describe.each(IDS)('%s', id => {
    const program = PROGRAMS[id]

    it('周次从 1 起连续编号，标题不重复；简介长度合适', () => {
      expect(program.weeks.map(w => w.week)).toEqual(Array.from({ length: WEEKS[id] }, (_, i) => i + 1))
      expect(new Set(program.weeks.map(w => w.title)).size).toBe(program.weeks.length)
      expect(Array.isArray(program.evidence)).toBe(true)
      const n = chars(program.summary)
      expect(n, `简介 ${n} 字`).toBeGreaterThanOrEqual(SUMMARY_CHARS[0])
      expect(n, `简介 ${n} 字`).toBeLessThanOrEqual(SUMMARY_CHARS[1])
    })

    it.each(program.weeks.map(w => [w.week, w] as const))(
      '第 %d 周：一句主题，阅读说明 300–500 字并分段，七条提示各不超过 80 字',
      (_, w) => {
        expect(w.theme).not.toContain('\n')
        expect(chars(w.theme), w.theme).toBeLessThanOrEqual(THEME_MAX_CHARS)
        const n = chars(w.reading)
        expect(n, `阅读说明 ${n} 字`).toBeGreaterThanOrEqual(READING_CHARS[0])
        expect(n, `阅读说明 ${n} 字`).toBeLessThanOrEqual(READING_CHARS[1])
        for (const para of w.reading.split('\n\n')) {
          expect(para, '段落之间只用一个空行，段落首尾没有空白').toBe(para.trim())
          expect(para).not.toBe('')
          expect(para).not.toContain('\n')
        }
        expect(w.tips).toHaveLength(TIPS_PER_WEEK)
        for (const t of w.tips) expect(chars(t), t).toBeLessThanOrEqual(TIP_MAX_CHARS)
      },
    )

    it('提示在整个计划里不重复', () => {
      const tips = program.weeks.flatMap(w => w.tips)
      expect(new Set(tips).size).toBe(tips.length)
    })

    it('每一项练习都在目录里、v1 提供，时长是目录里的可选时长，在引导词支持的范围内', () => {
      for (const w of program.weeks) {
        for (const item of itemsOf(w)) {
          const where = `第 ${w.week} 周 ${item.practiceId} ${item.minutes} 分钟`
          expect(isCatalogPracticeId(item.practiceId), where).toBe(true)
          // 正念行走、睡前身体扫描要等真人录音（PRODUCT.md §2），计划的哪一天都不用
          expect(isOffered(item.practiceId), `${where}：v1 不提供`).toBe(true)
          if (!isCatalogPracticeId(item.practiceId)) continue
          const practice = PRACTICE_BY_ID[item.practiceId]
          expect(practice.durations, where).toContain(item.minutes)
          const script = scriptOf(item)
          expect(script === null, `${where}：有引导词的练习都要对上一份引导词`).toBe(
            practice.scriptId === undefined,
          )
          if (script) {
            expect(item.minutes, where).toBeGreaterThanOrEqual(script.minMinutes)
            expect(item.minutes, where).toBeLessThanOrEqual(script.maxMinutes)
          }
        }
      }
    })

    it('每一项有引导词的练习，三个档位的时间线都成立，一句不少', () => {
      const seen = new Set<string>()
      for (const w of program.weeks) {
        for (const item of itemsOf(w)) {
          const script = scriptOf(item)
          const key = `${script?.id}:${item.minutes}`
          if (!script || seen.has(key)) continue
          seen.add(key)
          for (const level of LEVELS) {
            const where = `${script.id} ${item.minutes} 分钟 ${level}`
            const prosody = script.id === 'body-scan-sleep' ? 'settle' : 'steady'
            const tl = buildTimeline(script, item.minutes, { level, prosody })
            const speaks = tl.cues.filter(c => c.kind === 'speak')
            for (const [i, cue] of tl.cues.entries()) {
              const next = tl.cues[i + 1]
              if (next) expect(next.t, where).toBeGreaterThan(cue.t)
              if (cue.kind === 'speak' && next)
                expect(cue.t + occupiedSec(cue), `${where}「${cue.text}」`).toBeLessThanOrEqual(next.t + EPS)
            }
            const last = speaks.at(-1)
            expect(last, where).toBeDefined()
            if (last)
              expect(last.t + occupiedSec(last), where).toBeLessThanOrEqual(
                tl.duration - DEFAULT_END_BUFFER_SEC + EPS,
              )
            const said = speaks.map(c => c.text ?? '')
            let from = 0
            for (const text of expectedTexts(script, item.minutes, level)) {
              const at = said.indexOf(text, from)
              expect(at, `${where} 没说「${text}」`).toBeGreaterThanOrEqual(0)
              from = at + 1
            }
          }
        }
      }
    })

    it('文案：全角标点、中文与数字和字母之间留空格、引号用「」，没有感叹号、表情和禁用词', () => {
      for (const { where, text } of textsOf(program)) {
        expect(text, `${where} 首尾有空白`).toBe(text.trim())
        expect(text, `${where} 有感叹号`).not.toMatch(/[!！]/u)
        expect(text, `${where} 有表情符号`).not.toMatch(/\p{Extended_Pictographic}/u)
        expect(text, `${where} 有半角标点`).not.toMatch(/\p{Script=Han}[,.;:?()]|[,.;:?()]\p{Script=Han}/u)
        expect(text, `${where} 引号应为「」`).not.toMatch(/["“”‘’]/u)
        expect(text, `${where} 有全角数字或字母`).not.toMatch(/[０-９Ａ-Ｚａ-ｚ]/u)
        expect(text, `${where} 中文与数字、字母之间缺空格`).not.toMatch(
          /\p{Script=Han}[A-Za-z0-9]|[A-Za-z0-9]\p{Script=Han}/u,
        )
        expect(text, `${where} 有多余的空格`).not.toMatch(/ {2}/u)
        expect(text.split('「').length, `${where} 引号不成对`).toBe(text.split('」').length)
        expect(findForbidden(text), where).toEqual([])
        for (const w of BANNED) expect(text.includes(w), `${where} 含「${w}」`).toBe(false)
        // v1 没有语音引导（PRODUCT.md §0）：讲练习内容说「引导」，不说「录音」
        expect(text, `${where}：引导是屏幕上的文字，不是录音`).not.toContain('录音')
      }
    })
  })

  describe('八周正念', () => {
    const program = PROGRAMS['mindfulness-8w']
    const [w1, w2, w3, w4, w5, w6, w7, w8] = program.weeks

    it('每周的主练习符合 PRODUCT §3；保底日是同一练习的 5 分钟版（第 7 周的主练习本身只有 5 分钟）', () => {
      expect(program.weeks.map(w => `${w.daily.practiceId}:${w.daily.minutes}`)).toEqual([
        'focus:10',
        'focus:10',
        'body-scan:10',
        'focus:10',
        'open-awareness:10',
        'loving-kindness:10',
        'self-compassion:5',
        'focus:10',
      ])
      for (const w of program.weeks) {
        if (w.week === 7) expect(w.short).toBeUndefined()
        else expect(w.short).toEqual({ practiceId: w.daily.practiceId, minutes: 5 })
      }
    })

    it('每周都可以加做三分钟呼吸空间；开放觉察不早于第 5 周；第 5 周可以改练专注呼吸', () => {
      for (const w of program.weeks) {
        expect(w.extra, `第 ${w.week} 周`).toContainEqual({ practiceId: 'breathing-space', minutes: 3 })
        if (w.week < 5)
          expect(
            itemsOf(w).some(x => x.practiceId === 'open-awareness'),
            `第 ${w.week} 周`,
          ).toBe(false)
      }
      expect(w5?.extra).toContainEqual({ practiceId: 'focus', minutes: 10 })
      expect(w5?.extra).toContainEqual({ practiceId: 'focus', minutes: 5 })
      expect(w7?.extra?.[0]).toEqual({ practiceId: 'focus', minutes: 5 })
    })

    it('阅读说明讲到的引导内容和引导词一致', () => {
      // 第 1 周：三分钟呼吸空间三步
      expect(sectionTitles(SCRIPTS['breathing-space'], 3)).toEqual(['觉察', '集中', '扩展'])
      expect(w1?.reading).toContain('先觉察此刻，再集中到呼吸，最后扩展到全身')
      // 第 1、4 周：专注呼吸任何档位都说可以把锚点换成双脚，结尾放宽到整个身体
      const focus = SCRIPTS.focus
      const focusLines = [...focus.opening, ...focus.sections.flatMap(s => s.intro)]
      expect(focusLines.some(l => alwaysSaid(l) && l.text.includes('双脚'))).toBe(true)
      expect(focusLines.some(l => alwaysSaid(l) && l.text.includes('换成你选的地方'))).toBe(true)
      expect(sectionTitles(focus, 5).at(-1)).toBe('整个身体')
      expect(w4?.reading).toContain('引导最后会放宽到整个身体')
      // 第 3 周：身体扫描从左脚开始，部位可以跳过，疼得太厉害可以回到呼吸
      const scan = SCRIPTS['body-scan']
      expect(scan.sections.find(s => s.skippable)?.intro[0]?.text).toContain('左脚')
      expect(
        scan.sections.flatMap(s => s.intro).some(l => l.text.includes('疼') && l.text.includes('回到呼吸')),
      ).toBe(true)
      expect(w3?.reading).toContain('从左脚开始')
      expect(w3?.reading).toContain('跳过这一处')
      // 第 5 周：开放觉察 10 分钟依次六段，5 分钟省掉身体和无拣择觉察
      const open = SCRIPTS['open-awareness']
      expect(sectionTitles(open, 10)).toEqual([
        '呼吸',
        '身体',
        '声音',
        '想法和情绪',
        '无拣择觉察',
        '回到呼吸',
      ])
      expect(sectionTitles(open, 5)).toEqual(['呼吸', '声音', '想法和情绪', '回到呼吸'])
      expect(open.sections.flatMap(s => s.intro).some(l => l.text.includes('电视剧的字幕'))).toBe(true)
      expect(w5?.reading).toContain('5 分钟的版本省掉身体和无拣择觉察两段')
      // 第 6 周：慈心 10 分钟的顺序和四句祝愿
      const kind = SCRIPTS['loving-kindness']
      expect(sectionTitles(kind, 10)).toEqual([
        '安顿',
        '亲近的人',
        '自己',
        '朋友',
        '不太熟的人',
        '所有生命',
        '安静片刻',
      ])
      const kindLines = kind.sections.flatMap(s => s.intro).map(l => l.text)
      for (const wish of ['平安', '健康', '内心安宁', '自在']) {
        expect(kindLines, wish).toContain(`愿你${wish}。`)
        expect(w6?.reading).toContain(`愿你${wish}`)
      }
      // 第 7 周：自我关怀三步，触碰在第二步和第三步之间，三四分的小事
      const care = SCRIPTS['self-compassion']
      expect(sectionTitles(care, 5)).toEqual([
        '想一件小事',
        '这很难受',
        '不只我一个',
        '安抚的触碰',
        '善待自己',
      ])
      const careText = care.sections
        .flatMap(s => s.intro)
        .map(l => l.text)
        .join('')
      for (const phrase of ['这很难受', '有这种感受的，不只我一个', '愿我善待自己', '三四分']) {
        expect(careText, phrase).toContain(phrase)
        expect(w7?.reading, phrase).toContain(phrase)
      }
    })

    it('诚实说明证据和安全：借鉴而不是 MBSR / MBCT 本身，变化约在第 8 周前后，持续超过一天就暂停', () => {
      for (const { where, text } of textsOf(program))
        if (where !== '简介') expect(text, where).not.toMatch(/MBSR|MBCT/u)
      const sentence = program.summary.split('。').find(s => s.includes('MBSR'))
      for (const word of ['借鉴', '不是', '没有单独检验过']) expect(sentence, word).toContain(word)
      expect(program.summary).toContain('第 8 周前后')
      expect(program.summary).toContain('经常练')
      expect(w1?.reading).toContain('第 8 周前后')
      expect(w1?.reading).toContain('回神')
      expect(w2?.reading).toContain('接纳')
      const stop = /(持续超过一天|过了一天)[\s\S]{0,12}?暂停练习[^。]*心理专业人员/u
      expect(w2?.reading).toMatch(stop)
      expect(w5?.reading).toMatch(stop)
      expect(w8?.tips.some(t => stop.test(t))).toBe(true)
      expect(w6?.tips.some(t => t.includes('求助方式'))).toBe(true)
      expect(w7?.reading).toContain('求助方式')
    })
  })

  describe('四周呼吸', () => {
    const program = PROGRAMS['breathing-4w']
    const rates = program.weeks.map(w => w.daily.params?.rate)

    it('每天练慢呼吸：节拍逐周放慢，第 4 周用个人速度；前两周 5 分钟、后两周 10 分钟，保底日 3 分钟', () => {
      expect(program.weeks.map(w => w.daily.practiceId)).toEqual(['slow', 'slow', 'slow', 'slow'])
      expect(program.weeks.map(w => w.daily.minutes)).toEqual([5, 5, 10, 10])
      expect(rates).toEqual([7, 6.5, 6, 'personal'])
      for (const w of program.weeks)
        expect(w.short).toEqual({ practiceId: 'slow', minutes: 3, params: w.daily.params })
      expect(weekOf(program, 4).extra).toEqual([{ practiceId: 'pace-finder', minutes: 7 }])
      for (const n of [1, 2, 3]) expect(weekOf(program, n).extra ?? []).toEqual([])
    })

    it('主题和说明里的速度、分钟数与参数一致', () => {
      for (const w of program.weeks) {
        expect(w.theme).toContain(`${w.daily.minutes} 分钟`)
        const rate = w.daily.params?.rate
        if (typeof rate === 'number') {
          expect(w.theme).toContain(`每分钟 ${rate} 次`)
          expect(w.reading).toContain(`每分钟 ${rate} 次`)
          expect(program.summary).toContain(`${rate} 次`)
        }
      }
      expect(weekOf(program, 4).reading).toContain('舒适节律探索')
      expect(weekOf(program, 4).tips[0]).toContain('3 分钟短版')
    })

    it('安全：停止跟随节拍的办法、120、紧张时的退路；让人点「有点急」的地方另有不靠按钮的办法', () => {
      const w2 = weekOf(program, 2).reading
      for (const word of ['停止跟随节拍', '拨打 120', '就医']) expect(w2, word).toContain(word)
      expect(w2.indexOf('停止跟随节拍')).toBeLessThan(w2.indexOf('就医'))
      expect(weekOf(program, 1).reading).toContain('不必吸得很深')
      const places = textsOf(program).filter(t => t.text.includes('「有点急」'))
      expect(places.length).toBeGreaterThan(0)
      for (const { where, text } of places)
        expect(/自己的快慢|「等长」/u.test(text), `${where} 只靠「有点急」`).toBe(true)
    })
  })
})
