import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { memoryUpdateSchema } from "@/lib/schemas/character";

type RouteContext = {
  params: Promise<{ id: string; memoryId: string }>;
};

async function findCharacterMemory(characterId: string, memoryId: string) {
  return prisma.memory.findFirst({
    where: {
      id: memoryId,
      characterId
    }
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id, memoryId } = await context.params;
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = memoryUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existingMemory = await findCharacterMemory(id, memoryId);
  if (!existingMemory) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }

  const memory = await prisma.memory.update({
    where: { id: memoryId },
    data: {
      type: parsed.data.type,
      content: parsed.data.content,
      visibility: parsed.data.visibility,
      importance: parsed.data.importance
    }
  });

  return NextResponse.json({ memory });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id, memoryId } = await context.params;
  const existingMemory = await findCharacterMemory(id, memoryId);

  if (!existingMemory) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }

  await prisma.memory.delete({ where: { id: memoryId } });
  return NextResponse.json({ ok: true });
}
