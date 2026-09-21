-- DropIndex
DROP INDEX "OutboxEvent_processedAt_createdAt_idx";

-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "nextAttemptAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "OutboxEvent_processedAt_deadLetteredAt_nextAttemptAt_locked_idx" ON "OutboxEvent"("processedAt", "deadLetteredAt", "nextAttemptAt", "lockedAt", "createdAt");
