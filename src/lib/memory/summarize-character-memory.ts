import { retrieveCharacterMemories } from "./retrieve-character-memories";

export async function summarizeCharacterMemory(characterId: string, episodeId?: string) {
  const memories = await retrieveCharacterMemories(characterId, episodeId, 5);
  return memories.map((memory) => `- ${memory.content}`).join("\n") || "No recent private memories.";
}
