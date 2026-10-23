/**
 * 暂停之后先倒数，再接着练（DESIGN.md §8.15.17「继续」）：倒数的秒数与开头倒数相同（plan.leadSec），
 * 人不会被放回半口气里。会话引擎的 resume() 是从暂停处直接接上，所以倒数由这里管：
 * 倒数期间练习仍是暂停的，播放器读 useResumeCountdown() 显示「准备」和秒数。
 */
import { getController, getTimeScale } from '../services'
import { sessionStore } from './store'

let timer: ReturnType<typeof setTimeout> | null = null

/** 倒数之后接着练；开头倒数设为 0 时马上接着练。不在暂停中时什么也不做 */
export function resumeAfterLeadIn(): void {
  const ctrl = getController()
  const { status, plan } = ctrl.getState()
  if (status !== 'paused') return
  cancelResume()
  const lead = plan?.leadSec ?? 0
  if (lead <= 0) {
    ctrl.resume()
    return
  }
  const ms = (lead * 1000) / getTimeScale()
  sessionStore.setState({ resumeAt: performance.now() + ms })
  timer = setTimeout(() => {
    timer = null
    sessionStore.setState({ resumeAt: null })
    if (getController().getState().status === 'paused') getController().resume()
  }, ms)
}

/** 取消还没走完的倒数（又按了暂停、结束、离开播放器）；练习保持暂停 */
export function cancelResume(): void {
  if (timer !== null) clearTimeout(timer)
  timer = null
  if (sessionStore.getState().resumeAt !== null) sessionStore.setState({ resumeAt: null })
}

/** 练习不再是暂停（别处恢复了、结束了）时，倒数作废。启动时由 initFlows 接上；返回停止 */
export function watchResume(): () => void {
  return getController().subscribe(() => {
    if (sessionStore.getState().resumeAt !== null && getController().getState().status !== 'paused')
      cancelResume()
  })
}
