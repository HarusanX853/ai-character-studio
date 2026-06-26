import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { characterSchema } from "@/lib/schemas/character";
import { toInputJson } from "@/lib/utils/json";

export async function GET() {
  const characters = await prisma.character.findMany({
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({ characters });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = characterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const character = await prisma.character.create({
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

  return NextResponse.json({ character }, { status: 201 });
}
