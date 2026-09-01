import { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, ShieldCheck, AlertCircle, ArrowRight, ExternalLink, Globe, Sparkles, Cpu, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { verifyServerPin } from '@/lib/server-proxy';
import { useSettingsStore } from '@/store/settings-store';
import { useOllamaStore } from '@/store/ollama-store';
import { useToastStore } from '@/store/toast-store';
import { recordUserActivity } from '@/lib/auto-lock';

interface PinGateProps {
  onUnlocked: () => void;
}

export function PinGate({ onUnlocked }: PinGateProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [unlockedSuccess, setUnlockedSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { serverProxyUrl, masterPin, update } = useSettingsStore();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleUnlock = async (submittedPin = pin) => {
    const cleanPin = submittedPin.trim();
    if (!cleanPin) {
      setError('Please enter your PIN');
      return;
    }

    setLoading(true);
    setError('');

    // Determine the active API base (handles web portal origin or extension settings)
    const effectiveProxyUrl =
      typeof window !== 'undefined' &&
      window.location.origin.startsWith('http') &&
      !window.location.origin.startsWith('chrome-extension://')
        ? `${window.location.origin}/api`
        : serverProxyUrl || 'https://agent.thesharkweb.com/api';

    // Helper on successful authentication
    const triggerSuccess = async (modelToSelect: string, message: string) => {
      setUnlockedSuccess(true);
      recordUserActivity();
      await useOllamaStore.getState().selectModel(modelToSelect);
      useToastStore.getState().push('success', 'Unlocked 🔓', message);
      setTimeout(() => {
        setLoading(false);
        onUnlocked();
      }, 350);
    };

    // Strategy 1: If local masterPin is configured and matches
    if (masterPin && cleanPin === masterPin) {
      const selectedModel = useSettingsStore.getState().lastModel || 'groq:qwen/qwen3.8-27b';
      await triggerSuccess(selectedModel, 'Welcome back, Zonaed.');
      return;
    }

    // Strategy 2: Authenticate with Vercel Server Proxy
    if (effectiveProxyUrl) {
      const res = await verifyServerPin(effectiveProxyUrl, cleanPin);
      if (res.ok && res.token) {
        const defaultModel = res.defaultModel || 'groq:qwen/qwen3.8-27b';
        const modelToSelect = useSettingsStore.getState().lastModel || defaultModel;
        await update({
          pinSessionToken: res.token,
          isLocked: false,
          lastModel: modelToSelect,
        });
        await triggerSuccess(modelToSelect, 'Secure Vercel proxy & Groq LPUs connected.');
        return;
      }
    }

    // Strategy 3: Fallback default PIN '1234' or '301196'
    if ((!masterPin && cleanPin === '1234') || cleanPin === '301196') {
      const selectedModel = useSettingsStore.getState().lastModel || 'groq:qwen/qwen3.8-27b';
      await triggerSuccess(selectedModel, 'Workspace unlocked.');
      return;
    }

    // Failed
    setLoading(false);
    setIsShaking(true);
    setError('Invalid Master PIN. Please try again.');
    setPin('');
    setTimeout(() => setIsShaking(false), 500);
    inputRef.current?.focus();
  };

  const handleDigitPress = (digit: string) => {
    if (pin.length < 8) {
      const nextPin = pin + digit;
      setPin(nextPin);
      // Auto-unlock when reaching 6 digits
      if (nextPin.length === 6) {
        void handleUnlock(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  return (
    <div className="relative flex min-h-[100dvh] h-[100dvh] max-h-[100dvh] w-full flex-col items-center justify-between bg-gradient-to-b from-background via-background/95 to-card px-4 py-3 sm:py-6 overflow-y-auto overscroll-none text-foreground font-sans safe-top safe-bottom">
      {/* Ambient Futuristic Background Particles / Aura */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-72 w-72 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="absolute top-1/2 -right-32 h-80 w-80 rounded-full bg-purple-600/15 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>

      {/* Center Container for PIN Card (Perfect Middle Alignment on iOS/Android & Desktop) */}
      <div className="relative z-10 flex flex-1 w-full flex-col items-center justify-center my-auto py-2 sm:py-4">
        {/* Main Glassmorphism PIN Card */}
        <div
          className={`relative flex w-full max-w-[340px] sm:max-w-sm flex-col items-center gap-4 sm:gap-5 rounded-3xl border border-border/70 bg-card/65 p-5 sm:p-6 shadow-2xl backdrop-blur-2xl transition-all duration-300 ${
            isShaking ? 'animate-shake' : ''
          }`}
        >
        {/* Futuristic Animated Lock Core Container */}
        <div className="relative flex items-center justify-center my-1 select-none">
          {/* Outer Pulsing Radar Wave */}
          <div className="absolute h-24 w-24 rounded-full bg-indigo-500/20 animate-cyber-radar pointer-events-none" />

          {/* Holographic Outer Orbit Ring */}
          <div className="absolute h-24 w-24 rounded-full border border-dashed border-indigo-400/40 animate-cyber-orbit pointer-events-none">
            {/* Orbiting Particle Dot */}
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
          </div>

          {/* Holographic Inner Counter-Orbit Ring */}
          <div className="absolute h-20 w-20 rounded-full border border-dotted border-purple-400/50 animate-cyber-orbit-reverse pointer-events-none">
            {/* Counter-Orbiting Particle Dot */}
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
          </div>

          {/* Central Security Shield Capsule */}
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/30 via-purple-500/25 to-cyan-500/25 p-[1.5px] shadow-lg shadow-indigo-500/20 backdrop-blur-md animate-cyber-glow">
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[14px] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
              {/* Laser Scan Beam */}
              <div className="pointer-events-none absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-75 shadow-[0_0_8px_#38bdf8] animate-cyber-scan" />

              {/* Central Lock / Unlock Icon */}
              {unlockedSuccess ? (
                <Unlock className="h-7 w-7 text-emerald-400 transition-all duration-300 scale-110" />
              ) : (
                <Lock className="h-7 w-7 text-indigo-300 transition-all duration-300 hover:text-cyan-300" />
              )}
            </div>

            {/* Corner Cyber Accents */}
            <span className="absolute -top-0.5 -left-0.5 h-1.5 w-1.5 rounded-tl-sm border-t-2 border-l-2 border-cyan-400" />
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-tr-sm border-t-2 border-r-2 border-cyan-400" />
            <span className="absolute -bottom-0.5 -left-0.5 h-1.5 w-1.5 rounded-bl-sm border-b-2 border-l-2 border-cyan-400" />
            <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-br-sm border-b-2 border-r-2 border-cyan-400" />

            {/* Verified Security Badge */}
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white shadow-md shadow-emerald-500/40 ring-2 ring-background">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        {/* Title & Security Status */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-400">
            <Sparkles className="h-3 w-3 text-cyan-400" />
            <span>Zonaed AI Sentinel Guard</span>
          </div>
          <h1 className="text-base font-extrabold tracking-tight text-foreground sm:text-lg">
            Zonaed AI - Personal Assistant
          </h1>
          <p className="text-xs text-muted-foreground">
            Enter PIN to unlock your high-speed LPU AI workspace
          </p>
        </div>

        {/* Hidden Input for Keyboard & Autofocus */}
        <input
          ref={inputRef}
          type="password"
          maxLength={8}
          value={pin}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '');
            setPin(val);
            if (val.length === 6) {
              void handleUnlock(val);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleUnlock();
          }}
          className="sr-only"
          autoFocus
        />

        {/* PIN Dots Indicator (6 dots for 4-6 digit PINs) */}
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex cursor-pointer items-center justify-center gap-2.5 py-1"
          role="button"
          aria-label="Focus PIN Input"
        >
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className={`h-3 w-3 rounded-full transition-all duration-200 ${
                pin.length > idx
                  ? 'scale-110 bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 shadow-[0_0_10px_rgba(99,102,241,0.6)] ring-2 ring-indigo-400/50'
                  : 'bg-muted-foreground/20 ring-1 ring-border/40'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        {error ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive animate-fade-in">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Numeric On-screen Keypad */}
        <div className="grid w-full grid-cols-3 gap-2 pt-0.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
            <button
              key={k}
              type="button"
              disabled={loading}
              onClick={() => {
                if (k === 'C') {
                  setPin('');
                  setError('');
                } else if (k === '⌫') {
                  handleBackspace();
                } else {
                  handleDigitPress(k);
                }
              }}
              className="flex h-10 sm:h-11 items-center justify-center rounded-xl border border-border/50 bg-background/50 text-sm font-semibold text-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-primary/15 hover:text-primary hover:border-primary/40 active:scale-95 disabled:opacity-50"
            >
              {k}
            </button>
          ))}
        </div>

        {/* Direct submit button */}
        <Button
          type="button"
          disabled={loading || pin.length < 4}
          onClick={() => void handleUnlock()}
          className="w-full h-10 bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 hover:opacity-95 transition-all active:scale-[0.98]"
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 animate-spin" /> Verifying Security PIN…
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              Unlock Workspace <ArrowRight className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </div>
    </div>

      {/* Futuristic Responsive Footer Attribution & Links */}
      <footer className="relative z-10 mt-4 mb-1 flex flex-col items-center gap-2 text-center text-xs text-muted-foreground select-none">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 rounded-full border border-border/60 bg-card/60 px-3.5 py-1.5 shadow-sm backdrop-blur-md">
          {/* Creator Link */}
          <a
            href="https://www.zonaedhossain.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1 font-medium text-foreground hover:text-indigo-400 transition-colors"
          >
            <Globe className="h-3 w-3 text-indigo-400 group-hover:rotate-45 transition-transform" />
            <span>Zonaed Hossain</span>
            <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />
          </a>

          <span className="h-3 w-[1px] bg-border/80" />

          {/* Agency Link */}
          <a
            href="https://www.thesharkweb.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1 font-medium text-foreground hover:text-cyan-400 transition-colors"
          >
            <span className="text-cyan-400 font-bold">Agency</span>
            <span>TheSharkWeb</span>
            <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />
          </a>
        </div>

        <p className="text-[11px] text-muted-foreground/75 tracking-tight">
          Auto-locks after 10 minutes of inactivity for privacy.
        </p>
      </footer>
    </div>
  );
}
