import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  History,
  MessageSquare,
  Pause,
  Phone,
  Play,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Users,
  Zap,
} from 'lucide-react';
import { useToolsStore } from '@/store/tools-store';
import { useToastStore } from '@/store/toast-store';
import {
  getActiveTab,
  findWhatsAppTab,
  extractWhatsAppLeadsFromTab,
  sendWhatsAppMessageInTab,
  openWhatsAppChatInTab,
} from '@/lib/chrome';
import { useSettingsStore } from '@/store/settings-store';
import { generateGeminiText } from '@/lib/gemini';
import { Button } from '@/components/ui/button';
import {
  DialogRoot,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type {
  WhatsAppLead,
  WhatsAppQueueItem,
  WhatsAppAutoReplyLog,
} from '@/shared/whatsapp-types';
import { cn } from '@/lib/cn';

type TabType = 'leads' | 'followup' | 'autoresponder' | 'settings';

/* ------------------------------------------------------------------ */
/*  WhatsApp Lead CRM & Auto-Responder Bot Dialog                     */
/* ------------------------------------------------------------------ */

export function WhatsAppDialog() {
  const active = useToolsStore((s) => s.active);
  const close = useToolsStore((s) => s.close);
  const toasts = useToastStore();

  const [isWhatsAppTab, setIsWhatsAppTab] = useState(false);
  const [waTabId, setWaTabId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<WhatsAppLead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unread' | 'phone'>('all');

  const [activeTab, setActiveTab] = useState<TabType>('leads');

  // Follow-Up Queue State
  const [baseMessage, setBaseMessage] = useState(
    'Hi {name},\n\nHope you are having a productive week! Just checking in to see if you have any questions regarding our digital marketing services. Let me know if you would like to hop on a quick call!\n\nBest regards,\nZonaed',
  );
  const [minDelaySec, setMinDelaySec] = useState(15);
  const [maxDelaySec, setMaxDelaySec] = useState(40);
  const [enableAiVariations, setEnableAiVariations] = useState(true);

  const [queue, setQueue] = useState<WhatsAppQueueItem[]>([]);
  const [queueRunning, setQueueRunning] = useState(false);
  const [queuePaused, setQueuePaused] = useState(false);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);
  const [countdownSec, setCountdownSec] = useState(0);

  const stopRef = useRef(false);
  const pauseRef = useRef(false);

  // Auto-Responder Bot State
  const [botActive, setBotActive] = useState(false);
  const [businessContext, setBusinessContext] = useState(
    'We are a high-performance Digital Marketing & Growth Agency. We specialize in Meta Ads, Google PPC, SEO ranking, and High-Converting Funnels for clients worldwide.',
  );
  const [meetingLink, setMeetingLink] = useState('https://calendly.com/zonaed/strategy-session');
  const [pricingNotes, setPricingNotes] = useState('Standard Growth Retainer starts at $500/mo. Custom enterprise scaling packages available on request.');
  const [triggerMode, setTriggerMode] = useState<'unread_all' | 'keywords'>('unread_all');
  const [triggerKeywords, setTriggerKeywords] = useState('price, pricing, cost, service, hire, call, meeting, package, help');
  const [cooldownHours, setCooldownHours] = useState(24);
  const [autoReplyLogs, setAutoReplyLogs] = useState<WhatsAppAutoReplyLog[]>([]);
  const [botRunning, setBotRunning] = useState(false);
  const [botCountdown, setBotCountdown] = useState(0);
  const stopBotRef = useRef(false);

  /* ---- lifecycle ---- */

  useEffect(() => {
    if (active !== 'whatsapp') return;
    void detectWhatsApp();
  }, [active]);

  const detectWhatsApp = async () => {
    const tab = await getActiveTab().catch(() => undefined);
    if (tab?.url?.includes('web.whatsapp.com') && tab.id !== undefined) {
      setIsWhatsAppTab(true);
      setWaTabId(tab.id);
      return;
    }
    const wa = await findWhatsAppTab();
    if (wa?.id !== undefined) {
      setIsWhatsAppTab(true);
      setWaTabId(wa.id);
    } else {
      setIsWhatsAppTab(false);
      setWaTabId(undefined);
    }
  };

  /* ---- actions ---- */

  const openWhatsApp = () => void chrome.tabs?.create?.({ url: 'https://web.whatsapp.com' });

  const extractLeads = async () => {
    if (!waTabId) {
      toasts.push('info', 'WhatsApp Web Not Found', 'Open web.whatsapp.com first.');
      return;
    }
    setLoading(true);
    try {
      const result: WhatsAppLead[] = (await extractWhatsAppLeadsFromTab(waTabId)) || [];
      if (!result.length) {
        toasts.push('info', 'No Leads', 'Chat list appears empty. Ensure WhatsApp Web is loaded.');
      } else {
        setLeads(result);
        setSelectedLeadIds(new Set(result.map((l) => l.id)));
        toasts.push('success', `${result.length} Leads Extracted`, 'Contacts scraped from WhatsApp Web.');
      }
    } catch (err: any) {
      toasts.push('error', 'Extraction Failed', err?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const toggleLead = (id: string) => {
    const next = new Set(selectedLeadIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedLeadIds(next);
  };

  const toggleAll = () => {
    setSelectedLeadIds(
      selectedLeadIds.size === filteredLeads.length
        ? new Set()
        : new Set(filteredLeads.map((l) => l.id)),
    );
  };

  const filteredLeads = leads.filter((l) => {
    if (filterMode === 'unread' && !l.isUnread) return false;
    if (filterMode === 'phone' && !l.phone) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return l.name.toLowerCase().includes(q) || l.phone?.includes(q) || l.lastMessage?.toLowerCase().includes(q);
  });

  const copyTsv = () => {
    if (!filteredLeads.length) return;
    const header = ['Name', 'Phone', 'Status', 'Unread', 'Last Message', 'Time'];
    const rows = filteredLeads.map((l) => [
      l.name.replace(/\t/g, ' '),
      l.phone || l.id,
      l.status,
      l.isUnread ? `Yes (${l.unreadCount})` : 'No',
      (l.lastMessage || '').replace(/[\t\n]/g, ' '),
      l.time || '',
    ]);
    void navigator.clipboard.writeText([header.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n'));
    toasts.push('success', 'Copied!', 'Paste in Google Sheets with Ctrl+V.');
  };

  const downloadCsv = () => {
    if (!filteredLeads.length) return;
    const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
    const header = 'Name,Phone,Status,Unread,Last Message,Time';
    const rows = filteredLeads.map((l) => [
      esc(l.name),
      esc(l.phone || l.id),
      esc(l.status),
      esc(l.isUnread ? 'Unread' : 'Read'),
      esc(l.lastMessage || ''),
      esc(l.time || ''),
    ].join(','));
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), {
      href: url,
      download: `wa_leads_${new Date().toISOString().slice(0, 10)}.csv`,
    }).click();
    URL.revokeObjectURL(url);
    toasts.push('success', 'CSV Downloaded', 'Check your downloads folder.');
  };

  /* ---- Follow-Up Queue ---- */

  const prepareQueue = async () => {
    const selected = leads.filter((l) => selectedLeadIds.has(l.id));
    if (!selected.length) {
      toasts.push('info', 'Select Contacts', 'Pick at least 1 contact.');
      return;
    }
    setLoading(true);
    const geminiKey = useSettingsStore.getState().geminiApiKey;
    const items: WhatsAppQueueItem[] = [];

    for (const lead of selected) {
      let msg = baseMessage.replace(/{name}/g, lead.name || 'there');
      if (enableAiVariations && geminiKey) {
        try {
          const varied = await generateGeminiText(
            geminiKey,
            `Rewrite this WhatsApp follow-up naturally for "${lead.name}". No AI cliches (never use delve, embark, testament). Return only the message:\n"${msg}"`,
            'gemini-2.5-flash',
          );
          if (varied.trim()) msg = varied.trim();
        } catch {}
      }
      items.push({
        id: lead.id,
        leadId: lead.id,
        name: lead.name,
        phone: lead.phone,
        customMessage: msg,
        status: 'queued',
        scheduledDelaySec: Math.floor(Math.random() * (maxDelaySec - minDelaySec + 1)) + minDelaySec,
      });
    }
    setQueue(items);
    setLoading(false);
    setActiveTab('followup');
  };

  const runQueue = async () => {
    if (!queue.length || !waTabId) return;
    setQueueRunning(true);
    setQueuePaused(false);
    stopRef.current = false;
    pauseRef.current = false;

    for (let i = 0; i < queue.length; i++) {
      if (stopRef.current) break;
      while (pauseRef.current) {
        await new Promise((r) => setTimeout(r, 500));
        if (stopRef.current) break;
      }
      if (stopRef.current) break;

      const item = queue[i];
      if (!item || item.status === 'sent') continue;
      setCurrentQueueIndex(i);
      setQueue((p) => p.map((q, idx) => (idx === i ? { ...q, status: 'sending' } : q)));

      // countdown
      for (let c = item.scheduledDelaySec; c > 0; c--) {
        if (stopRef.current) break;
        while (pauseRef.current) {
          await new Promise((r) => setTimeout(r, 500));
          if (stopRef.current) break;
        }
        setCountdownSec(c);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setCountdownSec(0);
      if (stopRef.current) break;

      await openWhatsAppChatInTab(waTabId, item.name || item.id).catch(() => false);
      await new Promise((r) => setTimeout(r, 800));
      const ok = await sendWhatsAppMessageInTab(waTabId, item.customMessage).catch(() => false);

      setQueue((p) =>
        p.map((q, idx) =>
          idx === i
            ? { ...q, status: ok ? 'sent' : 'failed', ...(ok ? { sentAt: Date.now() } : { error: 'Send failed' }) }
            : q,
        ),
      );
      await new Promise((r) => setTimeout(r, 1500));
    }
    setQueueRunning(false);
    setCurrentQueueIndex(-1);
    toasts.push('success', 'Queue Complete', 'All follow-ups processed.');
  };

  const togglePause = () => {
    pauseRef.current = !pauseRef.current;
    setQueuePaused(pauseRef.current);
  };
  const stopQueueNow = () => {
    stopRef.current = true;
    setQueueRunning(false);
    setQueuePaused(false);
  };

  /* ---- Auto-Responder Bot Engine ---- */

  const runAutoResponderCycle = async () => {
    if (!waTabId) {
      toasts.push('info', 'WhatsApp Web Not Found', 'Open web.whatsapp.com first.');
      return;
    }

    setBotRunning(true);
    stopBotRef.current = false;
    toasts.push('info', 'Auto-Responder Bot Active 🤖', 'Scanning unread client inquiries...');

    try {
      // 1. Fetch live leads
      const liveLeads: WhatsAppLead[] = (await extractWhatsAppLeadsFromTab(waTabId)) || [];
      const keywords = triggerKeywords
        .toLowerCase()
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const targetLeads = liveLeads.filter((l) => {
        if (!l.isUnread && triggerMode === 'unread_all') return false;
        if (triggerMode === 'keywords') {
          const last = (l.lastMessage || '').toLowerCase();
          const match = keywords.some((kw) => last.includes(kw));
          if (!match) return false;
        }
        return true;
      });

      if (targetLeads.length === 0) {
        toasts.push('info', 'No Inquiries Pending', 'No new unread inquiries match trigger rules.');
        setBotRunning(false);
        return;
      }

      toasts.push('info', `Found ${targetLeads.length} Inquiries`, 'Drafting contextual AI responses...');

      const geminiKey = useSettingsStore.getState().geminiApiKey;

      for (const lead of targetLeads) {
        if (stopBotRef.current) break;

        // Check Cooldown
        const lastReplied = autoReplyLogs.find(
          (log) => log.leadName === lead.name || (lead.phone && log.leadPhone === lead.phone),
        );
        if (lastReplied && Date.now() - lastReplied.timestamp < cooldownHours * 3600 * 1000) {
          setAutoReplyLogs((prev) => [
            {
              id: String(Date.now()),
              leadName: lead.name,
              leadPhone: lead.phone,
              incomingMessage: lead.lastMessage || '',
              replyMessage: 'Skipped: already replied within cooldown window.',
              timestamp: Date.now(),
              status: 'skipped_cooldown',
            },
            ...prev,
          ]);
          continue;
        }

        // Random typing simulation delay (12s - 25s)
        const delay = Math.floor(Math.random() * 14) + 12;
        for (let d = delay; d > 0; d--) {
          if (stopBotRef.current) break;
          setBotCountdown(d);
          await new Promise((r) => setTimeout(r, 1000));
        }
        setBotCountdown(0);
        if (stopBotRef.current) break;

        // Generate AI consultative answer
        let replyText = `Hi ${lead.name},\n\nThanks for reaching out! Regarding your inquiry: ${businessContext}\n\n${pricingNotes}\n\nYou can book a direct strategy call here: ${meetingLink}\n\nBest regards,\nZonaed AI Team`;

        if (geminiKey) {
          try {
            const prompt = `You are a consultative client concierge for Zonaed's digital marketing business.
Business Context:
${businessContext}

Pricing Outline:
${pricingNotes}

Direct Meeting Booking Link:
${meetingLink}

Incoming prospect message from (${lead.name}):
"${lead.lastMessage || 'Hi, interested in learning more about your services'}"

Instructions:
- Provide a warm, helpful, and professional reply (1-2 short paragraphs).
- Answer their question directly based on the business context.
- Naturally include the meeting booking link if they want to discuss details.
- Never use robotic AI clichés (never use "delve", "testament", "embark", "tapestry").
- Output ONLY the final message ready to dispatch without quotes.`;

            const aiReply = await generateGeminiText(geminiKey, prompt, 'gemini-2.5-flash');
            if (aiReply.trim()) replyText = aiReply.trim();
          } catch {}
        }

        // Dispatch message
        await openWhatsAppChatInTab(waTabId, lead.name || lead.id).catch(() => false);
        await new Promise((r) => setTimeout(r, 800));
        const sent = await sendWhatsAppMessageInTab(waTabId, replyText).catch(() => false);

        setAutoReplyLogs((prev) => [
          {
            id: String(Date.now()),
            leadName: lead.name,
            leadPhone: lead.phone,
            incomingMessage: lead.lastMessage || '',
            replyMessage: replyText,
            timestamp: Date.now(),
            status: sent ? 'sent' : 'failed',
          },
          ...prev,
        ]);

        await new Promise((r) => setTimeout(r, 1500));
      }

      toasts.push('success', 'Auto-Responder Finished ✅', 'All matching inquiries have been answered.');
    } catch (err: any) {
      toasts.push('error', 'Bot Run Error', err?.message || 'Error executing auto-reply.');
    } finally {
      setBotRunning(false);
      setBotCountdown(0);
    }
  };

  const stopAutoResponder = () => {
    stopBotRef.current = true;
    setBotRunning(false);
    setBotCountdown(0);
    toasts.push('info', 'Auto-Responder Stopped', 'Bot execution halted.');
  };

  const sentCount = queue.filter((q) => q.status === 'sent').length;
  const pct = queue.length ? Math.round((sentCount / queue.length) * 100) : 0;
  const unreadCount = leads.filter((l) => l.isUnread).length;

  /* ---- render ---- */

  return (
    <DialogRoot open={active === 'whatsapp'} onOpenChange={(o: boolean) => (!o ? close() : undefined)}>
      <DialogContent
        className={cn(
          'max-w-2xl max-h-[calc(100vh-2rem)] flex flex-col !p-0 !gap-0',
          'overflow-hidden rounded-2xl border-emerald-500/15',
        )}
      >
        {/* ═══════ Header ═══════ */}
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-border/50">
          {/* Row 1: title + connection */}
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-600/25">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-bold tracking-tight text-foreground leading-snug font-sans">
                  WhatsApp Lead CRM &amp; Auto-Responder
                </DialogTitle>
                <DialogDescription className="text-[11px] text-muted-foreground leading-tight mt-0.5 font-sans">
                  Scrape leads, send follow-ups, and run AI auto-responder bot
                </DialogDescription>
              </div>
            </div>

            {!isWhatsAppTab ? (
              <button
                onClick={openWhatsApp}
                className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg transition-colors"
              >
                <ExternalLink className="h-3 w-3" /> Open WA Web
              </button>
            ) : (
              <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inset-0 rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                Connected
              </div>
            )}
          </div>

          {/* Row 2: Metrics */}
          <div className="flex items-center gap-2 mt-3">
            <MetricPill icon={<Users className="h-3 w-3" />} label="Leads" value={String(leads.length)} color="emerald" />
            <MetricPill icon={<Clock className="h-3 w-3" />} label="Unread" value={String(unreadCount)} color="amber" />
            <MetricPill icon={<Bot className="h-3 w-3" />} label="Auto-Replies" value={String(autoReplyLogs.filter((l) => l.status === 'sent').length)} color="indigo" />
          </div>

          {/* Row 3: Tab Switcher */}
          <div className="flex items-center gap-1 p-0.5 mt-3 rounded-lg bg-muted/50 border border-border/50">
            {(['leads', 'followup', 'autoresponder', 'settings'] as const).map((tab) => {
              const labels = {
                leads: 'Leads Hub',
                followup: 'Follow-Up',
                autoresponder: '🤖 Auto-Responder',
                settings: 'Settings',
              };
              const counts = {
                leads: leads.length,
                followup: queue.length,
                autoresponder: autoReplyLogs.filter((l) => l.status === 'sent').length,
                settings: 0,
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'flex-1 py-1 text-[11px] font-bold rounded-md transition-all text-center font-sans',
                    activeTab === tab
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {labels[tab]}
                  {counts[tab] > 0 && tab !== 'autoresponder' ? ` (${counts[tab]})` : ''}
                  {tab === 'followup' && queueRunning ? (
                    <span className="inline-block ml-1 h-1.5 w-1.5 rounded-full bg-amber-300 animate-ping" />
                  ) : null}
                  {tab === 'autoresponder' && botRunning ? (
                    <span className="inline-block ml-1 h-1.5 w-1.5 rounded-full bg-cyan-300 animate-ping" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════ Tab Content ═══════ */}
        <div className="flex-1 min-h-0 overflow-y-auto scroll-area">

          {/* ─── Tab 1: Leads Hub ─── */}
          {activeTab === 'leads' && (
            <div className="flex flex-col gap-3 p-5">
              {/* Search + Filter row */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs rounded-lg"
                  />
                </div>
                <SegmentedFilter
                  value={filterMode}
                  onChange={setFilterMode}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'unread', label: `Unread (${unreadCount})` },
                    { value: 'phone', label: 'Numbers' },
                  ]}
                />
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={extractLeads}
                  disabled={loading || !isWhatsAppTab}
                  className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold gap-1.5"
                >
                  <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
                  {loading ? 'Extracting...' : 'Extract Numbers'}
                </Button>

                {leads.length > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={copyTsv} className="h-7 text-[11px] rounded-lg gap-1.5">
                      <Copy className="h-3 w-3" /> Copy TSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadCsv} className="h-7 text-[11px] rounded-lg gap-1.5">
                      <Download className="h-3 w-3" /> CSV
                    </Button>
                    <Button
                      size="sm"
                      onClick={prepareQueue}
                      disabled={loading}
                      className="h-7 text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold gap-1.5 ml-auto"
                    >
                      <Send className="h-3 w-3" /> Queue ({selectedLeadIds.size})
                    </Button>
                  </>
                )}
              </div>

              {/* Content */}
              {leads.length === 0 ? (
                <EmptyState
                  isConnected={isWhatsAppTab}
                  loading={loading}
                  onConnect={openWhatsApp}
                  onExtract={extractLeads}
                />
              ) : (
                <LeadsTable
                  leads={filteredLeads}
                  selectedIds={selectedLeadIds}
                  onToggle={toggleLead}
                  onToggleAll={toggleAll}
                />
              )}
            </div>
          )}

          {/* ─── Tab 2: Follow-Up Queue ─── */}
          {activeTab === 'followup' && (
            <div className="flex flex-col gap-3 p-5">
              {/* Progress bar */}
              {queue.length > 0 && (
                <div className="flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground flex items-center gap-1.5 font-sans">
                      <Zap className="h-3.5 w-3.5 text-emerald-500" />
                      {sentCount} / {queue.length} Sent
                    </span>
                    <span className="font-mono font-bold text-emerald-500">{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Active spotlight */}
                  {queueRunning && currentQueueIndex >= 0 && queue[currentQueueIndex] && (
                    <div className="flex items-center justify-between bg-card border rounded-lg p-2 mt-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inset-0 rounded-full bg-amber-400 opacity-75" />
                          <span className="relative rounded-full h-2 w-2 bg-amber-500" />
                        </span>
                        <span className="text-[11px] font-bold text-foreground truncate">
                          {queue[currentQueueIndex].name}
                        </span>
                      </div>
                      {countdownSec > 0 && (
                        <span className="text-[11px] font-mono font-bold text-amber-500">
                          {countdownSec}s
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Message template */}
              <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground">Message Template</span>
                  <div className="flex gap-1">
                    {['{name}', '{phone}'].map((v) => (
                      <button
                        key={v}
                        onClick={() => setBaseMessage((p) => p + ' ' + v)}
                        className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition-colors"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  rows={3}
                  value={baseMessage}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBaseMessage(e.target.value)}
                  disabled={queueRunning}
                  className="text-xs rounded-lg bg-muted/20 resize-none"
                />
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableAiVariations}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnableAiVariations(e.target.checked)}
                    disabled={queueRunning}
                    className="rounded text-indigo-600 h-3.5 w-3.5"
                  />
                  <Sparkles className="h-3 w-3 text-indigo-400" />
                  AI Dynamic Variations
                </label>
              </div>

              {/* Playback controls */}
              <div className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3">
                <div className="flex items-center gap-2">
                  {!queueRunning ? (
                    <Button
                      onClick={runQueue}
                      disabled={!queue.length || !waTabId}
                      size="sm"
                      className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold gap-1.5"
                    >
                      <Play className="h-3 w-3" /> Start Queue
                    </Button>
                  ) : (
                    <>
                      <Button onClick={togglePause} size="sm" variant="outline" className="h-7 text-[11px] rounded-lg gap-1.5 text-amber-500 border-amber-500/30">
                        <Pause className="h-3 w-3" /> {queuePaused ? 'Resume' : 'Pause'}
                      </Button>
                      <Button onClick={stopQueueNow} size="sm" variant="destructive" className="h-7 text-[11px] rounded-lg gap-1.5">
                        <Square className="h-3 w-3" /> Stop
                      </Button>
                    </>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" />
                  {minDelaySec}-{maxDelaySec}s delay
                </span>
              </div>

              {/* Queue items */}
              {queue.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {queue.map((item, idx) => (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-lg border p-2.5 text-xs transition-all',
                        idx === currentQueueIndex && 'ring-1 ring-emerald-500 bg-emerald-500/5',
                        item.status === 'sent' && 'opacity-60',
                      )}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground truncate">{item.name}</span>
                          {item.phone && (
                            <span className="text-[10px] text-muted-foreground font-mono shrink-0">{item.phone}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{item.customMessage}</p>
                      </div>
                      <QueueBadge status={item.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Tab 3: Auto-Responder Bot ─── */}
          {activeTab === 'autoresponder' && (
            <div className="flex flex-col gap-4 p-5">
              {/* Bot Control Card */}
              <div className="flex items-center justify-between rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-teal-500/5 to-indigo-500/10 p-4 shadow-sm">
                <div>
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 font-sans">
                    <Bot className="h-4 w-4 text-cyan-500" />
                    AI Auto-Responder &amp; Booking Assistant
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Automatically reads unread WhatsApp inquiries and drafts consultative replies with your meeting link.
                  </p>
                </div>

                {!botRunning ? (
                  <Button
                    size="sm"
                    onClick={runAutoResponderCycle}
                    disabled={!isWhatsAppTab}
                    className="h-8 text-xs bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl font-bold gap-1.5 shadow-sm shadow-cyan-500/20"
                  >
                    <Play className="h-3.5 w-3.5" /> Start Auto-Responder
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    {botCountdown > 0 ? (
                      <span className="text-xs font-mono font-bold text-cyan-500 bg-cyan-500/10 px-2 py-1 rounded-lg">
                        Typing delay: {botCountdown}s
                      </span>
                    ) : null}
                    <Button
                      size="sm"
                      onClick={stopAutoResponder}
                      variant="destructive"
                      className="h-8 text-xs rounded-xl font-bold gap-1.5"
                    >
                      <Square className="h-3.5 w-3.5" /> Stop Bot
                    </Button>
                  </div>
                )}
              </div>

              {/* Bot Knowledge Settings */}
              <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 font-sans">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> Business Knowledge &amp; Booking URL
                </span>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-muted-foreground font-semibold">Business Bio &amp; Offer Summary</label>
                  <Textarea
                    rows={2}
                    value={businessContext}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBusinessContext(e.target.value)}
                    className="text-xs bg-muted/20 rounded-lg resize-none font-sans"
                    placeholder="Describe your services and core value proposition..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-muted-foreground font-semibold">Calendly / Meeting Link</label>
                    <Input
                      value={meetingLink}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMeetingLink(e.target.value)}
                      placeholder="https://calendly.com/your-name/call"
                      className="h-8 text-xs rounded-lg font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-muted-foreground font-semibold">Pricing / Package Info</label>
                    <Input
                      value={pricingNotes}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPricingNotes(e.target.value)}
                      placeholder="e.g. Plans start from $500/mo..."
                      className="h-8 text-xs rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-muted-foreground font-semibold">Trigger Mode</label>
                    <select
                      value={triggerMode}
                      onChange={(e) => setTriggerMode(e.target.value as any)}
                      className="h-8 text-xs rounded-lg border bg-muted/20 px-2 font-sans"
                    >
                      <option value="unread_all">All Unread Messages (Recommended)</option>
                      <option value="keywords">Specific Trigger Keywords Only</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-muted-foreground font-semibold">Safety Cooldown</label>
                    <select
                      value={cooldownHours}
                      onChange={(e) => setCooldownHours(parseInt(e.target.value, 10))}
                      className="h-8 text-xs rounded-lg border bg-muted/20 px-2 font-sans"
                    >
                      <option value={12}>12 Hours Cooldown</option>
                      <option value={24}>24 Hours Cooldown (Safe)</option>
                      <option value={48}>48 Hours Cooldown</option>
                    </select>
                  </div>
                </div>

                {triggerMode === 'keywords' ? (
                  <div className="flex flex-col gap-1 pt-1">
                    <label className="text-[11px] text-muted-foreground font-semibold">Keywords (Comma Separated)</label>
                    <Input
                      value={triggerKeywords}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTriggerKeywords(e.target.value)}
                      className="h-8 text-xs rounded-lg font-mono text-[11px]"
                      placeholder="price, pricing, cost, service, meeting, package"
                    />
                  </div>
                ) : null}
              </div>

              {/* Bot Activity Log */}
              <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5 font-sans">
                    <History className="h-3.5 w-3.5 text-emerald-500" /> Auto-Reply Activity History ({autoReplyLogs.length})
                  </span>
                  {autoReplyLogs.length > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAutoReplyLogs([])}
                      className="h-6 text-[10px] text-muted-foreground hover:text-destructive"
                    >
                      Clear Log
                    </Button>
                  ) : null}
                </div>

                {autoReplyLogs.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No automated replies dispatched yet. Click "Start Auto-Responder" to run a scan.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto scroll-area">
                    {autoReplyLogs.map((log) => (
                      <div key={log.id} className="flex flex-col gap-1 rounded-lg border bg-muted/30 p-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">{log.leadName}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {log.incomingMessage ? (
                          <p className="text-[10px] text-muted-foreground truncate">
                            <strong>Inquiry:</strong> "{log.incomingMessage}"
                          </p>
                        ) : null}
                        <p className="text-[11px] text-foreground/90 bg-card p-1.5 rounded border leading-relaxed">
                          {log.replyMessage}
                        </p>
                        <div className="flex justify-end">
                          {log.status === 'sent' ? (
                            <Badge variant="success" className="text-[9px] gap-0.5 px-1 py-0">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Dispatched
                            </Badge>
                          ) : log.status === 'skipped_cooldown' ? (
                            <Badge variant="muted" className="text-[9px] px-1 py-0">
                              Cooldown Active
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0">
                              Failed
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Tab 4: Settings ─── */}
          {activeTab === 'settings' && (
            <div className="flex flex-col gap-3 p-5">
              <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 font-sans">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Anti-Ban Delay Settings
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Randomized pause between each contact prevents WhatsApp from flagging automated activity.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-muted-foreground font-semibold">Min Delay (sec)</label>
                    <Input
                      type="number"
                      min={5}
                      max={60}
                      value={minDelaySec}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMinDelaySec(parseInt(e.target.value, 10) || 10)}
                      className="h-8 text-xs rounded-lg"
                    />
                    <span className="text-[10px] text-emerald-500">Recommended: 15s+</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-muted-foreground font-semibold">Max Delay (sec)</label>
                    <Input
                      type="number"
                      min={15}
                      max={120}
                      value={maxDelaySec}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxDelaySec(parseInt(e.target.value, 10) || 40)}
                      className="h-8 text-xs rounded-lg"
                    />
                    <span className="text-[10px] text-emerald-500">Recommended: 40s+</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-4">
                <h3 className="text-[11px] font-bold text-foreground flex items-center gap-1.5 font-sans">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                  Anti-Ban Best Practices
                </h3>
                <ul className="space-y-1 pl-4 list-disc text-[11px] text-muted-foreground leading-relaxed">
                  <li>Only follow up contacts with existing chat history in your inbox.</li>
                  <li>Keep AI Variations enabled so greetings differ per contact.</li>
                  <li>Send 20-30 messages per session, then pause 5+ minutes.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </DialogRoot>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function MetricPill({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'emerald' | 'amber' | 'indigo';
}) {
  const colorMap = {
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    indigo: 'text-indigo-500',
  };
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-2 py-1 flex-1 min-w-0">
      <span className={cn('shrink-0', colorMap[color])}>{icon}</span>
      <span className="text-[10px] text-muted-foreground truncate">{label}</span>
      <span className={cn('text-[11px] font-bold ml-auto shrink-0', colorMap[color])}>{value}</span>
    </div>
  );
}

function SegmentedFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: any) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/40 border border-border/50 shrink-0">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all whitespace-nowrap',
            value === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({
  isConnected,
  loading,
  onConnect,
  onExtract,
}: {
  isConnected: boolean;
  loading: boolean;
  onConnect: () => void;
  onExtract: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed rounded-xl bg-muted/10">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 mb-2.5">
        <Users className="h-5 w-5" />
      </div>
      <h3 className="text-xs font-bold text-foreground">No Leads Extracted</h3>
      <p className="text-[11px] text-muted-foreground max-w-[260px] mt-1 leading-relaxed">
        Open WhatsApp Web, then click "Extract Numbers" to pull contacts into a CRM table.
      </p>
      <Button
        onClick={isConnected ? onExtract : onConnect}
        size="sm"
        disabled={loading}
        className="mt-3 h-7 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold gap-1.5"
      >
        {isConnected ? (
          <>
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} /> Extract Now
          </>
        ) : (
          <>
            <ExternalLink className="h-3 w-3" /> Open WhatsApp Web
          </>
        )}
      </Button>
    </div>
  );
}

function LeadsTable({
  leads,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  leads: WhatsAppLead[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {/* Header row */}
      <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
        <input
          type="checkbox"
          checked={selectedIds.size === leads.length && leads.length > 0}
          onChange={onToggleAll}
          className="rounded h-3.5 w-3.5 text-emerald-600 shrink-0"
        />
        <span className="flex-1">Contact</span>
        <span className="w-20 text-right">Status</span>
      </div>

      {/* Lead rows */}
      {leads.map((lead) => {
        const selected = selectedIds.has(lead.id);
        return (
          <button
            key={lead.id}
            type="button"
            onClick={() => onToggle(lead.id)}
            className={cn(
              'flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors w-full',
              selected ? 'bg-emerald-500/8 hover:bg-emerald-500/12' : 'hover:bg-muted/40',
            )}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle(lead.id)}
              onClick={(e) => e.stopPropagation()}
              className="rounded h-3.5 w-3.5 text-emerald-600 shrink-0"
            />

            {/* Avatar */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 text-[10px] font-extrabold uppercase">
              {lead.name.slice(0, 2) || 'WA'}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-foreground truncate">{lead.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {lead.phone && lead.phone !== lead.name && (
                  <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5">
                    <Phone className="h-2.5 w-2.5 text-emerald-500" />
                    {lead.phone}
                  </span>
                )}
                {lead.lastMessage && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                    {lead.lastMessage}
                  </span>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="shrink-0 w-20 flex justify-end">
              {lead.isUnread ? (
                <Badge variant="success" className="text-[10px] px-1.5">
                  Unread{lead.unreadCount ? ` (${lead.unreadCount})` : ''}
                </Badge>
              ) : (
                <Badge variant="muted" className="text-[10px] px-1.5">
                  Read
                </Badge>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function QueueBadge({ status }: { status: string }) {
  if (status === 'sent')
    return (
      <Badge variant="success" className="text-[10px] gap-1">
        <CheckCircle2 className="h-3 w-3" /> Sent
      </Badge>
    );
  if (status === 'sending')
    return (
      <Badge variant="warning" className="text-[10px] animate-pulse">
        Sending...
      </Badge>
    );
  if (status === 'failed')
    return (
      <Badge variant="destructive" className="text-[10px]">
        Failed
      </Badge>
    );
  return (
    <Badge variant="muted" className="text-[10px]">
      Queued
    </Badge>
  );
}
