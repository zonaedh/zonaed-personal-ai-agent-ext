import { RefreshCw, ServerOff } from 'lucide-react';
import { useOllamaStore } from '@/store/ollama-store';
import { Button } from '@/components/ui/button';

/**
 * Graceful-failure state: shown whenever Ollama can't be reached. No silent
 * hangs or raw fetch errors — just clear next steps + a retry button (§3).
 */
export function OllamaOffline() {
  const refresh = useOllamaStore((s) => s.refresh);
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ServerOff className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold">Start Ollama to continue</h2>
        <p className="text-sm text-muted-foreground">
          This extension is powered entirely by a local Ollama instance.
        </p>
        <ol className="w-full space-y-1.5 rounded-lg border bg-muted/30 p-3 text-left text-xs text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">1.</span> Install &amp; open the{' '}
            <span className="font-mono">Ollama</span> desktop app (ollama.com)
          </li>
          <li>
            <span className="font-medium text-foreground">2.</span> Pull a model, e.g.{' '}
            <code className="rounded bg-muted px-1 font-mono">ollama pull llama3.1</code>
          </li>
          <li>
            <span className="font-medium text-foreground">3.</span> Hit retry below
          </li>
        </ol>
        <Button onClick={() => void refresh(true)}>
          <RefreshCw className="h-4 w-4" /> Retry connection
        </Button>
      </div>
    </div>
  );
}