import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { Button, ButtonLink, EmptyState } from '@/ui'
import { abandonPractice } from '../flows/finish'
import { PageFrame } from '../layout/PageFrame'
import { SYSTEM } from '../strings'
import styles from './ErrorPage.module.css'

/**
 * 页面出错（DESIGN.md §13.14）：说明练习记录没有受影响，给「回到今日」和「重新加载」。
 * 播放器出错时练习可能还在响：一并结束（满 1 分钟照样记下），不让声音在没有控件的页面上继续
 */
export function ErrorPage() {
  const error = useRouteError()
  useEffect(() => {
    console.error(error)
    abandonPractice()
  }, [error])
  return (
    <PageFrame title={SYSTEM.error.title}>
      <EmptyState
        level={1}
        title={SYSTEM.error.title}
        body={SYSTEM.error.body}
        action={
          <div className={styles.actions}>
            <ButtonLink to="/" variant="secondary">
              {SYSTEM.error.home}
            </ButtonLink>
            <Button variant="quiet" onClick={() => window.location.reload()}>
              {SYSTEM.error.reload}
            </Button>
          </div>
        }
      />
    </PageFrame>
  )
}
