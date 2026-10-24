// Explicit company test: sends only the synthetic browser acceptance request.
// First request intentionally uses a wrong key; the same durable job recovers.
import { notificationTick, requeueNotification } from '../src/lib/aim-notifications'
import { prisma } from '../src/lib/prisma'
import assert from 'node:assert/strict'
import fs from 'node:fs'

async function main() {
  const url = new URL(process.env.DATABASE_URL!)
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55432'); assert.equal(url.pathname, '/crm_aim_e2e')
  assert.equal(process.env.MAIL_PROVIDER, 'emailjs'); assert.equal(process.env.MAIL_TO, 'support@aipocketstore.com')
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: Number(process.argv[2]) }, include: { notification: true } })
  assert.equal(lead.name, 'AIM CRM Browser Acceptance 20261023')
  assert.equal(lead.email, 'synthetic-browser@example.test')
  assert.equal(lead.notification?.status, 'pending')
  const pending = await prisma.leadNotification.findMany({ where: { status: { in: ['pending', 'retry', 'sending'] } } })
  assert.equal(pending.length, 1); assert.equal(pending[0].leadId, lead.id)
  const original = process.env.EMAILJS_PRIVATE_KEY
  assert(original && original.length > 8)
  process.env.EMAILJS_PRIVATE_KEY = 'invalid_aim_acceptance_key'
  const failed = await notificationTick()
  process.env.EMAILJS_PRIVATE_KEY = original
  assert.equal(failed?.status, 'failed'); assert.equal(failed?.errorCode, 'emailjs_http_403')
  assert.equal((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).aimApplicationId, lead.aimApplicationId)
  await new Promise(resolve => setTimeout(resolve, 1300))
  await requeueNotification(lead.notification!.id, true)
  const recovered = await notificationTick()
  const job = await prisma.leadNotification.findUniqueOrThrow({ where: { id: lead.notification!.id }, include: { logs: { orderBy: { attempt: 'asc' } } } })
  fs.writeFileSync('docs/aim-evidence/emailjs-provider.json', JSON.stringify({ checked_at: new Date().toISOString(), lead_id: lead.id, application_id: lead.aimApplicationId, notification_id: job.id, failed, recovered, attempts: job.logs.map(({ attempt, outcome, errorCode, createdAt }) => ({ attempt, outcome, errorCode, createdAt })), provider_accepted_at: job.sentAt, mailbox_receipt: 'pending_actual_inbox_verification' }, null, 2))
  assert.equal(recovered?.status, 'sent')
  console.log('PASS real EmailJS rejection then same-job recovery; actual inbox receipt still required')
}
main().catch(() => { console.error('emailjs_acceptance_incomplete; inspect safe job status'); process.exitCode = 1 }).finally(() => prisma.$disconnect())
