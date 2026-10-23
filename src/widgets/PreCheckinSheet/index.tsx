/**
 * 练习前自评（DESIGN.md §13.5.13）：点了「开始」之后，在开始练习的那一页上升起的浅色面板，
 * 只有「此刻有多紧张？」0–10 和右上角的「跳过」。点一个分数就开始（面板再留 300 ms 让人看见选中的格子）；
 * 跳过、Esc、点遮罩、下拉都不带分数地开始。应用根部挂着一个（PreCheckinHost），页面不用自己放
 */
import { useEffect, useState } from 'react'
import { SUMMARY } from '@/content/copy'
import { Button, ScaleGroup, Sheet } from '@/ui'
import { CHECKIN_ANCHORS } from '../CheckinScale'
import styles from './PreCheckinSheet.module.css'

export interface PreCheckinSheetProps {
  open: boolean
  /** 分数 0–10，或 null（跳过、Esc、遮罩、下拉） */
  onAnswer: (score: number | null) => void
}

export function PreCheckinSheet({ open, onAnswer }: PreCheckinSheetProps) {
  const [value, setValue] = useState<number | null>(null)
  useEffect(() => {
    if (open) setValue(null)
  }, [open])
  const skip = (): void => onAnswer(null)
  return (
    <Sheet
      open={open}
      onClose={skip}
      title={SUMMARY.checkin.question}
      headAction={
        <Button variant="quiet" onClick={skip} className={styles.skip}>
          {SUMMARY.checkin.skip}
        </Button>
      }
    >
      <ScaleGroup
        min={0}
        max={10}
        anchors={CHECKIN_ANCHORS}
        value={value}
        label={SUMMARY.checkin.question}
        onChange={score => {
          setValue(score)
          onAnswer(score)
        }}
      />
    </Sheet>
  )
}
