/**
 * 声音目录的检查：顺序、名字和标注照 PRODUCT.md §2；flags 与标注、依据说明一致；两种模式下的过滤和回退；
 * 默认组合与时长（与练习目录、会话引擎一致）；安全文案取自 safety.ts；文案规则（PRODUCT.md §9–§11）；
 * 引用的证据都在证据库里、没有被否决。
 */
import { describe, expect, it } from 'vitest'
import type { AmbienceId, MusicId, SoundMode } from '@/audio/types'
import { NO_BELL_FADE_SEC } from '@/engine/session'
import { GRADE_NAMES } from './copy'
import { PRACTICE_BY_ID, soundModeOf } from './practices'
import { findForbidden, SLEEP_SOUND_RULES } from './safety'
import {
  AMBIENCES,
  type AnySound,
  descriptionFor,
  findSound,
  fitMix,
  isAllowed,
  LISTEN,
  listenLabel,
  MUSIC,
  NOISES,
  NONE,
  SOUND_COPY,
  SOUND_GROUPS,
  SOUND_PRESETS,
  type SoundGroupId,
  type SoundIcon,
  soundName,
  soundsFor,
  UNLIMITED,
  UNLIMITED_CONFIRM,
} from './sounds'

type CatalogId = Exclude<AmbienceId | MusicId, 'none'>

const ALL: readonly AnySound[] = [...AMBIENCES, ...NOISES, ...MUSIC]
const MODES: readonly SoundMode[] = ['relax', 'sleep']
const ids = (list: readonly AnySound[]): string[] => list.map(s => s.id)

// 用 Record 列举：AmbienceId、MusicId 增减成员时这里编译报错，提醒目录跟着改
const GROUP_OF: Record<CatalogId, SoundGroupId> = {
  rain: 'nature',
  stream: 'nature',
  ocean: 'nature',
  forest: 'nature',
  birds: 'nature',
  wind: 'nature',
  pink: 'noise',
  brown: 'noise',
  drone: 'music',
  pentatonic: 'music',
  phasing: 'music',
}

const ICON_OF: Record<CatalogId, SoundIcon> = {
  rain: 'rain',
  stream: 'stream',
  ocean: 'wave',
  forest: 'forest',
  birds: 'bird',
  wind: 'wind',
  pink: 'noise',
  brown: 'noise',
  drone: 'music',
  pentatonic: 'music',
  phasing: 'music',
}

/* ---------- 界面上会显示的全部文字，连同出处，失败时好定位 ---------- */

const TEXTS: [where: string, text: string][] = []
const add = (where: string, ...texts: readonly string[]): void => {
  for (const t of texts) TEXTS.push([where, t])
}
for (const s of ALL) {
  add(s.id, s.name, s.description, s.evidenceNote)
  if (s.sleepDescription !== undefined) add(s.id, s.sleepDescription)
  if (s.tag !== null) add(s.id, s.tag)
}
for (const [id, g] of Object.entries(SOUND_GROUPS)) add(`组 ${id}`, g.name, ...Object.values(g.note))
for (const [mode, l] of Object.entries(LISTEN))
  add(`听声音 ${mode}`, l.name, l.note, ...l.minutes.map(listenLabel))
for (const [id, b] of Object.entries(SOUND_COPY)) add(`说明 ${id}`, b.title, ...b.lines)
const { paragraphs, ...confirmRest } = UNLIMITED_CONFIRM
add('不限时确认', ...paragraphs, ...Object.values(confirmRest))
add('无', NONE.name, NONE.note, ...Object.values(NONE.summary))

/**
 * 比 safety.ts 的禁用表更严的几条（PRODUCT.md §10–§11、sound.notes §8）：声音文案里连「心率」「皮质醇」「频率」
 * 这些词都不出现，免得被读成生理声明；你称，不用「您」；术语用「正念」
 */
