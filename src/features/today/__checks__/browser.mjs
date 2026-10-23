// 在项目根目录运行；先启动端口为 5173 的开发服务器。所有写入都限于独立的浏览器上下文。
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const checkDir = fileURLToPath(new URL('.', import.meta.url))
const noticeDir = fileURLToPath(new URL('../../onboarding/__checks__/', import.meta.url))
const { chromium, expect } = await import(`${process.cwd()}/node_modules/@playwright/test/index.mjs`)
const browser = await chromium.launch({ channel: 'chrome' })
const results = []
const errors = []
async function record(name, fn) {
  try {
    await fn()
    results.push({ name, passed: true })
    console.log('PASS', name)
  } catch (error) {
    results.push({ name, passed: false, error: String(error) })
    console.log('FAIL', name, String(error).slice(0, 350))
  }
}
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
context.setDefaultTimeout(5000)
const page = await context.newPage()
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => {
  if (m.type() === 'error') errors.push(m.text())
})
for (const route of [
  '/',
  '/practices',
  '/practices/slow',
  '/records',
  '/evidence',
  '/welcome',
  '/program/mindfulness-8w',
  '/program/breathing-4w',
]) {
  await record(`heading and overflow: ${route}`, async () => {
    await page.goto(`http://127.0.0.1:5173${route}?seed=demo`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
await record('real start flow: recommendation to player', async () => {
  await page.goto('http://127.0.0.1:5173/?seed=demo&speed=20', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /^开始/ }).click()
  const skip = page.getByRole('button', { name: '跳过', exact: true })
  if (await skip.count()) await skip.click()
  await expect(page).toHaveURL(/\/play\//)
})
await record('hard moment: Escape restores keyboard focus', async () => {
  await page.goto('http://127.0.0.1:5173/?seed=demo', { waitUntil: 'networkidle' })
  const trigger = page.getByRole('button', { name: /现在有点难/ })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Tab')
  expect(await page.getByRole('dialog').evaluate(el => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
await record('evidence citation: filter, expand, scroll and focus', async () => {
  await page.goto('http://127.0.0.1:5173/evidence#breathing-fincham-2023-meta', { waitUntil: 'networkidle' })
  const article = page.locator('#breathing-fincham-2023-meta')
  await expect(article).toBeFocused()
  await expect(page.getByRole('radio', { name: '呼吸', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(article.getByRole('button', { name: /收起/ })).toHaveAttribute('aria-expanded', 'true')
})
await record('sound picker: Escape restores focus', async () => {
  await page.goto('http://127.0.0.1:5173/practices/slow?seed=demo', { waitUntil: 'networkidle' })
  const trigger = page.getByRole('button', { name: /^声音/ })
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})
await record('records: detail, delete confirmation, cancel and export JSON', async () => {
  await page.goto('http://127.0.0.1:5173/records?seed=demo', { waitUntil: 'networkidle' })
  await page
    .getByRole('button', { name: /专注呼吸/ })
    .first()
    .click()
  await page.getByRole('button', { name: '删除这条记录', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /导出完整备份/ }).click()
  const download = await downloadPromise
  const file = await download.path()
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  expect(data.records.length > 0).toBe(true)
  expect(Array.isArray(data.weeklyStress)).toBe(true)
})
await record('records: confirmed deletion and undo restore the real stored record', async () => {
  await page.goto('http://127.0.0.1:5173/records?seed=demo', { waitUntil: 'networkidle' })
  const initial = (await page.locator('main').textContent()) ?? ''
  const heading = initial.match(/(\d+) 次练习/)[0]
  await page
    .getByRole('button', { name: /专注呼吸/ })
    .first()
    .click()
  await page.getByRole('button', { name: '删除这条记录', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '删除', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('main')).not.toContainText(heading)
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await expect(page.locator('main')).toContainText(heading)
})
await context.close()
for (const device of ['phone', 'desktop'])
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: device === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      colorScheme: scheme,
      reducedMotion: 'reduce',
      deviceScaleFactor: device === 'phone' ? 2 : 1,
    })
    context.setDefaultTimeout(5000)
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(String(e)))
    await record(`safety notice scroll gate: ${device} ${scheme}`, async () => {
      await page.goto('http://127.0.0.1:5173/welcome', { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: '先练 1 分钟', exact: true }).click()
      const dialog = page.getByRole('dialog')
      const confirm = page.getByRole('button', { name: '我已读完', exact: true })
      await expect(confirm).toHaveAttribute('aria-disabled', 'true')
      await page.screenshot({ path: `${noticeDir}notice-${device}-${scheme}-top.png` })
      await dialog.evaluate(el => {
        const scroll = [...el.querySelectorAll('div')].find(
          node => getComputedStyle(node).overflowY === 'auto' && node.scrollHeight > node.clientHeight,
        )
        if (!scroll) throw new Error('Missing scroll body')
        scroll.scrollTop = scroll.scrollHeight
      })
      await expect(confirm).toHaveAttribute('aria-disabled', 'false')
      await page.screenshot({ path: `${noticeDir}notice-${device}-${scheme}-end.png` })
      if (device === 'phone' && scheme === 'light') {
        await page.evaluate(() => (document.documentElement.style.fontSize = '200%'))
        await page.screenshot({ path: `${noticeDir}notice-phone-200.png` })
        expect(await confirm.evaluate(el => el.getBoundingClientRect().bottom <= window.innerHeight)).toBe(
          true,
        )
      }
    })
    await context.close()
  }
const freshContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
})
freshContext.setDefaultTimeout(5000)
const freshPage = await freshContext.newPage()
freshPage.on('pageerror', error => errors.push(String(error)))
freshPage.on('console', message => {
  if (message.type() === 'error') errors.push(message.text())
})
await record('first start: preserves the requested practice through the required notice', async () => {
  await freshPage.goto('http://127.0.0.1:5173/practices/slow?speed=20', { waitUntil: 'networkidle' })
  await freshPage.getByRole('button', { name: /^开始/ }).click()
  await expect(freshPage).toHaveURL(/\/welcome/)
  const confirm = freshPage.getByRole('button', { name: '我已读完', exact: true })
  await expect(confirm).toHaveAttribute('aria-disabled', 'true')
  await freshPage.getByRole('dialog').evaluate(element => {
    const scroll = [...element.querySelectorAll('div')].find(
      node => getComputedStyle(node).overflowY === 'auto' && node.scrollHeight > node.clientHeight,
    )
    if (!scroll) throw new Error('Missing notice scroll body')
    scroll.scrollTop = scroll.scrollHeight
  })
  await expect(confirm).toHaveAttribute('aria-disabled', 'false')
  await confirm.click()
  await expect(freshPage).toHaveURL(/\/play\/slow/)
})
await freshContext.close()
const largeContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: 'reduce',
})
largeContext.setDefaultTimeout(5000)
const largePage = await largeContext.newPage()
largePage.on('pageerror', error => errors.push(String(error)))
await record(
  '200% notice: initially unread, scrollable, and confirms only after reaching the end',
  async () => {
    await largePage.goto('http://127.0.0.1:5173/welcome', { waitUntil: 'networkidle' })
    await largePage.evaluate(() => {
      document.documentElement.style.fontSize = '200%'
    })
    await largePage.getByRole('button', { name: '先练 1 分钟', exact: true }).click()
    const confirm = largePage.getByRole('button', { name: '我已读完', exact: true })
    await expect(confirm).toHaveAttribute('aria-disabled', 'true')
    expect(await confirm.evaluate(element => element.getBoundingClientRect().bottom <= innerHeight)).toBe(
      true,
    )
    await largePage.getByRole('dialog').evaluate(element => {
      const scroll = [...element.querySelectorAll('div')].find(
        node => getComputedStyle(node).overflowY === 'auto' && node.scrollHeight > node.clientHeight,
      )
      if (!scroll) throw new Error('Missing notice scroll body')
      scroll.scrollTop = scroll.scrollHeight
    })
    await expect(confirm).toHaveAttribute('aria-disabled', 'false')
    await largePage.screenshot({ path: `${noticeDir}notice-phone-200.png` })
  },
)
await largeContext.close()
fs.writeFileSync(`${checkDir}browser-acceptance.json`, `${JSON.stringify({ results, errors }, null, 2)}\n`)
console.log(
  `${results.filter(r => r.passed).length}/${results.length} checks passed; ${errors.length} console errors`,
)
await browser.close()
if (results.some(r => !r.passed) || errors.length) process.exitCode = 1
