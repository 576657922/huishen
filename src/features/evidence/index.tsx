import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { PageFrame } from '@/app/layout'
import { EVIDENCE, SYSTEM } from '@/content/copy'
import {
  CLAIM_COUNT,
  citeHref,
  citeLabel,
  citeLine,
  type EvidenceFilter,
  type EvidenceIndex,
  type EvidencePage as EvidenceModel,
  effectAxis,
  effectNote,
  filterCards,
  filterFor,
  formatEffect,
  formatSize,
  loadEvidence,
  loadEvidencePage,
  metaLine,
} from '@/content/evidence'
import { isOffered } from '@/content/practices'
import { CRISIS_CARD } from '@/content/safety'
import type { EvidenceCard as Card } from '@/content/types'
import {
  Button,
  Disclosure,
  DoiLink,
  EffectRows,
  EmptyState,
  EvidenceCard,
  type EvidenceField,
  FilterRow,
  GradeBox,
  GradeMark,
  Lead,
  LinkMore,
  ListGroup,
  PageHead,
  Reveal,
  Row,
  Section,
  SectionHead,
  SourceLine,
  typeset,
} from '@/ui'
import styles from './Evidence.module.css'

type Resource = { page: EvidenceModel; index: EvidenceIndex }
function fieldsFor(card: Card, { page, index }: Resource): EvidenceField[] {
  const fields: EvidenceField[] = []
  if (card.outcomes?.length) {
    const axis = effectAxis(card.outcomes)
    fields.push({
      term: page.fields.effect,
      wide: true,
      content: (
        <EffectRows
          domain={[axis.min, axis.max]}
          ticks={axis.ticks}
          note={effectNote(card)}
          outcomes={card.outcomes.map(o => ({
            name: o.name,
            detail: formatSize(o, card.unit),
            value: formatEffect(o, card.metric),
            ci: { g: o.g, lo: o.lo, hi: o.hi },
          }))}
        />
      ),
    })
  }
  if (card.stat) fields.push({ term: page.fields.effect, content: card.stat })
  fields.push(
    { term: page.fields.design, content: card.design },
    { term: page.fields.grade, content: <GradeMark grade={card.grade} /> },
    { term: page.fields.limits, content: card.limits },
  )
  fields.push({
    term: page.fields.contrary,
    content: card.contrary.length
      ? card.contrary.map(c => {
          const cite = index.cite(c.claimId)
          return (
            <div key={c.claimId}>
              <p>{typeset(c.text)}</p>
              {cite && <SourceLine cite={citeLine(cite)} href={citeHref(cite)} label={citeLabel(cite)} />}
            </div>
          )
        })
      : page.labels.noContrary,
  })
  const cite = index.cite(card.source)
  if (cite)
    fields.push({
      term: page.fields.source,
      content: <SourceLine cite={citeLine(cite)} href={citeHref(cite)} label={citeLabel(cite)} />,
    })
  const uses = page.inApp[card.id]
  if (uses)
    fields.push({
      term: page.labels.inApp,
      content: (
        <>
          {uses.use && <p>{uses.use}</p>}
          <div className={styles.links}>
            {uses.practices
              .filter(p => isOffered(p.id))
              .map(p => (
                <LinkMore key={p.id} to={p.id === 'pace-finder' ? '/pace-finder' : `/practices/${p.id}`}>
                  {p.name}
                </LinkMore>
              ))}
            {uses.programs.map(p => (
              <LinkMore key={p.id} to={`/program/${p.id}`}>
                {p.title}
              </LinkMore>
            ))}
          </div>
        </>
      ),
    })
  return fields
}
const readHash = (hash: string): string => {
  try {
    return decodeURIComponent(hash.slice(1))
  } catch {
    return ''
  }
}
export function EvidencePage() {
  const { hash } = useLocation()
  const [resource, setResource] = useState<Resource | null>(null)
  const [failed, setFailed] = useState(false)
  const [wide, setWide] = useState(() => window.matchMedia?.('(min-width: 1024px)').matches ?? false)
  useEffect(() => {
    const query = window.matchMedia?.('(min-width: 1024px)')
    if (!query) return
    const update = (): void => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const [filter, setFilter] = useState<EvidenceFilter>('all')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [methodOpen, setMethodOpen] = useState(false)
  const pendingHash = useRef('')
  useEffect(() => {
    let live = true
    void Promise.all([loadEvidencePage(), loadEvidence()]).then(
      ([page, index]) => {
        if (!live) return
        setResource({ page, index })
        setExpanded(new Set(page.cards[0] ? [page.cards[0].id] : []))
      },
      () => {
        if (live) setFailed(true)
      },
    )
    return () => {
      live = false
    }
  }, [])
  useEffect(() => {
    if (!resource || !hash) return
    const id = readHash(hash)
    const card = resource.index.card(id)
    if (!card) return
    pendingHash.current = id
    setFilter(filterFor(card))
    setExpanded(previous => new Set([...previous, id]))
  }, [resource, hash])
  useEffect(() => {
    const id = pendingHash.current
    if (
      !id ||
      !expanded.has(id) ||
      !resource ||
      !filterCards(resource.page.cards, filter).some(card => card.id === id)
    )
      return
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(id)
      if (!target) return
      target.tabIndex = -1
      target.setAttribute('data-focus-target', '')
      target.focus({ preventScroll: true })
      target.scrollIntoView?.({ block: 'start' })
      pendingHash.current = ''
    })
    return () => cancelAnimationFrame(frame)
  }, [filter, expanded, resource])
  const cards = resource ? filterCards(resource.page.cards, filter) : []
  const grades = (
    <Section title={EVIDENCE.grades.title} className={styles.grades}>
      <ListGroup>
        {(['A', 'B', 'C', 'D'] as const).map(grade => (
          <Row
            key={grade}
            label={
              <span className={styles.gradeName}>
                <GradeBox grade={grade} />
                {EVIDENCE.grades.names[grade]}
              </span>
            }
            hint={EVIDENCE.grades.definitions[grade]}
          />
        ))}
      </ListGroup>
      <p className="t-caption ink-3">{EVIDENCE.grades.scope}</p>
    </Section>
  )
  return (
    <PageFrame title={EVIDENCE.title}>
      <PageHead
        title={EVIDENCE.title}
        folioStart={EVIDENCE.sources(CLAIM_COUNT)}
        folioEnd={EVIDENCE.reviewedShort}
      />
      {failed && (
        <EmptyState
          title={SYSTEM.error.title}
          action={
            <Button variant="quiet" onClick={() => window.location.reload()}>
              {SYSTEM.error.reload}
            </Button>
          }
        />
      )}
      <div className={styles.layout}>
        <Lead className={styles.intro}>{EVIDENCE.intro}</Lead>
        <Section title={EVIDENCE.method.title} className={styles.method}>
          <p className="ink-2">{typeset(EVIDENCE.method.lines[0])}</p>
          <Disclosure
            expanded={methodOpen}
            controls="evidence-method"
            onToggle={() => setMethodOpen(v => !v)}
          >
            {methodOpen ? EVIDENCE.card.collapse : EVIDENCE.method.more(EVIDENCE.method.lines.length - 1)}
          </Disclosure>
          <Reveal id="evidence-method" expanded={methodOpen}>
            {EVIDENCE.method.lines.slice(1).map(line => (
              <p key={line} className="ink-2">
                {typeset(line)}
              </p>
            ))}
            <p className="t-caption ink-3">{EVIDENCE.method.reviewed}</p>
          </Reveal>
        </Section>
        <SectionHead
          title={EVIDENCE.card.conclusion}
          aside={EVIDENCE.filterCount(EVIDENCE.filters[filter], cards.length)}
          className={styles.conclusions}
        />
        <aside className={styles.sidebar}>
          <FilterRow
            orientation={wide ? 'vertical' : 'horizontal'}
            className={styles.filters}
            label={EVIDENCE.card.conclusion}
            value={filter}
            onChange={value => {
              setFilter(value)
              const first = resource && filterCards(resource.page.cards, value)[0]
              if (first) setExpanded(new Set([first.id]))
            }}
            options={Object.entries(EVIDENCE.filters).map(([value, label]) => ({
              value: value as EvidenceFilter,
              label,
            }))}
          />
          {grades}
        </aside>
        <div className={styles.cards} aria-busy={!resource && !failed}>
          {resource && cards.length === 0 && (
            <EmptyState title={EVIDENCE.empty.title} body={EVIDENCE.empty.body} />
          )}
          {resource &&
            cards.map(card => (
              <EvidenceCard
                key={card.id}
                id={card.id}
                topic={card.topic}
                grade={card.grade}
                claim={typeset(card.claim)}
                meta={metaLine(card)}
                fields={fieldsFor(card, resource)}
                expanded={expanded.has(card.id)}
                onToggle={() =>
                  setExpanded(previous => {
                    const next = new Set(previous)
                    if (next.has(card.id)) next.delete(card.id)
                    else next.add(card.id)
                    return next
                  })
                }
                className={expanded.has(card.id) ? styles.expanded : undefined}
              />
            ))}
        </div>
        <Section title={EVIDENCE.unknown.title} className={styles.unknown}>
          <ListGroup>
            {EVIDENCE.unknown.lines.map(line => (
              <Row key={line} label={typeset(line)} />
            ))}
          </ListGroup>
        </Section>
        <Section
          title={EVIDENCE.notAdopted.title}
          aside={EVIDENCE.notAdopted.count(EVIDENCE.notAdopted.items.length)}
          className={styles.notAdopted}
        >
          <p className="ink-2">{EVIDENCE.notAdopted.intro}</p>
          <ul className={styles.notList}>
            {EVIDENCE.notAdopted.items.map(item => (
              <li key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <GradeMark grade={item.grade} />
                </div>
                <p>{typeset(item.reason)}</p>
                {resource &&
                  item.evidence.map(id => {
                    const cite = resource.index.cite(id)
                    return cite ? <DoiLink key={id} href={citeHref(cite)} label={citeLabel(cite)} /> : null
                  })}
              </li>
            ))}
          </ul>
        </Section>
        <LinkMore to="/help" className={styles.help}>
          {CRISIS_CARD.title}
        </LinkMore>
      </div>
    </PageFrame>
  )
}
