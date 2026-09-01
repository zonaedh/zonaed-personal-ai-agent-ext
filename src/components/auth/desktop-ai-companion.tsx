import { useState, useEffect } from 'react';
import { Bot, Sparkles, Zap, Cpu, ShieldCheck, Activity, Terminal, Flame, Database, Globe, Play, Workflow } from 'lucide-react';

interface SimulatedTask {
  id: string;
  icon: typeof Zap;
  title: string;
  category: string;
  status: 'executing' | 'optimized' | 'streaming';
  metric: string;
  detail: string;
}

const AUTOMATION_TASKS: SimulatedTask[] = [
  {
    id: 'lpu-stream',
    icon: Flame,
    title: 'Ultra-Fast LPU Inference Engine',
    category: 'Groq Hardware Acceleration',
    status: 'streaming',
    metric: '520+ t/s',
    detail: 'Streaming neural tokens with sub-20ms first-token latency.',
  },
  {
    id: 'spy-analyst',
    icon: Globe,
    title: 'Autonomous Competitor Spy & Funnel Deconstruction',
    category: 'Market Intelligence',
    status: 'executing',
    metric: '98.4% Accuracy',
    detail: 'Reverse-engineering ad copy angles, hooks & pricing psychology.',
  },
  {
    id: 'sheets-sync',
    icon: Database,
    title: '1-Click Multi-Tab Google Sheets Data Pipe',
    category: 'DOM Extraction & TSV',
    status: 'optimized',
    metric: 'Instant Sync',
    detail: 'Synthesizing markdown tables to real-time grid cell structures.',
  },
  {
    id: 'bangla-nlp',
    icon: Sparkles,
    title: 'Bilingual Bengali & English Copywriting Engine',
    category: 'Neural Translation & Tone',
    status: 'streaming',
    metric: 'Native Tone',
    detail: 'Injecting few-shot memory banks and dynamic output styles.',
  },
];

