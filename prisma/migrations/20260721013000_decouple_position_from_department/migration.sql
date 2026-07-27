-- DropForeignKey
ALTER TABLE "positions" DROP CONSTRAINT "positions_departmentId_fkey";

-- AlterTable
ALTER TABLE "positions" DROP COLUMN "departmentId";

-- CreateIndex
CREATE UNIQUE INDEX "positions_title_key" ON "positions"("title");
