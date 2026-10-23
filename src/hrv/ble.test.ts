import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectHeartRate, HeartRateError, isBluetoothAvailable } from './ble'
import type { DisconnectInfo, HeartRateMeasurement } from './types'

class FakeCharacteristic extends EventTarget {
  value: DataView | undefined
  startNotifications = vi.fn(async () => this)

  send(...bytes: number[]): void {
    this.value = new DataView(Uint8Array.from(bytes).buffer)
    this.dispatchEvent(new Event('characteristicvaluechanged'))
  }
}

class FakeDevice extends EventTarget {
  name: string | undefined = 'Polar H10 7A3B2C1D'
  characteristic = new FakeCharacteristic()
  /** 设为错误时，取心率服务失败 */
  serviceError: Error | null = null
  /** 为 true 时 connect() 一直不返回，直到 disconnect() 中止它（与浏览器一致） */
  hang = false
  abortConnect: ((e: unknown) => void) | null = null
  gatt = {
    connected: false,
    connect: vi.fn(() => {
      if (this.hang)
        return new Promise<never>((_, reject) => {
          this.abortConnect = reject
        })
      this.gatt.connected = true
      return Promise.resolve(this.gatt)
    }),
    disconnect: vi.fn(() => {
      this.abortConnect?.(domError('AbortError'))
      this.abortConnect = null
      if (!this.gatt.connected) return
      this.gatt.connected = false
      this.dispatchEvent(new Event('gattserverdisconnected'))
    }),
    getPrimaryService: vi.fn(async (uuid: string) => {
      if (this.serviceError) throw this.serviceError
      expect(uuid).toBe('heart_rate')
      this.characteristic = new FakeCharacteristic()
      return {
        getCharacteristic: async (name: string) => {
          expect(name).toBe('heart_rate_measurement')
          return this.characteristic
        },
      }
    }),
  }

  /** 信号中断 */
  drop(): void {
    this.gatt.connected = false
    this.dispatchEvent(new Event('gattserverdisconnected'))
  }
}

let device: FakeDevice
let requestDevice: ReturnType<typeof vi.fn>
let getAvailability: ReturnType<typeof vi.fn>

function installBluetooth(): void {
  requestDevice = vi.fn(async () => device)
  getAvailability = vi.fn(async () => true)
  Object.defineProperty(navigator, 'bluetooth', {
    configurable: true,
    value: { requestDevice, getAvailability },
  })
}

function removeBluetooth(): void {
  Reflect.deleteProperty(navigator, 'bluetooth')
}

const domError = (name: string) => new DOMException(name, name)

async function connected() {
  const hr = await connectHeartRate()
  if (!hr) throw new Error('expected a device')
  return hr
}

beforeEach(() => {
  device = new FakeDevice()
  installBluetooth()
})

afterEach(() => {
  removeBluetooth()
  vi.useRealTimers()
})

describe('feature detection', () => {
  it('reports no Bluetooth when the browser lacks Web Bluetooth', async () => {
    removeBluetooth()
    expect(await isBluetoothAvailable()).toBe(false)
    await expect(connectHeartRate()).rejects.toMatchObject({ code: 'unsupported' })
  })

  it('asks the browser whether an adapter is present', async () => {
    expect(await isBluetoothAvailable()).toBe(true)
    getAvailability.mockResolvedValue(false)
    expect(await isBluetoothAvailable()).toBe(false)
    getAvailability.mockRejectedValue(new Error('boom'))
    expect(await isBluetoothAvailable()).toBe(false)
  })
})

