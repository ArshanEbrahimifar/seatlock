-- AlterTable
ALTER TABLE "EventSeat" ADD COLUMN     "holdExpiresAt" TIMESTAMP(3),
ADD COLUMN     "holdToken" UUID;
