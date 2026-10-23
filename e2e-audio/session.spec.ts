/**
 * 会话联调：在真的 Chrome 里，用真的声音引擎和平台能力跑四次很短的练习（session-lab.html，
 * src/dev/session-lab.ts），确认引擎、声音、数据几个模块接得上：每次都正常结束，onFinish 只来一次，
 * 结果和由它转成的记录说得通；音频环境一直在跑，限幅器的 Worklet 载入并换上；控制台没有报错。
 * 四次在同一个页面、同一个控制器上接连跑（和应用一样两次之间 reset()），上一次留着的结束钟声由下一次撤掉。
 * 每次由点击按钮开始：和应用一样在用户手势里调用 start()。
 */
import { expect, type Page, test } from '@playwright/test'
import type { LabResult, LabRun, RunName } from '../src/dev/session-lab'

/** 背景声铺开后，电平的下四分位至少这么响（dBFS）：只有短促的提示音、钟声时会低得多 */
const BED_AUDIBLE = -60
/** 手动结束后背景声 1.5 秒淡出，3 秒后应当安静（dBFS） */
const SILENT = -70
/** 声音时钟和墙上时钟走过的秒数最多差这么多：音频环境一直在跑，没有停下或卡住 */
const CLOCK_DRIFT = 0.5

async function runInPage(page: Page, name: RunName): Promise<LabRun> {
  await page.locator(`#run-${name}`).click()
  await expect
    .poll(() => page.evaluate(n => window.sessionLab?.results[n]?.done ?? false, name), {
      timeout: 120_000,
      intervals: [500],
    })
    .toBe(true)
  const run = await page.evaluate(n => window.sessionLab?.results[n] ?? null, name)
  if (!run) throw new Error(`没有「${name}」的结果`)
  const r = run.result
  console.log(
    `${run.error ? 'BAD' : 'ok '} ${name.padEnd(6)} 练了 ${r?.practicedSec.toFixed(2) ?? '—'} 秒` +
      `  声音时钟 ${run.audioElapsed} 秒 / 墙上 ${run.wallElapsed} 秒` +
      `  背景声 ${run.levels.bedDb} dB  最响 ${run.levels.peakDb} dB  结束后 ${run.levels.tailDb} dB` +
      `\n      状态 ${run.statuses.join(' → ')}  操作 ${JSON.stringify(run.actions)}` +
      `\n      端口 ${JSON.stringify(run.calls)}` +
      `\n      结果 ${JSON.stringify(r)}`,
  )
  return run
}

/** 每一次都该有的：没出错、onFinish 恰好一次、状态走完一圈、真的出了声 */
function expectFinished(run: LabRun): LabResult {
  expect(run.error).toBeNull()
  expect(run.finishCalls).toBe(1)
  expect(run.statuses).toEqual(['lead', 'running', 'done', 'idle'])
  expect(run.endReason).toBe('complete')
  expect(run.audio).toBe('on')
  expect(run.contextState).toBe('running')
  const r = run.result
  if (!r) throw new Error(`「${run.name}」没有结果`)
  expect(r.completed).toBe(true)
  // 声音时钟按真实时间走过了倒数和整个练习
  expect(run.audioElapsed).toBeGreaterThan(r.practicedSec)
  expect(Math.abs(run.audioElapsed - run.wallElapsed)).toBeLessThan(CLOCK_DRIFT)
  expect(run.levels.bedDb).toBeGreaterThan(BED_AUDIBLE)
  expect(run.levels.maxSample).toBeLessThan(1)
  // 不足 1 分钟的练习不保存，但照样能转成记录（记录按整秒记）
  expect(run.recordable).toBe(false)
  expect(run.record).toMatchObject({ completed: true, actualSec: Math.round(r.practicedSec) })
  return r
}

