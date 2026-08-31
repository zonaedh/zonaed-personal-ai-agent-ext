import { useState } from 'react';
import { Download, Save } from 'lucide-react';
import { getActiveTab, scrapeTab } from '@/lib/chrome';
import { toCsv, downloadText } from '@/lib/util';
import { saveScrape } from '@/db/db';
import type { ScrapeResult } from '@/shared/types';
import { useToastStore } from '@/store/toast-store';
import { useToolsStore } from '@/store/tools-store';
import { ToolDialog } from '@/components/tools/tool-dialog';
import { Button } from '@/components/ui/button';

type View = 'links' | 'emails' | 'products' | 'tables';

/**
 * Structured scraping (Phase 3): links / emails / tables / product listings →
 * preview, export as CSV or JSON, save to Dexie.
 */
export function ScrapeDialog() {
  const open = useToolsStore((s) => s.active) === 'scrape';
  const close = useToolsStore((s) => s.close);

  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [view, setView] = useState<View>('links');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const tab = await getActiveTab();
      if (tab.id === undefined) throw new Error('This tab cannot be scripted.');
      const r = await scrapeTab(tab.id);
      setResult(r);
      useToastStore.getState().push(
        'success',
        'Page scraped',
        `${r.links.length} links · ${r.emails.length} emails · ${r.tables.length} tables · ${r.products.length} products`,
      );
    } catch (err) {
      useToastStore.getState().push('error', 'Scrape failed', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const count = (v: View): number =>
    !result ? 0
    : v === 'links' ? result.links.length
    : v === 'emails' ? result.emails.length
    : v === 'products' ? result.products.length
    : result.tables.length;

  const exportCsv = (): void => {
    if (!result) return;
    const rows: Record<string, unknown>[] =
      view === 'links'
        ? result.links.map((l) => ({ text: l.text, url: l.href }))
        : view === 'emails'
          ? result.emails.map((e) => ({ email: e }))
          : view === 'products'
            ? result.products.map((p) => ({ title: p.title, price: p.price ?? '', url: p.link ?? '' }))
            : result.tables.flatMap((t, i) =>
                t.rows.map((row, ri) => ({ table: i + 1, row: ri + 1, cells: row.join(' | ') })),
              );
    downloadText(`scrape-${view}.csv`, 'text/csv', toCsv(rows));
  };

  return (
    <ToolDialog
      open={open}
      onClose={close}
      wide
      title="Scrape page data"
      description="Extract links, emails, tables and product listings from the current tab as clean structured data."
    >
      <div className="flex flex-col gap-3">
        <Button onClick={() => void run()} disabled={busy}>
          {busy ? 'Scraping…' : 'Scrape current tab'}
        </Button>

        {result ? (
          <>
            <div className="flex gap-1">
              {(['links', 'emails', 'products', 'tables'] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-md px-2 py-1 text-xs capitalize transition-colors ${
                    view === v
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50'
                  }`}
                >
                  {v} ({count(v)})
                </button>
              ))}
            </div>
            <ScrapePreview result={result} view={view} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={exportCsv}>
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => downloadText('scrape.json', 'application/json', JSON.stringify(result, null, 2))}
              >
                <Download className="h-4 w-4" /> JSON
              </Button>
              <Button
                className="flex-1"
                onClick={() =>
                  void saveScrape({
                    url: result.url,
                    title: result.title,
                    kind: 'structured',
                    data: result,
                    createdAt: Date.now(),
                  }).then(() => useToastStore.getState().push('success', 'Saved to history'))
                }
              >
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </ToolDialog>
  );
}

function ScrapePreview({ result, view }: { result: ScrapeResult; view: View }) {
  return (
    <div className="scroll-area max-h-64 overflow-y-auto rounded-md border p-2 text-xs">
      {view === 'links' &&
        result.links.slice(0, 100).map((l, i) => (
          <p key={i} className="truncate py-0.5">
            <span className="font-medium">{l.text}</span> <span className="text-muted-foreground">— {l.href}</span>
          </p>
        ))}
      {view === 'emails' &&
        result.emails.map((e) => (
          <p key={e} className="py-0.5 font-mono">
            {e}
          </p>
        ))}
      {view === 'products' &&
        result.products.slice(0, 100).map((p, i) => (
          <p key={i} className="truncate py-0.5">
            <span className="font-medium">{p.title}</span>
            {p.price ? <span className="text-emerald-600 dark:text-emerald-400"> — {p.price}</span> : null}
          </p>
        ))}
      {view === 'tables' &&
        result.tables.map((t, i) => (
          <div key={i} className="mb-2">
            <p className="font-medium text-muted-foreground">
              Table {i + 1} ({t.rows.length} rows)
            </p>
            {t.rows.slice(0, 4).map((row, ri) => (
              <p key={ri} className="truncate py-0.5">
                {row.join(' | ')}
              </p>
            ))}
          </div>
        ))}
      {countFor(result, view) === 0 ? (
        <p className="p-2 text-center text-muted-foreground">Nothing found in this category.</p>
      ) : null}
    </div>
  );
}

function countFor(result: ScrapeResult, view: View): number {
  return view === 'links'
    ? result.links.length
    : view === 'emails'
      ? result.emails.length
      : view === 'products'
        ? result.products.length
        : result.tables.length;
}