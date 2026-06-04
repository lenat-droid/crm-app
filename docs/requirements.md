# Proton CRM 系统需求文档

> 版本: v2.0 (Phase 1-2 完成)
> 最后更新: 2026-06-01
> 领域: 美国餐饮科技软件销售 CRM
> 目标用户: 10+ 人销售团队（中/英文），管理 400,000+ 餐厅客户

---

## 1. 需求背景

### 1.1 为什么要做

现有 CRM 基于 **1,100+ 客户** 规模设计，存在以下核心瓶颈：

| 问题 | 现状 | 影响 |
|------|------|------|
| **产品硬编码** | 7 个产品字段写死在 Customer 模型和代码中 | 新增产品需改 schema + 迁移 + 改代码，无法动态扩展 |
| **缺乏订阅管理** | 无 Subscription 模型，无法追踪 MRR、续约、流失 | 无法计算 SaaS 核心指标（MRR/ARPU/Churn Rate） |
| **无健康度评分** | 客户流失靠人工判断，无量化指标 | 无法主动预警高风险客户 |
| **无客户分层** | 所有客户平等对待 | Enterprise 大客得不到差异化跟进，SMB 长尾无法自动化 |
| **无客服工单整合** | 售后数据在 Chatwoot 中，与 CRM 隔绝 | 销售看不到客户工单情况，影响续约决策 |
| **数据范围无隔离** | SALES_MGR 角色不存在 | 销售主管无法管理团队数据，只能靠 Admin 人工过滤 |
| **无输入验证** | API 直接接受任意输入 | 脏数据污染数据库 |
| **Lead 转化无事务** | 创建 Customer / Pipeline 分步执行 | 部分失败产生孤儿数据 |
| **仪表板简单** | 仅有客户/拜访/管线计数 | 缺少 MRR、健康度、订阅等关键指标 |
| **无分群管理** | 无法批量操作客户 | 400k 客户逐一处理不可行 |
| **产品统计性能差** | 42 次 count() 查询 | 页面加载慢 |

### 1.2 业务规模假设

| 指标 | 当前 | 目标 |
|------|------|------|
| 客户总数 | ~1,100 | 400,000+ |
| 产品线 | 7 个硬编码 | 动态扩展（ProductCatalog） |
| 用户角色 | 2 种（ADMIN/SALES） | 3 种（+ SALES_MGR） |
| 数据来源 | 手动录入 | 批量导入 / API / Partner / 自动转化 |
| 数据范围限制 | 无 | Role-based（Admin 全量 / Mgr 区域 / Sales 个人） |

---

## 2. 目标与价值

### 2.1 做完改善什么

| 改善点 | 当前 | 目标 |
|--------|------|------|
| **系统可扩展性** | 新增产品需改代码+迁移 | 产品目录动态管理，前端自动适配 |
| **SaaS 收入可见性** | 无订阅数据 | 实时 MRR、活跃订阅、续约管理、流失预警 |
| **客户流失预警** | 人工判断 | 自动健康度评分（0-100）+ 风险分级 + 子维度分析 |
| **数据准确性** | 无输入校验 | 所有 API 端点请求体验证（400 错误 + 描述信息） |
| **数据安全性** | 无数据隔离 | SALES 只看自己跟进的，SALES_MGR 看区域内的，ADMIN 看全部 |
| **销售管理效率** | 无分群、无批量操作 | 动态/静态分群 + 异步导出 CSV |
| **客服协同** | CRM 看不到工单 | 客户详情页展示工单历史、CSAT 评分 |
| **查询性能** | 42 次 count() | 7 次 groupBy（产品统计）；分页参数；cursor-based 支持 |
| **数据一致性** | Lead 转化分步执行 | 事务保护：Customer + Lead + Pipeline 原子操作 |

### 2.2 核心指标

| 指标 | 计算方式 | 数据源 |
|------|----------|--------|
| MRR | 所有 ACTIVE Subscription.mrr 之和 | Subscription 表 |
| 活跃订阅数 | status=ACTIVE 的订阅总数 | Subscription 表 |
| 总客户数 | Customer.count (status!=ARCHIVED) | Customer 表 |
| 平均健康度 | CustomerHealthScore.overallScore 均值 | CustomerHealthScore 表 |
| 流失风险分布 | CustomerHealthScore.churnRisk 分组计数 | CustomerHealthScore 表 |
| 管线活跃数 | Pipeline.count (active=true) | Pipeline 表 |
| 产品兴趣分布 | Customer 各产品字段分组计数 | Customer 表（denormalized） |

---

## 3. 目标用户与角色

### 3.1 用户角色

| 角色 | 代码 | 描述 | 数据可见范围 |
|------|------|------|-------------|
| **管理员** | ADMIN | 系统管理员，拥有所有权限 | 全部数据 |
| **销售主管** | SALES_MGR | 管理区域内销售团队，查看团队业绩 | 自己 region 内的数据 |
| **销售** | SALES | 个人跟进客户 | 自己 followerId 分配的客户 |

### 3.2 角色权限矩阵

| 功能 | ADMIN | SALES_MGR | SALES |
|------|-------|-----------|-------|
| 仪表盘 | 全部统计 | 团队统计 | 自己相关 |
| 客户列表 | 全部 | Territory 内 | 被分配的 |
| 客户详情 | 可编辑 | Territory 内可编辑 | 被分配的可编辑 |
| 新建客户 | ✅ | ✅ | ✅ |
| 客户分群管理 | ✅ | ✅ | ❌ |
| 批次导入/导出 | ✅ | ✅ | ❌ |
| 看板（Pipeline） | 全部 | 团队 | 自己的 |
| 拜访记录 | 全部 | 团队 | 自己的 |
| 线索管理 | 全部 | 团队 | 自己的 |
| 订阅管理 | 全部 | Territory 内 | 被分配的 |
| 工单查看 | 全部 | Territory 内 | 被分配的 |
| 用户管理 | ✅ | ❌ | ❌ |
| 产品目录管理 | ✅ | ❌ | ❌ |
| 产品管理 UI | ✅ | ❌ | ❌ |

### 3.3 区域划分

```
LA EAST / LA DOWNTOWN / LA WEST / ORANGE COUNTY /
WESTERN INLAND EMPIRE / SOUTH BAY / OUT OF CALIFORNIA
```

SALES_MGR 绑定一个 region，数据范围自动限制在该区域内。

---

## 4. 核心场景

### 4.1 销售日常工作

```
场景 1: 查看仪表盘
  时间: 每天早上
  操作: 打开 /dashboard
  看到: MRR、活跃订阅、健康度、Pipeline 数量、待处理线索、高流失风险
  价值: 5 秒掌握全局状态

场景 2: 跟进 Pipeline
  时间: 日常
  操作: 打开 /kanban → 拖拽卡片（⚠️ → 已建联 → 初步有意向 → 合作中）
  看到: 每个客户的最新沟通记录、联系人信息
  价值: 可视化 Pipeline 管理

场景 3: 拜访客户
  时间: 出发前 / 回来后
  操作: /quick-checkin 快速记录 /visits/new 详细记录（含 POS 品牌、费用、痛点）
  价值: 快速录入，不占用销售时间

场景 4: 管理线索
  时间: 新线索到达时
  操作: /leads 列表 → 查看 → PATCH 转化为客户（事务保护）
  价值: 一键转化，自动创建 Customer + Pipeline

场景 5: 查看客户详情
  时间: 客户来电/续约前
  操作: /customers/[id]
  看到: 基本信息、产品兴趣矩阵、沟通历史、健康度评分、
        订阅状态、工单历史、拜访记录
  价值: 360 度客户视图，无需切换系统
```

