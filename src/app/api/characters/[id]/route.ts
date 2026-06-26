import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { characterSchema } from "@/lib/schemas/character";
import { toInputJson } from "@/lib/utils/json";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const character = await prisma.character.findUnique({
    where: { id },
    include: {
      memories: { orderBy: { createdAt: "desc" }, take: 20 }
    }
  });

  if (!character) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  return NextResponse.json({ character });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = characterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const character = await prisma.character.update({
    where: { id },
    data: {
      name: input.name,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      provider: input.provider,
      model: input.model,
      roleArchetype: input.roleArchetype,
      personalityJson: toInputJson(input.personalityJson),
      backstory: input.backstory,
      publicGoal: input.publicGoal,
      privateGoal: input.privateGoal,
      secretsJson: input.secretsJson === undefined ? undefined : toInputJson(input.secretsJson),
      speechStyle: input.speechStyle,
      costPolicyJson: input.costPolicyJson === undefined ? undefined : toInputJson(input.costPolicyJson)
    }
  });

  return NextResponse.json({ character });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  await prisma.character.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
