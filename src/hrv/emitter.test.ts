import { describe, expect, it, vi } from 'vitest'
import { createEmitter } from './emitter'

describe('emitter', () => {
  it('delivers to every listener and unsubscribes', () => {
    const e = createEmitter<number>()
    const a: number[] = []
    const b: number[] = []
    const offA = e.on(x => a.push(x))
    e.on(x => b.push(x))
    expect(e.size).toBe(2)
    e.emit(1)
    offA()
    e.emit(2)
    expect(a).toEqual([1])
    expect(b).toEqual([1, 2])
    expect(e.size).toBe(1)
  })

  it('keeps going when a listener throws, and reports the error asynchronously', () => {
    const queued: (() => void)[] = []
    vi.spyOn(globalThis, 'queueMicrotask').mockImplementation(task => {
      queued.push(task)
    })
    const e = createEmitter<string>()
    const got: string[] = []
    e.on(() => {
      throw new Error('listener failed')
    })
    e.on(x => got.push(x))
    e.emit('hi')
    expect(got).toEqual(['hi'])
    expect(queued).toHaveLength(1)
    expect(() => queued[0]!()).toThrow('listener failed')
  })

  it('lets a listener unsubscribe while being called', () => {
    const e = createEmitter<number>()
    const got: number[] = []
    const off = e.on(x => {
      got.push(x)
      off()
    })
    e.emit(1)
    e.emit(2)
    expect(got).toEqual([1])
  })
})
