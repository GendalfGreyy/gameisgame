-- AlterTable
ALTER TABLE "users" ADD COLUMN "referred_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "users_referred_by_id_idx" ON "users"("referred_by_id");
