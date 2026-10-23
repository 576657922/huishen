/**
 * 实时冒烟（开发服务器）：在真的 AudioContext 里走一遍会话引擎用到的 AudioPort 调用，
 * 听输出端在该响的时候响、该静的时候静（暂停、换声音、结尾淡出被取代、撤销、试听）。
 */
import { expect, test } from '@playwright/test'
import { openLab, printLive } from './lab'

test('the engine plays, pauses, switches and cancels in a live audio context', async ({ page }) => {
  await openLab(page)
  const result = await page.evaluate(() => window.audioLab!.live())
  printLive(result)
  expect(result.steps.filter(s => !s.ok).map(s => s.name)).toEqual([])
})
