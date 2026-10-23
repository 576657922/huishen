import { chromium, expect } from '@playwright/test'

const browser = await chromium.launch({ channel: 'chrome' })
const errors = []
try {
  for (const device of ['phone', 'desktop'])
    for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport: device === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
        deviceScaleFactor: device === 'phone' ? 2 : 1,
        colorScheme,
        reducedMotion: 'reduce',
      })
      const page = await context.newPage()
      page.on('pageerror', error => errors.push(String(error)))
      await page.goto('http://127.0.0.1:5173/play/focus?seed=demo&speed=20', { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: /^开始/ }).click()
      await page.getByRole('dialog').getByRole('radio', { name: '8', exact: true }).click()
      await page.waitForTimeout(3600)
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('Space')
        await page.waitForTimeout(100)
      }
      await page.getByRole('button', { name: '结束', exact: true }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: '结束', exact: true }).click()
      await expect(page.getByRole('button', { name: '完成', exact: true })).toBeVisible()
      await page.getByRole('radio', { name: '更紧张', exact: true }).click()
      await page.locator('#gentler-title').waitFor()
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(150)
      await page.screenshot({
        path: `src/features/player/__checks__/summary-${device}-${colorScheme}.png`,
        fullPage: true,
        animations: 'disabled',
      })
      console.log('PASS summary', device, colorScheme)
      await context.close()
    }
  expect(errors).toEqual([])
} finally {
  await browser.close()
}
