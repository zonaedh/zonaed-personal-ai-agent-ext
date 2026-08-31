import { useState } from 'react';
import { FileCheck, FileSpreadsheet, Loader2, Sparkles } from 'lucide-react';
import { readActiveTabPage } from '@/lib/chrome';
import {
  buildAuditProposalPrompt,
  type AuditFocus,
  type AuditProposalConfig,
  type ProposalTier,
  AUDIT_FOCUS_LABELS,
  PROPOSAL_TIER_LABELS,
} from '@/lib/audit-proposal';
import { exportToGoogleSheets } from '@/lib/sheets-export';
import { exportToGoogleDocs } from '@/lib/marketing-plan';
import { useChatStore } from '@/store/chat-store';
import { useToastStore } from '@/store/toast-store';
import { useToolsStore } from '@/store/tools-store';
import { ToolDialog } from '@/components/tools/tool-dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export function AuditDialog() {
  const open = useToolsStore((s) => s.active) === 'audit';
  const close = useToolsStore((s) => s.close);

  const [config, setConfig] = useState<AuditProposalConfig>({
    focus: 'complete_growth',
    tier: 'growth',
    clientBudget: '$1,000 - $3,000 / month',
    customNotes: '',
  });

  const [generating, setGenerating] = useState(false);
  const [exportingSheet, setExportingSheet] = useState(false);
  const [exportingDoc, setExportingDoc] = useState(false);

  const generateAudit = async () => {
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
        label: `Audit: ${page.title ?? 'Client Site'}`,
        content: page.text,
        url: page.url,
        addedAt: Date.now(),
      });

      const prompt = buildAuditProposalPrompt(
        { title: page.title ?? 'Client Site', url: page.url ?? '', text: page.text },
        config,
      );

      await chat.sendText(prompt);
      toasts.push('success', 'Audit in Progress', 'Analyzing website and formulating growth proposal.');
      close();
    } catch (err) {
      toasts.push('error', 'Audit Failed', err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportDoc = async () => {
    const messages = useChatStore.getState().messages;
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last?.content) {
      useToastStore.getState().push('info', 'No Audit Found', 'Generate an audit first, then export.');
      return;
    }
    setExportingDoc(true);
    try {
      const res = await exportToGoogleDocs(last.content);
      useToastStore
        .getState()
        .push(
          'success',
          'Copied to Clipboard!',
          res.openedNew ? 'Google Doc opened. Press Ctrl+V to paste.' : 'Switched to Google Doc. Press Ctrl+V to paste.',
        );
    } finally {
      setExportingDoc(false);
    }
  };

  const handleExportSheet = async () => {
    const messages = useChatStore.getState().messages;
    const last = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!last?.content) {
      useToastStore.getState().push('info', 'No Audit Found', 'Generate an audit first, then export.');
      return;
    }
    setExportingSheet(true);
    try {
      const res = await exportToGoogleSheets(last.content);
      useToastStore
        .getState()
        .push(
          'success',
          'TSV Copied!',
          res.openedNew ? 'Google Sheet opened. Press Ctrl+V to paste cells.' : 'Switched to Google Sheet. Press Ctrl+V to paste cells.',
        );
    } finally {
      setExportingSheet(false);
    }
  };

  return (
    <ToolDialog
      open={open}
      onClose={close}
      title="1-Click Client Website Audit & Proposal"
      description="Scans active website for messaging friction, conversion leaks, and SEO gaps, then crafts a growth proposal."
    >
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Audit Focus
            <Select
              value={config.focus}
              onChange={(e) => setConfig({ ...config, focus: e.target.value as AuditFocus })}
            >
              {(Object.keys(AUDIT_FOCUS_LABELS) as AuditFocus[]).map((f) => (
                <option key={f} value={f}>
                  {AUDIT_FOCUS_LABELS[f]}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium">
            Proposal Scope Tier
            <Select
              value={config.tier}
              onChange={(e) => setConfig({ ...config, tier: e.target.value as ProposalTier })}
            >
              {(Object.keys(PROPOSAL_TIER_LABELS) as ProposalTier[]).map((t) => (
                <option key={t} value={t}>
                  {PROPOSAL_TIER_LABELS[t]}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs font-medium">
          Target Client Budget / Scale (Optional)
          <Input
            value={config.clientBudget ?? ''}
            onChange={(e) => setConfig({ ...config, clientBudget: e.target.value })}
            placeholder="e.g. $2,000/month or $5,000 project"
            className="text-xs"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium">
          Specific Priorities / Areas of Concern
          <Textarea
            value={config.customNotes ?? ''}
            onChange={(e) => setConfig({ ...config, customNotes: e.target.value })}
            placeholder="e.g. Focus on high bounce rate on pricing page, lack of social proof on hero section..."
            rows={2}
            className="text-xs"
          />
        </label>

        <div className="flex items-center gap-2 pt-2 border-t flex-wrap">
          <Button
            className="flex-1 gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold shadow-md shadow-indigo-500/20"
            onClick={() => void generateAudit()}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
            Generate Audit &amp; Proposal
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
