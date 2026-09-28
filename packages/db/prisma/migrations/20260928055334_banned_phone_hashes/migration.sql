-- CreateTable
CREATE TABLE "banned_phone_hashes" (
    "phone_hmac" TEXT NOT NULL,
    "banned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sanction_id" UUID,

    CONSTRAINT "banned_phone_hashes_pkey" PRIMARY KEY ("phone_hmac")
);

-- CreateIndex
CREATE INDEX "banned_phone_hashes_banned_at_idx" ON "banned_phone_hashes"("banned_at");
