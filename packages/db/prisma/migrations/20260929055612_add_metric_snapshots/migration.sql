-- CreateTable
CREATE TABLE "metric_snapshots" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metric" TEXT NOT NULL,
    "dimension" TEXT NOT NULL DEFAULT '',
    "value" DECIMAL(18,4) NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metric_snapshots_metric_period_start_idx" ON "metric_snapshots"("metric", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "metric_snapshots_metric_dimension_period_start_key" ON "metric_snapshots"("metric", "dimension", "period_start");
