import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// POST /api/users/share-token — generate or return existing share token for a user
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Generate token if not exists
  let shareToken = user.shareToken
  if (!shareToken) {
    shareToken = crypto.randomUUID()
    await prisma.user.update({
      where: { id: userId },
      data: { shareToken },
    })
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return NextResponse.json({
    shareToken,
    shareUrl: `${baseUrl}/quick-checkin/share/${shareToken}`,
    leadsShareUrl: `${baseUrl}/leads/share/${shareToken}`,
    name: user.name,
  })
}
