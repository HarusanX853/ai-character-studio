import { NextResponse } from "next/server";
import { restartLive, RestartLiveError } from "@/lib/orchestrator/restart-live";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const result = await restartLive(id);
    return NextResponse.json({
      result,
      summary: `Live restarted. Cleared ${result.turns} public turn(s), ${result.hostMessages} host message(s), ${result.independentOpinions} independent opinion(s), ${result.memories} generated memory item(s), ${result.sharedBoardItems} runtime board item(s), and ${result.llmCalls} LLM call(s).`
    });
  } catch (error) {
    if (error instanceof RestartLiveError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
    }

    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to restart live", code: "restart_live_failed" },
      { status: 500 }
    );
  }
}
