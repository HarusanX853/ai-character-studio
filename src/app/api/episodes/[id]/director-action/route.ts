import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  formatEvidenceForBoard,
  getCurrentStage,
  getEvidenceById,
  getEvidenceForStage,
  getNextStage,
  normalizeTrialRules,
  type TrialEvidence,
  type TrialRules,
  type TrialStage
} from "@/lib/jury/trial-state";
import { asRecord, toInputJson } from "@/lib/utils/json";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function readAction(body: unknown) {
  const record = asRecord(body);
  return typeof record.action === "string" ? record.action : "";
}

function readString(body: unknown, key: string) {
  const value = asRecord(body)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function withReleasedEvidence(rules: TrialRules, evidenceIds: string[]) {
  return [...new Set([...rules.releasedEvidenceIds, ...evidenceIds])];
}

async function createRuleBoardItem(episodeId: string, content: string, tags: string[]) {
  return prisma.sharedBoardItem.create({
    data: {
      episodeId,
      type: "rule_state",
      content,
      source: "director",
      confidence: 1,
      tagsJson: toInputJson(["director", ...tags])
    }
  });
}

async function createEvidenceBoardItems(episodeId: string, evidenceItems: TrialEvidence[]) {
  if (!evidenceItems.length) {
    return [];
  }

  return Promise.all(
    evidenceItems.map((evidence) =>
      prisma.sharedBoardItem.create({
        data: {
          episodeId,
          type: "clue",
          content: formatEvidenceForBoard(evidence),
          source: `director:evidence:${evidence.id}`,
          confidence: 1,
          tagsJson: toInputJson(["director", "evidence", evidence.id])
        }
      })
    )
  );
}

function stageLabel(stage: TrialStage | null) {
  return stage ? `${stage.title} (${stage.id})` : "No stage";
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as unknown;
  const action = readAction(body);

  const episode = await prisma.episode.findUnique({ where: { id } });
  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  const rules = normalizeTrialRules(episode.rulesJson);
  let nextRules: TrialRules = rules;
  let message = "Director action complete.";
  const evidenceToPublish: TrialEvidence[] = [];
  const ruleBoardMessages: string[] = [];

  if (action === "advance_stage") {
    const nextStage = getNextStage(rules);
    if (!nextStage) {
      return NextResponse.json({ error: "No next stage is configured." }, { status: 400 });
    }

    nextRules = {
      ...rules,
      currentStageId: nextStage.id,
      voteOpen: false,
      activeVoteStageId: null
    };
    message = `Advanced to ${stageLabel(nextStage)}.`;
    ruleBoardMessages.push(message);
  } else if (action === "set_stage") {
    const stageId = readString(body, "stageId");
    const nextStage = rules.stages.find((stage) => stage.id === stageId) ?? null;
    if (!nextStage) {
      return NextResponse.json({ error: "Stage not found." }, { status: 400 });
    }

    nextRules = {
      ...rules,
      currentStageId: nextStage.id,
      voteOpen: false,
      activeVoteStageId: null
    };
    message = `Set stage to ${stageLabel(nextStage)}.`;
    ruleBoardMessages.push(message);
  } else if (action === "release_evidence") {
    const evidenceId = readString(body, "evidenceId");
    if (!evidenceId) {
      return NextResponse.json({ error: "evidenceId is required." }, { status: 400 });
    }

    const evidence = getEvidenceById(rules, evidenceId);
    if (!evidence) {
      return NextResponse.json({ error: "Evidence not found." }, { status: 400 });
    }

    const alreadyReleased = rules.releasedEvidenceIds.includes(evidence.id);
    nextRules = {
      ...rules,
      releasedEvidenceIds: withReleasedEvidence(rules, [evidence.id])
    };

    if (!alreadyReleased) {
      evidenceToPublish.push(evidence);
    }

    message = alreadyReleased ? `${evidence.id} was already released.` : `Released evidence ${evidence.id}.`;
  } else if (action === "release_stage_evidence") {
    const currentStage = getCurrentStage(rules);
    const stageEvidence = getEvidenceForStage(rules, currentStage);
    const unreleased = stageEvidence.filter((evidence) => !rules.releasedEvidenceIds.includes(evidence.id));

    nextRules = {
      ...rules,
      releasedEvidenceIds: withReleasedEvidence(
        rules,
        stageEvidence.map((evidence) => evidence.id)
      )
    };
    evidenceToPublish.push(...unreleased);
    message = unreleased.length
      ? `Released ${unreleased.length} evidence item(s) for ${stageLabel(currentStage)}.`
      : `All evidence for ${stageLabel(currentStage)} was already released.`;
  } else if (action === "start_vote") {
    const currentStage = getCurrentStage(rules);
    nextRules = {
      ...rules,
      voteOpen: true,
      activeVoteStageId: currentStage?.id ?? null
    };
    message = `Vote opened for ${stageLabel(currentStage)}.`;
    ruleBoardMessages.push(
      `${message}\nOptions: ${
        rules.voteOptions.length ? rules.voteOptions.join(" / ") : "guilty / not guilty / undecided"
      }`
    );
  } else if (action === "close_vote") {
    const currentStage = getCurrentStage(rules);
    nextRules = {
      ...rules,
      voteOpen: false,
      activeVoteStageId: null
    };
    message = `Vote closed for ${stageLabel(currentStage)}.`;
    ruleBoardMessages.push(message);
  } else {
    return NextResponse.json({ error: "Unknown director action." }, { status: 400 });
  }

  await prisma.episode.update({
    where: { id },
    data: {
      rulesJson: toInputJson(nextRules)
    }
  });

  await createEvidenceBoardItems(id, evidenceToPublish);
  await Promise.all(ruleBoardMessages.map((content) => createRuleBoardItem(id, content, [action])));

  return NextResponse.json({ message, rules: nextRules });
}

