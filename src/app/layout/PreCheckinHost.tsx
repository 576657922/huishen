import { PreCheckinSheet } from '@/widgets/PreCheckinSheet'
import { answerPreCheckin } from '../flows/start'
import { usePendingSession } from '../flows/store'

/** 练习前自评的面板挂在应用根部：startPractice 把 phase 设成 checkin 时，在开始练习的那一页上升起 */
export function PreCheckinHost() {
  const open = usePendingSession(s => s.phase === 'checkin')
  return <PreCheckinSheet open={open} onAnswer={answerPreCheckin} />
}
