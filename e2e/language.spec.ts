import { expect, test } from '@playwright/test'

const initial = JSON.stringify({
  v: 2,
  onboarded: true,
  safety: { ackOn: '2026-10-01' },
  volume: { master: 37 },
  practice: { slow: { rate: 6 } },
  reminders: {
    cue: 'My own time',
    action: 'My own practice',
    fallback: '1 min',
    weekday: '08:00',
    weekend: null,
  },
})

test.beforeEach(async ({ page }) => {
  await page.addInitScript(value => {
    if (!sessionStorage.getItem('language-test-seeded')) {
      localStorage.setItem('huishen.prefs.v1', value)
      sessionStorage.setItem('language-test-seeded', '1')
    }
  }, initial)
})

test('home language button switches the whole app, survives reload and preserves preferences', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(String(error)))
  await page.goto('/')
  await page.getByRole('button', { name: '切换到日语', exact: true }).press('Enter')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  await expect(page.getByRole('button', { name: '中国語に切り替える' })).toHaveText('中文')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  for (const [route, heading] of [
    ['/practices', '練習'],
    ['/settings', '設定'],
    ['/help', '相談先'],
    ['/records', '記録'],
    ['/evidence', '根拠'],
  ]) {
    await page.goto(route!)
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  }
  await page.goto('/')
  await page.getByRole('button', { name: '中国語に切り替える' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.getByRole('button', { name: '切换到日语' })).toBeVisible()
  expect(
    await page.evaluate(() => {
      const prefs = JSON.parse(localStorage.getItem('huishen.prefs.v1') ?? '{}')
      return { volume: prefs.volume.master, rate: prefs.practice?.slow?.rate, cue: prefs.reminders?.cue }
    }),
  ).toEqual({ volume: 37, rate: 6, cue: 'My own time' })
  expect(errors).toEqual([])
})

test('Japanese routes fit phone and desktop, including dark mode and all practice details', async ({
  page,
}, info) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(String(error)))
  await page.goto('/?lang=ja')
  const routes = [
    '/',
    '/practices',
    '/records',
    '/evidence',
    '/settings',
    '/help',
    '/welcome',
    '/program/mindfulness-8w',
    '/program/breathing-4w',
    '/pace-finder',
    '/settings/sounds',
    '/settings/monthly',
    '/settings/reminders',
    '/settings/safety',
    '/settings/privacy',
    '/settings/about',
    '/settings/fonts',
  ]
  for (const [round, theme] of [
    [1, 'light'],
    [2, 'dark'],
  ] as const) {
    await page.emulateMedia({ colorScheme: theme })
    for (const route of routes) {
      await page.goto(route)
      await expect(page.locator('main h1')).toHaveCount(1)
      await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
      await expect(page.locator('body')).not.toContainText(
        /练习|设置|分钟|节律|求助方式|证据等级|默认|导出|导入/u,
      )
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), route).toBe(
        false,
      )
      if (['/', '/practices', '/settings', '/help', '/program/mindfulness-8w'].includes(route)) {
        await page.evaluate(() => document.fonts.ready)
        await page.screenshot({
          path: `test-results/japanese/round-${round}/${info.project.name}${route.replaceAll('/', '-') || 'home'}.png`,
          fullPage: false,
        })
      }
    }
  }
  await page.goto('/practices')
  const links = await page
    .locator('main a[href^="/practices/"]')
    .evaluateAll(nodes => [...new Set(nodes.map(node => node.getAttribute('href')!))])
  for (const route of links) {
    await page.goto(route)
    await expect(page.locator('main h1')).toHaveCount(1)
    await expect(page.locator('body')).not.toContainText(/练习|设置|分钟|节律|求助方式|证据等级|默认/u)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), route).toBe(
      false,
    )
  }
  expect(errors).toEqual([])
})

test('Japanese guides and distress controls remain available in the player', async ({ page }, info) => {
  await page.goto('/play/focus?lang=ja')
  await page.getByRole('button', { name: /^始める/ }).click()
  await expect(page.getByRole('button', { name: 'つらくなったら', exact: true })).toBeVisible()
  await expect(page.getByText('呼吸に注意を向ける練習です。', { exact: true })).toBeVisible({
    timeout: 20000,
  })
  await page.screenshot({ path: `test-results/japanese/round-2/${info.project.name}-player.png` })
  await page.getByRole('button', { name: 'つらくなったら', exact: true }).click()
  await expect(page.getByRole('button', { name: '60秒のグラウンディング', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '一時停止中', exact: true })).toBeVisible()
})

test('offline language switch and help retain the bundled translations', async ({ page, context }) => {
  await page.goto('/?lang=ja')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await page.goto('/help')
  await expect(page.getByRole('heading', { level: 1, name: '相談先' })).toBeVisible()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: '相談先' })).toBeVisible()
  await page.goto('/')
  await page.getByRole('button', { name: '中国語に切り替える' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page.getByRole('button', { name: '切换到日语' })).toBeVisible()
})

test('explicit Japanese links work when browser storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('denied', 'SecurityError')
    }
    Storage.prototype.setItem = () => {
      throw new DOMException('denied', 'SecurityError')
    }
  })
  await page.goto('/')
  await page.goto('/practices?lang=ja')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  await expect(page.getByRole('heading', { level: 1, name: '練習', exact: true })).toBeVisible()
})

test('Japanese breath phases fit the player without changing the controls', async ({ page }, info) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(String(error)))
  for (const id of ['slow', 'cyclic-sigh', 'box']) {
    await page.goto(`/play/${id}?lang=ja`)
    await page.getByRole('button', { name: /^始める/ }).click()
    const phase = page.locator('main p').filter({ hasText: /^(吸う|吐く|足す|止める)$/ })
    await expect(phase).toBeVisible({ timeout: 20000 })
    if (id === 'box') await expect(phase).toHaveText('止める', { timeout: 12000 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
    const box = await phase.boundingBox()
    expect(box!.width).toBeLessThan(page.viewportSize()!.width - 80)
    await expect(page.getByRole('button', { name: 'つらくなったら', exact: true })).toBeVisible()
    await page.screenshot({ path: `test-results/japanese/round-2/${info.project.name}-player-${id}.png` })
  }
  expect(errors).toEqual([])
})
