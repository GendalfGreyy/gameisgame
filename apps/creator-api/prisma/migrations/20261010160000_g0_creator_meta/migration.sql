-- CreateTable
CREATE TABLE "creator_schema_meta" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_schema_meta_pkey" PRIMARY KEY ("id")
);
