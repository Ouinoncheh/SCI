-- CreateTable
CREATE TABLE "RenovationScenario" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenovationScenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RenovationScenario_sciId_propertyId_archived_idx" ON "RenovationScenario"("sciId", "propertyId", "archived");

-- AddForeignKey
ALTER TABLE "RenovationScenario" ADD CONSTRAINT "RenovationScenario_sciId_propertyId_fkey" FOREIGN KEY ("sciId", "propertyId") REFERENCES "Property"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
