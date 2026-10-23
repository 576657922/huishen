/**
 * 「不舒服？」面板（PRODUCT.md §5、DESIGN.md §8.15.17）：打开时练习已经暂停。
 * 一句话的停止指引 → 停下以后的前三条（「停止指引全文 ›」）→ 急救的那一句 → 60 秒落地练习 → 求助电话 →
 * 底部「结束练习」（次要，左）和「继续」（安静，右）。结束练习不再确认；继续会先倒数再接着练。
 * 点遮罩、Esc、下拉只关掉面板，练习保持暂停（播放器接着显示暂停面板），从不自己继续。
 */
import { useId } from 'react'
import { continueAfterDistress, endFromDistress, startGroundingFromDistress } from '@/app/flows'
import { PLAYER } from '@/content/copy'
import { STOP_GUIDANCE } from '@/content/safety'
import { Button, clauses, EmergencyLine, LinkMore, Sheet } from '@/ui'
import { HelpNumbers } from '../HelpNumbers'
import styles from './DistressSheet.module.css'

/** 面板里只列「停下以后」的前三条（第一条是「头晕的话，先坐下或躺下」），全文在 /help#stop */
const AFTER_ITEMS = STOP_GUIDANCE.after.items.slice(0, 3)

export interface DistressSheetProps {
  open: boolean
  /** 点遮罩、Esc、下拉：练习保持暂停，播放器接着显示暂停面板 */
  onClose: () => void
  /** 继续：默认关面板，倒数之后接着练（continueAfterDistress） */
  onContinue?: () => void
  /** 结束练习：默认 endFromDistress（不确认；满 1 分钟记下，小结只问练完感觉） */
  onEnd?: () => void
  /** 60 秒落地练习：默认 startGroundingFromDistress；落地练习自己的播放器里传 null，不显示这个按钮 */
  onGrounding?: (() => void) | null
}

export function DistressSheet({
  open,
  onClose,
  onContinue = continueAfterDistress,
  onEnd = endFromDistress,
  onGrounding = startGroundingFromDistress,
}: DistressSheetProps) {
  const leadId = useId()
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={PLAYER.unwell}
      surface="player"
      size="full"
      footer={
        <>
          <Button variant="secondary" onClick={onEnd} className={styles.footButton}>
            {PLAYER.unwellSheet.endPractice}
          </Button>
          <Button variant="quiet" onClick={onContinue} className={styles.footButton}>
            {PLAYER.resume}
          </Button>
        </>
      }
    >
      <p id={leadId} className={styles.lead}>
        {PLAYER.unwellSheet.paused}
        <b>{clauses(STOP_GUIDANCE.short)}</b>
      </p>
      <div className={styles.stop}>
        <p className={styles.stopHead}>
          <span>{STOP_GUIDANCE.after.lead}</span>
          <LinkMore to="/help#stop" size="caption" className={styles.fullLink}>
            {PLAYER.unwellSheet.fullGuidance}
          </LinkMore>
        </p>
        <ol className={styles.list}>
          {AFTER_ITEMS.map(item => (
            <li key={item}>
              <span>{clauses(item)}</span>
            </li>
          ))}
        </ol>
        <EmergencyLine text={STOP_GUIDANCE.emergency} className={styles.emergency} />
      </div>
      {onGrounding && (
        <Button variant="primary" block onClick={onGrounding} className={styles.ground}>
          {STOP_GUIDANCE.actions.grounding}
        </Button>
      )}
      <HelpNumbers variant="grid" />
    </Sheet>
  )
}
