/**
 * 通过 Web Bluetooth 连接标准心率带（GATT 心率服务 0x180D）。
 * 只有桌面和安卓上的 Chrome、Edge 支持；其他浏览器（包括 iOS 上的所有浏览器）没有 navigator.bluetooth。
 * 界面先用 isBluetoothAvailable() 判断，不支持时不显示连接入口，可以改用模拟器演示。
 */
import { createEmitter } from './emitter'
import { parseHeartRateMeasurement } from './parse'
import type { DisconnectInfo, HeartRateDevice, HeartRateMeasurement } from './types'

const SERVICE = 'heart_rate'
const MEASUREMENT = 'heart_rate_measurement'
/** 设备不在附近时 gatt.connect() 可能迟迟不返回 */
const CONNECT_TIMEOUT_MS = 15000

export type HeartRateErrorCode = 'unsupported' | 'unavailable' | 'denied' | 'no-service' | 'failed'

const MESSAGES: Record<HeartRateErrorCode, string> = {
  unsupported: '这个浏览器不支持蓝牙。请在电脑或安卓手机上用 Chrome 或 Edge 打开。',
  unavailable: '蓝牙没有打开，或这台设备没有蓝牙。',
  denied: '浏览器不允许这个页面使用蓝牙。可以在浏览器的网站设置里打开。',
  'no-service': '这台设备不提供标准心率数据。请换一条支持蓝牙心率的心率带。',
  // 胸带多半要贴着皮肤才开始广播
  failed: '没有连上。请确认心率带已经戴好、就在附近，再试一次。',
}

/** 连接失败；code 供界面区分处理，message 可以直接显示 */
export class HeartRateError extends Error {
  override name = 'HeartRateError'
  readonly code: HeartRateErrorCode

  constructor(code: HeartRateErrorCode, options?: ErrorOptions) {
    super(MESSAGES[code], options)
    this.code = code
  }
}

function bluetooth(): Bluetooth | null {
  if (typeof navigator === 'undefined') return null
  return (navigator as { bluetooth?: Bluetooth }).bluetooth ?? null
}

const errorName = (e: unknown): string =>
  typeof e === 'object' && e !== null && 'name' in e && typeof e.name === 'string' ? e.name : ''

/** getAvailability() 不可用或出错时按「有」处理，交给后续步骤报告具体问题 */
async function adapterPresent(bt: Bluetooth): Promise<boolean> {
  try {
    return typeof bt.getAvailability === 'function' ? await bt.getAvailability() : true
  } catch {
    return true
  }
}

/** 浏览器支持 Web Bluetooth，且有蓝牙适配器 */
export async function isBluetoothAvailable(): Promise<boolean> {
  const bt = bluetooth()
  if (!bt) return false
  try {
    return typeof bt.getAvailability === 'function' ? await bt.getAvailability() : true
  } catch {
    return false
  }
}

/** 同名的 DOMException 在选择设备和连接两个阶段含义不同 */
function classify(e: unknown, stage: 'request' | 'connect'): HeartRateError {
  if (e instanceof HeartRateError) return e
  const name = errorName(e)
  let code: HeartRateErrorCode = 'failed'
  if (name === 'SecurityError' || name === 'NotAllowedError') code = 'denied'
  else if (name === 'NotSupportedError') code = stage === 'request' ? 'unsupported' : 'no-service'
  else if (name === 'NotFoundError' && stage === 'connect') code = 'no-service'
  return new HeartRateError(code, { cause: e })
}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout()
      reject(new HeartRateError('failed'))
    }, ms)
    p.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** 连上 GATT，订阅心率测量；失败时断开，不留半截连接 */
