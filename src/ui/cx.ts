/** 拼接 className：跳过 false、null、undefined 和空字符串 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
