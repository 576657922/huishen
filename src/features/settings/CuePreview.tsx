import { useCallback, useEffect, useRef, useState } from 'react'
import { getAudio, peekAudio } from '@/app/services'
import type { Scheduled } from '@/audio/types'
import { PLAYER, SETTINGS } from '@/content/copy'
import { usePrefs } from '@/data'
import { buildPattern, type CueStyle } from '@/engine'
import { Button, useToast } from '@/ui'
export function CuePreview({ style }: { style: CueStyle }) {
  const [playing, setPlaying] = useState(false)
  const mix = usePrefs(s => s.sounds.relax)
  const handles = useRef<Scheduled[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const token = useRef(0)
  const ownsBed = useRef(false)
  const toast = useToast()
  const stop = useCallback((): void => {
    token.current++
    if (timer.current) clearTimeout(timer.current)
    for (const handle of handles.current) handle.cancel()
    handles.current = []
    if (ownsBed.current) peekAudio()?.stopBed(0.3)
    ownsBed.current = false
    setPlaying(false)
  }, [])
  useEffect(() => {
    void style
    return stop
  }, [style, stop])
  const preview = (): void => {
    if (playing) {
      stop()
      return
    }
    stop()
    const id = ++token.current
    setPlaying(true)
    const audio = getAudio()
    void audio
      .unlock()
      .then(ok => {
        if (id !== token.current) return
        if (!ok) {
          setPlaying(false)
          toast.show({ message: PLAYER.notices.audioBlocked })
          return
        }
        const pattern = buildPattern({ type: 'resonance', rate: 6, ratio: 'long' })
        const at = audio.now() + 0.08
        audio.startBed(mix, at, 0.3, 11)
        ownsBed.current = true
        audio.fadeBedOut(at + 10.7, 0.3)
        if (style === 'off') audio.freeRun(at + 11)
        if (style !== 'off')
          for (const seg of pattern.segs) {
            audio.breath(seg, at + seg.t0)
            if (style === 'glide') handles.current.push(audio.glide(seg, at + seg.t0))
            else if (style === 'ping') handles.current.push(audio.cue(seg.key, at + seg.t0))
          }
        timer.current = setTimeout(stop, 11000)
      })
      .catch(() => {
        if (id !== token.current) return
        setPlaying(false)
        toast.show({ message: PLAYER.notices.audioBlocked })
      })
  }
  return (
    <Button variant="quiet" icon={playing ? 'end' : 'sound'} aria-pressed={playing} onClick={preview}>
      {playing ? SETTINGS.actions.stopPreview : SETTINGS.actions.preview}
    </Button>
  )
}
