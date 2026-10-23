import { isCatalogPracticeId, PRACTICE_BY_ID } from '@/content/practices'
import { AFTER_PRACTICE } from '@/content/safety'
import { soundName } from '@/content/sounds'
import {
  downloadFile,
  exportFileName,
  MIME,
  type SessionRecord,
  type StressRating,
  toCSV,
  toJSON,
} from '@/data'
import { dayKey, parseDayKey, startOfWeek } from '@/lib/date'

export function weeklyRatings(ratings: readonly StressRating[]): StressRating[] {
  const weeks = new Map<string, StressRating>()
  for (const rating of ratings) {
    const week = dayKey(startOfWeek(parseDayKey(rating.date)))
    const previous = weeks.get(week)
    if (!previous || previous.date <= rating.date) weeks.set(week, rating)
  }
  return [...weeks.values()].sort((a, b) => a.date.localeCompare(b.date))
}
function isoWeek(date: string): string {
  const d = parseDayKey(date)
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7))
  const year = utc.getUTCFullYear()
  const week = Math.ceil(((utc.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}
export function exportRecords(
  format: 'json' | 'csv',
  records: SessionRecord[],
  ratings: readonly StressRating[],
): void {
  const weekly = weeklyRatings(ratings).map(r => ({
    week: isoWeek(r.date),
    answeredAt: r.date,
    score: r.score,
  }))
  if (format === 'json') {
    const data = JSON.parse(toJSON(records)) as Record<string, unknown>
    data.weeklyStress = weekly
    downloadFile(exportFileName('json'), MIME.json, JSON.stringify(data, null, 2))
  } else {
    downloadFile(
      exportFileName('csv'),
      MIME.csv,
      toCSV(records, {
        practice: id => (isCatalogPracticeId(id) ? PRACTICE_BY_ID[id].name : id),
        ambience: id => soundName(id) ?? id,
        music: id => soundName(id) ?? id,
        feeling: id => AFTER_PRACTICE.options.find(o => o.value === id)?.label ?? id,
      }),
    )
    if (weekly.length)
      downloadFile(
        'weekly_stress.csv',
        MIME.csv,
        `\uFEFFweek,answered_at,score\r\n${weekly.map(r => `${r.week},${r.answeredAt},${r.score}`).join('\r\n')}\r\n`,
      )
  }
}
