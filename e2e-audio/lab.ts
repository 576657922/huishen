/**
 * 端到端测试共用：打开声音实验室，等它把 window.audioLab 准备好。
 */
import { expect, type Page } from '@playwright/test'
import type { LiveResult } from '../src/audio/lab/live'
import type { AudioLab } from '../src/audio/lab/main'
import type { QaReport } from '../src/audio/lab/qa'

declare global {
  interface Window {
    audioLab?: AudioLab
  }
}

export async function openLab(page: Page): Promise<void> {
  page.on('console', msg => {
    if (msg.type() === 'error') console.error(`[页面] ${msg.text()}`)
  })
  page.on('pageerror', err => console.error(`[页面异常] ${err.message}`))
  await page.goto('/audio-lab.html')
  // 开发服务器刚改过文件或刚预构建完依赖时会让页面整个重载一次，这时求值会因执行环境被销毁而失败：当作还没好，接着等
  await expect
    .poll(() => page.evaluate(() => typeof window.audioLab).catch(() => 'reloading'), { timeout: 60_000 })
    .toBe('object')
}

/** 把报告打成一张表，失败时方便看是哪一项、差多少 */
export function printReport(report: QaReport): void {
  const fmt = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—')
  const lines = report.cases.map(c => {
    const m = c.metrics
    const head = `${c.ok ? 'ok ' : 'BAD'} ${c.label.padEnd(34)}`
    const nums = m
      ? `LUFS ${fmt(m.lufs)} LRA ${fmt(m.lra)} TP ${fmt(m.truePeak)} rise ${fmt(m.maxRise)} swing ${fmt(m.maxSwing)} click ${fmt(m.click)} hi/mid ${fmt(m.highVsMid)} lim ${fmt(c.limitDb)}`
      : ''
    const bad = c.checks
      .filter(k => !k.ok)
      .map(k => `\n      ✗ ${k.name} = ${fmt(k.value)}（${k.limit}）`)
      .join('')
    return `${head} ${nums}${bad}`
  })
  console.log(
    `\n离线质检：${report.cases.length} 个场景，${(report.ms / 1000).toFixed(0)} 秒\n${lines.join('\n')}`,
  )
}

/** 实时冒烟的每一步 */
export function printLive(result: LiveResult): void {
  const lines = result.steps.map(
    s => `${s.ok ? 'ok ' : 'BAD'} ${s.name.padEnd(20)} ${String(s.value).padStart(8)}  （${s.expect}）`,
  )
  console.log(`\n实时冒烟：\n${lines.join('\n')}`)
}
