/**
 * 开始按钮：在点击里调用 startPractice（声音只能在用户手势里解锁）。默认是开始条（DESIGN.md §8.4），
 * 显示真正会练的时长；也可以是一个主按钮（「60 秒落地练习」这类带自己文字的入口）。
 */
import type { ReactNode } from 'react'
import { type StartOptions, type StartOutcome, startPractice } from '@/app/flows'
import { defaultMinutes } from '@/app/plan'
import { usePrefs } from '@/data'
import { Button, StartBar } from '@/ui'

export interface StartButtonProps extends StartOptions {
  /** startbar：开始条（今日、练习详情、计划）；button：主按钮，文字由 children 给 */
  variant?: 'startbar' | 'button'
  /** variant="button" 时的文字 */
  children?: ReactNode
  /** 开始条上写「约 7 分钟」（舒适节律探索） */
  approx?: boolean
  /** 按钮占满一行（variant="button"） */
  block?: boolean
  /** 点了以后的结果：started、gated（去读「开始之前」）、checkin（练习前自评打开了）、busy */
  onStarted?: (outcome: StartOutcome) => void
  className?: string
}

export function StartButton({
  variant = 'startbar',
  children,
  approx = false,
  block = true,
  onStarted,
  className,
  ...start
}: StartButtonProps) {
  const practice = usePrefs(s => s.practice)
  const screening = usePrefs(s => s.safety.screening)
  const minutes = start.minutes ?? defaultMinutes(start.practiceId, { practice }, screening)
  const onStart = (): void => {
    const outcome = startPractice({ ...start, minutes })
    onStarted?.(outcome)
  }
  if (variant === 'button') {
    return (
      <Button variant="primary" block={block} onClick={onStart} className={className}>
        {children}
      </Button>
    )
  }
  return <StartBar minutes={minutes} approx={approx} onStart={onStart} className={className} />
}
