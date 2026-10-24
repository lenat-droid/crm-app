# AIM Growth 1.0 × Proton CRM 本地联调交付

执行日期：2026-10-23（America/Los_Angeles；证据 JSON 时间使用 UTC）。本页仅记录实际完成的测试；公司收件证据单独记录，不能用 Provider 接受请求代替。

## 源码与边界

| 项目 | 本次起点 | 工作分支 |
| --- | --- | --- |
| Proton CRM | `cfd20ae9887ff523d2213bfe6612b315062dd00f` | `codex/aim-leads-integration` |
| Growth Manager | `30e4511b4aba91eae928d01053dd07ab93a9ff19` | `codex/diagnosis-core-v1` |
| AIM Website | `87cb15c140e346974d18003e4801fba02a7855d1` | `codex/report-freeze-review` |

已读取两份 AIM 交接及 CRM `HANDOVER.md`，并核对真实代码。只读 `ls-remote` 确认 GitHub CRM main 与交接文档中的 GitLab `osc-ai/proton-crm` main 同为上述 `cfd20ae…`。GitLab 是交接指定的生产源；本次仅本地实现、提交，无生产部署、GitLab 写入或生产数据库连接。部署前必须再次回读两个远端，确认后续差异。

Growth main `c542457bac7305905f2da4aa485487d98d548957`、Website main `99d2cd2f03b318f847a525b11fe61422f5173fac`、冻结 PR #5 `019bff43f324825ce3974c2904072ba40c6976ad` 不变；Website 的 51 个冻结文件 SHA256 全部一致。Website 原有四组未跟踪 QA 文件保留，不纳入本次提交。

## 已实现

- CRM `POST /api/integrations/aim/leads`：独立 Bearer Secret（至少 32 字符），公开分享 Token、浏览器会话均不能替代。校验 JSON、大小、字段、来源及同意记录。
- `Lead.aimApplicationId` 唯一。相同申请重复请求返回相同 CRM ID；同 ID 更换联系信息或同意内容返回 409。创建线索与通知任务为原子嵌套写入。初始 `new`，不会创建 Customer 或 Pipeline。
- 保存姓名、邮箱、餐厅、Place/Report ID、`AIM Website`、同意文案/版本/时间、提交时间。报告身份来自原浏览器会话拥有的完成报告；无报告直接申请的 Place/Report ID 为空。
- 线索列表、详情和导航入口支持运营查看联系信息、来源、通知结果及跟进。AIM 的写入、详情、列表、记录总览、导出都应用权限范围；默认未分配申请仅 ADMIN 可见。可配置现有有效运营 Owner/Region。历史手工线索权限与自动建客/Pipeline 行为保留。
- 通知队列在数据库内持久化，独立 worker 领取，`SKIP LOCKED` 防止并发重复领取。限次指数退避，记录每次结果及允许列举的错误码，不保存 Provider 原始响应或凭证。
- `sent` 表示邮件服务接受请求。`uncertain` 表示可能已经发送（超时或进程中断），必须先核对服务历史/收件箱，再人工决定是否重试；不会盲目自动重发。SMTP/EmailJS 无跨系统事务，不能承诺数学意义的 exactly-once 投递。
- Growth 保留 `/api/leads` 与 SQLite；提交先落库，再异步同步 CRM。记录 `pending/synced/failed`、CRM ID、尝试次数、下一次时间及安全错误码。中断可恢复。浏览器只收到本地申请确认，不收到 CRM 私有数据或 Token。
- SQLite 增量加列/索引，历史记录标为 `legacy`，不会未经审核自动外发。新增申请按原始申请 ID 同步。表单重试使用不含联系信息的幂等标识。
- 官网保留 Request Setup 表单；动态报告向申请传递 Report ID。成功仅提示申请收到和团队联系；内部失败对访客显示通用提示。

## EmailJS 审计与复用

已审计 Website `main/index.html` 和已登录控制台：

- 原 Service `service_gvcl4fx`，原 Template `template_3967tjg`；已有公司 163 企业 SMTP、SSL 465。没有新增公网邮件服务或更改原邮箱服务配置。
- 模板固定收件人为 `support@aipocketstore.com`，使用默认发件邮箱，正文变量为 `from_name`、`restaurant`、`from_email`、`phone`、`modules`；发件名称/回复地址还使用 `name`、`email`。
- 服务端使用官方 REST `https://api.emailjs.com/api/v1.0/email/send`，携带 Public Key 和独立 Private Key，凭证只在服务器端。沿用原模板，`modules` 放入来源、提交时间、受保护 CRM 链接和通知 ID，避免更改旧官网模板。
- `MAIL_TO` 必须与该固定模板的实际收件人一致；模板的固定 To 是最终路由。以后变更收件人需要另行审核 EmailJS 模板，不能仅修改环境变量就宣称目标已变化。
- 账号原先未启用 non-browser API；用户协助启用并将现有 Private Key 写入被忽略的本地 Secret 文件。没有刷新密钥。Public Key 从旧官网读取，未在文档重复刊载。
- 真实服务端验收：错误 Key → HTTP 403、线索保留；确认未投递后同一任务重排，正确 Key → 接受请求。共 2 次尝试，见 `aim-evidence/emailjs-provider.json`。公司邮箱实际收件已由用户在真实收件箱核对并提供邮件原文，见 `aim-evidence/company-inbox-receipt.json`。显示收件时间为2026-10-24 13:18（邮箱显示时区未提供）；通知 ID、来源、提交时间及 CRM 链接与数据库一致。自动访问公司 Webmail 被浏览器站点安全策略阻止，收件证据明确标为用户直接核对，未绕过限制。

