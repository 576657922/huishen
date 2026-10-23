/**
 * 心率模块的公共类型。
 * 数据来自支持标准心率服务（GATT 0x180D）的心率带，或用于演示、测试的模拟器；两者接口相同，界面不必区分。
 * 时间一律用秒，逐搏间期一律用毫秒。
 */

/** 皮肤接触状态；unsupported 表示设备不报告接触 */
export type SensorContact = 'detected' | 'not-detected' | 'unsupported'

/** 一条心率测量（特征 0x2A37），即设备的一次通知，通常每秒一次 */
export interface HeartRateMeasurement {
  /** 次/分；读不出时为 0 */
  hr: number
  /** 上一次通知以来完成的逐搏间期（毫秒），可能为空 */
  rr: number[]
  contact: SensorContact
  /** 累计消耗的能量（千焦） */
  energy?: number
}

/** 一次心搏 */
export interface Beat {
  /** 这一搏（R 波）的时刻，秒，与调用方的时钟（如练习时钟）同一基准 */
  t: number
  /** 与上一搏的间隔，毫秒 */
  rr: number
}

/**
 * 练习中心率信号的状态，供界面提示：
 * waiting：还没收到数据；no-contact：心率带报告没贴紧皮肤；
 * no-rr：设备只给心率、不给逐搏间期（多见于光学手环），能显示心率，不能算心率变异；
 * stale：几秒没有新的心搏，信号弱或连接不稳；unstable：最近伪迹偏多，心率带松了、电极干了或身体在动；
 * good：正常
 */
export type SignalStatus = 'waiting' | 'no-contact' | 'no-rr' | 'stale' | 'unstable' | 'good'

export interface DisconnectInfo {
  /** true：调用了 disconnect()；false：走远了、没电了等意外断开 */
  requested: boolean
}

/** 已连接的心率带，或模拟器 */
export interface HeartRateDevice {
  readonly name: string
  readonly connected: boolean
  /** 每收到一条测量调用一次；返回取消订阅 */
  onReading(listener: (m: HeartRateMeasurement) => void): () => void
  onDisconnect(listener: (info: DisconnectInfo) => void): () => void
  disconnect(): void
  /** 重新连接同一台设备，不再弹出选择框 */
  reconnect(): Promise<void>
}
