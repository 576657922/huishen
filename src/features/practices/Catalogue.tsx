import { useState } from 'react'
import { PageFrame } from '@/app/layout'
import { CATALOGUE } from '@/content/copy'
import { adjustedDefaults, CATEGORY_LABEL, catalogueSections, PRACTICE_BY_ID } from '@/content/practices'
import { PROGRAMS } from '@/content/programs'
import { CRISIS_CARD } from '@/content/safety'
import type { Category } from '@/content/types'
import { nextProgramDay, usePrefs } from '@/data'
import { FilterRow, GroupTitle, LinkMore, PageHead, PracticeList, PracticeRow, Section } from '@/ui'
import styles from './Practices.module.css'

export function CataloguePage() {
  const screening = usePrefs(s => s.safety.screening)
  const programs = usePrefs(s => s.programs)
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const sections = catalogueSections(screening)
  const count = sections.flatMap(s => s.groups.flatMap(g => g.ids)).length
  return (
    <PageFrame title={CATALOGUE.title} className={styles.catalogue}>
      <PageHead title={CATALOGUE.title} folioStart={CATALOGUE.folio(count)} folioEnd={CATALOGUE.folioEnd} />
      <FilterRow
        className={styles.filters}
        label={CATALOGUE.title}
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: CATALOGUE.all },
          ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value: value as Category, label })),
        ]}
      />
      {filter === 'all' && (
        <Section title={CATALOGUE.programs.title} aside={CATALOGUE.programs.aside}>
          <PracticeList className={styles.columns}>
            {Object.values(PROGRAMS).map(program => {
              const progress = programs[program.id]
              const next = nextProgramDay(progress, program.weeks.length)
              const description = progress
                ? next
                  ? CATALOGUE.programs.inProgress(next.week, next.day)
                  : CATALOGUE.programs.finished
                : CATALOGUE.programs.plan[program.id]
              return (
                <PracticeRow
                  key={program.id}
                  glyph={{ weeks: program.weeks.length }}
                  name={program.title}
                  description={description}
                  weeks={program.weeks.length}
                  end="weeks"
                  to={`/program/${program.id}`}
                />
              )
            })}
          </PracticeList>
        </Section>
      )}
      {sections
        .filter(s => filter === 'all' || s.category === filter)
        .map(section => (
          <Section
            key={section.category}
            title={section.title}
            aside={CATALOGUE.count(section.groups.flatMap(g => g.ids).length)}
          >
            {section.groups.map(group => (
              <div key={group.title ?? section.category}>
                {group.title && <GroupTitle>{group.title}</GroupTitle>}
                <PracticeList className={styles.columns}>
                  {group.ids.map(id => (
                    <PracticeRow
                      key={id}
                      practice={PRACTICE_BY_ID[id]}
                      minutes={adjustedDefaults(id, screening).defaultMinutes}
                      endText={id === 'pace-finder' ? CATALOGUE.about(7) : undefined}
                      showGrade
                      to={id === 'pace-finder' ? '/pace-finder' : `/practices/${id}`}
                    />
                  ))}
                </PracticeList>
              </div>
            ))}
            {section.hidden.length > 0 && (
              <p className="t-caption ink-3">
                {CATALOGUE.hidden(section.hidden.map(id => PRACTICE_BY_ID[id].name))}{' '}
                <LinkMore to="/settings/safety">{CATALOGUE.settingsSafety}</LinkMore>
              </p>
            )}
          </Section>
        ))}
      <footer className={styles.legend}>
        <p>{CATALOGUE.legend}</p>
        <LinkMore to="/evidence">{CATALOGUE.allEvidence}</LinkMore>
        <LinkMore to="/help">{CRISIS_CARD.title}</LinkMore>
      </footer>
    </PageFrame>
  )
}
