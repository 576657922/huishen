import { describe, expect, it } from 'vitest'
import { createBufferStore } from './buffers'
import type { AssetName } from './dsp/assets'

/** jsdom 没有 Web Audio：只要 AudioBuffer 里用得到的几个字段 */
function fakeBuffer(chs: Float32Array[], sampleRate: number): AudioBuffer {
  const length = chs[0]?.length ?? 1
  return {
    length,
    sampleRate,
    numberOfChannels: chs.length,
    duration: length / sampleRate,
    getChannelData: (i: number) => chs[i]!,
  } as unknown as AudioBuffer
}

const CUES: AssetName[] = ['cue:in', 'cue:out', 'cue:hold']

describe('buffer store', () => {
  it('generates on the main thread when there is no worker and caches the result', async () => {
    const store = createBufferStore({ createWorker: () => null, makeBuffer: fakeBuffer })
    const get = await store.load(['cue:in'], 48000)
    expect(store.generator()).toBe('main')
    expect(get('cue:in').length).toBeGreaterThan(0)
    expect(store.peek('cue:in', 48000)).toBe(get('cue:in'))
    expect(store.ready(['cue:in'], 48000)).not.toBeNull()
    store.dispose()
  })

  it('a batch bigger than the cache still hands back every buffer it generated', async () => {
    // 上限 1 字节：每生成一个素材都会触发淘汰。同一批里先生成的不能被后生成的挤掉
    const store = createBufferStore({ createWorker: () => null, makeBuffer: fakeBuffer, budgetBytes: 1 })
    const get = await store.load(CUES, 48000)
    for (const n of CUES) expect(get(n).length).toBeGreaterThan(0)
    // 没人占用：载入结束后按上限淘汰
    expect(store.ready(CUES, 48000)).toBeNull()
    store.dispose()
  })

  it('held assets survive eviction until released', async () => {
    const store = createBufferStore({ createWorker: () => null, makeBuffer: fakeBuffer, budgetBytes: 1 })
    const release = store.hold(CUES, 48000)
    await store.load(CUES, 48000)
    expect(store.ready(CUES, 48000)).not.toBeNull()
    release()
    release()
    expect(store.ready(CUES, 48000)).toBeNull()
    expect(store.bytes()).toBe(0)
    store.dispose()
  })
})
