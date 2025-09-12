-- CreateTable
CREATE TABLE "public"."analytics" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB,
    "quickActionType" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_summaries" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalSessions" INTEGER NOT NULL DEFAULT 0,
    "totalMessages" INTEGER NOT NULL DEFAULT 0,
    "avgMessagesPerSession" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quickActionClicks" JSONB,
    "uniqueSessions" INTEGER NOT NULL DEFAULT 0,
    "completedSessions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_sessionId_idx" ON "public"."analytics"("sessionId");

-- CreateIndex
CREATE INDEX "analytics_eventType_idx" ON "public"."analytics"("eventType");

-- CreateIndex
CREATE INDEX "analytics_timestamp_idx" ON "public"."analytics"("timestamp");

-- CreateIndex
CREATE INDEX "analytics_createdAt_idx" ON "public"."analytics"("createdAt");

-- CreateIndex
CREATE INDEX "analytics_summaries_date_idx" ON "public"."analytics_summaries"("date");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_summaries_date_key" ON "public"."analytics_summaries"("date");
