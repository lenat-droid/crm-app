import { notificationTick, requeueNotification } from '../src/lib/aim-notifications'
import { prisma } from '../src/lib/prisma'

async function main() {
  if (process.argv[2] === '--requeue') {
    await requeueNotification(process.argv[3], process.argv[4] === '--confirmed-not-delivered')
    console.log('notification_requeued')
    return
  }
  do {
    try { const result = await notificationTick(); if (result) console.log(JSON.stringify(result)) } catch { console.error('notification_worker_failed') }
    if (process.argv.includes('--once')) break
    // EmailJS permits one request per second. A single worker claims one job per tick.
    await new Promise(resolve => setTimeout(resolve, 1100))
  } while (true)
}
main().catch(() => { console.error('notification_command_failed'); process.exitCode = 1 }).finally(() => prisma.$disconnect())