const BANNED = [
  '治疗',
  '治愈',
  '疗效',
  '疗程',
  '疗法',
  '疗愈',
  '科学证明',
  '免疫力',
  '血压',
  '心率',
  '皮质醇',
  '重塑大脑',
  '排毒',
  '零副作用',
  '100%',
  '见效',
  '开启',
  '解锁',
  '能量',
  '频率',
  '脑波',
  'α波',
  'θ波',
  'DNA',
  '遇见更好的自己',
  '让我们',
  '之旅',
  '静观',
  '您',
  '绝对',
  '保证',
  '神奇',
  '彻底',
]

/** 最高级：查说法，不查「最」字本身，「最大音量」「调到最低」不算 */
const SUPERLATIVE =
  /最(好|佳|棒|有效|放松|舒服|舒适|适合|强|安全|快|科学|专业|健康|自然)|第一|顶级|极致|终极|绝佳/

/** 文字里违反某条规则的那些，带出处 */
const violations = (bad: (text: string) => boolean): string[] =>
  TEXTS.filter(([, t]) => bad(t)).map(([where, t]) => `${where}：${t}`)

/** 按句号分句：等级要和「可能」在同一句里 */
const sentences = (text: string): string[] => text.split('。').filter(s => s.length > 0)

/* ---------- 证据 ---------- */

const CITED: readonly (readonly string[])[] = [
  ...ALL.map(s => s.evidence),
  ...Object.values(SOUND_GROUPS).flatMap(g => Object.values(g.evidence)),
  ...Object.values(LISTEN).map(l => l.evidence),
  ...Object.values(SOUND_COPY).map(b => b.evidence),
  NONE.evidence,
]

interface Claim {
  id: string
  rejected: boolean
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)

/**
 * 证据库可能是数组，也可能是 { claims: [...] } 或以 id 为键的对象；被否决的条目标为 rejected
 * （与 practices.test.ts 相同；整合时可以挪到 src/test/ 共用）
 */
function claimsIn(json: unknown): Claim[] {
  let items: unknown[] = []
  const rejectedIds = new Set<string>()
  if (Array.isArray(json)) items = json
  else if (isRecord(json)) {
    if (Array.isArray(json.claims)) items = json.claims
    else
      items = Object.entries(json).map(([key, v]) =>
        isRecord(v) && v.id === undefined ? { ...v, id: key } : v,
      )
    if (Array.isArray(json.rejected)) {
      for (const r of json.rejected as unknown[]) {
        if (typeof r === 'string') rejectedIds.add(r)
        else if (isRecord(r) && typeof r.id === 'string') rejectedIds.add(r.id)
      }
    }
  }
  return items.flatMap((item): Claim[] => {
    if (!isRecord(item) || typeof item.id !== 'string') return []
    const v = item.verification
    const verdict = isRecord(v) && typeof v.verdict === 'string' ? v.verdict : item.status
    return [
      { id: item.id, rejected: verdict === 'rejected' || item.rejected === true || rejectedIds.has(item.id) },
    ]
  })
}

/** 研究组定稿的证据库（已提交到仓库）；读不到时下面的测试失败，不跳过 */
const FINAL = import.meta.glob('../../docs/research/evidence.json', { eager: true, import: 'default' })
const CLAIMS = new Map(
  Object.values(FINAL)
    .flatMap(claimsIn)
    .map(c => [c.id, c] as const),
)

/* ---------- 检查 ---------- */

