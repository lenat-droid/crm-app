// AIM intake (src/lib/aim-leads.ts), its route and the operations email, without a database,
// mail provider or network: Prisma is an in-memory stand-in installed before the modules load,
// and EmailJS requests and SMTP sends are captured in this process.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import nodemailer from 'nodemailer'

const rows = new Map(), created = [], sent = [], mails = []
let job = null
const db = {
  lead: {
    findUnique: async ({ where }) => rows.get(where.aimApplicationId) ?? null,
    create: async ({ data }) => {
      if (rows.has(data.aimApplicationId)) throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
      created.push(data)
      const { notification, ...fields } = data
      const lead = { id: rows.size + 1, phone: null, email: null, ...fields }
      rows.set(data.aimApplicationId, lead)
      return lead
    },
  },
  user: { findFirst: async () => null },
  leadNotification: { findMany: async () => [], update: async ({ include }) => include ? { ...job, attempts: 1 } : job },
  leadNotificationAttempt: { create: async ({ data }) => data },
  $queryRaw: async () => job ? [{ id: job.id }] : [],
  $transaction: async work => typeof work === 'function' ? work(db) : Promise.all(work),
}
globalThis.prisma = db
globalThis.fetch = async (url, init) => {
  if (String(url) !== 'https://api.emailjs.com/api/v1.0/email/send') throw new Error('unexpected request ' + url)
  sent.push(JSON.parse(init.body).template_params)
  return new Response('OK')
}
nodemailer.createTransport = () => ({ sendMail: async mail => { mails.push(mail) }, close() {} })
process.env.CRM_INGEST_TOKEN = 'synthetic-ingest-token-for-local-tests-only'
for (const key of ['AIM_LEAD_OWNER_ID', 'AIM_LEAD_REGION', 'MAIL_MAX_ATTEMPTS']) delete process.env[key]

const { validateAimLead, ingestAimLead } = await import('../src/lib/aim-leads.ts')
const { POST } = await import('../src/app/api/integrations/aim/leads/route.ts')
const { notificationTick } = await import('../src/lib/aim-notifications.ts')

// What the growth service sends for a report unlock (phone) and for the setup form (email).
const submitted = '2026-11-01T17:30:00.000Z'
const unlock = (extra = {}) => ({ application_id: 'aim-phone-0001', name: 'Synthetic Owner', restaurant: 'Synthetic Kitchen', phone: '+13125550100', place_id: 'synthetic-place', report_id: '00000000-0000-4000-8000-000000000001', source: 'AIM Website', consent: { contact: true, version: 'aim-report-contact-v1', statement: 'You may call me about my report.', accepted_at: submitted }, submitted_at: submitted, ...extra })
const setup = (extra = {}) => ({ application_id: 'aim-email-0001', name: 'Synthetic Owner', restaurant: 'Synthetic Kitchen', email: 'Owner@Example.test', place_id: null, report_id: null, source: 'AIM Website', consent: { contact: true, version: 'aim-setup-contact-v1', statement: 'You may contact me about this request.', accepted_at: submitted }, submitted_at: submitted, ...extra })

test('an email lead validates as before, with no phone', () => {
  assert.deepEqual(validateAimLead(setup()), { aimApplicationId: 'aim-email-0001', name: 'Synthetic Kitchen', email: 'owner@example.test', phone: null, contactPerson: 'Synthetic Owner', placeId: null, reportId: null, source: 'AIM Website', consent: setup().consent, submittedAt: new Date(submitted) })
  assert.throws(() => validateAimLead(setup({ email: 'not-an-email' })), { name: 'ValidationError', message: 'Invalid email' })
})

