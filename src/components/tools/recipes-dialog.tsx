import { useEffect, useState } from 'react';
import { Play, Trash2 } from 'lucide-react';
import { deleteRecipe, listRecipes, type StoredRecipe } from '@/db/db';
import { formatDateTime } from '@/lib/util';
import { useToastStore } from '@/store/toast-store';
import { useToolsStore } from '@/store/tools-store';
import { ToolDialog } from '@/components/tools/tool-dialog';
import { PlanPreview } from '@/components/tools/plan-preview';
import { Button } from '@/components/ui/button';

/**
 * Recipes (Phase 4) — saved automation plans, replayable on any page.
 * The plan preview keeps destructive steps behind explicit approval.
 */
export function RecipesDialog() {
  const open = useToolsStore((s) => s.active) === 'recipes';
  const close = useToolsStore((s) => s.close);
  const [recipes, setRecipes] = useState<StoredRecipe[] | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [logs, setLogs] = useState<Record<number, string[]>>({});

  useEffect(() => {
    if (!open) return;
    void listRecipes().then(setRecipes);
  }, [open]);

  return (
    <ToolDialog
      open={open}
      onClose={close}
      wide
      title="Automation recipes"
      description="Saved action plans. Replaying runs on the currently active tab; destructive steps still need your approval."
    >
      <div className="flex flex-col gap-3">
        {recipes === null ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : recipes.length === 0 ? (
          <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            No recipes yet. Generate an automation plan (Tools → Automate) and click
            “Save as recipe”.
          </p>
        ) : (
          recipes.map((r) => (
            <div key={r.id} className="rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.steps.length} steps · saved {formatDateTime(r.updatedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={`Delete ${r.name}`}
                  onClick={() => {
                    if (r.id === undefined) return;
                    void deleteRecipe(r.id).then(() => listRecipes().then(setRecipes));
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              {runningId === r.id ? (
                <div className="mt-2">
                  <PlanPreview
                    steps={r.steps}
                    onLog={(log) => setLogs({ ...logs, [r.id as number]: log })}
                    onRunning={(running) => setRunningId(running ? (r.id as number) : null)}
                  />
                  {logs[r.id as number] ? (
                    <div className="scroll-area mt-2 max-h-32 overflow-y-auto rounded-md border bg-muted/30 p-2 font-mono text-[11px]">
                      {logs[r.id as number]?.map((l, i) => (
                        <p key={i}>{l}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setRunningId(r.id as number)}>
                  <Play className="h-3 w-3" /> Run
                </Button>
              )}
            </div>
          ))
        )}
        {recipes !== null && recipes.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => void listRecipes().then(setRecipes)}
          >
            Refresh
          </Button>
        ) : null}
      </div>
    </ToolDialog>
  );
}