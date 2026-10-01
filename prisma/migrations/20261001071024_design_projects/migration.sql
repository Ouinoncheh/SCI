-- CreateTable
CREATE TABLE "RoomDesignProject" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "scenarioId" TEXT,
    "name" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "renovationLevel" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RoomDesignProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedVisual" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "variationLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "image" BYTEA,
    "thumbnail" BYTEA,
    "width" INTEGER,
    "height" INTEGER,
    "errorMessage" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "leaseId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedVisual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomDesignProject_sciId_propertyId_archived_idx" ON "RoomDesignProject"("sciId", "propertyId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "RoomDesignProject_sciId_propertyId_id_key" ON "RoomDesignProject"("sciId", "propertyId", "id");

-- CreateIndex
CREATE INDEX "GeneratedVisual_status_createdAt_idx" ON "GeneratedVisual"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GeneratedVisual_sciId_createdAt_idx" ON "GeneratedVisual"("sciId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedVisual_sciId_requestKey_variationLabel_key" ON "GeneratedVisual"("sciId", "requestKey", "variationLabel");

-- AddForeignKey
ALTER TABLE "RoomDesignProject" ADD CONSTRAINT "RoomDesignProject_sciId_propertyId_fkey" FOREIGN KEY ("sciId", "propertyId") REFERENCES "Property"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedVisual" ADD CONSTRAINT "GeneratedVisual_sciId_propertyId_projectId_fkey" FOREIGN KEY ("sciId", "propertyId", "projectId") REFERENCES "RoomDesignProject"("sciId", "propertyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
