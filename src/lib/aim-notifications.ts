import nodemailer from 'nodemailer'
import { prisma } from './prisma'

class DeliveryError extends Error {
  constructor(public code: string, public uncertain = false, public permanent = false) { super(code) }
}
const required = (key: string) => { const value = process.env[key]; if (!value) throw new DeliveryError('mail_configuration_missing', false, true); return value }
const maxAttempts = () => Math.max(1, Math.min(10, Number(process.env.MAIL_MAX_ATTEMPTS) || 5))
const retryMs = () => Math.max(1000, Number(process.env.MAIL_RETRY_BASE_MS) || 60000)
const mailbox = (value: string) => /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value)

async function deliver(job: any) {
  const to = required('MAIL_TO'), from = required('MAIL_FROM'), domain = required('MAIL_DOMAIN')
  if (!mailbox(to) || !mailbox(from) || !/^[a-z0-9.-]+$/i.test(domain) || !from.toLowerCase().endsWith('@' + domain.toLowerCase())) throw new DeliveryError('mail_configuration_invalid', false, true)
  const url = new URL(required('CRM_PUBLIC_URL'))
  const loopback = ['127.0.0.1', 'localhost'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback) || url.username || url.password || url.search || url.hash) throw new DeliveryError('crm_link_invalid', false, true)
  const link = new URL(`/leads/${job.lead.id}`, url).href
  const submitted = job.lead.submittedAt.toISOString()
  const text = `Restaurant: ${job.lead.name}\nSource: AIM Website\nSubmitted: ${submitted}\nCRM (login required): ${link}\nNotification: ${job.id}`
  const messageId = `<aim-${job.id}@${domain}>`
  if (required('MAIL_PROVIDER') === 'emailjs') {
    // The company template uses name/email/restaurant/modules. Also provide the
    // former browser aliases; a fixed server recipient never comes from intake.
    const params = { to_email: to, name: 'AIM Growth Manager', from_name: 'AIM Growth Manager', email: from, from_email: from, restaurant: job.lead.name, phone: 'See protected CRM record', modules: text, message: text, source: 'AIM Website', submitted_at: submitted, crm_url: link, notification_id: job.id }
    let response: Response
    const credentials = { service_id: required('EMAILJS_SERVICE_ID'), template_id: required('EMAILJS_TEMPLATE_ID'), user_id: required('EMAILJS_PUBLIC_KEY'), accessToken: required('EMAILJS_PRIVATE_KEY'), template_params: params }
    try {
      response = await fetch('https://api.emailjs.com/api/v1.0/email/send', { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials), signal: AbortSignal.timeout(20000) })
    } catch { throw new DeliveryError('emailjs_delivery_unknown', true) }
    // Do not persist raw provider bodies: these may echo credentials/contact data.
    if (!response.ok) throw new DeliveryError(`emailjs_http_${response.status}`, response.status >= 500, [400, 401, 403, 404, 422].includes(response.status))
    // REST /send returns only OK, not the actual provider Message-ID.
    return { messageId: null, code: 'emailjs_accepted' }
  }
  if (process.env.MAIL_PROVIDER !== 'smtp') throw new DeliveryError('mail_provider_invalid', false, true)
  const host = required('SMTP_HOST'), local = ['127.0.0.1', 'localhost', '::1'].includes(host)
  const transport = nodemailer.createTransport({ host, port: Number(required('SMTP_PORT')), secure: process.env.SMTP_SECURE === 'true', requireTLS: !local, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: required('SMTP_PASSWORD') } : undefined, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000, disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false })
  try {
    await transport.sendMail({ from, to, subject: `[AIM] New setup request — ${job.lead.name}`, text, messageId, disableFileAccess: true, disableUrlAccess: true })
    return { messageId, code: 'smtp_accepted' }
  } catch (e) {
    const err = e as { code?: string; command?: string; responseCode?: number }
    const known = ['ECONNECTION', 'ECONNREFUSED', 'EDNS', 'EAUTH', 'ETIMEDOUT', 'ESOCKET', 'EENVELOPE', 'EMESSAGE']
    const code = known.includes(err.code || '') ? `smtp_${err.code}` : 'smtp_rejected'
    // A timeout after DATA can mean accepted mail with a lost acknowledgement.
    const unknown = !err.responseCode && !['CONN', 'EHLO', 'HELO', 'STARTTLS', 'AUTH'].includes(err.command || '') && !['ECONNECTION', 'ECONNREFUSED', 'EDNS', 'EAUTH'].includes(err.code || '')
    throw new DeliveryError(code, unknown, err.code === 'EAUTH' || !!err.responseCode && err.responseCode >= 500)
  } finally { transport.close() }
}

export async function notificationTick() {
  // Expired leases are not blindly resent: delivery may have succeeded before
  // the worker crashed. An operator must reconcile them with provider history.
  const expired = await prisma.leadNotification.findMany({ where: { status: 'sending', lockedAt: { lt: new Date(Date.now() - 120000) } } })
  for (const job of expired) await prisma.$transaction(async tx => {
    const changed = await tx.leadNotification.updateMany({ where: { id: job.id, status: 'sending', lockedAt: job.lockedAt }, data: { status: 'uncertain', lockedAt: null, lastError: 'worker_lease_expired' } })
    if (changed.count) await tx.leadNotificationAttempt.upsert({ where: { notificationId_attempt: { notificationId: job.id, attempt: job.attempts } }, create: { notificationId: job.id, attempt: job.attempts, outcome: 'uncertain', errorCode: 'worker_lease_expired' }, update: {} })
  })
  const claimed = await prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "LeadNotification" WHERE status IN ('pending','retry') AND "nextAttemptAt" <= (NOW() AT TIME ZONE 'UTC') AND attempts < ${maxAttempts()} ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`
    if (!rows[0]) return null
    return tx.leadNotification.update({ where: { id: rows[0].id }, data: { status: 'sending', lockedAt: new Date(), attempts: { increment: 1 } }, include: { lead: true } })
  })
  if (!claimed) return null
  let status = 'sent', errorCode: string | null = null, messageId: string | null = null
  try { const result = await deliver(claimed); messageId = result.messageId } catch (error) {
    const e = error instanceof DeliveryError ? error : new DeliveryError('notification_internal_failure', true)
    errorCode = e.code
    status = e.uncertain ? 'uncertain' : e.permanent || claimed.attempts >= maxAttempts() ? 'failed' : 'retry'
  }
  // If this commit fails, the lease will become uncertain, never an automatic duplicate.
  await prisma.$transaction([
    prisma.leadNotification.update({ where: { id: claimed.id }, data: { status, lockedAt: null, lastError: errorCode, messageId, sentAt: status === 'sent' ? new Date() : null, nextAttemptAt: new Date(Date.now() + retryMs() * Math.pow(2, claimed.attempts - 1)) } }),
    prisma.leadNotificationAttempt.create({ data: { notificationId: claimed.id, attempt: claimed.attempts, outcome: status, errorCode } }),
  ])
  return { id: claimed.id, status, attempts: claimed.attempts, errorCode }
}

// Explicit reconciliation only. Never reset the attempt count or retry a sent job.
export async function requeueNotification(id: string, reconciledNotDelivered: boolean) {
  const job = await prisma.leadNotification.findUniqueOrThrow({ where: { id } })
  if (!['failed', 'uncertain'].includes(job.status) || job.attempts >= maxAttempts() || !reconciledNotDelivered) throw new Error('requeue_not_allowed')
  return prisma.leadNotification.updateMany({ where: { id, status: job.status, attempts: job.attempts }, data: { status: 'retry', nextAttemptAt: new Date(), lastError: null } })
}
