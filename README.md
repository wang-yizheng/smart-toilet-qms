# 智能马桶检测管理系统

面向智能马桶生产企业的质量管控平台，覆盖检测标准配置、任务派工、数据采集与自动判定、不合格品闭环处置、质量统计分析与产品追溯的全流程信息化管理。

> 毕业设计演示系统。参考任务书《基于 SpringBoot + Vue 的智能马桶检测管理系统》的业务需求实现。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19 + Vite + TypeScript + Tailwind CSS + React Router + TanStack Query + Recharts |
| 后端 | Node.js + Express + TypeScript（tsx 运行）+ Zod 校验 |
| 数据库 | PostgreSQL（node-postgres） |

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
│       ├── middleware/        # 认证与角色鉴权
│       └── modules/           # 各业务模块路由
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

## 判定规则

每个检测项配置标准值与上下限：

- 双边：`下限 ≤ 实测值 ≤ 上限`（边界值含端点）
- 单边：仅配置下限（如绝缘电阻 ≥ 10）或仅配置上限（如泄漏电流 ≤ 0.25），另一侧留空

整条记录判定：所有检测项均合格才判定合格，任一不合格则整条不合格；未配置标准或未填值则记为待判定。
