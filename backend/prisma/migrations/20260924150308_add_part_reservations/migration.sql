-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('planned', 'completed');

-- CreateEnum
CREATE TYPE "ReservationSourceType" AS ENUM ('toir_schedule', 'maintenance_log');

-- AlterTable
ALTER TABLE "maintenance_logs" ADD COLUMN     "status" "LogStatus" NOT NULL DEFAULT 'completed';

-- CreateTable
CREATE TABLE "part_reservations" (
    "id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "source_type" "ReservationSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "part_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "part_reservations_part_id_idx" ON "part_reservations"("part_id");

-- CreateIndex
CREATE INDEX "part_reservations_source_type_source_id_idx" ON "part_reservations"("source_type", "source_id");

-- AddForeignKey
ALTER TABLE "part_reservations" ADD CONSTRAINT "part_reservations_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "spare_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
