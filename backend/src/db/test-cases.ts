import { JudgeInput, JudgeResult } from '../lib/judge'

/**
 * Explicit qualification-judgment test cases.
 *
 * These cover the three categories required by the graduation task book:
 *   - 合格 (qualified): value inside the acceptable range
 *   - 不合格 (unqualified): value outside the range
 *   - 边界值 (boundary): value exactly on / just outside the limit
 *
 * `lowerBound` / `upperBound` of null express a one-sided limit
 * (e.g. safety items such as 泄漏电流 ≤ 0.25, 绝缘电阻 ≥ 10).
 */
export interface TestCase {
  id: string
  category: '合格' | '不合格' | '边界值'
  description: string
  input: JudgeInput
  expected: JudgeResult
}

export const JUDGMENT_TEST_CASES: TestCase[] = [
  // ---------- 合格 (qualified) ----------
  {
    id: 'PASS-01',
    category: '合格',
    description: '水温 38℃ 落在 [35,41] 区间内',
    input: { value: 38, nominal: 38, lowerBound: 35, upperBound: 41 },
    expected: { qualified: true, reason: 'ok', deviation: 0 },
  },
  {
    id: 'PASS-02',
    category: '合格',
    description: '座圈温度 35℃ 落在 [32,38] 区间内',
    input: { value: 35, nominal: 35, lowerBound: 32, upperBound: 38 },
    expected: { qualified: true, reason: 'ok', deviation: 0 },
  },
  {
    id: 'PASS-03',
    category: '合格',
    description: '绝缘电阻 25MΩ 满足 ≥10 的单边下限',
    input: { value: 25, nominal: 20, lowerBound: 10, upperBound: null },
    expected: { qualified: true, reason: 'ok', deviation: 5 },
  },
  {
    id: 'PASS-04',
    category: '合格',
    description: '泄漏电流 0.12mA 满足 ≤0.25 的单边上限',
    input: { value: 0.12, nominal: 0.15, lowerBound: null, upperBound: 0.25 },
    expected: { qualified: true, reason: 'ok', deviation: -0.03 },
  },

  // ---------- 边界值 (boundary) ----------
  {
    id: 'BND-01',
    category: '边界值',
    description: '水温恰好等于下限 35℃ 应判定合格（含边界）',
    input: { value: 35, nominal: 38, lowerBound: 35, upperBound: 41 },
    expected: { qualified: true, reason: 'ok', deviation: -3 },
  },
  {
    id: 'BND-02',
    category: '边界值',
    description: '水温恰好等于上限 41℃ 应判定合格（含边界）',
    input: { value: 41, nominal: 38, lowerBound: 35, upperBound: 41 },
    expected: { qualified: true, reason: 'ok', deviation: 3 },
  },
  {
    id: 'BND-03',
    category: '边界值',
    description: '绝缘电阻恰好等于下限 10MΩ 应判定合格',
    input: { value: 10, nominal: 20, lowerBound: 10, upperBound: null },
    expected: { qualified: true, reason: 'ok', deviation: -10 },
  },
  {
    id: 'BND-04',
    category: '边界值',
    description: '泄漏电流恰好等于上限 0.25mA 应判定合格',
    input: { value: 0.25, nominal: 0.15, lowerBound: null, upperBound: 0.25 },
    expected: { qualified: true, reason: 'ok', deviation: 0.1 },
  },

  // ---------- 不合格 (unqualified) ----------
  {
    id: 'FAIL-01',
    category: '不合格',
    description: '水温 34℃ 低于下限 35℃ 应判定不合格',
    input: { value: 34, nominal: 38, lowerBound: 35, upperBound: 41 },
    expected: { qualified: false, reason: 'below_lower', deviation: -4 },
  },
  {
    id: 'FAIL-02',
    category: '不合格',
    description: '水温 42℃ 高于上限 41℃ 应判定不合格',
    input: { value: 42, nominal: 38, lowerBound: 35, upperBound: 41 },
    expected: { qualified: false, reason: 'above_upper', deviation: 4 },
  },
  {
    id: 'FAIL-03',
    category: '不合格',
    description: '绝缘电阻 8MΩ 低于下限 10MΩ 应判定不合格',
    input: { value: 8, nominal: 20, lowerBound: 10, upperBound: null },
    expected: { qualified: false, reason: 'below_lower', deviation: -12 },
  },
  {
    id: 'FAIL-04',
    category: '不合格',
    description: '泄漏电流 0.30mA 高于上限 0.25mA 应判定不合格',
    input: { value: 0.3, nominal: 0.15, lowerBound: null, upperBound: 0.25 },
    expected: { qualified: false, reason: 'above_upper', deviation: 0.15 },
  },
  {
    id: 'FAIL-05',
    category: '不合格',
    description: '非数值测量结果应判定无效（不合格）',
    input: { value: NaN, nominal: 38, lowerBound: 35, upperBound: 41 },
    expected: { qualified: false, reason: 'invalid', deviation: null },
  },
]
