import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Cite, DoiLink, Notes, SourceLine } from './Cite'

afterEach(cleanup)

describe('Cite · Notes · DoiLink', () => {
  it('引用角标链接到页内的注释', () => {
    render(
      <p>
        结论
        <Cite n={2} />。
      </p>,
    )
    expect(screen.getByRole('link', { name: '2' })).toHaveAttribute('href', '#n2')
  })

  it('注释是有序列表，每条的 id 与角标对应；英文期刊名标 lang="en"', () => {
    render(
      <Notes
        items={[
          {
            who: 'Shaffer & Meehan 2020',
            type: '实践指南',
            what: '成人的慢呼吸节律',
            venue: 'Frontiers in Neuroscience',
            doi: '10.3389/fnins.2020.570400',
          },
          { who: 'Fincham 等 2023', type: '随机对照试验' },
        ]}
      />,
    )
    const list = screen.getByRole('list')
    const items = within(list).getAllByRole('listitem')
    expect(items.map(li => li.id)).toEqual(['n1', 'n2'])
    expect(screen.getByText('Frontiers in Neuroscience')).toHaveAttribute('lang', 'en')
  })

  it('DOI 链接：新标签页打开，rel="noopener"，lang="en"', () => {
    const { container } = render(<DoiLink doi="10.1038/s41598-023-49279-8" />)
    const link = screen.getByRole('link', { name: 'doi:10.1038/s41598-023-49279-8' })
    expect(link).toHaveAttribute('href', 'https://doi.org/10.1038/s41598-023-49279-8')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(link).toHaveAttribute('lang', 'en')
    expect(container.querySelector('use')).toHaveAttribute('href', '#i-external')
  })

  it('没有 DOI 的出处用原网址；出处行是引文加链接', () => {
    render(
      <SourceLine
        cite="Fincham 等 2023 · Scientific Reports"
        href="https://www.who.int/x"
        label="who.int/x"
      />,
    )
    expect(screen.getByText('Fincham 等 2023 · Scientific Reports')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'who.int/x' })).toHaveAttribute('href', 'https://www.who.int/x')
  })
})