### 4.2 销售主管工作

```
场景 6: 团队数据管理
  时间: 周会前
  操作: /dashboard（自动显示团队数据）
  看到: 团队成员 Pipeline 总量、客户覆盖、拜访统计
  价值: 无需手动汇总

场景 7: 健康度监控
  时间: 每周
  操作: /customer-health（按风险排序）
  看到: 区域内高流失风险客户列表，子维度评分
  价值: 主动干预防止流失
```

### 4.3 管理员工作

```
场景 8: 用户管理
  操作: /admin/users
  功能: CRUD 用户、设置角色(ADMIN/SALES_MGR/SALES)、启用/禁用

场景 9: 产品目录管理
  操作: /products
  功能: 动态管理产品线（新增/编辑/禁用产品）

场景 10: 订阅管理
  操作: /subscriptions
  功能: 创建订阅、管理续约、查看到期列表

场景 11: 数据导出
  操作: /exports
  功能: 异步导出 CSV（客户/订阅/工单/线索）

场景 12: 客户分群
  操作: /segments
  功能: 创建动态/静态分群，按分群管理客户

场景 13: 数据导入
  操作: /admin/import
  功能: 批量导入客户数据
```

---

## 5. 功能范围

### 5.1 本期完成（Phase 1-2）

#### ✅ 核心 CRM 功能

| 模块 | 功能 | API | 前端页面 |
|------|------|-----|---------|
| 客户管理 | CRUD + 搜索 + 分页 + cursor 分页 | `/api/customers` | `/customers` |
| 客户详情 | 基本信息 + 产品矩阵 + 沟通 + 健康度 + 订阅 + 工单 + 拜访 | `/api/customers/[id]` | `/customers/[id]` |
| Pipeline | 列表 + 创建/更新 + 状态同步到客户 | `/api/pipelines` | `/kanban` |
| 线索管理 | CRUD + 转化（事务保护） | `/api/leads` | `/leads` |
| 拜访记录 | 快速签到 + 详细拜访 + 简略拜访 | `/api/visits` | `/visits`, `/quick-checkin` |

#### ✅ Phase 1 增强

| 子模块 | 功能 | 说明 |
|--------|------|------|
| Schema 增强 | Customer 新增 tier/status/source/onboardingStatus/healthScore/firstPurchasedAt/lastActivityAt | 向后兼容新增字段 |
| 产品兴趣矩阵 | 7 个 denormalized 字段保留 + ProductInterest 新表（双写） | 动态产品目录支持 |
| 输入验证 | 所有 API 端点 Zod 验证（name required, region 受控词表等） | 返回 400 + 描述错误 |
| API 性能 | product-stats: 42 queries → 7 groupBy | 分页参数标准化 |
| 事务保护 | Lead 转化: $transaction(customer.create + lead.update + pipeline.create) | 防孤儿数据 |
| 权限隔离 | getDataScope(session) → ADMIN 全量 / MGR 区域 / SALES 个人 | 应用到所有 list/detail API |
| ProductCatalog | 动态产品目录（7 个种子产品） | 支撑产品管理 UI |

#### ✅ Phase 2 新增

| 模块 | 功能 | API | 前端页面 |
|------|------|-----|---------|
| 订阅管理 | CRUD + 到期自动识别 + MRR 统计 | `/api/subscriptions` | `/subscriptions`, `/subscriptions/expiring` |
| 客服工单 | CRUD + 消息线程 + CSAT 评分 + 状态管理 | `/api/support-tickets` | `/support-tickets`, `/support-tickets/[id]` |
| 健康度评分 | 4 维度加权计算 + 流失风险分级 + 重新计算 | `/api/customer-health` | `/customer-health` |
| 客户分群 | 动态/静态分群 CRUD | `/api/segments` | `/segments`, `/segments/[id]` |
| 产品管理 | 动态产品目录 CRUD（Admin only） | `/api/products` | `/products` |
| 仪表板扩展 | 13 项指标并行查询（MRR/健康度/Pipeline 漏斗/区域分布/层级分布） | `/api/dashboard` | `/dashboard` |
| 数据导出 | 异步 CSV 导出（客户/订阅/工单/线索） | `/api/exports` | `/exports` |
| 客户详情增强 | 健康度子分卡 + 订阅 Tab + 工单 Tab + Tier/Status 徽章 | （复用） | `/customers/[id]` |
| 商家档案 (MerchantProfile) | 1:1 商家 Profile（外部 ID、结构化地址、营业信息、营运数据、40+ 特征标签） | `GET/PATCH /api/customers/[id]/profile` | `/customers/[id] ("商家档案" Tab)` |
| 线索表单增强 | 公眾端线素表单增加地址/网站/城市等字段 + Google Places 预填占位 | `/api/public/leads` | `/leads/share/[token]` |

### 5.2 不做什么（Phase 3 或以后）

| 模块 | 说明 | 原因 |
|------|------|------|
| PostgreSQL 迁移 | 当前使用 SQLite | Phase 1-2 全部在 SQLite 运行，撑不住再迁移 |
| 全文搜索引擎 | Elasticsearch / Meilisearch | 当前 SQL LIKE 搜索 400k 客户不够用 |
| Job Queue | Redis + BullMQ | 异步任务目前同步处理 |
| Materialized Views | 仪表板直接查 Prisma 聚合 | 当前客户量级可接受 |
| SignNow 集成 | 电子签约 | Schema 已预留 SignNowDocument 模型 |
| Chatwoot 集成 | Webhook 自动创建工单 | 目前手动创建工单 |
| React Query | 当前用 useState+useEffect+fetch | Phase 3 前端现代化 |
| Server Components | 当前全部 'use client' | Phase 3 逐步迁移 |
| 批量客户操作 | POST /api/customers/batch | 异步导入基础已实现 |
| 订阅自动续约 | 需要排程任务 | Job Queue 完成后实现 |
| SMB 自助服务 | 自助续约、自助上线 | 基础设施完成后 |
| BulkOperation 模型 | 异步任务跟踪 | 当前 ExportJob 已覆盖导出场景 |

### 5.3 Phase 2 Extended: 平台化架构（延展规划）

> 以下为远期架构规划，不纳入当前 Sprint，但代码和 schema 设计需向前兼容。

#### 5.3.1 第三方集成模块化

**目标**：将工单系统（Chatwoot）、签约系统（SignNow）、销售系统等外部系统抽象为独立集成模块，通过统一的集成层管理数据同步与功能对接。

**架构设计**：

```
┌─────────────────────────────────────────────────────────┐
│                   CRM Core (单体核心)                    │
│    Customer / Pipeline / Lead / Subscription / ...      │
└────────────────────┬────────────────────────────────────┘
                     │ 集成抽象层 (Integration Gateway)
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
┌──────────┐  ┌──────────┐  ┌──────────────┐
│ Chatwoot │  │ SignNow  │  │ Sales System │  ← 各为独立模块
│ 工单集成  │  │ 签约集成  │  │ 对接模块      │
│          │  │          │  │ (第三方/自研)  │
└──────────┘  └──────────┘  └──────────────┘
```

