-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CONSULTANT', 'CLIENT', 'VIEWER');

-- CreateEnum
CREATE TYPE "Sector" AS ENUM ('TRANSPORT', 'LUXE', 'AERONAUTIQUE', 'SAAS', 'BANQUE', 'ASSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "OrgSize" AS ENUM ('SOLO', 'PME', 'ETI', 'GRAND_GROUPE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "Forfait" AS ENUM ('STARTER', 'BUSINESS', 'ENTERPRISE', 'PREMIUM', 'HIGH_VALUE', 'POC');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Branch" AS ENUM ('SI', 'RH', 'MARKETING', 'COMMUNICATION', 'COMPTABILITE', 'FINANCE', 'SUPPLY_CHAIN');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('DEVELOPMENT', 'TESTING', 'DEPLOYED', 'PAUSED', 'RETIRED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE_FORM', 'WEBSITE_CHAT', 'WEBSITE_SIMULATOR', 'WEBSITE_AUDIT_QUIZ', 'LINKEDIN', 'REFERRAL', 'EVENT', 'COLD_OUTBOUND', 'PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'WAITING_APPROVAL', 'DONE', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DecisionKind" AS ENUM ('RETRIEVE', 'COMPUTE', 'REASON', 'VALIDATE');

-- CreateEnum
CREATE TYPE "MemoryScope" AS ENUM ('ORG', 'USER', 'AGENT');

-- CreateEnum
CREATE TYPE "ApprovalTier" AS ENUM ('USER', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" "Sector" NOT NULL,
    "size" "OrgSize" NOT NULL,
    "revenue" TEXT,
    "website" TEXT,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "forfait" "Forfait" NOT NULL,
    "status" "ContractStatus" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "monthlyAmount" DOUBLE PRECISION NOT NULL,
    "setupAmount" DOUBLE PRECISION NOT NULL,
    "branches" "Branch"[],
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeployedAgent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "branch" "Branch" NOT NULL,
    "sector" "Sector" NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL,
    "totalQueries" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" BIGINT NOT NULL DEFAULT 0,
    "avgResponseTime" DOUBLE PRECISION,
    "satisfactionScore" DOUBLE PRECISION,
    "config" JSONB,
    "deployedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeployedAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "InvoiceStatus" NOT NULL,
    "period" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "jobTitle" TEXT,
    "company" TEXT NOT NULL,
    "sector" "Sector",
    "orgSize" "OrgSize",
    "branches" "Branch"[],
    "estimatedUsers" INTEGER,
    "budget" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" "LeadSource" NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadNote" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsletterSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "sector" "Sector",
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribedAt" TIMESTAMP(3),

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditQuizResult" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "sector" "Sector",
    "dataMaturity" INTEGER NOT NULL,
    "techMaturity" INTEGER NOT NULL,
    "cultureMaturity" INTEGER NOT NULL,
    "processMaturity" INTEGER NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "recommendedForfait" "Forfait",
    "recommendedBranches" "Branch"[],
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditQuizResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT,
    "agentId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "confidence" DOUBLE PRECISION,
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "model" TEXT,
    "costUsd" DECIMAL(10,6),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "trace" JSONB,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDecision" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "kind" "DecisionKind" NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL,
    "scope" "MemoryScope" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "embedding" BYTEA,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "tier" "ApprovalTier" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatoryAlert" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "impactScore" DOUBLE PRECISION NOT NULL,
    "affectedAgents" TEXT[],
    "summary" TEXT NOT NULL,
    "fullAnalysis" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulatoryAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_stripeSubscriptionId_key" ON "Contract"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_email_key" ON "NewsletterSubscriber"("email");

-- CreateIndex
CREATE INDEX "AgentRun_agentId_idx" ON "AgentRun"("agentId");

-- CreateIndex
CREATE INDEX "AgentRun_organizationId_startedAt_idx" ON "AgentRun"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "AgentRun_status_idx" ON "AgentRun"("status");

-- CreateIndex
CREATE INDEX "AgentDecision_runId_orderIndex_idx" ON "AgentDecision"("runId", "orderIndex");

-- CreateIndex
CREATE INDEX "Memory_scope_scopeId_idx" ON "Memory"("scope", "scopeId");

-- CreateIndex
CREATE INDEX "Memory_key_idx" ON "Memory"("key");

-- CreateIndex
CREATE INDEX "Approval_status_expiresAt_idx" ON "Approval"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Approval_runId_idx" ON "Approval"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "RegulatoryAlert_externalId_key" ON "RegulatoryAlert"("externalId");

-- CreateIndex
CREATE INDEX "RegulatoryAlert_source_publishedAt_idx" ON "RegulatoryAlert"("source", "publishedAt");

-- CreateIndex
CREATE INDEX "RegulatoryAlert_impactScore_idx" ON "RegulatoryAlert"("impactScore");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeployedAgent" ADD CONSTRAINT "DeployedAgent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeployedAgent" ADD CONSTRAINT "DeployedAgent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDecision" ADD CONSTRAINT "AgentDecision_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
