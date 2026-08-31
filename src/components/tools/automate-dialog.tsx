import { useState } from 'react';
import { Save } from 'lucide-react';
import { readActiveTabPage } from '@/lib/chrome';
import { generatePlan } from '@/lib/automation';
import { saveRecipe } from '@/db/db';
import type { AutomationStep } from '@/shared/types';
import { useOllamaStore } from '@/store/ollama-store';
import { useSettingsStore } from '@/store/settings-store';
import { useToastStore } from '@/store/toast-store';
import { useToolsStore } from '@/store/tools-store';
import { ToolDialog } from '@/components/tools/tool-dialog';
import { PlanPreview } from '@/components/tools/plan-preview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Automation (Phase 3) — the AI proposes an action PLAN, the user previews it,
 * and destructive steps stay gated behind explicit approval checkboxes.
 */
export function AutomateDialog() {
  const open = useToolsStore((s) => s.active) === 'automate';
  const close = useToolsStore((s) => s.close);

  const [goal, setGoal] = useState('');
  const [steps, setSteps] = useState<AutomationStep[] | null>(null);
  const [log, setLog] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);

  const generate = async () => {
    const ollama = useOllamaStore.getState();
    const settings = useSettingsStore.getState();
    const model = await ollama.ensureModel();
    if (!model) {
      useToastStore.getState().push('error', 'No model available', 'Start Ollama and pull a model first.');
      return;
    }
    setBusy(true);
    try {
      const page = await readActiveTabPage();
      setSteps(
        await generatePlan({
          baseUrl: settings.ollamaBaseUrl,
          model,
          goal,
          pageText: page.ok
            ? `Title: ${page.title ?? ''}\nURL: ${page.url ?? ''}\n\n${page.text ?? ''}`
            : '(page could not be read)',
        }),
      );
      setLog(null);
    } catch (err) {
      useToastStore.getState().push('error', 'Plan generation failed', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolDialog
      open={open}
      onClose={close}
      wide
      title="Automate this page"
      description="Describe the goal — the AI proposes an action plan that YOU review before it runs. Destructive steps always require your explicit approval."
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy && goal.trim()) void generate();
            }}
            placeholder="e.g. Search for 'local ai' and open the first result"
          />
          <Button onClick={() => void generate()} disabled={busy || !goal.trim()}>
            {busy ? 'Planning…' : 'Generate plan'}
          </Button>
        </div>

        {steps ? <PlanPreview steps={steps} onLog={setLog} onRunning={setRunning} /> : null}

        {log ? (
          <div className="scroll-area max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-2 font-mono text-[11px]">
            {log.map((l, i) => (
              <p key={i} className="py-0.5">
                {l}
              </p>
            ))}
          </div>
        ) : null}

        {steps && !running ? (
          <Button
            variant="outline"
            className="self-start"
            onClick={() =>
              void saveRecipe({
                name: goal.trim().slice(0, 60) || 'Automation recipe',
                steps,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              }).then(() => useToastStore.getState().push('success', 'Saved as recipe', 'Find it under Tools → Recipes.'))
            }
          >
            <Save className="h-4 w-4" /> Save as recipe
          </Button>
        ) : null}
      </div>
    </ToolDialog>
  );
}