**集成模块接口规范**：

```typescript
// src/lib/integrations/types.ts — 统一集成接口
interface IntegrationModule {
  name: string                    // 'chatwoot' | 'signnow' | ...
  enabled: boolean
  syncDirection: 'IMPORT' | 'EXPORT' | 'BIDIRECTIONAL'
  
  // 生命周期钩子
  onInitialize(): Promise<void>
  onSync(): Promise<SyncResult>   // 定时同步
  onWebhook(payload: any): Promise<void>  // 外部回调
  
  // 数据映射
  mapToCRM(externalData: any): CRMModel
  mapFromCRM(crmData: any): ExternalModel
}

// src/lib/integrations/registry.ts — 注册中心
const integrationRegistry = new Map<string, IntegrationModule>()
```

**实施路径**：

| 步骤 | 说明 | 前提条件 |
|------|------|---------|
| 1. 定义集成接口 | `IntegrationModule` 抽象 + Registry | 无 |
| 2. Chatwoot 模块 | 实现工单同步（单向 IMPORT） | Job Queue (Phase 3) |
| 3. SignNow 模块 | 实现签约文档同步 + Webhook | SignNow API 账号 |
| 4. 销售系统对接 | 对接外部 ERP/销售数据 | 第三方 API 规范 |
| 5. 管理 UI | 集成状态监控 + 手动触发同步 | Admin 权限 |

> **当前已预留**：`SupportTicket` 模型已包含 `chatwootConvId`、`source` 字段；`SignNowDocument` 模型已完整定义。

#### 5.3.2 AI Agent 集成权限体系

**目标**：允许外部 AI Agent（如「龙虾Agent」）通过 Chat 接口执行 CRM 操作，需有独立的认证、权限范围和审计体系。

**架构设计**：

```
┌─────────────────────────────────┐
│        Chat Interface          │
│  (Slack / 内嵌 Chat / API)     │
└────────────┬────────────────────┘
             │ Agent API Gateway
             ▼
┌─────────────────────────────────┐
│      Agent Authentication      │
│  • API Key (scoped to Agent)   │
│  • Rate Limit (per Agent)      │
│  • Permission Scope (RBAC)     │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│    CRM Business Logic Layer    │
│  (复用现有 API, 加 Agent 审计) │
└─────────────────────────────────┘
```

**Schema 扩展**：

```prisma
model Agent {
  id          String   @id @default(cuid())
  name        String                     // "龙虾Agent"
  description String?
  apiKey      String   @unique            // 用于 API 认证
  active      Boolean  @default(true)
  
  // 权限范围（比 User 更细粒度）
  permissions String?                     // JSON: 允许的操作列表
  allowedCustomers String?                // JSON: 可操作的客户范围
  allowedUsers    String?                 // JSON: 可代理的用户范围
  
  // 审计
  lastUsedAt  DateTime?
  requestCount Int      @default(0)
  createdById Int?
  createdBy   User?     @relation(fields: [createdById], references: [id])
  createdAt   DateTime  @default(now())
}

// 操作审计日志
model AgentAuditLog {
  id        Int      @id @default(autoincrement())
  agentId   String
  agent     Agent    @relation(fields: [agentId], references: [id])
  action    String                     // 'CREATE_CUSTOMER' | 'UPDATE_PIPELINE' | ...
  resource  String                     // 'Customer:123' | 'Pipeline:45'
  request   String?                    // 原始请求 JSON
  response  String?                    // 响应摘要
  success   Boolean
  duration  Int?                       // ms
  createdAt DateTime @default(now())
  
  @@index([agentId, createdAt])
}
```

**Agent 权限粒度**：

| 权限 | 说明 | 默认 |
|------|------|------|
| `customer:read` | 读取客户信息 | ✅ |
| `customer:create` | 新建客户 | ❌ |
| `customer:update` | 编辑客户 | ❌ |
| `pipeline:read` | 查看 Pipeline | ✅ |
| `pipeline:update` | 更新 Pipeline 状态 | ❌ |
| `communication:create` | 添加沟通记录 | ✅ |
| `lead:create` | 新建线索 | ✅ |
| `subscription:read` | 查看订阅 | ✅ |
| `report:read` | 查看报表 | ❌ |
| `admin:*` | 管理操作 | ❌ |

**实施路径**：

| 步骤 | 说明 |
|------|------|
| 1. Agent 模型 + API Key 认证 | 定义 Agent 模型，API Key 鉴权中间件 |
| 2. 权限体系 | 操作级别权限控制（当前 RBAC 的扩展） |
| 3. 审计日志 | Agent 所有操作记录 + 可追溯 |
| 4. Chat Interface | 接入 Slack / 内嵌 Chat UI |
| 5. Agent 管理 UI | Admin 页面创建/管理 Agent |

#### 5.3.3 可配置角色与权限

**目标**：将角色定义和权限矩阵从代码硬编码改为数据库配置，支持管理员通过 UI 自定义角色和权限。

**当前现状**：角色（ADMIN / SALES_MGR / SALES）和权限矩阵硬编码在 `src/lib/auth-helpers.ts` 的 `getDataScope()` 和 `canAccessCustomer()` 中。

**Schema 设计**：

```prisma
model Role {
  id          Int      @id @default(autoincrement())
  name        String   @unique               // "管理员" | "销售主管" | "销售"
  code        String   @unique               // "ADMIN" | "SALES_MGR" | "SALES"
  description String?
  isSystem    Boolean  @default(false)        // 系统内置角色不可删除
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  permissions RolePermission[]
  users       User[]
}

model RolePermission {
  id         Int      @id @default(autoincrement())
  roleId     Int
  role       Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  
  // 资源 + 操作
  resource   String                         // "customer" | "pipeline" | "subscription" | ...
  action     String                         // "create" | "read" | "update" | "delete" | "manage"
  
  // 数据范围
  scope      String   @default("SELF")      // "SELF" | "TEAM" | "REGION" | "ALL"
  
  // 条件约束（JSON）
  conditions String?                        // e.g. {"region": "user.region"} | {"tier": "ENTERPRISE"}
  
  @@unique([roleId, resource, action])
}

// 单个用户的权限覆盖（override）
model UserPermission {
  id         Int      @id @default(autoincrement())
  userId     Int
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  resource   String
  action     String
  effect     String   @default("ALLOW")     // "ALLOW" | "DENY"
  scope      String   @default("SELF")
  expiresAt  DateTime?
  
  @@unique([userId, resource, action])
}
```

**权限评估流程**：

```
User请求 → 查找User.role → 加载RolePermission[]
         → 合并UserPermission[]覆盖
         → 评估 resource+action+scope
         → 返回 ALLOW/DENY
```

**迁移策略**（向后兼容）：

```typescript
// Phase 2E 过渡方案：从代码硬编码逐步迁移到数据库配置
async function checkPermission(user: User, resource: string, action: string): Promise<boolean> {
  // 1. 先查数据库配置（如有）
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId: user.roleId, resource, action }
  })
  if (rolePermissions.length > 0) {
    return evaluatePermissions(rolePermissions, user)
  }
  // 2. 回退到代码硬编码（向后兼容）
  return legacyCheckPermission(user, resource, action)
}
```

**实施路径**：

