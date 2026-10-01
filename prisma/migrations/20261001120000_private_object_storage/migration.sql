ALTER TABLE "RoomPhoto" ALTER COLUMN "image" DROP NOT NULL, ALTER COLUMN "thumbnail" DROP NOT NULL,
ADD COLUMN "imagePath" TEXT, ADD COLUMN "thumbnailPath" TEXT;
ALTER TABLE "ImportAsset" ALTER COLUMN "original" DROP NOT NULL,
ADD COLUMN "originalPath" TEXT, ADD COLUMN "mediumPath" TEXT, ADD COLUMN "thumbnailPath" TEXT;
ALTER TABLE "GeneratedVisual" ADD COLUMN "imagePath" TEXT, ADD COLUMN "thumbnailPath" TEXT;
