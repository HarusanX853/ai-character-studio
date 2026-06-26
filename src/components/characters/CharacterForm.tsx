import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveCharacter } from "@/lib/actions/character-actions";
import { TestTurnButton } from "./TestTurnButton";

type CharacterFormValues = {
  name: string;
  displayName: string;
  provider: string;
  model: string;
  avatarUrl: string;
  roleArchetype: string;
  personalityJson: string;
  backstory: string;
  publicGoal: string;
  privateGoal: string;
  secretsJson: string;
  speechStyle: string;
  costPolicyJson: string;
};

type CharacterFormProps = {
  characterId?: string;
  initialValues?: Partial<CharacterFormValues> & {
    personalityJson?: string;
    secretsJson?: string;
    costPolicyJson?: string;
  };
  message?: string;
};

function getDefaultValues(initialValues?: CharacterFormProps["initialValues"]): CharacterFormValues {
  return {
    name: initialValues?.name ?? "",
    displayName: initialValues?.displayName ?? "",
    provider: initialValues?.provider ?? "mock-local",
    model: initialValues?.model ?? "mock-roleplay",
    avatarUrl: initialValues?.avatarUrl ?? "",
    roleArchetype: initialValues?.roleArchetype ?? "",
    personalityJson: initialValues?.personalityJson ?? "{\n  \"traits\": []\n}",
    backstory: initialValues?.backstory ?? "",
    publicGoal: initialValues?.publicGoal ?? "",
    privateGoal: initialValues?.privateGoal ?? "",
    secretsJson: initialValues?.secretsJson ?? "[]",
    speechStyle: initialValues?.speechStyle ?? "",
    costPolicyJson: initialValues?.costPolicyJson ?? "{}"
  };
}

export function CharacterForm({ characterId, initialValues, message }: CharacterFormProps) {
  const values = getDefaultValues(initialValues);

  return (
    <form action={saveCharacter} className="space-y-5">
      <input type="hidden" name="characterId" value={characterId ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Name
          <Input name="name" defaultValue={values.name} required />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Display Name
          <Input name="displayName" defaultValue={values.displayName} />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Provider
          <Select name="provider" defaultValue={values.provider}>
            <option value="mock-local">mock-local</option>
            <option value="openai">openai</option>
            <option value="openrouter">openrouter</option>
            <option value="anthropic">anthropic</option>
            <option value="gemini">gemini</option>
            <option value="deepseek">deepseek</option>
            <option value="doubao">doubao</option>
            <option value="xai">xai</option>
          </Select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Model
          <Input name="model" defaultValue={values.model} required />
        </label>
        <label className="space-y-2 text-sm font-medium md:col-span-2">
          Avatar URL
          <Input name="avatarUrl" defaultValue={values.avatarUrl} />
        </label>
        <label className="space-y-2 text-sm font-medium md:col-span-2">
          Role Archetype
          <Input name="roleArchetype" defaultValue={values.roleArchetype} />
        </label>
      </div>
      <label className="space-y-2 text-sm font-medium">
        Personality JSON
        <Textarea name="personalityJson" className="font-mono" defaultValue={values.personalityJson} />
      </label>
      <label className="space-y-2 text-sm font-medium">
        Backstory
        <Textarea name="backstory" defaultValue={values.backstory} required />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          Public Goal
          <Textarea name="publicGoal" defaultValue={values.publicGoal} />
        </label>
        <label className="space-y-2 text-sm font-medium">
          Private Goal
          <Textarea name="privateGoal" defaultValue={values.privateGoal} />
        </label>
      </div>
      <label className="space-y-2 text-sm font-medium">
        Secrets JSON
        <Textarea name="secretsJson" className="font-mono" defaultValue={values.secretsJson} />
      </label>
      <label className="space-y-2 text-sm font-medium">
        Speech Style
        <Input name="speechStyle" defaultValue={values.speechStyle} />
      </label>
      <label className="space-y-2 text-sm font-medium">
        Cost Policy JSON
        <Textarea name="costPolicyJson" className="font-mono" defaultValue={values.costPolicyJson} />
      </label>
      {message ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit">
          <Save className="h-4 w-4" />
          Save Character
        </Button>
        {characterId ? <TestTurnButton characterId={characterId} /> : null}
      </div>
    </form>
  );
}
