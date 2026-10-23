import fs from 'node:fs'

const { chromium } = await import(`${process.cwd()}/node_modules/@playwright/test/index.mjs`)
const browser = await chromium.launch({ channel: 'chrome' }),
  context = await browser.newContext({ viewport: { width: 390, height: 844 } }),
  page = await context.newPage(),
  errors = []
page.on('pageerror', e => errors.push(String(e)))
await page.goto('http://127.0.0.1:5173/settings?seed=demo')
await page.getByRole('heading', { name: '设置', exact: true }).waitFor()
await page.getByRole('radio', { name: '深色', exact: true }).click()
await page.getByRole('switch', { name: '新的一句出现时轻提示', exact: true }).click()
await page.reload()
if (
  (await page
    .getByRole('switch', { name: '新的一句出现时轻提示', exact: true })
    .getAttribute('aria-checked')) !== 'false'
)
  throw Error('caption preference lost')
await page.goto('http://127.0.0.1:5173/settings/reminders')
await page
  .getByRole('button', { name: '在什么之后', exact: true })
  .click()
  .catch(() => {})
await page.keyboard.press('Escape')
const calendar = page.waitForEvent('download')
await page.getByRole('button', { name: '生成日历文件' }).click()
const cal = await calendar
await cal.saveAs('/tmp/huishen-review/reminder.ics')
if (!fs.readFileSync('/tmp/huishen-review/reminder.ics', 'utf8').includes('BEGIN:VCALENDAR'))
  throw Error('bad calendar')
await page.goto('http://127.0.0.1:5173/settings#data')
const backup = page.waitForEvent('download')
await page.getByRole('button', { name: '导出完整备份（JSON）' }).click()
await (await backup).saveAs('/tmp/huishen-review/backup.json')
await page.locator('input[type=file]').setInputFiles('/tmp/huishen-review/backup.json')
await page.getByText(/导入 .*条，跳过已有的/).waitFor()
await page.getByRole('button', { name: '删除全部数据', exact: true }).click()
await page.getByRole('alertdialog').getByRole('button', { name: /继续/ }).click()
await page.keyboard.press('Escape')
await page.getByRole('heading', { name: '设置', exact: true }).waitFor()
await page.goto('http://127.0.0.1:5173/settings/monthly')
for (const g of await page.getByRole('radiogroup').all()) {
  await g.getByRole('radio').first().click()
}
await page.screenshot({ path: '/tmp/huishen-review/t5-monthly-answered.png', fullPage: true })
await browser.close()
fs.writeFileSync(
  '/tmp/huishen-review/t5-flow.json',
  JSON.stringify(
    {
      errors,
      calendar: cal.suggestedFilename(),
      backup: JSON.parse(fs.readFileSync('/tmp/huishen-review/backup.json', 'utf8')).records.length,
    },
    null,
    2,
  ),
)
console.log('Settings browser flow passed')
