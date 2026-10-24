/**
 * 离线质检（开发服务器）：每种声景、每种音乐、默认的放松与睡前组合、跟随节拍加滑音、钟声和提示音，
 * 都按正式播放的链路在 OfflineAudioContext 里渲染，再按 EBU R 128 测量。
 * 不合格时打印出是哪一项、实测多少，改 src/audio/params.ts 后重跑。
 * 只跑一部分：AUDIO_QA_ONLY='^(ambience|sleep)/' npx playwright test -c playwright.audio.config.ts
 */
import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { openLab, printReport } from './lab'

const only = process.env.AUDIO_QA_ONLY

test('the breath tone keeps a steady pitch, follows the breath and cancels quietly', async ({
  page,
}, info) => {
  await openLab(page)
  const result = await page.evaluate(async () => {
    const load = (path: string) => import(new URL(path, location.href).href)
    const { createGlides } = (await load('/src/audio/glide.ts')) as typeof import('../src/audio/glide')
    const { segment } = (await load('/src/audio/automation.ts')) as typeof import('../src/audio/automation')
    const { glideAmp, volumeGain } = (await load(
      '/src/audio/levels.ts',
    )) as typeof import('../src/audio/levels')
    const { estimatePitch, rmsDb, clickScore } = (await load(
      '/src/audio/dsp/analysis.ts',
    )) as typeof import('../src/audio/dsp/analysis')
    const { encodeWav } = (await load('/src/audio/lab/wav.ts')) as typeof import('../src/audio/lab/wav')
    const sr = 24000
    const context = (seconds: number) =>
      new OfflineAudioContext({ numberOfChannels: 1, length: Math.ceil(seconds * sr), sampleRate: sr })
    const tones = (ctx: OfflineAudioContext) => {
      const gain = ctx.createGain()
      gain.gain.value = volumeGain(70, 'cues') * volumeGain(80, 'master')
      gain.connect(ctx.destination)
      return createGlides(ctx, gain, glideAmp)
    }
    const ctx = context(23.5)
    const tone = tones(ctx)
    for (const at of [0.3, 11.3]) {
      tone.play(segment('in', 0, 1, 4.5), at)
      tone.play(segment('out', 1, 0, 6.5), at + 4.5)
    }
    const rendered = await ctx.startRendering()
    const samples = rendered.getChannelData(0)
    const db = (from: number, to: number) => rmsDb([samples], Math.round(from * sr), Math.round(to * sr))
    const pitches = [1, 2.5, 4, 5.5, 8, 10, 12, 14, 16, 20].map(t =>
      estimatePitch(samples, sr, 180, 500, Math.round(t * sr), 2048),
    )

    const held = context(13)
    const heldTone = tones(held)
    heldTone.play(segment('in', 0, 1, 4), 0)
    heldTone.play(segment('hold', 1, 1, 4, 'flat'), 4)
    heldTone.play(segment('out', 1, 0, 4), 8)
    const heldSamples = (await held.startRendering()).getChannelData(0)

    const cancelled = context(6)
    const cancelTone = tones(cancelled)
    cancelTone.play(segment('in', 0, 1, 10), 0)
    const suspended = cancelled.suspend(2)
    const cancelling = cancelled.startRendering()
    await suspended
    cancelTone.cancelAll()
    await cancelled.resume()
    const cancelSamples = (await cancelling).getChannelData(0)

    const wav = await new Promise<string>(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1]!)
      reader.readAsDataURL(encodeWav([samples], sr))
    })
    return {
      pitchSpan: Math.max(...pitches) - Math.min(...pitches),
      inhaleRise: db(3.8, 4.3) - db(0.8, 1.3),
      exhaleFall: db(5.3, 5.8) - db(10.3, 10.8),
      holdDb: rmsDb([heldSamples], 5 * sr, 7 * sr),
      cancelDb: rmsDb([cancelSamples], 3 * sr, 5 * sr),
      cancelClick: clickScore([cancelSamples], sr),
      wav,
    }
  })
  expect(result.pitchSpan).toBeLessThan(1)
  expect(result.inhaleRise).toBeGreaterThan(5)
  expect(result.exhaleFall).toBeGreaterThan(5)
  expect(result.holdDb).toBeLessThan(-100)
  expect(result.cancelDb).toBeLessThan(-100)
  expect(result.cancelClick).toBeLessThan(10)
  const wavPath = info.outputPath('gentle-breath-cue.wav')
  await writeFile(wavPath, Buffer.from(result.wav, 'base64'))
  await info.attach('gentle-breath-cue.wav', { path: wavPath, contentType: 'audio/wav' })
  console.log('Breath cue regression:', { ...result, wav: '(attached)' })
})

test('every sound passes the offline loudness and quality checks', async ({ page }) => {
  await openLab(page)
  const report = await page.evaluate(o => window.audioLab!.runQa({ only: o }), only)
  printReport(report)
  expect(report.cases.length).toBeGreaterThan(0)
  expect(report.cases.filter(c => !c.ok).map(c => c.label)).toEqual([])
  if (!only) {
    // 每类场景都真的测到了
    const groups = new Set(report.cases.map(c => c.group))
    for (const g of [
      'ambience',
      'music',
      'preset',
      'sleep',
      'switch',
      'paced',
      'bell',
      'cue',
      'limiter',
      'rate',
    ] as const)
      expect(groups).toContain(g)
  }
})
