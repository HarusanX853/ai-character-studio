import type { Prisma } from "@prisma/client";
import { toInputJson } from "@/lib/utils/json";

const managedPublicFactSources = ["seed", "episode_public_facts"];

function appendPublicFact(facts: string[], value: unknown) {
  if (typeof value !== "string") {
    return;
  }

  const content = value.trim();
  if (content) {
    facts.push(content);
  }
}

export function extractPublicFacts(value: unknown): string[] {
  const facts: string[] = [];

  function visit(node: unknown) {
    if (typeof node === "string") {
      appendPublicFact(facts, node);
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (!node || typeof node !== "object") {
      return;
    }

    const record = node as Record<string, unknown>;
    appendPublicFact(facts, record.content);
    appendPublicFact(facts, record.fact);
    appendPublicFact(facts, record.text);
  }

  visit(value);
  return [...new Set(facts)];
}

export async function syncPublicFactsBoardItems(
  tx: Prisma.TransactionClient,
  episodeId: string,
  publicFactsJson: unknown
) {
  const facts = extractPublicFacts(publicFactsJson);

  await tx.sharedBoardItem.deleteMany({
    where: {
      episodeId,
      type: "public_fact",
      source: { in: managedPublicFactSources }
    }
  });

  if (!facts.length) {
    return;
  }

  await tx.sharedBoardItem.createMany({
    data: facts.map((content) => ({
      episodeId,
      type: "public_fact",
      content,
      source: "episode_public_facts",
      confidence: 1,
      tagsJson: toInputJson(["episode_public_facts"])
    }))
  });
}
