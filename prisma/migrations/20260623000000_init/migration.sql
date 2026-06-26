-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "roleArchetype" TEXT,
    "personalityJson" JSONB NOT NULL,
    "backstory" TEXT NOT NULL,
    "publicGoal" TEXT,
    "privateGoal" TEXT,
    "secretsJson" JSONB,
    "speechStyle" TEXT,
    "costPolicyJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "setting" TEXT NOT NULL,
    "publicFactsJson" JSONB,
    "hiddenFactsJson" JSONB,
    "rulesJson" JSONB,
    "budgetUsd" REAL NOT NULL DEFAULT 3,
    "maxRounds" INTEGER NOT NULL DEFAULT 12,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EpisodeCharacter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "episodeId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "roleInEpisode" TEXT,
    "hiddenFactsJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EpisodeCharacter_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EpisodeCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Turn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "episodeId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "speakerCharacterId" TEXT NOT NULL,
    "inputContextJson" JSONB,
    "outputJson" JSONB NOT NULL,
    "speech" TEXT NOT NULL,
    "action" TEXT,
    "innerThought" TEXT,
    "emotion" TEXT,
    "intent" TEXT,
    "tokensInput" INTEGER NOT NULL DEFAULT 0,
    "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" REAL NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Turn_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Turn_speakerCharacterId_fkey" FOREIGN KEY ("speakerCharacterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "episodeId" TEXT,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "importance" REAL NOT NULL DEFAULT 0.5,
    "embeddingJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Memory_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Memory_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SharedBoardItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "episodeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "introducedByCharacterId" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "tagsJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SharedBoardItem_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SharedBoardItem_introducedByCharacterId_fkey" FOREIGN KEY ("introducedByCharacterId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LlmCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "characterId" TEXT,
    "episodeId" TEXT,
    "requestJson" JSONB,
    "responseJson" JSONB,
    "tokensInput" INTEGER NOT NULL DEFAULT 0,
    "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" REAL NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LlmCall_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EpisodeCheckpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "episodeId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "graphStateJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EpisodeCheckpoint_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Character_name_key" ON "Character"("name");

-- CreateIndex
CREATE INDEX "Character_provider_model_idx" ON "Character"("provider", "model");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_title_key" ON "Episode"("title");

-- CreateIndex
CREATE INDEX "Episode_status_idx" ON "Episode"("status");

-- CreateIndex
CREATE INDEX "Episode_format_idx" ON "Episode"("format");

-- CreateIndex
CREATE INDEX "EpisodeCharacter_characterId_idx" ON "EpisodeCharacter"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeCharacter_episodeId_characterId_key" ON "EpisodeCharacter"("episodeId", "characterId");

-- CreateIndex
CREATE INDEX "Turn_episodeId_roundIndex_idx" ON "Turn"("episodeId", "roundIndex");

-- CreateIndex
CREATE INDEX "Turn_speakerCharacterId_idx" ON "Turn"("speakerCharacterId");

-- CreateIndex
CREATE INDEX "Turn_createdAt_idx" ON "Turn"("createdAt");

-- CreateIndex
CREATE INDEX "Memory_characterId_visibility_idx" ON "Memory"("characterId", "visibility");

-- CreateIndex
CREATE INDEX "Memory_episodeId_idx" ON "Memory"("episodeId");

-- CreateIndex
CREATE INDEX "Memory_importance_idx" ON "Memory"("importance");

-- CreateIndex
CREATE INDEX "SharedBoardItem_episodeId_visibility_idx" ON "SharedBoardItem"("episodeId", "visibility");

-- CreateIndex
CREATE INDEX "SharedBoardItem_introducedByCharacterId_idx" ON "SharedBoardItem"("introducedByCharacterId");

-- CreateIndex
CREATE INDEX "LlmCall_provider_model_idx" ON "LlmCall"("provider", "model");

-- CreateIndex
CREATE INDEX "LlmCall_episodeId_idx" ON "LlmCall"("episodeId");

-- CreateIndex
CREATE INDEX "LlmCall_characterId_idx" ON "LlmCall"("characterId");

-- CreateIndex
CREATE INDEX "LlmCall_createdAt_idx" ON "LlmCall"("createdAt");

-- CreateIndex
CREATE INDEX "EpisodeCheckpoint_threadId_idx" ON "EpisodeCheckpoint"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeCheckpoint_episodeId_threadId_key" ON "EpisodeCheckpoint"("episodeId", "threadId");
