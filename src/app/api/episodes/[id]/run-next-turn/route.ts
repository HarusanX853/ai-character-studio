import { NextResponse } from "next/server";
import { EpisodeRunError, runNextTurn } from "@/lib/orchestrator/run-next-turn";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getSpeakerName(turn: Awaited<ReturnType<typeof runNextTurn>>["turn"]) {
  return turn.speaker.displayName ?? turn.speaker.name;
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const result = await runNextTurn(id);
    const speakerName = getSpeakerName(result.turn);
    return NextResponse.json({
      turn: result.turn,
      state: result.state,
      summary: `Round ${result.turn.roundIndex} - ${speakerName}: ${result.turn.speech}`
    });
  } catch (error) {
    if (error instanceof EpisodeRunError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to run next turn",
        code: "run_next_turn_failed"
      },
      { status: 500 }
    );
  }
}
