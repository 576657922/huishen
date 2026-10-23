import { useEffect, useRef, useState } from 'react'
import { getController } from '@/app/services'
import { PACE_FINDER } from '@/content/copy'
import type { SessionRecord } from '@/data'
import type { SessionResult } from '@/engine'
import {
  connectHeartRate,
  createBeatTracker,
  createSimulatedHeartRate,
  type HeartRateDevice,
  HeartRateError,
  isBluetoothAvailable,
  type SignalStatus,
  summarizeHrv,
} from '@/hrv'

type Metrics = NonNullable<SessionRecord['hrv']>
const average = (values: (number | undefined)[]): number | undefined => {
  const valid = values.filter((n): n is number => n !== undefined && Number.isFinite(n))
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : undefined
}
export function useStrap() {
  const demo = import.meta.env.DEV && new URLSearchParams(location.search).get('hrv') === 'demo'
  const [available, setAvailable] = useState(demo),
    [device, setDevice] = useState<HeartRateDevice | null>(null),
    [connected, setConnected] = useState(false),
    [connecting, setConnecting] = useState(false),
    [error, setError] = useState(''),
    [hr, setHr] = useState<number | null>(null),
    [signal, setSignal] = useState<SignalStatus>('waiting')
  const tracker = useRef(createBeatTracker()),
    readings = useRef<number[]>([]),
    metrics = useRef<Metrics[]>([]),
    deviceRef = useRef<HeartRateDevice | null>(null),
    live = useRef(true)
  useEffect(() => {
    live.current = true
    void isBluetoothAvailable().then(ok => {
      if (live.current) setAvailable(ok || demo)
    })
    return () => {
      live.current = false
      deviceRef.current?.disconnect()
    }
  }, [demo])
  useEffect(() => {
    if (!device) return
    const off = device.onReading(m => {
      if (!live.current) return
      setHr(m.hr > 0 ? m.hr : null)
      const ctrl = getController()
      if (ctrl.getState().plan?.practiceId === 'pace-finder' && ctrl.getState().status === 'running') {
        tracker.current.push(m, ctrl.time())
        if (m.hr > 0 && m.contact !== 'not-detected') readings.current.push(m.hr)
        setSignal(tracker.current.status(ctrl.time()))
      }
    })
    const disconnected = device.onDisconnect(() => {
      if (live.current) setConnected(false)
    })
    return () => {
      off()
      disconnected()
    }
  }, [device])
  const connect = (): void => {
    if (connecting) return
    setConnecting(true)
    setError('')
    const request = demo
      ? Promise.resolve(createSimulatedHeartRate({ name: PACE_FINDER.strapInfo.demo }))
      : connectHeartRate()
    void request
      .then(next => {
        if (!live.current) {
          next?.disconnect()
          return
        }
        if (next) {
          deviceRef.current?.disconnect()
          deviceRef.current = next
          setDevice(next)
          setConnected(true)
        }
      })
      .catch((e: unknown) => {
        if (live.current)
          setError(PACE_FINDER.strapInfo.errors[e instanceof HeartRateError ? e.code : 'failed'])
      })
      .finally(() => {
        if (live.current) setConnecting(false)
      })
  }
  const reconnect = (): void => {
    setConnecting(true)
    void device
      ?.reconnect()
      .then(() => {
        if (!live.current) {
          device?.disconnect()
          return
        }
        if (live.current) {
          setConnected(true)
          setError('')
        }
      })
      .catch(() => {
        if (live.current) setError(PACE_FINDER.strapInfo.errors.failed)
      })
      .finally(() => {
        if (live.current) setConnecting(false)
      })
  }
  const reset = (): void => {
    tracker.current.reset()
    readings.current = []
    setSignal('waiting')
  }
  const summarize = (result: SessionResult): Metrics => {
    const summary = summarizeHrv(
      tracker.current.beats(),
      result.plan.pattern ? { pattern: result.plan.pattern, t0: 0 } : undefined,
    )
    const value: Metrics = {}
    const mean = Number.isFinite(summary.meanHr) ? summary.meanHr : average(readings.current)
    if (mean !== undefined) value.meanHr = mean
    if (Number.isFinite(summary.rmssd)) value.rmssd = summary.rmssd
    if (Number.isFinite(summary.amplitude)) value.amplitude = summary.amplitude
    if (Object.keys(value).length) metrics.current.push(value)
    return value
  }
  const combined = (): Metrics | undefined => {
    const summary: Metrics = {}
    for (const key of ['meanHr', 'rmssd', 'amplitude'] as const) {
      const value = average(metrics.current.map(m => m[key]))
      if (value !== undefined) summary[key] = value
    }
    return Object.keys(summary).length ? summary : undefined
  }
  return {
    available,
    device,
    connected,
    connecting,
    error,
    hr,
    signal,
    connect,
    reconnect,
    reset,
    summarize,
    combined,
    clear: () => {
      metrics.current = []
    },
    disconnect: () => device?.disconnect(),
  }
}
