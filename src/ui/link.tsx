import type { AnchorHTMLAttributes, Ref } from 'react'
import { Link, useInRouterContext } from 'react-router'

export interface AppLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string
  ref?: Ref<HTMLAnchorElement>
}

/** 带协议的地址（https:、tel:、mailto:）和页内锚点不走路由 */
const OUTSIDE_ROUTER = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i

/**
 * 应用内链接：在路由里用 <Link>（不整页刷新），不在路由里（组件测试、组件目录页）退回普通 <a>，
 * 这样同一个组件在哪里都能渲染
 */
export function AppLink({ to, ref, ...rest }: AppLinkProps) {
  const inRouter = useInRouterContext()
  if (inRouter && !OUTSIDE_ROUTER.test(to)) return <Link to={to} ref={ref} {...rest} />
  return <a href={to} ref={ref} {...rest} />
}
