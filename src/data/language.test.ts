import { afterEach, describe, expect, it, vi } from 'vitest'
import { PREFS_KEY, readLanguage } from './language'

afterEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
})

describe('startup language selection', () => {
  it('defaults old preferences to Chinese and reads the saved Japanese preference', () => {
    expect(readLanguage()).toBe('zh-CN')
    localStorage.setItem(PREFS_KEY, JSON.stringify({ v: 2, language: 'ja' }))
    expect(readLanguage()).toBe('ja')
  })
  it('uses an explicit supported URL language, ignoring invalid values', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ v: 2, language: 'ja' }))
    window.history.replaceState(null, '', '/?lang=invalid')
    expect(readLanguage()).toBe('ja')
    window.history.replaceState(null, '', '/?lang=zh-CN')
    expect(readLanguage()).toBe('zh-CN')
  })
  it('still switches through the URL when persistent storage is denied or corrupted', () => {
    localStorage.setItem(PREFS_KEY, '{broken')
    expect(readLanguage()).toBe('zh-CN')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(readLanguage()).toBe('zh-CN')
    window.history.replaceState(null, '', '/?lang=ja')
    expect(readLanguage()).toBe('ja')
  })
})