test('a phone lead needs no email, and phones are normalized like the growth service does', () => {
  const lead = validateAimLead(unlock())
  assert.deepEqual([lead.phone, lead.email, lead.consent.version], ['+13125550100', null, 'aim-report-contact-v1'])
  // A leading + is read as an international number first, even with 10 digits; without it, 10 or 1+10 digits are US.
  for (const [typed, stored] of [['(312) 555-0100', '+13125550100'], ['1-312-555-0100', '+13125550100'], ['+1 (312) 555-0100', '+13125550100'], ['+65 6123 4567', '+6561234567'], ['+44 20 7946 0958', '+442079460958'], ['+8613800138000', '+8613800138000']])
    assert.equal(validateAimLead(unlock({ phone: typed })).phone, stored, typed)
  const both = validateAimLead(unlock({ email: 'owner@example.test' }))
  assert.deepEqual([both.email, both.phone], ['owner@example.test', '+13125550100'])
})

test('a lead without a usable email or phone is refused', () => {
  const { email, ...noContact } = setup()
  assert.throws(() => validateAimLead(noContact), { message: 'Email or phone required' })
  assert.throws(() => validateAimLead(setup({ email: null })), { message: 'Email or phone required' })
  for (const phone of ['555-0100', '22345678901', '+1234567', '+1234567890123456'])
    assert.throws(() => validateAimLead(unlock({ phone })), { name: 'ValidationError', message: 'Invalid phone' }, phone)
  // Over 20 characters, empty, or not a string.
  for (const phone of ['+1 (312) 555-0100 x12', '', 3125550100])
    assert.throws(() => validateAimLead(unlock({ phone })), { name: 'ValidationError', message: 'Invalid intake field' }, String(phone))
})

test('ingest stores the phone and counts it in the application identity', async () => {
  const first = await ingestAimLead(validateAimLead(unlock()))
  assert.deepEqual(first, { ok: true, application_id: 'aim-phone-0001', crm_id: first.crm_id, duplicate: false })
  const lead = rows.get('aim-phone-0001')
  assert.deepEqual([lead.phone, lead.email, lead.contactPerson, lead.status], ['+13125550100', null, 'Synthetic Owner', 'new'])
  assert.deepEqual(created.at(-1).notification, { create: {} })
  assert.deepEqual(await ingestAimLead(validateAimLead(unlock({ phone: '(312) 555-0100' }))), { ...first, duplicate: true })
  await assert.rejects(ingestAimLead(validateAimLead(unlock({ phone: '+13125550199' }))), { message: 'Application ID conflict' })
  // An email lead has no phone, so its retries still match and a phone cannot be added afterwards.
  const email = await ingestAimLead(validateAimLead(setup()))
  assert.equal(rows.get('aim-email-0001').phone, null)
  assert.deepEqual(await ingestAimLead(validateAimLead(setup())), { ...email, duplicate: true })
  await assert.rejects(ingestAimLead(validateAimLead(setup({ phone: '+13125550100' }))), { message: 'Application ID conflict' })
})

