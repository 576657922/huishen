import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SUMMARY } from '@/content/copy'
import { AFTER_PRACTICE, CRISIS_CARD, CRISIS_RESOURCES, STOP_GUIDANCE } from '@/content/safety'
import { prefsStore } from '@/data'
import { CheckinScale } from './CheckinScale'
import { DistressSheet } from './DistressSheet'
import { FeelingChoice } from './FeelingChoice'
import { HelpNumbers } from './HelpNumbers'
import { PreCheckinSheet } from './PreCheckinSheet'
import { SoundPicker } from './SoundPicker'
import { StartButton } from './StartButton'
import { StopGuidance } from './StopGuidance'

const audio = { preview: vi.fn(), stopPreview: vi.fn(), setVolume: vi.fn() }

vi.mock('@/app/services', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/services')>()),
  getAudio: () => audio,
  peekAudio: () => audio,
}))

vi.mock('@/app/flows', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/flows')>()),
  startPractice: vi.fn(() => 'started'),
}))

const { startPractice } = await import('@/app/flows')

beforeEach(() => {
  prefsStore.getState().reset()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('FeelingChoice', () => {
  it('四个选项，不预选；点一下就提交，「跳过」给 null', async () => {
    const onChange = vi.fn()
    render(<FeelingChoice value={null} onChange={onChange} />)
    const group = screen.getByRole('radiogroup', { name: AFTER_PRACTICE.question })
    const radios = within(group).getAllByRole('radio')
    expect(radios.map(r => r.textContent)).toEqual(AFTER_PRACTICE.options.map(o => o.label))
    expect(radios.every(r => r.getAttribute('aria-checked') === 'false')).toBe(true)
    await userEvent.click(within(group).getByRole('radio', { name: '更紧张' }))
    expect(onChange).toHaveBeenLastCalledWith('tenser')
    await userEvent.click(screen.getByRole('button', { name: AFTER_PRACTICE.skip }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})

describe('CheckinScale', () => {
  it('0–10 共 11 格，不预选，可跳过', async () => {
    const onChange = vi.fn()
    render(<CheckinScale value={null} onChange={onChange} />)
    const group = screen.getByRole('radiogroup', { name: SUMMARY.checkin.question })
    const cells = within(group).getAllByRole('radio')
    expect(cells).toHaveLength(11)
    expect(cells.some(c => c.getAttribute('aria-checked') === 'true')).toBe(false)
    await userEvent.click(within(group).getByRole('radio', { name: '4' }))
    expect(onChange).toHaveBeenLastCalledWith(4)
    await userEvent.click(screen.getByRole('button', { name: SUMMARY.checkin.skip }))
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})

describe('PreCheckinSheet', () => {
  it('只有问题和「跳过」；点一个分数就回答', async () => {
    const onAnswer = vi.fn()
    const { rerender } = render(<PreCheckinSheet open onAnswer={onAnswer} />)
    const dialog = screen.getByRole('dialog', { name: SUMMARY.checkin.question })
    await userEvent.click(within(dialog).getByRole('radio', { name: '7' }))
    expect(onAnswer).toHaveBeenLastCalledWith(7)
    rerender(<PreCheckinSheet open={false} onAnswer={onAnswer} />)
    rerender(<PreCheckinSheet open onAnswer={onAnswer} />)
    // 再打开时不带上次的分数
    const again = screen.getByRole('dialog', { name: SUMMARY.checkin.question })
    expect(
      within(again)
        .getAllByRole('radio')
        .some(c => c.getAttribute('aria-checked') === 'true'),
    ).toBe(false)
    await userEvent.click(within(again).getByRole('button', { name: SUMMARY.checkin.skip }))
    expect(onAnswer).toHaveBeenLastCalledWith(null)
  })
})

describe('HelpNumbers', () => {
  it('面板里：中国大陆的四个号码可以直接拨打，旁边写着最后核实的日期，标题链到求助方式', () => {
    render(<HelpNumbers />, { wrapper: MemoryRouter })
    const hrefs = screen
      .getAllByRole('link')
      .map(a => a.getAttribute('href'))
      .filter(h => h?.startsWith('tel:'))
    expect(hrefs).toEqual(CRISIS_RESOURCES[0]?.lines.map(l => l.href))
    expect(screen.getByText(CRISIS_CARD.verified)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: CRISIS_CARD.title })).toHaveAttribute('href', '/help')
  })

  it('求助方式页：按地区列出全部号码，顺序照抄', () => {
    render(<HelpNumbers variant="rows" />, { wrapper: MemoryRouter })
    const hrefs = screen.getAllByRole('link').map(a => a.getAttribute('href'))
    expect(hrefs).toEqual(CRISIS_RESOURCES.flatMap(r => r.lines.map(l => l.href)))
    for (const region of CRISIS_RESOURCES)
      expect(screen.getByRole('heading', { name: region.name })).toBeInTheDocument()
    expect(screen.getByText(CRISIS_CARD.verified)).toBeInTheDocument()
  })
})

describe('StopGuidance', () => {
  it('全文照抄、顺序不变；急救号码可以拨打', () => {
    const { container } = render(<StopGuidance helpLink />, { wrapper: MemoryRouter })
    const text = (container.textContent ?? '').replace(/\s+/g, '')
    const parts = [
      STOP_GUIDANCE.title,
      ...STOP_GUIDANCE.when.items,
      STOP_GUIDANCE.after.lead,
      ...STOP_GUIDANCE.after.items,
    ].map(t => t.replace(/\s+/g, ''))
    let from = 0
    for (const part of parts) {
      const at = text.indexOf(part, from)
      expect(at, part).toBeGreaterThanOrEqual(from)
      from = at + part.length
    }
    expect(container.querySelector('a[href="tel:120"]')).not.toBeNull()
    expect(screen.getByRole('link', { name: CRISIS_CARD.title })).toHaveAttribute('href', '/help')
  })
})

describe('DistressSheet', () => {
  it('结束练习、继续、60 秒落地练习各走自己的出口', async () => {
    const onEnd = vi.fn()
    const onContinue = vi.fn()
    const onGrounding = vi.fn()
    render(
      <MemoryRouter>
        <DistressSheet
          open
          onClose={vi.fn()}
          onEnd={onEnd}
          onContinue={onContinue}
          onGrounding={onGrounding}
        />
      </MemoryRouter>,
    )
    const dialog = screen.getByRole('dialog', { name: '不舒服？' })
    await userEvent.click(within(dialog).getByRole('button', { name: STOP_GUIDANCE.actions.grounding }))
    await userEvent.click(within(dialog).getByRole('button', { name: '结束练习' }))
    await userEvent.click(within(dialog).getByRole('button', { name: '继续' }))
    expect(onGrounding).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onContinue).toHaveBeenCalledTimes(1)
    // 急救那一句里的 120 和号码格里的 120 都能直接拨打
    const dial120 = within(dialog).getAllByRole('link', { name: /120/ })
    expect(dial120).toHaveLength(2)
    for (const a of dial120) expect(a).toHaveAttribute('href', 'tel:120')
  })

  it('落地练习自己的面板里没有「60 秒落地练习」', () => {
    render(
      <MemoryRouter>
        <DistressSheet open onClose={vi.fn()} onGrounding={null} />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: STOP_GUIDANCE.actions.grounding })).toBeNull()
  })
})

describe('SoundPicker', () => {
  const mix = { ambience: 'rain', music: 'drone', ambienceVolume: 60, musicVolume: 40 } as const

  it('放松模式有鸟鸣，睡前没有', () => {
    const { rerender } = render(<SoundPicker value={mix} mode="relax" onChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: /鸟鸣/ })).toBeInTheDocument()
    rerender(<SoundPicker value={mix} mode="sleep" onChange={vi.fn()} />)
    expect(screen.queryByRole('radio', { name: /鸟鸣/ })).toBeNull()
  })

  it('选一个声音：交出新的组合，开了试听时在这次点击里试听', async () => {
    const onChange = vi.fn()
    render(<SoundPicker value={mix} mode="relax" onChange={onChange} preview />)
    await userEvent.click(screen.getByRole('radio', { name: /溪流/ }))
    expect(onChange).toHaveBeenLastCalledWith({ ...mix, ambience: 'stream' })
    expect(audio.preview).toHaveBeenLastCalledWith({ ...mix, ambience: 'stream', mode: 'relax' })
  })

  it('不开试听时不碰声音', async () => {
    render(<SoundPicker value={mix} mode="relax" onChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('radio', { name: /溪流/ }))
    expect(audio.preview).not.toHaveBeenCalled()
  })
})

describe('StartButton', () => {
  it('在点击里开始，带上真正会练的时长', async () => {
    render(<StartButton practiceId="slow" from="catalogue" />, { wrapper: MemoryRouter })
    await userEvent.click(screen.getByRole('button', { name: /开始/ }))
    expect(startPractice).toHaveBeenLastCalledWith({ practiceId: 'slow', minutes: 5, from: 'catalogue' })
  })

  it('详情页上次选的时长优先', async () => {
    prefsStore.getState().setPractice('focus', { minutes: 15 })
    render(<StartButton practiceId="focus" from="catalogue" />, { wrapper: MemoryRouter })
    expect(screen.getByRole('button', { name: /开始/ })).toHaveTextContent('15')
    await userEvent.click(screen.getByRole('button', { name: /开始/ }))
    expect(startPractice).toHaveBeenLastCalledWith({ practiceId: 'focus', minutes: 15, from: 'catalogue' })
  })
})
