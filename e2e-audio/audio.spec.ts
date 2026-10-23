/**
 * 离线质检（开发服务器）：每种声景、每种音乐、默认的放松与睡前组合、跟随节拍加滑音、钟声和提示音，
 * 都按正式播放的链路在 OfflineAudioContext 里渲染，再按 EBU R 128 测量。
 * 不合格时打印出是哪一项、实测多少，改 src/audio/params.ts 后重跑。
 * 只跑一部分：AUDIO_QA_ONLY='^(ambience|sleep)/' npx playwright test -c playwright.audio.config.ts
 */
import { expect, test } from '@playwright/test'
import { openLab, printReport } from './lab'

const only = process.env.AUDIO_QA_ONLY

test('every sound passes the offline loudness and quality checks', async ({ page }) => {
  await openLab(page)
  const report = await page.evaluate(o => window.audioLab!.runQa({ only: o }), only)
  printReport(report)
  expect(report.cases.length).toBeGreaterThan(0)
  expect(report.cases.filter(c => !c.ok).map(c => c.label)).toEqual([])
  if (!only) {
    // 每类场景都真的测到了
    const groups = new Set(report.cases.map(c => c.group))
    for (const g of [
      'ambience',
      'music',
      'preset',
      'sleep',
      'switch',
      'paced',
      'bell',
      'cue',
      'limiter',
      'rate',
    ] as const)
      expect(groups).toContain(g)
  }
})
