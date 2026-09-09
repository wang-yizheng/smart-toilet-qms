# 智能马桶检测管理系统

面向智能马桶生产企业的质量管控平台，覆盖检测标准配置、任务派工、数据采集与自动判定、不合格品闭环处置、质量统计分析与产品追溯的全流程信息化管理。

> 毕业设计演示系统。参考任务书《基于 SpringBoot + Vue 的智能马桶检测管理系统》的业务需求实现。

**GitHub 仓库**：https://github.com/wang-yizheng/smart-toilet-qms

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19 + Vite + TypeScript + Tailwind CSS + React Router + TanStack Query + Recharts |
| 后端 | Node.js + Express + TypeScript（tsx 运行）+ Zod 校验 |
| 数据库 | PostgreSQL（node-postgres） |

## 技术选型说明（重要）

任务书与开题报告规定的技术路线为 `SpringBoot + Vue3 + Element Plus + MyBatis-Plus + MySQL + Redis + ECharts + Apache POI`。本系统由 AI 应用生成平台构建，平台生成的项目使用固定的 React + Node.js 技术体系，不支持切换为 Java 技术栈，因此实际实现如下：

| 任务书要求 | 本系统实现 | 差异说明 |
| --- | --- | --- |
| Vue 3 + Element Plus | React 19 + Tailwind CSS + Radix UI | 组件化前端，页面结构与交互一致 |
| SpringBoot | Node.js + Express + TypeScript | 分层路由 + 中间件，等价的 REST 服务 |
| MyBatis-Plus | node-postgres 原生 SQL | 数据访问层，SQL 显式可控 |
| MySQL | PostgreSQL | 关系型数据库，表结构与约束一致 |
| Redis | 未引入（接口均为无状态设计） | 可直接接入 Redis 做会话与热点数据缓存 |
| ECharts | Recharts | 图表类型与统计口径一致 |
| Apache POI | ExcelJS | 检验报告导出为 `.xlsx` 文件 |

业务建模、数据库设计、合格判定算法、SPC/Cpk 统计口径与业务流程均按任务书要求实现，差异仅在框架与运行时。若送审或答辩要求必须使用任务书规定的技术栈，可复用本系统的数据库设计与判定逻辑进行迁移：业务逻辑可以平移，工作量主要在框架替换。

## 目录结构

```
├── frontend/                  # 前端应用
│   └── src/
│       ├── components/        # 布局与 UI 组件
│       ├── lib/               # 认证、接口客户端、格式化
│       ├── pages/             # 各业务页面
│       └── types.ts
├── backend/                   # 后端服务
│   └── src/
│       ├── config/            # 环境变量、数据库连接、JWT
│       ├── db/                # 建表脚本、演示数据脚本、测试用例
│       ├── lib/judge.ts       # 合格判定核心逻辑（纯函数，可单测）
│       ├── lib/logger.ts      # 操作日志写入（关键操作留痕）
│       ├── lib/uploads.ts     # 附件上传（现场照片 / 表格导入）
│       ├── jobs/              # 定时任务（超期、待审、待处置提醒）
│       ├── middleware/        # 认证与角色鉴权
│       └── modules/           # 各业务模块路由
├── scripts/                   # 运维脚本（数据库每日备份）
└── docs/                      # 产品说明
```

## 快速开始

### 1. 准备数据库

确保本机已启动 PostgreSQL，并在 `backend/.env` 中配置连接串：

```
DATABASE_URL=postgres://postgres:Tencent2025@localhost:5432/genie?schema=public
```

### 2. 安装依赖

```bash
cd backend  && pnpm install
cd ../frontend && pnpm install
```

### 3. 初始化并生成演示数据

```bash
cd backend
pnpm db:init     # 建表 + 创建默认账号
pnpm db:seed     # 生成演示数据（360 条检测记录）
```

> 服务启动时会自动执行建表与演示数据初始化（若库为空），无需手动执行。

### 4. 启动服务

```bash
cd backend  && pnpm dev    # http://localhost:3000
cd ../frontend && pnpm dev # http://localhost:5173（自动代理 /api 到后端）
```

浏览器访问 `http://localhost:5173`。

## 默认账号

| 角色 | 用户名 | 密码 |
| --- | --- | --- |
| 系统管理员 | admin | admin123 |
| 质检主管 | qc | qc123456 |
| 检测员 | inspector | insp123456 |
| 生产人员 | producer | prod123456 |

## 演示数据与测试用例

