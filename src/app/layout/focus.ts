/**
 * 换页之后焦点落到新页面的 h1 上（DESIGN.md §7.2、§11）：读屏软件先读到这一页是什么，
 * 键盘接着从页面开头往下走。页面是懒加载的，h1 可能晚几帧才出现，所以按帧找一小会儿。
 */

/** 最多找这么多帧（约 1 秒） */
const MAX_FRAMES = 60

/**
 * 只是落脚点、本身不能操作的元素（标题、小节）：给 tabindex="-1" 让它能接住焦点，并标上 data-focus-target，
 * 样式据此不画焦点框（与面板标题的做法一样：它不是控件，Tab 一下就到下一个控件上）。
 * 本来就能操作的元素（链接、按钮）照常聚焦、照常画框
 */
function landOn(target: HTMLElement, scroll: boolean): void {
  if (target.tabIndex < 0) {
    target.setAttribute('tabindex', '-1')
    target.setAttribute('data-focus-target', '')
  }
  target.focus({ preventScroll: !scroll })
}

/** 找到就聚焦：地址带 #id 时聚焦那个元素（并滚过去），否则聚焦正文里的第一个 h1（不滚动） */
export function focusPageHeading(hash = ''): void {
  let frames = 0
  const attempt = (): void => {
    const id = hash ? decodeURIComponent(hash.slice(1)) : ''
    const target = id ? document.getElementById(id) : document.querySelector<HTMLElement>('main h1')
    if (target) {
      landOn(target, Boolean(id))
      return
    }
    if (++frames < MAX_FRAMES) requestAnimationFrame(attempt)
  }
  requestAnimationFrame(attempt)
}
