import { describe, expect, it } from 'vitest'
import type { Feeling, Screening } from '@/data/types'
import {
  adjustedDefaults,
  copingOptions,
  isDiscouraged,
  isHidden,
  isOffered,
  PRACTICE_BY_ID,
  PRACTICES,
  SCREENING_ITEMS,
  type ScreeningItem,
  soundModeOf,
} from './practices'
import type { FeelingValue, ScreeningKey } from './safety'
import * as safety from './safety'
import { boxScript, cyclicSighScript, slowScript } from './scripts/breathing'
import { focusScript } from './scripts/focus'
import { openAwarenessScript } from './scripts/open-awareness'
import { selfCompassionScript } from './scripts/self-compassion'
import type { GuidedScript } from './types'

const {
  AFTER_PRACTICE,
  BREATH_OPENING_LINE,
  CRISIS_CARD,
  CRISIS_RESOURCES,
  DISCLAIMERS,
  FIRST_RUN_NOTICE,
  FORBIDDEN_TERMS,
  findForbidden,
  HEALTH_CHECK,
  LAST_VERIFIED,
  mentionsSelfHarm,
  monthlyCheckResult,
  SCREENING_NOTES,
  SLEEP_SOUND_RULES,
  STOP_GUIDANCE,
  TECHNIQUE_WARNINGS,
  warningsFor,
} = safety

/* ---------- 读取 src/content 里的其他文件 ---------- */

/** 要扫描禁用词的内容模块。还没写好的文件不会出现在结果里，写好后自动纳入 */
const CONTENT_MODULES = import.meta.glob<Record<string, unknown>>(
  [
    './practices.ts',
    './sounds.ts',
    './today.ts',
    './copy.ts',
    './safety.ts',
    './scripts/*.ts',
    './programs/*.ts',
    // 别的测试文件不导入：导入会把它们的用例登记到本文件里
    '!./**/*.test.ts',
  ],
  { eager: true },
)

/** src/content 下全部文件的原文，测试和自检也算在内（Vite 不会把本文件自己列进来，本文件里的号码都拆开写） */
const RAW_SOURCES = import.meta.glob<string>('./**/*.{ts,tsx,js,json,md}', {
  eager: true,
  query: '?raw',
  import: 'default',
})

/** 研究组定稿的证据库（已提交到仓库）。用相对路径：以 / 开头的写法在项目的 vite 配置下读不到 */
const EVIDENCE_FILES = import.meta.glob<unknown>('../../docs/research/evidence.json', {
  eager: true,
  import: 'default',
})

interface Found {
  path: string
  text: string
}

/** 递归取出一个值里的全部字符串，带上路径，失败时能定位 */
function collectStrings(
  value: unknown,
  path: string,
  out: Found[] = [],
  seen = new WeakSet<object>(),
): Found[] {
  if (typeof value === 'string') {
    out.push({ path, text: value })
    return out
  }
  if (typeof value !== 'object' || value === null || seen.has(value)) return out
  seen.add(value)
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((v, i): [string, unknown] => [`[${i}]`, v])
    : Object.entries(value).map(([k, v]): [string, unknown] => [`.${k}`, v])
  for (const [key, v] of entries) collectStrings(v, `${path}${key}`, out, seen)
  return out
}

/** 一个模块导出的全部字符串；禁用词表本身不算 */
const exportedStrings = (file: string, mod: Record<string, unknown>): Found[] =>
  Object.entries(mod)
    .filter(([, value]) => value !== FORBIDDEN_TERMS)
    .flatMap(([name, value]) => collectStrings(value, `${file} › ${name}`))

const SAFETY_STRINGS = exportedStrings('safety.ts', safety)

/** 证据库里可以引用的 id（被否决的除外）；读不到证据库时为 null，测试会失败 */
function citableIds(): Set<string> | null {
  const data = Object.values(EVIDENCE_FILES)[0]
  if (data === undefined) return null
  const list: unknown[] = Array.isArray(data)
    ? data
    : typeof data === 'object' && data !== null && 'claims' in data && Array.isArray(data.claims)
      ? data.claims
      : typeof data === 'object' && data !== null
        ? Object.entries(data).map(([id, claim]) => ({ id, ...(typeof claim === 'object' ? claim : {}) }))
        : []
  const ids = new Set<string>()
  for (const claim of list) {
    if (typeof claim !== 'object' || claim === null || !('id' in claim) || typeof claim.id !== 'string')
      continue
    const rejected =
      ('rejected' in claim && claim.rejected === true) ||
      ('status' in claim && claim.status === 'rejected') ||
      ('verification' in claim &&
        typeof claim.verification === 'object' &&
        claim.verification !== null &&
        'verdict' in claim.verification &&
        claim.verification.verdict === 'rejected')
    if (!rejected) ids.add(claim.id)
  }
  return ids
}

/** 一段引导词实际朗读的全部文字 */
const spoken = (s: GuidedScript): string =>
  [...s.opening, ...s.sections.flatMap(sec => sec.intro), ...s.closing].map(l => l.text).join('')

/* ---------- 与数据层、练习目录的约定 ---------- */

/** 两个类型完全相同时为 true；不同时，下面的常量就通不过类型检查 */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const FEELING_MATCHES_DATA: Same<FeelingValue, Feeling> = true
const SCREENING_MATCHES_DATA: Same<ScreeningKey, keyof Screening> = true
const SCREENING_MATCHES_PRACTICES: Same<ScreeningKey, ScreeningItem> = true

const NONE: Record<ScreeningKey, boolean> = {
  pregnancy: false,
  heart: false,
  respiratory: false,
  psychosis: false,
  bipolar: false,
  epilepsy: false,
  trauma: false,
  panic: false,
}
const only = (key: ScreeningKey): Record<ScreeningKey, boolean> => ({ ...NONE, [key]: true })
/** 八项全选 */
const ALL: Record<ScreeningKey, boolean> = { ...NONE }
for (const key of SCREENING_ITEMS) ALL[key] = true

