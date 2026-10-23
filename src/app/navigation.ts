/**
 * 不在组件里的跳转（startPractice 这类在点击处理里调用的流程）。路由建好后把它的 navigate 接进来；
 * 流程模块因此不必引用路由本身，也就不会和懒加载的页面形成循环依赖。测试里可以换成假的。
 */
export interface NavigateOptions {
  replace?: boolean
  state?: unknown
}

export type Navigate = (to: string, options?: NavigateOptions) => void

let impl: Navigate | null = null

export function setNavigate(fn: Navigate | null): void {
  impl = fn
}

/** 应用内跳转；路由还没接上时退回整页跳转 */
export function navigate(to: string, options: NavigateOptions = {}): void {
  if (impl) impl(to, options)
  else if (options.replace) window.location.replace(to)
  else window.location.assign(to)
}

/** 当前路径（不含查询和锚点） */
export const currentPath = (): string => window.location.pathname
