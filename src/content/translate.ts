import { getLanguage, interpolate } from '@/lib/locale'

/** Each domain owns its bundled translations, keeping evidence and guides lazy. */
export function createTranslator<T extends Readonly<Record<string, string>>>(japanese: T) {
  return (source: keyof T & string, ...values: readonly unknown[]): string =>
    interpolate(getLanguage() === 'ja' ? (japanese[source] ?? source) : source, values)
}