describe('与数据层、练习目录的约定', () => {
  it('练完感觉、健康情况的键与 data/types.ts、practices.ts 相同', () => {
    expect([FEELING_MATCHES_DATA, SCREENING_MATCHES_DATA, SCREENING_MATCHES_PRACTICES]).toEqual([
      true,
      true,
      true,
    ])
    expect(HEALTH_CHECK.items.map(i => i.id).sort()).toEqual([...SCREENING_ITEMS].sort())
  })

  it('共享的文案对象是冻结的，误改会报错', () => {
    expect(Object.isFrozen(CRISIS_RESOURCES)).toBe(true)
    expect(Object.isFrozen(CRISIS_RESOURCES[0]?.lines[0])).toBe(true)
    expect(Object.isFrozen(TECHNIQUE_WARNINGS.box)).toBe(true)
    expect(Object.isFrozen(HEALTH_CHECK.items)).toBe(true)
    expect(Object.isFrozen(FORBIDDEN_TERMS[1])).toBe(true)
  })
})

/* ---------- 求助电话 ---------- */

describe('求助电话', () => {
  const lines = CRISIS_RESOURCES.flatMap(r => r.lines)
  const byDisplay = (display: string) => lines.find(l => l.display === display)

  it('写明最后核实日期 2026-10-22，卡片上显示', () => {
    expect(LAST_VERIFIED).toBe('2026-10-22')
    expect(new Date(`${LAST_VERIFIED}T00:00:00Z`).toISOString().slice(0, 10)).toBe(LAST_VERIFIED)
    expect(CRISIS_CARD.verified).toBe('最后核实：2026-10-22')
  })

  it('按地区分组，只列核实过的号码', () => {
    expect(CRISIS_RESOURCES.map(r => [r.name, r.lines.map(l => l.display)])).toEqual([
      ['中国大陆', ['12356', '400-161-9995', '120', '110']],
      ['中国香港', ['999', '18111', '2389 2222', '2896 0000']],
      ['中国台湾', ['1925', '119', '110']],
      ['美国', ['988']],
      ['其他地区', ['findahelpline.com']],
    ])
    expect(new Set(CRISIS_RESOURCES.map(r => r.id)).size).toBe(CRISIS_RESOURCES.length)
  })

  it('号码格式正确，tel: 链接只含数字，并与显示的号码一致', () => {
    for (const line of lines) {
      if (line.href.startsWith('tel:')) {
        expect(line.href, line.name).toMatch(/^tel:\d{3,11}$/)
        expect(line.display, line.name).toMatch(/^\d+(?:[ -]\d+)*$/)
        expect(line.href.slice(4), line.name).toBe(line.display.replace(/[ -]/g, ''))
      } else {
        expect(line.href, line.name).toBe(`https://${line.display}`)
      }
    }
  })

  it('每条都有服务时间、一句话说明和来源', () => {
    for (const line of lines) {
      for (const text of [line.name, line.hours, line.description, line.source]) {
        expect(text.trim(), line.name).not.toBe('')
        expect(text, line.name).not.toMatch(/\n/)
      }
      expect(line.description, line.name).toMatch(/。$/)
    }
  })

  it('服务时间和说明与核实结果一致', () => {
    const hotline = byDisplay('12356')
    expect(hotline?.hours).toBe('各地每天不少于 18 小时，部分地区 24 小时')
    // 日历上的日期写在一起（DESIGN.md §4.4）
    expect(hotline?.description).toContain('2025年5月1日起全国可拨打')
    expect(byDisplay('400-161-9995')?.hours).toBe('24 小时')
    expect(byDisplay('400-161-9995')?.description).toContain('志愿者')
    for (const d of ['18111', '2389 2222', '2896 0000', '1925', '988'])
      expect(byDisplay(d)?.hours, d).toBe('24 小时')
    expect(byDisplay('2389 2222')?.name).toBe('香港撒玛利亚防止自杀会')
    expect(byDisplay('2896 0000')?.name).toBe('香港撒玛利亚会')
    expect(byDisplay('2896 0000')?.description).toContain('多种语言')
  })

  it('src/content 里任何地方都没有北京心理危机中心的旧号码', () => {
    // 号码拆开写，免得本文件自己命中
    const OLD = [
      ['800', '810', '1117'],
      ['8295', '1332'],
    ].map(parts => new RegExp(parts.join('[-\\s]?')))
    const files = Object.entries(RAW_SOURCES)
    expect(files.map(([file]) => file)).toContain('./safety.ts')
    expect(files.some(([file]) => file.endsWith('.test.ts'))).toBe(true)
    for (const [file, text] of files)
      for (const re of OLD) expect(re.test(text), `${file} 含旧号码`).toBe(false)
    // 正则本身要能认出旧号码的几种写法，否则上面的扫描不起作用
    for (const sample of [
      ['800', '810', '1117'].join('-'),
      ['010', '8295', '1332'].join('-'),
      ['8295', '1332'].join(''),
    ]) {
      expect(
        OLD.some(re => re.test(sample)),
        sample,
      ).toBe(true)
    }
  })

  it('卡片说明不越界：不提供危机干预，不替人拨号', () => {
    expect(CRISIS_CARD.footer).toBe('回神不提供危机干预服务，也不会自动替你拨打电话。')
    expect(CRISIS_CARD.body).toBe('你不需要独自面对。下面的电话由专业人员或受训志愿者接听。')
    // 卡片也给香港、台湾的人看：各地的急救电话都写出来，只写已核实的
    for (const number of ['120', '110', '999', '119']) expect(CRISIS_CARD.emergency).toContain(number)
    const listed = new Set(CRISIS_RESOURCES.flatMap(r => r.lines.map(l => l.display)))
    for (const number of CRISIS_CARD.emergency.match(/\d+/g) ?? [])
      expect(listed.has(number), number).toBe(true)
  })
})

/* ---------- 开始之前 ---------- */

