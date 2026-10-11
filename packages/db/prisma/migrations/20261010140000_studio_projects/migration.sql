-- CreateEnum
CREATE TYPE "StudioProjectStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateTable
CREATE TABLE "studio_projects" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "StudioProjectStatus" NOT NULL DEFAULT 'draft',
    "scene" JSONB NOT NULL,
    "accent_color" TEXT NOT NULL DEFAULT '#3DDC97',
    "play_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_projects_owner_id_updated_at_idx" ON "studio_projects"("owner_id", "updated_at");

-- CreateIndex
CREATE INDEX "studio_projects_status_published_at_idx" ON "studio_projects"("status", "published_at");

-- AddForeignKey
ALTER TABLE "studio_projects" ADD CONSTRAINT "studio_projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
