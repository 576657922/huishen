import { NavBar, PageFrame } from '@/app/layout'
import { NAV } from '@/app/strings'
import { HELP } from '@/content/copy'
import { CRISIS_CARD, CRISIS_RESOURCES, STOP_GUIDANCE } from '@/content/safety'
import { DisclosureRow, EmergencyLine, Lead, Section } from '@/ui'
import { HelpNumbers } from '@/widgets/HelpNumbers'
import { StopGuidance } from '@/widgets/StopGuidance'
import styles from './Help.module.css'

export function HelpPage() {
  return (
    <PageFrame title={CRISIS_CARD.title}>
      <NavBar backTo="/" backLabel={NAV.today} />
      <div className={styles.reading}>
        <h1 tabIndex={-1}>{CRISIS_CARD.title}</h1>
        <Lead>{CRISIS_CARD.body}</Lead>
        <EmergencyLine text={CRISIS_CARD.emergency} />
        <HelpNumbers variant="rows" level={2} />
        <p className="t-caption ink-3">{CRISIS_CARD.dialing}</p>
        <Section title={STOP_GUIDANCE.title} id="stop">
          <StopGuidance headingLevel={null} />
        </Section>
        <p className="t-caption ink-3">{CRISIS_CARD.footer}</p>
        <DisclosureRow label={HELP.sources}>
          {CRISIS_RESOURCES.map(region =>
            region.lines.map(line => (
              <p className="t-caption ink-3" key={`${region.id}-${line.href}`}>
                {region.name} · {line.name} · {line.source}
              </p>
            )),
          )}
        </DisclosureRow>
      </div>
    </PageFrame>
  )
}
