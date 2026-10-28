-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "aimApplicationId" TEXT,
ADD COLUMN     "consent" JSONB,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "placeId" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "reportId" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LeadNotification" (
    "id" TEXT NOT NULL,
    "leadId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "messageId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadNotificationAttempt" (
    "id" SERIAL NOT NULL,
    "notificationId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadNotificationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadNotification_leadId_key" ON "LeadNotification"("leadId");

-- CreateIndex
CREATE INDEX "LeadNotification_status_nextAttemptAt_idx" ON "LeadNotification"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeadNotificationAttempt_notificationId_attempt_key" ON "LeadNotificationAttempt"("notificationId", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_aimApplicationId_key" ON "Lead"("aimApplicationId");

-- AddForeignKey
ALTER TABLE "LeadNotification" ADD CONSTRAINT "LeadNotification_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNotificationAttempt" ADD CONSTRAINT "LeadNotificationAttempt_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "LeadNotification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