describe('目录', () => {
  it('自然声按证据排序：雨、溪流、海浪、林间、鸟鸣、风', () => {
    expect(AMBIENCES.map(s => [s.id, s.name])).toEqual([
      ['rain', '雨'],
      ['stream', '溪流'],
      ['ocean', '海浪'],
      ['forest', '林间'],
      ['birds', '鸟鸣'],
      ['wind', '风'],
    ])
  })

  it('噪声：粉噪声、棕噪声；音乐：长音、五声、回响', () => {
    expect(NOISES.map(s => [s.id, s.name])).toEqual([
      ['pink', '粉噪声'],
      ['brown', '棕噪声'],
    ])
    expect(MUSIC.map(s => [s.id, s.name])).toEqual([
      ['drone', '长音'],
      ['pentatonic', '五声'],
      ['phasing', '回响'],
    ])
  })

  it('覆盖全部声景和音乐，分组正确，id 不重复，不含 none', () => {
    const lists = soundsFor('relax')
    for (const group of ['nature', 'noise', 'music'] as const) {
      const expected = Object.entries(GROUP_OF)
        .filter(([, g]) => g === group)
        .map(([id]) => id)
      expect(ids(lists[group]).sort()).toEqual(expected.sort())
    }
    expect(new Set(ids(ALL)).size).toBe(ALL.length)
    expect(ids(ALL)).not.toContain('none')
  })

  it('图标', () => {
    for (const s of ALL) expect(s.icon, s.id).toBe(ICON_OF[s.id])
  })

  it('描述具体、简短：不超过 20 字，句末不加标点，互不相同', () => {
    const all = ALL.flatMap(s => [
      s.description,
      ...(s.sleepDescription === undefined ? [] : [s.sleepDescription]),
    ])
    for (const d of all) {
      expect([...d].length, d).toBeLessThanOrEqual(20)
      expect(d).not.toMatch(/[。，；：、]$/)
    }
    expect(new Set(all).size).toBe(all.length)
  })

  it('依据说明是完整的句子，互不相同', () => {
    for (const s of ALL) expect(s.evidenceNote, s.id).toMatch(/。$/)
    expect(new Set(ALL.map(s => s.evidenceNote)).size).toBe(ALL.length)
  })

  it('每组都有名字、所在的层和两种模式的说明', () => {
    expect(Object.values(SOUND_GROUPS).map(g => g.name)).toEqual(['自然声', '噪声', '音乐'])
    expect(Object.values(SOUND_GROUPS).map(g => g.slot)).toEqual(['ambience', 'ambience', 'music'])
    for (const g of Object.values(SOUND_GROUPS))
      for (const mode of MODES) {
        expect(g.note[mode], `${g.name} ${mode}`).toMatch(/。$/)
        expect(g.evidence[mode].length, `${g.name} ${mode}`).toBeGreaterThan(0)
      }
  })

  it('睡前的组说明讲睡眠的证据：自然声和噪声说清证据很弱，音乐说清仪器测不出改善', () => {
    for (const id of ['nature', 'noise'] as const)
      expect(SOUND_GROUPS[id].note.sleep, id).toMatch(/证据很弱|（证据：不足）/)
    expect(SOUND_GROUPS.nature.note.sleep).toContain('看的是放松，不是睡眠')
    expect(SOUND_GROUPS.music.note.sleep).toContain('没有看到改善')
  })

  it('「无」：选项名、摘要里的说法，以及「不放声音也可以」', () => {
    expect(NONE.name).toBe('无')
    expect(NONE.summary).toEqual({ ambience: '不放声景', music: '不加音乐' })
    expect(NONE.note.startsWith('不放声音也可以。')).toBe(true)
  })
})

describe('标注', () => {
  it('名字旁的标注与 flags 一致', () => {
    for (const s of ALL) {
      const tag = s.tag ?? ''
      expect(tag.includes('无健康声明'), s.id).toBe(s.flags.noHealthClaim)
      expect(tag.includes('证据很弱'), s.id).toBe(s.flags.weakEvidence)
      expect(s.tag === null, s.id).toBe(!s.flags.noHealthClaim && !s.flags.weakEvidence)
    }
  })

  it('证据很弱的声音，依据说明里的等级是「不足」', () => {
    for (const s of ALL) expect(s.evidenceNote.includes('（证据：不足）'), s.id).toBe(s.flags.weakEvidence)
  })

  it('噪声标「遮蔽环境噪音 · 证据很弱」，五声标风格、无健康声明', () => {
    for (const s of NOISES) expect(s.tag, s.id).toBe('遮蔽环境噪音 · 证据很弱')
    expect(findSound('pentatonic')?.tag).toBe('风格 · 无健康声明')
  })

  it('只有鸟鸣是白天的声音，白天的声音不进睡前', () => {
    expect(ids(ALL.filter(s => s.flags.dayOnly))).toEqual(['birds'])
    for (const s of ALL) expect(s.flags.sleepOk, s.id).toBe(!s.flags.dayOnly)
  })

  it('没有专门研究的声音只能标「无健康声明」', () => {
    for (const s of ALL) if (s.evidence.length === 0) expect(s.flags.noHealthClaim, s.id).toBe(true)
  })
})

