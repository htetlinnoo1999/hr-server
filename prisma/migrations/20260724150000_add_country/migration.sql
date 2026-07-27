-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_name_key" ON "countries"("name");

-- CreateIndex
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- Seed a default country so existing employee rows can be backfilled below
INSERT INTO "countries" ("id", "name", "code", "createdAt", "updatedAt")
VALUES ('default-country-mm', 'Myanmar', 'MM', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- AlterTable: employees (add nullable, backfill existing rows, then enforce NOT NULL)
ALTER TABLE "employees" ADD COLUMN "countryId" TEXT;
UPDATE "employees" SET "countryId" = 'default-country-mm';
ALTER TABLE "employees" ALTER COLUMN "countryId" SET NOT NULL;

-- AlterTable: public_holidays (table is empty, safe to add NOT NULL directly)
ALTER TABLE "public_holidays" ADD COLUMN "countryId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_holidays" ADD CONSTRAINT "public_holidays_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
