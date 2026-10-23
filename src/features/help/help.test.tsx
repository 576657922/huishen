import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it } from 'vitest'
import { HELP } from '@/content/copy'
import { CRISIS_RESOURCES, STOP_GUIDANCE } from '@/content/safety'
import { HelpPage } from './index'

afterEach(cleanup)
it('bundles the verified dial links, stop guidance and sources without a network dependency', () => {
  render(
    <MemoryRouter>
      <HelpPage />
    </MemoryRouter>,
  )
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  for (const region of CRISIS_RESOURCES)
    for (const line of region.lines)
      expect(screen.getAllByRole('link').some(link => link.getAttribute('href') === line.href)).toBe(true)
  expect(document.getElementById('stop')).toHaveTextContent(STOP_GUIDANCE.title)
  fireEvent.click(screen.getByRole('button', { name: HELP.sources }))
  expect(document.body).toHaveTextContent(CRISIS_RESOURCES[0]!.lines[0]!.source)
})