describe('模式', () => {
  it('放松时全部可选；不写模式按放松', () => {
    expect(soundsFor('relax')).toEqual({ nature: AMBIENCES, noise: NOISES, music: MUSIC })
    expect(soundsFor()).toBe(soundsFor('relax'))
    expect(isAllowed('birds')).toBe(true)
  })

  it('睡前去掉鸟鸣，保留水声、林间、风、噪声和音乐', () => {
    const sleep = soundsFor('sleep')
    expect(ids(sleep.nature)).toEqual(['rain', 'stream', 'ocean', 'forest', 'wind'])
    expect(ids(sleep.noise)).toEqual(['pink', 'brown'])
    expect(ids(sleep.music)).toEqual(['drone', 'pentatonic', 'phasing'])
  })

  it('林间睡前的描述里没有鸟声，其他声音两种模式描述相同', () => {
    const forest = findSound('forest')!
    expect(descriptionFor(forest, 'relax')).toContain('鸟')
    expect(descriptionFor(forest, 'sleep')).not.toContain('鸟')
    for (const s of ALL)
      if (s.id !== 'forest') expect(descriptionFor(s, 'sleep'), s.id).toBe(descriptionFor(s, 'relax'))
    // 睡前的说明和描述对得上
    expect(SOUND_COPY.dayOnly.lines.join('')).toContain('林间在睡前模式里只有溪水和风')
  })

  it('isAllowed 与 soundsFor 一致', () => {
    for (const mode of MODES) {
      const listed = new Set(Object.values(soundsFor(mode)).flatMap(list => ids(list)))
      for (const s of ALL) expect(isAllowed(s.id, mode), `${s.id} ${mode}`).toBe(listed.has(s.id))
    }
  })

  it('none 总是可以，不认识的 id 不可以', () => {
    for (const mode of MODES) {
      expect(isAllowed('none', mode)).toBe(true)
      expect(isAllowed('thunder' as AmbienceId, mode)).toBe(false)
    }
  })

  it('同一模式每次返回同一组数组', () => {
    expect(soundsFor('sleep')).toBe(soundsFor('sleep'))
    expect(soundsFor('relax').nature).toBe(soundsFor('relax').nature)
  })
})

describe('回退', () => {
  it('睡前的鸟鸣换成睡前的默认，林间和 none 保留', () => {
    expect(fitMix({ ambience: 'birds', music: 'drone' }, 'sleep')).toEqual({
      ambience: 'rain',
      music: 'drone',
    })
    expect(fitMix({ ambience: 'forest', music: 'none' }, 'sleep')).toEqual({
      ambience: 'forest',
      music: 'none',
    })
    expect(fitMix({ ambience: 'none', music: 'none' }, 'sleep')).toEqual({ ambience: 'none', music: 'none' })
  })

  it('不认识的 id、放错层的 id 换成这个模式的默认', () => {
    expect(fitMix({ ambience: 'thunder' as AmbienceId, music: 'harp' as MusicId }, 'relax')).toEqual({
      ambience: 'stream',
      music: 'none',
    })
    expect(fitMix({ ambience: 'drone' as AmbienceId, music: 'rain' as MusicId }, 'sleep')).toEqual({
      ambience: 'rain',
      music: 'none',
    })
  })

  it('不写模式时看 mix.mode，再没有按放松', () => {
    expect(fitMix({ ambience: 'birds', music: 'none', mode: 'sleep' }).ambience).toBe('rain')
    expect(fitMix({ ambience: 'birds', music: 'none' }).ambience).toBe('birds')
  })

  it('可用的组合原样保留', () => {
    for (const mode of MODES)
      for (const s of soundsFor(mode).nature)
        expect(fitMix({ ambience: s.id, music: 'phasing' }, mode).ambience).toBe(s.id)
  })
})

