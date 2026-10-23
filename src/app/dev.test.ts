import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { recommend } from '@/content/today'
import {
  createMemorySessionRepo,
  type LocalSessionRepo,
  prefsStore,
  recentDistress,
  setSessionRepo,
  weekDots,
} from '@/data'
import { applyDevParams, seedDemo } from '@/dev/seed'
import { getTimeScale, resetServices } from './services'

/** 设计稿那组数据的「今天」：2026-10-22 星期四，晚上 10 点（这一天的练习都已发生） */
const NOW = new Date(2026, 9, 22, 22, 0)

let repo: LocalSessionRepo

beforeEach(() => {
  resetServices()
  repo = createMemorySessionRepo()
  setSessionRepo(repo)
})

afterEach(() => {
  setSessionRepo(null)
  resetServices()
  prefsStore.getState().reset()
})

describe('演示数据', () => {
  it('8 周的记录，经由真实的数据接口写入', async () => {
    const added = await seedDemo(NOW)
    const all = await repo.all()
    expect(all).toHaveLength(added)
    const days = new Set(all.map(r => r.date))
    expect(days.has('2026-10-22')).toBe(true)
    expect([...days].some(d => d < '2026-09-01')).toBe(true)
    // 专注有回神，数息有数乱了和无效的轮，记录里有自评、感觉和备注
    expect(all.some(r => r.practiceId === 'focus' && (r.marks?.length ?? 0) > 0)).toBe(true)
    expect(all.some(r => (r.count?.resets ?? 0) > 0 && (r.count?.invalid ?? 0) > 0)).toBe(true)
    expect(all.some(r => r.checkin?.pre !== undefined && r.checkin.post !== undefined)).toBe(true)
    expect(all.some(r => r.note)).toBe(true)
    expect(all.some(r => !r.completed)).toBe(true)
  })

  it('与设计稿讲同一个故事：本周一、三、四练过，计划到第 3 周第 2 天', async () => {
    await seedDemo(NOW)
    const all = await repo.all()
    const practised = weekDots(all, NOW)
      .filter(d => d.practiced)
      .map(d => d.key)
    expect(practised).toEqual(['2026-10-19', '2026-10-21', '2026-10-22'])
    const prefs = prefsStore.getState()
    const progress = prefs.programs['mindfulness-8w']
    expect(progress?.done).toHaveLength(15)
    const pick = recommend({
      now: NOW,
      program: progress ? { programId: 'mindfulness-8w', ...progress } : null,
      lastPracticeAt: all[0]?.startedAt ?? null,
      screening: null,
    })
    expect(pick.programDay?.key).toBe('w3d2')
    expect(prefs.onboarded).toBe(true)
    expect(prefs.safety.ackOn).not.toBeNull()
    expect(prefs.stressRatings).toHaveLength(4)
  })

  it('晚于此刻的练习不写；早上专注呼吸之后，最近 3 次里 2 次更紧张或很不舒服', async () => {
    await seedDemo(new Date(2026, 9, 22, 9, 0))
    const all = await repo.all()
    expect(all.filter(r => r.date === '2026-10-22').map(r => r.practiceId)).toEqual(['focus'])
    expect(recentDistress(all)).toBe(true)
  })

  it('再写一次先清空，不会重复', async () => {
    const first = await seedDemo(NOW)
    await seedDemo(NOW)
    expect(await repo.all()).toHaveLength(first)
  })
})

describe('开发用的地址参数', () => {
  it('?speed=N 设置时间流速；?seed=demo 写入演示数据后从地址里去掉', async () => {
    history.replaceState(null, '', '/records?seed=demo&speed=30#x')
    await applyDevParams(window.location)
    expect(getTimeScale()).toBe(30)
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/records?speed=30#x',
    )
    expect((await repo.all()).length).toBeGreaterThan(30)
    history.replaceState(null, '', '/')
  })
})
