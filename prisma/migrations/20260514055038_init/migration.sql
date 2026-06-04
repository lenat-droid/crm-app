-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SALES',
    "region" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Customer" (
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

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "salesPersonId" INTEGER,
    "status" TEXT NOT NULL DEFAULT '已建联',
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

-- CreateTable
CREATE TABLE "Communication" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pipelineId" INTEGER NOT NULL,
    "contactDate" DATETIME NOT NULL,
    "record" TEXT NOT NULL,
    "contactOrder" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Communication_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "visitDate" DATETIME NOT NULL,
    "visitedById" INTEGER,
    "outcome" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Visit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Visit_visitedById_fkey" FOREIGN KEY ("visitedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisitLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "visitDate" DATETIME NOT NULL,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisitLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VisitLog_visitedById_fkey" FOREIGN KEY ("visitedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "contactPerson" TEXT,
    "foodType" TEXT,
    "posBrand" TEXT,
    "needs" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "registeredById" INTEGER,
    "visitDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Pipeline_customerId_key" ON "Pipeline"("customerId");
