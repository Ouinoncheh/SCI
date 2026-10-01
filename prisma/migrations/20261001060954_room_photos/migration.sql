-- CreateTable
CREATE TABLE "PropertyRoom" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomType" TEXT NOT NULL,
    "floor" INTEGER,
    "areaEstimate" DOUBLE PRECISION,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomPhoto" (
    "id" TEXT NOT NULL,
    "sciId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "image" BYTEA NOT NULL,
    "thumbnail" BYTEA NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/webp',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "angleLabel" TEXT NOT NULL,
    "comment" TEXT NOT NULL,

    CONSTRAINT "RoomPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PropertyRoom_sciId_propertyId_id_key" ON "PropertyRoom"("sciId", "propertyId", "id");

-- CreateIndex
CREATE INDEX "RoomPhoto_sciId_propertyId_roomId_idx" ON "RoomPhoto"("sciId", "propertyId", "roomId");

-- AddForeignKey
ALTER TABLE "PropertyRoom" ADD CONSTRAINT "PropertyRoom_sciId_propertyId_fkey" FOREIGN KEY ("sciId", "propertyId") REFERENCES "Property"("sciId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPhoto" ADD CONSTRAINT "RoomPhoto_sciId_propertyId_roomId_fkey" FOREIGN KEY ("sciId", "propertyId", "roomId") REFERENCES "PropertyRoom"("sciId", "propertyId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
