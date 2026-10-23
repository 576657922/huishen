import { ABOUT, SETTINGS } from '@/content/copy'
import { FONT_COPYRIGHTS, FONT_LICENSE } from '@/content/font-licenses'
import { DISCLAIMERS } from '@/content/safety'
import { Section, typeset } from '@/ui'
import { SettingsFrame } from './Frame'
import styles from './Settings.module.css'
export function PrivacySettings() {
  return (
    <SettingsFrame title={SETTINGS.data.privacy.label}>
      {SETTINGS.data.privacy.lines.map(line => (
        <p key={line}>{typeset(line)}</p>
      ))}
    </SettingsFrame>
  )
}
export function AboutSettings() {
  return (
    <SettingsFrame title={ABOUT.title}>
      {ABOUT.lines.map(line => (
        <p key={line}>{typeset(line)}</p>
      ))}
      <Section title={DISCLAIMERS.full.title}>
        {DISCLAIMERS.full.paragraphs.map(line => (
          <p key={line}>{typeset(line)}</p>
        ))}
        <p className="t-caption ink-3">{DISCLAIMERS.full.updated}</p>
      </Section>
    </SettingsFrame>
  )
}
export function FontSettings() {
  return (
    <SettingsFrame title={SETTINGS.actions.licenses}>
      <p>{typeset(ABOUT.fonts.body)}</p>
      {FONT_COPYRIGHTS.map(line => (
        <p className="t-caption" key={line}>
          {line}
        </p>
      ))}
      <pre className={styles.license}>{FONT_LICENSE}</pre>
    </SettingsFrame>
  )
}
