-- CreateEnum
CREATE TYPE "GatewayDecision" AS ENUM ('ALLOW', 'REVIEW', 'BLOCK');

-- CreateTable
CREATE TABLE "GatewayEvent" (
    "id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'default',
    "runId" TEXT,
    "agentId" TEXT NOT NULL,
    "agentVersion" TEXT NOT NULL,
    "model" TEXT,
    "promptHash" TEXT NOT NULL,
    "decision" "GatewayDecision" NOT NULL,
    "outcome" TEXT NOT NULL,
    "trigger" TEXT,
    "tokens" INTEGER,
    "latencyMs" INTEGER,
    "costEur" DECIMAL(10,6),
    "prevSignature" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatewayEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GatewayEvent_signature_key" ON "GatewayEvent"("signature");

-- CreateIndex
CREATE UNIQUE INDEX "GatewayEvent_tenantId_sequence_key" ON "GatewayEvent"("tenantId", "sequence");

-- CreateIndex
CREATE INDEX "GatewayEvent_tenantId_recordedAt_idx" ON "GatewayEvent"("tenantId", "recordedAt");

-- CreateIndex
CREATE INDEX "GatewayEvent_agentId_recordedAt_idx" ON "GatewayEvent"("agentId", "recordedAt");
