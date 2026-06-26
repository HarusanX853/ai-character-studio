import type { EpisodeGraphState } from "../state";

export async function interruptForDirector(_state: EpisodeGraphState): Promise<Partial<EpisodeGraphState>> {
  return {};
}
