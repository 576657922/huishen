/**
 * 应用外壳的短标签。内容（src/content）里已有的直接引用；还没有的几条先放在这里，
 * 标了 TODO(content) 的都已在交付报告里向内容负责人申请，内容加上之后把值换成引用即可。
 */
import { CATALOGUE, EVIDENCE, RECORDS, SETTINGS, SYSTEM, TODAY } from '@/content/copy'
import { CRISIS_CARD } from '@/content/safety'

export const NAV = {
  today: TODAY.title,
  practices: CATALOGUE.title,
  records: RECORDS.title,
  evidence: EVIDENCE.title,
  help: CRISIS_CARD.title,
  settings: SETTINGS.title,
  /** 标签栏和导航栏的读屏名称（DESIGN.md §11） TODO(content) */
  label: '主导航',
  /** 播放器控件的读屏名称（DESIGN.md §11） TODO(content) */
  playerLabel: '练习控制',
  /** 标志是回到今日的链接（DESIGN.md §8.0） TODO(content) */
  lockup: '回神 · 今日',
  /** 标志里的字，与 logo.svg 一致 */
  wordmark: '回神',
  /** 桌面导航栏底部的一句（DESIGN.md §5.5） TODO(content) */
  railNote: '离线可用。练习记录只保存在这台设备上。',
  /** 跳过导航、直接到正文的链接（DESIGN.md §11） TODO(content) */
  skip: '跳到正文',
} as const

export { SYSTEM }

/** 播放器的读屏名称：「慢呼吸练习」（DESIGN.md §11） TODO(content) */
export const playerName = (practiceName: string): string => `${practiceName}练习`
