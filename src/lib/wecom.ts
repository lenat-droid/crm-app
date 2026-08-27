/**
 * 企业微信群机器人推送（触达层）。
 *
 * Webhook URLs come from env:
 *   WECOM_WEBHOOK_SALES — 销售群（规则清单）
 *   WECOM_WEBHOOK_MGMT  — 管理层群（汇总）
 * When unset, sends are skipped and reported as `skipped` so the cron
 * endpoint can run as a dry-run in environments without WeCom configured.
 */

interface SendResult {
  target: string
  skipped: boolean
  ok?: boolean
  error?: string
}

async function sendWecom(webhookUrl: string | undefined, target: string, payload: any): Promise<SendResult> {
  if (!webhookUrl) return { target, skipped: true }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    const ok = res.ok && data.errcode === 0
    return { target, skipped: false, ok, error: ok ? undefined : data.errmsg || `HTTP ${res.status}` }
  } catch (err: any) {
    return { target, skipped: false, ok: false, error: err.message }
  }
}

export function sendWecomMarkdown(webhookUrl: string | undefined, target: string, content: string) {
  // 企微 markdown 单条上限 4096 字节，超长截断
  const truncated = Buffer.byteLength(content, 'utf-8') > 4000 ? content.slice(0, 1300) + '\n\n…（内容过长已截断）' : content
  return sendWecom(webhookUrl, target, { msgtype: 'markdown', markdown: { content: truncated } })
}

export function sendWecomText(webhookUrl: string | undefined, target: string, content: string, mentionedList?: string[]) {
  return sendWecom(webhookUrl, target, {
    msgtype: 'text',
    text: { content, ...(mentionedList?.length ? { mentioned_list: mentionedList } : {}) },
  })
}
