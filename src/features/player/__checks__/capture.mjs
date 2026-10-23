import fs from 'node:fs'
import { chromium, expect } from '@playwright/test'

const round = process.argv[2] ?? 'round1'
const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
for (const device of ['phone', 'desktop', 'landscape']) {
  const context = await browser.newContext({
    viewport:
      device === 'phone'
        ? { width: 390, height: 844 }
        : device === 'desktop'
          ? { width: 1440, height: 900 }
          : { width: 844, height: 390 },
    deviceScaleFactor: device === 'phone' ? 2 : 1,
    reducedMotion: round === 'round1' ? 'reduce' : 'no-preference',
  })
  context.setDefaultTimeout(7000)
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(String(error)))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await context.addInitScript(() =>
    localStorage.setItem(
      'huishen.prefs.v1',
      JSON.stringify({
        v: 2,
        onboarded: true,
        safety: { ackOn: '2026-10-01' },
        checkin: { prePost: false },
        practice: { slow: { warmup: false } },
      }),
    ),
  )
  for (const id of process.argv[3]
    ? process.argv[3].split(',')
    : ['slow', 'box', 'focus', 'breath-count', 'body-scan', 'timer', 'listen', 'sleep', 'grounding']) {
    await page.goto(`http://127.0.0.1:5173/play/${id}?speed=20`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /^开始/ }).click()
    await page.waitForTimeout(id === 'body-scan' ? 3000 : 1600)
    await page.evaluate(() => document.fonts.ready)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(page.getByRole('button', { name: '不舒服？', exact: true })).toBeVisible()
    const metrics = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      viewport: innerHeight,
      width: document.documentElement.scrollWidth,
      innerWidth,
    }))
    console.log(id, device, JSON.stringify(metrics))
    await page.screenshot({
      animations: 'disabled',
      path: `src/features/player/__checks__/${round}-${id}-${device}.png`,
    })
    if (id === 'slow') {
      await page.getByRole('button', { name: '暂停', exact: true }).click()
      await page.screenshot({
        animations: 'disabled',
        path: `src/features/player/__checks__/${round}-pause-${device}.png`,
      })
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: '不舒服？', exact: true }).click()
      await page.screenshot({
        animations: 'disabled',
        path: `src/features/player/__checks__/${round}-distress-${device}.png`,
      })
    }
  }
  await context.close()
}
fs.writeFileSync('src/features/player/__checks__/capture-errors.json', `${JSON.stringify(errors, null, 2)}\n`)
await browser.close()
if (errors.length) {
  console.log(errors)
  process.exitCode = 1
}
