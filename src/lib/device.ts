/** iPad 的桌面模式仍会在锁屏或切到别的应用后停止网页声音。 */
export function isIOSDevice(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}
