"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { episodeFormats } from "@/lib/schemas/episode";
import { safeJsonParse } from "@/lib/utils/safe-parse";

type EpisodeFormValues = {
  title: string;
  format: string;
  setting: string;
  publicFactsJson: string;
  hiddenFactsJson: string;
  rulesJson: string;
  budgetUsd: number;
  maxRounds: number;
  status: string;
};

type EpisodeFormProps = {
  episodeId?: string;
  initialValues?: Partial<EpisodeFormValues>;
};

function parseJsonField(label: string, value: string, fallback: unknown) {
  if (!value.trim()) {
    return fallback;
  }

  const parsed = safeJsonParse(value);
  if (!parsed.ok) {
    throw new Error(`${label}: ${parsed.error}`);
  }

  return parsed.data;
}

function getDefaultValues(initialValues?: EpisodeFormProps["initialValues"]): EpisodeFormValues {
  return {
    title: initialValues?.title ?? "",
    format: initialValues?.format ?? "jury_deliberation",
    setting: initialValues?.setting ?? "",
    publicFactsJson: initialValues?.publicFactsJson ?? "[]",
    hiddenFactsJson: initialValues?.hiddenFactsJson ?? "[]",
    rulesJson:
      initialValues?.rulesJson ??
      "{\n  \"mode\": \"jury_trial\",\n  \"caseFactsReleased\": false,\n  \"allEvidenceVisible\": false,\n  \"releasedEvidenceIds\": [],\n  \"maxVoteRounds\": 5,\n  \"currentVoteRound\": 0,\n  \"voteOptions\": [\"guilty\", \"not_guilty\", \"undecided\"],\n  \"voteOpen\": false,\n  \"voteRounds\": [],\n  \"evidence\": [],\n  \"turnOrder\": \"round_robin\",\n  \"allowPrivateThought\": true,\n  \"endCondition\": \"max_rounds_or_budget\"\n}",
    budgetUsd: initialValues?.budgetUsd ?? 3,
    maxRounds: initialValues?.maxRounds ?? 12,
    status: initialValues?.status ?? "draft"
  };
}

export function EpisodeForm({ episodeId, initialValues }: EpisodeFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [values, setValues] = useState<EpisodeFormValues>(() => getDefaultValues(initialValues));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setValues(getDefaultValues(initialValues));
  }, [initialValues]);

  function updateValue(field: keyof EpisodeFormValues, value: string | number) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!values.title.trim() || !values.setting.trim()) {
      setMessage("Please fill in the required fields before saving.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...values,
        budgetUsd: Number(values.budgetUsd),
        maxRounds: Number(values.maxRounds),
        publicFactsJson: parseJsonField("publicFactsJson", values.publicFactsJson, []),
        hiddenFactsJson: parseJsonField("hiddenFactsJson", values.hiddenFactsJson, []),
        rulesJson: parseJsonField("rulesJson", values.rulesJson, {})
      };

      const response = await fetch(episodeId ? `/api/episodes/${episodeId}` : "/api/episodes", {
        method: episodeId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = (await response.json()) as { episode?: { id: string }; error?: unknown };
      if (!response.ok || !result.episode) {
        throw new Error(typeof result.error === "string" ? result.error : "Failed to save episode");
      }

      router.push(`/episodes/${result.episode.id}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save episode");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Title
          <Input value={values.title} onChange={(event) => updateValue("title", event.target.value)} required />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Format
          <Select value={values.format} onChange={(event) => updateValue("format", event.target.value)}>
            {episodeFormats.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Budget USD
          <Input
            type="number"
            step="0.1"
            min="0"
            value={values.budgetUsd}
            onChange={(event) => updateValue("budgetUsd", Number(event.target.value))}
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Max Rounds
          <Input
            type="number"
            min="1"
            value={values.maxRounds}
            onChange={(event) => updateValue("maxRounds", Number(event.target.value))}
          />
        </label>
        <label className="space-y-2 text-sm font-medium md:col-span-2">
          Status
          <Select value={values.status} onChange={(event) => updateValue("status", event.target.value)}>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="ended">ended</option>
          </Select>
        </label>
      </div>
      <label className="space-y-2 text-sm font-medium">
        Setting
        <Textarea value={values.setting} onChange={(event) => updateValue("setting", event.target.value)} required />
      </label>
      <label className="space-y-2 text-sm font-medium">
        Public Facts JSON
        <Textarea
          className="font-mono"
          value={values.publicFactsJson}
          onChange={(event) => updateValue("publicFactsJson", event.target.value)}
        />
      </label>
      <label className="space-y-2 text-sm font-medium">
        Hidden Facts JSON
        <Textarea
          className="font-mono"
          value={values.hiddenFactsJson}
          onChange={(event) => updateValue("hiddenFactsJson", event.target.value)}
        />
      </label>
      <label className="space-y-2 text-sm font-medium">
        Rules JSON
        <Textarea
          className="font-mono"
          value={values.rulesJson}
          onChange={(event) => updateValue("rulesJson", event.target.value)}
        />
      </label>
      {message ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{message}</p> : null}
      <Button type="submit" disabled={isSubmitting}>
        <Save className="h-4 w-4" />
        Save Episode
      </Button>
    </form>
  );
}
