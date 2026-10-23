/**
 * 解析蓝牙心率测量（GATT 特征 0x2A37），格式见 Bluetooth SIG《Heart Rate Service》。
 * 第 1 字节是标志位，之后依次是心率、累计能量（可选）、若干逐搏间期（可选），全部小端。
 */
import type { HeartRateMeasurement, SensorContact } from './types'

const HR_UINT16 = 0x01
const CONTACT_DETECTED = 0x02
const CONTACT_SUPPORTED = 0x04
const ENERGY_PRESENT = 0x08
const RR_PRESENT = 0x10

/** RR 的单位是 1/1024 秒 */
const RR_UNIT_MS = 1000 / 1024

function contactOf(flags: number): SensorContact {
  // 「已接触」位只有在「支持接触检测」位置 1 时才有意义
  if (!(flags & CONTACT_SUPPORTED)) return 'unsupported'
  return flags & CONTACT_DETECTED ? 'detected' : 'not-detected'
}

/**
 * 不会抛错：蓝牙包偶尔不完整，读到哪里算哪里。
 * 心率字段不完整时 hr 为 0，与设备没贴紧时报 0 的习惯一致。
 */
export function parseHeartRateMeasurement(view: DataView): HeartRateMeasurement {
  const size = view.byteLength
  if (size < 1) return { hr: 0, rr: [], contact: 'unsupported' }
  const flags = view.getUint8(0)
  const contact = contactOf(flags)
  const hrBytes = flags & HR_UINT16 ? 2 : 1
  if (size < 1 + hrBytes) return { hr: 0, rr: [], contact }

  const out: HeartRateMeasurement = {
    hr: hrBytes === 2 ? view.getUint16(1, true) : view.getUint8(1),
    rr: [],
    contact,
  }
  let at = 1 + hrBytes
  if (flags & ENERGY_PRESENT) {
    // 能量字段不完整时，后面 RR 的位置也无从确定
    if (size < at + 2) return out
    out.energy = view.getUint16(at, true)
    at += 2
  }
  if (flags & RR_PRESENT) {
    for (; at + 2 <= size; at += 2) out.rr.push(view.getUint16(at, true) * RR_UNIT_MS)
  }
  return out
}
