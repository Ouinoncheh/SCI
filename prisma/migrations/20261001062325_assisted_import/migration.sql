-- CreateTable
CREATE TABLE "PropertyImportDraft" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEEDS_IMPORT_DATA',
    "normalized" JSONB NOT NULL,
    "enrichment" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "convertedPropertyId" TEXT,

    CONSTRAINT "PropertyImportDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportAsset" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "original" BYTEA NOT NULL,
    "medium" BYTEA,
    "thumbnail" BYTEA,
    "width" INTEGER,
    "height" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyImportDraft_sciId_status_updatedAt_idx" ON "PropertyImportDraft"("sciId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyImportDraft_sciId_id_key" ON "PropertyImportDraft"("sciId", "id");

-- CreateIndex
CREATE INDEX "ImportAsset_sciId_draftId_idx" ON "ImportAsset"("sciId", "draftId");

-- AddForeignKey
ALTER TABLE "PropertyImportDraft" ADD CONSTRAINT "PropertyImportDraft_sciId_fkey" FOREIGN KEY ("sciId") REFERENCES "SCI"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportAsset" ADD CONSTRAINT "ImportAsset_sciId_draftId_fkey" FOREIGN KEY ("sciId", "draftId") REFERENCES "PropertyImportDraft"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
