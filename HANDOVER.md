# Proton CRM 项目交接文档

> 交接日期: 2026-10-23 ｜ 当前版本: **v1.3.1**
> 代码仓库: **公司 GitLab `gitlab.sjfood.us/osc-ai/proton-crm` 为主仓库**（GitHub `lenat-droid/crm-app` 为镜像，历史上曾长期落后，已于交接时同步）
> 读者: 接手本项目的开发同事

---

## 1. 项目是什么

Proton CRM 是面向**美国中/亚洲餐厅**餐饮科技公司的销售 CRM，服务 10+ 人销售团队（中英文），管理 40 万+ 餐厅客户。核心能力：

- 客户 / 线索 / Pipeline（商机）管理
- 订阅管理（MRR / ARPU / 流失）
- 客户健康度评分（4 维度加权，流失预警）
- 产品兴趣矩阵（7 条产品线 × 6 级意向）
- 跟进闭环（今日跟进工作台 + 5 条自动提醒规则）
- 仪表盘（按时间筛选 KPI / 漏斗 / MRR 趋势）+ 每周复盘 + 团队活动量
- 经营数据看板 `/operating-dashboard`（营收/GMV/门店/部署，v1.3.0）
- 数据开放层：Admin Read API (`/api/integration/*`) + MCP Server，供 AI Agent 消费（v1.3.1）
- 数据导出（CSV）、客户分群、客服工单

**重要**：项目正在从"记录工具"转向"销售工作台 + 云端 Agent 对接"（v1.1.0 打了地基，详见 §8）。

---

## 2. 技术栈与运行环境

| 组件 | 说明 |
|---|---|
| 框架 | Next.js 14 (App Router) + React 18 + TypeScript |
| 数据库 | **PostgreSQL**（`docker-compose.yml` 起 postgres:16-alpine；⚠️ 本地也有 SQLite `prisma/dev.db` 的历史遗留，schema 现为 postgresql provider） |
| ORM | Prisma 5（已有 migration 基线 `prisma/migrations/1_init`，v1.3.1 起；历史上靠 `prisma db push` 增量加列） |
| UI | Ant Design 5 + @ant-design/charts (v2, 依赖 plots) + Tailwind；中英文国际化 `src/lib/i18n.ts`（侧边栏底部切换 EN/中） |
| 认证 | NextAuth v4（凭据登录，bcryptjs 密码），session 含 `user.id / role / region` |
| 其他 | dayjs、xlsx（Excel 导入）、Next standalone 输出 + Node 20 Docker 部署 |

---

## 3. 本地启动

```bash
# 1) 起 Postgres
docker compose up db -d

# 2) 配置 .env（参照 §5）
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crm_app?schema=public
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<任意随机串>
UPLOAD_DIR=./public/uploads

# 3) 建库 + 种子 + 启动
npm install          # postinstall 自动 prisma generate
npx prisma db push
npm run db:seed      # prisma/seed.ts (tsx)
npm run dev
```

常用命令：`npm run build` / `npm run lint` / `npm run db:studio`（可视化看库）。

**Docker 一键部署**：`docker compose up --build` — 镜像启动时自动 `prisma db push && prisma db seed && node server.js`。注意 compose 里的 `NEXTAUTH_SECRET` 是占位值，生产必须替换。

---

## 4. 架构核心（改动前必读）

### 4.1 数据权限 RBAC — `src/lib/auth-helpers.ts`
所有查询/导出必须走 `getDataScope(session)` 生成的 Prisma where：
- `ADMIN` → 全部数据
- `SALES_MGR` → 仅自己 `region` 的数据（历史上出过越权 bug，v1.0.2 已修，新增 API 务必带上）
- `SALES` → 仅自己跟进的（`followerId`）；⚠️ v1.3.0 起沟通/拜访记录放宽：全员可写，SALES 可看团队范围

内部 API 例外：`x-agent-token` 认证走 `src/lib/agent-auth.ts`，v1.3.1 的 `/api/integration/*` 走 session + `INTEGRATION_API_TOKEN`（见 §8）。

### 4.2 客户健康度 — `src/lib/health-score.ts`
4 维度加权：互动度 30% + 产品采用 25% + 客服健康 25% + 订阅健康 20%，各维度 0-100。风险分级：LOW(≥70) / MEDIUM(40-69) / HIGH(<40)。结果落 `CustomerHealthScore` 表。

### 4.3 产品兴趣矩阵
历史上 7 个产品线字段硬编码在 Customer 上（posStatus / psWebsiteStatus / smtStatus / platformManagedStatus / aiCamStatus / omeStatus / smartRobotStatus），级别 NOT_CONTACTED → … → PURCHASED。v2.0 起新增了 `ProductCatalog` + `ProductInterest` 模型做动态化，**新代码优先用新模型**，老字段仍在使用中，注意两套并存。

