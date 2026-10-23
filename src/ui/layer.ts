/**
 * 模态层的共同行为（面板、对话框）：背景 inert、页面不滚动、Tab 困在层里、Esc、关闭后焦点回到触发处；
 * 以及退场动画：关的时候先播完退场再卸载，时长读 CSS（减少动态效果时为 0，立刻卸载）。
 */
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react'

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

/**
 * 层里在 Tab 顺序上的元素，按文档顺序；隐藏的（display: none、inert 里的）不算。
 * tabindex="-1" 的也不算：单选组用漫游焦点，只有一格在 Tab 顺序里。把其余的格子算进来，
 * 陷阱认定的「最后一个」就不是真正的最后一站，Tab 会从那一格跑出层外
 */
export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    el =>
      el.tabIndex >= 0 &&
      !el.closest('[inert]') &&
      (el.offsetParent !== null || el.getClientRects().length > 0 || isJsdom()),
  )
}

// jsdom 不排版，offsetParent 永远是 null；测试里按 DOM 判断
const isJsdom = (): boolean => typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)

/** 同时打开的模态层（面板上再开确认对话框），只有最上面的那层响应 Esc */
const stack: HTMLElement[] = []
let lockCount = 0

export interface ModalLayerOptions {
  /** 打开时要聚焦的元素；不给时聚焦层里第一个可 Tab 的元素 */
  initialFocus?: RefObject<HTMLElement | null>
  /** Esc；不给时 Esc 什么都不做（必须作出选择的面板） */
  onEscape?: () => void
}

/**
 * 让 layer（portal 到 body 下的根元素）成为模态：它的兄弟元素都设 inert，<html> 加 data-scroll-lock，
 * 焦点困在里面；active 变 false 或卸载时全部复原，焦点回到打开前的元素
 */
export function useModalLayer(
  layer: RefObject<HTMLElement | null>,
  active: boolean,
  options: ModalLayerOptions,
) {
  const optionsRef = useRef(options)
  optionsRef.current = options

  useLayoutEffect(() => {
    const root = layer.current
    if (!active || !root) return
    const doc = root.ownerDocument
    const trigger = doc.activeElement instanceof HTMLElement ? doc.activeElement : null

    // 只复原我们自己设的 inert：下面一层早就设过的，留给它自己复原。
    // 用属性而不是 el.inert：两者在浏览器里等价，属性在没有实现 inert 的环境（jsdom）里也看得见
    const madeInert: HTMLElement[] = []
    for (const el of [...doc.body.children]) {
      if (el === root || !(el instanceof HTMLElement) || el.dataset.layer === 'toast') continue
      if (!el.hasAttribute('inert')) {
        el.setAttribute('inert', '')
        madeInert.push(el)
      }
    }
    lockCount++
    doc.documentElement.dataset.scrollLock = ''
    stack.push(root)

    const target = optionsRef.current.initialFocus?.current ?? focusables(root)[0] ?? root
    target.focus({ preventScroll: true })

    const onKeyDown = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== root) return
      if (e.key === 'Escape') {
        if (optionsRef.current.onEscape) {
          e.preventDefault()
          optionsRef.current.onEscape()
        }
        return
      }
      if (e.key !== 'Tab') return
      // 焦点在层的边上（或在标题这种不在 Tab 顺序里的元素上）时，绕回另一端
      const items = focusables(root)
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) {
        e.preventDefault()
        return
      }
      const index = items.indexOf(doc.activeElement as HTMLElement)
      if (e.shiftKey && index <= 0) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (index === -1 || index === items.length - 1)) {
        if (index === -1 && root.contains(doc.activeElement)) return
        e.preventDefault()
        first.focus()
      }
    }
    doc.addEventListener('keydown', onKeyDown)

    return () => {
      doc.removeEventListener('keydown', onKeyDown)
      for (const el of madeInert) el.removeAttribute('inert')
      const i = stack.lastIndexOf(root)
      if (i >= 0) stack.splice(i, 1)
      lockCount = Math.max(0, lockCount - 1)
      if (lockCount === 0) delete doc.documentElement.dataset.scrollLock
      if (!trigger) return
      const restore = () => {
        if (trigger.isConnected) trigger.focus({ preventScroll: true })
      }
      restore()
      // 关闭是由层里的按钮触发的：点击的后续步骤可能又把焦点放回那个按钮，而它随退场的层一起被移除，
      // 焦点就掉到 body 上。点击结束后再看一次，焦点还在层里或在 body 上，就再还给触发者
      setTimeout(() => {
        const active = doc.activeElement
        if (!active || active === doc.body || root.contains(active)) restore()
      }, 0)
    }
  }, [active, layer])
}

/** 元素上最长的动画时长（毫秒）；jsdom 和减少动态效果时为 0 */
export function animationMs(el: Element | null): number {
  if (!el) return 0
  const style = getComputedStyle(el)
  const parse = (list: string) =>
    list
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => (s.endsWith('ms') ? Number.parseFloat(s) : Number.parseFloat(s) * 1000))
  const durations = parse(style.animationDuration)
  const delays = parse(style.animationDelay)
  let max = 0
  durations.forEach((d, i) => {
    const total = (Number.isFinite(d) ? d : 0) + (delays[i] ?? 0)
    if (total > max) max = total
  })
  return max
}

export type Presence = 'open' | 'closing' | 'closed'

/**
 * open 变 false 时先进入 closing（播退场动画），播完再卸载。
 * panel 是带退场动画的元素，用它的 animation-duration 计时
 */
export function usePresence(open: boolean, panel: RefObject<HTMLElement | null>): Presence {
  const [rendered, setRendered] = useState(open)
  // 打开在同一次渲染里生效，不等 effect，免得第一帧空着
  if (open && !rendered) setRendered(true)
  useEffect(() => {
    if (open || !rendered) return
    const id = setTimeout(() => setRendered(false), animationMs(panel.current))
    return () => clearTimeout(id)
  }, [open, rendered, panel])
  return open ? 'open' : rendered ? 'closing' : 'closed'
}
