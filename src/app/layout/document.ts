/**
 * 页面级的两项文档属性（DESIGN.md §11、§13.1）：<html data-bars> 告诉样式这一页底部有什么条
 * （键盘焦点据此不被遮住，标签栏据此隐藏），document.title 是浏览器标签上的名字。
 */
import { useEffect, useLayoutEffect } from 'react'
import { NAV, SYSTEM } from '../strings'

/** tabs：标签栏（默认）；dock：底部停靠栏；player：播放器的控件；none：底部什么也没有 */
export type Bars = 'tabs' | 'dock' | 'player' | 'none'

/** 页面挂上时设好 <html data-bars>，离开时去掉（没有这个属性就按 tabs 处理） */
export function useDocumentBars(bars: Bars): void {
  useLayoutEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-bars', bars)
    return () => {
      if (root.getAttribute('data-bars') === bars) root.removeAttribute('data-bars')
    }
  }, [bars])
}

/** 「今日 · 回神」；null 时只写「回神」（首次使用页） */
export function documentTitle(page: string | null): string {
  return page ? SYSTEM.documentTitle(page) : NAV.wordmark
}

export function useDocumentTitle(page: string | null): void {
  useEffect(() => {
    document.title = documentTitle(page)
  }, [page])
}
