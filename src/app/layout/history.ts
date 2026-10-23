/**
 * 应用内的上一个地址：返回按钮据此判断能不能直接用浏览器后退（后退时上一页的滚动位置会恢复）。
 */
let current: string | null = null
let previous: string | null = null

/** 每次换页时调用（根布局里） */
export function trackPath(pathname: string): void {
  if (pathname === current) return
  previous = current
  current = pathname
}

/** 上一个页面的路径；刚打开应用时为 null */
export const previousPath = (): string | null => previous
