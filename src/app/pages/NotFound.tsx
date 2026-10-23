import { EmptyState, LinkMore } from '@/ui'
import { PageFrame } from '../layout/PageFrame'
import { SYSTEM } from '../strings'

/** 找不到页面（DESIGN.md §13.14）：说清楚，再给回到今日的路 */
export function NotFound() {
  return (
    <PageFrame title={SYSTEM.notFound.title}>
      <EmptyState
        level={1}
        title={SYSTEM.notFound.title}
        action={<LinkMore to="/">{SYSTEM.notFound.home}</LinkMore>}
      />
    </PageFrame>
  )
}
