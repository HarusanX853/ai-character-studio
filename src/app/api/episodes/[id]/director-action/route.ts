import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  getCurrentStage,
  getEvidenceForStage,
  normalizeTrialRules,
  getNextStage,
  type TrialRules,
  type TrialVoteRound
} from "@/lib/jury/trial-state";
import { collectVotes, formatVoteEvidenceContent } from "@/lib/jury/voting";
import { syncEvidenceBoardItems } from "@/lib/shared-board/sync-evidence-board";
import { extractPublicFacts, syncPublicFactsBoardItems } from "@/lib/shared-board/sync-public-facts-board";
import { asRecord, toInputJson } from "@/lib/utils/json";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function readAction(body: unknown) {
  const record = asRecord(body);
  return typeof record.action === "string" ? record.action : "";
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

function makeVoteRoundId(round: number) {
  return `vote_round_${round}`;
}

function makeVoteEvidenceId(round: number) {
  return `VOTE-${round}`;
}

function withReleasedEvidence(rules: TrialRules, evidenceIds: string[]) {
  const releasedEvidenceIds = [
    ...new Set([...rules.releasedEvidenceIds, ...evidenceIds].filter((id) => rules.evidence.some((evidence) => evidence.id === id)))
  ];

  return {
    ...rules,
    allEvidenceVisible: false,
    all_evidence_visible: false,
    releasedEvidenceIds,
    released_evidence_ids: releasedEvidenceIds
  };
}

function readString(body: unknown, key: string) {
  const value = asRecord(body)[key];
  return typeof value === "string" ? value.trim() : "";
}

function upsertVoteRound(rules: TrialRules, voteRound: TrialVoteRound) {
  return [...rules.voteRounds.filter((round) => round.round !== voteRound.round), voteRound].sort(
    (left, right) => left.round - right.round
  );
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
  let nextRules: TrialRules | Record<string, unknown> = rules;
  let message = "Director action complete.";
  const ruleBoardMessages: string[] = [];
  let syncPublicFacts = false;
  let syncEvidence = false;

  if (action === "release_public_facts") {
    const facts = extractPublicFacts(episode.publicFactsJson);
    if (!facts.length) {
      return NextResponse.json({ error: "No case facts are configured." }, { status: 400 });
    }

    nextRules = {
      ...rules,
      caseFactsReleased: true,
      case_facts_released: true
    };
    syncPublicFacts = true;
    message = `Published ${facts.length} case fact${facts.length === 1 ? "" : "s"}.`;
  } else if (action === "release_evidence") {
    const evidenceId = readString(body, "evidenceId");
    const evidence = rules.evidence.find((item) => item.id === evidenceId);
    if (!evidence) {
      return NextResponse.json({ error: "Evidence was not found." }, { status: 400 });
    }

    if (rules.releasedEvidenceIds.includes(evidence.id)) {
      return NextResponse.json({ error: `${evidence.id} has already been released.` }, { status: 400 });
    }

    nextRules = withReleasedEvidence(rules, [evidence.id]);
    syncEvidence = true;
    message = `Published ${evidence.id}: ${evidence.title}.`;
  } else if (action === "release_stage_evidence") {
    const stage = getCurrentStage(rules);
    const stageEvidence = getEvidenceForStage(rules, stage);
    if (!stage || !stageEvidence.length) {
      return NextResponse.json({ error: "The current stage has no evidence to release." }, { status: 400 });
    }

    const unreleasedEvidence = stageEvidence.filter((evidence) => !rules.releasedEvidenceIds.includes(evidence.id));
    if (!unreleasedEvidence.length) {
      return NextResponse.json({ error: "All evidence for this stage has already been released." }, { status: 400 });
    }

    nextRules = withReleasedEvidence(rules, unreleasedEvidence.map((evidence) => evidence.id));
    syncEvidence = true;
    message = `Published ${unreleasedEvidence.map((evidence) => evidence.id).join(", ")}.`;
  } else if (action === "set_stage") {
    const stageId = readString(body, "stageId");
    const stage = rules.stages.find((item) => item.id === stageId);
    if (!stage) {
      return NextResponse.json({ error: "Stage was not found." }, { status: 400 });
    }

    nextRules = {
      ...rules,
      currentStageId: stage.id,
      current_stage_id: stage.id
    };
    message = `Current stage set to ${stage.order}. ${stage.title}.`;
  } else if (action === "advance_stage") {
    const stage = getNextStage(rules);
    if (!stage) {
      return NextResponse.json({ error: "The current stage is already the final stage." }, { status: 400 });
    }

    nextRules = {
      ...rules,
      currentStageId: stage.id,
      current_stage_id: stage.id
    };
    message = `Advanced to ${stage.order}. ${stage.title}.`;
  } else if (action === "start_vote") {
    if (rules.voteOpen) {
      return NextResponse.json({ error: "A vote round is already open." }, { status: 400 });
    }

    if (rules.currentVoteRound >= rules.maxVoteRounds) {
      return NextResponse.json({ error: `All ${rules.maxVoteRounds} vote rounds are complete.` }, { status: 400 });
    }

    const turnCount = await prisma.turn.count({ where: { episodeId: id } });
    const round = rules.currentVoteRound + 1;
    const now = new Date().toISOString();
    const voteRound: TrialVoteRound = {
      round,
      status: "open",
      openedAtTurnCount: turnCount,
      closedAtTurnCount: null,
      votes: [],
      evidenceId: null,
      createdAt: now,
      closedAt: null
    };

    nextRules = {
      ...rules,
      voteOpen: true,
      vote_open: true,
      activeVoteStageId: makeVoteRoundId(round),
      active_vote_stage_id: makeVoteRoundId(round),
      currentVoteRound: round,
      current_vote_round: round,
      voteStartedTurnCount: turnCount,
      vote_started_turn_count: turnCount,
      voteRounds: upsertVoteRound(rules, voteRound),
      vote_rounds: upsertVoteRound(rules, voteRound)
    };
    message = `Vote round ${round}/${rules.maxVoteRounds} opened.`;
    ruleBoardMessages.push(
      `${message}\nEach character should cast one vote and cite evidence IDs.\nOptions: ${
        rules.voteOptions.length ? rules.voteOptions.join(" / ") : "guilty / not guilty / undecided"
      }`
    );
  } else if (action === "close_vote") {
    if (!rules.voteOpen || rules.currentVoteRound < 1) {
      return NextResponse.json({ error: "No vote round is open." }, { status: 400 });
    }

    const [participants, turns] = await Promise.all([
      prisma.episodeCharacter.findMany({
        where: { episodeId: id },
        orderBy: { createdAt: "asc" },
        include: { character: true }
      }),
      prisma.turn.findMany({
        where: { episodeId: id },
        orderBy: { createdAt: "asc" },
        select: { id: true, speakerCharacterId: true, outputJson: true }
      })
    ]);
    const voteTurns = turns.slice(rules.voteStartedTurnCount ?? 0);
    const votes = collectVotes(
      participants.map((participant) => ({
        characterId: participant.characterId,
        characterName: participant.character.displayName ?? participant.character.name
      })),
      voteTurns
    );
    const voteEvidenceId = makeVoteEvidenceId(rules.currentVoteRound);
    const voteContent = formatVoteEvidenceContent(rules.currentVoteRound, rules.maxVoteRounds, votes);
    const now = new Date().toISOString();
    const voteRound: TrialVoteRound = {
      round: rules.currentVoteRound,
      status: "closed",
      openedAtTurnCount: rules.voteStartedTurnCount ?? 0,
      closedAtTurnCount: turns.length,
      votes,
      evidenceId: voteEvidenceId,
      createdAt: rules.voteRounds.find((round) => round.round === rules.currentVoteRound)?.createdAt ?? null,
      closedAt: now
    };
    const evidence = [
      ...rules.evidence.filter((item) => item.id !== voteEvidenceId),
      {
        id: voteEvidenceId,
        title: `第 ${rules.currentVoteRound} 轮投票结果`,
        content: voteContent,
        discussionPrompt: "这是一轮陪审投票的公开结果，可作为后续讨论的证据引用。"
      }
    ];
    nextRules = withReleasedEvidence(
      {
        ...rules,
        evidence,
        voteOpen: false,
        vote_open: false,
        activeVoteStageId: null,
        active_vote_stage_id: null,
        voteStartedTurnCount: null,
        vote_started_turn_count: null,
        voteRounds: upsertVoteRound(rules, voteRound),
        vote_rounds: upsertVoteRound(rules, voteRound)
      },
      [voteEvidenceId]
    );
    message = `Vote round ${rules.currentVoteRound}/${rules.maxVoteRounds} closed.`;
    ruleBoardMessages.push(message);
    await prisma.sharedBoardItem.create({
      data: {
        episodeId: id,
        type: "vote_result",
        content: voteContent,
        source: `director:vote_round:${rules.currentVoteRound}`,
        confidence: 1,
        tagsJson: toInputJson(["director", "vote", voteEvidenceId])
      }
    });
  } else {
    return NextResponse.json({ error: "Unknown director action." }, { status: 400 });
  }

  await prisma.episode.update({
    where: { id },
    data: {
      rulesJson: toInputJson(nextRules)
    }
  });

  if (syncPublicFacts || syncEvidence) {
    await prisma.$transaction(async (tx) => {
      if (syncPublicFacts) {
        await syncPublicFactsBoardItems(tx, id, episode.publicFactsJson);
      }
      if (syncEvidence) {
        await syncEvidenceBoardItems(tx, id, nextRules);
      }
    });
  }

  await Promise.all(ruleBoardMessages.map((content) => createRuleBoardItem(id, content, [action])));

  return NextResponse.json({ message, rules: nextRules });
}
