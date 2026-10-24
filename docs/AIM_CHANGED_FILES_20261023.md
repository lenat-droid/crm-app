# 本次修改文件

以下为本地三个工作分支相对接手起点的修改。Secret、数据库及原有 Website QA 未纳入。

## crm-app

分支：`codex/aim-leads-integration`。

- `.dockerignore`
- `.env.example`
- `.gitignore`
- `Dockerfile`
- `docker-compose.aim.yml`
- `docker-compose.yml`
- `docs/AIM_CHANGED_FILES_20261023.md`
- `docs/AIM_LOCAL_INTEGRATION_20261023.md`
- `docs/aim-evidence/browser-chain.json`
- `docs/aim-evidence/build-checks.json`
- `docs/aim-evidence/company-inbox-receipt.json`
- `docs/aim-evidence/concurrency.json`
- `docs/aim-evidence/crm-followup-and-retry.png`
- `docs/aim-evidence/emailjs-provider.json`
- `docs/aim-evidence/emailjs-security-before.png`
- `docs/aim-evidence/emailjs-template-audit.png`
- `docs/aim-evidence/local-e2e.json`
- `docs/aim-evidence/local-smtp-received.json`
- `docs/aim-evidence/migration-preservation.json`
- `docs/aim-evidence/no-paid-collection.json`
- `docs/aim-evidence/production-local-smoke.json`
- `docs/aim-evidence/repo-safety.json`
- `docs/aim-evidence/secret-scan.json`
- `docs/aim-evidence/website-received.png`
- `package-lock.json`
- `package.json`
- `prisma/migrations/202610240001_aim_intake/migration.sql`
- `prisma/migrations/migration_lock.toml`
- `prisma/schema.prisma`
- `scripts/aim-emailjs-acceptance.ts`
- `scripts/aim-local-e2e.mjs`
- `scripts/aim-notifications.ts`
- `src/app/api/integrations/aim/leads/route.ts`
- `src/app/api/leads/[id]/route.ts`
- `src/app/api/leads/route.ts`
- `src/app/api/records/route.ts`
- `src/app/leads/[id]/page.tsx`
- `src/app/leads/page.tsx`
- `src/components/Layout/AppLayout.tsx`
- `src/lib/aim-leads.ts`
- `src/lib/aim-notifications.ts`
- `src/lib/export-csv.ts`

## diagnosis-core-v1

分支：`codex/diagnosis-core-v1`。

- `docs/AIM_CRM_LOCAL_20261023.md`
- `gm10-api/src/local/activation-admin.mjs`
- `gm10-api/src/local/activation-sync.mjs`
- `gm10-api/src/local/server.mjs`
- `gm10-api/test/local-activation-origin.test.mjs`

## report-freeze-review

分支：`codex/report-freeze-review`。

- `app.js`
- `docs/AIM_CRM_LOCAL_20261023.md`
- `review/live-report.js`
