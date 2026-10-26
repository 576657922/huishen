/** Locale is selected before application modules load; changing it starts a fresh UI. */
export type Language = 'zh-CN' | 'ja'
let language: Language = 'zh-CN'
export const getLanguage = (): Language => language
export function setLanguage(value: Language): void {
  language = value
}
export function interpolate(text: string, values: readonly unknown[]): string {
  return text.replace(/\{(\d+)\}/g, (match, index: string) =>
    Number(index) < values.length ? String(values[Number(index)]) : match,
  )
}
