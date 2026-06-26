import { NextResponse } from "next/server";
import { summarizeEpisode } from "@/lib/graph/nodes/summarize-episode";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const summary = await summarizeEpisode(id);
  return NextResponse.json({ summary });
}
