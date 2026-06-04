-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "score" INTEGER;
ALTER TABLE "Lead" ADD COLUMN "source" TEXT;

-- CreateTable
CREATE TABLE "ProductCatalog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProductInterest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductInterest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductInterest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProductCatalog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'MONTHLY',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "mrr" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "cancelledAt" DATETIME,
    "trialEndDate" DATETIME,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "salesPersonId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProductCatalog" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Subscription_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "source" TEXT,
    "chatwootConvId" INTEGER,
    "csatScore" INTEGER,
    "assignedToId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    CONSTRAINT "SupportTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticketId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "authorType" TEXT NOT NULL DEFAULT 'AGENT',
    "isFromCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerHealthScore" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "overallScore" REAL NOT NULL DEFAULT 0,
    "engagementScore" REAL,
    "productAdoptionScore" REAL,
    "supportHealthScore" REAL,
    "subscriptionHealth" REAL,
    "churnRisk" TEXT NOT NULL DEFAULT 'LOW',
    "calculatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerHealthScore_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerSegment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "queryConfig" TEXT,
    "isDynamic" BOOLEAN NOT NULL DEFAULT true,
    "customerCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerSegment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SignNowDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "subscriptionId" INTEGER,
    "documentName" TEXT NOT NULL,
    "signNowDocId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "signedByCustomerAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SignNowDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SignNowDocument_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "filters" TEXT,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "rowCount" INTEGER,
    "error" TEXT,
    "requestedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ExportJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Customer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sapId" TEXT,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "region" TEXT,
    "address" TEXT,
    "area" TEXT,
    "storePhone" TEXT,
    "floorManager" TEXT,
    "floorManagerPhone" TEXT,
    "merchantContact" TEXT,
    "merchantContactPhone" TEXT,
    "keyman" TEXT,
    "website" TEXT,
    "type" TEXT,
    "storeType" TEXT,
    "storeSize" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "tier" TEXT NOT NULL DEFAULT 'SMB',
    "source" TEXT,
    "onboardingStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "healthScore" REAL,
    "chatwootContactId" INTEGER,
    "firstPurchasedAt" DATETIME,
    "lastActivityAt" DATETIME,
    "posStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "psWebsiteStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "smtStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "platformManagedStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "aiCamStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "omeStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "smartRobotStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "contactStatus" TEXT,
    "followerId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Customer" ("address", "aiCamStatus", "area", "city", "contactStatus", "createdAt", "floorManager", "floorManagerPhone", "followerId", "id", "keyman", "merchantContact", "merchantContactPhone", "name", "notes", "omeStatus", "platformManagedStatus", "posStatus", "psWebsiteStatus", "region", "sapId", "smartRobotStatus", "smtStatus", "storePhone", "storeSize", "storeType", "type", "updatedAt", "website") SELECT "address", "aiCamStatus", "area", "city", "contactStatus", "createdAt", "floorManager", "floorManagerPhone", "followerId", "id", "keyman", "merchantContact", "merchantContactPhone", "name", "notes", "omeStatus", "platformManagedStatus", "posStatus", "psWebsiteStatus", "region", "sapId", "smartRobotStatus", "smtStatus", "storePhone", "storeSize", "storeType", "type", "updatedAt", "website" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE TABLE "new_Pipeline" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "salesPersonId" INTEGER,
    "status" TEXT NOT NULL DEFAULT '已建联',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "closedAt" DATETIME,
    "smt" TEXT,
    "psWebsite" TEXT,
    "aiCam" TEXT,
    "agencyManaged" TEXT,
    "lastContactDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pipeline_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pipeline_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Pipeline" ("agencyManaged", "aiCam", "createdAt", "customerId", "id", "lastContactDate", "notes", "psWebsite", "salesPersonId", "smt", "status", "updatedAt") SELECT "agencyManaged", "aiCam", "createdAt", "customerId", "id", "lastContactDate", "notes", "psWebsite", "salesPersonId", "smt", "status", "updatedAt" FROM "Pipeline";
DROP TABLE "Pipeline";
ALTER TABLE "new_Pipeline" RENAME TO "Pipeline";
CREATE UNIQUE INDEX "Pipeline_customerId_key" ON "Pipeline"("customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ProductCatalog_key_key" ON "ProductCatalog"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ProductInterest_customerId_productId_key" ON "ProductInterest"("customerId", "productId");

-- CreateIndex
CREATE INDEX "Subscription_customerId_idx" ON "Subscription"("customerId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_endDate_idx" ON "Subscription"("endDate");

-- CreateIndex
CREATE INDEX "SupportTicket_customerId_idx" ON "SupportTicket"("customerId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedToId_idx" ON "SupportTicket"("assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerHealthScore_customerId_key" ON "CustomerHealthScore"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSegment_name_key" ON "CustomerSegment"("name");