| 步骤 | 说明 |
|------|------|
| 1. Role + RolePermission 模型 | Schema 定义 + 种子数据（迁移现有角色）|
| 2. 权限评估引擎 | 替换 `getDataScope()` / `canAccessCustomer()` |
| 3. 管理 UI | 角色 CRUD + 权限配置界面 |
| 4. 用户角色选择器 | 用户编辑页改为 Role Select |
| 5. 迁移旧代码 | 逐步移除硬编码权限检查 |

#### 5.3.4 多租户架构（Multi-Tenant）

**目标**：在 CRM 上层增加公司（Tenant）层级，使系统可同时服务多家 B 端餐饮科技公司，每家公司独立管理自己的产品目录、用户、客户数据和权限体系。

**架构设计**：

```
┌─────────────────────────────────────────────────────┐
│                   Platform Layer                     │
│     租户管理 / 计费 / 全局设置 / 平台管理员          │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Tenant A │  │ Tenant B │  │ Tenant C │  ...      │
│  │ Proton   │  │ 竞品公司  │  │ 餐饮集团  │           │
│  │          │  │          │  │          │           │
│  │ 自己的:  │  │ 自己的:  │  │ 自己的:  │           │
│  │ • 用户   │  │ • 用户   │  │ • 用户   │           │
│  │ • 产品   │  │ • 产品   │  │ • 产品   │           │
│  │ • 客户   │  │ • 客户   │  │ • 客户   │           │
│  │ • 权限   │  │ • 权限   │  │ • 权限   │           │
│  │ • 配置   │  │ • 配置   │  │ • 配置   │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│                                                       │
│  ┌─────────────────────────────────────────────┐     │
│  │         Shared Infrastructure               │     │
│  │  PostgreSQL / Job Queue / Search / Storage  │     │
│  └─────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
```

**Schema 设计**：

```prisma
model Tenant {
  id        Int      @id @default(autoincrement())
  name      String   @unique               // "Proton 餐飲科技"
  slug      String   @unique               // "proton"（用于子域名: proton.crm.com）
  logo      String?
  settings  String?                        // JSON: 租户级配置
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users     User[]
  customers Customer[]
  products  ProductCatalog[]
  // ... 其他租户隔离的模型
}

// 所有现有模型新增 tenantId 字段
model User {
  id        Int      @id @default(autoincrement())
  tenantId  Int
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  email     String                            // 改为同租户内唯一
  // ... 其余字段不变
  
  @@unique([tenantId, email])                // 联合唯一
}

model Customer {
  id        Int      @id @default(autoincrement())
  tenantId  Int
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  // ... 其余字段不变
  
  @@index([tenantId, followerId])
  @@index([tenantId, region])
}
```

**数据隔离策略**：

| 策略 | 说明 | 适用阶段 |
|------|------|---------|
| **Schema 隔离** | 每个 Tenant 独立数据库/Schema | 高隔离需求，运维成本高 |
| **Row 隔离** | 同一数据库，所有表加 `tenantId` 字段 | 当前推荐，成本低 |
| **混合** | 核心表 Row 隔离 + 大客户独立实例 | 灵活，复杂度高 |

**推荐方案**：Row 隔离（`tenantId` 字段）+ Prisma 中间件自动注入：

```typescript
// prisma 中间件 — 自动附加 tenantId
prisma.$use(async (params, next) => {
  if (params.model && params.action.startsWith('find') || params.action.startsWith('create')) {
    if (params.args.where) {
      params.args.where.tenantId = currentTenantId
    } else {
      params.args.where = { tenantId: currentTenantId }
    }
  }
  return next(params)
})
```

**租户识别方式**：

| 方式 | 实现 | 场景 |
|------|------|------|
| 子域名 | `proton.crm.com` → Tenant.proton | 正式部署 |
| 路径前缀 | `crm.com/proton/...` | 开发/演示 |
| Header | `X-Tenant-Id: proton` | API 调用 |

**实施路径**：

| 步骤 | 说明 | 前提 |
|------|------|------|
| 1. Tenant 模型 | Schema 定义 + 种子数据 | 无 |
| 2. 所有表加 tenantId | 迁移 + index | PostgreSQL (Phase 3) |
| 3. Prisma 中间件 | 自动注入 tenantId | 无 |
| 4. 租户上下文 | 从请求中识别当前租户 | 无 |
| 5. Platform Admin UI | 租户管理界面 | Admin 权限 |
| 6. 租户入驻流程 | 自助注册 + 初始化配置 | 完整多租户 |

---

## 6. 系统架构与影响范围（v3.0 展望）

### 6.1 Phase 2 Extended 架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│                       Platform Layer                             │
│  Tenant Management / Billing / Global Config / Platform Admin   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  CRM Core Services                        │   │
│  │  Customer / Pipeline / Lead / Subscription / Health / ... │   │
│  └────────────┬──────────────┬──────────────┬───────────────┘   │
│               │              │              │                     │
│               ▼              ▼              ▼                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Integration  │  │   AI Agent   │  │  Configurable │          │
│  │   Gateway    │  │   Gateway    │  │  RBAC Engine  │          │
│  │ (第三方集成)  │  │ (Agent 接口)  │  │ (可配置权限)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Shared Infrastructure                        │   │
│  │  PostgreSQL / Redis (Job Queue) / Search / Object Store  │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 实施路线图

| 阶段 | 内容 | 优先级 | 依赖 |
|------|------|--------|------|
| **Phase 1** (已完成) | Schema 增强 / Validation / API Perf / 事务保护 / RBAC | — | — |
| **Phase 2** (已完成) | 订阅 / 工单 / 健康度 / 分群 / 产品管理 / 仪表板 / 导出 | — | — |
| **Phase 2E-1** | 可配置角色权限 (RBAC 引擎) | P0 | Phase 1 RBAC 基础 |
| **Phase 2E-2** | 第三方集成抽象层 (Integration Gateway) | P1 | — |
| **Phase 2E-3** | AI Agent 认证 + 权限 + 审计 | P1 | Phase 2E-1 (RBAC 引擎) |
| **Phase 3** | PostgreSQL / Search / Job Queue / MV | P0 | 规模增长 |
| **Phase 3E** | 多租户 (Tenant) + Platform Layer | P1 | Phase 3 (PostgreSQL) |
| **Phase 3E-5** | Chatwoot / SignNow 集成实现 | P2 | Phase 2E-2 + Phase 3 |

### 7.3 向后兼容策略

1. **用户角色字段**：`User.role`（String）保持到 Phase 2E-1 完成迁移，之后改为 `User.roleId → Role`
2. **数据隔离**：当前 `getDataScope()` 返回 `where` 条件的方式保持，Phase 2E-1 改为从数据库读取配置
3. **API 签名**：所有现有 API 端点签名不变，新增 endpoint 按需扩展
4. **前端页面**：保持 `'use client'`，新增配置页面使用相同模式
5. **租户字段预留**：Phase 3 迁移 PostgreSQL 时统一添加 `tenantId`，当前不加

---

## 7. 技术栈与工程约束

### 7.1 技术栈

| 层 | 技术 | 版本 | 说明 |
|----|------|------|------|
| **框架** | Next.js | 14.2.x | App Router |
| **语言** | TypeScript | 5.4.x | strict 模式 |
| **UI 库** | Ant Design (antd) | 5.17.x | Card、Table、Modal、Form、Statistic、Progress、Tabs |
| **图标** | @ant-design/icons | 5.3.x | |
| **ORM** | Prisma | 5.14.x | SQLite provider（Phase 1-2） |
| **认证** | NextAuth.js | 4.24.x | JWT 策略 + Credentials Provider |
| **密码** | bcryptjs | 2.4.x | 密码哈希 |
| **日期** | dayjs | 1.11.x | |
| **导出** | xlsx | 0.18.x | CSV 导出 |
| **数据库** | SQLite | （由 Prisma 管理） | 文件: `prisma/dev.db` |

