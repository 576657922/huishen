import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { CrisisLine } from '@/content/safety'
import { PhoneRow } from './PhoneRow'

afterEach(cleanup)

const line: CrisisLine = {
  name: '心理援助热线',
  display: '12356',
  href: 'tel:12356',
  hours: '24 小时',
  description: '全国统一号码。',
  source: 'x',
}

describe('PhoneRow', () => {
  it('整行是 tel: 链接，读作「心理援助热线 12356，拨打」', () => {
    render(<PhoneRow line={line} />)
    const link = screen.getByRole('link', { name: '心理援助热线 12356，拨打' })
    expect(link).toHaveAttribute('href', 'tel:12356')
    expect(link).not.toHaveAttribute('target')
    expect(link).toHaveTextContent('24 小时')
  })

  it('网址类的行在新标签页打开，图标是外链', () => {
    const { container } = render(
      <PhoneRow line={{ ...line, display: 'example.org', href: 'https://example.org' }} />,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('target', '_blank')
    expect(container.querySelector('use')).toHaveAttribute('href', '#i-external')
  })
})
