/** User-entered reminder fields stay as written; only the surrounding grammar changes. */
export const CALENDAR_COPY = {
  sentence(cue: string, action: string, fallback: string): string {
    const main = `${cue.trim() ? `${cue.trim()}、` : ''}${action.trim() || '練習'}を行います。`
    return fallback.trim() ? `${main}疲れていたら、${fallback.trim()}だけにします。` : main
  },
}