### 模拟数据（`backend/src/db/seed.ts`）

一次性生成：

- 12 个产品型号、6 个分类、5 家供应商、34 个生产批次
- 13 项检测项目（电气安全 / 冲洗性能 / 座圈舒适 / 水封）
- 360 条检测记录，每条含 13 个检测项实测值，共 4000+ 条测量结果
- 16 条不合格品记录及其处置信息
- 360 条操作日志，覆盖近 30 天的登录、任务、检测、处置等 9 类操作

生成过程中按产品标准实时判定合格 / 不合格，因此合格率趋势图、柏拉图、型号对比与 SPC 控制图均有真实数据支撑。

### 测试用例（`backend/src/db/test-cases.ts`）

针对合格判定功能设计了三类典型输入：

- **合格**：实测值落在区间内（含单边上下限场景，如绝缘电阻 ≥ 10 MΩ、泄漏电流 ≤ 0.25 mA）
- **不合格**：低于下限 / 高于上限 / 非数值
- **边界值**：恰好等于下限、恰好等于上限（判定合格）；恰在下限外 0.01、恰在上限外 0.01（判定不合格）

### 运行测试

```bash
cd backend && pnpm test
```

共 27 个用例，覆盖上述合格 / 不合格 / 边界值判定与整条记录的汇总判定。

## 操作日志

系统管理模块的操作留痕能力，对应任务书中"权限隔离 + 操作日志"的非功能性要求。

- **自动记录**：登录、创建 / 派工 / 变更任务、录入与审核检测记录、处置不合格品、发布公告、调整检测标准、新增 / 修改用户与重置密码，均自动写入日志。
- **查询筛选**：支持按操作类型、操作人 / 内容关键字、日期区间筛选，分页浏览。
- **统计视图**：今日 / 近 7 天 / 累计操作量，以及各操作类型的分布图。
- **权限隔离**：仅系统管理员与质检主管可查看，检测员与生产人员访问返回 403。

后端接口：`GET /api/logs`、`GET /api/logs/actions`、`GET /api/logs/stats`。

## 数据采集与集成

- **表格批量导入**：`POST /api/records/import`（multipart，支持 `.xlsx` / `.xls` / `.csv`），导入模板见 `GET /api/records/import/template`。导入时按产品标准自动判定，逐行返回成功与失败原因。
- **检测设备接口**：`POST /api/device/ingest`，请求头 `X-Device-Key: <DEVICE_API_KEY>`（默认 `device-secret`），按检测项编码或名称上报实测值，服务端自动判定并生成记录。`GET /api/device/schema` 可获取检测项与产品型号清单。
- **现场照片留档**：`POST /api/records/:id/photos` 上传，`GET /api/records/:id/photos` 查看，`/uploads/**` 提供静态访问。
- **超期与待审提醒**：服务启动后每 30 分钟扫描一次超期任务、超过 2 天未审核的记录与未闭环不合格品，生成站内消息（`GET /api/notifications`），顶部消息中心实时显示未读数。

## 数据备份

`scripts/backup-db.sh` 使用 `pg_dump` 导出并压缩，默认保留最近 7 天。

```bash
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh

# 每日凌晨 2 点自动备份
0 2 * * * /workspace/scripts/backup-db.sh >> /var/log/toilet-qms-backup.log 2>&1
```

恢复：

```bash
gunzip -c backups/smart-toilet-YYYYMMDD-HHMMSS.sql.gz | psql "$DATABASE_URL"
```

## 生产部署

前端构建为静态资源由 Nginx 直接托管，后端作为服务运行，Nginx 反向代理 `/api` 与 `/uploads`。

```nginx
server {
  listen 80;
  server_name your-domain.com;

  root  /var/www/smart-toilet/dist;   # cd frontend && pnpm build 的产物
  index index.html;
  location / { try_files $uri $uri/ /index.html; }

  location /api/     { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
  location /uploads/ { proxy_pass http://127.0.0.1:3000; }
}
```

后端进程守护：

```bash
cd backend && pnpm build && pm2 start dist/index.js --name smart-toilet-api
```

## 判定规则

每个检测项配置标准值与上下限：

- 双边：`下限 ≤ 实测值 ≤ 上限`（边界值含端点）
- 单边：仅配置下限（如绝缘电阻 ≥ 10）或仅配置上限（如泄漏电流 ≤ 0.25），另一侧留空

整条记录判定：所有检测项均合格才判定合格，任一不合格则整条不合格；未配置标准或未填值则记为待判定。
