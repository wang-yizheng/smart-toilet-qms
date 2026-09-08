export interface User {
  id: number
  username: string
  name: string
  role: string
  status?: string
  created_at?: string
}

export interface Category {
  id: number
  code: string
  name: string
}

export interface Supplier {
  id: number
  code: string
  name: string
  contact?: string | null
}

export interface Product {
  id: number
  model: string
  name: string
  category_id?: number | null
  supplier_id?: number | null
  description?: string | null
  category_name?: string | null
  supplier_name?: string | null
}

export interface Batch {
  id: number
  batch_no: string
  product_id: number
  quantity: number
  produce_date?: string | null
}

export interface DetectionItem {
  id: number
  code: string
  name: string
  unit?: string | null
  group_name?: string | null
  description?: string | null
}

export interface Standard {
  id: number
  product_id: number
  item_id: number
  nominal: number | null
  lower_bound: number | null
  upper_bound: number | null
  method?: string | null
  item_code?: string
  item_name?: string
  unit?: string | null
  group_name?: string | null
}

export interface Task {
  id: number
  task_no: string
  product_id: number
  batch_id?: number | null
  type: string
  status: string
  assignee_id?: number | null
  plan_date?: string | null
  due_date?: string | null
  created_by?: number | null
  note?: string | null
  product_model?: string
  product_name?: string
  batch_no?: string | null
  assignee_name?: string | null
  creator_name?: string | null
}

export interface RecordRow {
  id: number
  record_no: string
  task_id?: number | null
  product_id: number
  batch_id?: number | null
  inspector_id: number
  detected_at: string
  status: string
  result: string
  env_note?: string | null
  product_model?: string
  product_name?: string
  batch_no?: string | null
  inspector_name?: string | null
  fail_items?: number
}

export interface ResultRow {
  id: number
  record_id: number
  item_id: number
  value: number | null
  qualified: boolean | null
  deviation: number | null
  item_code?: string
  item_name?: string
  unit?: string | null
  group_name?: string | null
  nominal?: number | null
  lower_bound?: number | null
  upper_bound?: number | null
}

export interface Nonconforming {
  id: number
  record_id: number
  item_id?: number | null
  defect_level: string
  phenomenon?: string | null
  cause?: string | null
  responsibility_dept?: string | null
  disposition: string
  status: string
  recheck_result?: string | null
  item_name?: string | null
  unit?: string | null
  product_model?: string
  batch_no?: string | null
  record_no?: string | null
  inspector_name?: string | null
}

export interface Announcement {
  id: number
  title: string
  content?: string | null
  pinned: boolean
  created_by?: number | null
  created_at: string
  author_name?: string | null
}

export interface OperationLog {
  id: number
  user_id: number | null
  action: string
  detail: string | null
  created_at: string
  user_name?: string | null
  username?: string | null
}

export const ROLE_LABELS: Record<string, string> = {
  admin: '系统管理员',
  qc_manager: '质检主管',
  inspector: '检测员',
  producer: '生产人员',
}

export const ACTION_LABELS: Record<string, string> = {
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
