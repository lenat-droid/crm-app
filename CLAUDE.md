# CLAUDE.md — CRM App 项目指南

> 面向美国中/亚洲餐厅的餐饮科技 CRM
> 技术栈: Next.js 14 + Prisma (SQLite) + Ant Design 5 + NextAuth
> 当前版本: **v1.0.1**

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

## 待办 / 下一步

- [ ] P2: 仪表盘日期筛选器 (按月/季度查看 MRR)
- [ ] P2: 客户详情 → 支持工单 Tab
- [ ] P2: 批量导入客户优化 (进度条 + 错误报告)
- [ ] P3: 暗色模式支持
- [ ] P3: 移动端响应式优化

---

## 注意事项

- Prisma 使用 SQLite，生产环境可能需要迁移到 PostgreSQL
- `@ant-design/charts` 依赖 `@ant-design/plots`，图表组件从 `@ant-design/charts` 导入
- NextAuth session 结构: `session.user.id`, `session.user.role`, `session.user.region`
- 数据库文件: `prisma/dev.db` (SQLite)