describe('connecting', () => {
  it('asks only for heart-rate devices and streams parsed measurements', async () => {
    const hr = await connected()
    expect(requestDevice).toHaveBeenCalledWith({ filters: [{ services: ['heart_rate'] }] })
    expect(hr.name).toBe('Polar H10 7A3B2C1D')
    expect(hr.connected).toBe(true)
    expect(device.characteristic.startNotifications).toHaveBeenCalledOnce()

    const got: HeartRateMeasurement[] = []
    const off = hr.onReading(m => got.push(m))
    device.characteristic.send(0x16, 62, 0x00, 0x04)
    expect(got).toEqual([{ hr: 62, rr: [1000], contact: 'detected' }])
    off()
    device.characteristic.send(0x16, 63, 0x00, 0x04)
    expect(got).toHaveLength(1)
  })

  it('names unnamed devices', async () => {
    device.name = undefined
    expect((await connected()).name).toBe('心率带')
  })

  it('treats closing the chooser as a normal outcome', async () => {
    requestDevice.mockRejectedValue(domError('NotFoundError'))
    await expect(connectHeartRate()).resolves.toBeNull()
  })

  it('explains a missing adapter, a refused permission and other failures', async () => {
    requestDevice.mockRejectedValue(domError('NotFoundError'))
    getAvailability.mockResolvedValue(false)
    await expect(connectHeartRate()).rejects.toMatchObject({ code: 'unavailable' })

    requestDevice.mockRejectedValue(domError('SecurityError'))
    const denied = await connectHeartRate().catch((e: unknown) => e)
    expect(denied).toBeInstanceOf(HeartRateError)
    expect(denied).toMatchObject({ code: 'denied', name: 'HeartRateError' })
    expect((denied as HeartRateError).message).toMatch(/蓝牙/)
    expect((denied as HeartRateError).cause).toBeInstanceOf(DOMException)

    requestDevice.mockRejectedValue(new TypeError('bad options'))
    await expect(connectHeartRate()).rejects.toMatchObject({ code: 'failed' })
  })

  it('rejects devices without the heart-rate service and leaves them disconnected', async () => {
    device.serviceError = domError('NotFoundError')
    await expect(connectHeartRate()).rejects.toMatchObject({ code: 'no-service' })
    expect(device.gatt.connected).toBe(false)
  })

  it('fails cleanly when the link drops while notifications are starting', async () => {
    const getService = device.gatt.getPrimaryService.getMockImplementation()!
    device.gatt.getPrimaryService.mockImplementationOnce(async (uuid: string) => {
      const service = await getService(uuid)
      const ch = device.characteristic
      ch.startNotifications.mockImplementation(async () => {
        device.drop()
        return ch
      })
      vi.spyOn(ch, 'removeEventListener')
      return service
    })
    await expect(connectHeartRate()).rejects.toMatchObject({ code: 'failed' })
    expect(device.gatt.connected).toBe(false)
    // 不留下收听死连接的监听
    expect(device.characteristic.removeEventListener).toHaveBeenCalledWith(
      'characteristicvaluechanged',
      expect.any(Function),
    )
  })

  it('gives up on a connection that never completes', async () => {
    vi.useFakeTimers()
    device.hang = true
    const attempt = connectHeartRate().catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(15000)
    expect(await attempt).toMatchObject({ code: 'failed' })
    expect(device.gatt.disconnect).toHaveBeenCalled()
  })
})

describe('staying connected', () => {
  it('reports an unexpected disconnect and reconnects without the chooser', async () => {
    const hr = await connected()
    const events: DisconnectInfo[] = []
    const got: HeartRateMeasurement[] = []
    hr.onDisconnect(info => events.push(info))
    hr.onReading(m => got.push(m))

    const before = device.characteristic
    device.drop()
    expect(events).toEqual([{ requested: false }])
    expect(hr.connected).toBe(false)
    before.send(0x00, 70)
    expect(got).toEqual([])

    await hr.reconnect()
    expect(requestDevice).toHaveBeenCalledOnce()
    expect(hr.connected).toBe(true)
    device.characteristic.send(0x00, 71)
    // 旧的特征值不再派发，新的只派发一次
    before.send(0x00, 72)
    expect(got.map(m => m.hr)).toEqual([71])
  })

  it('reports a requested disconnect once', async () => {
    const hr = await connected()
    const events: DisconnectInfo[] = []
    hr.onDisconnect(info => events.push(info))
    hr.disconnect()
    hr.disconnect()
    expect(events).toEqual([{ requested: true }])
    expect(hr.connected).toBe(false)
    device.drop()
    expect(events).toHaveLength(1)
  })

  it('shares one attempt between overlapping reconnect calls', async () => {
    const hr = await connected()
    device.drop()
    device.gatt.connect.mockClear()
    await Promise.all([hr.reconnect(), hr.reconnect()])
    expect(device.gatt.connect).toHaveBeenCalledOnce()
    await hr.reconnect()
    expect(device.gatt.connect).toHaveBeenCalledOnce()
  })

  it('abandons a reconnect when disconnect() is called meanwhile', async () => {
    const hr = await connected()
    device.drop()
    const attempt = hr.reconnect()
    hr.disconnect()
    await attempt
    expect(hr.connected).toBe(false)
    expect(device.gatt.connected).toBe(false)
  })

  it('aborts a hanging reconnect at once when disconnect() is called, without reporting an error', async () => {
    vi.useFakeTimers()
    const hr = await connected()
    device.drop()
    device.hang = true
    const attempt = hr.reconnect()
    hr.disconnect()
    await expect(attempt).resolves.toBeUndefined()
    expect(hr.connected).toBe(false)
    // 连接超时的计时器也已撤销
    expect(vi.getTimerCount()).toBe(0)
    // 之后仍可以重新连接
    device.hang = false
    await hr.reconnect()
    expect(hr.connected).toBe(true)
  })

  it('surfaces a failed reconnect as a HeartRateError', async () => {
    const hr = await connected()
    device.drop()
    device.gatt.connect.mockRejectedValueOnce(domError('NetworkError'))
    await expect(hr.reconnect()).rejects.toMatchObject({ code: 'failed' })
    await hr.reconnect()
    expect(hr.connected).toBe(true)
  })
})
