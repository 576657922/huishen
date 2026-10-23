import fs from 'node:fs'
import { chromium, expect } from '@playwright/test'

const browser = await chromium.launch({ channel: 'chrome' })
const cases = [
  { id: 'slow', minutes: 3 },
  { id: 'box', minutes: 3 },
  { id: 'focus', minutes: 5 },
  { id: 'breath-count', minutes: 5 },
  { id: 'body-scan', minutes: 5 },
  { id: 'timer', minutes: 1 },
  { id: 'cyclic-sigh', minutes: 1 },
  { id: 'listen', minutes: 10 },
  { id: 'sleep', minutes: 15 },
  { id: 'grounding', minutes: 1 },
]
if (process.argv[2]) cases.splice(0, cases.length, ...cases.filter(item => item.id === process.argv[2]))
const results = [],
  errors = []
let cursor = 0
async function run({ id, minutes }) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  })
  context.setDefaultTimeout(10000)
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(`${id}: ${String(error)}`))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`${id}: ${message.text()}`)
  })
  try {
    await context.addInitScript(
      ({ id, minutes }) =>
        localStorage.setItem(
          'huishen.prefs.v1',
          JSON.stringify({
            v: 2,
            onboarded: true,
            leadIn: 0,
            safety: { ackOn: '2026-10-01' },
            checkin: { prePost: id === 'focus' },
            practice: { [id]: { minutes, warmup: false } },
          }),
        ),
      { id, minutes },
    )
    await page.goto(`http://127.0.0.1:5173/play/${id}?speed=20`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /^开始/ }).click()
    if (id === 'focus') await page.getByRole('dialog').getByRole('radio', { name: '8', exact: true }).click()
    await page.getByRole('button', { name: '暂停', exact: true }).waitFor()
    await page.waitForTimeout(600)
    if (id === 'slow') {
      for (let i = 0; i < 3; i++) {
        await page.getByRole('button', { name: '有点急', exact: true }).click()
        await page.waitForTimeout(700)
      }
      await expect(page.getByRole('button', { name: '有点急', exact: true })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
    }
    if (id === 'focus') {
      await page.keyboard.press('Space')
      await page.waitForTimeout(100)
      await page.getByRole('button', { name: /^回神/ }).click()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog', { name: '已暂停' })).toBeVisible()
      await page.keyboard.press('Escape')
    }
    if (id === 'breath-count') {
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('f')
        await page.waitForTimeout(100)
      }
      await page.keyboard.press('j')
      await page.keyboard.press('Backspace')
    }
    if (id === 'body-scan') await page.getByRole('button', { name: '跳过这一处', exact: true }).click()
    await expect(page.getByRole('button', { name: '完成', exact: true })).toBeVisible({ timeout: 60000 })
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    if (id === 'sleep') await expect(page.getByRole('radio')).toHaveCount(0)
    else await page.getByRole('radio', { name: '更平静', exact: true }).click()
    if (id === 'focus') {
      const group = page.getByRole('region', { name: '此刻有多紧张？' })
      await expect(group.locator('[aria-checked="true"]')).toHaveCount(0)
      await group.getByRole('radio', { name: '3', exact: true }).click()
      await page.getByRole('textbox', { name: '备注', exact: true }).fill('练习结束后保存的备注。')
    }
    await page.screenshot({
      path: `src/features/player/__checks__/complete-${id}-summary.png`,
      fullPage: true,
    })
    if (id === 'focus') {
      await page.getByRole('button', { name: '完成', exact: true }).click()
      await expect(page).toHaveURL(/\/$/)
      await page.goto('http://127.0.0.1:5173/records', { waitUntil: 'networkidle' })
      const downloaded = page.waitForEvent('download')
      await page.getByRole('button', { name: /导出完整备份/ }).click()
      const data = JSON.parse(fs.readFileSync(await (await downloaded).path(), 'utf8'))
      const record = data.records.find(record => record.practiceId === 'focus')
      expect(record).toMatchObject({
        note: '练习结束后保存的备注。',
        feeling: 'calmer',
        checkin: { pre: 8, post: 3 },
      })
      expect(record.marks.length).toBeGreaterThan(0)
    }
    results.push({ id, passed: true })
    console.log('PASS', id)
  } catch (error) {
    results.push({ id, passed: false, error: String(error) })
    console.log('FAIL', id, String(error).slice(0, 300))
  } finally {
    await context.close()
  }
}
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (cursor < cases.length) await run(cases[cursor++])
  }),
)
fs.writeFileSync(
  'src/features/player/__checks__/complete.json',
  `${JSON.stringify({ results, errors }, null, 2)}\n`,
)
await browser.close()
if (errors.length || results.some(result => !result.passed)) process.exitCode = 1