describe('开始之前', () => {
  const all = FIRST_RUN_NOTICE.sections.flatMap(s => [
    s.heading ?? '',
    ...(s.paragraphs ?? []),
    ...(s.items ?? []),
  ])
  const text = all.join('\n')

  it('标题、确认按钮和求助入口', () => {
    expect(FIRST_RUN_NOTICE.title).toBe('开始之前')
    expect(FIRST_RUN_NOTICE.confirm).toBe('我已读完')
    expect(FIRST_RUN_NOTICE.help).toBe('查看求助方式')
    expect(FIRST_RUN_NOTICE.readToEnd).toContain('读到最后')
  })

  it('说清它不是什么、可能的不适和相反的证据', () => {
    for (const phrase of [
      '不是医疗器械',
      '不能诊断或治疗疾病',
      '约 8%',
      '只问一个总的问题时约三分之一',
      '逐项询问时约一半',
      '约 1%',
      '多数不适是暂时的',
      '并不比等待参加的人高',
      '「不舒服？」',
      '不是失败',
    ]) {
      expect(text, phrase).toContain(phrase)
    }
    // 不说用 App 风险更大：那个信号只来自 17 人（safety-goldberg-2022）
    expect(text).not.toMatch(/略多|探索性结果/)
  })

  it('求助分层：有生命危险才给 120、110，有伤害自己的念头先给热线', () => {
    const help = FIRST_RUN_NOTICE.sections.find(s => s.heading === '需要帮助时')?.paragraphs?.join('') ?? ''
    expect(help).toContain('如果你或身边的人有生命危险，请立即拨打 120 或 110。')
    expect(help).toContain('如果你有伤害自己的念头，可以拨打全国统一心理援助热线 12356')
    expect(help).not.toMatch(/念头，请立即拨打 120/)
  })

  it('列出应先咨询医生的情况、不宜练习的场合和求助电话', () => {
    // 癫痫、怀孕、心肺疾病是快速深呼吸的禁忌，只关系到呼吸练习，单独一组
    const breathing = FIRST_RUN_NOTICE.sections.find(s => s.heading === '做呼吸练习之前，建议先问问医生')
    expect(breathing?.items).toEqual([
      '癫痫，或有过抽搐发作',
      '怀孕',
      '心脏病、脑血管病、严重的肺部疾病，或血压控制不好',
    ])
    const doctor = FIRST_RUN_NOTICE.sections.find(
      s => s.heading === '以下情况，建议先和医生或心理专业人员谈谈',
    )
    expect(doctor?.items).toEqual(
      expect.arrayContaining([
        '使用胰岛素',
        '常有惊恐发作',
        '经历过创伤，常有闪回',
        '正在接受心理治疗（先和你的治疗师商量）',
      ]),
    )
    expect(doctor?.items).toHaveLength(8)
    // 和健康情况检查用同样的说法
    const labels = HEALTH_CHECK.items.map(i => i.label)
    for (const item of ['有过幻觉或妄想', '常有惊恐发作', '经历过创伤，常有闪回']) {
      expect(doctor?.items, item).toContain(item)
      expect(labels, item).toContain(item)
    }
    expect(text).toContain('饮酒后，或用了影响清醒的药物后')
    expect(text).toContain('驾驶或操作机器时')
    // 水中、泡澡只限呼吸练习，与研究笔记一致
    expect(text).toContain('呼吸练习请坐着或躺着做，不要在水中或泡澡时做。')
    for (const number of ['120', '110', '12356']) expect(text).toContain(number)
  })

  it('没有空段落', () => {
    for (const section of FIRST_RUN_NOTICE.sections) {
      expect((section.paragraphs?.length ?? 0) + (section.items?.length ?? 0)).toBeGreaterThan(0)
      for (const s of [...(section.paragraphs ?? []), ...(section.items ?? [])]) expect(s.trim()).not.toBe('')
    }
  })
})

/* ---------- 健康情况检查 ---------- */