### 7.2 工程约束（不能改什么）

1. **保持 SQLite** — Phase 1-2 全部在 SQLite 上运行，不引入 PostgreSQL/其他数据库
2. **保持 7 个 denormalized 产品字段** — 不删除 Customer 上的 7 个 Status 字段（posStatus、smtStatus 等），ProductInterest 新表与之并存，Phase 3 验证新表完全采用后才移除
3. **Validation 只在 API boundary** — 用自定义 TypeScript validators（npm 沙箱阻止 zod 安装），不在 DB 层加额外约束
4. **无 Global State Manager** — 不用 Redux/Zustand，server state 用 `useState+useEffect+fetch`，client state 用 React useState，Phase 3 引入 React Query
5. **页面保持 `'use client'`** — 不迁移到 Server Components，避免重写两次
6. **Pipeline 0..1** — 一个客户最多一条 active pipeline，不再自动创建 Pipeline
7. **订单不分页** — 不在 SQLite 表上创建外键约束（SQLite 不支持 `ALTER TABLE ADD CONSTRAINT`），用应用层保证引用完整性

### 7.3 代码规范

- API Route: `src/app/api/[resource]/route.ts` — 每个文件独立处理 HTTP method
- 页面: `src/app/[page]/page.tsx` — 全部 `'use client'`
- 布局: `src/components/Layout/AppLayout.tsx` — 统一的侧边栏 + 顶栏布局
- 工具函数: `src/lib/` — auth、prisma、utils、constants、validation、health-score
- 验证: `src/lib/validation/schemas.ts` — 每个 API 对应的验证函数
- 验证基类: `src/lib/validation/index.ts` — 类型断言函数（assertString、assertInt 等）
- 常量: `src/lib/constants.ts` — 受控词表（REGIONS、INTEREST_LEVELS、TIERS 等）
- 权限: `src/lib/auth-helpers.ts` — getDataScope、canAccessCustomer、canAccessUserRecords

### 7.4 部署注意

- 当前开发服务器运行在 `localhost:3000`
- 启动: `npm run dev`（Next.js dev server）
- 构建: `npm run build`（纯静态 + API routes）
- 数据库: `npx prisma migrate dev` + `npx prisma db seed`

---

## 8. 系统架构与影响范围（当前Phase 1-2）

### 7.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Next.js App Router                         │
│                                                                     │
│  ┌────────────────────────┐   ┌──────────────────────────────────┐  │
│  │   Page Routes (20)     │   │   API Routes (37)              │  │
│  │                        │   │                                  │  │
│  │  /dashboard            │   │  GET /api/dashboard              │  │
│  │  /customers            │   │  GET/POST /api/customers         │  │
│  │  /customers/[id]       │   │  GET/PATCH/DELETE /api/customers/[id]││
│  │  /subscriptions        │   │  GET/POST /api/subscriptions     │  │
│  │  /support-tickets      │   │  GET/POST/PATCH /api/support-tickets││
│  │  /customer-health      │   │  GET /api/customer-health        │  │
│  │  /segments/[id]        │   │  GET/POST/PATCH/DELETE /api/segments││
│  │  /products             │   │  GET/POST/PATCH/DELETE /api/products││
│  │  /exports              │   │  GET/POST /api/exports           │  │
│  │  /kanban               │   │  GET/POST/PATCH /api/pipelines   │  │
│  │  /leads                │   │  GET/POST/PATCH /api/leads       │  │
│  │  /visits               │   │  GET/POST /api/visits            │  │
│  │  /admin/users          │   │  GET/POST/PATCH /api/users       │  │
│  │  /login                │   │  POST /api/auth/[...nextauth]    │  │
│  │  ... (more)            │   │  ... (more)                      │  │
│  └────────────────────────┘   └──────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     Middleware Layer                         │   │
│  │                                                              │   │
│  │  getServerSession(authOptions) → 身份验证                     │   │
│  │  getDataScope(session) → 数据范围过滤                         │   │
│  │  validateXxx(data) → 请求体验证                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Data Layer (Prisma + SQLite)                │   │
│  │                                                              │   │
│  │  User → Customer → Pipeline → Communication                  │   │
│  │       → Visit → VisitLog → Lead                              │   │
│  │       → ProductInterest → ProductCatalog                     │   │
│  │       → Subscription → SignNowDocument                       │   │
│  │       → SupportTicket → TicketMessage                        │   │
│  │       → CustomerHealthScore → CustomerSegment → ExportJob    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 涉及的页面 / 路由

#### 页面路由（20 个）

| 路径 | 类型 | 文件 |
|------|------|------|
| `/` | 重定向到 /dashboard | `page.tsx` |
| `/login` | 登录 | `login/page.tsx` |
| `/dashboard` | 仪表板 | `dashboard/page.tsx` |
| `/customers` | 客户列表 | `customers/page.tsx` |
| `/customers/[id]` | 客户详情 | `customers/[id]/page.tsx` |
| `/kanban` | Pipeline 看板 | `kanban/page.tsx` |
| `/visits` | 拜访记录 | `visits/page.tsx` |
| `/visits/new` | 新建拜访 | `visits/new/page.tsx` |
| `/quick-checkin` | 快速签到 | `quick-checkin/page.tsx` |
| `/leads` | 线索列表 | `leads/page.tsx` |
| `/leads/new` | 新建线索 | `leads/new/page.tsx` |
| `/product-stats` | 产品潜力看板 | `product-stats/page.tsx` |
| `/product-stats/[product]` | 产品下钻 | `product-stats/[product]/page.tsx` |
| `/subscriptions` | 订阅管理 | `subscriptions/page.tsx` |
| `/subscriptions/expiring` | 即将到期 | `subscriptions/expiring/page.tsx` |
| `/support-tickets` | 工单列表 | `support-tickets/page.tsx` |
| `/support-tickets/[id]` | 工单详情 | `support-tickets/[id]/page.tsx` |
| `/customer-health` | 健康度仪表板 | `customer-health/page.tsx` |
| `/segments` | 客户分群 | `segments/page.tsx` |
| `/segments/[id]` | 分群详情 | `segments/[id]/page.tsx` |
| `/products` | 产品管理 | `products/page.tsx` |
| `/exports` | 数据导出 | `exports/page.tsx` |
| `/admin/users` | 用户管理 | `admin/users/page.tsx` |
| `/admin/import` | 数据导入 | `admin/import/page.tsx` |

#### API 路由（38 个端点）

