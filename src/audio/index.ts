/**
 * 声音层的入口。应用在第一次用户手势里建一个引擎；v1 没有语音引导（PRODUCT §0），
 * setDuck 留给以后的真人录音。
 *
 * @example
 * const audio = createAudioEngine()
 * audio.warm({ ambience: 'stream', music: 'drone' })
 */
export { type AudioEngineOptions, createAudioEngine } from './engine'
export { AMBIENCE_IDS, MUSIC_IDS } from './layers'
export { volumeGain } from './levels'
export type * from './types'
