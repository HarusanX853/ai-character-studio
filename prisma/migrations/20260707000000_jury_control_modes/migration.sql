-- CreateTable
CREATE TABLE "HostMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "episodeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'message',
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HostMessage_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IndependentOpinion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "episodeId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "hostMessageId" TEXT,
    "roundIndex" INTEGER NOT NULL DEFAULT 1,
    "outputJson" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "guiltyProbability" REAL,
    "keyEvidence" TEXT,
    "influentialArgument" TEXT,
    "rationale" TEXT,
    "tokensInput" INTEGER NOT NULL DEFAULT 0,
    "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" REAL NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IndependentOpinion_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IndependentOpinion_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IndependentOpinion_hostMessageId_fkey" FOREIGN KEY ("hostMessageId") REFERENCES "HostMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "HostMessage_episodeId_createdAt_idx" ON "HostMessage"("episodeId", "createdAt");

-- CreateIndex
CREATE INDEX "HostMessage_kind_idx" ON "HostMessage"("kind");

-- CreateIndex
CREATE INDEX "IndependentOpinion_episodeId_createdAt_idx" ON "IndependentOpinion"("episodeId", "createdAt");

-- CreateIndex
CREATE INDEX "IndependentOpinion_characterId_createdAt_idx" ON "IndependentOpinion"("characterId", "createdAt");

-- CreateIndex
CREATE INDEX "IndependentOpinion_hostMessageId_idx" ON "IndependentOpinion"("hostMessageId");

-- CreateIndex
CREATE INDEX "IndependentOpinion_verdict_idx" ON "IndependentOpinion"("verdict");
