CREATE TABLE "image_asset" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "data" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "image_asset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "image_asset_projectId_idx" ON "image_asset"("projectId");
ALTER TABLE "image_asset" ADD CONSTRAINT "image_asset_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
