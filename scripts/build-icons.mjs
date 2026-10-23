#!/usr/bin/env node
/**
 * 应用图标：用本机 Chrome 把设计稿里的 SVG 栅格化成 PWA 和 iOS 需要的 PNG。
 *
 * 图标很少改动，所以不放进每次构建；改了 docs/design/final/ 里的图标后运行 `npm run icons`，
 * 产物提交在 public/ 下。SVG 本身已经按「可遮罩」的安全区画好（主体在中间 80% 内），
 * 所以同一张图同时用作 any 和 maskable。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DESIGN = path.join(ROOT, 'docs/design/final')

const TARGETS = [
  { src: 'app-icon.svg', out: 'public/icons/icon-192.png', size: 192 },
  { src: 'app-icon.svg', out: 'public/icons/icon-512.png', size: 512 },
  // iOS 不认 manifest 里的图标，只认 apple-touch-icon，且会自己加圆角
  { src: 'app-icon.svg', out: 'public/apple-touch-icon.png', size: 180 },
]
const COPIES = [{ src: 'favicon.svg', out: 'public/favicon.svg' }]

const browser = await chromium.launch({ channel: 'chrome' })
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  for (const t of TARGETS) {
    const svg = fs.readFileSync(path.join(DESIGN, t.src), 'utf8')
    const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
    await page.setViewportSize({ width: t.size, height: t.size })
    await page.setContent(
      `<!doctype html><html><body style="margin:0"><img src="${uri}" width="${t.size}" height="${t.size}" style="display:block"></body></html>`,
    )
    await page.locator('img').evaluate(img => img.decode())
    const out = path.join(ROOT, t.out)
    fs.mkdirSync(path.dirname(out), { recursive: true })
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: t.size, height: t.size } })
    console.log(`${t.out}  ${t.size}×${t.size}`)
  }
} finally {
  await browser.close()
}

for (const c of COPIES) {
  fs.copyFileSync(path.join(DESIGN, c.src), path.join(ROOT, c.out))
  console.log(c.out)
}
