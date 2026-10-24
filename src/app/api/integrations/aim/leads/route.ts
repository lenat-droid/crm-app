import { NextRequest, NextResponse } from 'next/server'
import { ingestAuthorized, ingestAimLead, validateAimLead } from '@/lib/aim-leads'
import { ValidationError } from '@/lib/validation/schemas'

export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  if (!process.env.CRM_INGEST_TOKEN || process.env.CRM_INGEST_TOKEN.length < 32) return NextResponse.json({ error: 'integration_unavailable' }, { status: 503 })
  if (!ingestAuthorized(req.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!req.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'JSON required' }, { status: 415 })
  try {
    const reader = req.body?.getReader()
    let text = ''
    const decoder = new TextDecoder()
    if (reader) for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
      if (Buffer.byteLength(text) > 32768) { await reader.cancel(); return NextResponse.json({ error: 'body_too_large' }, { status: 413 }) }
    }
    const result = await ingestAimLead(validateAimLead(JSON.parse(text)))
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.message.includes('conflict') ? 409 : 400 })
    // Prisma/provider errors can contain contact data. Do not log their raw objects.
    console.error('aim_ingest_failed')
    return NextResponse.json({ error: 'intake_unavailable' }, { status: 503 })
  }
}
