import { useState } from 'react';
import { AlertTriangle, Play } from 'lucide-react';
import { applyActionsInTab, getActiveTab } from '@/lib/chrome';
import { Button } from '@/components/ui/button';
import type { AutomationStep } from '@/shared/types';
import { useToastStore } from '@/store/toast-store';

/**
 * Shared plan preview/runner (Phase 3). Destructive steps are shown with an
 * explicit approval checkbox — Run stays disabled until every one is approved
 * (spec §9: never auto-execute destructive actions).
 */
export function PlanPreview({
  steps,
  onLog,
  onRunning,
}: {
  steps: AutomationStep[];
  onLog: (log: string[]) => void;
  onRunning: (running: boolean) => void;
}) {
  const [approvals, setApprovals] = useState<Record<string, boolean>>({});
  const destructive = steps.filter((s) => s.confirm);

  const run = async (): Promise<void> => {
    onRunning(true);
    try {
      const tab = await getActiveTab();
      if (tab.id === undefined) throw new Error('This tab cannot be scripted.');
      const res = await applyActionsInTab(tab.id, steps, { allowConfirmed: true });
      onLog(['Plan finished.', ...res.log, ...(res.error ? [`ERROR: ${res.error}`] : [])]);
      if (!res.ok) {
        useToastStore.getState().push('error', 'Plan aborted', res.error ?? 'A step failed.');
      } else {
        useToastStore.getState().push('success', 'Plan executed', `${res.log.length} step(s) completed.`);
      }
    } catch (err) {
      useToastStore.getState().push('error', 'Run failed', err instanceof Error ? err.message : String(err));
    } finally {
      onRunning(false);
    }
  };

  const needsApproval = destructive.some((s) => !approvals[s.id]);

  return (
    <div className="flex flex-col gap-2">
      <div className="scroll-area max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
        {steps.map((s, i) => (
          <div key={s.id + String(i)} className="flex items-start gap-2 rounded p-1.5 text-xs hover:bg-accent/40">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {s.label} <span className="font-mono text-[10px] text-muted-foreground">[{s.kind}]</span>
              </p>
              {s.selector ? (
                <p className="truncate font-mono text-[10px] text-muted-foreground">{s.selector}</p>
              ) : null}
              {s.text ? <p className="truncate text-[10px] text-muted-foreground">“{s.text}”</p> : null}
              {s.confirm ? (
                <label className="mt-1 flex cursor-pointer items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-1 text-[11px] text-amber-600 dark:text-amber-400">
                  <input
                    type="checkbox"
                    checked={approvals[s.id] === true}
                    onChange={(e) => setApprovals({ ...approvals, [s.id]: e.target.checked })}
                  />
                  <AlertTriangle className="h-3 w-3" />
                  Destructive — I approve this step
                </label>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <Button
        onClick={() => void run()}
        disabled={needsApproval}
        title={needsApproval ? 'Approve every destructive step first' : 'Run the plan in the current tab'}
      >
        <Play className="h-4 w-4" /> Run plan
        {destructive.length > 0 ? ` (${destructive.length} need approval)` : ''}
      </Button>
    </div>
  );
}