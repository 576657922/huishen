/**
 * 冒烟测试：应用能打开、没有控制台报错，四个标签都能去，从今日开始的 1 分钟练习能一直走到小结，
 * 练完的这一次出现在记录里。
 *
 * ?speed=30 让练习按 30 倍速走（开发构建才有，见 docs/APP.md）：对着开发服务器跑时 1 分钟的练习约 2 秒；
 * 对着生产构建（playwright.config.ts 默认的 build + preview）跑时这个参数不存在，练习按真实时间走，
 * 所以等小结的时限放宽到 2 分钟，两种都能通过。
 */
import { expect, type Page, test } from '@playwright/test'

/** 已经看过首次使用、读完「开始之前」的人：直接到今日，开始练习不再被拦 */
const RETURNING = JSON.stringify({ v: 2, onboarded: true, safety: { ackOn: '2026-10-01' } })

/** 收集控制台报错和未捕获的异常；测试最后断言为空 */
function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

async function returningUser(page: Page): Promise<void> {
  await page.addInitScript(prefs => {
    // 只在第一次打开前写一次：之后的页面刷新保留应用自己存的偏好
    if (!sessionStorage.getItem('smoke-seeded')) {
      localStorage.setItem('huishen.prefs.v1', prefs)
      sessionStorage.setItem('smoke-seeded', '1')
    }
  }, RETURNING)
}

/** 手机上是底部标签栏，平板和桌面上是导航栏；看得见的那一个 */
const mainNav = (page: Page) => page.getByRole('navigation', { name: '主导航' })

test('第一次打开先到首次使用', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByRole('heading', { level: 1, name: '回神', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('应用能打开，四个标签都能去，没有控制台报错', async ({ page }) => {
  const errors = watchErrors(page)
  await returningUser(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: '今日', exact: true })).toBeAttached()
  await expect(page).toHaveTitle('今日 · 回神')

  for (const [label, path] of [
    ['练习', '/practices'],
    ['记录', '/records'],
    ['依据', '/evidence'],
    ['今日', '/'],
  ] as const) {
    const tab = mainNav(page).getByRole('link', { name: label, exact: true })
    await tab.click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
    await expect(tab).toHaveAttribute('aria-current', 'page')
    // 换页后焦点落在新页面的 h1 上
    await expect(page.getByRole('heading', { level: 1, name: label, exact: true })).toBeFocused()
  }
  expect(errors).toEqual([])
})

test('从今日开始 1 分钟的练习，走到小结，记录里有这一次', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = watchErrors(page)
  await returningUser(page)
  await page.goto('/?speed=30')

  const pick = page.getByRole('main').getByRole('button', { name: /一分钟停一停/ })
  await pick
    .or(page.getByRole('main').getByRole('link', { name: /一分钟停一停/ }))
    .first()
    .click()
  await expect(page).toHaveURL(/\/play\/pause$/)

  // 小结：在同一个地址，标题是练习名
  const summary = page.getByRole('heading', { level: 1, name: '一分钟停一停' })
  await expect(summary).toBeVisible({ timeout: 120_000 })
  await page.getByRole('radio', { name: '更平静' }).click()
  await expect(page.getByRole('radio', { name: '更平静' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: '完成' }).click()
  await expect(page).toHaveURL(/\/(\?speed=30)?$/)

  await mainNav(page).getByRole('link', { name: '记录', exact: true }).click()
  await expect(page.getByRole('main').getByText('一分钟停一停').first()).toBeVisible()
  expect(errors).toEqual([])
})
