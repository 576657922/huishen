import { useCallback, useEffect, useState } from 'react'
import { confirmSafetyNotice, sessionStore, usePendingSession } from '@/app/flows'
import { Lockup, PageFrame } from '@/app/layout'
import { navigate } from '@/app/navigation'
import { WELCOME } from '@/content/copy'
import { CRISIS_CARD, FIRST_RUN_NOTICE } from '@/content/safety'
import { prefsStore } from '@/data'
import { Button, clauses, Dock, Lead, LinkMore, ListGroup, Row, Section, Sheet, typeset } from '@/ui'
import styles from './Welcome.module.css'

function useReadToEnd(open: boolean): [(el: HTMLDivElement | null) => void, boolean] {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const [done, setDone] = useState(false)
  const ref = useCallback((el: HTMLDivElement | null) => setNode(el), [])
  useEffect(() => {
    if (!open || !node) {
      setDone(false)
      return
    }
    const root = node.parentElement
    if (!root) return
    const check = (): void => {
      const container = root.getBoundingClientRect()
      const last = node.getBoundingClientRect()
      if (container.height > 0 && last.bottom <= container.bottom + 1 && last.top >= container.top)
        setDone(true)
    }
    if (typeof IntersectionObserver === 'function') {
      const observer = new IntersectionObserver(
        entries => {
          if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 1)) setDone(true)
        },
        { root, threshold: 1 },
      )
      observer.observe(node)
      return () => observer.disconnect()
    }
    // 旧浏览器按实际滚动位置判断，不因缺少 Observer 跳过须知。
    const frame = requestAnimationFrame(check)
    root.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      cancelAnimationFrame(frame)
      root.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [node, open])
  return [ref, done]
}
export function WelcomePage() {
  const gated = usePendingSession(s => s.gated)
  const [requested, setOpen] = useState(false)
  const open = requested || gated !== null
  const [endRef, read] = useReadToEnd(open)
  const browse = (): void => {
    prefsStore.getState().set({ onboarded: true })
    sessionStore.setState({ gated: null })
    navigate('/practices')
  }
  return (
    <PageFrame title={null} variant="dock" className={styles.page}>
      <h1 className={styles.brand} tabIndex={-1}>
        <Lockup link={false} size="large" />
      </h1>
      <Lead>{WELCOME.tagline}</Lead>
      <ListGroup className={styles.description}>
        {WELCOME.lines.map(line => (
          <Row key={line} label={clauses(line)} />
        ))}
      </ListGroup>
      <p className="t-caption ink-3">{typeset(WELCOME.scope)}</p>
      <Section title={WELCOME.privacy.title}>
        {WELCOME.privacy.lines.map(line => (
          <Row key={line} label={line} />
        ))}
      </Section>
      <LinkMore to="/help">{CRISIS_CARD.title}</LinkMore>
      <Dock className={styles.actions}>
        <Button variant="primary" block onClick={() => setOpen(true)}>
          {WELCOME.start}
        </Button>
        <Button variant="quiet" block onClick={browse}>
          {WELCOME.browse}
        </Button>
      </Dock>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={FIRST_RUN_NOTICE.title}
        dismissible={false}
        size="full"
        className={styles.notice}
        footer={
          <div className={styles.noticeFooter}>
            <p className="t-caption ink-3">{FIRST_RUN_NOTICE.readToEnd}</p>
            <Button
              variant="primary"
              block
              aria-disabled={!read}
              onClick={() => {
                if (read) confirmSafetyNotice()
              }}
            >
              {FIRST_RUN_NOTICE.confirm}
            </Button>
          </div>
        }
      >
        {FIRST_RUN_NOTICE.sections.map((section, i) => (
          <div
            className={styles.noticeSection}
            key={section.heading ?? section.paragraphs?.[0] ?? `section-${i}`}
          >
            {section.heading && <h3 className="t-name">{section.heading}</h3>}
            {section.paragraphs?.map(p => (
              <p key={p}>{typeset(p)}</p>
            ))}
            {section.items && (
              <ul>
                {section.items.map(item => (
                  <li key={item}>{typeset(item)}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
        <LinkMore to="/help">{FIRST_RUN_NOTICE.help}</LinkMore>
        <div ref={endRef} className={styles.end} aria-hidden="true" />
      </Sheet>
    </PageFrame>
  )
}
