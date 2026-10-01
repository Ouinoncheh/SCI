-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('SCI_IR', 'SCI_IS');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('NEW', 'TO_ANALYZE', 'INTERESTING', 'VISIT_PLANNED', 'OFFER', 'NEGOTIATION', 'REJECTED', 'PURCHASED');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'USER_PROVIDED');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('FAVORABLE', 'TO_STUDY', 'UNFAVORABLE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "RecoveryToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SCI" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capital" DECIMAL(16,2) NOT NULL,
    "taxRegime" "TaxRegime" NOT NULL,
    "financialSettings" JSONB NOT NULL,
    "investmentAssumptions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SCI_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SCIMember" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "shares" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SCIMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" DECIMAL(16,2) NOT NULL,
    "area" DECIMAL(12,2) NOT NULL,
    "city" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "rooms" INTEGER,
    "bedrooms" INTEGER,
    "floor" INTEGER,
    "elevator" BOOLEAN,
    "balcony" BOOLEAN,
    "terrace" BOOLEAN,
    "parking" BOOLEAN,
    "garage" BOOLEAN,
    "cellar" BOOLEAN,
    "dpe" TEXT,
    "ges" TEXT,
    "condoCharges" DECIMAL(16,2),
    "propertyTax" DECIMAL(16,2),
    "description" TEXT,
    "photos" JSONB,
    "status" "PropertyStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "url" TEXT,
    "platform" TEXT NOT NULL,
    "rawText" TEXT,
    "normalizedData" JSONB NOT NULL,
    "photoRights" TEXT,
    "publishedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyAnalysis" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanScenario" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "principal" DECIMAL(16,2) NOT NULL,
    "annualRate" DECIMAL(8,4) NOT NULL,
    "months" INTEGER NOT NULL,
    "insuranceRate" DECIMAL(8,4) NOT NULL,
    "deferredMonths" INTEGER NOT NULL DEFAULT 0,
    "loanType" TEXT NOT NULL DEFAULT 'AMORTIZING_FIXED',
    "assumptions" JSONB NOT NULL,

    CONSTRAINT "LoanScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxScenario" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "regime" "TaxRegime" NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "results" JSONB,

    CONSTRAINT "TaxScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "annualAmount" DECIMAL(16,2),
    "rentPercent" DECIMAL(8,4),
    "recoverable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Renovation" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "contingencyRate" DECIMAL(8,4) NOT NULL,
    "plannedYear" INTEGER,

    CONSTRAINT "Renovation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketData" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DECIMAL(18,6),
    "source" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "zone" TEXT NOT NULL,
    "confidence" "Confidence" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Projection" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "assumptions" JSONB NOT NULL,
    "annualResults" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Projection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlist" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentionedMemberIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "choice" "VoteChoice" NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "channels" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryToken_tokenHash_key" ON "RecoveryToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RecoveryToken_userId_idx" ON "RecoveryToken"("userId");

-- CreateIndex
CREATE INDEX "SCIMember_userId_idx" ON "SCIMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SCIMember_sciId_userId_key" ON "SCIMember"("sciId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SCIMember_sciId_id_key" ON "SCIMember"("sciId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_sciId_email_idx" ON "Invitation"("sciId", "email");

-- CreateIndex
CREATE INDEX "Property_sciId_status_createdAt_idx" ON "Property"("sciId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Property_sciId_city_price_idx" ON "Property"("sciId", "city", "price");

-- CreateIndex
CREATE UNIQUE INDEX "Property_sciId_id_key" ON "Property"("sciId", "id");

-- CreateIndex
CREATE INDEX "Listing_sciId_propertyId_idx" ON "Listing"("sciId", "propertyId");

-- CreateIndex
CREATE INDEX "PropertyAnalysis_sciId_propertyId_createdAt_idx" ON "PropertyAnalysis"("sciId", "propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "LoanScenario_sciId_propertyId_idx" ON "LoanScenario"("sciId", "propertyId");

-- CreateIndex
CREATE INDEX "TaxScenario_sciId_propertyId_idx" ON "TaxScenario"("sciId", "propertyId");

-- CreateIndex
CREATE INDEX "Expense_sciId_propertyId_idx" ON "Expense"("sciId", "propertyId");

-- CreateIndex
CREATE INDEX "Renovation_sciId_propertyId_idx" ON "Renovation"("sciId", "propertyId");

-- CreateIndex
CREATE INDEX "MarketData_sciId_propertyId_metric_idx" ON "MarketData"("sciId", "propertyId", "metric");

-- CreateIndex
CREATE INDEX "Projection_sciId_propertyId_idx" ON "Projection"("sciId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Watchlist_sciId_propertyId_memberId_key" ON "Watchlist"("sciId", "propertyId", "memberId");

-- CreateIndex
CREATE INDEX "Comment_sciId_propertyId_createdAt_idx" ON "Comment"("sciId", "propertyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_sciId_propertyId_memberId_key" ON "Vote"("sciId", "propertyId", "memberId");

-- CreateIndex
CREATE INDEX "Alert_sciId_enabled_idx" ON "Alert"("sciId", "enabled");

-- CreateIndex
CREATE INDEX "Notification_sciId_memberId_readAt_idx" ON "Notification"("sciId", "memberId", "readAt");

-- CreateIndex
CREATE INDEX "ActivityLog_sciId_createdAt_idx" ON "ActivityLog"("sciId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryToken" ADD CONSTRAINT "RecoveryToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SCIMember" ADD CONSTRAINT "SCIMember_sciId_fkey" FOREIGN KEY ("sciId") REFERENCES "SCI"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SCIMember" ADD CONSTRAINT "SCIMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_sciId_fkey" FOREIGN KEY ("sciId") REFERENCES "SCI"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_sciId_fkey" FOREIGN KEY ("sciId") REFERENCES "SCI"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sciId_propertyId_fkey" FOREIGN KEY ("sciId", "propertyId") REFERENCES "Property"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAnalysis" ADD CONSTRAINT "PropertyAnalysis_sciId_propertyId_fkey" FOREIGN KEY ("sciId", "propertyId") REFERENCES "Property"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanScenario" ADD CONSTRAINT "LoanScenario_sciId_propertyId_fkey" FOREIGN KEY ("sciId", "propertyId") REFERENCES "Property"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxScenario" ADD CONSTRAINT "TaxScenario_sciId_propertyId_fkey" FOREIGN KEY ("sciId", "propertyId") REFERENCES "Property"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_sciId_propertyId_fkey" FOREIGN KEY ("sciId", "propertyId") REFERENCES "Property"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Renovation" ADD CONSTRAINT "Renovation_sciId_propertyId_fkey" FOREIGN KEY ("sciId", "propertyId") REFERENCES "Property"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketData" ADD CONSTRAINT "MarketData_sciId_propertyId_fkey" FOREIGN KEY ("sciId", "propertyId") REFERENCES "Property"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Projection" ADD CONSTRAINT "Projection_sciId_propertyId_fkey" FOREIGN KEY ("sciId", "propertyId") REFERENCES "Property"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_sciId_propertyId_fkey" FOREIGN KEY ("sciId", "propertyId") REFERENCES "Property"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_sciId_memberId_fkey" FOREIGN KEY ("sciId", "memberId") REFERENCES "SCIMember"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_sciId_propertyId_fkey" FOREIGN KEY ("sciId", "propertyId") REFERENCES "Property"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_sciId_memberId_fkey" FOREIGN KEY ("sciId", "memberId") REFERENCES "SCIMember"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_sciId_propertyId_fkey" FOREIGN KEY ("sciId", "propertyId") REFERENCES "Property"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_sciId_memberId_fkey" FOREIGN KEY ("sciId", "memberId") REFERENCES "SCIMember"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_sciId_fkey" FOREIGN KEY ("sciId") REFERENCES "SCI"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_sciId_memberId_fkey" FOREIGN KEY ("sciId", "memberId") REFERENCES "SCIMember"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_sciId_fkey" FOREIGN KEY ("sciId") REFERENCES "SCI"("id") ON DELETE CASCADE ON UPDATE CASCADE;
