import type { ReactNode } from 'react'
import { NavBar, PageFrame } from '@/app/layout'
import { SETTINGS } from '@/content/copy'
import styles from './Settings.module.css'
export function SettingsFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PageFrame title={title}>
      <NavBar backTo="/settings" backLabel={SETTINGS.title} />
      <h1 tabIndex={-1}>{title}</h1>
      <div className={styles.reading}>{children}</div>
    </PageFrame>
  )
}
