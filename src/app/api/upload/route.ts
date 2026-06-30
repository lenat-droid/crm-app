import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import os from 'os'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const filename = `${Date.now()}-${file.name}`

    // Try public/uploads first, fall back to OS tmpdir (Docker permission fix)
    const primaryDir = path.join(process.cwd(), 'public', 'uploads')
    let uploadDir = primaryDir
    let filepath = path.join(uploadDir, filename)

    try {
      await mkdir(uploadDir, { recursive: true })
      await writeFile(filepath, buffer)
    } catch {
      uploadDir = path.join(os.tmpdir(), 'crm-uploads')
      filepath = path.join(uploadDir, filename)
      await mkdir(uploadDir, { recursive: true })
      await writeFile(filepath, buffer)
    }

    // Return the absolute path so the import API can read it directly
    return NextResponse.json({ url: filepath })
  } catch (err: any) {
    console.error('[Upload]', err.message)
    return NextResponse.json({ error: `Upload failed: ${err.message}` }, { status: 500 })
  }
}
