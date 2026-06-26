"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { memoryCreateSchema, memoryUpdateSchema } from "@/lib/schemas/character";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function readOptionalString(formData: FormData, key: string) {
  const value = readString(formData, key).trim();
  return value ? value : undefined;
}

function readImportance(formData: FormData) {
  const value = Number(readString(formData, "importance"));
  return Number.isFinite(value) ? value : 0.5;
}

function redirectToCharacter(characterId: string): never {
  const path = `/characters/${characterId}`;
  revalidatePath(path);
  redirect(`${path}#memories`);
}

export async function createCharacterMemory(formData: FormData) {
  const characterId = readString(formData, "characterId");
  const parsed = memoryCreateSchema.safeParse({
    type: readString(formData, "type"),
    content: readString(formData, "content"),
    visibility: readString(formData, "visibility"),
    importance: readImportance(formData),
    episodeId: readOptionalString(formData, "episodeId")
  });

  if (!characterId || !parsed.success) {
    redirectToCharacter(characterId);
  }

  await prisma.memory.create({
    data: {
      characterId,
      episodeId: parsed.data.episodeId,
      type: parsed.data.type,
      content: parsed.data.content,
      visibility: parsed.data.visibility,
      importance: parsed.data.importance
    }
  });

  redirectToCharacter(characterId);
}

export async function updateCharacterMemory(formData: FormData) {
  const characterId = readString(formData, "characterId");
  const memoryId = readString(formData, "memoryId");
  const parsed = memoryUpdateSchema.safeParse({
    type: readString(formData, "type"),
    content: readString(formData, "content"),
    visibility: readString(formData, "visibility"),
    importance: readImportance(formData)
  });

  if (!characterId || !memoryId || !parsed.success) {
    redirectToCharacter(characterId);
  }

  await prisma.memory.updateMany({
    where: {
      id: memoryId,
      characterId
    },
    data: {
      type: parsed.data.type,
      content: parsed.data.content,
      visibility: parsed.data.visibility,
      importance: parsed.data.importance
    }
  });

  redirectToCharacter(characterId);
}

export async function deleteCharacterMemory(formData: FormData) {
  const characterId = readString(formData, "characterId");
  const memoryId = readString(formData, "memoryId");

  if (characterId && memoryId) {
    await prisma.memory.deleteMany({
      where: {
        id: memoryId,
        characterId
      }
    });
  }

  redirectToCharacter(characterId);
}
