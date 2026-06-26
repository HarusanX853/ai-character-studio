import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { memoryCreateSchema } from "@/lib/schemas/character";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = memoryCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const memory = await prisma.memory.create({
    data: {
      characterId: id,
      episodeId: parsed.data.episodeId,
      type: parsed.data.type,
      content: parsed.data.content,
      visibility: parsed.data.visibility,
      importance: parsed.data.importance
    }
  });

  return NextResponse.json({ memory }, { status: 201 });
}
