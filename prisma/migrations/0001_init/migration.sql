-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "sync_records" (
    "collection" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "data" JSONB,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "seq" BIGSERIAL NOT NULL,

    CONSTRAINT "sync_records_pkey" PRIMARY KEY ("collection","id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" SERIAL NOT NULL,
    "ip" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_records_seq_idx" ON "sync_records"("seq");

-- CreateIndex
CREATE INDEX "login_attempts_ip_createdAt_idx" ON "login_attempts"("ip", "createdAt");