test('the intake route takes a phone-only lead and answers 400 for a bad or missing contact', async () => {
  const post = async body => {
    const response = await POST(new Request('http://127.0.0.1:3000/api/integrations/aim/leads', { method: 'POST', headers: { Authorization: `Bearer ${process.env.CRM_INGEST_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
    return [response.status, await response.json()]
  }
  const [status, body] = await post(unlock({ application_id: 'aim-phone-route-0001' }))
  assert.deepEqual([status, body.ok, body.duplicate], [201, true, false])
  assert.equal(rows.get('aim-phone-route-0001').phone, '+13125550100')
  assert.deepEqual(await post(unlock({ application_id: 'aim-phone-route-0002', phone: '555-0100' })), [400, { error: 'Invalid phone' }])
  assert.deepEqual(await post(unlock({ application_id: 'aim-phone-route-0003', phone: undefined })), [400, { error: 'Email or phone required' }])
})

// A report-unlock lead with a phone, and a setup-form lead with an email.
const lead = phone => ({ id: 7, name: 'Synthetic Kitchen', phone, email: phone ? null : 'owner@example.test', consent: { contact: true, version: phone ? 'aim-report-contact-v1' : 'aim-setup-contact-v1' }, submittedAt: new Date(submitted) })
const mailEnv = { MAIL_TO: 'operations@example.test', MAIL_FROM: 'aim@example.test', MAIL_DOMAIN: 'example.test', CRM_PUBLIC_URL: 'http://127.0.0.1:3000' }
const emailjsEnv = { MAIL_PROVIDER: 'emailjs', EMAILJS_SERVICE_ID: 'synthetic-service', EMAILJS_TEMPLATE_ID: 'synthetic-template', EMAILJS_PUBLIC_KEY: 'synthetic-public', EMAILJS_PRIVATE_KEY: 'synthetic-private' }
const smtpEnv = { MAIL_PROVIDER: 'smtp', SMTP_HOST: '127.0.0.1', SMTP_PORT: '2525' }

test('the EmailJS notification fills the template phone field when the lead has one', async () => {
  Object.assign(process.env, mailEnv, emailjsEnv)
  for (const phone of ['+13125550100', null]) {
    job = { id: phone ? 'notification-phone' : 'notification-email', attempts: 0, lead: lead(phone) }
    assert.equal((await notificationTick()).status, 'sent')
  }
  assert.deepEqual(sent.map(p => p.phone), ['+13125550100', 'See protected CRM record'])
  // The rest of the template is unchanged, and the lead's email address is never sent.
  assert.equal(sent[0].modules, `Restaurant: Synthetic Kitchen\nSource: AIM Website\nSubmitted: ${submitted}\nCRM (login required): http://127.0.0.1:3000/leads/7\nNotification: notification-phone`)
  assert.equal(JSON.stringify(sent).includes('owner@example.test'), false)
})

test('the SMTP notification starts with the phone; email-only leads read as before', async () => {
  Object.assign(process.env, mailEnv, smtpEnv)
  for (const phone of ['+13125550100', null]) {
    job = { id: phone ? 'notification-phone' : 'notification-email', attempts: 0, lead: lead(phone) }
    assert.equal((await notificationTick()).status, 'sent')
  }
  assert.equal(mails[0].text, `Phone: +13125550100\nRestaurant: Synthetic Kitchen\nSource: AIM Website\nSubmitted: ${submitted}\nCRM (login required): http://127.0.0.1:3000/leads/7\nNotification: notification-phone`)
  assert.equal(mails[1].text, `Restaurant: Synthetic Kitchen\nSource: AIM Website\nSubmitted: ${submitted}\nCRM (login required): http://127.0.0.1:3000/leads/7\nNotification: notification-email`)
})

test('the subject calls a report-unlock lead a report contact; setup requests keep their subject', async () => {
  // Decided by the consent version, not by the phone: a setup lead that left a phone is still a setup request.
  const cases = [['aim-report-contact-v1', '+13125550100'], ['aim-setup-contact-v1', '+13125550100'], ['aim-setup-contact-v1', null]]
  const deliverAll = async () => {
    for (const [version, phone] of cases) {
      job = { id: 'notification-subject', attempts: 0, lead: { ...lead(phone), consent: { contact: true, version } } }
      assert.equal((await notificationTick()).status, 'sent')
    }
  }
  mails.length = 0
  Object.assign(process.env, mailEnv, smtpEnv)
  await deliverAll()
  assert.deepEqual(mails.map(m => m.subject), ['[AIM] New report contact — Synthetic Kitchen', '[AIM] New setup request — Synthetic Kitchen', '[AIM] New setup request — Synthetic Kitchen'])
  // EmailJS: the company template's subject is fixed text, so the subject goes as a template value it can use.
  sent.length = 0
  Object.assign(process.env, mailEnv, emailjsEnv)
  await deliverAll()
  assert.deepEqual(sent.map(p => p.subject), ['🍽️ New report contact — Synthetic Kitchen', '🍽️ New Demo Request — Synthetic Kitchen', '🍽️ New Demo Request — Synthetic Kitchen'])
})