describe('健康情况检查', () => {
  /** 落地练习和声音类不随健康情况调整，睡前身体扫描只缩短（practices.ts 的 adjustedDefaults） */
  const adjustable = PRACTICES.filter(
    p => p.category !== 'sound' && p.id !== 'grounding' && soundModeOf(p.id) !== 'sleep',
  )
  const LIGHT_SOS = '「今日」不再推荐周期性叹息，「只有几分钟」和「现在有点难」里换成轻柔的慢呼吸'
  const GROUNDING_FIRST = '「现在有点难」把落地练习放在最前面'
  const WEEK5 = '八周计划第 5 周，请改练可选练习里的专注呼吸，「今日」也会改推它'

  const slowRate = (key?: ScreeningKey): number | null => {
    const paced = adjustedDefaults('slow', key ? only(key) : null).paced
    return paced?.type === 'resonance' ? paced.rate : null
  }

  it('隐藏的练习与 practices.ts 的 isHidden 一致', () => {
    for (const item of HEALTH_CHECK.items) {
      const hidden = PRACTICES.filter(p => isHidden(p.id, only(item.id))).map(p => p.id)
      expect([...item.hides].sort(), item.id).toEqual(hidden.sort())
    }
    expect(PRACTICES.filter(p => isHidden(p.id, null))).toEqual([])
  })

  it('可见性规则：孕期、心脑血管病、肺病隐藏箱式呼吸；精神病性症状、双相隐藏开放觉察', () => {
    const hides = Object.fromEntries(HEALTH_CHECK.items.map(i => [i.id, i.hides]))
    expect(hides).toEqual({
      pregnancy: ['box'],
      heart: ['box'],
      respiratory: ['box'],
      psychosis: ['open-awareness'],
      bipolar: ['open-awareness'],
      epilepsy: [],
      trauma: [],
      panic: [],
    })
  })

  it('调整说明写的正是 practices.ts 实际做的事', () => {
    for (const item of HEALTH_CHECK.items) {
      const a = item.adaptation
      expect(a.includes('隐藏箱式呼吸'), item.id).toBe(item.hides.includes('box'))
      expect(a.includes('隐藏开放觉察'), item.id).toBe(item.hides.includes('open-awareness'))
      if (item.hides.length === 0) expect(a.replaceAll('不隐藏', ''), item.id).not.toContain('隐藏')

      // 「现在有点难」的呼吸换成慢呼吸；落地练习排第一
      const coping = copingOptions(only(item.id))
      expect(a.includes(LIGHT_SOS), item.id).toBe(coping.some(o => o.id === 'slow'))
      expect(a.includes(GROUNDING_FIRST), item.id).toBe(coping[0]?.id === 'grounding')

      // 第 5 周改练专注呼吸：开放觉察被隐藏或不推荐时
      const noOpen =
        isHidden('open-awareness', only(item.id)) || isDiscouraged('open-awareness', only(item.id))
      expect(a.includes(WEEK5), item.id).toBe(noOpen)

      // 睡前身体扫描：说「只缩短时长」时，确实只缩短；说「除外」时，确实没改成睁眼
      const bedtime = adjustedDefaults('body-scan-sleep', only(item.id))
      if (a.includes('睡前身体扫描只缩短时长')) {
        expect(bedtime, item.id).toMatchObject({ eyesOpen: false, shortened: true })
        expect(bedtime.guidance, item.id).toBeUndefined()
      }
      if (a.includes('睡前身体扫描除外')) expect(bedtime.eyesOpen, item.id).toBe(false)

      // 只留 10 分钟以内、默认睁眼、有引导词的改用详细档
      const short = adjustable.every(p => Math.max(...adjustedDefaults(p.id, only(item.id)).durations) <= 10)
      expect(a.includes('10 分钟以内'), item.id).toBe(short)
      const eyes = adjustable.every(p => adjustedDefaults(p.id, only(item.id)).eyesOpen)
      expect(a.includes('默认睁着眼睛'), item.id).toBe(eyes)
      const detailed = adjustable
        .filter(p => p.scriptId !== undefined)
        .every(p => adjustedDefaults(p.id, only(item.id)).guidance === 'detailed')
      expect(a.includes('「详细」档'), item.id).toBe(detailed)

      // 惊恐：慢呼吸默认改为每分钟 6 次
      expect(a.includes('每分钟 6 次'), item.id).toBe(slowRate(item.id) === 6 && slowRate() !== 6)
    }
    expect(copingOptions(null)[0]?.id).toBe('cyclic-sigh')
  })

  it('调整说明和练习页上的补充提示用同样的话', () => {
    const byId = (id: ScreeningKey) => HEALTH_CHECK.items.find(i => i.id === id)?.adaptation ?? ''
    expect(byId('respiratory')).toContain(SCREENING_NOTES.respiratory)
    expect(byId('bipolar')).toContain(SCREENING_NOTES.mania)
    expect(SCREENING_NOTES.psychosis).toContain('如果异常的感知变多，请停下练习，并告诉你的医生。')
    expect(byId('psychosis')).toContain('如果异常的感知变多，请停下练习，并告诉你的医生。')
    // 补充提示都会被用到
    const used = new Set(
      PRACTICES.flatMap(p =>
        [ALL, ...SCREENING_ITEMS.map(only)].flatMap(s => adjustedDefaults(p.id, s).notes),
      ),
    )
    for (const [key, note] of Object.entries(SCREENING_NOTES)) expect(used.has(note), key).toBe(true)
  })

  it('惊恐、创伤、癫痫的调整写明改了什么', () => {
    const byId = (id: ScreeningKey) => HEALTH_CHECK.items.find(i => i.id === id)?.adaptation ?? ''
    expect(byId('panic')).toContain('轻柔的慢呼吸')
    expect(byId('trauma')).toContain('锚点可以选')
    expect(byId('trauma')).toContain('身体扫描的每一处都可以跳过')
    expect(byId('epilepsy')).toContain('快速、用力的呼吸')
    expect(byId('respiratory')).toContain('不能替代你的吸入药物')
  })

  it('每一项都说明为什么，并写明哪些是预防性的安排', () => {
    for (const item of HEALTH_CHECK.items) {
      expect(item.why.trim(), item.id).not.toBe('')
      expect(item.evidence.length, item.id).toBeGreaterThan(0)
      if (item.hides.length > 0) expect(item.why, item.id).toContain('预防性的安排')
    }
  })

  it('说明答案只保存在这台设备上；不保存的几项当场给出建议', () => {
    expect(HEALTH_CHECK.privacy).toContain('只保存在这台设备上')
    expect(HEALTH_CHECK.unsaved).toContain('不会保存')
    const crisis = HEALTH_CHECK.notices.find(n => n.id === 'crisis')
    expect(crisis?.showHelp).toBe(true)
    for (const number of ['120', '110', '12356']) expect(crisis?.response.join('')).toContain(number)
    // 12356 有的地区夜里没人接，同时给 24 小时的热线
    expect(crisis?.response.join('')).toContain('400-161-9995')
    const hope = CRISIS_RESOURCES.flatMap(r => r.lines).find(l => l.display === '400-161-9995')
    expect(hope?.hours).toBe('24 小时')
    expect(HEALTH_CHECK.notices.find(n => n.id === 'depression')?.showHelp).toBe(true)
    expect(HEALTH_CHECK.notices.find(n => n.id === 'insulin')?.response.join('')).toContain('血糖')
  })
})

/* ---------- 各练习的安全提示 ---------- */