### 4.4 跟进规则引擎 — `src/lib/followups.ts`
5 条确定性规则（新客 24h 未首联 / 有意向 3 天无回音 / 今日到期 / 静默 30 天 / 成交 30 天回访），阈值走环境变量（`FOLLOWUP_*`），**不要**把规则逻辑放进 Agent/LLM。

### 4.5 表单校验 — `src/lib/validation/schemas.ts`
所有 API 写入路由必须调用这里面的校验函数（assertString / assertInt / assertOneOf…），错误抛 `ValidationError`，API 统一 400。

### 4.6 Toast — `src/lib/toast.ts`
前端统一用 `toastSuccess/Error/Warning/Info` + `apiFetch` + `handleApiError`，不要直接用 antd 的 message。

---

## 5. 环境变量清单

| 变量 | 用途 |
|---|---|
| `DATABASE_URL` | Postgres 连接串 |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` | NextAuth |
| `UPLOAD_DIR` | 本地文件上传目录（默认 `public/uploads`） |
| `AGENT_API_TOKEN` | 云端 Agent 调内部 API 的 Bearer token（`/api/followups/due`、客户 context、写跟进） |
| `INTEGRATION_API_TOKEN` | v1.3.1 Admin Read API（`/api/integration/*`）的 API token；MCP Server 用同一个值（`mcp/.env.example` 里叫 `API_TOKEN`） |
| `CRON_SECRET` | 保护 `POST /api/cron/daily-digest` |
| `WECOM_WEBHOOK_SALES` / `WECOM_WEBHOOK_MGMT` | 企微群机器人 webhook（销售群日报 / 管理群汇总）；未配置时 dry-run 返回消息内容 |
| `FOLLOWUP_NEW_LEAD_HOURS` / `FOLLOWUP_INTENT_DAYS` / `FOLLOWUP_SILENT_DAYS` / `FOLLOWUP_WON_CHECKIN_DAYS` | 跟进规则阈值，可覆盖默认值 |

---

## 6. 页面与 API 地图

**页面**（`src/app/`）：dashboard（仪表盘+时间筛选）、customers（列表：批量编辑 + 产品兴趣筛选；详情 Tab：订阅/健康度/工单/经营数据等）、kanban（Pipeline 看板）、today（今日跟进工作台，移动优先）、weekly-review（每周复盘）、leads / visits / subscriptions / support-tickets / segments / records（统一时间线）、products / product-stats / customer-health、operating-dashboard（经营数据，16:9 单屏 6 图区）、exports、admin（用户/导入）、quick-checkin。

**API**（`src/app/api/`）：与页面对应，另有内部接口：
- `GET /api/followups/due` — 到期/超期跟进清单，按负责人分组（session RBAC 或 `x-agent-token`）
- `GET /api/customers/[id]/context` — 客户画像+阶段+意向+订阅+近 5 条记录打包（给 Agent 生成话术）
- `POST /api/customers/[id]/followups` — 写跟进记录；Agent token 写入时 `source=agent`，能力上限 = 追加记录 + 改跟进时间，**不能**改阶段/删数/碰金额
- `POST /api/cron/daily-digest` — 企微群日报，`CRON_SECRET` 保护
- `POST /api/metrics/snapshot` — 管理员触发周度指标快照（幂等；v1.2.5 起复盘页无快照时自动触发）
- `GET /api/team-stats` — 按周聚合每人活动量
- `PATCH /api/customers/bulk` — 客户批量编辑（contactStatus/type/storeType/region），SALES 仅可改自己客户
- v1.3.0 经营数据：`GET /api/operating`（看板 KPI）、CRUD `/api/revenue`、`/api/transactions`（支持批量）、`/api/deployments`
- v1.3.1 数据开放层：`GET /api/integration/customers`（12+ 过滤参数）、`/api/integration/customers/[id]`（完整画像）、`/api/integration/stats`（15 种聚合 metric），认证 = session 或 `INTEGRATION_API_TOKEN`
- `GET /api/exports/[id]/download` — CSV 按需重生成（带 UTF-8 BOM，Excel 中文不乱码）

**MCP Server**（`mcp/`）：stdio 模式，4 个 tools（search_customers / get_customer_profile / get_customer_stats / get_operating_metrics），封装 `/api/integration/*` 给 AI Agent；启动见 `mcp/README.md`。

**cron**（宿主机 crontab，无框架内调度）：`30 8 * * * curl -s -X POST "https://<host>/api/cron/daily-digest?secret=$CRON_SECRET"`

---

## 7. 数据模型（`prisma/schema.prisma`，20 个 model）

User（含 targetMRR/targetCustomers 配额）、Customer、MerchantProfile、Pipeline（含 nextFollowUpAt/nextAction/closeReason）、Communication（含 source: manual/agent）、Visit、VisitLog、Lead、ProductCatalog、ProductInterest、Subscription（v1.3.0 增 billingStartDate/contractEndDate）、SupportTicket、TicketMessage、CustomerHealthScore、CustomerLog、CustomerSegment、SignNowDocument、ExportJob、WeeklyMetricSnapshot、RevenueRecord、TransactionMetric、ProductDeployment（后三个为 v1.3.0 经营数据新增）。

Schema 演进策略：历史上全部增量字段，生产用 `prisma db push` 加列；v1.3.1 建立了 migration 基线（`prisma/migrations/1_init`），新变更应走 `prisma migrate dev`。

---

## 8. 版本演进（按 commit 时间）

| 版本 | 主题 | 要点 |
|---|---|---|
| v1.0.1 | 图表与体验 | 仪表盘 MRR 趋势 Line + 健康度饼图；订阅 Tab 统计卡；健康度 Tab + 雷达图；表单校验补齐；搜索高亮；toast 统一 |
| v1.0.2 | 纯 bug 修复 | SALES_MGR 越权修复（dashboard/records/导出按 region 隔离）；导出真实下载；records 分页性能 |
| v1.1.0 | **跟进闭环 + Agent 地基** | `nextFollowUpAt`/`closeReason`/`source` 字段；跟进规则引擎；Agent 内部 API 三件套；企微日报；`/today` 工作台；移动端 Drawer 布局；看板超期高亮；订阅取消/恢复 |
| v1.2.0 | 仪表盘日期筛选 + 每周复盘 + **中英文国际化** | 仪表盘时间范围筛选；真漏斗 + 赢率；WoW/MoM 环比；`/weekly-review` 复盘页；`/api/team-stats`；`WeeklyMetricSnapshot`；全页面 i18n + 分享链接提交错误诊断修复（GitLab 上的 v1.2.0 在此基础上比本地多出国际化部分） |
| v1.2.5 | 批量编辑 + 语言切换 | 客户批量编辑 API + UI；产品线×兴趣二级筛选；侧边栏 EN/中 切换；复盘页无快照自动计算；周度快照 MRR 计算简化 |
| v1.3.0 | **AIM 经营数据看板** | 新表 RevenueRecord / TransactionMetric / ProductDeployment；`/operating-dashboard` 单屏看板；客户详情新增经营数据 Tab；跨销售拜访权限放宽 |
| v1.3.1 | **Admin Read API + MCP Server** | `/api/integration/*` 三接口 + `INTEGRATION_API_TOKEN`；`mcp/` MCP Server（4 tools）；Prisma migration 基线建立 |

详细发布说明见仓库根目录 `Proton CRM v1.1.0 / v1.2.0 发布说明.md`，v1.2.0 需求文档在 `docs/`。

---

## 9. 已知问题与待办

**P2 待办**（CLAUDE.md 已列）：
- 客户详情 → 支持工单 Tab（目前工单只在独立页）
- 批量导入客户优化（进度条 + 错误报告；`scripts/` 下有几个临时导入脚本可参考后清理）
- 仪表盘按人/区域下钻（personId/region 筛选参数）

**P3**：暗色模式、移动端响应式进一步优化。

**接手时注意的技术债**：
1. 根目录 CLAUDE.md 版本号停在 v1.1.0 且部分描述过时（SQLite、待办清单），接手后建议更新它
2. 仓库根目录有一份需求分析笔记 `2026-07-26_分析一个这个项目…md` —— 用户视角的产品问题清单，规划 v2.0 方向时先读它
3. 产品兴趣矩阵新老两套模型并存（§4.3），后续需收拢
4. 企微 webhook 未配置时功能静默 dry-run，上线时确认已配置
5. GitHub 镜像仓库（`lenat-droid/crm-app`）历史上长期落后，若继续使用需约定同步机制

---

## 10. 文档与参考资源

| 文件 | 内容 |
|---|---|
| `CLAUDE.md` | 项目结构、架构要点、各版本变更记录（⚠️ 内容停在 v1.1.0，以本交接文档 + 发布说明为准） |
| `docs/requirements.md` | 系统需求文档 v2.0（背景、为什么重构、目标架构） |
| `docs/ontology.md` | 领域模型/术语定义 |
| `Proton CRM v1.1.0 发布说明.md` | v1.1.0 详细发布说明（含运维说明） |
| `prisma/seed.ts` | 种子数据（含演示账号） |

---

## 11. 交接清单（Checklist）

- [ ] 拿到生产/测试环境变量（尤其 `NEXTAUTH_SECRET`、`AGENT_API_TOKEN`、`CRON_SECRET`、企微 webhook）——请前任或运维在密码管理器里移交，**不要**用 docker-compose 里的示例值
- [ ] GitLab 仓库权限：`gitlab.sjfood.us/osc-ai/proton-crm`
- [ ] 生产部署方式确认（Docker compose？宿主机 crontab 里的 daily-digest 任务是否在跑）
- [ ] 用种子/演示账号在本地跑通：登录 → 仪表盘 → 看板 → `/today` 记一笔
- [ ] 通读 `CLAUDE.md` + `docs/requirements.md`
