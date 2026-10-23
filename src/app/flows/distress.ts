/**
 * 「不舒服？」面板里的三个出口（DESIGN.md §8.15.17）。打开面板时练习已经暂停（pauseForDistress）。
 * 都在按钮的点击处理里调用：落地练习要在手势里开始。
 */
import { getController } from '../services'
import { endForHandoff } from './finish'
import { cancelResume, resumeAfterLeadIn } from './resume'
import { launch } from './start'
import { sessionStore } from './store'

/** 打开「不舒服？」之前：先暂停（正在倒数准备接着练的，也停在暂停里） */
export function pauseForDistress(): void {
  cancelResume()
  getController().pause()
}

/** 继续：关掉面板，倒数之后接着练，不会从半口气里接上 */
export function continueAfterDistress(): void {
  resumeAfterLeadIn()
}

/** 结束练习：不再确认；满 1 分钟就记下，小结只问练完感觉 */
export function endFromDistress(): void {
  cancelResume()
  sessionStore.setState({ endedFromDistress: true })
  getController().end()
}

/**
 * 60 秒落地练习：结束这一次（满 1 分钟照样记下，不出小结），马上开始落地练习；
 * 落地练习之后的小结只问练完感觉
 */
export function startGroundingFromDistress(): void {
  cancelResume()
  endForHandoff()
  launch({ practiceId: 'grounding', minutes: 1, from: 'distress' }, null, false)
}
