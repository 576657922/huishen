/**
 * 校准（只在 AUDIO_CALIBRATE=1 时运行）：每一层单独渲染 3 分钟，测综合响度，打印出新的 LAYER_TRIMS，
 * 粘贴到 src/audio/params.ts。改了某一层的声音之后运行：
 * AUDIO_CALIBRATE=1 npx playwright test -c playwright.audio.config.ts calibrate
 */
import { test } from '@playwright/test'
import { openLab } from './lab'

test('calibrate layer trims', async ({ page }) => {
  test.skip(!process.env.AUDIO_CALIBRATE, '设置 AUDIO_CALIBRATE=1 才运行')
  await openLab(page)
  const seconds = Number(process.env.AUDIO_CALIBRATE_SECONDS) || undefined
  const { rows, source } = await page.evaluate(s => window.audioLab!.calibrate({ seconds: s }), seconds)
  for (const r of rows)
    console.log(
      `${r.key.padEnd(11)} ${r.mode.padEnd(6)} 实测 ${r.measured.toFixed(2)}  现值 ${r.trim}  建议 ${r.suggested}`,
    )
  console.log(`\n${source}`)
})