describe('各练习的安全提示', () => {
  const breathing = PRACTICES.filter(p => p.category === 'breathing').map(p => p.id)

  it('键都是现有的练习 id，覆盖目录里的全部练习', () => {
    expect(Object.keys(TECHNIQUE_WARNINGS).sort()).toEqual(PRACTICES.map(p => p.id).sort())
    for (const id of Object.keys(TECHNIQUE_WARNINGS)) expect(Object.hasOwn(PRACTICE_BY_ID, id), id).toBe(true)
    for (const [id, warnings] of Object.entries(TECHNIQUE_WARNINGS)) {
      expect(warnings.length, id).toBeGreaterThan(0)
      for (const w of warnings) expect(w, id).toMatch(/^\S.*。$/)
    }
  })

  it('跟随节拍的呼吸第一条以「轻柔地呼吸，不必吸得很深。」开头，周期性叹息照引导词说「七八成满」', () => {
    expect(BREATH_OPENING_LINE).toBe('轻柔地呼吸，不必吸得很深。')
    expect(breathing.sort()).toEqual(['box', 'cyclic-sigh', 'pace-finder', 'slow'])
    for (const id of breathing) {
      const first = TECHNIQUE_WARNINGS[id][0] ?? ''
      if (id === 'cyclic-sigh') {
        // 不提示吸到最满（safety.notes §2）
        expect(first.startsWith('吸气要轻，只到七八成满')).toBe(true)
      } else {
        expect(first.startsWith(BREATH_OPENING_LINE), id).toBe(true)
      }
      expect(TECHNIQUE_WARNINGS[id].join(''), id).toContain('不要在水中、泡澡、驾驶或操作机器时练习')
      expect(TECHNIQUE_WARNINGS[id].join(''), id).toContain('手指、嘴唇发麻')
    }
  })

  it('引导词开头也说这句（PRODUCT §10），叹息说的是「七八成满」', () => {
    for (const script of [slowScript, boxScript]) {
      const at = script.opening.findIndex(l => l.text === BREATH_OPENING_LINE)
      expect(at, script.id).toBeGreaterThanOrEqual(0)
      expect(at, script.id).toBeLessThanOrEqual(2)
    }
    expect(cyclicSighScript.opening.map(l => l.text).join('')).toContain('七八成满')
  })

  it('措辞与引导词里实际说的一致', () => {
    expect(TECHNIQUE_WARNINGS['self-compassion'].join('')).toContain('三四分')
    expect(spoken(selfCompassionScript)).toContain('三四分')
    for (const [id, script] of [
      ['open-awareness', openAwarenessScript],
      ['focus', focusScript],
    ] as const) {
      expect(TECHNIQUE_WARNINGS[id].join(''), id).toContain('不太真实')
      expect(spoken(script), id).toContain('不太真实')
    }
    expect(spoken(openAwarenessScript)).toContain('换成听声音或者专注呼吸')
  })

  it('箱式呼吸提醒停顿不憋气，并点名应改用慢呼吸的人群', () => {
    const box = TECHNIQUE_WARNINGS.box.join('')
    for (const word of ['不要用力憋气', '怀孕', '心脏', '哮喘', '慢阻肺', '慢呼吸'])
      expect(box).toContain(word)
  })

  it('开放觉察提醒不真实感，并点名幻觉妄想、双相和创伤闪回', () => {
    const open = TECHNIQUE_WARNINGS['open-awareness'].join('')
    for (const word of ['不太真实', '幻觉或妄想', '双相情感障碍', '创伤闪回', '超过一天'])
      expect(open).toContain(word)
  })

  it('专注呼吸带上「静坐」的完整一条：时间感和自我感的变化，持续就换成有明确对象的练习并缩短时间', () => {
    // safety.notes §5；引导词只在二十分钟起才说不真实感，详情页每个时长都要有
    const focus = TECHNIQUE_WARNINGS.focus.join('')
    for (const word of ['对时间的感觉', '不太真实', '换成数息或听声音', '缩短', '超过一天'])
      expect(focus).toContain(word)
  })

  it('身体扫描：留意某个部位难受就跳过，详情页、睡前版的做法和引导词的说法一致', () => {
    const skip = '如果留意某个部位让你难受，可以跳过它'
    for (const id of ['body-scan', 'body-scan-sleep'] as const)
      expect(TECHNIQUE_WARNINGS[id][0]?.startsWith(skip), id).toBe(true)
    expect(PRACTICE_BY_ID['body-scan-sleep'].steps).toContain(`${skip}。`)
  })

  it('一分钟停一停常在做事中途用：驾驶或操作机器时不要做；文字引导要看屏幕，走路时先停下来', () => {
    const pause = TECHNIQUE_WARNINGS.pause.join('')
    expect(pause).toContain('驾驶')
    expect(pause).toContain('不要做')
    expect(pause).toContain('先停下脚步')
  })

  it('身体扫描提醒痛苦记忆和与身体脱离的感觉，以及超过一天的处理', () => {
    for (const id of ['body-scan', 'body-scan-sleep'] as const) {
      const text = TECHNIQUE_WARNINGS[id].join('')
      for (const word of ['痛苦的记忆', '和身体脱离', '超过一天']) expect(text, id).toContain(word)
    }
  })

  it('舒适节律探索：头晕时不叫人接着跟更慢的一档', () => {
    const text = TECHNIQUE_WARNINGS['pace-finder'].join('')
    expect(text).toContain('不用测完')
    expect(text).not.toContain('等下一档再跟')
  })

  it('容易勾起难过的练习给出求助入口', () => {
    for (const id of ['loving-kindness', 'self-compassion', 'breathing-space-coping'] as const) {
      expect(TECHNIQUE_WARNINGS[id].join(''), id).toContain('「求助方式」')
    }
  })

  it('warningsFor 对旧 id 返回空数组', () => {
    expect(warningsFor('focus')).toBe(TECHNIQUE_WARNINGS.focus)
    expect(warningsFor('resonance')).toEqual([])
  })
})

/* ---------- 停止指引 ---------- */