export function DesktopAiCompanion() {
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const [visorScanPos, setVisorScanPos] = useState(0);
  const [livePulse, setLivePulse] = useState(true);

  // Cycle through automation tasks every 3.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTaskIndex((prev) => (prev + 1) % AUTOMATION_TASKS.length);
    }, 3600);
    return () => clearInterval(timer);
  }, []);

  // Eye visor micro-scanning animation
  useEffect(() => {
    const visorTimer = setInterval(() => {
      setVisorScanPos((pos) => (pos === 0 ? 1 : 0));
    }, 1800);
    return () => clearInterval(visorTimer);
  }, []);

  // Pulse toggle for telemetry
  useEffect(() => {
    const pulseTimer = setInterval(() => {
      setLivePulse((p) => !p);
    }, 1200);
    return () => clearInterval(pulseTimer);
  }, []);

  const currentTask = AUTOMATION_TASKS[activeTaskIndex]!;
  const TaskIcon = currentTask.icon;

  return (
    <div className="hidden lg:flex flex-col items-center justify-between w-full max-w-[420px] xl:max-w-[460px] rounded-3xl border border-indigo-500/30 bg-card/60 p-6 xl:p-7 shadow-2xl backdrop-blur-2xl transition-all duration-500 hover:border-indigo-500/50 select-none overflow-hidden relative group">
      {/* Ambient background glow inside companion box */}
      <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl group-hover:bg-cyan-500/20 transition-all duration-700" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-purple-500/15 blur-3xl group-hover:bg-purple-500/25 transition-all duration-700" />

      {/* Top Header & Status Telemetry */}
      <div className="w-full flex items-center justify-between border-b border-border/50 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 text-white shadow-md shadow-indigo-500/30">
            <Bot className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-extrabold text-foreground font-sans tracking-tight">
                Zonaed Autonomous Sentinel
              </h2>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              AI Task Orchestrator &bull; v2.4
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 font-mono">
          <Activity className="h-3 w-3 animate-pulse" />
          <span>AUTONOMOUS</span>
        </div>
      </div>

      {/* Center 3D-Style Animated Robot Avatar */}
      <div className="my-5 relative flex flex-col items-center justify-center">
        {/* Holographic Concentric Rings around Robot */}
        <div className="absolute h-44 w-44 rounded-full border border-dashed border-cyan-400/20 animate-cyber-orbit pointer-events-none" />
        <div className="absolute h-36 w-36 rounded-full border border-dotted border-purple-400/30 animate-cyber-orbit-reverse pointer-events-none" />
        <div className="absolute h-28 w-28 rounded-full bg-indigo-500/15 animate-cyber-radar pointer-events-none" />

        {/* Robot Head Body Container */}
        <div className="relative flex flex-col items-center animate-float">
          {/* Antenna & Beacon */}
          <div className="flex flex-col items-center">
            <span className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${livePulse ? 'bg-cyan-400 shadow-[0_0_12px_#22d3ee]' : 'bg-indigo-400 shadow-[0_0_8px_#818cf8]'}`} />
            <div className="h-3.5 w-[2px] bg-gradient-to-b from-cyan-400 to-indigo-600" />
          </div>

          {/* Robot Head Chassis */}
          <div className="relative flex h-24 w-32 flex-col items-center justify-between rounded-2xl border-2 border-indigo-400/40 bg-gradient-to-b from-slate-900 via-indigo-950/90 to-slate-950 p-2.5 shadow-[0_0_25px_rgba(99,102,241,0.35)] backdrop-blur-xl">
            {/* Ear Panels */}
            <span className="absolute -left-2.5 top-5 h-6 w-2 rounded-l-md border border-r-0 border-indigo-400/50 bg-indigo-900/80 shadow-[0_0_8px_rgba(99,102,241,0.4)]" />
            <span className="absolute -right-2.5 top-5 h-6 w-2 rounded-r-md border border-l-0 border-indigo-400/50 bg-indigo-900/80 shadow-[0_0_8px_rgba(99,102,241,0.4)]" />

            {/* Glowing Digital Visor Display */}
            <div className="relative flex h-11 w-full items-center justify-center overflow-hidden rounded-xl border border-cyan-400/50 bg-black/80 px-2 shadow-inner">
              {/* Visor Scanline grid */}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.08)_1px,transparent_1px)] bg-[size:100%_4px]" />

              {/* Expressive Visor Eyes */}
              <div className="flex items-center gap-4 transition-transform duration-500" style={{ transform: visorScanPos === 0 ? 'translateX(-2px)' : 'translateX(2px)' }}>
                {/* Left Eye */}
                <div className="relative flex h-4 w-7 items-center justify-center rounded-full bg-cyan-400 shadow-[0_0_12px_#06b6d4]">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </div>
                {/* Right Eye */}
                <div className="relative flex h-4 w-7 items-center justify-center rounded-full bg-cyan-400 shadow-[0_0_12px_#06b6d4]">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </div>
              </div>

              {/* Laser Scan Horizontal Beam */}
              <div className="pointer-events-none absolute left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent opacity-80 animate-cyber-scan" />
            </div>

            {/* Robot Mouth / Neural Waveform Spectrum */}
            <div className="flex items-center gap-1">
              {[0.4, 0.9, 0.6, 1.0, 0.7, 0.3, 0.8].map((h, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-indigo-400 transition-all duration-300"
                  style={{
                    height: `${Math.max(3, Math.round(h * (livePulse ? 8 : 12)))}px`,
                    opacity: 0.6 + h * 0.4,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Robot Neck & Chest Armor Badge */}
          <div className="flex flex-col items-center mt-1">
            <div className="h-2 w-10 rounded-sm bg-indigo-800/80 border-x border-indigo-400/40" />
            <div className="flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 px-3 py-1 shadow-md">
              <Cpu className="h-3 w-3 text-cyan-400 animate-spin-slow" />
              <span className="text-[10px] font-mono font-bold text-indigo-200">
                GROQ-LPU // ONLINE
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Automation Task Feed Card */}
      <div className="w-full flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/50 p-4 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-400">
              <TaskIcon className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 font-mono">
              {currentTask.category}
            </span>
          </div>

          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-300 font-mono">
            {currentTask.metric}
          </span>
        </div>

        <div className="space-y-1 pt-0.5">
          <h4 className="text-xs font-bold text-foreground leading-snug">
            {currentTask.title}
          </h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {currentTask.detail}
          </p>
        </div>

        {/* Dynamic Progress Indicator Bar */}
        <div className="w-full mt-1.5 flex items-center gap-2">
          <div className="relative flex-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
            <div
              key={currentTask.id}
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 animate-shimmer"
              style={{ width: '100%' }}
            />
          </div>
          <span className="text-[9px] font-mono text-muted-foreground/80">
            {activeTaskIndex + 1}/{AUTOMATION_TASKS.length}
          </span>
        </div>
      </div>

      {/* Capability Feature Pill Grid */}
      <div className="w-full grid grid-cols-2 gap-2 pt-3">
        <div className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-card/40 px-2.5 py-1.5 text-[11px] text-foreground font-medium shadow-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">Zero-Trust Sandbox</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-card/40 px-2.5 py-1.5 text-[11px] text-foreground font-medium shadow-xs">
          <Workflow className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
          <span className="truncate">DeepSeek R1 + Qwen</span>
        </div>
      </div>
    </div>
  );
}