describe('默认组合', () => {
  it('放松：溪流，不加音乐', () => {
    expect(SOUND_PRESETS.relax).toEqual({ ambience: 'stream', music: 'none', mode: 'relax' })
  })

  it('睡前：雨或棕噪声，不加音乐', () => {
    const p = SOUND_PRESETS.sleep
    expect(['rain', 'brown']).toContain(p.ambience)
    expect(p.music).toBe('none')
    expect(p.mode).toBe('sleep')
  })

  it('默认组合在自己的模式里可用，回退不会改动它', () => {
    for (const mode of MODES) {
      const p = SOUND_PRESETS[mode]
      expect(p.mode).toBe(mode)
      expect(isAllowed(p.ambience, mode)).toBe(true)
      expect(isAllowed(p.music, mode)).toBe(true)
      expect(fitMix(p)).toEqual({ ambience: p.ambience, music: p.music })
    }
  })

  it('两种模式的默认与练习目录里「听声音」两项的默认声音一致，详情页上写的默认也对得上', () => {
    for (const mode of MODES) {
      const { ambience, music } = SOUND_PRESETS[mode]
      expect(PRACTICE_BY_ID[LISTEN[mode].practiceId].sound, mode).toEqual({ ambience, music })
    }
    expect(PRACTICE_BY_ID.listen.description).toContain(`默认是${soundName(SOUND_PRESETS.relax.ambience)}声`)
    expect(PRACTICE_BY_ID.sleep.description).toContain(`默认是${soundName(SOUND_PRESETS.sleep.ambience)}声`)
  })
})

describe('听声音', () => {
  it('放松 10 / 20 / 30 分钟，默认 20', () => {
    expect(LISTEN.relax.minutes).toEqual([10, 20, 30])
    expect(LISTEN.relax.defaultMinutes).toBe(20)
  })

  it('睡前 15 / 30 / 45 / 60 分钟或不限，默认 45', () => {
    expect(LISTEN.sleep.minutes).toEqual([15, 30, 45, 60, UNLIMITED])
    expect(LISTEN.sleep.defaultMinutes).toBe(45)
  })

  it('默认时长在选项里，只有睡前能不限时', () => {
    for (const mode of MODES) expect(LISTEN[mode].minutes).toContain(LISTEN[mode].defaultMinutes)
    expect(LISTEN.relax.minutes).not.toContain(UNLIMITED)
    expect(LISTEN.sleep.defaultMinutes).not.toBe(UNLIMITED)
  })

  it('对应练习目录里的「听声音」两项：时长取自目录，模式与 soundModeOf 一致', () => {
    expect(LISTEN.relax.practiceId).toBe('listen')
    expect(LISTEN.sleep.practiceId).toBe('sleep')
    expect(LISTEN.relax.name).toBe('放松')
    expect(LISTEN.sleep.name).toBe('睡前')
    for (const mode of MODES) {
      const id = LISTEN[mode].practiceId
      expect(LISTEN[mode].minutes).toEqual(PRACTICE_BY_ID[id].durations)
      expect(LISTEN[mode].defaultMinutes).toBe(PRACTICE_BY_ID[id].defaultMinutes)
      expect(soundModeOf(id)).toBe(mode)
    }
  })

  it('放松说明里的默认时长与设置一致', () => {
    expect(LISTEN.relax.note).toContain(`默认 ${LISTEN.relax.defaultMinutes} 分钟`)
  })

  it('时长文字', () => {
    expect(listenLabel(UNLIMITED)).toBe('不限')
    expect(listenLabel(45)).toBe('45 分钟')
  })

  it('睡前说明：研究时长出自音乐的试验；淡出的说法取自 safety.ts，时长与会话引擎一致', () => {
    expect(LISTEN.sleep.note).toContain('听音乐 25–60 分钟')
    expect(LISTEN.sleep.note.endsWith(SLEEP_SOUND_RULES.timer)).toBe(true)
    expect(SLEEP_SOUND_RULES.timer).toContain(`用 ${NO_BELL_FADE_SEC / 60} 分钟慢慢变轻`)
  })

  it('选不限时要确认：文案就是 safety.ts 的那一份，说明整夜播放怎么做，并提到婴儿', () => {
    const { allNight, infants } = SLEEP_SOUND_RULES
    expect(UNLIMITED_CONFIRM).toBe(allNight)
    expect(UNLIMITED_CONFIRM.paragraphs.filter(p => p === infants)).toHaveLength(1)
    const text = UNLIMITED_CONFIRM.paragraphs.join('')
    for (const w of ['一直', '音量', '耳机', '婴儿']) expect(text).toContain(w)
    expect(UNLIMITED_CONFIRM.confirm).not.toBe(UNLIMITED_CONFIRM.cancel)
  })
})

