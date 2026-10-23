import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SETTINGS } from '@/content/copy'
import type { CueStyle } from '@/engine'
import { ToastHost } from '@/ui'
import { CuePreview } from './CuePreview'

const audio = {
  unlock: vi.fn().mockResolvedValue(true),
  now: () => 0,
  startBed: vi.fn(),
  stopBed: vi.fn(),
  fadeBedOut: vi.fn(),
  freeRun: vi.fn(),
  breath: vi.fn(),
  glide: vi.fn(() => ({ cancel: vi.fn() })),
  cue: vi.fn(() => ({ cancel: vi.fn() })),
}
vi.mock('@/app/services', () => ({ getAudio: () => audio, peekAudio: () => audio }))
beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)
it.each(['glide', 'ping', 'bed', 'off'] satisfies CueStyle[])(
  'previews %s using a background that can follow scheduled breaths',
  async style => {
    const page = render(
      <ToastHost>
        <CuePreview style={style} />
      </ToastHost>,
    )
    await act(async () => fireEvent.click(screen.getByRole('button', { name: SETTINGS.actions.preview })))
    expect(audio.startBed).toHaveBeenCalledTimes(1)
    expect(audio.breath).toHaveBeenCalledTimes(style === 'off' ? 0 : 2)
    expect(audio.glide).toHaveBeenCalledTimes(style === 'glide' ? 2 : 0)
    expect(audio.cue).toHaveBeenCalledTimes(style === 'ping' ? 2 : 0)
    expect(audio.freeRun).toHaveBeenCalledTimes(style === 'off' ? 1 : 0)
    page.unmount()
    expect(audio.stopBed).toHaveBeenCalledTimes(1)
  },
)
