-- AlterTable: link a squad to its Telegram group chat
ALTER TABLE "squads" ADD COLUMN "tg_chat_id" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "squads_tg_chat_id_key" ON "squads"("tg_chat_id");