describe('说明文字', () => {
  it('音量与耳机：比安静交谈更轻、设备音量上限、世卫组织的标准、整夜外放、婴儿', () => {
    const text = SOUND_COPY.volume.lines.join('')
    for (const w of [
      '比安静交谈更轻',
      '144 名',
      `${SLEEP_SOUND_RULES.deviceVolumeMax}%`,
      '世卫组织',
      '80 分贝',
      '40 小时',
      '3 分贝',
      '离枕边远一些',
      '不戴耳机',
    ])
      expect(text).toContain(w)
    // 与 safety.ts 一字不差
    for (const line of [SLEEP_SOUND_RULES.headphones, SLEEP_SOUND_RULES.placement, SLEEP_SOUND_RULES.infants])
      expect(SOUND_COPY.volume.lines).toContain(line)
    expect(SOUND_COPY.volume.lines[0]?.startsWith(SLEEP_SOUND_RULES.volume)).toBe(true)
  })

  it('iOS 锁屏：会停、让屏幕亮着、怎么改自动锁定并改回来、低电量模式、整夜充电放哪儿', () => {
    const text = SOUND_COPY.iosLock.lines.join('')
    for (const w of [
      'iPhone',
      '锁屏',
      '切到别的应用',
      '亮着',
      '「自动锁定」',
      '改回来',
      '低电量模式',
      '充电器',
      '离枕边远一些',
      '枕头下',
    ])
      expect(text).toContain(w)
  })

  it('解释「无健康声明」：说清意思，五行、脏腑对应没有研究支持', () => {
    expect(SOUND_COPY.noHealthClaim.title).toBe('无健康声明')
    const text = SOUND_COPY.noHealthClaim.lines.join('')
    expect(SOUND_COPY.noHealthClaim.lines[0]?.startsWith('「无健康声明」的意思是')).toBe(true)
    expect(text).toContain('没有可靠的研究支持')
  })

  it('声音与睡眠：先说自然声和噪声，说清仪器测不出改善，并指向睡眠门诊', () => {
    const lines = SOUND_COPY.sleep.lines
    expect(lines[0]).toContain('自然声和噪声')
    const text = lines.join('')
    for (const w of ['证据很弱', '没有看到改善', '睡眠门诊']) expect(text).toContain(w)
    expect(lines.at(-1)).toBe(SLEEP_SOUND_RULES.clinic)
    // 噪声这一组的说明取自 safety.ts
    expect(SOUND_GROUPS.noise.note).toEqual({
      relax: SLEEP_SOUND_RULES.noise,
      sleep: SLEEP_SOUND_RULES.noise,
    })
  })
})

