# CLAUDE.md — CRM App 项目指南

> 面向美国中/亚洲餐厅的餐饮科技 CRM
> 技术栈: Next.js 14 + Prisma (PostgreSQL) + Ant Design 5 + NextAuth
> 当前版本: **v1.1.0**

---

## 项目结构

```
crm-app/
├── prisma/schema.prisma          # 数据模型 (SQLite)
├── src/
│   ├── app/
│   │   ├── api/                  # Next.js API Routes
│   │   ├── dashboard/            # 仪表盘
│   │   ├── customers/            # 客户管理 (列表 + 详情)
│   │   ├── leads/                # 线索管理
│   │   ├── subscriptions/        # 订阅管理
│   │   ├── support-tickets/      # 客服工单
│   │   ├── visits/               # 拜访记录
│   │   ├── segments/             # 客户分群
│   │   ├── records/              # 统一记录时间线
│   │   └── admin/                # 管理后台 (用户/导入)
│   ├── components/
│   │   └── Layout/AppLayout.tsx  # 全局布局 + 侧边栏
│   └── lib/
│       ├── prisma.ts             # Prisma 客户端单例
│       ├── auth.ts               # NextAuth 配置
│       ├── auth-helpers.ts       # RBAC 数据权限 (getDataScope)
│       ├── health-score.ts       # 健康度计算 (4维度加权)
│       ├── constants.ts          # 所有枚举常量
│       ├── toast.ts              # 统一 Toast 提示系统 (v1.0.1)
│       └── validation/
│           ├── index.ts          # 基础校验工具函数
│           └── schemas.ts        # 各 API 的校验 Schema
└── package.json
```

---

