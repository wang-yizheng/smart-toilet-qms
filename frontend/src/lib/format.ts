// Numeric coercion (Postgres returns NUMERIC as string)
export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export function fmtNum(v: unknown, digits = 2): string {
  const n = toNum(v)
  return n === null ? '-' : n.toFixed(digits)
}

export function fmtDateTime(v?: string | null): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleString('zh-CN', { hour12: false })
}

export function fmtDate(v?: string | null): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString('zh-CN')
}

// Result badge styles
export function resultVariant(result: string): 'default' | 'success' | 'destructive' | 'warning' {
  switch (result) {
    case 'pass':
      return 'success'
    case 'fail':
      return 'destructive'
    case 'pending':
      return 'warning'
    default:
      return 'default'
  }
}

export function resultLabel(result: string): string {
  return { pass: '合格', fail: '不合格', pending: '待判定' }[result] ?? result
}

export function taskStatusVariant(status: string): 'default' | 'secondary' | 'success' | 'destructive' | 'warning' {
  switch (status) {
    case '已完成':
      return 'success'
    case '已终止':
      return 'destructive'
    case '待审核':
      return 'warning'
    case '检测中':
    case '待检测':
      return 'secondary'
    default:
      return 'default'
  }
}

export function ncStatusVariant(status: string): 'default' | 'secondary' | 'success' | 'destructive' {
  switch (status) {
    case '已闭环':
      return 'success'
    case '审批中':
      return 'warning'
    default:
      return 'destructive'
  }
}
