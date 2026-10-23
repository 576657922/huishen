import { chromium, expect } from '@playwright/test'

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  reducedMotion: 'reduce',
})
await context.addInitScript(() =>
  localStorage.setItem(
    'huishen.prefs.v1',
    JSON.stringify({ v: 2, onboarded: true, leadIn: 0, safety: { ackOn: '2026-10-01' } }),
  ),
)
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(String(error)))
try {
  await page.goto('http://127.0.0.1:5173/play/focus?speed=20', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^开始/ }).click()
  await page.waitForTimeout(3500)
  await page.getByRole('button', { name: '不舒服？', exact: true }).click()
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  const end = page.getByRole('button', { name: '结束练习', exact: true })
  expect(await end.evaluate(element => element.getBoundingClientRect().bottom <= innerHeight)).toBe(true)
  await page.screenshot({ path: 'src/features/player/__checks__/distress-200.png' })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = ''
  })
  await page.getByRole('button', { name: '60 秒落地练习', exact: true }).click()
  await expect(page).toHaveURL(/\/play\/grounding/)
  await expect(page.getByRole('button', { name: '不舒服？', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '完成', exact: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('radio')).toHaveCount(4)
  await page.getByRole('radio', { name: '很不舒服', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '先休息一下' })).toBeVisible()
  await page.screenshot({ path: 'src/features/player/__checks__/after-unwell.png' })
  expect(errors).toEqual([])
  console.log('PASS distress → 200% scrollable sheet → grounding → feeling only → rest and help')
} finally {
  await browser.close()
}
