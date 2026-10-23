/**
 * 把渲染结果编码成 16 位 PCM 的 WAV，方便在实验室里导出、用别的软件细听或看频谱。
 */
export function encodeWav(chs: readonly Float32Array[], sampleRate: number): Blob {
  const channels = chs.length
  const frames = chs[0]?.length ?? 0
  const dataBytes = frames * channels * 2
  const view = new DataView(new ArrayBuffer(44 + dataBytes))
  const ascii = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true)
  view.setUint16(34, 16, true)
  ascii(36, 'data')
  view.setUint32(40, dataBytes, true)
  let p = 44
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const v = Math.max(-1, Math.min(1, chs[c]![i]!))
      view.setInt16(p, v < 0 ? v * 0x8000 : v * 0x7fff, true)
      p += 2
    }
  }
  return new Blob([view.buffer], { type: 'audio/wav' })
}
