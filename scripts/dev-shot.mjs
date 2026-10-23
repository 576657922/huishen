#!/usr/bin/env node
/**
 * 开发用截图：用本机 Chrome 打开一个地址，按手机或桌面尺寸截图，用于和设计稿对照。
 *
 *   node scripts/dev-shot.mjs <url> <out.png> [phone|desktop|WxH] [--dark] [--full] [--wait=ms] [--scale=n]
 *
 * phone = 390×844 @2x（与设计稿一致），desktop = 1440×900 @1x。
 * --dark 让页面以为系统是深色模式；--full 截整页；--wait 在页面稳定后再等一会（动画、画布）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const [url, out, size = 'phone', ...flags] = process.argv.slice(2)
if (!url || !out) {
  console.error(
    '用法：node scripts/dev-shot.mjs <url> <out.png> [phone|desktop|WxH] [--dark] [--full] [--wait=ms] [--scale=n]',
  )
  process.exit(1)
}

const presets = { phone: [390, 844, 2], desktop: [1440, 900, 1] }
const flag = name => flags.find(f => f === `--${name}` || f.startsWith(`--${name}=`))
const value = name => flag(name)?.split('=')[1]
const [w, h, presetScale] = presets[size] ?? [...size.split('x').map(Number), 1]
const scale = Number(value('scale') ?? presetScale)

const browser = await chromium.launch({ channel: 'chrome' })
try {
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    deviceScaleFactor: scale,
    colorScheme: flag('dark') ? 'dark' : 'light',
    isMobile: size === 'phone',
    hasTouch: size === 'phone',
  })
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => m.type() === 'error' && errors.push(m.text()))
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(Number(value('wait') ?? 300))
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true })
  await page.screenshot({ path: out, fullPage: Boolean(flag('full')) })
  console.log(out)
  // 控制台报错也打印出来：截图好看但页面在报错，同样算没做完
  if (errors.length) console.log(`页面错误 ${errors.length} 条：\n${errors.join('\n')}`)
} finally {
  await browser.close()
}