async function subscribe(
  device: BluetoothDevice,
  onValue: (e: Event) => void,
): Promise<BluetoothRemoteGATTCharacteristic> {
  const gatt = device.gatt
  if (!gatt) throw new HeartRateError('failed')
  let ch: BluetoothRemoteGATTCharacteristic | null = null
  try {
    const server = await withTimeout(gatt.connect(), CONNECT_TIMEOUT_MS, () => gatt.disconnect())
    const service = await server.getPrimaryService(SERVICE)
    ch = await service.getCharacteristic(MEASUREMENT)
    // 先挂监听再开通知，第一条测量不会漏掉
    ch.addEventListener('characteristicvaluechanged', onValue)
    await ch.startNotifications()
    // 开通知的同时连接断了：断开事件已经错过，通知也不会再来，只能当作没连上
    if (!gatt.connected) throw new HeartRateError('failed')
    return ch
  } catch (e) {
    ch?.removeEventListener('characteristicvaluechanged', onValue)
    gatt.disconnect()
    throw classify(e, 'connect')
  }
}

function wrap(device: BluetoothDevice): HeartRateDevice {
  const readings = createEmitter<HeartRateMeasurement>()
  const disconnects = createEmitter<DisconnectInfo>()
  let ch: BluetoothRemoteGATTCharacteristic | null = null
  let live = false
  let requested = false
  let pending: Promise<void> | null = null
  // 每次 disconnect() 加一；连接途中被取消时据此放弃
  let generation = 0

  const onValue = (e: Event): void => {
    const value = (e.target as BluetoothRemoteGATTCharacteristic | null)?.value
    if (value) readings.emit(parseHeartRateMeasurement(value))
  }

  const onGattDown = (): void => {
    // 已经重新连上时到达的旧事件，不予理会
    if (device.gatt?.connected) return
    ch?.removeEventListener('characteristicvaluechanged', onValue)
    ch = null
    if (!live) return
    live = false
    const info = { requested }
    requested = false
    disconnects.emit(info)
  }
  device.addEventListener('gattserverdisconnected', onGattDown)

  async function open(): Promise<void> {
    const gen = generation
    let next: BluetoothRemoteGATTCharacteristic
    try {
      next = await subscribe(device, onValue)
    } catch (e) {
      // 连接途中调用了 disconnect()：这次连接本来就该放弃，失败不算错误，界面不必提示
      if (gen !== generation) return
      throw e
    }
    if (gen !== generation) {
      next.removeEventListener('characteristicvaluechanged', onValue)
      device.gatt?.disconnect()
      return
    }
    ch = next
    live = true
  }

  return {
    name: device.name?.trim() || '心率带',
    get connected() {
      return live && device.gatt?.connected === true
    },
    onReading: readings.on,
    onDisconnect: disconnects.on,
    disconnect() {
      generation++
      if (!live) {
        // 正在连接时断开会中止它（connect() 以 AbortError 结束），不必等到连上或 15 秒超时
        if (pending) device.gatt?.disconnect()
        return
      }
      requested = true
      device.gatt?.disconnect()
      // 有的实现不会为主动断开派发事件；已经派发过的话，这次调用什么也不做
      onGattDown()
    },
    reconnect() {
      if (live && device.gatt?.connected) return Promise.resolve()
      pending ??= open().finally(() => {
        pending = null
      })
      return pending
    },
  }
}

/**
 * 弹出浏览器的设备选择框并连接心率带。必须在点击等用户手势里直接调用。
 * 用户关掉选择框时返回 null，这是正常结果；其他失败抛出 HeartRateError。
 */
export async function connectHeartRate(): Promise<HeartRateDevice | null> {
  const bt = bluetooth()
  if (!bt) throw new HeartRateError('unsupported')
  let device: BluetoothDevice
  try {
    // 之前不能先 await 别的事，否则浏览器会认为手势已经过期
    device = await bt.requestDevice({ filters: [{ services: [SERVICE] }] })
  } catch (e) {
    if (errorName(e) !== 'NotFoundError') throw classify(e, 'request')
    // 关掉选择框和没有蓝牙适配器报的是同一种错误
    if (await adapterPresent(bt)) return null
    throw new HeartRateError('unavailable', { cause: e })
  }
  const hr = wrap(device)
  await hr.reconnect()
  return hr
}