describe('停止指引', () => {
  it('写明什么时候停', () => {
    expect(STOP_GUIDANCE.title).toBe('停止指引')
    expect(STOP_GUIDANCE.when.items).toHaveLength(5)
    expect(STOP_GUIDANCE.when.lead).toContain('睁开眼睛')
    expect(STOP_GUIDANCE.when.items[0]).toContain('头晕')
  })

  it('停下以后：先坐下或躺下，再睁眼看四周、踩稳双脚、自然呼吸、喝水、活动，按这个顺序', () => {
    const steps = STOP_GUIDANCE.after.items
    const at = (word: string) => steps.findIndex(s => s.includes(word))
    // 第一条停止的理由是快要晕倒：照顺序做的人，先把身体放低
    expect(steps[0]).toBe('头晕的话，先坐下或躺下，缓过来再起身。')
    expect(TECHNIQUE_WARNINGS.grounding[0]).toBe(steps[0])
    const order = ['坐下或躺下', '睁开眼睛', '双脚', '自然地呼吸', '喝几口', '活动']
    for (const word of order) expect(at(word), word).toBeGreaterThanOrEqual(0)
    expect(order.map(at)).toEqual([...order.map(at)].sort((a, b) => a - b))
    expect(steps.join('')).toContain('看看四周')
  })

  it('跟随节拍时：呼吸过度和节拍太慢分开说，做法都是不跟节拍', () => {
    expect(STOP_GUIDANCE.breathing).toContain('先不跟节拍')
    expect(STOP_GUIDANCE.breathing).toContain('「有点急」')
  })

  it('胸痛、晕厥、抽搐拨打 120', () => {
    for (const word of ['胸痛', '晕厥', '抽搐', '120']) expect(STOP_GUIDANCE.emergency).toContain(word)
  })

  it('播放器上的一句话版本够短；面板上的按钮齐全', () => {
    expect(STOP_GUIDANCE.short).toBe('不舒服就停下，睁开眼睛，自然地呼吸。')
    expect([...STOP_GUIDANCE.short].length).toBeLessThanOrEqual(20)
    expect(STOP_GUIDANCE.actions).toEqual({
      grounding: '60 秒落地练习',
      switchPractice: '换一个练习',
      help: '求助方式',
    })
  })
})

/* ---------- 练完以后 ---------- */

describe('练完以后', () => {
  it('四个选项对应 Feeling 的四个值', () => {
    const LABELS: Record<Feeling, string> = {
      calmer: '更平静',
      same: '差不多',
      tenser: '更紧张',
      unwell: '很不舒服',
    }
    expect(AFTER_PRACTICE.options.map(o => [o.value, o.label])).toEqual(Object.entries(LABELS))
  })

  it('「很不舒服」给出落地练习和专业帮助', () => {
    const text = AFTER_PRACTICE.unwell.paragraphs.join('')
    expect(text).toContain('60 秒落地练习')
    expect(text).toContain('医生或心理专业人员')
  })

  it('最近 3 次里 2 次不舒服：建议更短、睁眼、以声音为锚，并给出求助入口', () => {
    const text = AFTER_PRACTICE.gentler.paragraphs.join('')
    for (const word of ['最近 3 次', '至少有 2 次', '更短', '睁着眼', '以声音为锚', '医生或心理专业人员']) {
      expect(text).toContain(word)
    }
    expect(AFTER_PRACTICE.gentler.help).toBe('求助方式')
    for (const { practiceId, minutes } of AFTER_PRACTICE.gentler.suggestions) {
      expect(PRACTICE_BY_ID[practiceId].durations, practiceId).toContain(minutes)
      expect(minutes, practiceId).toBeLessThanOrEqual(10)
      expect(isHidden(practiceId, ALL), practiceId).toBe(false)
      expect(isOffered(practiceId), `${practiceId} v1 不提供`).toBe(true)
    }
  })

  it('每月自查逐项问具体的变化，问是否超过一天', () => {
    const { monthly } = AFTER_PRACTICE
    expect(monthly.items).toHaveLength(6)
    expect(new Set(monthly.items.map(i => i.id)).size).toBe(6)
    expect(monthly.answers.map(a => a.value)).toEqual(['no', 'brief', 'lasting'])
    // 惊恐发作和闯入的记忆是一阵一阵来的：反复出现也算
    expect(monthly.answers.find(a => a.value === 'lasting')?.label).toContain('反复出现')
    expect(monthly.answers.find(a => a.value === 'brief')?.label).toContain('没再出现')
    expect(monthly.results.lasting).toContain('暂停或减少练习')
    expect(monthly.selfHarm.question).toContain('伤害自己')
    const response = monthly.selfHarm.response.join('')
    for (const word of ['12356', '400-161-9995', '医生或心理专业人员', '不会上传'])
      expect(response).toContain(word)
    // 与健康情况检查里的危机提示用同样的话
    const crisis = HEALTH_CHECK.notices.find(n => n.id === 'crisis')?.response ?? []
    expect(response).toContain(crisis[0] ?? '-')
  })

  it('有一项超过一天，结论就是超过一天', () => {
    expect(monthlyCheckResult([])).toBe('no')
    expect(monthlyCheckResult(['no', 'no'])).toBe('no')
    expect(monthlyCheckResult(['no', 'brief'])).toBe('brief')
    expect(monthlyCheckResult(['brief', 'lasting', 'no'])).toBe('lasting')
  })
})

/* ---------- 免责声明与睡前声音 ---------- */

