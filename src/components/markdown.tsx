import { memo, useCallback, useState, type ReactElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';
import { copyToClipboard } from '@/lib/util';

/** Pull `{ language, text }` out of react-markdown's <pre><code> children. */
function extractCodeInfo(children: ReactNode): { language: string; text: string } {
  if (typeof children === 'string') return { language: '', text: children };
  if (Array.isArray(children) && children.length === 1) {
    return extractCodeInfo(children[0]);
  }
  const el = children as ReactElement<{ className?: string; children?: ReactNode }> | null;
  if (!el?.props) return { language: '', text: '' };
  const language = (el.props.className ?? '').match(/language-([\w-]+)/)?.[1] ?? '';
  const inner = el.props.children;
  return { language, text: inner == null ? '' : String(inner) };
}

interface CodeBlockProps {
  children: ReactNode;
  className?: string;
}

function CodeBlock({ children, className }: CodeBlockProps) {
  const { language, text } = extractCodeInfo(children);
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [text]);

  return (
    <div className="code-block group relative my-2 overflow-hidden rounded-lg border bg-muted/50">
      <div className="flex items-center justify-between border-b bg-muted/60 px-3 py-1 text-xs">
        <span className="font-mono text-muted-foreground">{language || 'code'}</span>
        <button
          onClick={onCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="scroll-area max-h-[420px] overflow-auto p-3 text-[13px] leading-relaxed">
        <code className={cn('font-mono', className)}>{text}</code>
      </pre>
    </div>
  );
}

function InlineCode({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <code
      className={cn(
        'rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground',
        className,
      )}
    >
      {children}
    </code>
  );
}

export interface MarkdownProps {
  content: string;
  /** Extra class on the streaming container so the caret can show. */
  streaming?: boolean;
}

/**
 * Markdown renderer for assistant messages. Memoized so token-by-token updates
 * (each 5-20ms during a stream) only re-render content, not the whole panel.
 */
export const Markdown = memo(function Markdown({ content, streaming }: MarkdownProps) {
  return (
    <div className={cn('markdown-body text-sm leading-relaxed', streaming && 'streaming-caret')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          code: ({ children, className }) => <InlineCode className={className}>{children}</InlineCode>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline underline-offset-2 hover:opacity-80"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="scroll-area my-2 max-w-full overflow-auto rounded border">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border bg-muted/60 px-2 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border-b border-border px-2 py-1">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});