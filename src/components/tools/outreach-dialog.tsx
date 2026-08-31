import { useState } from 'react';
import { FileSpreadsheet, Loader2, Send, Sparkles } from 'lucide-react';
import { readActiveTabPage } from '@/lib/chrome';
import {
  buildOutreachPrompt,
  type OutreachChannel,
  type OutreachConfig,
  type OutreachTone,
  OUTREACH_CHANNEL_LABELS,
  OUTREACH_TONE_LABELS,
} from '@/lib/outreach';
import { exportToGoogleSheets } from '@/lib/sheets-export';
import { exportToGoogleDocs } from '@/lib/marketing-plan';
import { useChatStore } from '@/store/chat-store';
import { useToastStore } from '@/store/toast-store';
import { useToolsStore } from '@/store/tools-store';
import { ToolDialog } from '@/components/tools/tool-dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export function OutreachDialog() {
  const open = useToolsStore((s) => s.active) === 'outreach';
  const close = useToolsStore((s) => s.close);

  const [config, setConfig] = useState<OutreachConfig>({
    channel: 'all_variations',
    tone: 'value_first',
    yourOffer: 'Digital Marketing, Funnel Optimization & Paid Growth Strategy',
    specificAngle: '',
  });

  const [generating, setGenerating] = useState(false);
  const [exportingSheet, setExportingSheet] = useState(false);
  const [exportingDoc, setExportingDoc] = useState(false);

  const generateOutreach = async () => {
    setGenerating(true);
    const toasts = useToastStore.getState();
    const chat = useChatStore.getState();

    try {
      const page = await readActiveTabPage();
      if (!page.ok || !page.text) {
        toasts.push('error', 'Could not read profile/page', page.error ?? 'Grant access to tab first.');
        return;
      }

      await chat.addContextSlot({
        kind: 'page',
        label: `Prospect: ${page.title ?? 'Profile'}`,
        content: page.text,
        url: page.url,
        addedAt: Date.now(),
      });

      const prompt = buildOutreachPrompt(
        { title: page.title ?? 'Prospect Profile', url: page.url ?? '', text: page.text },
        config,
      );

      await chat.sendText(prompt);
      toasts.push('success', 'Crafting Outreach', 'Generating tailored LinkedIn and cold email pitches.');
      close();
    } catch (err) {
      toasts.push('error', 'Outreach Failed', err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportDoc = async () => {
    const messages = useChatStore.getState().messages;
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last?.content) {
      useToastStore.getState().push('info', 'No Outreach Found', 'Generate pitches first, then export.');
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
      useToastStore.getState().push('info', 'No Outreach Found', 'Generate pitches first, then export.');
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
      title="LinkedIn & Cold Email Outreach Pitcher"
      description="Reads prospect LinkedIn profile or company website and crafts hyper-personalized, high-reply outreach."
    >
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Format / Channels
            <Select
              value={config.channel}
              onChange={(e) => setConfig({ ...config, channel: e.target.value as OutreachChannel })}
            >
              {(Object.keys(OUTREACH_CHANNEL_LABELS) as OutreachChannel[]).map((c) => (
                <option key={c} value={c}>
                  {OUTREACH_CHANNEL_LABELS[c]}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium">
            Outreach Tone
            <Select
              value={config.tone}
              onChange={(e) => setConfig({ ...config, tone: e.target.value as OutreachTone })}
            >
              {(Object.keys(OUTREACH_TONE_LABELS) as OutreachTone[]).map((t) => (
                <option key={t} value={t}>
                  {OUTREACH_TONE_LABELS[t]}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs font-medium">
          Your Service / Offer
          <Input
            value={config.yourOffer}
            onChange={(e) => setConfig({ ...config, yourOffer: e.target.value })}
            placeholder="e.g. Paid Meta Ads Management, CRO Audit, or Copywriting"
            className="text-xs"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium">
          Specific Observation or Hook (Optional)
          <Textarea
            value={config.specificAngle ?? ''}
            onChange={(e) => setConfig({ ...config, specificAngle: e.target.value })}
            placeholder="e.g. Mention their recent funding round or congratulating their new product launch..."
            rows={2}
            className="text-xs"
          />
        </label>

        <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
          <Button
            className="flex-1 gap-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-semibold shadow-md shadow-cyan-500/20"
            onClick={() => void generateOutreach()}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Generate Personalized Pitches
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
