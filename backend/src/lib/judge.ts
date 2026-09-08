/**
 * Core qualification judgment logic for the Smart Toilet Detection Management System.
 *
 * Each detection item defines an acceptable range via `lowerBound` and `upperBound`.
 * Either bound may be `null` to express a one-sided limit:
 *   - lowerBound = null  => only an upper limit matters (e.g. 泄漏电流 ≤ 0.25 mA)
 *   - upperBound = null  => only a lower limit matters (e.g. 绝缘电阻 ≥ 10 MΩ)
 *
 * A measured value is qualified when:
 *   (lowerBound == null || value >= lowerBound) && (upperBound == null || value <= upperBound)
 *
 * This module is pure and side-effect free so it can be unit tested in isolation.
 */

export type JudgeReason = 'ok' | 'below_lower' | 'above_upper' | 'invalid'

export interface JudgeInput {
  /** The measured value */
  value: number
  /** Nominal / target value (used for deviation display only) */
  nominal: number | null
  /** Inclusive lower acceptable bound, or null if unbounded */
  lowerBound: number | null
  /** Inclusive upper acceptable bound, or null if unbounded */
  upperBound: number | null
}

export interface JudgeResult {
  qualified: boolean
  reason: JudgeReason
  /** value - nominal, null when nominal is null */
  deviation: number | null
}

export function judgeMeasurement(input: JudgeInput): JudgeResult {
  const { value, nominal, lowerBound, upperBound } = input

  if (typeof value !== 'number' || Number.isNaN(value)) {
    return { qualified: false, reason: 'invalid', deviation: null }
  }

  if (lowerBound != null && value < lowerBound) {
    return { qualified: false, reason: 'below_lower', deviation: nominal != null ? round(value - nominal) : null }
  }
  if (upperBound != null && value > upperBound) {
    return { qualified: false, reason: 'above_upper', deviation: nominal != null ? round(value - nominal) : null }
  }

  return { qualified: true, reason: 'ok', deviation: nominal != null ? round(value - nominal) : null }
}

/**
 * Aggregate a list of per-item qualification booleans into an overall record verdict.
 * A record passes only when every measured item is qualified.
 */
export function aggregateResult(itemQualified: boolean[]): 'pass' | 'fail' | 'pending' {
  if (itemQualified.length === 0) return 'pending'
  if (itemQualified.every(Boolean)) return 'pass'
  return 'fail'
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000
}
