import fs from 'node:fs'

const { chromium, expect } = await import(`${process.cwd()}/node_modules/@playwright/test/index.mjs`),
  b = await chromium.launch({ channel: 'chrome' }),
  p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }),
  errors = []
p.on('pageerror', e => errors.push(String(e)))
p.on('console', m => {
  if (m.type() === 'error') errors.push(m.text())
})
await p.goto('http://127.0.0.1:5173/pace-finder?seed=demo&speed=20', { waitUntil: 'networkidle' })
await p.getByRole('button', { name: /^开始/ }).click()
await p.waitForTimeout(1000)
await p.screenshot({ path: '/tmp/huishen-review/t9-run-phone.png' })
for (let i = 0; i < 5; i++) {
  const group = p.getByRole('radiogroup', { name: '这一档呼吸起来有多轻松？' })
  await group.waitFor({ timeout: 12000 })
  if (i === 0) {
    await p.keyboard.press('Escape')
    await expect(group).toBeVisible()
    await p.waitForTimeout(400)
    await p.screenshot({ path: '/tmp/huishen-review/t9-rating-phone.png' })
  }
  await group.getByRole('radio', { name: String([2, 4, 5, 3, 1][i]), exact: true }).click()
  if (i < 4) await group.waitFor({ state: 'hidden' })
}
await p.getByRole('heading', { name: '你的舒适节律', exact: true }).waitFor()
await p.evaluate(() => document.fonts.ready)
await p.screenshot({ path: '/tmp/huishen-review/t9-result-phone.png', fullPage: true })
const result = await p.evaluate(async () => {
  const { getRepo } = await import('/src/app/services.ts'),
    { prefsStore } = await import('/src/data/index.ts')
  return {
    records: (await getRepo().all()).filter(r => r.practiceId === 'pace-finder'),
    rate: prefsStore.getState().personalRate,
  }
})
if (result.records.length !== 1 || result.records[0].params.rate !== 5.5 || result.records[0].actualSec < 299)
  throw Error(JSON.stringify(result))
await p.getByRole('button', { name: '设为慢呼吸的节律' }).click()
await p.waitForURL('**/practices/slow')
const pref = await p.evaluate(
  async () => (await import('/src/data/index.ts')).prefsStore.getState().practice.slow.rate,
)
if (pref !== 5.5) throw Error('Default not applied')
await b.close()
fs.writeFileSync(
  '/tmp/huishen-review/t9-flow.json',
  JSON.stringify({ errors, record: result.records[0], applied: pref }, null, 2),
)
console.log('Five rates, one record and apply passed')
