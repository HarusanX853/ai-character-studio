import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { buildCharacterContext } from "./nodes/build-character-context";
import { callCharacterModel } from "./nodes/call-character-model";
import { checkBudget } from "./nodes/check-budget";
import { checkEndCondition } from "./nodes/check-end-condition";
import { loadEpisodeState } from "./nodes/load-episode-state";
import { persistTurn } from "./nodes/persist-turn";
import { selectSpeaker } from "./nodes/select-speaker";
import { updatePrivateMemory } from "./nodes/update-private-memory";
import { updateSharedBoard } from "./nodes/update-shared-board";
import { validateCharacterOutput } from "./nodes/validate-character-output";
import type { EpisodeGraphState } from "./state";

const replace = <T>(defaultValue: () => T) =>
  Annotation<T>({
    reducer: (_left, right) => right,
    default: defaultValue
  });

export const EpisodeGraphAnnotation = Annotation.Root({
  episodeId: replace(() => ""),
  threadId: replace(() => ""),
  episode: replace<EpisodeGraphState["episode"]>(() => null),
  characters: replace<EpisodeGraphState["characters"]>(() => []),
  currentSpeakerId: replace<EpisodeGraphState["currentSpeakerId"]>(() => null),
  roundIndex: replace(() => 1),
  turnCount: replace(() => 0),
  recentTurns: replace<EpisodeGraphState["recentTurns"]>(() => []),
  sharedBoard: replace<EpisodeGraphState["sharedBoard"]>(() => []),
  retrievedMemories: replace<EpisodeGraphState["retrievedMemories"]>(() => []),
  builtContext: replace<EpisodeGraphState["builtContext"]>(() => null),
  characterOutputRaw: replace<EpisodeGraphState["characterOutputRaw"]>(() => null),
  characterOutputParsed: replace<EpisodeGraphState["characterOutputParsed"]>(() => null),
  llmResult: replace<EpisodeGraphState["llmResult"]>(() => null),
  budget: replace<EpisodeGraphState["budget"]>(() => ({
    budgetUsd: 0,
    spentUsd: 0,
    remainingUsd: 0,
    exceeded: false,
    override: false
  })),
  shouldEnd: replace(() => false),
  endReason: replace<EpisodeGraphState["endReason"]>(() => null),
  error: replace<EpisodeGraphState["error"]>(() => null),
  lastTurnId: replace<EpisodeGraphState["lastTurnId"]>(() => null)
});

export function createEpisodeGraph() {
  return new StateGraph(EpisodeGraphAnnotation)
    .addNode("loadEpisodeState", loadEpisodeState)
    .addNode("checkBudget", checkBudget)
    .addNode("selectSpeaker", selectSpeaker)
    .addNode("buildCharacterContext", buildCharacterContext)
    .addNode("callCharacterModel", callCharacterModel)
    .addNode("validateCharacterOutput", validateCharacterOutput)
    .addNode("persistTurn", persistTurn)
    .addNode("updatePrivateMemory", updatePrivateMemory)
    .addNode("updateSharedBoard", updateSharedBoard)
    .addNode("checkEndCondition", checkEndCondition)
    .addEdge(START, "loadEpisodeState")
    .addEdge("loadEpisodeState", "checkBudget")
    .addEdge("checkBudget", "selectSpeaker")
    .addEdge("selectSpeaker", "buildCharacterContext")
    .addEdge("buildCharacterContext", "callCharacterModel")
    .addEdge("callCharacterModel", "validateCharacterOutput")
    .addEdge("validateCharacterOutput", "persistTurn")
    .addEdge("persistTurn", "updatePrivateMemory")
    .addEdge("updatePrivateMemory", "updateSharedBoard")
    .addEdge("updateSharedBoard", "checkEndCondition")
    .addEdge("checkEndCondition", END)
    .compile();
}
