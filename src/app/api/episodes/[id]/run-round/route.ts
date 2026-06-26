import { NextResponse } from "next/server";
import { EpisodeRunError } from "@/lib/orchestrator/run-next-turn";
import { runRound } from "@/lib/orchestrator/run-round";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const turns = await runRound(id);
    return NextResponse.json({
      turns,
      summary: turns.length
        ? `Generated ${turns.length} turn(s): ${turns
            .map((turn) => `${turn.speaker.displayName ?? turn.speaker.name} - ${turn.speech}`)
            .join("\n")}`
        : "No turns were generated."
    });
  } catch (error) {
    if (error instanceof EpisodeRunError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run round", code: "run_round_failed" },
      { status: 500 }
    );
  }
}
