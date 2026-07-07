import { NextResponse } from "next/server";
import { JuryControlError, runIndependentOpinions } from "@/lib/orchestrator/jury-control";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const opinions = await runIndependentOpinions(id);
    return NextResponse.json({
      opinions,
      summary: `已生成 ${opinions.length} 条独立意见；这些内容只在主持人界面展示。`
    });
  } catch (error) {
    if (error instanceof JuryControlError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run independent opinions", code: "independent_opinions_failed" },
      { status: 500 }
    );
  }
}
