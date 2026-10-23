import { Route, Routes } from 'react-router'
import { NotFound } from '@/app/pages/NotFound'
import { DefaultSounds, SettingsOverview } from './General'
import { AboutSettings, FontSettings, PrivacySettings } from './Info'
import { ReminderSettings } from './Reminders'
import { HealthSettings, MonthlySettings } from './Safety'
export function SettingsPage() {
  return (
    <Routes>
      <Route index element={<SettingsOverview />} />
      <Route path="sounds" element={<DefaultSounds />} />
      <Route path="reminders" element={<ReminderSettings />} />
      <Route path="safety" element={<HealthSettings />} />
      <Route path="monthly" element={<MonthlySettings />} />
      <Route path="privacy" element={<PrivacySettings />} />
      <Route path="about" element={<AboutSettings />} />
      <Route path="fonts" element={<FontSettings />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
