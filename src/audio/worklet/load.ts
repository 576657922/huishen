/**
 * 载入限幅器的 AudioWorklet 模块。
 *
 * `?worker&url` 让 Vite 把 limiter.ts 连同它导入的 dsp 代码单独打包成一个脚本，返回它的地址：
 * 开发时是按模块提供的源文件，构建后是 assets/ 里一个不含 import 的文件，两种情况 addModule 都能载入。
 * 正式播放的 AudioContext 和离线质检的 OfflineAudioContext 载入的是同一个文件。
 */
import limiterUrl from './limiter.ts?worker&url'

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>()

/** 限幅器模块的地址（质检页面用来确认构建产物里有它） */
export const LIMITER_URL: string = limiterUrl

/** 给这个音频环境载入限幅器模块；同一个环境只载入一次。不支持 AudioWorklet 或载入失败时返回 false */
export function loadLimiter(ctx: BaseAudioContext): Promise<boolean> {
  let p = loaded.get(ctx)
  if (!p) {
    const worklet = (ctx as BaseAudioContext & { audioWorklet?: AudioWorklet }).audioWorklet
    p =
      worklet && typeof AudioWorkletNode === 'function'
        ? worklet.addModule(limiterUrl).then(
            () => true,
            () => false,
          )
        : Promise.resolve(false)
    loaded.set(ctx, p)
  }
  return p
}
