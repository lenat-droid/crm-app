-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SALES',
    "region" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "shareToken" TEXT,
    "targetMRR" DOUBLE PRECISION,
    "targetCustomers" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
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
    "healthScore" DOUBLE PRECISION,
    "chatwootContactId" INTEGER,
    "firstPurchasedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "posStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "psWebsiteStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "smtStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "platformManagedStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "aiCamStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "omeStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "smartRobotStatus" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "contactStatus" TEXT,
    "followerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantProfile" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "kitchChatId" TEXT,
    "yelpId" TEXT,
    "googleId" TEXT,
    "psId" TEXT,
    "street" TEXT,
    "streetNumber" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "chineseName" TEXT,
    "email" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "priceLevel" INTEGER,
    "rating" DOUBLE PRECISION,
    "menuUrl" TEXT,
    "googleAiDesc" TEXT,
    "aiDesc" TEXT,
    "businessStatus" TEXT,
    "openingHours" TEXT,
    "specialHours" TEXT,
    "features" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "dataSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "salesPersonId" INTEGER,
    "status" TEXT NOT NULL DEFAULT '已建联',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "closedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "smt" TEXT,
    "psWebsite" TEXT,
    "aiCam" TEXT,
    "agencyManaged" TEXT,
    "lastContactDate" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "nextAction" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Communication" (
    "id" SERIAL NOT NULL,
    "pipelineId" INTEGER NOT NULL,
    "contactDate" TIMESTAMP(3) NOT NULL,
    "record" TEXT NOT NULL,
    "contactOrder" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Communication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "visitedById" INTEGER,
    "outcome" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitLog" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "visitedById" INTEGER,
    "restaurantNeeds" TEXT,
    "posBrand" TEXT,
    "posMonthlyFee" TEXT,
    "posTransactionRate" TEXT,
    "posContractEnd" TEXT,
    "scanToOrder" BOOLEAN NOT NULL DEFAULT false,
    "kiosk" BOOLEAN NOT NULL DEFAULT false,
    "hasCameras" BOOLEAN,
    "cameraPurpose" TEXT,
    "cameraMonthlyFee" TEXT,
    "dailyPhoneOrders" TEXT,
    "missedCalls" BOOLEAN,
    "estimatedMissedCalls" TEXT,
    "biggestPainPoint" TEXT,
    "otherNotes" TEXT,
    "posDevicePhoto" TEXT,
    "menuBoardPhoto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "contactPerson" TEXT,
    "foodType" TEXT,
    "posBrand" TEXT,
    "needs" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "source" TEXT,
    "score" INTEGER,
    "notes" TEXT,
    "registeredById" INTEGER,
    "visitDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCatalog" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductInterest" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_CONTACTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'MONTHLY',
    "billingType" TEXT NOT NULL DEFAULT 'RECURRING',
    "oneTimeAmount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "mrr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "trialEndDate" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "salesPersonId" INTEGER,
    "billingStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "source" TEXT,
    "chatwootConvId" INTEGER,
    "csatScore" INTEGER,
    "assignedToId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "authorType" TEXT NOT NULL DEFAULT 'AGENT',
    "isFromCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerHealthScore" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "engagementScore" DOUBLE PRECISION,
    "productAdoptionScore" DOUBLE PRECISION,
    "supportHealthScore" DOUBLE PRECISION,
    "subscriptionHealth" DOUBLE PRECISION,
    "churnRisk" TEXT NOT NULL DEFAULT 'LOW',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerHealthScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerLog" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueRecord" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER,
    "productKey" TEXT NOT NULL,
    "revenueType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevenueRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionMetric" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "productKey" TEXT NOT NULL,
    "metricDate" TIMESTAMP(3) NOT NULL,
    "gmv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenueType" TEXT NOT NULL DEFAULT 'TRANSACTION',
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDeployment" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "productKey" TEXT NOT NULL,
    "deployedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "plan" TEXT,
    "monthlyFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSegment" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "queryConfig" TEXT,
    "isDynamic" BOOLEAN NOT NULL DEFAULT true,
    "customerCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignNowDocument" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "subscriptionId" INTEGER,
    "documentName" TEXT NOT NULL,
    "signNowDocId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "signedByCustomerAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignNowDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "filters" TEXT,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "rowCount" INTEGER,
    "error" TEXT,
    "requestedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyMetricSnapshot" (
    "id" SERIAL NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "totalCustomers" INTEGER NOT NULL DEFAULT 0,
    "activeSubscriptions" INTEGER NOT NULL DEFAULT 0,
    "totalMrr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "newMrr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "churnMrr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netMrr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wonMrr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pipelinePending" INTEGER NOT NULL DEFAULT 0,
    "pipelineConnected" INTEGER NOT NULL DEFAULT 0,
    "pipelineInterested" INTEGER NOT NULL DEFAULT 0,
    "pipelineCooperating" INTEGER NOT NULL DEFAULT 0,
    "tierEnterprise" INTEGER NOT NULL DEFAULT 0,
    "tierMidMarket" INTEGER NOT NULL DEFAULT 0,
    "tierSmb" INTEGER NOT NULL DEFAULT 0,
    "healthyCount" INTEGER NOT NULL DEFAULT 0,
    "attentionCount" INTEGER NOT NULL DEFAULT 0,
    "atRiskCount" INTEGER NOT NULL DEFAULT 0,
    "avgHealthScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNewLeads" INTEGER NOT NULL DEFAULT 0,
    "totalVisits" INTEGER NOT NULL DEFAULT 0,
    "totalComms" INTEGER NOT NULL DEFAULT 0,
    "wonDeals" INTEGER NOT NULL DEFAULT 0,
    "lostDeals" INTEGER NOT NULL DEFAULT 0,
    "userActivity" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_shareToken_key" ON "User"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantProfile_customerId_key" ON "MerchantProfile"("customerId");

-- CreateIndex
CREATE INDEX "MerchantProfile_yelpId_idx" ON "MerchantProfile"("yelpId");

-- CreateIndex
CREATE INDEX "MerchantProfile_googleId_idx" ON "MerchantProfile"("googleId");

-- CreateIndex
CREATE INDEX "MerchantProfile_state_idx" ON "MerchantProfile"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Pipeline_customerId_key" ON "Pipeline"("customerId");

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
CREATE INDEX "CustomerLog_customerId_idx" ON "CustomerLog"("customerId");

-- CreateIndex
CREATE INDEX "CustomerLog_customerId_createdAt_idx" ON "CustomerLog"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "RevenueRecord_customerId_idx" ON "RevenueRecord"("customerId");

-- CreateIndex
CREATE INDEX "RevenueRecord_productKey_idx" ON "RevenueRecord"("productKey");

-- CreateIndex
CREATE INDEX "RevenueRecord_revenueType_idx" ON "RevenueRecord"("revenueType");

-- CreateIndex
CREATE INDEX "RevenueRecord_periodStart_periodEnd_idx" ON "RevenueRecord"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "TransactionMetric_customerId_metricDate_idx" ON "TransactionMetric"("customerId", "metricDate");

-- CreateIndex
CREATE INDEX "TransactionMetric_productKey_metricDate_idx" ON "TransactionMetric"("productKey", "metricDate");

-- CreateIndex
CREATE INDEX "TransactionMetric_metricDate_idx" ON "TransactionMetric"("metricDate");

-- CreateIndex
CREATE INDEX "ProductDeployment_productKey_idx" ON "ProductDeployment"("productKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProductDeployment_customerId_productKey_key" ON "ProductDeployment"("customerId", "productKey");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSegment_name_key" ON "CustomerSegment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMetricSnapshot_weekStart_key" ON "WeeklyMetricSnapshot"("weekStart");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantProfile" ADD CONSTRAINT "MerchantProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Communication" ADD CONSTRAINT "Communication_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_visitedById_fkey" FOREIGN KEY ("visitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitLog" ADD CONSTRAINT "VisitLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitLog" ADD CONSTRAINT "VisitLog_visitedById_fkey" FOREIGN KEY ("visitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInterest" ADD CONSTRAINT "ProductInterest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInterest" ADD CONSTRAINT "ProductInterest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProductCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ProductCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerHealthScore" ADD CONSTRAINT "CustomerHealthScore_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLog" ADD CONSTRAINT "CustomerLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLog" ADD CONSTRAINT "CustomerLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueRecord" ADD CONSTRAINT "RevenueRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueRecord" ADD CONSTRAINT "RevenueRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionMetric" ADD CONSTRAINT "TransactionMetric_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionMetric" ADD CONSTRAINT "TransactionMetric_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDeployment" ADD CONSTRAINT "ProductDeployment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSegment" ADD CONSTRAINT "CustomerSegment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignNowDocument" ADD CONSTRAINT "SignNowDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignNowDocument" ADD CONSTRAINT "SignNowDocument_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

