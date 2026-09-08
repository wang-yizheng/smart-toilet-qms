import { judgeMeasurement, aggregateResult } from '../lib/judge'
import { JUDGMENT_TEST_CASES } from '../db/test-cases'

describe('judgeMeasurement — 合格/不合格/边界值判定', () => {
  it.each(JUDGMENT_TEST_CASES)('$id $category: $description', (tc) => {
    const got = judgeMeasurement(tc.input)
    expect(got.qualified).toBe(tc.expected.qualified)
    expect(got.reason).toBe(tc.expected.reason)
    if (tc.expected.deviation === null) {
      expect(got.deviation).toBeNull()
    } else {
      expect(got.deviation).toBeCloseTo(tc.expected.deviation, 4)
    }
  })

  it('边界值：恰在下限之外（34.99）判定不合格', () => {
    const r = judgeMeasurement({ value: 34.99, nominal: 38, lowerBound: 35, upperBound: 41 })
    expect(r.qualified).toBe(false)
    expect(r.reason).toBe('below_lower')
  })

  it('边界值：恰在上限之外（41.01）判定不合格', () => {
    const r = judgeMeasurement({ value: 41.01, nominal: 38, lowerBound: 35, upperBound: 41 })
    expect(r.qualified).toBe(false)
    expect(r.reason).toBe('above_upper')
  })

  it('单边下限：高于下限即合格', () => {
    expect(judgeMeasurement({ value: 999, nominal: 20, lowerBound: 10, upperBound: null }).qualified).toBe(true)
  })

  it('单边上限：低于上限即合格', () => {
    expect(judgeMeasurement({ value: 0.01, nominal: 0.15, lowerBound: null, upperBound: 0.25 }).qualified).toBe(true)
  })
})

describe('aggregateResult — 整条记录综合判定', () => {
  it('全部合格 => pass', () => {
    expect(aggregateResult([true, true, true])).toBe('pass')
  })
  it('任一项不合格 => fail', () => {
    expect(aggregateResult([true, false, true])).toBe('fail')
  })
  it('无检测项 => pending', () => {
    expect(aggregateResult([])).toBe('pending')
  })
})
