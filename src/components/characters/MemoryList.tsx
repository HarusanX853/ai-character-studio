import Link from "next/link";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import {
  createCharacterMemory,
  deleteCharacterMemory,
  updateCharacterMemory
} from "@/lib/actions/memory-actions";
import { cn } from "@/lib/utils/cn";

type Memory = {
  id: string;
  type: string;
  content: string;
  visibility: string;
  importance: number;
  createdAt: string;
};

type MemoryListProps = {
  characterId: string;
  memories: Memory[];
  editingMemoryId?: string;
};

const memoryTypes = ["persona", "episode", "relationship", "secret", "reflection"];
const visibilityOptions = ["private", "public"];

const buttonBase =
  "inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium transition disabled:pointer-events-none disabled:opacity-50";
const buttonVariants = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground"
};
const inputClass =
  "h-10 w-full rounded-md border bg-card px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring";
const selectClass = "h-10 w-full rounded-md border bg-card px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring";
const textareaClass =
  "min-h-28 w-full resize-y rounded-md border bg-card px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring";

function MemoryTypeOptions() {
  return memoryTypes.map((memoryType) => (
    <option key={memoryType} value={memoryType}>
      {memoryType}
    </option>
  ));
}

function VisibilityOptions() {
  return visibilityOptions.map((visibility) => (
    <option key={visibility} value={visibility}>
      {visibility}
    </option>
  ));
}

export function MemoryList({ characterId, memories, editingMemoryId }: MemoryListProps) {
  const characterPath = `/characters/${characterId}`;

  return (
    <div id="memories" className="space-y-4">
      <form action={createCharacterMemory} className="grid gap-3 md:grid-cols-[180px_1fr_120px_auto]">
        <input type="hidden" name="characterId" value={characterId} />
        <input type="hidden" name="visibility" value="private" />
        <select name="type" defaultValue="episode" className={selectClass}>
          <MemoryTypeOptions />
        </select>
        <textarea name="content" required placeholder="Add a private memory" className={textareaClass} />
        <input name="importance" type="number" step="0.1" min="0" max="1" defaultValue={0.5} className={inputClass} />
        <button type="submit" className={cn(buttonBase, buttonVariants.primary, "h-10 text-sm")}>
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>
      <div className="space-y-2">
        {memories.map((memory) => (
          <div key={memory.id} className="rounded-md border bg-card p-3">
            {editingMemoryId === memory.id ? (
              <form action={updateCharacterMemory} className="space-y-3">
                <input type="hidden" name="characterId" value={characterId} />
                <input type="hidden" name="memoryId" value={memory.id} />
                <div className="grid gap-3 md:grid-cols-[180px_140px_120px]">
                  <select name="type" defaultValue={memory.type} className={selectClass}>
                    <MemoryTypeOptions />
                  </select>
                  <select name="visibility" defaultValue={memory.visibility} className={selectClass}>
                    <VisibilityOptions />
                  </select>
                  <input
                    name="importance"
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    defaultValue={memory.importance}
                    className={inputClass}
                  />
                </div>
                <textarea name="content" required defaultValue={memory.content} className={textareaClass} />
                <div className="flex gap-2">
                  <button type="submit" className={cn(buttonBase, buttonVariants.primary)}>
                    <Save className="h-4 w-4" />
                    Save
                  </button>
                  <Link href={`${characterPath}#memories`} className={cn(buttonBase, buttonVariants.ghost)}>
                    <X className="h-4 w-4" />
                    Cancel
                  </Link>
                </div>
              </form>
            ) : (
              <>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{memory.type}</span>
                    <span>{memory.visibility}</span>
                    <span>importance {memory.importance.toFixed(2)}</span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`${characterPath}?editMemory=${memory.id}#memories`}
                      className={cn(buttonBase, buttonVariants.ghost)}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Link>
                    <form action={deleteCharacterMemory}>
                      <input type="hidden" name="characterId" value={characterId} />
                      <input type="hidden" name="memoryId" value={memory.id} />
                      <button type="submit" className={cn(buttonBase, buttonVariants.danger)}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
                <p className="text-sm">{memory.content}</p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
