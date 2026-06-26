import { EpisodeRunError, getNextTurnPreview, runNextTurn } from "@/lib/orchestrator/run-next-turn";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type StreamEvent =
  | {
      type: "thinking";
      speakerName: string;
      provider: string;
      model: string;
      roundIndex: number;
    }
  | {
      type: "status";
      message: string;
    }
  | {
      type: "chunk";
      text: string;
    }
  | {
      type: "complete";
      summary: string;
      turnId: string;
    }
  | {
      type: "error";
      message: string;
      code: string;
    };

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkText(text: string) {
  const chars = Array.from(text);
  const chunks: string[] = [];

  for (let index = 0; index < chars.length; index += 4) {
    chunks.push(chars.slice(index, index + 4).join(""));
  }

  return chunks;
}

function streamEvent(controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder, event: StreamEvent) {
  controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        try {
          const preview = await getNextTurnPreview(id);

          streamEvent(controller, encoder, {
            type: "thinking",
            speakerName: preview.speakerName,
            provider: preview.provider,
            model: preview.model,
            roundIndex: preview.roundIndex
          });
          streamEvent(controller, encoder, {
            type: "status",
            message: `${preview.speakerName} 正在思考...`
          });

          let settled = false;

          const runPromise = runNextTurn(id)
            .then((result) => ({ result, error: null as unknown }))
            .catch((error: unknown) => {
              return { result: null, error };
            })
            .finally(() => {
              settled = true;
            });

          let elapsedSeconds = 0;
          while (!settled) {
            await Promise.race([runPromise, delay(2500)]);
            if (!settled) {
              elapsedSeconds += 2.5;
              streamEvent(controller, encoder, {
                type: "status",
                message: `${preview.speakerName} 仍在思考... ${Math.round(elapsedSeconds)}s`
              });
            }
          }

          const outcome = await runPromise;
          if (outcome.error) {
            throw outcome.error;
          }

          if (!outcome.result) {
            throw new Error("No turn was generated.");
          }

          const result = outcome.result;
          const speakerName = result.turn.speaker.displayName ?? result.turn.speaker.name;

          streamEvent(controller, encoder, {
            type: "status",
            message: `${speakerName} 正在发言...`
          });

          for (const chunk of chunkText(result.turn.speech)) {
            streamEvent(controller, encoder, { type: "chunk", text: chunk });
            await delay(24);
          }

          streamEvent(controller, encoder, {
            type: "complete",
            turnId: result.turn.id,
            summary: `Round ${result.turn.roundIndex} - ${speakerName}: ${result.turn.speech}`
          });
        } catch (error) {
          streamEvent(controller, encoder, {
            type: "error",
            message: error instanceof Error ? error.message : "Failed to run next turn",
            code: error instanceof EpisodeRunError ? error.code : "run_next_turn_failed"
          });
        } finally {
          controller.close();
        }
      })();
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no"
    }
  });
}
