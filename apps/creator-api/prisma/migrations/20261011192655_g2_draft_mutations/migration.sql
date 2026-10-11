-- CreateTable
CREATE TABLE "draft_mutations" (
    "project_id" UUID NOT NULL,
    "mutation_id" TEXT NOT NULL,
    "base_revision" INTEGER NOT NULL,
    "document_hash" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_mutations_pkey" PRIMARY KEY ("project_id","mutation_id")
);

-- CreateIndex
CREATE INDEX "draft_mutations_project_id_created_at_idx" ON "draft_mutations"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "draft_mutations" ADD CONSTRAINT "draft_mutations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
