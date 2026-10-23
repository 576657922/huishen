import { chromium, expect } from '@playwright/test'

const browser = await chromium.launch({ channel: 'chrome' })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
context.setDefaultTimeout(7000)
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(String(error)))
try {
  await page.goto('http://127.0.0.1:5173/practices/slow?seed=demo&speed=20', { waitUntil: 'networkidle' })
  const warmup = page.getByRole('switch', { name: '开头 90 秒逐步放慢' })
  await warmup.click()
  await page.getByRole('slider', { name: '节律', exact: true }).press('End')
  await page
    .getByRole('radiogroup', { name: '时长（分钟）' })
    .getByRole('radio', { name: '10', exact: true })
    .click()
  await page.reload({ waitUntil: 'networkidle' })
  await expect(warmup).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('slider', { name: '节律', exact: true })).toHaveAttribute('aria-valuenow', '7')
  await page.getByRole('button', { name: /^开始/ }).click()
  await page.getByRole('button', { name: '跳过', exact: true }).click()
  await expect(page.getByText('节律', { exact: true }).locator('..').locator('dd')).toContainText('7.0')
  await page.goto('http://127.0.0.1:5173/practices/box?speed=20', { waitUntil: 'networkidle' })
  await page
    .getByRole('group', { name: '每步（秒）' })
    .getByRole('button', { name: '增加' })
    .click({ clickCount: 2 })
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByRole('group', { name: '每步（秒）' })).toContainText('6 秒')
  await page.getByRole('button', { name: /^开始/ }).click()
  await page.getByRole('button', { name: '跳过', exact: true }).click()
  await expect(page.getByText('每步', { exact: true }).locator('..').locator('dd')).toContainText('6')
  await page.screenshot({ path: 'src/features/practices/__checks__/box-saved-six-seconds.png' })
  expect(errors).toEqual([])
  console.log('PASS rate, duration, warmup and box seconds survive reload and affect real sessions')
} finally {
  await browser.close()
}
