import { query } from '../config/db'

/**
 * Canonical operation types recorded in the audit trail.
 * Keys are stored in the database; values are the Chinese labels shown in the UI.
 */
export const LOG_ACTIONS: Record<string, string> = {
  login: '用户登录',
  'user.create': '新增用户',
  'user.update': '修改用户',
  'user.reset_password': '重置密码',
  'task.create': '创建任务',
  'task.assign': '任务派工',
  'task.status': '任务状态变更',
  'record.create': '录入检测记录',
  'record.review': '审核检测记录',
  'nc.dispose': '不合格品处置',
  'announcement.create': '发布公告',
  'standard.update': '调整检测标准',
}

/**
 * Append one entry to the operation log.
 * Logging is best-effort: a failure here must never break the business flow.
 */
export async function writeLog(
  userId: number | null | undefined,
  action: string,
  detail?: string | null
): Promise<void> {
  try {
    await query(
      'INSERT INTO operation_logs (user_id, action, detail) VALUES ($1,$2,$3)',
      [userId ?? null, action, detail ?? null]
    )
  } catch {
    /* intentionally swallowed */
  }
}
