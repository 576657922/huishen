import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadFile, MIME } from '@/data'
import { makeRecord } from '@/data/fixtures'
import { exportRecords, weeklyRatings } from './export'

vi.mock('@/data', async original => ({
  ...(await original<typeof import('@/data')>()),
  downloadFile: vi.fn(),
}))
afterEach(() => vi.mocked(downloadFile).mockClear())
describe('records exports', () => {
  it('preserves every record field and weekly stress in the JSON backup', () => {
    const record = makeRecord({ note: '测试备注。', marks: [10, 20], checkin: { pre: 6, post: 4 } })
    exportRecords('json', [record], [{ date: '2026-10-22', score: 3 }])
    const call = vi.mocked(downloadFile).mock.calls[0]!
    expect(call[1]).toBe(MIME.json)
    expect(JSON.parse(call[2])).toMatchObject({
      records: [record],
      weeklyStress: [{ week: '2026-W43', answeredAt: '2026-10-22', score: 3 }],
    })
  })
  it('uses a separate CSV for weekly ratings and one point per week', () => {
    const ratings = [
      { date: '2026-10-20', score: 5 },
      { date: '2026-10-22', score: 3 },
    ]
    expect(weeklyRatings(ratings)).toEqual([ratings[1]])
    expect(weeklyRatings([...ratings].reverse())).toEqual([ratings[1]])
    exportRecords('csv', [makeRecord()], ratings)
    expect(downloadFile).toHaveBeenCalledTimes(2)
    expect(vi.mocked(downloadFile).mock.calls[1]?.[2]).toContain('2026-W43,2026-10-22,3')
  })
})