describe('名字查询', () => {
  it('按 id 找声音和名字', () => {
    expect(findSound('ocean')?.name).toBe('海浪')
    expect(findSound('none')).toBeUndefined()
    expect(soundName('none')).toBe(NONE.name)
    expect(soundName('phasing')).toBe('回响')
    expect(soundName('thunder' as AmbienceId)).toBeUndefined()
  })
})

describe('冻结', () => {
  it('导出的数据都不能改', () => {
    const forest = findSound('forest')!
    for (const x of [
      AMBIENCES,
      forest,
      forest.flags,
      forest.evidence,
      SOUND_GROUPS.music.note,
      SOUND_PRESETS.sleep,
      LISTEN.sleep,
      LISTEN.sleep.minutes,
      UNLIMITED_CONFIRM.paragraphs,
      SOUND_COPY.iosLock.lines,
      NONE.summary,
      soundsFor('sleep'),
      soundsFor('sleep').nature,
    ])
      expect(Object.isFrozen(x)).toBe(true)
  })
})

describe('文案规则', () => {
  it('不用禁用词：safety.ts 的禁用表，加上这里更严的几条', () => {
    const found = TEXTS.flatMap(([where, t]) =>
      [...findForbidden(t), ...BANNED.filter(w => t.includes(w))].map(w => `${where}「${w}」：${t}`),
    )
    expect(found).toEqual([])
  })

  it('不用最高级', () => {
    expect(violations(t => SUPERLATIVE.test(t))).toEqual([])
  })

  it('不用感叹号和表情符号', () => {
    expect(violations(t => /[!！\p{Extended_Pictographic}]/u.test(t))).toEqual([])
  })

  it('标点用全角', () => {
    expect(violations(t => /[,.;:?()"'[\]]/.test(t))).toEqual([])
  })

  it('汉字与数字、拉丁字母之间留空格', () => {
    expect(violations(t => /\p{Script=Han}[0-9A-Za-z%]|[0-9A-Za-z%]\p{Script=Han}/u.test(t))).toEqual([])
  })

  it('全角标点两侧不加空格，没有多余空白', () => {
    expect(violations(t => / [，。、；：？「」（）]|[，。、；：？「」（）] /.test(t))).toEqual([])
    expect(violations(t => t !== t.trim() || / {2}/.test(t))).toEqual([])
  })

  it('说「可能」的那一句标明证据等级；等级只用 GRADE_NAMES 里的名字', () => {
    expect(
      violations(t => sentences(t).some(s => s.includes('可能') && !/（证据：[^）]+）/.test(s))),
    ).toEqual([])
    const grades = TEXTS.flatMap(([, t]) => [...t.matchAll(/（证据：([^）]+)）/g)].map(m => m[1]))
    expect(grades.length).toBeGreaterThan(0)
    for (const g of grades) expect(Object.values(GRADE_NAMES)).toContain(g)
  })

  it('不写尾注式的「（无健康声明）」：标注已经在名字旁边', () => {
    expect(violations(t => t.includes('（无健康声明）'))).toEqual([])
  })
})

describe('证据', () => {
  it('id 格式正确，同一处不重复引用', () => {
    for (const list of CITED) {
      for (const id of list)
        expect(id).toMatch(/^(sound|safety|ux|meditation|breathing|practice)-[a-z0-9]+(-[a-z0-9]+)*$/)
      expect(new Set(list).size).toBe(list.length)
    }
  })

  it('引用的证据都在证据库里，没有被否决', () => {
    expect(CLAIMS.size).toBeGreaterThan(100)
    for (const id of new Set(CITED.flat())) {
      const claim = CLAIMS.get(id)
      expect(claim, id).toBeDefined()
      expect(claim?.rejected, id).toBe(false)
    }
  })
})
