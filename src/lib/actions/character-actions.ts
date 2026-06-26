"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { characterSchema } from "@/lib/schemas/character";
import { toInputJson } from "@/lib/utils/json";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fail(path: string, message: string): never {
  redirect(`${path}?formError=${encodeURIComponent(message)}`);
}

function parseJsonField(label: string, value: string, fallback: unknown, failPath: string) {
  if (!value.trim()) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    fail(failPath, `${label} is not valid JSON.`);
  }
}

export async function saveCharacter(formData: FormData) {
  const characterId = readString(formData, "characterId");
  const failPath = characterId ? `/characters/${characterId}` : "/characters/new";
  const payload = {
    name: readString(formData, "name"),
    displayName: readString(formData, "displayName"),
    provider: readString(formData, "provider"),
    model: readString(formData, "model"),
    avatarUrl: readString(formData, "avatarUrl"),
    roleArchetype: readString(formData, "roleArchetype"),
    personalityJson: parseJsonField("Personality JSON", readString(formData, "personalityJson"), {}, failPath),
    backstory: readString(formData, "backstory"),
    publicGoal: readString(formData, "publicGoal"),
    privateGoal: readString(formData, "privateGoal"),
    secretsJson: parseJsonField("Secrets JSON", readString(formData, "secretsJson"), undefined, failPath),
    speechStyle: readString(formData, "speechStyle"),
    costPolicyJson: parseJsonField("Cost Policy JSON", readString(formData, "costPolicyJson"), undefined, failPath)
  };
  const parsed = characterSchema.safeParse(payload);

  if (!parsed.success) {
    fail(failPath, "Please fill in the required fields before saving.");
  }

  const input = parsed.data;
  const character = characterId
    ? await prisma.character.update({
        where: { id: characterId },
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
      })
    : await prisma.character.create({
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

  revalidatePath("/characters");
  revalidatePath(`/characters/${character.id}`);
  redirect(`/characters/${character.id}`);
}
