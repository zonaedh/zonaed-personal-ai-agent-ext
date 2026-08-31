import { useState } from 'react';
import { Eye, FileSpreadsheet, Loader2, Sparkles } from 'lucide-react';
import { readActiveTabPage } from '@/lib/chrome';
import {
  buildCompetitorSpyPrompt,
  type CompetitorSpyConfig,
  type SpyFocus,
  SPY_FOCUS_LABELS,
} from '@/lib/competitor-spy';
import { exportToGoogleSheets } from '@/lib/sheets-export';
import { exportToGoogleDocs } from '@/lib/marketing-plan';
import { useChatStore } from '@/store/chat-store';
import { useToastStore } from '@/store/toast-store';
import { useToolsStore } from '@/store/tools-store';
import { ToolDialog } from '@/components/tools/tool-dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export function SpyDialog() {
  const open = useToolsStore((s) => s.active) === 'spy';
  const close = useToolsStore((s) => s.close);

  const [config, setConfig] = useState<CompetitorSpyConfig>({
    focus: 'counter_attack',
    yourBrandOrOffer: 'My Agency / SaaS Product',
    notes: '',
  });

  const [generating, setGenerating] = useState(false);
  const [exportingSheet, setExportingSheet] = useState(false);
  const [exportingDoc, setExportingDoc] = useState(false);

  const generateSpyReport = async () => {
    setGenerating(true);
    const toasts = useToastStore.getState();
    const chat = useChatStore.getState();

    try {
      const page = await readActiveTabPage();
      if (!page.ok || !page.text) {
        toasts.push('error', 'Could not read page', page.error ?? 'Grant access to tab first.');
        return;
      }

      await chat.addContextSlot({
        kind: 'page',
        label: `Competitor: ${page.title ?? 'Page'}`,
        content: page.text,
        url: page.url,
        addedAt: Date.now(),
      });

      const prompt = buildCompetitorSpyPrompt(
        { title: page.title ?? 'Competitor Page', url: page.url ?? '', text: page.text },
        config,
      );

      await chat.sendText(prompt);
      toasts.push('success', 'Spy Analysis Launched', 'Deconstructing competitor offers and drafting counter-strategy.');
      close();
    } catch (err) {
      toasts.push('error', 'Analysis Failed', err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportDoc = async () => {
    const messages = useChatStore.getState().messages;
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last?.content) {
      useToastStore.getState().push('info', 'No Report Found', 'Run analysis first, then export.');
      return;
    }
    setExportingDoc(true);
    try {
      const res = await exportToGoogleDocs(last.content);
      useToastStore
        .getState()
        .push('success', 'Copied to Clipboard!', res.openedNew ? 'Google Doc opened. Press Ctrl+V.' : 'Switched to Google Doc. Press Ctrl+V.');
    } finally {
      setExportingDoc(false);
    }
  };

  const handleExportSheet = async () => {
    const messages = useChatStore.getState().messages;
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last?.content) {
      useToastStore.getState().push('info', 'No Report Found', 'Run analysis first, then export.');
      return;
    }
    setExportingSheet(true);
    try {
      const res = await exportToGoogleSheets(last.content);
      useToastStore
        .getState()
        .push('success', 'TSV Copied!', res.openedNew ? 'Google Sheet opened. Press Ctrl+V.' : 'Switched to Google Sheet. Press Ctrl+V.');
    } finally {
      setExportingSheet(false);
    }
  };

  return (
    <ToolDialog
      open={open}
      onClose={close}
      title="Competitor Ad & Content Spy Analyzer"
      description="Reverse-engineers competitor offers, copy hooks, and psychological angles to formulate counter-attack playbooks."
    >
      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Analysis Focus
          <Select
            value={config.focus}
            onChange={(e) => setConfig({ ...config, focus: e.target.value as SpyFocus })}
          >
            {(Object.keys(SPY_FOCUS_LABELS) as SpyFocus[]).map((f) => (
              <option key={f} value={f}>
                {SPY_FOCUS_LABELS[f]}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium">
          Your Brand / Service (To generate counter-angles)
          <Input
            value={config.yourBrandOrOffer ?? ''}
            onChange={(e) => setConfig({ ...config, yourBrandOrOffer: e.target.value })}
            placeholder="e.g. My Digital Marketing Agency or SaaS solution"
            className="text-xs"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium">
          Specific Angles to Spy On
          <Textarea
            value={config.notes ?? ''}
            onChange={(e) => setConfig({ ...config, notes: e.target.value })}
            placeholder="e.g. Look at their pricing tiers, free trial offer, or main ad headline..."
            rows={2}
            className="text-xs"
          />
        </label>

        <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
          <Button
            className="flex-1 gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-md shadow-purple-500/20"
            onClick={() => void generateSpyReport()}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Analyze Competitor
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExportDoc()}
            disabled={exportingDoc}
            className="text-xs gap-1 border-indigo-500/30 hover:bg-indigo-500/10"
            title="Export latest to Google Docs"
          >
            Doc
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExportSheet()}
            disabled={exportingSheet}
            className="text-xs gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
            title="Export latest to Google Sheets"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Sheet
          </Button>
        </div>
      </div>
    </ToolDialog>
  );
}
