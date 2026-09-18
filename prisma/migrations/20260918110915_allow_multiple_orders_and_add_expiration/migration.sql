/*
  Warnings:

  - Added the required column `expiresAt` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Order_eventSeatId_key";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Order_eventSeatId_status_idx" ON "Order"("eventSeatId", "status");
