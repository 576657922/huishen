/**
 * 正式构建（vite build + vite preview）：限幅器的 AudioWorklet 要在实时和离线两种音频环境里都能载入、
 * 真的在处理声音；素材要在 Worker 里生成。开发服务器按模块提供源文件，这些问题只有构建产物才暴露得出来。
 */
import { expect, test } from '@playwright/test'
import { openLab, printLive, printReport } from './lab'

test('the built bundle loads the limiter worklet and the asset worker', async ({ page }) => {
  await openLab(page)
  const smoke = await page.evaluate(() => window.audioLab!.smoke())
  console.log('构建产物：', smoke)
  // 构建后限幅器是 assets/ 里单独的一个脚本，不再是 .ts 源文件
  expect(smoke.limiterUrl).toMatch(/\/assets\/.+\.js$/)
  expect(smoke.offlineWorklet).toBe(true)
  expect(smoke.realtimeWorklet).toBe(true)
  expect(smoke.offlineProcessed).toBe(true)
  expect(smoke.generated).toBe(true)
  expect(smoke.generator).toBe('worker')
})

test('the built bundle renders through the full chain within limits', async ({ page }) => {
  await openLab(page)
  const report = await page.evaluate(() =>
    window.audioLab!.runQa({ only: '^(limiter|cue/in$|bell/start|preset/默认放松)', seconds: 30 }),
  )
  printReport(report)
  expect(report.cases.length).toBeGreaterThan(3)
  expect(report.cases.filter(c => !c.ok).map(c => c.label)).toEqual([])
})

test('the built bundle plays, pauses, switches and cancels in a live audio context', async ({ page }) => {
  await openLab(page)
  const result = await page.evaluate(() => window.audioLab!.live())
  printLive(result)
  expect(result.steps.filter(s => !s.ok).map(s => s.name)).toEqual([])
})
