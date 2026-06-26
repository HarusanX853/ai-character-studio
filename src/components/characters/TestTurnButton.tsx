"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { stringifyJson } from "@/lib/utils/json";

type TestTurnButtonProps = {
  characterId: string;
};

export function TestTurnButton({ characterId }: TestTurnButtonProps) {
  const [testOutput, setTestOutput] = useState<string | null>(null);

  async function runTestTurn() {
    setTestOutput("Running...");
    const response = await fetch(`/api/characters/${characterId}/test-turn`, { method: "POST" });
    const result = (await response.json()) as { output?: unknown; error?: string };
    setTestOutput(response.ok ? stringifyJson(result.output) : result.error ?? "Failed to test character");
  }

  return (
    <>
      {testOutput ? <pre className="max-h-80 overflow-auto rounded-md border bg-muted p-3 text-xs">{testOutput}</pre> : null}
      <Button type="button" variant="secondary" onClick={runTestTurn}>
        <Sparkles className="h-4 w-4" />
        Test Turn
      </Button>
    </>
  );
}
