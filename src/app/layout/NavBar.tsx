import type { MouseEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { AppLink, cx, Icon } from '@/ui'
import { previousPath } from './history'
import styles from './NavBar.module.css'

export interface NavBarProps {
  /** 上一级的地址（「‹ 练习」→ /practices） */
  backTo: string
  /** 上一级的名字（「练习」「设置」「今日」） */
  backLabel: string
  /** 右边的图标按钮 */
  actions?: ReactNode
  className?: string
}

/**
 * 推入页面的导航条（DESIGN.md §8.0、§5.5）：左边是返回，右边可以有图标按钮；标题不在这里，h1 在正文里。
 * 刚从上一级过来时，返回就是浏览器的后退：上一页的滚动位置原样恢复（§13.1）；否则跳到上一级
 */
export function NavBar({ backTo, backLabel, actions, className }: NavBarProps) {
  const navigate = useNavigate()
  const onBack = (e: MouseEvent<HTMLAnchorElement>): void => {
    if (previousPath() !== backTo) return
    e.preventDefault()
    void navigate(-1)
  }
  return (
    <div className={cx(styles.navbar, className)}>
      <AppLink to={backTo} className={styles.back} onClick={onBack}>
        <Icon name="back" size={24} className={styles.icon} />
        {backLabel}
      </AppLink>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
