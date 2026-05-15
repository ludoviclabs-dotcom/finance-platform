-- CreateTable
CREATE TABLE "StatusProbe" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "error" TEXT,
    "probedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusProbe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatusProbe_componentId_probedAt_idx" ON "StatusProbe"("componentId", "probedAt");