| 方法 | 路径 | 用途 | RBAC |
|------|------|------|------|
| GET | `/api/dashboard` | 仪表板聚合数据 | 全部 |
| GET/POST | `/api/customers` | 客户列表 + 新建 | 全部（数据范围过滤） |
| GET/PATCH/DELETE | `/api/customers/[id]` | 客户详情/更新/删除 | 全部 + 所有权检查 |
| GET/POST/PATCH | `/api/pipelines` | Pipeline 列表/创建/更新 | 全部（数据范围过滤） |
| GET/POST/PATCH | `/api/leads` | 线索列表/创建/更新/转化 | 全部（SALES 只看自己） |
| GET/POST | `/api/visits` | 拜访列表/创建 | 全部 |
| GET | `/api/product-stats` | 产品兴趣统计 | 全部 |
| GET/POST/PATCH/DELETE | `/api/products` | 产品目录 CRUD | Admin only for POST/PATCH/DELETE |
| GET/POST | `/api/subscriptions` | 订阅列表/创建 | 全部（数据范围过滤） |
| GET/POST/PATCH/DELETE | `/api/support-tickets` | 工单 CRUD | 全部（数据范围过滤） |
| GET/POST | `/api/support-tickets/[id]/messages` | 工单消息 | 全部 |
| GET/PATCH/DELETE | `/api/segments` | 分群 CRUD | 全部 |
| GET | `/api/segments/[id]` | 分群详情 | 全部 |
| GET | `/api/customer-health` | 健康度列表 | 全部 |
| GET/POST/PATCH | `/api/users` | 用户管理 | Admin only |
| GET/POST/PATCH | `/api/exports` | 导出管理 | 全部 |
| POST | `/api/auth/[...nextauth]` | 登录认证 | 全部 |
| POST | `/api/admin/import` | 数据导入 | Admin only |
| GET/PATCH | `/api/customers/[id]/profile` | 商家档案 CRUD | 全部 + 数据范围过滤 |
| POST | `/api/upload` | 文件上传 | 全部 |

### 7.3 涉及的数据表（18 个 Prisma 模型）

| 模型 | 行数预期 | 关键索引 | 说明 |
|------|---------|----------|------|
| User | 10-50 | email(unique) | 用户账户 |
| Customer | 400,000+ | followerId, region, status, tier | 核心客户 |
| Pipeline | 50,000+ | customerId(unique) | 活跃销售管道 |
| Communication | 数百万 | pipelineId, contactOrder | 沟通记录 |
| Lead | 500,000+ | status, registeredById | 线索 |
| Visit | 100,000+ | customerId, visitedById | 拜访记录 |
| VisitLog | 10,000+ | customerId | 详细拜访日志 |
| ProductCatalog | 10-50 | key(unique) | 动态产品目录 |
| ProductInterest | 数百万 | [customerId, productId](unique) | 规格化兴趣矩阵 |
| Subscription | 200,000+ | customerId, status, endDate | 订阅记录 |
| SupportTicket | 100,000+ | customerId, status, assignedToId | 客服工单 |
| TicketMessage | 数百万 | ticketId | 工单消息 |
| CustomerHealthScore | 400,000+ | customerId(unique) | 健康度评分 |
| MerchantProfile | 400,000+ | customerId(unique), yelpId, googleId, state | 商家档案扩展（1:1） |
| CustomerSegment | 数十 | name(unique) | 客户分群 |
| SignNowDocument | 200,000+ | customerId, subscriptionId | 电子签章（留空） |
| ExportJob | 数千 | requestedById | 导出任务 |

### 7.4 涉及的第三方系统

| 系统 | 状态 | 说明 |
|------|------|------|
| SignNow | Schema 已预留，逻辑未实现 | SignNowDocument 模型已创建，API 集成待 Phase 3 |
| Chatwoot | Schema 已预留 customer.chatwootContactId，逻辑未实现 | 自动工单同步待 Phase 3 |
| 搜索引擎 | 未集成 | 待 Phase 3（Elasticsearch / Meilisearch）|

### 7.5 权限影响（getDataScope 已应用到的 API）

| API 端点 | SALES 过滤方式 | SALES_MGR 过滤方式 |
|----------|---------------|-------------------|
| GET /api/customers | followerId = userId | region = user.region |
| GET /api/customers/[id] | findFirst({ where: { id, followerId: userId } }) | findFirst + scope |
| PATCH /api/customers/[id] | canAccessCustomer() 检查 | canAccessCustomer() 检查 |
| GET /api/pipelines | salesPersonId = userId | customer.region = user.region |
| GET /api/leads | registeredById = userId | 全部（MGR 看团队）|
| GET /api/subscriptions | salesPersonId = userId | customer.region = user.region |
| GET /api/support-tickets | assignedToId = userId | customer.region = user.region |
| GET /api/dashboard | followerId 过滤 | region 过滤 |
| GET /api/customer-health | { customer: { followerId: userId } } | { customer: { region } } |

---

## 9. 数据模型与接口契约

### 8.1 核心数据模型

#### User（用户）

```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  password  String                    // bcrypt hash
  role      String   @default("SALES")   // ADMIN | SALES_MGR | SALES
  region    String?                      // 业务区域（SALES_MGR 必填）
  phone     String?
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  relations: customers[], pipelines[], visits[], visitLogs[], leads[],
             subscriptions[], assignedTickets[], createdSegments[], exportJobs[]
}
```

#### Customer（客户）

```prisma
model Customer {
  id        Int      @id @default(autoincrement())
  sapId     String?
  name      String
  city, region, address, area, storePhone  // 基本信息
  floorManager, floorManagerPhone          // 楼面
  merchantContact, merchantContactPhone    // 商家
  keyman, website, type, storeType, storeSize, notes

  // 400k-scale fields
  status            String   @default("ACTIVE")    // ACTIVE | INACTIVE | ARCHIVED
  tier              String   @default("SMB")       // ENTERPRISE | MID_MARKET | SMB
  source            String?                        // IMPORT | LEAD_CONVERSION | MANUAL | API | PARTNER
  onboardingStatus  String   @default("NOT_STARTED") // NOT_STARTED | IN_PROGRESS | COMPLETED
  healthScore       Float?
  chatwootContactId Int?
  firstPurchasedAt  DateTime?
  lastActivityAt    DateTime?

  // 7 product interest fields（denormalized, 保留至 Phase 3）
  posStatus, psWebsiteStatus, smtStatus, platformManagedStatus,
  aiCamStatus, omeStatus, smartRobotStatus  // String @default("NOT_CONTACTED")

  contactStatus String?   // "合作中" | "已建联"
  followerId    Int?       // → User, nullable（大部分客户无专人跟进）
  follower      User?
  pipeline      Pipeline?
  productInterests ProductInterest[]
  subscriptions    Subscription[]
  supportTickets   SupportTicket[]
  healthScoreObj   CustomerHealthScore?
  visits, visitLogs, leads, signNowDocuments
}
```

#### ProductCatalog（产品目录）— 新增

```prisma
model ProductCatalog {
  id        Int      @id @default(autoincrement())
  key       String   @unique    // e.g. "posStatus", "smtStatus"
  name      String               // e.g. "POS", "SMT"
  category  String?              // CORE | ADDON | SERVICE | HARDWARE
  active    Boolean  @default(true)
  sortOrder Int      @default(0)
  relations: productInterests[], subscriptions[]
}
```

#### ProductInterest（产品兴趣矩阵）— 新增

```prisma
model ProductInterest {
  id         Int      @id @default(autoincrement())
  customerId Int
  customer   Customer @relation(...)
  productId  Int
  product    ProductCatalog @relation(...)
  status     String   @default("NOT_CONTACTED")
  @@unique([customerId, productId])
}
```

#### Subscription（订阅）— 新增