test('short real sessions run through the engine, sound and platform', async ({ page }) => {
  const problems: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') problems.push(msg.text())
  })
  page.on('pageerror', err => problems.push(err.message))
  await page.goto('/session-lab.html')
  // 开发服务器刚预构建完依赖时会整页重载一次：求值失败就当作还没好
  await expect
    .poll(() => page.evaluate(() => typeof window.sessionLab).catch(() => 'reloading'), { timeout: 60_000 })
    .toBe('object')

  await test.step('slow breathing with glide cues and 有点急 at 15 s', async () => {
    const run = await runInPage(page, 'slow')
    const r = expectFinished(run)
    expect(r.practicedSec).toBe(40)
    expect(run.actions.stepBack).toBeGreaterThanOrEqual(15)
    // 开头从 8 次逐步放慢：前两轮 8 次、第 15 秒起 7.5 次、第 31 秒起 7 次。「有点急」最多到 7 次（PRODUCT §2），
    // 第 15 秒点下时节拍比上限还快，不往慢里调：放慢到 7 次的那一轮起停在 7 次，保持到结束（不再放慢到 6.5）
    expect(run.rates).toEqual([8, 7.5, 7])
    expect(r.finalRate).toBe(7)
    expect(r.rateSteps).toBe(1)
    // 7.5 + 7.5 + 8 + 8 + 8.57 = 39.57 秒时完成第 5 轮
    expect(r.breaths).toBe(5)
    expect(run.calls.glide).toBeGreaterThan(5)
    expect(run.calls.breath).toBeGreaterThan(5)
    // 换速时撤掉排好的起伏和结尾，从当前值重排：结束钟声因此排过不止一次（撤掉的不响）
    expect(run.calls.cancelScheduled).toBeGreaterThanOrEqual(1)
    expect(run.calls['bell:start']).toBe(1)
    expect(run.calls['bell:end']).toBeGreaterThanOrEqual(1)
    expect(run.record).toMatchObject({ practiceId: 'slow', kind: 'paced', rate: 7, rateSteps: 1, breaths: 5 })
    expect(run.record?.params).toEqual({ rate: 5.5, ratio: 'long' })
  })

  await test.step('guided session skipping its skippable section', async () => {
    const run = await runInPage(page, 'guided')
    const r = expectFinished(run)
    expect(run.plannedSec).toBe(30)
    expect(run.sections).toEqual(['feet', 'hands'])
    expect(r.skipped).toEqual(['feet'])
    // 跳过之后整个练习相应提前结束，按提前了的结束时刻记满
    expect(run.endSecs).toHaveLength(2)
    expect(run.endSecs[0]).toBe(30)
    const end = run.endSecs[1] ?? Number.NaN
    expect(end).toBeLessThan(28)
    expect(r.practicedSec).toBeCloseTo(end, 1)
    expect(r.breaths).toBeNull()
    expect(run.calls['cue:section']).toBeGreaterThanOrEqual(1)
    expect(run.calls['bell:end']).toBeGreaterThanOrEqual(1)
    expect(run.record).toMatchObject({ practiceId: 'body-scan', kind: 'guided', skipped: ['feet'] })
  })

  await test.step('focus session with three marks', async () => {
    const run = await runInPage(page, 'focus')
    const r = expectFinished(run)
    expect(r.practicedSec).toBe(20)
    expect(r.marks).toHaveLength(3)
    for (const [i, m] of r.marks.entries()) expect(m).toBeCloseTo(5 * (i + 1), 0)
    expect(run.calls['cue:mark']).toBe(3)
    expect(run.record?.marks).toEqual(r.marks)
  })

  await test.step('unlimited sound session ended by hand', async () => {
    const run = await runInPage(page, 'sound')
    const r = expectFinished(run)
    expect(run.plannedSec).toBe(0)
    expect(run.endSecs).toEqual([])
    expect(r.practicedSec).toBeGreaterThanOrEqual(15)
    expect(r.practicedSec).toBeLessThan(16)
    // 听声音不敲开始钟；不限时没有结束钟，手动结束时背景声淡出
    expect(run.calls['bell:start']).toBeUndefined()
    expect(run.calls['bell:end']).toBeUndefined()
    expect(run.calls.stopBed).toBe(1)
    expect(run.levels.tailDb).toBeLessThan(SILENT)
    expect(run.record).toMatchObject({
      practiceId: 'listen',
      kind: 'sound',
      sound: { ambience: 'forest', music: 'pentatonic', mode: 'relax' },
    })
  })

  const probe = await page.evaluate(() => window.sessionLab?.probe ?? null)
  console.log('整页：', JSON.stringify(probe))
  expect(probe?.limiterLoaded).toBe(true)
  expect(probe?.limiterNodes).toBeGreaterThanOrEqual(1)
  expect(probe?.limiterReady).toBe(true)
  expect(probe?.contextStates).toContain('running')
  expect(probe?.strayFinish).toBe(0)
  expect(problems).toEqual([])
})
