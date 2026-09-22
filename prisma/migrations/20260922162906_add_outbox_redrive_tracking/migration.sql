-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "redriveCount" INTEGER NOT NULL DEFAULT 0;
