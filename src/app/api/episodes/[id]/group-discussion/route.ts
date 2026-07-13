import { NextResponse } from "next/server";
import { z } from "zod";
import { JuryControlError, runGroupDiscussion } from "@/lib/orchestrator/jury-control";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const groupDiscussionSchema = z.object({
  characterId: z.string().min(1)
});

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = groupDiscussionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Select one AI before starting group discussion.", code: "missing_character" }, { status: 400 });
  }

  try {
    const turn = await runGroupDiscussion(id, parsed.data.characterId);
    const speakerName = turn.speaker.displayName ?? turn.speaker.name;
    return NextResponse.json({
      turn,
      summary: `${speakerName} 已公开发言：${turn.speech}`
    });
  } catch (error) {
    if (error instanceof JuryControlError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run group discussion", code: "group_discussion_failed" },
      { status: 500 }
    );
  }
}
