import { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, ShieldCheck, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { verifyServerPin } from '@/lib/server-proxy';
import { useSettingsStore } from '@/store/settings-store';
import { useToastStore } from '@/store/toast-store';

interface PinGateProps {
  onUnlocked: () => void;
}

export function PinGate({ onUnlocked }: PinGateProps) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { serverProxyUrl, masterPin, pinSessionToken, update } = useSettingsStore();

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
      typeof window !== 'undefined' && window.location.origin.includes('vercel.app')
        ? `${window.location.origin}/api`
        : serverProxyUrl || 'https://agent.thesharkweb.com/api';

    // Strategy 1: If local masterPin is configured and matches
    if (masterPin && cleanPin === masterPin) {
      setLoading(false);
      useToastStore.getState().push('success', 'Unlocked 🔓', 'Welcome back, Zonaed.');
      onUnlocked();
      return;
    }

    // Strategy 2: Authenticate with Vercel Server Proxy
    if (effectiveProxyUrl) {
      const res = await verifyServerPin(effectiveProxyUrl, cleanPin);
      if (res.ok && res.token) {
        await update({ pinSessionToken: res.token, isLocked: false });
        setLoading(false);
        useToastStore.getState().push('success', 'Authenticated 🛡️', 'Secure Vercel proxy connected.');
        onUnlocked();
        return;
      }
    }

    // Strategy 3: Fallback default PIN '1234' if not set
    if (!masterPin && cleanPin === '1234') {
      setLoading(false);
      onUnlocked();
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
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gradient-to-b from-background via-background/95 to-card p-6 text-foreground">
      <div className={`flex w-full max-w-xs flex-col items-center gap-6 rounded-3xl border border-border/70 bg-card/60 p-6 shadow-2xl backdrop-blur-xl transition-transform ${isShaking ? 'animate-shake' : ''}`}>
        {/* Header Icon */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-cyan-500/20 ring-1 ring-white/15">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30">
            <Lock className="h-5 w-5" />
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">
            <ShieldCheck className="h-3.5 w-3.5" />
          </span>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-base font-bold tracking-tight text-foreground font-sans">
            Zonaed AI Security Lock
          </h1>
          <p className="mt-1 text-xs text-muted-foreground font-sans">
            Enter your Master PIN to unlock your personal browser agent.
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
          className="flex cursor-pointer items-center justify-center gap-2.5 py-2"
        >
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className={`h-3 w-3 rounded-full transition-all duration-200 ${
                pin.length > idx
                  ? 'scale-110 bg-gradient-to-tr from-indigo-500 to-cyan-400 shadow-sm shadow-indigo-500/50 ring-2 ring-indigo-400/40'
                  : 'bg-muted-foreground/20 ring-1 ring-border/40'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        {error ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Numeric On-screen Keypad */}
        <div className="grid w-full grid-cols-3 gap-2.5 pt-1">
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
              className="flex h-11 items-center justify-center rounded-xl border border-border/50 bg-background/50 text-sm font-semibold text-foreground shadow-sm backdrop-blur-sm transition-all hover:bg-primary/10 hover:text-primary hover:border-primary/40 active:scale-95 disabled:opacity-50"
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
          className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 text-xs font-bold text-white shadow-md shadow-indigo-500/20"
        >
          {loading ? 'Verifying PIN…' : (
            <span className="flex items-center gap-1.5">
              Unlock Workspace <ArrowRight className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
