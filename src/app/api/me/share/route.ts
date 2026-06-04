import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { shareToken: true, name: true },
  })

  if (!user || !user.shareToken) {
    return NextResponse.json({ error: 'No share token' }, { status: 404 })
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return NextResponse.json({
    shareToken: user.shareToken,
    shareUrl: `${baseUrl}/quick-checkin/share/${user.shareToken}`,
    leadsShareUrl: `${baseUrl}/leads/share/${user.shareToken}`,
    name: user.name,
  })
}