describe('免责声明与睡前声音', () => {
  it('短版：不是医疗器械、不能替代专业医疗、紧急电话', () => {
    expect(DISCLAIMERS.short).toBe(
      '回神提供日常放松练习，不是医疗器械，不能诊断或治疗疾病，也不能替代专业医疗。紧急情况请拨打 120 或 110；心理援助热线 12356。',
    )
    // 长版第一段和「开始之前」的第一段是同一句
    expect(DISCLAIMERS.full.paragraphs[0]).toBe(FIRST_RUN_NOTICE.sections[0]?.paragraphs?.[0])
  })

  it('长版写明证据局限、不要推迟就医、怎样应对安全问题、数据怎么删、用不用 AI', () => {
    const text = DISCLAIMERS.full.paragraphs.join('')
    for (const word of ['各有局限', '来自亚洲', '推迟就医', '自行停药', '停止指引', '删除全部数据', 'AI']) {
      expect(text).toContain(word)
    }
    // v1 没有语音引导（PRODUCT.md §0），不再讲在线语音
    expect(text).not.toMatch(/语音|朗读/u)
    expect(DISCLAIMERS.full.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('睡前声音：定时默认与目录一致，设备音量不超过 60%，不说噪声助眠', () => {
    expect(SLEEP_SOUND_RULES.defaultMinutes).toBe(PRACTICE_BY_ID.sleep.defaultMinutes)
    expect(PRACTICE_BY_ID.sleep.durations).toContain(SLEEP_SOUND_RULES.defaultMinutes)
    expect(SLEEP_SOUND_RULES.volumeTip).toContain(`${SLEEP_SOUND_RULES.deviceVolumeMax}%`)
    expect(SLEEP_SOUND_RULES.headphones).toContain(`${SLEEP_SOUND_RULES.deviceVolumeMax}%`)
    // 等级名只用 GRADE_NAMES；「证据很弱」写成白话
    expect(SLEEP_SOUND_RULES.noise).toContain('证据很弱')
    expect(SLEEP_SOUND_RULES.noise).not.toMatch(/（证据：/)
    const allNight = SLEEP_SOUND_RULES.allNight.paragraphs.join('')
    for (const word of ['耳机', '累积', '离枕边远一些']) expect(allNight).toContain(word)
    expect(SLEEP_SOUND_RULES.allNight.paragraphs.at(-1)).toBe(SLEEP_SOUND_RULES.infants)
    expect(SLEEP_SOUND_RULES.allNight.paragraphs).toContain(SLEEP_SOUND_RULES.placement)
    expect(SLEEP_SOUND_RULES.allNight.confirm).not.toBe(SLEEP_SOUND_RULES.allNight.cancel)
    expect(SLEEP_SOUND_RULES.infants).toContain('婴儿床')
    // 淡出发生在到点之前，不是之后（与会话引擎一致，秒数由 sounds.test.ts 核对）
    expect(SLEEP_SOUND_RULES.timer.startsWith('快到时间时')).toBe(true)
    // 详情页上的说法与这里一字不差
    expect(TECHNIQUE_WARNINGS.listen).toEqual([`${SLEEP_SOUND_RULES.volume}${SLEEP_SOUND_RULES.headphones}`])
    expect(TECHNIQUE_WARNINGS.sleep).toContain(SLEEP_SOUND_RULES.clinic)
  })
})

/* ---------- 禁用词 ---------- */

/** 每条规则至少一个会命中的例子 */
const HITS: [string, string][] = [
  ['回神可以治疗失眠。', '治疗'],
  ['睡前练习不比失眠治疗更有效。', '治疗'],
  ['坚持练习能治好焦虑。', '治愈'],
  ['帮助改善失眠。', '缓解疾病'],
  ['从此告别焦虑。', '消除焦虑'],
  ['疗效显著。', '疗效'],
  ['一个疗程八周。', '疗程'],
  ['冥想处方。', '处方'],
  ['临床级的呼吸训练。', '医用级'],
  ['新一代数字疗法。', '数字疗法'],
  ['回神的音乐疗法。', '音乐治疗'],
  ['专家推荐的练习。', '医生推荐'],
  ['练习可以替代药物。', '替代药物'],
  ['你可能有焦虑症。', '诊断用语'],
  ['我们提供危机干预。', '危机干预'],
  ['零副作用。', '零副作用'],
  ['这个练习很安全。', '零副作用'],
  ['100% 有效。', '100% 有效'],
  ['保证见效。', '保证见效'],
  ['21 天养成习惯。', 'X 天见效'],
  ['科学证明有效。', '科学证明'],
  ['提高免疫力。', '提高免疫力'],
  ['慢呼吸降血压。', '降血压'],
  ['重塑大脑。', '重塑大脑'],
  ['帮助排毒。', '排毒'],
  ['抗炎。', '抗炎'],
  ['提高血氧。', '提高血氧'],
  ['调节自主神经。', '调节自主神经'],
  ['激活迷走神经。', '激活'],
  ['降低皮质醇。', '降低皮质醇'],
  ['修复 DNA。', '修复 DNA'],
  ['心率同步。', '心率同步'],
  ['α 波音乐。', '脑波同步'],
  ['先深吸一口气。', '深吸一口气'],
  ['开启你的疗愈之旅。', '疗愈'],
  ['补充能量。', '能量'],
  ['高频振动。', '振动频率'],
  ['开启你的冥想之旅。', '开启'],
  ['解锁更多练习。', '解锁'],
  ['为你赋能。', '赋能'],
  ['灵性觉醒。', '觉醒'],
  ['与宇宙连接。', '宇宙'],
  ['瞬间放松。', '瞬间'],
  ['改变你的人生。', '改变人生'],
  ['遇见更好的自己。', '更好的自己'],
  ['让我们一起呼吸。', '让我们'],
  ['在快节奏的现代生活中。', '快节奏'],
  ['静观练习。', '静观'],
  ['最有效的呼吸法。', '最高级'],
  ['世界上最放松的歌。', '最高级'],
  ['你做得太棒了。', '空泛的鼓励'],
  ['放松一下吧！', '感叹号'],
  ['深呼吸🌿', '表情符号'],
  ['你已经 3 天没练习了。', '已经 X 天没练习'],
]

/** 不该命中的写法：否定句、指别的专业服务、书名、日常用词 */
const CLEAN = [
  '回神为一般健康与放松练习，不是医疗器械，不能诊断或治疗疾病，不能替代专业医疗。',
  '它也不能替代医生、心理治疗或药物。',
  '请不要因为使用回神而推迟就医、自行停药或更改治疗方案。',
  '回神不提供危机干预服务。',
  '回神提供的是听音乐，不是音乐治疗。',
  '与专门针对失眠的方法相比没有差别。',
  '自我关怀的中文练习册是《静观自我关怀》。',
  '正在吃降压药的人，开始前先问问医生。',
  '最好靠墙走，需要时扶一下。',
  '在安全、平坦的地方走。',
  '不用刻意深呼吸，让呼吸自己来去。',
  '每档结束，选最轻松的一档。',
  '频率 5.5 次/分。',
  '血压小幅下降，但结果不一致。',
  '持续噪声可能增加夜间觉醒。',
  '变化通常在第 8 周前后才出现。',
  '一天内过去了。',
  '惊恐障碍患者也参加了研究。',
]

describe('禁用词', () => {
  it('规则名不重复，正则不带 g、y 标志', () => {
    expect(new Set(FORBIDDEN_TERMS.map(t => t.term)).size).toBe(FORBIDDEN_TERMS.length)
    for (const { term, pattern } of FORBIDDEN_TERMS) expect(pattern?.flags ?? '', term).not.toMatch(/[gy]/)
  })

  it('每条规则都有会命中的例子，并且能命中', () => {
    for (const { term } of FORBIDDEN_TERMS)
      expect(
        HITS.some(([, t]) => t === term),
        term,
      ).toBe(true)
    for (const [text, term] of HITS) expect(findForbidden(text), text).toContain(term)
  })

  it('规格点名的说法全部会被找出', () => {
    const named = [
      '治疗焦虑',
      '治愈',
      '疗效',
      '疗程',
      '科学证明',
      '提高免疫力',
      '降血压',
      '重塑大脑',
      '排毒',
      '零副作用',
      '100% 有效',
      '7 天见效',
      '开启',
      '解锁',
      '疗愈之旅',
      '能量',
      '频率疗愈',
      '脑波同步',
      '遇见更好的自己',
      '让我们一起',
      '静观',
    ]
    for (const text of named) expect(findForbidden(text).length, text).toBeGreaterThan(0)
  })

  it('否定句、别的专业服务和日常用词不算', () => {
    for (const text of CLEAN) expect(findForbidden(text), text).toEqual([])
  })

  it('放宽只对出现在固定说法里的那一处有效；结果按禁用表的顺序', () => {
    expect(findForbidden('心理治疗之外，回神也能治疗焦虑。')).toEqual(['治疗'])
    expect(findForbidden('与其他治疗相比。')).toEqual(['治疗'])
    expect(findForbidden('开启疗愈之旅，科学证明！')).toEqual(['科学证明', '疗愈', '开启', '感叹号'])
  })

  it('safety.ts 自己的文案没有禁用词', () => {
    const bad = SAFETY_STRINGS.flatMap(({ path, text }) => {
      const hits = findForbidden(text)
      return hits.length ? [`${path}：${hits.join('、')}：「${text}」`] : []
    })
    expect(bad).toEqual([])
  })

  it('src/content 各模块导出的文字没有禁用词', () => {
    const files = Object.keys(CONTENT_MODULES)
    expect(files).toEqual(expect.arrayContaining(['./safety.ts', './practices.ts']))
    expect(files.some(f => f.startsWith('./scripts/'))).toBe(true)
    const bad = Object.entries(CONTENT_MODULES).flatMap(([file, mod]) =>
      exportedStrings(file, mod).flatMap(({ path, text }) => {
        const hits = findForbidden(text)
        return hits.length ? [`${path}：${hits.join('、')}：「${text.slice(0, 80)}」`] : []
      }),
    )
    expect(bad).toEqual([])
  })
})

/* ---------- 排版 ---------- */

describe('safety.ts 的排版', () => {
  /**
   * 号码的官方名称照原样（「希望24热线」）；日历上的日期写在一起，前后都不加空格（DESIGN.md §4.4：
   * 「2025年5月1日起」「最后更新于2021年」），查空格以前先换成一个词
   */
  const CALENDAR = /\d{4}年(?:\d{1,2}月(?:\d{1,2}日)?)?|\d{1,2}月(?:\d{1,2}日)?|\d{1,2}日/gu
  const checked = SAFETY_STRINGS.map(({ path, text }) => ({
    path,
    text: text.replaceAll('希望24热线', '希望热线').replace(CALENDAR, '某日'),
  }))
  const CJK = /[㐀-鿿]/

  it('中文里用全角标点', () => {
    const bad = checked.filter(({ text }) => CJK.test(text) && /[,;:?!()]/.test(text))
    expect(bad).toEqual([])
  })

  it('中文与数字、拉丁字母之间留空格', () => {
    const bad = checked.filter(({ text }) => /[㐀-鿿][0-9A-Za-z%]|[0-9A-Za-z%][㐀-鿿]/.test(text))
    expect(bad).toEqual([])
  })

  it('没有多余的空白', () => {
    const bad = checked.filter(({ text }) => text !== text.trim() || /\s{2,}|\n/.test(text))
    expect(bad).toEqual([])
  })
})

/* ---------- 证据 id ---------- */

describe('证据 id', () => {
  const lists = [
    FIRST_RUN_NOTICE.evidence,
    ...HEALTH_CHECK.items.map(i => i.evidence),
    ...HEALTH_CHECK.notices.map(n => n.evidence),
    STOP_GUIDANCE.evidence,
    AFTER_PRACTICE.evidence,
    DISCLAIMERS.evidence,
    SLEEP_SOUND_RULES.evidence,
  ]

  it('格式正确，同一处不重复', () => {
    for (const list of lists) {
      expect(list.length).toBeGreaterThan(0)
      expect(new Set(list).size).toBe(list.length)
      for (const id of list)
        expect(id).toMatch(/^(safety|breathing|meditation|practice|sound|ux)-[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  const citable = citableIds()
  it('只引用证据库里没有被否决的 id', () => {
    expect(citable).not.toBeNull()
    expect(citable?.size).toBeGreaterThan(100)
    for (const id of lists.flat()) expect(citable?.has(id), id).toBe(true)
  })
})

/* ---------- 自由文字里的求助信号 ---------- */

describe('mentionsSelfHarm', () => {
  it('认出常见的说法', () => {
    for (const text of [
      '最近总是想死',
      '有过自杀的念头',
      '真的不想活了',
      '想伤害自己',
      '觉得活着没意思',
      '活着没意义',
      '死了算了',
      '不如死了',
      '只想消失',
      '撑不下去了',
      '想结束这一切',
      '想伤害我自己',
      '想过上吊',
      '想烧炭',
    ]) {
      expect(mentionsSelfHarm(text), text).toBe(true)
    }
  })

  it('普通备注不触发', () => {
    for (const text of ['今天练得很平静', '数乱了三次', '睡前有点烦，练完好一些']) {
      expect(mentionsSelfHarm(text), text).toBe(false)
    }
  })
})
