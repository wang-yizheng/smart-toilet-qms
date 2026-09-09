-- Smart Toilet Detection Management System — database schema (PostgreSQL)
-- Run with: pnpm db:init

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  name          VARCHAR(50) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'inspector', -- admin | qc_manager | inspector | producer
  status        VARCHAR(10) NOT NULL DEFAULT 'active',    -- active | disabled
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(20) UNIQUE NOT NULL,
  name       VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(20) UNIQUE NOT NULL,
  name       VARCHAR(80) NOT NULL,
  contact    VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  model       VARCHAR(40) UNIQUE NOT NULL,
  name        VARCHAR(80) NOT NULL,
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batches (
  id          SERIAL PRIMARY KEY,
  batch_no    VARCHAR(40) UNIQUE NOT NULL,
  product_id  INT REFERENCES products(id) ON DELETE CASCADE,
  quantity    INT NOT NULL DEFAULT 0,
  produce_date DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS detection_items (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(30) UNIQUE NOT NULL,
  name        VARCHAR(60) NOT NULL,
  unit        VARCHAR(20),
  group_name  VARCHAR(40),  -- 电气安全 / 冲洗性能 / 座圈舒适 / 水封 ...
  description TEXT
);

CREATE TABLE IF NOT EXISTS standards (
  id          SERIAL PRIMARY KEY,
  product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  item_id     INT NOT NULL REFERENCES detection_items(id) ON DELETE CASCADE,
  nominal     NUMERIC(12,4),
  lower_bound NUMERIC(12,4), -- inclusive lower limit, NULL = unbounded
  upper_bound NUMERIC(12,4), -- inclusive upper limit, NULL = unbounded
  method      VARCHAR(120),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, item_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  task_no     VARCHAR(40) UNIQUE NOT NULL,
  product_id  INT REFERENCES products(id) ON DELETE SET NULL,
  batch_id    INT REFERENCES batches(id) ON DELETE SET NULL,
  type        VARCHAR(20) NOT NULL DEFAULT '出厂', -- 出厂 | 过程 | 型式
  status      VARCHAR(20) NOT NULL DEFAULT '待派工', -- 待派工|待检测|检测中|待审核|已完成|已终止
  assignee_id INT REFERENCES users(id) ON DELETE SET NULL,
  plan_date   DATE,
  due_date    DATE,
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS records (
  id          SERIAL PRIMARY KEY,
  record_no   VARCHAR(40) UNIQUE NOT NULL,
  task_id     INT REFERENCES tasks(id) ON DELETE SET NULL,
  product_id  INT REFERENCES products(id) ON DELETE SET NULL,
  batch_id    INT REFERENCES batches(id) ON DELETE SET NULL,
  inspector_id INT REFERENCES users(id) ON DELETE SET NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status      VARCHAR(20) NOT NULL DEFAULT '待审核', -- 待审核 | 已完成
  result      VARCHAR(10) NOT NULL DEFAULT 'pending', -- pass | fail | pending
  env_note    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS results (
  id         SERIAL PRIMARY KEY,
  record_id  INT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  item_id    INT NOT NULL REFERENCES detection_items(id) ON DELETE CASCADE,
  value      NUMERIC(12,4),
  qualified  BOOLEAN,
  deviation  NUMERIC(12,4)
);

CREATE TABLE IF NOT EXISTS nonconforming (
  id                SERIAL PRIMARY KEY,
  record_id         INT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  item_id           INT REFERENCES detection_items(id) ON DELETE SET NULL,
  defect_level      VARCHAR(20) NOT NULL DEFAULT '一般', -- 轻微 | 一般 | 严重
  phenomenon        TEXT,
  cause             TEXT,
  responsibility_dept VARCHAR(40),
  disposition       VARCHAR(20) NOT NULL DEFAULT '待处理', -- 返工|返修|让步接收|报废|待处理
  status            VARCHAR(20) NOT NULL DEFAULT '待处理', -- 待处理|审批中|已闭环
  recheck_result    VARCHAR(10),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS announcements (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(120) NOT NULL,
  content    TEXT,
  pinned     BOOLEAN NOT NULL DEFAULT false,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(60),
  detail     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_records_product ON records(product_id);
CREATE INDEX IF NOT EXISTS idx_records_batch ON records(batch_id);
CREATE INDEX IF NOT EXISTS idx_records_detected ON records(detected_at);
CREATE INDEX IF NOT EXISTS idx_results_record ON results(record_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_nonconforming_status ON nonconforming(status);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created ON operation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_logs_action ON operation_logs(action);

-- In-app notifications (overdue tasks, records pending review, ...)
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(40) NOT NULL DEFAULT 'system',
  title      VARCHAR(120) NOT NULL,
  content    TEXT,
  ref_type   VARCHAR(30),
  ref_id     INT,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- On-site photos attached to a detection record
CREATE TABLE IF NOT EXISTS record_photos (
  id          SERIAL PRIMARY KEY,
  record_id   INT REFERENCES records(id) ON DELETE CASCADE,
  file_path   VARCHAR(255) NOT NULL,
  file_name   VARCHAR(120),
  uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_photos_record ON record_photos(record_id);
