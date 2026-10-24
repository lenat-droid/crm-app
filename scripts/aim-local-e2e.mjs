// Uses real local HTTP services, PostgreSQL, SQLite and an actual SMTP capture inbox.
// No production database, paid diagnosis or real customer addresses are used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {PrismaClient} from '@prisma/client';
import notifications from '../src/lib/aim-notifications.ts';
const {notificationTick}=notifications;

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dburl=new URL(process.env.DATABASE_URL);
assert.equal(dburl.hostname,'127.0.0.1');assert.equal(dburl.port,'55432');assert.equal(dburl.pathname,'/crm_aim_e2e');assert.equal(process.env.MAIL_PROVIDER,'smtp');
const db=new PrismaClient(),local=new DatabaseSync(path.join(root,'../diagnosis-core-v1/.local/crm-e2e/growth.sqlite'));
const run='AIM-E2E-'+new Date().toISOString().replace(/[:.]/g,'-');
const evidence={run,started_at:new Date().toISOString(),checks:[]};
const check=(name,details={})=>{evidence.checks.push({name,passed:true,...details});console.log('PASS '+name);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){const r=await fn();if(r)return r;await sleep(300);}throw Error('condition_timeout');}
class Client{
  constructor(base){this.base=base;this.cookies=new Map();}
  async request(url,options={}){const r=await fetch(this.base+url,{redirect:'manual',...options,headers:{Cookie:[...this.cookies].map(([k,v])=>k+'='+v).join('; '),...options.headers}});for(const c of r.headers.getSetCookie()){const [k,...rest]=c.split(';')[0].split('=');this.cookies.set(k,rest.join('='));}return r;}
  async json(url,data,method='POST'){return this.request(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}
}
const aim=new Client('http://127.0.0.1:4196'),crm=new Client('http://127.0.0.1:3000');
const ingest=async payload=>fetch(crm.base+'/api/integrations/aim/leads',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.CRM_INGEST_TOKEN},body:JSON.stringify(payload)});
async function login(key){const c=new Client(crm.base),user=JSON.parse(fs.readFileSync(path.join(root,'.secrets/test-users.json')))[key];const {csrfToken}=await(await c.request('/api/auth/csrf')).json();await c.request('/api/auth/callback/credentials',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken,email:user.email,password:user.password,json:'true',callbackUrl:crm.base+'/leads'})});assert.equal((await(await c.request('/api/auth/session')).json()).user.id,user.id);return c;}
let originalConfig;
const configPath=path.join(root,'../diagnosis-core-v1/.secrets/crm-e2e.env');
try{
  for(let i=0;i<20;i++){if(!await notificationTick())break;}
  assert.equal((await crm.request('/api/leads')).status,401);
  assert.equal((await crm.json('/api/integrations/aim/leads',{})).status,401);
  assert.equal((await crm.request('/api/integrations/aim/leads')).status,405);
  await db.user.update({where:{email:'sales@aim.test'},data:{shareToken:randomUUID()}});
  const share=(await db.user.findUnique({where:{email:'sales@aim.test'}})).shareToken;
  assert.equal((await crm.request('/api/integrations/aim/leads',{method:'POST',headers:{Authorization:'Bearer '+share,'Content-Type':'application/json'},body:'{}'})).status,401);
  check('unauthorized_session_and_share_token_rejected');
  await aim.request('/api/session');
  const cookie=aim.cookies.get('aim_local'),owner=createHash('sha256').update(cookie).digest('hex');
  const reportId=randomUUID(),placeId='SYNTHETIC_PLACE_'+run;
  // Synthetic owned completed report: identity handoff only, no collection/model calls.
  local.prepare("INSERT INTO diagnose_tasks(id,place_id,place_name,status,result)VALUES(?,?,?,'done',?)").run(reportId,placeId,run,JSON.stringify({}));
  local.prepare('INSERT INTO local_task_owners VALUES(?,?,?)').run(reportId,owner,placeId);
  const body={request_id:randomUUID(),report_id:reportId,name:'Synthetic Operator',restaurant:run,contact_value:'synthetic@example.test',consent:{contact:true}};
  const before={customers:await db.customer.count(),pipelines:await db.pipeline.count()};
  const first=await aim.json('/api/leads',body);assert.equal(first.status,201);const saved=await first.json();
  assert.deepEqual(Object.keys(saved).sort(),['duplicate','lead_id','ok','saved_locally']);
  const retry=await(await aim.json('/api/leads',body)).json();assert.equal(retry.lead_id,saved.lead_id);assert.equal(retry.duplicate,true);
  assert.equal((await aim.json('/api/leads',{...body,name:'Changed Person'})).status,409);
  const stranger=new Client(aim.base);await stranger.request('/api/session');assert.equal((await stranger.json('/api/leads',{...body,request_id:randomUUID()})).status,404);
  const row=await until(()=>{const r=local.prepare('SELECT * FROM local_activation WHERE id=?').get(saved.lead_id);return r?.crm_status==='synced'&&r;});
  const lead=await db.lead.findUniqueOrThrow({where:{id:row.crm_id},include:{notification:true}});
  assert.equal(lead.status,'new');assert.equal(lead.customerId,null);assert.equal(lead.source,'AIM Website');assert.equal(lead.placeId,placeId);assert.equal(lead.reportId,reportId);assert.equal(lead.email,body.contact_value);assert.equal(lead.consent.contact,true);
  assert.deepEqual({customers:await db.customer.count(),pipelines:await db.pipeline.count()},before);
  const payload={application_id:row.id,...JSON.parse(row.data),submitted_at:row.created_at};
  const duplicates=await Promise.all(Array.from({length:6},()=>ingest(payload)));for(const r of duplicates){assert.equal(r.status,200);assert.equal((await r.json()).crm_id,lead.id);}
  assert.equal(await db.lead.count({where:{aimApplicationId:row.id}}),1);assert.equal(await db.leadNotification.count({where:{leadId:lead.id}}),1);
  assert.equal((await ingest({...payload,email:'changed@example.test'})).status,409);
  check('website_save_crm_sync_identity_consent_and_idempotency',{application_id:row.id,crm_id:lead.id,report_id:reportId,customer_created:false});
  const ops=await login('ops'),sales=await login('sales'),manager=await login('manager');
  for(const c of [sales,manager]){assert.equal((await c.request('/api/leads/'+lead.id)).status,404);assert.equal((await c.json('/api/leads',{id:lead.id,status:'contacted'},'PATCH')).status,404);assert(!(await(await c.request('/api/leads')).json()).leads.some(x=>x.id===lead.id));}
  assert.equal((await ops.json('/api/leads/'+lead.id,{status:'contacted',notes:'Synthetic E2E follow-up'},'PATCH')).status,200);
  assert.equal((await ops.json('/api/leads/'+lead.id,{status:'converted'},'PATCH')).status,400);
  assert.equal((await db.lead.findUnique({where:{id:lead.id}})).status,'contacted');check('operator_login_followup_and_role_scope');
  const manual=await(await ops.json('/api/leads',{name:run+' manual',contactPerson:'Manual synthetic'})).json();
  assert.equal(manual.lead.status,'converted');assert(manual.customer.id&&manual.pipeline.id);check('existing_manual_customer_pipeline_preserved');
  const sent=await notificationTick();assert.equal(sent.status,'sent');
  const inbox=await(await fetch('http://127.0.0.1:18025/api/v1/messages')).json();
  const message=inbox.messages.find(m=>m.Subject.includes(run));assert(message);const received=await(await fetch('http://127.0.0.1:18025/api/v1/message/'+message.ID)).json();
  assert(received.Text.includes('/leads/'+lead.id));assert(received.Text.includes('AIM Website'));assert(!received.Text.includes(body.contact_value));
  fs.mkdirSync(path.join(root,'docs/aim-evidence'),{recursive:true});fs.writeFileSync(path.join(root,'docs/aim-evidence/local-smtp-received.json'),JSON.stringify({id:message.ID,subject:message.Subject,to:received.To,text:received.Text},null,2));
  assert.equal(await notificationTick(),null);check('smtp_real_inbox_received_and_deduplicated',{inbox_id:message.ID,notification_id:lead.notification.id});
  originalConfig=fs.readFileSync(configPath,'utf8');fs.writeFileSync(configPath,originalConfig.replace('http://127.0.0.1:3000','http://127.0.0.1:13009'));
  const outage=await(await aim.json('/api/leads',{...body,report_id:undefined,request_id:randomUUID(),restaurant:run+' CRM outage'})).json();assert(outage.ok);
  const failed=await until(()=>{const r=local.prepare('SELECT * FROM local_activation WHERE id=?').get(outage.lead_id);return r.crm_status==='failed'&&r;});assert.equal(failed.sync_error,'crm_unavailable');assert(failed.data);
  fs.writeFileSync(configPath,originalConfig);originalConfig=null;
  const recovered=await until(()=>{const r=local.prepare('SELECT * FROM local_activation WHERE id=?').get(outage.lead_id);return r.crm_status==='synced'&&r;});assert(recovered.sync_attempts>=2);check('crm_outage_saved_then_recovered',{application_id:outage.lead_id,attempts:recovered.sync_attempts,crm_id:recovered.crm_id});
  process.env.SMTP_PORT='11026';const failedMail=await notificationTick();assert.equal(failedMail.status,'retry');assert.equal(await db.lead.count({where:{id:recovered.crm_id}}),1);
  process.env.SMTP_PORT='11025';await sleep(1200);const recoveredMail=await notificationTick();assert.equal(recoveredMail.status,'sent');
  const logs=await db.leadNotificationAttempt.findMany({where:{notificationId:failedMail.id},orderBy:{attempt:'asc'}});assert.deepEqual(logs.map(l=>l.outcome),['retry','sent']);
  const inboxAfter=await(await fetch('http://127.0.0.1:18025/api/v1/messages')).json();assert.equal(inboxAfter.messages.filter(m=>m.Subject.includes('CRM outage')).length,1);
  check('smtp_failure_retained_lead_and_recovered_once',{notification_id:failedMail.id,attempts:logs.map(({attempt,outcome,errorCode})=>({attempt,outcome,errorCode}))});
  const cappedPayload={...payload,application_id:randomUUID(),restaurant:run+' capped'};const capLead=await(await ingest(cappedPayload)).json();
  process.env.MAIL_MAX_ATTEMPTS='2';process.env.SMTP_PORT='11026';assert.equal((await notificationTick()).status,'retry');await sleep(1200);assert.equal((await notificationTick()).status,'failed');assert.equal(await notificationTick(),null);
  const cap=await db.leadNotification.findUniqueOrThrow({where:{leadId:capLead.crm_id}});assert.equal(cap.attempts,2);check('bounded_retry_terminal_failure',{notification_id:cap.id,attempts:cap.attempts});
  // Ambiguous crash leases must not automatically resend.
  const ambiguous=await(await ingest({...payload,application_id:randomUUID(),restaurant:run+' uncertain'})).json();const job=await db.leadNotification.update({where:{leadId:ambiguous.crm_id},data:{status:'sending',attempts:1,lockedAt:new Date(Date.now()-180000)}});await notificationTick();assert.equal((await db.leadNotification.findUnique({where:{id:job.id}})).status,'uncertain');check('expired_delivery_lease_requires_reconciliation');
  evidence.completed_at=new Date().toISOString();fs.writeFileSync(path.join(root,'docs/aim-evidence/local-e2e.json'),JSON.stringify(evidence,null,2));
}finally{
  if(originalConfig)fs.writeFileSync(configPath,originalConfig);
  await db.$disconnect();local.close();
}
