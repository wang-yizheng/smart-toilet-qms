import { query } from '../config/db'

/**
 * Insert a notification, skipping duplicates for the same target within 24h
 * so a periodic scan does not spam the user.
 */
async function notify(
  userId: number,
  type: string,
  title: string,
  content: string,
  refType: string,
  refId: number | null
) {
  const dup = await query(
    `SELECT id FROM notifications
     WHERE user_id = $1 AND type = $2 AND ref_type = $3
       AND ref_id IS NOT DISTINCT FROM $4
       AND created_at > now() - interval '24 hours'`,
    [userId, type, refType, refId]
  )
  if (dup.length) return false
  await query(
    `INSERT INTO notifications (user_id, type, title, content, ref_type, ref_id)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, type, title, content, refType, refId]
  )
  return true
}

/**
 * Scan for overdue tasks, records pending review and open nonconforming items,
 * then push in-app reminders to the people responsible.
 */
export async function scanReminders() {
  const managers = await query(
    `SELECT id FROM users WHERE role IN ('admin','qc_manager') AND status = 'active'`
  )

  // 1) tasks past their due date that are not finished or cancelled
  const overdue = await query(`
    SELECT t.id, t.task_no, t.due_date, t.assignee_id, p.model
    FROM tasks t LEFT JOIN products p ON t.product_id = p.id
    WHERE t.due_date IS NOT NULL
      AND t.due_date < CURRENT_DATE
      AND t.status NOT IN ('已完成','已终止')
  `)
  for (const t of overdue) {
    const due = t.due_date ? String(t.due_date).slice(0, 10) : '-'
    const text = `任务 ${t.task_no}（${t.model ?? '-'}）计划完成日期 ${due} 已超期，请及时处理。`
    if (t.assignee_id) await notify(t.assignee_id, 'task_overdue', '任务超期提醒', text, 'task', t.id)
    for (const m of managers) await notify(m.id, 'task_overdue', '任务超期提醒', text, 'task', t.id)
  }

  // 2) records waiting for review for more than 2 days
  const pending = await query(
    `SELECT count(*)::int AS cnt FROM records WHERE status = '待审核' AND detected_at < now() - interval '2 days'`
  )
  if (pending[0]?.cnt > 0) {
    for (const m of managers) {
      await notify(
        m.id,
        'review_pending',
        '待审核记录提醒',
        `当前有 ${pending[0].cnt} 条检测记录等待审核超过 2 天，请尽快复核。`,
        'record',
        null
      )
    }
  }

  // 3) nonconforming items still open
  const openNc = await query(`SELECT count(*)::int AS cnt FROM nonconforming WHERE status <> '已闭环'`)
  if (openNc[0]?.cnt > 0) {
    for (const m of managers) {
      await notify(
        m.id,
        'nc_open',
        '不合格品待处置',
        `当前有 ${openNc[0].cnt} 条不合格品尚未闭环，请跟进处置。`,
        'nonconforming',
        null
      )
    }
  }

  return { overdueTasks: overdue.length, pendingRecords: pending[0]?.cnt ?? 0, openNc: openNc[0]?.cnt ?? 0 }
}

/** Run the scan once and then every `intervalMs` (default 30 minutes). */
export function startReminderJob(intervalMs = 30 * 60 * 1000) {
  const run = () => {
    scanReminders().catch(() => { /* never crash the server */ })
  }
  run()
  const timer = setInterval(run, intervalMs)
  timer.unref?.()
  return timer
}
