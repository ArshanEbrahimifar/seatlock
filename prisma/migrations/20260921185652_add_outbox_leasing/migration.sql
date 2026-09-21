-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedBy" TEXT;
