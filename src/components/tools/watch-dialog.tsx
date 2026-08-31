import { useEffect, useState } from 'react';
import { BellRing, Trash2 } from 'lucide-react';
import { getActiveTab } from '@/lib/chrome';
import { addWatchTask, listWatchTasks, removeWatchTask } from '@/lib/watch';
import { formatDateTime } from '@/lib/util';
import type { WatchTask } from '@/shared/types';
import { useToastStore } from '@/store/toast-store';
import { useToolsStore } from '@/store/tools-store';
import { ToolDialog } from '@/components/tools/tool-dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

/**
 * Scheduled page watch (Phase 4): re-check a page on a schedule and get a
 * notification when its content changes. Checks only run while the page is
 * open and you have granted that site access.
 */
export function WatchDialog() {
  const open = useToolsStore((s) => s.active) === 'watch';
  const close = useToolsStore((s) => s.close);
  const [tasks, setTasks] = useState<WatchTask[] | null>(null);
  const [hours, setHours] = useState('24');
  const [busy, setBusy] = useState(false);

  const refresh = (): void => {
    void listWatchTasks().then(setTasks);
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const watchCurrent = async () => {
    setBusy(true);
    try {
      const tab = await getActiveTab();
      if (!tab.url) throw new Error('This tab has no URL.');
      await addWatchTask(tab.url, tab.title ?? tab.url, Number(hours));
      refresh();
      useToastStore.getState().push('success', 'Watching page', `Checked every ${hours}h while the tab is open.`);
    } catch (err) {
      useToastStore.getState().push('error', 'Could not watch page', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolDialog
      open={open}
      onClose={close}
      title="Watch pages for changes"
      description="Get notified when a watched page changes. Checks run locally via chrome.alarms."
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Select value={hours} onChange={(e) => setHours(e.target.value)} className="w-28">
            {['1', '6', '12', '24', '72', '168'].map((h) => (
              <option key={h} value={h}>
                every {h}h
              </option>
            ))}
          </Select>
          <Button className="flex-1" onClick={() => void watchCurrent()} disabled={busy}>
            <BellRing className="h-4 w-4" /> Watch current page
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {tasks === null ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              No watched pages yet.
            </p>
          ) : (
            tasks.map((t) => (
              <div key={t.id} className="flex items-start gap-2 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    every {t.intervalHours}h
                    {t.lastCheckedAt ? ` · last check ${formatDateTime(t.lastCheckedAt)}` : ' · not checked yet'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label={`Stop watching ${t.label}`}
                  onClick={() => void removeWatchTask(t.id).then(refresh)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Note: grant the site access once (Tools → Attach tabs) so scheduled checks
          can read it while the tab is open.
        </p>
      </div>
    </ToolDialog>
  );
}