/**
 * 离线质检（开发服务器）：每种声景、每种音乐、默认的放松与睡前组合、跟随节拍加滑音、钟声和提示音，
 * 都按正式播放的链路在 OfflineAudioContext 里渲染，再按 EBU R 128 测量。
 * 不合格时打印出是哪一项、实测多少，改 src/audio/params.ts 后重跑。
 * 只跑一部分：AUDIO_QA_ONLY='^(ambience|sleep)/' npx playwright test -c playwright.audio.config.ts
 */
import { readFile, writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { openLab, printReport } from './lab'

const only = process.env.AUDIO_QA_ONLY

test('wood cues match the approved audition, leave silence and cancel quietly', async ({ page }, info) => {
  await openLab(page)
  // Golden PCM comes from the exact audition the user selected, not from the current synthesizer.
  const approved = await readFile(new URL('./fixtures/wood-onsets-approved-48k.wav', import.meta.url))
  const result = await page.evaluate(async referenceBase64 => {
    const load = (path: string) => import(new URL(path, location.href).href)
    const { createGlides } = (await load('/src/audio/glide.ts')) as typeof import('../src/audio/glide')
    const { segment } = (await load('/src/audio/automation.ts')) as typeof import('../src/audio/automation')
    const { woodGain, volumeGain } = (await load(
      '/src/audio/levels.ts',
    )) as typeof import('../src/audio/levels')
    const { estimatePitch, rmsDb, clickScore, truePeakDb } = (await load(
      '/src/audio/dsp/analysis.ts',
    )) as typeof import('../src/audio/dsp/analysis')
    const { encodeWav } = (await load('/src/audio/lab/wav.ts')) as typeof import('../src/audio/lab/wav')
    const sr = 48000
    const context = (seconds: number) =>
      new OfflineAudioContext({ numberOfChannels: 1, length: Math.ceil(seconds * sr), sampleRate: sr })
    const tones = (ctx: OfflineAudioContext) => {
      const gain = ctx.createGain()
      gain.gain.value = volumeGain(70, 'cues') * volumeGain(80, 'master')
      gain.connect(ctx.destination)
      return createGlides(ctx, gain, woodGain)
    }
    const ctx = context(23.5)
    const tone = tones(ctx)
    for (const at of [0.7, 11.7]) {
      tone.play(segment('in', 0, 1, 4.5), at)
      tone.play(segment('out', 1, 0, 6.5), at + 4.5)
    }
    const samples = (await ctx.startRendering()).getChannelData(0)
    const bytes = Uint8Array.from(atob(referenceBase64), c => c.charCodeAt(0))
    const pcm = new DataView(bytes.buffer)
    const hitFrames = 20544
    let maxError = 0
    let referencePeak = 0
    for (const [index, at] of [0.7, 5.2].entries()) {
      for (let i = 0; i < hitFrames; i++) {
        const reference = pcm.getInt16(44 + 2 * (index * hitFrames + i), true) / 32768
        const actual = samples[Math.round(at * sr) + i]!
        maxError = Math.max(maxError, Math.abs(reference - actual))
        referencePeak = Math.max(referencePeak, Math.abs(reference))
      }
    }
    const referenceSamples = new Float32Array(hitFrames * 2)
    for (let i = 0; i < referenceSamples.length; i++)
      referenceSamples[i] = pcm.getInt16(44 + 2 * i, true) / 32768
    const referencePitches = [0, hitFrames].map(offset =>
      estimatePitch(referenceSamples, sr, 180, 500, offset + Math.round(0.02 * sr), 2048),
    )
    const pitches = [0.7, 5.2].map(at =>
      estimatePitch(samples, sr, 180, 500, Math.round((at + 0.02) * sr), 2048),
    )
    const held = context(13)
    const heldTone = tones(held)
    heldTone.play(segment('in', 0, 1, 4), 0)
    heldTone.play(segment('hold', 1, 1, 4, 'flat'), 4)
    heldTone.play(segment('out', 1, 0, 4), 8)
    heldTone.play(segment('rest', 0, 0, 1, 'flat'), 12)
    const heldSamples = (await held.startRendering()).getChannelData(0)
    const cancelled = context(3)
    const cancelTone = tones(cancelled)
    cancelTone.play(segment('in', 0, 1, 4), 0.3)
    cancelTone.play(segment('out', 1, 0, 4), 1.3)
    const suspended = cancelled.suspend(0.32)
    const cancelling = cancelled.startRendering()
    await suspended
    cancelTone.cancelAll()
    // A stale event must not be caught up in the middle of a later phase.
    cancelTone.play(segment('out', 1, 0, 4), 0)
    await cancelled.resume()
    const cancelSamples = (await cancelling).getChannelData(0)
    const wav = await new Promise<string>(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1]!)
      reader.readAsDataURL(encodeWav([samples], sr))
    })
    return {
      relativeWaveError: maxError / referencePeak,
      pitches,
      referencePitches,
      gapDb: rmsDb([samples], 1.3 * sr, 5.1 * sr),
      holdDb: rmsDb([heldSamples], 4 * sr, 8 * sr),
      restDb: rmsDb([heldSamples], 12 * sr, 13 * sr),
      cancelDb: rmsDb([cancelSamples], 0.5 * sr, 3 * sr),
      cancelClick: clickScore([cancelSamples], sr),
      truePeak: truePeakDb([samples]),
      wav,
    }
  }, approved.toString('base64'))
  expect(result.relativeWaveError).toBeLessThan(0.002)
  for (const [index, pitch] of result.pitches.entries())
    expect(pitch).toBeCloseTo(result.referencePitches[index]!, 1)
  expect(result.pitches[0]).toBeGreaterThan(result.pitches[1]! + 80)
  for (const db of [result.gapDb, result.holdDb, result.restDb, result.cancelDb])
    expect(db).toBeLessThan(-100)
  expect(result.cancelClick).toBeLessThan(10)
  expect(result.truePeak).toBeLessThan(-12)
  const wavPath = info.outputPath('wood-breath-cue.wav')
  await writeFile(wavPath, Buffer.from(result.wav, 'base64'))
  await info.attach('wood-breath-cue.wav', { path: wavPath, contentType: 'audio/wav' })
  console.log('Wood cue regression:', { ...result, wav: '(attached)' })
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
