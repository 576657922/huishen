/**
 * 粉噪声、棕噪声：一段平稳的循环，不随呼吸、不起伏——它们的用处是遮蔽断断续续的环境噪音，越稳越好。
 */
import { createCore, type LayerFactory, noHold, noMode } from './core'

export function noiseLayer(name: 'pink' | 'brown'): LayerFactory {
  return (ctx, dest, bufs, opts) => {
    const core = createCore(ctx, dest, opts)
    return {
      start(at) {
        core.loop(bufs(name), core.out, at, opts.rng)
      },
      schedule() {},
      breath() {},
      freeRun() {},
      level() {},
      hold: noHold,
      setMode: noMode,
      stop: core.stop,
      dispose: core.dispose,
    }
  }
}
