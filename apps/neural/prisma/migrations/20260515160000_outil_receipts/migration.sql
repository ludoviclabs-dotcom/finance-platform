-- CreateTable
CREATE TABLE "OutilReceipt" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "toolLabel" TEXT NOT NULL,
    "resultLabel" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutilReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutilReceipt_hash_key" ON "OutilReceipt"("hash");

-- CreateIndex
CREATE INDEX "OutilReceipt_tool_createdAt_idx" ON "OutilReceipt"("tool", "createdAt");