## 开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建 (会先 prisma generate)
npm run lint         # ESLint
npm run db:migrate   # Prisma 迁移
npm run db:seed      # 种子数据
npm run db:studio    # Prisma Studio (数据库可视化)
```

---

## 核心架构

### 数据权限 (RBAC)
- `ADMIN`: 全部数据
- `SALES_MGR`: 自己 region 的数据
- `SALES`: 只看自己跟進的客戶 (followerId)
- 使用 `getDataScope(session)` 生成 Prisma where 条件

### 客户健康度评分
- 4 个维度: 互动度(30%) + 产品采用(25%) + 客服健康(25%) + 订阅健康(20%)
- 每个维度 0-100 分，加权计算综合分
- 流失风险: LOW(≥70) / MEDIUM(40-69) / HIGH(<40)
- 代码: `src/lib/health-score.ts`

### 产品兴趣矩阵
- 每个客户对 7 条产品线有独立的 6 级兴趣程度
- 字段: posStatus, psWebsiteStatus, smtStatus, platformManagedStatus, aiCamStatus, omeStatus, smartRobotStatus
- 级别: NOT_CONTACTED → NOT_INTERESTED → AWARE → INTERESTED → HIGH_INTENT → PURCHASED

### 表单校验
- 所有 API 写入路由使用 `src/lib/validation/schemas.ts` 中的校验函数
- 校验工具: assertString, assertInt, assertOneOf, assertOptionalXxx 等
- 错误抛出 `ValidationError`，API 统一返回 400

### Toast 统一提示 (v1.0.1)
- `src/lib/toast.ts` 封装了 toastSuccess/Error/Warning/Info
- `handleApiError` 统一处理网络/权限/过期错误
- `apiFetch` 带错误处理的 fetch 封装

---

## v1.0.1 变更记录 (2026-06-09)

### A1: 仪表盘 MRR 趋势折线图
- `/api/dashboard` 新增 `mrrTrend` 字段，返回最近 12 个月的月度 MRR
- Dashboard 页面使用 `@ant-design/charts` 的 `Line` 组件展示

### A3: 仪表盘健康度分布饼图
- `/api/dashboard` 新增 `healthDistribution` 字段 (healthy/attention/atRisk)
- Dashboard 页面使用 `Pie` 组件展示环形图

### B1: 客户详情 → 订阅 Tab 增强
- 订阅 Tab 顶部新增 4 个统计卡片: 活跃订阅数、月度 MRR、已取消、已过期

### B3: 客户详情 → 健康度 Tab (新增)
- 新增健康度 Tab，含综合评分、流失风险、维度分数卡片
- 使用 `Radar` 雷达图可视化 4 个健康维度 (互动度/产品采用/客服健康/订阅健康)

### C1: 表单验证增强
- `subscriptions` POST 路由补齐 `validateCreateSubscription`
- `support-tickets` POST/PATCH 路由补齐 `validateCreateSupportTicket` / `validateUpdateSupportTicket`
- `constants.ts` 新增: SUBSCRIPTION_PLANS, BILLING_TYPES, SUBSCRIPTION_STATUSES, TICKET_PRIORITIES

### C5: 客户搜索高亮
- 搜索关键词在客户名称和城市列高亮显示 (黄色背景)
- 客户名称列新增排序功能

### C9: Toast 统一提示
- 新建 `src/lib/toast.ts`
- 客户列表页和客户详情页已切换到统一 Toast

---

## v1.0.2 变更记录 (2026-07-26) — 纯 Bug 修复，零 schema 变更

- **权限越界修复**: SALES_MGR 在 dashboard 的线索数/拜访数、/api/records 时间线、数据导出中原先能看到全公司数据，现按 region 隔离
- **导出真实下载**: 新增 `GET /api/exports/[id]/download` 按需重新生成 CSV（带 UTF-8 BOM），导出逻辑抽到 `src/lib/export-csv.ts`
- **records 性能**: 三表查询加 take 上限（page*pageSize），total 用 count 求和，不再全表载入内存排序
- **客户列表**: 删除重复的"城市"列

## v1.1.0 变更记录 (2026-07-26) — 跟进闭环 + Agent 对接地基

> 对应「客户跟进机制落地方案」的 P0 数据地基 + P1 规则推送。schema 全部为增量字段，生产 `prisma db push` 自动加列，不动存量数据。

### Schema 增量
- `Pipeline.nextFollowUpAt` / `nextAction`: 下次跟进日期与动作 — 跟进机制的发动机
- `Pipeline.closeReason`: WON/LOST 落库（此前算出但不落库，赢率无法回溯）
- `Communication.source`: manual/agent — Agent 写入审计标记

### 跟进规则引擎（确定性代码，不经过 Agent）
- `src/lib/followups.ts`: 5 条规则 — 新客户24h未首联 / 有意向3天无回音 / 今日到期 / 静默30天 / 成交30天回访
- 阈值走环境变量: `FOLLOWUP_NEW_LEAD_HOURS` / `FOLLOWUP_INTENT_DAYS` / `FOLLOWUP_SILENT_DAYS` / `FOLLOWUP_WON_CHECKIN_DAYS`

### 内部 API（供云端 Agent / cron 调用）
- `GET /api/followups/due`: 到期+超时清单，按负责人分组（session RBAC 或 `x-agent-token`）
- `GET /api/customers/[id]/context`: 客户画像+阶段+产品意向+订阅+最近5条记录一次打包（给 Agent 生成话术）
- `POST /api/customers/[id]/followups`: 写跟进记录+更新 lastContactDate/nextFollowUpAt；Agent token 写入 source=agent，能力上限=追加记录+改跟进时间，不能改阶段/删数/碰金额
- `POST /api/cron/daily-digest`: 企微群日报（`CRON_SECRET` 保护），销售群清单+管理群汇总，未配 webhook 时 dry-run 返回消息内容
- 环境变量: `AGENT_API_TOKEN`, `CRON_SECRET`, `WECOM_WEBHOOK_SALES`, `WECOM_WEBHOOK_MGMT`
- cron 触发（宿主机 crontab）: `30 8 * * * curl -s -X POST "https://<host>/api/cron/daily-digest?secret=$CRON_SECRET"`

### UI
- 新增 `/today` 今日跟进工作台（移动优先）：到期/超期清单 + 就地"记一笔"（沟通内容+下次跟进日期必填）
- AppLayout: 移动端(<768px)侧边栏改 Drawer；SALES_MGR 可见"数据导出"入口
- 看板卡片: 显示下次跟进日期，超期红条/今日黄条高亮
- 订阅管理: 取消/恢复订阅操作（`PATCH /api/subscriptions/[id]`，流失数据从此可统计）

## v1.2.0 变更记录 (2026-08-02) — 仪表盘日期筛选 + 每周复盤 + 团队活动量

### Schema 增量
- `WeeklyMetricSnapshot`: 周度指标快照表，存储每周 MRR/客户数/活动量/健康度等聚合数据，供仪表盘按时间筛选和周环比比较
- `User.targetMRR` / `User.targetCustomers`: 销售目标配额字段（可空），用于计算达成率

### 仪表盘增强 (`GET /api/dashboard` + `/dashboard`)
- 新增时间范围筛选: 今天/本周/本月/本季度/自定义日期范围
- 每个 KPI 卡支持按时间段过滤，MRR 卡显示周环比/月环比箭头 (WoW/MoM)
- Pipeline 漏斗升级为真漏斗: 显示各阶段占比 + 赢率 (won / (won + lost))
- MRR 趋势图支持自定义范围（不再硬编码 12 个月）
- 健康度分布修复分母错误: 改用健康度实际记录总数而非客户总数
- 客户总数排除 ARCHIVED 状态（与列表页一致）
- SALES_MGR 区域数据隔离修复 (dashboard + records API)

### 每周复盤页 (`/weekly-review`)
- 基于 `WeeklyMetricSnapshot` + `/api/team-stats` 自动生成周度复盘报告
- 显示: 本周 MRR/新签 MRR/流失 MRR/Pipeline 状态/成交丢单/客户构成/健康度
- 团队活动量表: 每人新增线索/拜访/沟通/成交/丢单/MRR 达成率
- 可选显示上周期对比 (WoW 环比箭头)

### 团队统计 API (`GET /api/team-stats`)
- 按周聚合每人活动量: newLeads/visits/comms/wonDeals/lostDeals/activeCustomers/MRR
- 支持可选的上一周对比数据
- 计算 MRR 达成率 (`mrr / targetMRR`)

### 周度快照 (`POST /api/metrics/snapshot`)
- 管理员触发周度指标快照计算，覆盖全部维度
- 自动处理 ISO 周 (Mon-Sun) 边界
- 幂等: 同一周的多次调用不重复写入

### UI
- AppLayout: 新增「每週復盤」菜单入口（看板类分组）
- Dashboard 顶部增加时间筛选器 (Select + RangePicker + 刷新按钮)

## 待办 / 下一步

- [ ] P2: 客户详情 → 支持工单 Tab
- [ ] P2: 批量导入客户优化 (进度条 + 错误报告)
- [ ] P2: 仪表盘支持按人/区域下钻 (personId/region 筛选参数)
- [ ] P3: 暗色模式支持
- [ ] P3: 移动端响应式优化

---

## 注意事项

- Prisma 使用 SQLite，生产环境可能需要迁移到 PostgreSQL
- `@ant-design/charts` 依赖 `@ant-design/plots`，图表组件从 `@ant-design/charts` 导入
- NextAuth session 结构: `session.user.id`, `session.user.role`, `session.user.region`
- 数据库文件: `prisma/dev.db` (SQLite)
