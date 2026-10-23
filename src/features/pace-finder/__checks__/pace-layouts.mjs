import fs from 'node:fs'

const { chromium, expect } = await import(`${process.cwd()}/node_modules/@playwright/test/index.mjs`),
  b = await chromium.launch({ channel: 'chrome' }),
  errors = []
await Promise.all(
  ['phone', 'desktop'].flatMap(device =>
    ['light', 'dark'].map(async theme => {
      const c = await b.newContext({
          viewport: device === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
          deviceScaleFactor: device === 'phone' ? 2 : 1,
          colorScheme: theme,
        }),
        p = await c.newPage(),
        stem = `/tmp/huishen-review/t9-current-${device}-${theme}`
      p.on('pageerror', e => errors.push(String(e)))
      p.on('console', m => {
        if (m.type() === 'error') errors.push(m.text())
      })
      await p.goto(
        'http://127.0.0.1:5173/pace-finder?seed=demo&speed=20' +
          (device === 'desktop' && theme === 'dark' ? '&hrv=demo' : ''),
        { waitUntil: 'networkidle' },
      )
      if (device === 'desktop' && theme === 'dark') {
        await p.getByRole('button', { name: '连接', exact: true }).click()
        await p.getByText('模拟心率带（开发演示）', { exact: true }).waitFor()
      }
      await p.getByRole('button', { name: /^开始/ }).click()
      await p.waitForTimeout(1000)
      await p.screenshot({ path: `${stem}-run.png`, animations: 'disabled' })
      for (let i = 0; i < 5; i++) {
        const group = p.getByRole('radiogroup', { name: '这一档呼吸起来有多轻松？' })
        await group.waitFor({ timeout: 15000 })
        if (i === 0) {
          await p.waitForTimeout(500)
          const canvas = p.locator('canvas')
          const first = await canvas.screenshot()
          await p.waitForTimeout(200)
          if (!first.equals(await canvas.screenshot())) throw Error('Rating curve moved')
          await p.screenshot({ path: `${stem}-rating.png`, animations: 'disabled' })
        }
        await group.getByRole('radio', { name: String([2, 4, 5, 3, 1][i]), exact: true }).click()
        if (i < 4) await group.waitFor({ state: 'hidden' })
      }
      await p.getByRole('heading', { name: '你的舒适节律', exact: true }).waitFor()
      await p.getByText('这次探索已记在本机。').waitFor()
      await p.waitForTimeout(200)
      await p.screenshot({ path: `${stem}-result.png`, fullPage: true, animations: 'disabled' })
      await expect(p.locator('tr[data-chosen=true]')).toContainText('5.5')
      await c.close()
    }),
  ),
)
await b.close()
fs.writeFileSync('/tmp/huishen-review/t9-layouts.json', JSON.stringify({ passed: true, errors }))
console.log('Four layouts and frozen rating curves passed')
