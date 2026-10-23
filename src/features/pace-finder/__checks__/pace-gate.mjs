import fs from 'node:fs'

const { chromium } = await import(`${process.cwd()}/node_modules/@playwright/test/index.mjs`),
  b = await chromium.launch({ channel: 'chrome' }),
  p = await b.newPage({ viewport: { width: 390, height: 844 } }),
  errors = []
p.on('pageerror', e => errors.push(String(e)))
await p.goto('http://127.0.0.1:5173/pace-finder?speed=20&hrv=demo', { waitUntil: 'networkidle' })
await p.getByRole('button', { name: '连接', exact: true }).click()
await p.getByText('模拟心率带（开发演示）', { exact: true }).waitFor()
await p.getByRole('button', { name: /^开始/ }).click()
await p.waitForURL('**/welcome')
await p
  .getByRole('dialog')
  .locator('a[href="/help"]')
  .evaluate(el => el.scrollIntoView())
await p.waitForTimeout(500)
await p.getByRole('button', { name: '我已读完' }).click()
await p.waitForURL('**/pace-finder')
await p.getByRole('radiogroup', { name: '这一档呼吸起来有多轻松？' }).waitFor({ timeout: 10000 })
await p.getByRole('dialog').getByRole('button', { name: '结束', exact: true }).click()
await p.getByRole('alertdialog').getByRole('button', { name: '结束', exact: true }).click()
await p.waitForURL('**/practices')
const records = await p.evaluate(async () =>
  (await (await import('/src/app/services.ts')).getRepo().all()).filter(r => r.practiceId === 'pace-finder'),
)
if (records.length !== 1 || records[0].actualSec !== 60) throw Error('Partial run lost')
await b.close()
fs.writeFileSync(
  '/tmp/huishen-review/t9-gate.json',
  JSON.stringify({ passed: true, errors, records: records.length }),
)
console.log('Gated start, simulator and partial record passed')