```prisma
model Subscription {
  id            Int      @id @default(autoincrement())
  customerId    Int
  productId     Int
  plan          String   @default("MONTHLY")  // MONTHLY | QUARTERLY | SEMI_ANNUAL | ANNUAL
  status        String   @default("ACTIVE")   // ACTIVE | CANCELLED | EXPIRED | TRIALING | PENDING_SIGNATURE
  mrr           Float    @default(0)           // USD
  startDate     DateTime
  endDate       DateTime?
  autoRenew     Boolean  @default(true)
  salesPersonId Int?
  @@index([customerId, status, endDate])
}
```

#### SupportTicket（客服工单）— 新增

```prisma
model SupportTicket {
  id            Int      @id @default(autoincrement())
  customerId    Int
  subject       String
  status        String   @default("OPEN")   // OPEN | RESOLVED | CLOSED | PENDING
  priority      String   @default("MEDIUM") // LOW | MEDIUM | HIGH | URGENT
  source        String?                      // CHATWOOT | EMAIL | MANUAL | PHONE
  chatwootConvId Int?
  csatScore     Int?                         // 1-5
  assignedToId  Int?
  messages      TicketMessage[]
  @@index([customerId, status, assignedToId])
}
```

#### CustomerHealthScore（客户健康度评分）— 新增

```prisma
model CustomerHealthScore {
  id                  Int      @id @default(autoincrement())
  customerId          Int      @unique
  overallScore        Float    @default(0)    // 0-100
  engagementScore     Float?                  // 互动度
  productAdoptionScore Float?                 // 产品采用
  supportHealthScore  Float?                  // 客服健康
  subscriptionHealth  Float?                  // 订阅健康
  churnRisk           String   @default("LOW")  // LOW | MEDIUM | HIGH
  calculatedAt        DateTime @default(now())
}
```

### 8.2 关键 API 接口契约

#### GET /api/dashboard — 仪表板聚合

**Response 200**:
```json
{
  "totalCustomers": 1500,
  "totalPipelines": 320,
  "totalLeads": 85,
  "totalVisits": 450,
  "activePipelines": 180,
  "leadsByStatus": { "new": 45, "contacted": 30, "converted": 10, "closed": 5 },
  "activeSubscriptions": 680,
  "totalMrr": 125000,
  "churnRiskDistribution": { "LOW": 800, "MEDIUM": 300, "HIGH": 100 },
  "avgHealthScore": 72,
  "customersByTier": [
    { "tier": "ENTERPRISE", "count": 50 },
    { "tier": "MID_MARKET", "count": 200 },
    { "tier": "SMB", "count": 1250 }
  ],
  "topRegions": [
    { "region": "LA EAST", "count": 400 },
    { "region": "LA WEST", "count": 350 }
  ],
  "pipelineByStatus": { "⚠️": 40, "已建联": 80, "初步有意向": 50, "合作中": 10 }
}
```

#### GET /api/customers — 客户列表

**Query Params**: `?search=&region=&type=&status=&tier=&followerId=&productField=&productInterest=&page=&pageSize=&cursor=`

**Response 200**:
```json
{
  "customers": [
    {
      "id": 1, "name": "Golden Dragon", "city": "Los Angeles",
      "region": "LA EAST", "type": "茶餐廳", "tier": "SMB",
      "status": "ACTIVE", "contactStatus": "合作中",
      "posStatus": "PURCHASED", "smtStatus": "INTERESTED",
      "follower": { "id": 5, "name": "John" },
      "pipeline": { "id": 1, "status": "合作中", "active": true }
    }
  ],
  "total": 1500, "page": 1, "pageSize": 20, "nextCursor": 21
}
```

#### GET /api/customers/[id] — 客户详情

**Response 200**:
```json
{
  "id": 1, "name": "Golden Dragon", "region": "LA EAST",
  "tier": "SMB", "status": "ACTIVE", "source": "IMPORT",
  "onboardingStatus": "COMPLETED", "firstPurchasedAt": "2024-01-15T...",
  "lastActivityAt": "2026-05-28T...",
  "follower": { "id": 5, "name": "John" },
  "pipeline": {
    "id": 1, "status": "合作中", "active": true,
    "communications": [{ "contactDate": "...", "record": "...", "contactOrder": 1 }]
  },
  "visits": [{ "id": 1, "visitDate": "...", "outcome": "...", "visitedBy": { "name": "John" } }],
  "healthScoreObj": {
    "overallScore": 85, "churnRisk": "LOW",
    "engagementScore": 80, "productAdoptionScore": 90,
    "supportHealthScore": 75, "subscriptionHealth": 100
  },
  "subscriptions": [
    { "id": 1, "plan": "MONTHLY", "status": "ACTIVE", "mrr": 299,
      "startDate": "...", "endDate": "...", "autoRenew": true,
      "product": { "name": "POS" },
      "salesPerson": { "name": "John" } }
  ],
  "supportTickets": [
    { "id": 1, "subject": "POS 故障", "status": "RESOLVED",
      "priority": "HIGH", "csatScore": 5,
      "assignedTo": { "name": "Support Agent" }, "createdAt": "..." }
  ],
  "productInterests": [
    { "product": { "name": "POS", "key": "posStatus" }, "status": "PURCHASED" }
  ]
}
```

#### POST /api/subscriptions — 创建订阅

**Request**:
```json
{
  "customerId": 1, "productId": 1, "plan": "MONTHLY",
  "status": "ACTIVE", "mrr": 299,
  "startDate": "2026-06-01T00:00:00.000Z",
  "endDate": "2026-07-01T00:00:00.000Z",
  "autoRenew": true, "notes": "New POS subscription"
}
```

**Response 200**: `{ "id": 1, ... }`

#### POST /api/leads (action=convert) — 线索转化（事务保护）

**Request**: `{ "id": 5, "action": "convert" }`

**Response 200（事务成功）**:
```json
{
  "customer": { "id": 100, "name": "New Restaurant" },
  "lead": { "id": 5, "status": "converted", "customerId": 100 },
  "pipeline": { "id": 30, "customerId": 100, "status": "已建联" }
}
```

**失败**：任何一步失败 → 全部回滚，返回 500

#### POST /api/exports — 异步导出

**Request**: `{ "type": "CUSTOMERS", "filters": { "region": "LA EAST" } }`

**Response 200**:
```json
{
  "id": 1, "status": "COMPLETED",
  "rowCount": 400, "fileSize": 24500
}
```

#### GET /api/customer-health?recalculate=true — 重新计算健康度

**Response 200**:
```json
{
  "count": 1200,
  "scores": [ /* CustomerHealthScore 数组 */ ],
  "total": 1200,
  "avgScore": 72,
  "riskDistribution": { "LOW": 800, "MEDIUM": 300, "HIGH": 100 }
}
```

### 8.3 健康度评分算法

```
overallScore = engagementScore × 0.30
             + productAdoptionScore × 0.25
             + supportHealthScore × 0.25
             + subscriptionHealth × 0.20

engagementScore（互动度）:
  daysSinceLastActivity ≤ 7   → 100
  ≤ 30 → 80, ≤ 60 → 60, ≤ 90 → 40, ≤ 180 → 20, > 180 → 0

productAdoptionScore（产品采用）:
  产品兴趣 ≥ INTERESTED 的比例
  ≥ 80% → 100, ≥ 60% → 80, ≥ 40% → 60, ≥ 20% → 40, ≥ 10% → 20

supportHealthScore（客服健康）:
  base = 100, -15 per open ticket, if ≥3 open → -20
  resolved bonus ≤ 15, CSAT adjust ±30

subscriptionHealth（订阅健康）:
  no sub → 40 (new) / 20 (established)
  active sub → base 80, expiring penalty ≤ 40, loyalty bonus ≤ 20

churnRisk:
  ≥ 70 → LOW, ≥ 40 → MEDIUM, < 40 → HIGH
  hard trigger: ≥ 5 open tickets → HIGH
  hard trigger: ≤ 7 days to expire → HIGH
  hard trigger: > 180 days idle → HIGH
```

