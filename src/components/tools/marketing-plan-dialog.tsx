import { useState } from 'react';
import { FileText, Loader2, Sparkles, TrendingUp, ExternalLink, Check } from 'lucide-react';
import {
  buildMarketingPlanPrompt,
  exportToGoogleDocs,
  researchWebsite,
  type MarketingBudget,
  type MarketingFocus,
  type MarketingGoal,
  type MarketingPlanConfig,
  BUDGET_LABELS,
  FOCUS_LABELS,
  GOAL_LABELS,
} from '@/lib/marketing-plan';
import { useChatStore } from '@/store/chat-store';
import { useToastStore } from '@/store/toast-store';
import { useToolsStore } from '@/store/tools-store';
import { ToolDialog } from '@/components/tools/tool-dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input, Textarea } from '@/components/ui/input';

/**
 * Marketing Plan Tool: Deep website research, digital marketing manager plan
 * formulation, and 1-click Google Docs export.
 */
export function MarketingPlanDialog() {
  const open = useToolsStore((s) => s.active) === 'marketing';
  const close = useToolsStore((s) => s.close);

  const [config, setConfig] = useState<MarketingPlanConfig>({
    goal: 'leads',
    budget: 'growth',
    focus: 'full_funnel',
    targetLocations: 'Global / Primary English Speaking',
    additionalNotes: '',
    crawlSubpages: true,
  });

  const [researching, setResearching] = useState(false);
  const [exporting, setExporting] = useState(false);

  const generatePlan = async () => {
    setResearching(true);
    const toasts = useToastStore.getState();
    const chat = useChatStore.getState();

    try {
      toasts.push('info', 'Researching website…', 'Scanning homepage and subpages for brand intelligence.');
      const siteData = await researchWebsite(config.crawlSubpages);

      // Attach main page as slot context
      await chat.addContextSlot({
        kind: 'page',
        label: `${siteData.mainPage.title} (Analyzed)`,
        content: siteData.mainPage.text,
        url: siteData.mainPage.url,
        addedAt: Date.now(),
      });

      const prompt = buildMarketingPlanPrompt(siteData, config);
      await chat.sendText(prompt);

      toasts.push('success', 'Formulating Plan', `Digital Marketing Manager is creating your custom strategy.`);
      close();
    } catch (err) {
      console.error('Marketing plan generation error:', err);
      toasts.push('error', 'Research Failed', err instanceof Error ? err.message : 'Could not read the active tab.');
    } finally {
      setResearching(false);
    }
  };

  const handleExportLatest = async () => {
    const messages = useChatStore.getState().messages;
    const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');

    if (!lastAssistantMessage?.content) {
      useToastStore.getState().push('info', 'No Plan Found', 'Generate a marketing plan first, then click Export.');
      return;
    }

    setExporting(true);
    try {
      const res = await exportToGoogleDocs(lastAssistantMessage.content);
      useToastStore
        .getState()
        .push(
          'success',
          'Marketing Plan Copied!',
          res.openedNew
            ? 'New Google Doc opened. Press Ctrl+V to paste your formatted plan.'
            : 'Switched to your open Google Doc. Press Ctrl+V to paste your plan.',
        );
    } catch (err) {
      useToastStore.getState().push('error', 'Export Failed', 'Could not open Google Docs.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ToolDialog
      open={open}
      onClose={close}
      title="Digital Marketing Plan & Strategy"
      description="Researches the entire website, analyzes target audience and core offers, then creates a full marketing plan (SMM, Paid Ads, Content Pillars, Email) with Google Docs export."
    >
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Primary Goal
            <Select
              value={config.goal}
              onChange={(e) => setConfig({ ...config, goal: e.target.value as MarketingGoal })}
            >
              {(Object.keys(GOAL_LABELS) as MarketingGoal[]).map((g) => (
                <option key={g} value={g}>
                  {GOAL_LABELS[g]}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium">
            Budget & Resource Scale
            <Select
              value={config.budget}
              onChange={(e) => setConfig({ ...config, budget: e.target.value as MarketingBudget })}
            >
              {(Object.keys(BUDGET_LABELS) as MarketingBudget[]).map((b) => (
                <option key={b} value={b}>
                  {BUDGET_LABELS[b]}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Strategy Focus
            <Select
              value={config.focus}
              onChange={(e) => setConfig({ ...config, focus: e.target.value as MarketingFocus })}
            >
              {(Object.keys(FOCUS_LABELS) as MarketingFocus[]).map((f) => (
                <option key={f} value={f}>
                  {FOCUS_LABELS[f]}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium">
            Target Geographical Markets
            <Input
              value={config.targetLocations ?? ''}
              onChange={(e) => setConfig({ ...config, targetLocations: e.target.value })}
              placeholder="e.g. US, UK, Canada, Bangladesh"
              className="text-xs h-9"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs font-medium">
          Specific Priorities / Product Focus (Optional)
          <Textarea
            value={config.additionalNotes ?? ''}
            onChange={(e) => setConfig({ ...config, additionalNotes: e.target.value })}
            placeholder="e.g. Focus on driving demo bookings for our new AI feature, highlight TikTok & LinkedIn hooks..."
            rows={2}
            className="text-xs"
          />
        </label>

        <label className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/30 p-2.5 text-xs">
          <input
            type="checkbox"
            checked={config.crawlSubpages}
            onChange={(e) => setConfig({ ...config, crawlSubpages: e.target.checked })}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <span className="flex-1">
            <span className="font-medium text-foreground">Deep Website Crawl (Recommended)</span>
            <span className="block text-[11px] text-muted-foreground">
              Automatically discovers &amp; reads About, Services, Pricing, and Contact pages for deep context.
            </span>
          </span>
        </label>

        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            className="flex-1 gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500"
            onClick={() => void generatePlan()}
            disabled={researching}
          >
            {researching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Researching Site…
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4" /> Create Marketing Plan
              </>
            )}
          </Button>

          <Button
            variant="outline"
            className="gap-1.5 border-indigo-500/30 hover:bg-indigo-500/10 text-xs"
            onClick={() => void handleExportLatest()}
            disabled={exporting}
            title="Copies latest plan to clipboard and opens/focuses Google Docs"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5 text-indigo-500" />}
            Export to Google Doc
          </Button>
        </div>
      </div>
    </ToolDialog>
  );
}
