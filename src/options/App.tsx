import { useEffect, useState } from 'react';
import {
  Brain,
  Check,
  Globe,
  HardDrive,
  Key,
  Lock,
  MessageSquare,
  Mic,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  Shield,
  Sliders,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import {
  deleteProfile,
  deletePrompt,
  listProfiles,
  listPrompts,
  upsertProfile,
  upsertPrompt,
  listMemories,
  upsertMemory,
  deleteMemory,
  toggleMemory,
  listSkills,
  upsertSkill,
  deleteSkill,
  toggleSkill,
  getStorageStats,
  clearAllChats,
  clearScrapesAndLogs,
  factoryResetAllData,
  type ProfileField,
  type StoredProfile,
  type StoredPrompt,
  type StoredMemory,
  type StoredSkill,
  type MemoryCategory,
  type StorageStats,
} from '@/db/db';
import { ensureMemorySeeded } from '@/lib/memory-skills';
import { TRANSLATE_TARGET_LANGS } from '@/lib/tasks';
import { GEMINI_MODELS, testGeminiApiKey } from '@/lib/gemini';
import { CLOUD_MODELS } from '@/lib/openai-compatible';
import { applyTheme } from '@/lib/theme';
import { useOllamaStore } from '@/store/ollama-store';
import { useSettingsStore, type Settings } from '@/store/settings-store';
import { useToastStore } from '@/store/toast-store';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';

type Tab = 'general' | 'memory' | 'skills' | 'prompts' | 'profiles' | 'permissions' | 'privacy';

interface TabMeta {
  id: Tab;
  label: string;
  description: string;
  icon: typeof SettingsIcon;
}

const TABS: TabMeta[] = [
  {
    id: 'general',
    label: 'General & AI Models',
    description: 'Configure Gemini API keys, local Ollama endpoints, default models, and language preference.',
    icon: SettingsIcon,
  },
  {
    id: 'memory',
    label: 'Long-Term Memory',
    description: 'Persistent user context, bio facts, business profile, and strict behavioral rules.',
    icon: Brain,
  },
  {
    id: 'skills',
    label: 'Custom Skills',
    description: 'Specialized modular playbooks that auto-trigger on specific keywords.',
    icon: Zap,
  },
  {
    id: 'prompts',
    label: 'Saved Prompts',
    description: 'Quick-access prompt templates and reusable snippets.',
    icon: MessageSquare,
  },
  {
    id: 'profiles',
    label: 'Autofill Profiles',
    description: 'Identity profiles and custom form fields for fast browser autofill.',
    icon: User,
  },
  {
    id: 'permissions',
    label: 'Permissions',
    description: 'Review on-demand browser permissions and security model.',
    icon: Shield,
  },
  {
    id: 'privacy',
    label: 'Privacy & Storage',
    description: '100% local IndexedDB storage and client-side isolation details.',
    icon: Lock,
  },
];

export function OptionsApp() {
  const [tab, setTab] = useState<Tab>(() => {
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get('tab') as Tab;
    return TABS.some((t) => t.id === initialTab) ? initialTab : 'general';
  });
  const ready = useSettingsStore((s) => s.ready);
  const theme = useSettingsStore((s) => s.theme);
  const update = useSettingsStore((s) => s.update);
  const lastModel = useSettingsStore((s) => s.lastModel);

  useEffect(() => {
    void useSettingsStore.getState().load();
    const params = new URLSearchParams(window.location.search);
    if (params.get('requestMic') === '1') {
      void (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
          useToastStore.getState().push(
            'success',
            'Microphone Access Granted! 🎙️',
            'Voice dictation is now fully activated. You can close this tab and return to the side panel.',
          );
        } catch {
          useToastStore.getState().push(
            'info',
            'Microphone Prompt Opened',
            'Please click "Allow" on the top-left Chrome prompt to enable voice dictation.',
          );
        }
      })();
    }
  }, []);

  const currentTab: TabMeta = TABS.find((t) => t.id === tab) ?? TABS[0]!;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col md:flex-row bg-background text-foreground">
      {/* Left Sidebar Dashboard */}
      <aside className="w-full md:w-64 lg:w-72 shrink-0 border-b md:border-b-0 md:border-r border-border/80 bg-card/60 backdrop-blur-xl flex flex-col justify-between p-4 md:p-5 select-none h-auto md:h-full">
        <div className="flex flex-col gap-6">
          {/* Brand Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 text-lg font-black text-white shadow-lg shadow-indigo-500/25 ring-2 ring-white/20">
              Z
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-extrabold tracking-tight gradient-text truncate">
                  Zonaed AI
                </h1>
                <span className="rounded-md bg-indigo-500/10 px-1.5 py-0.2 text-[10px] font-bold text-indigo-500 ring-1 ring-indigo-500/20">
                  v0.3.0
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                Personal Agent Dashboard
              </p>
            </div>
          </div>

          {/* Navigation Items (Clean vertical list, zero scroll) */}
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-1 md:pb-0">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all whitespace-nowrap md:whitespace-normal text-left w-full font-sans',
                    active
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-1 ring-indigo-500'
                      : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-transform group-hover:scale-110',
                      active ? 'text-white' : 'text-muted-foreground group-hover:text-foreground',
                    )}
                  />
                  <span className="flex-1 truncate">{t.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="hidden md:flex flex-col gap-2 pt-4 border-t border-border/60">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Engine
            </span>
            <span className="font-semibold text-foreground truncate max-w-[120px] font-mono text-[10px]">
              {lastModel?.includes('gemini') ? 'Gemini 3.7' : lastModel ?? 'Local Ollama'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span className="font-medium">Side Panel</span>
            <kbd className="rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground font-bold shadow-xs">
              Ctrl+Shift+Z
            </kbd>
          </div>
        </div>
      </aside>

      {/* Right Main Content Area (Fixed layout with internal scrolling canvas) */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-muted/15">
        {/* Sticky Top Section Header */}
        <header className="border-b border-border/60 bg-card/40 backdrop-blur-md px-6 md:px-8 py-4 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-base md:text-lg font-bold text-foreground flex items-center gap-2 font-sans">
              <currentTab.icon className="h-5 w-5 text-indigo-500" />
              {currentTab.label}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-sans">
              {currentTab.description}
            </p>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <main
          className="flex-1 overflow-y-auto p-6 md:p-8"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-12">
            {ready ? (
              <>
                {tab === 'general' ? <GeneralTab /> : null}
                {tab === 'memory' ? <MemoryTab /> : null}
                {tab === 'skills' ? <SkillsTab /> : null}
                {tab === 'prompts' ? <PromptsTab /> : null}
                {tab === 'profiles' ? <ProfilesTab /> : null}
                {tab === 'permissions' ? <PermissionsTab /> : null}
                {tab === 'privacy' ? <PrivacyTab /> : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading settings…</p>
            )}
          </div>
        </main>
      </div>

      <Toaster />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * General
 * ------------------------------------------------------------------------- */

function GeneralTab() {
  const settings = useSettingsStore();
  const update = useSettingsStore((s) => s.update);
  const models = useOllamaStore((s) => s.models);
  const status = useOllamaStore((s) => s.status);
  const refresh = useOllamaStore((s) => s.refresh);
  const [draftUrl, setDraftUrl] = useState(settings.ollamaBaseUrl);
  const [draftGeminiKey, setDraftGeminiKey] = useState(settings.geminiApiKey);
  const [draftGroqKey, setDraftGroqKey] = useState(settings.groqApiKey || '');
  const [draftOpenRouterKey, setDraftOpenRouterKey] = useState(settings.openRouterApiKey || '');
  const [draftDeepSeekKey, setDraftDeepSeekKey] = useState(settings.deepSeekApiKey || '');

  const [testing, setTesting] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [testingGroq, setTestingGroq] = useState(false);
  const [testingOpenRouter, setTestingOpenRouter] = useState(false);
  const [testingDeepSeek, setTestingDeepSeek] = useState(false);
  const [testingMic, setTestingMic] = useState(false);

  useEffect(() => {
    void useOllamaStore.getState().refresh();
  }, []);

  useEffect(() => {
    setDraftUrl(settings.ollamaBaseUrl);
    setDraftGeminiKey(settings.geminiApiKey);
    setDraftGroqKey(settings.groqApiKey || '');
    setDraftOpenRouterKey(settings.openRouterApiKey || '');
    setDraftDeepSeekKey(settings.deepSeekApiKey || '');
  }, [
    settings.ollamaBaseUrl,
    settings.geminiApiKey,
    settings.groqApiKey,
    settings.openRouterApiKey,
    settings.deepSeekApiKey,
  ]);

  const saveUrl = async () => {
    const url = draftUrl.trim().replace(/\/+$/, '') || 'http://localhost:11434';
    setTesting(true);
    await update({ ollamaBaseUrl: url });
    await refresh(true);
    const ok = useOllamaStore.getState().status === 'online';
    useToastStore.getState().push(
      ok ? 'success' : 'error',
      ok ? 'Connected to Ollama' : 'Could not reach Ollama at that URL',
      url,
    );
    setTesting(false);
  };

  const saveGeminiKey = async () => {
    const key = draftGeminiKey.trim();
    setTestingGemini(true);
    await update({ geminiApiKey: key });
    if (!key) {
      useToastStore.getState().push('info', 'Gemini key cleared', 'Local Ollama will be used.');
      setTestingGemini(false);
      return;
    }
    const res = await testGeminiApiKey(key);
    useToastStore.getState().push(
      res.ok ? 'success' : 'error',
      res.ok ? 'Google Gemini API Connected!' : 'Gemini Key Invalid',
      res.ok ? 'Gemini 3.7 Flash & 3.6 Flash are ready to use.' : res.error,
    );
    setTestingGemini(false);
  };

  const saveGroqKey = async () => {
    const key = draftGroqKey.trim();
    setTestingGroq(true);
    await update({ groqApiKey: key });
    if (!key) {
      useToastStore.getState().push('info', 'Groq key cleared', 'Switched off Groq.');
      setTestingGroq(false);
      return;
    }
    const { testOpenAICompatibleKey } = await import('@/lib/openai-compatible');
    const res = await testOpenAICompatibleKey('groq', key);
    useToastStore.getState().push(
      res.ok ? 'success' : 'error',
      res.ok ? 'Groq Cloud Connected! ⚡' : 'Groq Key Invalid',
      res.ok ? 'DeepSeek R1 70B & Qwen 2.5 32B are ready at ultra-fast speeds.' : res.error,
    );
    setTestingGroq(false);
  };

  const saveOpenRouterKey = async () => {
    const key = draftOpenRouterKey.trim();
    setTestingOpenRouter(true);
    await update({ openRouterApiKey: key });
    if (!key) {
      useToastStore.getState().push('info', 'OpenRouter key cleared', 'Switched off OpenRouter.');
      setTestingOpenRouter(false);
      return;
    }
    const { testOpenAICompatibleKey } = await import('@/lib/openai-compatible');
    const res = await testOpenAICompatibleKey('openrouter', key);
    useToastStore.getState().push(
      res.ok ? 'success' : 'error',
      res.ok ? 'OpenRouter Connected! 🌐' : 'OpenRouter Key Invalid',
      res.ok ? 'DeepSeek R1 & Qwen 72B free tier models are ready.' : res.error,
    );
    setTestingOpenRouter(false);
  };

  const saveDeepSeekKey = async () => {
    const key = draftDeepSeekKey.trim();
    setTestingDeepSeek(true);
    await update({ deepSeekApiKey: key });
    if (!key) {
      useToastStore.getState().push('info', 'DeepSeek key cleared', 'Switched off DeepSeek.');
      setTestingDeepSeek(false);
      return;
    }
    const { testOpenAICompatibleKey } = await import('@/lib/openai-compatible');
    const res = await testOpenAICompatibleKey('deepseek', key);
    useToastStore.getState().push(
      res.ok ? 'success' : 'error',
      res.ok ? 'DeepSeek Official API Connected! 🐋' : 'DeepSeek Key Invalid',
      res.ok ? 'DeepSeek R1 & DeepSeek V3 are ready.' : res.error,
    );
    setTestingDeepSeek(false);
  };

  const grantMicrophone = async () => {
    setTestingMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      useToastStore.getState().push(
        'success',
        'Microphone Permission Granted! 🎙️',
        'Voice dictation is now fully activated for the Zonaed AI side panel.',
      );
    } catch (err) {
      useToastStore.getState().push(
        'error',
        'Microphone Access Blocked',
        'Please allow microphone access when prompted by Chrome (or click the lock icon in the URL bar).',
      );
    } finally {
      setTestingMic(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Groq AI (Free DeepSeek R1 & Qwen 2.5) */}
      <section className="flex flex-col gap-3 rounded-2xl border bg-card/90 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md border-cyan-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500 font-extrabold text-sm">
              ⚡
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground font-sans">Groq Cloud AI (Free DeepSeek R1 &amp; Qwen 2.5)</h2>
              <span className="text-[11px] text-muted-foreground font-sans">500+ tokens/sec ultra-fast inference on DeepSeek 70B &amp; Qwen 32B</span>
            </div>
          </div>
          <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-500">
            Free &amp; Ultra-Fast
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Get a free API key instantly from{' '}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
            className="text-cyan-500 font-semibold underline hover:text-cyan-400"
          >
            console.groq.com/keys
          </a>
          .
        </p>
        <div className="flex gap-2">
          <Input
            type="password"
            value={draftGroqKey}
            onChange={(e) => setDraftGroqKey(e.target.value)}
            placeholder="gsk_..."
            className="text-xs font-mono"
          />
          <Button
            onClick={() => void saveGroqKey()}
            loading={testingGroq}
            className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-4"
          >
            Save &amp; Test
          </Button>
        </div>
      </section>

      {/* Google Gemini AI Card */}
      <section className="flex flex-col gap-3 rounded-2xl border bg-card/90 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground font-sans">Google Gemini Cloud AI</h2>
              <span className="text-[11px] text-muted-foreground font-sans">High-speed reasoning with Gemini 3.7 Flash</span>
            </div>
          </div>
          <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-500">
            Recommended
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Get a free API key instantly from{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-primary font-semibold underline hover:text-primary/80"
          >
            Google AI Studio
          </a>
          .
        </p>
        <div className="flex gap-2">
          <Input
            type="password"
            value={draftGeminiKey}
            onChange={(e) => setDraftGeminiKey(e.target.value)}
            placeholder="AIzaSy... or AQ.Ab8..."
            className="text-xs font-mono"
          />
          <Button
            onClick={() => void saveGeminiKey()}
            loading={testingGemini}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4"
          >
            Save &amp; Test
          </Button>
        </div>
      </section>

      {/* OpenRouter AI (Free DeepSeek R1 & Qwen 72B) */}
      <section className="flex flex-col gap-3 rounded-2xl border bg-card/90 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 font-extrabold text-sm">
              🌐
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground font-sans">OpenRouter Cloud (Free Tier Models)</h2>
              <span className="text-[11px] text-muted-foreground font-sans">Free access to DeepSeek R1 and Qwen 2.5 72B</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Get a free API key from{' '}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
            className="text-purple-500 font-semibold underline hover:text-purple-400"
          >
            openrouter.ai/keys
          </a>
          .
        </p>
        <div className="flex gap-2">
          <Input
            type="password"
            value={draftOpenRouterKey}
            onChange={(e) => setDraftOpenRouterKey(e.target.value)}
            placeholder="sk-or-v1-..."
            className="text-xs font-mono"
          />
          <Button
            onClick={() => void saveOpenRouterKey()}
            loading={testingOpenRouter}
            variant="outline"
            className="text-xs font-semibold px-4"
          >
            Save &amp; Test
          </Button>
        </div>
      </section>

      {/* Voice / Microphone Access Card */}
      <section className="flex flex-col gap-3 rounded-2xl border bg-card/90 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/10 text-pink-500">
              <Mic className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground font-sans">Voice Dictation &amp; Microphone Access</h2>
              <span className="text-[11px] text-muted-foreground font-sans">Enables 1-click speech-to-text typing in the side panel</span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => void grantMicrophone()}
            loading={testingMic}
            className="bg-pink-600 hover:bg-pink-500 text-white text-xs font-semibold gap-1.5"
          >
            <Mic className="h-3.5 w-3.5" />
            Grant / Test Mic Access
          </Button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Chrome requires permission on this page once. Once granted, speech recognition in the side panel will work automatically.
        </p>
      </section>

      {/* Language & Default Model in 2-column Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Language Selector Card */}
        <section className="flex flex-col gap-3 rounded-2xl border bg-card/90 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground font-sans">AI Response Language</h2>
              <span className="text-[11px] text-muted-foreground font-sans">বাংলা or English</span>
            </div>
          </div>
          <Select
            value={settings.language ?? 'en'}
            onChange={(e) => {
              const lang = e.target.value as 'en' | 'bn';
              void update({ language: lang });
              useToastStore.getState().push(
                'success',
                lang === 'bn' ? 'বাংলা ভাষা সক্রিয় করা হয়েছে 🇧🇩' : 'Language set to English 🇺🇸',
                lang === 'bn' ? 'AI এখন থেকে সম্পূর্ণ বাংলাদেশি বাংলায় উত্তর দেবে।' : 'AI will respond in English.',
              );
            }}
            className="text-xs font-medium"
          >
            <option value="en">🇺🇸 English (Default)</option>
            <option value="bn">🇧🇩 বাংলা - Bangla (Bangladesh)</option>
          </Select>
        </section>

        {/* Default Model Selector Card */}
        <section className="flex flex-col gap-3 rounded-2xl border bg-card/90 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground font-sans">Default AI Model</h2>
              <span className="text-[11px] text-muted-foreground font-sans">Active model for chats &amp; tools</span>
            </div>
          </div>
          <Select
            value={settings.lastModel ?? 'auto'}
            onChange={(e) => void update({ lastModel: e.target.value })}
            className="text-xs font-medium"
          >
            <optgroup label="🚀 Smart Quota &amp; Failover Router">
              <option value="auto">
                🚀 Auto (Smart Quota Router) · Zero Downtime
              </option>
            </optgroup>
            <optgroup label="✨ Google Gemini (Cloud · 1M Context)">
              {GEMINI_MODELS.map((gm) => (
                <option key={gm.id} value={gm.id}>
                  ✨ {gm.name} · {gm.badge}
                </option>
              ))}
            </optgroup>
            <optgroup label="⚡ Groq Cloud (Free Ultra-Fast)">
              {CLOUD_MODELS.filter((m) => m.provider === 'groq').map((m) => (
                <option key={m.id} value={m.id}>
                  ⚡ {m.name} · {m.badge}
                </option>
              ))}
            </optgroup>
            <optgroup label="🌐 OpenRouter (Free Tier Models)">
              {CLOUD_MODELS.filter((m) => m.provider === 'openrouter').map((m) => (
                <option key={m.id} value={m.id}>
                  🌐 {m.name} · {m.badge}
                </option>
              ))}
            </optgroup>
            <optgroup label="🐋 DeepSeek (Official API)">
              {CLOUD_MODELS.filter((m) => m.provider === 'deepseek').map((m) => (
                <option key={m.id} value={m.id}>
                  🐋 {m.name} · {m.badge}
                </option>
              ))}
            </optgroup>
            <optgroup label="🦙 Local Ollama (Offline)">
              {models.length === 0 ? (
                <option value="" disabled>
                  {status === 'online' ? 'No local models pulled' : 'Ollama offline'}
                </option>
              ) : (
                models.map((m) => (
                  <option key={m.name} value={m.name}>
                    🦙 {m.name}
                  </option>
                ))
              )}
            </optgroup>
          </Select>
        </section>
      </div>

      {/* Local Ollama Card */}
      <section className="flex flex-col gap-3 rounded-2xl border bg-card/90 backdrop-blur-md p-5 shadow-sm transition-all hover:shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground font-sans">Local Ollama Server (Private Offline)</h2>
              <span className="text-[11px] text-muted-foreground font-sans">Runs private open-weights models 100% on your PC</span>
            </div>
          </div>
          <span className={cn(
            'rounded-md px-2 py-0.5 text-[10px] font-bold',
            status === 'online' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
          )}>
            {status === 'online' ? '🟢 Online' : '⚪ Offline'}
          </span>
        </div>
        <div className="flex gap-2">
          <Input
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            placeholder="http://localhost:11434"
            className="text-xs font-mono"
          />
          <Button onClick={() => void saveUrl()} loading={testing} variant="outline" className="text-xs">
            Connect
          </Button>
        </div>
      </section>

      {/* Theme & Translate Language Consolidated Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <section className="flex flex-col gap-3 rounded-2xl border bg-card/90 backdrop-blur-md p-5 shadow-sm">
          <h2 className="text-sm font-bold text-foreground font-sans">Theme &amp; Appearance</h2>
          <Select
            value={settings.theme}
            onChange={(e) => {
              const theme = e.target.value as Settings['theme'];
              void update({ theme }).then(() => applyTheme(theme));
            }}
            className="text-xs font-medium"
          >
            <option value="system">Match system theme</option>
            <option value="light">Light Mode</option>
            <option value="dark">Dark Mode</option>
          </Select>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border bg-card/90 backdrop-blur-md p-5 shadow-sm">
          <h2 className="text-sm font-bold text-foreground font-sans">Translate Target Language</h2>
          <Select
            value={settings.translateTargetLang}
            onChange={(e) => void update({ translateTargetLang: e.target.value })}
            className="text-xs font-medium"
          >
            {TRANSLATE_TARGET_LANGS.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </Select>
        </section>
      </div>

      {/* Keyboard Shortcut Card */}
      <section className="flex items-center justify-between rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-cyan-500/10 p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-foreground font-sans">Global Keyboard Shortcut</h2>
            <span className="rounded-full bg-indigo-500/15 text-indigo-500 text-[10px] font-bold px-2 py-0.5 ring-1 ring-indigo-500/30">
              Instant Access
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 font-sans">
            Press anywhere in Chrome to open or toggle the Zonaed AI side panel.
          </p>
        </div>
        <kbd className="rounded-xl border border-indigo-500/30 bg-background/80 px-3 py-1.5 text-xs font-mono font-extrabold text-indigo-500 shadow-md">
          Ctrl + Shift + Z
        </kbd>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Saved prompts (foundation for Phase 2 social-writer templates)
 * ------------------------------------------------------------------------- */

function PromptsTab() {
  const [prompts, setPrompts] = useState<StoredPrompt[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    void listPrompts().then(setPrompts);
  }, []);

  const save = async () => {
    if (!title.trim() || !body.trim()) return;
    await upsertPrompt({
      title: title.trim(),
      body: body.trim(),
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setTitle('');
    setBody('');
    setPrompts(await listPrompts());
    useToastStore.getState().push('success', 'Prompt saved');
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-2xl border bg-card/90 backdrop-blur-md p-5 shadow-sm">
        <h2 className="text-sm font-bold text-foreground">New Prompt Template</h2>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. LinkedIn Viral Post, Cold Pitch Hook)"
          className="text-xs"
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Prompt body — write reusable instructions and framework here…"
          rows={4}
          className="text-xs"
        />
        <Button className="self-start bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold" onClick={() => void save()}>
          <Sparkles className="h-3.5 w-3.5 mr-1" /> Save Prompt
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-foreground">Saved Prompt Templates ({prompts.length})</h2>
        {prompts.length === 0 ? (
          <p className="text-xs text-muted-foreground rounded-2xl border border-dashed p-6 text-center">
            No prompts saved yet. Create a reusable template above!
          </p>
        ) : (
          prompts.map((p) => (
            <div key={p.id} className="flex items-start gap-3 rounded-2xl border bg-card/90 backdrop-blur-md p-4 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground">{p.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground leading-relaxed">{p.body}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  if (p.id === undefined) return;
                  await deletePrompt(p.id);
                  setPrompts(await listPrompts());
                }}
                aria-label={`Delete ${p.title}`}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function ProfileEditor({ onSaved }: { onSaved: (profiles: StoredProfile[]) => void }) {
  const [name, setName] = useState('');
  const [fields, setFields] = useState<ProfileField[]>([
    { key: 'name', value: '' },
    { key: 'email', value: '' },
    { key: 'phone', value: '' },
  ]);

  const addField = () => {
    setFields([...fields, { key: '', value: '' }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, patch: Partial<ProfileField>) => {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const save = async () => {
    if (!name.trim()) {
      useToastStore.getState().push('error', 'Profile name required');
      return;
    }
    const cleanFields = fields
      .map((f) => ({ key: f.key.trim(), value: f.value.trim() }))
      .filter((f) => f.key.length > 0);

    if (cleanFields.length === 0) {
      useToastStore.getState().push('error', 'At least one field with a key is required');
      return;
    }

    await upsertProfile({
      name: name.trim(),
      fields: cleanFields,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    setName('');
    setFields([
      { key: 'name', value: '' },
      { key: 'email', value: '' },
      { key: 'phone', value: '' },
    ]);
    const updated = await listProfiles();
    onSaved(updated);
    useToastStore.getState().push('success', 'Profile saved');
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card/90 backdrop-blur-md p-5 shadow-sm">
      <h2 className="text-sm font-bold text-foreground">Create Autofill Profile</h2>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Profile name (e.g. Personal, Business, Client Agency)"
        className="text-xs"
      />
      <div className="flex flex-col gap-2 pt-1">
        <label className="text-xs font-medium text-muted-foreground">Field Mappings (Key → Value)</label>
        {fields.map((field, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              value={field.key}
              onChange={(e) => updateField(idx, { key: e.target.value })}
              placeholder="Key (e.g. email, phone, city)"
              className="w-1/3 text-xs"
            />
            <Input
              value={field.value}
              onChange={(e) => updateField(idx, { value: e.target.value })}
              placeholder="Value to fill"
              className="flex-1 text-xs"
            />
            <Button
              variant="ghost"
              size="icon"
              disabled={fields.length <= 1}
              onClick={() => removeField(idx)}
              aria-label="Remove field"
              className="h-8 w-8"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={addField} type="button" className="text-xs">
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Field
          </Button>
          <Button size="sm" onClick={() => void save()} type="button" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
            <User className="mr-1 h-3.5 w-3.5" /> Save Profile
          </Button>
        </div>
      </div>
    </section>
  );
}

function ProfilesTab() {
  const [profiles, setProfiles] = useState<StoredProfile[]>([]);

  useEffect(() => {
    void listProfiles().then(setProfiles);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <ProfileEditor onSaved={setProfiles} />
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-foreground">Saved Profiles ({profiles.length})</h2>
        {profiles.length === 0 ? (
          <p className="text-xs text-muted-foreground rounded-2xl border border-dashed p-6 text-center">
            No profiles yet — create one above.
          </p>
        ) : (
          profiles.map((p) => (
            <div key={p.id} className="flex items-start gap-3 rounded-2xl border bg-card/90 backdrop-blur-md p-4 shadow-sm">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground">{p.name}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {p.fields.map((f) => f.key).join(', ')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                aria-label={`Delete profile ${p.name}`}
                onClick={() => {
                  if (p.id === undefined) return;
                  void deleteProfile(p.id).then(() => listProfiles().then(setProfiles));
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Permissions + Privacy
 * ------------------------------------------------------------------------- */

function PermissionsTab() {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex items-start gap-3.5 rounded-2xl border bg-card/90 backdrop-blur-md p-5 shadow-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
          <Shield className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-2.5">
          <h2 className="font-bold text-sm text-foreground">Minimal, On-Demand Access Security</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This extension requests <strong>no broad site access</strong>. It uses{' '}
            <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">activeTab</code>: page access is granted only when
            you invoke it (clicking the toolbar icon, using the shortcut, or a
            right-click menu) and lasts only for that active tab.
          </p>
          <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
            <li><strong>activeTab + scripting</strong> — read the current page / run actions on demand.</li>
            <li><strong>storage</strong> — settings + chat history stay on this device.</li>
            <li><strong>sidePanel</strong> — the primary chat &amp; agent assistant UI.</li>
            <li><strong>contextMenus</strong> — right-click summarize/rewrite/translate.</li>
            <li><strong>alarms / notifications</strong> — task heartbeats &amp; notifications.</li>
            <li><strong>tabs</strong> — metadata of tabs you explicitly attach to a chat; never page content.</li>
            <li><strong>localhost:11434</strong> — local offline Ollama endpoint.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function PrivacyTab() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState<string | null>(null);
  const toasts = useToastStore();

  const loadStats = async () => {
    setLoading(true);
    const s = await getStorageStats();
    setStats(s);
    setLoading(false);
  };

  useEffect(() => {
    void loadStats();
  }, []);

  const handleClearChats = async () => {
    if (!confirm('Are you sure you want to delete all chat history? This cannot be undone.')) return;
    setCleaning('chats');
    await clearAllChats();
    await loadStats();
    setCleaning(null);
    toasts.push('success', 'Chat History Cleared 🧹', 'All conversation transcripts were removed. Settings & memories remain safe.');
  };

  const handleClearLogs = async () => {
    setCleaning('logs');
    await clearScrapesAndLogs();
    await loadStats();
    setCleaning(null);
    toasts.push('success', 'Logs & Scraped Cache Cleared', 'Temporary logs and scrape data have been deleted.');
  };

  const handleFactoryReset = async () => {
    if (!confirm('⚠️ FACTORY RESET: This will erase all conversations, custom skills, and memories. Proceed?')) return;
    setCleaning('reset');
    await factoryResetAllData();
    await loadStats();
    setCleaning(null);
    toasts.push('info', 'Factory Reset Complete', 'All extension data has been reset to default state.');
  };

  return (
    <div className="flex flex-col gap-6 text-sm">
      {/* Live SSD Storage Consumption Card */}
      <section className="flex flex-col gap-4 rounded-2xl border bg-card/90 backdrop-blur-md p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
              <HardDrive className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">SSD Storage &amp; Database Usage</h2>
              <span className="text-[11px] text-muted-foreground">Real-time local IndexedDB usage on your PC</span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void loadStats()} disabled={loading} className="h-8 gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>

        {stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="flex flex-col gap-1 rounded-xl border bg-muted/40 p-3">
              <span className="text-[11px] text-muted-foreground font-medium">Estimated SSD Used</span>
              <span className="text-base font-extrabold text-foreground">{formatBytes(stats.usedBytes)}</span>
              <span className="text-[10px] text-emerald-500 font-semibold">Ultra lightweight</span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border bg-muted/40 p-3">
              <span className="text-[11px] text-muted-foreground font-medium">Chat Sessions</span>
              <span className="text-base font-extrabold text-foreground">{stats.chatsCount} sessions</span>
              <span className="text-[10px] text-muted-foreground">{stats.messagesCount} total messages</span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border bg-muted/40 p-3">
              <span className="text-[11px] text-muted-foreground font-medium">Long-Term Memories</span>
              <span className="text-base font-extrabold text-indigo-500">{stats.memoriesCount} facts</span>
              <span className="text-[10px] text-muted-foreground">Auto-injected rules</span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border bg-muted/40 p-3">
              <span className="text-[11px] text-muted-foreground font-medium">Custom Skills</span>
              <span className="text-base font-extrabold text-purple-500">{stats.skillsCount} playbooks</span>
              <span className="text-[10px] text-muted-foreground">{stats.promptsCount} templates</span>
            </div>
          </div>
        ) : null}
      </section>

      {/* Junk / Cache Cleanup Tools */}
      <section className="flex flex-col gap-3 rounded-2xl border bg-card/90 backdrop-blur-md p-5 shadow-sm">
        <h2 className="text-sm font-bold text-foreground">Storage Optimization &amp; Cleaners</h2>
        <p className="text-xs text-muted-foreground">
          You can safely wipe old chat transcripts or clear cached logs anytime to reclaim space. Your API keys, settings, and persistent memory will never be touched unless you choose Factory Reset.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleClearChats()}
            loading={cleaning === 'chats'}
            className="text-xs border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear All Chat History
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleClearLogs()}
            loading={cleaning === 'logs'}
            className="text-xs gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Clear Scrape &amp; Task Cache
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleFactoryReset()}
            loading={cleaning === 'reset'}
            className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 sm:ml-auto"
          >
            Factory Reset Everything
          </Button>
        </div>
      </section>

      {/* Privacy Guarantee */}
      <section className="flex flex-col gap-3 rounded-2xl border bg-card/90 backdrop-blur-md p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-sm text-foreground">
          <Check className="h-4 w-4 text-emerald-500" /> Privacy &amp; Local Isolation Guarantee
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-xs text-muted-foreground leading-relaxed">
          <li>Chats, prompts, memories, and skills are stored 100% locally in your browser's private IndexedDB.</li>
          <li>No external tracking, telemetry, or third-party database sync is performed.</li>
          <li>Uninstalling the extension or clearing extension data automatically purges all records permanently.</li>
        </ul>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Memory Tab (Long-Term User Memory & Personalization)
 * ------------------------------------------------------------------------- */

function MemoryTab() {
  const [memories, setMemories] = useState<StoredMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftCategory, setDraftCategory] = useState<MemoryCategory>('preference');
  const [draftFact, setDraftFact] = useState('');
  const toasts = useToastStore();

  const reload = async () => {
    await ensureMemorySeeded();
    const rows = await listMemories();
    setMemories(rows);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleAdd = async () => {
    if (!draftFact.trim()) return;
    await upsertMemory({
      category: draftCategory,
      fact: draftFact.trim(),
      source: 'user-added',
      enabled: true,
    });
    setDraftFact('');
    await reload();
    toasts.push('success', 'Memory Saved', 'Zonaed AI will apply this knowledge across all future chats.');
  };

  const handleToggle = async (id: number, current: boolean) => {
    await toggleMemory(id, !current);
    await reload();
  };

  const handleDelete = async (id: number) => {
    await deleteMemory(id);
    await reload();
    toasts.push('info', 'Memory Removed', 'Memory fact has been deleted.');
  };

  const categoryBadges: Record<MemoryCategory, string> = {
    persona: 'bg-indigo-500/20 text-indigo-500',
    preference: 'bg-amber-500/20 text-amber-500',
    business: 'bg-emerald-500/20 text-emerald-500',
    rule: 'bg-red-500/20 text-red-500',
    general: 'bg-cyan-500/20 text-cyan-500',
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-indigo-500" />
          <h2 className="font-semibold text-sm">Add New Memory / Rule</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Teach Zonaed AI facts about your persona, writing style, business context, or strict constraints (e.g. "Never use em-dashes").
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
          <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-1">
            Category
            <Select
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.target.value as MemoryCategory)}
              className="text-xs"
            >
              <option value="persona">Persona / Bio</option>
              <option value="preference">Preference / Style</option>
              <option value="rule">Strict Rule / Constraint</option>
              <option value="business">Business / Audience</option>
              <option value="general">General Knowledge</option>
            </Select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-3">
            Knowledge / Fact
            <div className="flex gap-2">
              <Input
                value={draftFact}
                onChange={(e) => setDraftFact(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAdd();
                  }
                }}
                placeholder="e.g. Always write in natural, conversational English with zero AI buzzwords..."
                className="text-xs flex-1"
              />
              <Button
                size="sm"
                onClick={() => void handleAdd()}
                disabled={!draftFact.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1 text-xs px-3"
              >
                <Plus className="h-3.5 w-3.5" /> Save
              </Button>
            </div>
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Active Long-Term Memories ({memories.filter((m) => m.enabled).length})</h2>
          <span className="text-xs text-muted-foreground">Auto-injected before every request</span>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading memories…</p>
        ) : memories.length === 0 ? (
          <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-4 text-center">
            No memories stored yet. Add one above or tell the AI "Remember that..." during any chat!
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {memories.map((m) => (
              <div
                key={m.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 transition-all',
                  m.enabled ? 'bg-card' : 'bg-muted/30 opacity-60',
                )}
              >
                <button
                  onClick={() => m.id !== undefined && void handleToggle(m.id, m.enabled)}
                  className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  title={m.enabled ? 'Disable memory' : 'Enable memory'}
                >
                  {m.enabled ? (
                    <ToggleRight className="h-5 w-5 text-indigo-500" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded', categoryBadges[m.category])}>
                      {m.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {m.source === 'auto-learned' ? '🧠 Auto-Learned' : '👤 User Added'}
                    </span>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">{m.fact}</p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => m.id !== undefined && void handleDelete(m.id)}
                  title="Delete memory"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Skills Tab (Custom Modular Skills)
 * ------------------------------------------------------------------------- */

function SkillsTab() {
  const [skills, setSkills] = useState<StoredSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftTriggers, setDraftTriggers] = useState('');
  const [draftInstructions, setDraftInstructions] = useState('');
  const toasts = useToastStore();

  const reload = async () => {
    await ensureMemorySeeded();
    const rows = await listSkills();
    setSkills(rows);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleSaveSkill = async () => {
    if (!draftName.trim() || !draftInstructions.trim()) return;
    const triggers = draftTriggers
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    await upsertSkill({
      name: draftName.trim(),
      description: draftDesc.trim(),
      triggers,
      instructions: draftInstructions.trim(),
      enabled: true,
    });

    setIsCreating(false);
    setDraftName('');
    setDraftDesc('');
    setDraftTriggers('');
    setDraftInstructions('');
    await reload();
    toasts.push('success', 'Skill Saved', 'Your custom skill is ready and will auto-trigger on matching prompts.');
  };

  const handleToggle = async (id: number, current: boolean) => {
    await toggleSkill(id, !current);
    await reload();
  };

  const handleDelete = async (id: number) => {
    await deleteSkill(id);
    await reload();
    toasts.push('info', 'Skill Deleted', 'Skill removed from storage.');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-sm">Custom Skills &amp; Playbooks ({skills.filter((s) => s.enabled).length} active)</h2>
          <p className="text-xs text-muted-foreground">
            Modular playbooks auto-detected from keywords in your message or browser actions.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setIsCreating(!isCreating)}
          className="gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> {isCreating ? 'Cancel' : 'New Skill'}
        </Button>
      </div>

      {isCreating ? (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm animate-in fade-in duration-200">
          <h3 className="font-semibold text-xs text-foreground">Create Custom Modular Skill</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium">
              Skill Name
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. SEO Content Optimizer"
                className="text-xs"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Trigger Keywords (Comma separated)
              <Input
                value={draftTriggers}
                onChange={(e) => setDraftTriggers(e.target.value)}
                placeholder="e.g. seo, blog post, ranking, meta tags"
                className="text-xs"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs font-medium">
            Short Description
            <Input
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              placeholder="e.g. Analyzes keyword density and suggests search-intent improvements"
              className="text-xs"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium">
            System Instructions / Playbook
            <Textarea
              value={draftInstructions}
              onChange={(e) => setDraftInstructions(e.target.value)}
              placeholder="Provide exact rules, templates, and formatting instructions for this skill..."
              rows={4}
              className="text-xs font-mono text-[11px]"
            />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSaveSkill()}
              disabled={!draftName.trim() || !draftInstructions.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              Save Skill
            </Button>
          </div>
        </section>
      ) : null}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading skills…</p>
      ) : skills.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-4 text-center">
          No skills found. Create your first skill with the button above!
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {skills.map((s) => (
            <div
              key={s.id}
              className={cn(
                'flex flex-col gap-2 rounded-xl border p-4 transition-all shadow-sm',
                s.enabled ? 'bg-card' : 'bg-muted/30 opacity-60',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 font-bold text-xs">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs text-foreground">{s.name}</h3>
                    {s.description ? (
                      <p className="text-[11px] text-muted-foreground">{s.description}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => s.id !== undefined && void handleToggle(s.id, s.enabled)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title={s.enabled ? 'Disable skill' : 'Enable skill'}
                  >
                    {s.enabled ? (
                      <ToggleRight className="h-5 w-5 text-indigo-500" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => s.id !== undefined && void handleDelete(s.id)}
                    title="Delete skill"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {s.triggers && s.triggers.length > 0 ? (
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] text-muted-foreground font-medium">Triggers:</span>
                  {s.triggers.map((t) => (
                    <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground font-mono leading-relaxed max-h-28 overflow-y-auto">
                {s.instructions}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}