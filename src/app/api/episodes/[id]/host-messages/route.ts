import { NextResponse } from "next/server";
import { addHostMessage, JuryControlError } from "@/lib/orchestrator/jury-control";
import { hostMessageSchema } from "@/lib/schemas/jury-control";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = hostMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid host message.", code: "invalid_host_message" }, { status: 400 });
  }

  try {
    const hostMessage = await addHostMessage(id, parsed.data);
    return NextResponse.json({
      hostMessage,
      summary: "主持人消息已公开。"
    });
  } catch (error) {
    if (error instanceof JuryControlError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add host message", code: "host_message_failed" },
      { status: 500 }
    );
  }
}
