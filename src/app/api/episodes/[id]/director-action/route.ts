import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  normalizeTrialRules,
  type TrialRules,
  type TrialVoteRound
} from "@/lib/jury/trial-state";
import { collectVotes, formatVoteEvidenceContent } from "@/lib/jury/voting";
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

function withAllEvidenceVisible(rules: TrialRules) {
  const evidenceIds = rules.evidence.map((evidence) => evidence.id);
  return {
    ...rules,
    allEvidenceVisible: true,
    all_evidence_visible: true,
    releasedEvidenceIds: evidenceIds,
    released_evidence_ids: evidenceIds
  };
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
  let nextRules: TrialRules | Record<string, unknown> = withAllEvidenceVisible(rules);
  let message = "Director action complete.";
  const ruleBoardMessages: string[] = [];

  if (action === "release_evidence" || action === "release_stage_evidence") {
    message = "All evidence is visible from the beginning. No release action is needed.";
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
      ...withAllEvidenceVisible(rules),
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
    const evidenceIds = evidence.map((item) => item.id);

    nextRules = {
      ...withAllEvidenceVisible(rules),
      evidence,
      releasedEvidenceIds: evidenceIds,
      released_evidence_ids: evidenceIds,
      voteOpen: false,
      vote_open: false,
      activeVoteStageId: null,
      active_vote_stage_id: null,
      voteStartedTurnCount: null,
      vote_started_turn_count: null,
      voteRounds: upsertVoteRound(rules, voteRound),
      vote_rounds: upsertVoteRound(rules, voteRound)
    };
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

  await Promise.all(ruleBoardMessages.map((content) => createRuleBoardItem(id, content, [action])));

  return NextResponse.json({ message, rules: nextRules });
}