### 8.4 通用 API 规范

#### 认证失败
```json
{ "error": "Unauthorized" }  // 401
```

#### 权限不足
```json
{ "error": "Forbidden" }  // 403
```

#### 验证失败
```json
{ "error": "name is required" }  // 400
{ "error": "region must be one of: LA EAST, LA DOWNTOWN, ..." }  // 400
```

#### 分页规范（所有 list API 统一）

| 参数 | 默认 | 最大 | 说明 |
|------|------|------|------|
| page | 1 | — | offset-based |
| pageSize | 20 | 200 | 每页条数 |
| cursor | — | — | cursor-based（可选，传值则覆盖 offset）|

#### 响应分页元数据
```json
{
  "data": [...],
  "total": 1500,
  "page": 1,
  "pageSize": 20,
  "nextCursor": 21
}
```

### 8.5 受控词表一览

| 字段 | 允许值 |
|------|--------|
| User.role | `ADMIN`, `SALES_MGR`, `SALES` |
| Customer.tier | `ENTERPRISE`, `MID_MARKET`, `SMB` |
| Customer.status | `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| Customer.source | `IMPORT`, `LEAD_CONVERSION`, `MANUAL`, `API`, `PARTNER` |
| Customer.onboardingStatus | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED` |
| ProductInterest.status / Customer.*Status | `NOT_CONTACTED`, `NOT_INTERESTED`, `AWARE`, `INTERESTED`, `HIGH_INTENT`, `PURCHASED` |
| Pipeline.status | `⚠️`, `已建联`, `初步有意向`, `合作中` |
| Customer.contactStatus | `合作中`, `已建联` |
| Lead.status | `new`, `contacted`, `converted`, `closed` |
| Lead.source | `WEBSITE`, `REFERRAL`, `COLD_CALL`, `EVENT`, `PARTNER`, `OTHER` |
| Subscription.plan | `MONTHLY`, `QUARTERLY`, `SEMI_ANNUAL`, `ANNUAL` |
| Subscription.status | `ACTIVE`, `CANCELLED`, `EXPIRED`, `TRIALING`, `PENDING_SIGNATURE` |
| SupportTicket.status | `OPEN`, `RESOLVED`, `CLOSED`, `PENDING` |
| SupportTicket.priority | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |
| CustomerHealthScore.churnRisk | `LOW`, `MEDIUM`, `HIGH` |
| ProductCatalog.category | `CORE`, `ADDON`, `SERVICE`, `HARDWARE` |
| Customer.type | `茶餐廳`, `正餐`, `酒樓`, `火鍋`, `快餐`, `其他` |
| Customer.region | `LA EAST`, `LA DOWNTOWN`, `LA WEST`, `ORANGE COUNTY`, `WESTERN INLAND EMPIRE`, `SOUTH BAY`, `OUT OF CALIFORNIA` |
| ExportJob.type | `CUSTOMERS`, `SUBSCRIPTIONS`, `TICKETS`, `LEADS` |
| ExportJob.status | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |

---

## 附录 A: 文件结构

```
src/
├── app/
│   ├── layout.tsx                  # 根布局
│   ├── page.tsx                    # 首页（重定向）
│   ├── globals.css
│   ├── login/page.tsx
│   ├── dashboard/page.tsx
│   ├── customers/page.tsx
│   ├── customers/[id]/page.tsx
│   ├── kanban/page.tsx
│   ├── visits/page.tsx
│   ├── visits/new/page.tsx
│   ├── quick-checkin/page.tsx
│   ├── leads/page.tsx
│   ├── leads/new/page.tsx
│   ├── product-stats/page.tsx
│   ├── product-stats/[product]/page.tsx
│   ├── products/page.tsx           # 新增（Phase 2）
│   ├── subscriptions/page.tsx      # 新增（Phase 2）
│   ├── subscriptions/expiring/page.tsx  # 新增（Phase 2）
│   ├── support-tickets/page.tsx    # 新增（Phase 2）
│   ├── support-tickets/[id]/page.tsx    # 新增（Phase 2）
│   ├── customer-health/page.tsx    # 新增（Phase 2）
│   ├── segments/page.tsx           # 新增（Phase 2）
│   ├── segments/[id]/page.tsx      # 新增（Phase 2）
│   ├── exports/page.tsx            # 新增（Phase 2）
│   ├── admin/users/page.tsx
│   ├── admin/import/page.tsx
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── dashboard/route.ts      # 新增（Phase 2）
│       ├── customers/route.ts
│       ├── customers/[id]/route.ts
│       ├── customers/[id]/profile/route.ts  # 新增（MerchantProfile）
│       ├── pipelines/route.ts
│       ├── leads/route.ts
│       ├── visits/route.ts
│       ├── products/route.ts       # 新增（Phase 2）
│       ├── product-stats/route.ts
│       ├── subscriptions/route.ts  # 新增（Phase 2）
│       ├── support-tickets/route.ts # 新增（Phase 2）
│       ├── support-tickets/[id]/route.ts
│       ├── support-tickets/[id]/messages/route.ts
│       ├── customer-health/route.ts # 新增（Phase 2）
│       ├── segments/route.ts       # 新增（Phase 2）
│       ├── segments/[id]/route.ts  # 新增（Phase 2）
│       ├── exports/route.ts        # 新增（Phase 2）
│       ├── exports/[id]/route.ts
│       ├── users/route.ts
│       ├── upload/route.ts
│       └── admin/import/route.ts
├── components/
│   └── Layout/
│       └── AppLayout.tsx
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   ├── backfill-product-interest.ts
│   └── backfill-merchant-profile.ts     # 新增
├── lib/
│   ├── auth.ts                     # NextAuth 配置
│   ├── auth-helpers.ts             # getDataScope + RBAC 工具
│   ├── prisma.ts                   # Prisma 客户端
│   ├── utils.ts                    # 工具函数
│   ├── constants.ts                # 受控词表
│   ├── i18n.ts                     # 国际化
│   ├── health-score.ts             # 健康度评分算法（新增）
│   └── validation/
│       ├── index.ts                # 验证基类（断言函数）
│       └── schemas.ts              # 各 API 验证 schema
```

## 附录 B: Phase 3 待办（后续版本）

- [ ] PostgreSQL 迁移（provider = "postgresql" + Enum + 迁移脚本）
- [ ] 全文搜索引擎（Elasticsearch / Meilisearch）
- [ ] Job Queue（Redis + BullMQ）+ Materialized Views
- [ ] SignNow 电子签章集成（API + Webhook）
- [ ] Chatwoot 客服工单自动同步（Webhook）
- [ ] React Query 迁移（typed API client）
- [ ] Server Components 迁移
- [ ] 批量客户操作（POST /api/customers/batch）
- [ ] BulkOperation 异步任务模型
- [ ] SMB 自助续约流程
- [ ] 交叉销售规则引擎