官方接口：[Send](https://www.emailjs.com/docs/rest-api/send/)、[Private Key](https://www.emailjs.com/docs/sdk/options/)。本地 SMTP 仅为阶段性验收。

## 本地服务及实测证据

| 服务 | 本地地址/状态 |
| --- | --- |
| CRM Next.js | `http://127.0.0.1:3000` |
| PostgreSQL 16 | `127.0.0.1:55432`，独立 `.local/postgres`，数据库 `crm_aim_e2e` |
| Growth Node + SQLite | `http://127.0.0.1:8794`，独立 `.local/crm-e2e/growth.sqlite` |
| 官网代理 | `http://127.0.0.1:4196/get-started` |
| Mailpit SMTP / 收件箱 | `127.0.0.1:11025` / `http://127.0.0.1:18025`，实际 SMTP 入箱并保存 |

阶段测试使用合成 `.test` 联系方式，无真实客户地址；公司测试邮件只发给授权运营邮箱。诊断报告身份测试通过合成完成报告入库，无新增 Places/模型付费采集。

- `aim-evidence/local-e2e.json`：9 项真实 HTTP/数据库/SMTP 验收，包括申请保存、CRM 故障及恢复、去重、未授权访问、运营登录/跟进、手工建客行为、邮件失败恢复、重试耗尽、过期租约。
- `local-smtp-received.json`：Mailpit 收件 ID、主题、实际正文与 CRM 链接。
- `migration-preservation.json`：独立旧 schema 数据库中预置历史线索，增量迁移前后历史字段哈希一致，历史线索未产生通知。未清空/重置数据。
- `concurrency.json`：8 个并发初始请求，1 条 CRM 线索、1 个通知任务。
- `browser-chain.json`、`website-received.png`、`crm-followup-and-retry.png`：真实浏览器提交、运营登录、查看并保存“已联系”，重新加载确认持久化；同一申请邮件失败后恢复。
- 公司收件：用户提供实际公司邮箱收到的完整测试邮件内容，见 `company-inbox-receipt.json`，不以本地 Mailpit 或 Provider 接受请求替代。
- Growth 原 Revenue/样例回归：24/24；HTTPS Origin/Secure Cookie/非法 Host 测试1/1；冻结源文件 SHA256：51/51。
- CRM 最终 Next.js生产构建、TypeScript及本次修改的定向ESLint均通过，生产构建已在本地启动并复核认证API。Docker/Compose未运行。

`npm run lint` 在原仓库没有 ESLint 配置时会进入交互式设置，不能记为通过。使用临时本地配置继承 `next/core-web-vitals` 检查本次修改；不把临时工具配置提交。

## 环境变量及启动

参考根目录 `.env.example`，真实配置只放 Secret/忽略文件。

| 范围 | 必需/可选变量 |
| --- | --- |
| CRM | `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `CRM_INGEST_TOKEN` |
| 运营分配 | 可选 `AIM_LEAD_OWNER_ID`, `AIM_LEAD_REGION`；未配置时 ADMIN 接收 |
| 通知 | `MAIL_PROVIDER=emailjs`, `MAIL_FROM`, `MAIL_DOMAIN`, `MAIL_TO`, `CRM_PUBLIC_URL` |
| EmailJS | `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY` |
| 邮件重试 | 可选 `MAIL_MAX_ATTEMPTS`（默认5，上限10）、`MAIL_RETRY_BASE_MS`（默认60秒） |
| 本地 SMTP | `MAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`；外部 SMTP 另需 `SMTP_USER`, `SMTP_PASSWORD`，强制 TLS |
| Growth | `CRM_API_URL`（CRM origin 或完整 intake URL）、`CRM_INGEST_TOKEN`；可选 `CRM_SYNC_MAX_ATTEMPTS`（默认5，上限10）、`CRM_RETRY_BASE_MS`（默认60秒） |
| Growth 本地/代理 | `GM10_ENV_FILE`, `GM10_STATE_DIR`, `GM10_PORT`, `GM10_WEB_PORT`；测试 `GM10_NO_PROVIDER_LOOKUP=1`；未来 HTTPS 同源代理用 `GM10_WEB_ORIGIN`（精确 HTTPS origin，启用 Secure Cookie） |

CRM Web 与 worker 是两个进程；Web 不隐式启动定时发送。仓库内执行：

```sh
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev -- --hostname 127.0.0.1 --port 3000
# 另一个终端，SMTP 阶段配置来自 .env：
npm run notifications
# 公司 EmailJS 配置覆盖阶段配置，另一个终端二选一运行：
node --env-file=.env --env-file=.secrets/emailjs.env --import tsx scripts/aim-notifications.ts
```

本地合成运营账号在 `.secrets/test-users.json`，不提交或打印密码。PostgreSQL 密码在 `.secrets/postgres-password`。不要在已有数据库执行 seed/reset。

Growth 仓库：

```sh
GM10_NO_PROVIDER_LOOKUP=1 GM10_ENV_FILE=.secrets/crm-e2e.env GM10_STATE_DIR=.local/crm-e2e node gm10-api/src/local/server.mjs
```

Website 仓库：

```sh
python3 review_server.py --port 4196 --diagnosis-api http://127.0.0.1:8794
```

阶段 E2E（必须使用上述独立测试 DB、SMTP 阶段 `.env`；会新增合成记录，不清理旧记录）：

```sh
node --env-file=.env --import tsx scripts/aim-local-e2e.mjs
```

`aim-emailjs-acceptance.ts` 是有实际公司邮件副作用的一次性验收脚本，拒绝重跑已经发送的任务；不要当普通自动化测试反复运行。

## 运维恢复

- CRM 通知默认5次，达到上限保留 `failed` 和日志；修复配置后仅在已确认未投递、且尚有尝试预算时执行：

```sh
node --env-file=.env --env-file=.secrets/emailjs.env --import tsx scripts/aim-notifications.ts --requeue NOTIFICATION_ID --confirmed-not-delivered
```

- `uncertain` 先查服务历史/实际收件箱，确认没有送达后才重排。不得清零尝试次数。确需扩大预算时临时调高配置，但总上限10次。
- Growth 在本地使用无联系信息输出的 CLI：

```sh
GM10_STATE_DIR=.local/crm-e2e node gm10-api/src/local/activation-admin.mjs
GM10_STATE_DIR=.local/crm-e2e node gm10-api/src/local/activation-admin.mjs retry APPLICATION_ID
```

## 周一 2026-10-26 部署步骤（未执行）

1. 回读 GitLab/GitHub CRM 部署源和目标环境，审核本次三个分支提交；保留 main、PR #5 和冻结源。确认现有 CRM 用户、区域及运营负责人，按已有权限分配 Owner/Region。
2. 对现有 PostgreSQL 与 Growth SQLite 做可恢复备份；校验迁移历史。若旧 CRM 由 `db push` 初始化且没有 Prisma 基线，先比对实际 schema 与 `1_init`，确认一致后仅将 `1_init` 标记 applied，再执行新增迁移。不能对已有库重新运行初始化 SQL、seed、reset 或 `db push`。
3. 从 Secret 注入凭证，复用已有 NextAuth Secret、EmailJS 服务和模板。CRM 与 Growth 的 ingest Token 相同且独立。生产 `CRM_PUBLIC_URL` 必须是受保护的 HTTPS CRM；先核对固定模板 To。Private Key 不进入浏览器、构建参数、Git、镜像或日志。
4. 使用现有 GitLab 部署流程发布经审核的 CRM 分支，并运行 `prisma migrate deploy`。Docker 启动已改为迁移、不再自动 seed；可选 `docker-compose.aim.yml` 提供 worker，但本机无 Docker，未运行镜像/Compose 验收。现有旧库基线须在启动前准备完成。
5. 由现有进程管理器常驻 Web 和单个通知 worker；监控 failed/uncertain/待处理数量及进程退出。worker 需数据库和 EmailJS 出站权限，遵守每秒一次的账号限额。
6. Growth Node 保持 loopback 监听及私有持久化目录，通过官网 HTTPS 同源 `/api/*` 反向代理访问；代理把上游 Host 设为实际 loopback host:port，并保留浏览器 Origin。配置精确 `GM10_WEB_ORIGIN`，不开放通配 Origin/任意 Host。官网静态资源发布与同源 API 路由需在目标环境另行校验；Python review server 是本地验收工具。
7. 使用一条经授权的合成申请验收官网保存、CRM new、邮件实际收件、运营跟进；再验证幂等和一次安全失败恢复。验收前不重复付费采集，不用真实客户联系方式。最终启用入口前核对公司收件证据。
8. 回滚优先回滚应用及停止 worker，保留增量列、通知任务和原申请，避免数据丢失；恢复配置后按幂等 ID 重放。数据库回滚从备份及数据比对计划执行，不删除新增数据。
