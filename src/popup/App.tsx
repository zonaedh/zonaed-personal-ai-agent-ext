import { useEffect, useState } from 'react';
import { Loader2, PanelRightOpen, Send, Settings, Sparkles, Zap, Globe } from 'lucide-react';
import { sendToBackground } from '@/lib/chrome';
import { formatBytes } from '@/lib/util';
import { makeTask } from '@/lib/tasks';
import { GEMINI_MODELS, isGeminiModel } from '@/lib/gemini';
import { CLOUD_MODELS, isCloudModel } from '@/lib/openai-compatible';
import { useOllamaStore } from '@/store/ollama-store';
import { useSettingsStore } from '@/store/settings-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Toaster } from '@/components/ui/toaster';
import { openOptionsPage } from '@/lib/chrome';

/**
 * Popup = compact quick-launcher (status + fast chat entry), NOT a full chat
 * UI — MV3 popups cap at ~800x600 and can't host the real panel (spec §7).
 */
export function PopupApp() {
  const status = useOllamaStore((s) => s.status);
  const version = useOllamaStore((s) => s.version);
  const models = useOllamaStore((s) => s.models);
  const selectedModel = useOllamaStore((s) => s.selectedModel);
  const selectModel = useOllamaStore((s) => s.selectModel);
  const refresh = useOllamaStore((s) => s.refresh);
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey);
  const groqApiKey = useSettingsStore((s) => s.groqApiKey);
  const openRouterApiKey = useSettingsStore((s) => s.openRouterApiKey);
  const deepSeekApiKey = useSettingsStore((s) => s.deepSeekApiKey);
  const loadSettings = useSettingsStore((s) => s.load);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void loadSettings().then(() => useOllamaStore.getState().refresh(true));
  }, [loadSettings]);

  const openPanel = async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (tabId !== undefined) {
        await chrome.sidePanel.open({ tabId });
      } else {
        const win = await chrome.windows.getCurrent();
        if (win.id !== undefined) await chrome.sidePanel.open({ windowId: win.id });
      }
    } catch (err) {
      console.warn('Failed to open side panel directly:', err);
      await sendToBackground({ type: 'OPEN_SIDE_PANEL' });
    } finally {
      window.close();
    }
  };

  const quickSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;
      if (tabId !== undefined) {
        await chrome.sidePanel.open({ tabId }).catch(() => undefined);
      }
    } catch {
      // ignore
    }
    await sendToBackground({
      type: 'QUEUE_PENDING_TASK',
      task: makeTask('quick-chat', { text }),
    });
    window.close();
  };

  const isGeminiActive = isGeminiModel(selectedModel) || Boolean(geminiApiKey);
  const isCloudActive =
    isGeminiActive ||
    isCloudModel(selectedModel) ||
    Boolean(groqApiKey) ||
    Boolean(openRouterApiKey) ||
    Boolean(deepSeekApiKey);

  const groqModels = CLOUD_MODELS.filter((m) => m.provider === 'groq');
  const openRouterModels = CLOUD_MODELS.filter((m) => m.provider === 'openrouter');
  const deepseekModels = CLOUD_MODELS.filter((m) => m.provider === 'deepseek');

  const statusBadge = isGeminiModel(selectedModel) ? (
    <Badge variant="success">✨ Gemini 3.7 Flash</Badge>
  ) : isCloudModel(selectedModel) ? (
    <Badge variant="success">⚡ Cloud AI</Badge>
  ) : status === 'online' ? (
    <Badge variant="success">🦙 Ollama {version ? `v${version}` : 'connected'}</Badge>
  ) : status === 'checking' ? (
    <Badge variant="warning">Checking…</Badge>
  ) : (
    <Badge variant="secondary">Ollama offline</Badge>
  );

  const canChat = isCloudActive || status === 'online';

  return (
    <div className="flex flex-col gap-3 p-3.5 bg-card/90 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 text-xs font-black text-white shadow-sm shadow-indigo-500/20 ring-1 ring-white/20">
          Z
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xs font-bold tracking-tight gradient-text">
            Zonaed AI
          </h1>
          <p className="text-[10px] text-muted-foreground -mt-0.5">
            Personal Browser Agent
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 transition-transform hover:scale-105" onClick={() => void openOptionsPage()} title="Settings">
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        {statusBadge}
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {isCloudModel(selectedModel) || isGeminiModel(selectedModel) ? 'Cloud Fast' : `${models.length} local model${models.length === 1 ? '' : 's'}`}
        </Badge>
      </div>

      {canChat ? (
        <>
          <div>
            <label htmlFor="popup-model" className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Active Engine
            </label>
            <Select
              id="popup-model"
              value={selectedModel ?? 'auto'}
              onChange={(e) => void selectModel(e.target.value)}
              className="text-xs"
            >
              <optgroup label="🚀 Smart Quota &amp; Failover Router">
                <option value="auto">
                  🚀 Auto (Smart Quota Router) · Zero Downtime
                </option>
              </optgroup>
              <optgroup label="✨ Google Gemini (Cloud)">
                {GEMINI_MODELS.map((gm) => (
                  <option key={gm.id} value={gm.id}>
                    ✨ {gm.name} · {gm.badge}
                  </option>
                ))}
              </optgroup>
              <optgroup label="⚡ Groq Cloud (Free DeepSeek &amp; Qwen)">
                {groqModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    ⚡ {m.name} · {m.badge}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🌐 OpenRouter (Free Tier)">
                {openRouterModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    🌐 {m.name} · {m.badge}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🐋 DeepSeek (Official)">
                {deepseekModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    🐋 {m.name} · {m.badge}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🦙 Local Ollama (Offline)">
                {models.map((m) => (
                  <option key={m.name} value={m.name}>
                    🦙 {m.name} · {formatBytes(m.size) || '?'}
                  </option>
                ))}
              </optgroup>
            </Select>
          </div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void quickSend();
              }
            }}
            placeholder="Ask Zonaed AI anything… (Enter to send)"
            rows={3}
            className="text-xs transition-all focus:ring-1 focus:ring-indigo-500"
          />
          <div className="flex gap-2">
            <Button
              className="flex-1 h-8 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500 transition-all hover:scale-105"
              onClick={() => void quickSend()}
              disabled={!draft.trim() || sending}
            >
              {sending ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              Send
            </Button>
            <Button variant="outline" className="flex-1 h-8 text-xs transition-all hover:scale-105" onClick={openPanel}>
              <PanelRightOpen className="h-3.5 w-3.5" />
              Open panel
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p>
            {status === 'checking'
              ? 'Checking connection to the local Ollama server…'
              : 'Start the Ollama app or configure your Gemini API Key in settings.'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh(true)}>
              Retry Ollama
            </Button>
            <Button size="sm" onClick={() => void openOptionsPage()}>
              Open Settings
            </Button>
          </div>
        </div>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Shortcut: <kbd className="rounded bg-muted px-1 font-mono">Ctrl+Shift+Z</kbd> opens the panel
      </p>
      <Toaster />
    </div>
  );
}