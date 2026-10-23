/**
 * 声音的选择：记成以后的默认，练习中马上用上。
 * 听声音记在设置里这个模式的默认组合（prefs.sounds[mode]）；其他练习的声景、音乐记在这项练习自己的设置里，
 * 音量是全应用的一组（prefs.volume，与设置页的音量相同）。
 */
import type { SoundMix } from '@/audio/types'
import { type CatalogPracticeId, isCatalogPracticeId, PRACTICE_BY_ID, soundModeOf } from '@/content/practices'
import { type PracticePrefs, prefsStore } from '@/data'
import { getController } from '../services'

type SoundPatch = Partial<Omit<SoundMix, 'mode'>>

/** 把这项练习的声音选择记下来，下次打开还是这样 */
export function rememberSound(practiceId: CatalogPracticeId, mix: Partial<SoundMix>): void {
  const prefs = prefsStore.getState()
  const patch: SoundPatch = {}
  if (mix.ambience !== undefined) patch.ambience = mix.ambience
  if (mix.music !== undefined) patch.music = mix.music
  if (mix.ambienceVolume !== undefined) patch.ambienceVolume = mix.ambienceVolume
  if (mix.musicVolume !== undefined) patch.musicVolume = mix.musicVolume
  if (PRACTICE_BY_ID[practiceId].kind === 'sound') {
    prefs.set({ sounds: soundModeOf(practiceId) === 'sleep' ? { sleep: patch } : { relax: patch } })
    return
  }
  const own: PracticePrefs = {}
  if (patch.ambience !== undefined) own.ambience = patch.ambience
  if (patch.music !== undefined) own.music = patch.music
  if (own.ambience !== undefined || own.music !== undefined) prefs.setPractice(practiceId, own)
  if (patch.ambienceVolume !== undefined) prefs.setVolume('ambience', patch.ambienceVolume)
  if (patch.musicVolume !== undefined) prefs.setVolume('music', patch.musicVolume)
}

/** 练习中在「声音」面板里换声音或音量：马上用上，并记成这项练习以后的默认 */
export function changeSessionSound(mix: Partial<SoundMix>): void {
  const ctrl = getController()
  const id = ctrl.getState().plan?.practiceId
  if (!id || !isCatalogPracticeId(id)) return
  ctrl.setSound(mix)
  rememberSound(id, mix)
}

/** 提示音与钟声的音量（播放器声音面板的第三个滑块），0–100；偏好会同步给声音引擎 */
export function setCueVolume(volume: number): void {
  prefsStore.getState().setVolume('cues', volume)
}
