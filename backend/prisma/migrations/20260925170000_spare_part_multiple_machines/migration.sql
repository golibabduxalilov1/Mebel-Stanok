-- A spare part can now be bound to several machines instead of just one.

-- CreateTable
CREATE TABLE "_MachineToSparePart" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MachineToSparePart_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_MachineToSparePart_B_index" ON "_MachineToSparePart"("B");

-- AddForeignKey
ALTER TABLE "_MachineToSparePart" ADD CONSTRAINT "_MachineToSparePart_A_fkey" FOREIGN KEY ("A") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MachineToSparePart" ADD CONSTRAINT "_MachineToSparePart_B_fkey" FOREIGN KEY ("B") REFERENCES "spare_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry over existing single-machine bindings into the new join table before dropping the old column
INSERT INTO "_MachineToSparePart" ("A", "B")
SELECT "machine_id", "id" FROM "spare_parts" WHERE "machine_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "spare_parts" DROP CONSTRAINT "spare_parts_machine_id_fkey";

-- AlterTable
ALTER TABLE "spare_parts" DROP COLUMN "machine_id";
