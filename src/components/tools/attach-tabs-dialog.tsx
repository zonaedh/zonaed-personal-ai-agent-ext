import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ensureOriginsAccess, listOpenTabs, readTabById, tabOrigin } from '@/lib/chrome';
import { useChatStore } from '@/store/chat-store';
import { useToastStore } from '@/store/toast-store';
import { useToolsStore } from '@/store/tools-store';
import { ToolDialog } from '@/components/tools/tool-dialog';
import { Button } from '@/components/ui/button';

interface TabRow {
  id: number;
  title: string;
  url: string;
  origin: string;
  selected: boolean;
}

/**
 * Multi-tab context (Phase 2) — the user explicitly picks tabs; one combined
 * Chrome permission dialog lists exactly the chosen sites; then each tab is
 * read via the on-demand bridge and attached as a context slot.
 */
export function AttachTabsDialog() {
  const open = useToolsStore((s) => s.active) === 'tabs';
  const close = useToolsStore((s) => s.close);
  const addContextSlot = useChatStore((s) => s.addContextSlot);

  const [tabs, setTabs] = useState<TabRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void listOpenTabs().then((ts) =>
      setTabs(
        ts
          .filter((t) => t.id !== undefined)
          .map((t) => ({
            id: t.id as number,
            title: t.title ?? t.url ?? 'Untitled',
            url: t.url ?? '',
            origin: tabOrigin(t) ?? '',
            selected: false,
          })),
      ),
    );
  }, [open]);

  const attach = async () => {
    if (!tabs) return;
    const selected = tabs.filter((t) => t.selected);
    if (selected.length === 0) return;
    setBusy(true);
    try {
      // One combined permission prompt for all selected sites (user gesture).
      const granted = await ensureOriginsAccess(selected.map((t) => t.origin));
      if (!granted) {
        useToastStore.getState().push('info', 'Permission not granted', 'No tabs were attached.');
        return;
      }
      let okCount = 0;
      for (const tab of selected) {
        const page = await readTabById(tab.id);
        if (page.ok) {
          await addContextSlot({
            kind: 'tab',
            label: page.title ?? tab.title,
            content: page.text ?? '',
            url: page.url ?? tab.url,
            addedAt: Date.now(),
          });
          okCount++;
        }
      }
      useToastStore
        .getState()
        .push(okCount > 0 ? 'success' : 'error', okCount > 0 ? `${okCount} tab(s) attached` : 'Could not read the selected tabs');
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolDialog
      open={open}
      onClose={close}
      wide
      title="Attach tabs to this chat"
      description="Pick the tabs to include as context. Chrome will ask permission for the selected sites — granted access only covers reading them here."
    >
      {tabs === null ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="scroll-area mb-3 max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
            {tabs.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-start gap-2 rounded p-1.5 text-sm transition-colors hover:bg-accent/50"
              >
                <input
                  type="checkbox"
                  checked={t.selected}
                  onChange={(e) =>
                    setTabs(tabs.map((x) => (x.id === t.id ? { ...x, selected: e.target.checked } : x)))
                  }
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{t.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.url}</span>
                </span>
              </label>
            ))}
            {tabs.length === 0 ? (
              <p className="p-2 text-center text-xs text-muted-foreground">No readable tabs open.</p>
            ) : null}
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setTabs(tabs.map((t) => ({ ...t, selected: false })))}>
              Clear
            </Button>
            <Button onClick={() => void attach()} disabled={busy || !tabs.some((t) => t.selected)}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Attach selected
            </Button>
          </div>
        </>
      )}
    </ToolDialog>
  );
}