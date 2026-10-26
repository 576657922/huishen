import { readLanguage } from '@/data/language'
import { setLanguage } from '@/lib/locale'

const language = readLanguage()
setLanguage(language)
document.documentElement.lang = language
if (language === 'ja') {
  document
    .querySelector<HTMLLinkElement>('link[rel="manifest"]')
    ?.setAttribute('href', '/manifest-ja.webmanifest')
}
// Content objects capture their translated labels at module evaluation.
// Loading after locale selection also prevents a flash of the previous language.
void import('@/app/boot').then(({ boot }) => boot())
