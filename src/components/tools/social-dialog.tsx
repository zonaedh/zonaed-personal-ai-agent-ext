import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { readActiveTabPage } from '@/lib/chrome';
import { buildSocialPrompt, PLATFORM_LABELS, type SocialInput, type SocialLength, type SocialPlatform, type SocialTone } from '@/lib/social';
import { useChatStore } from '@/store/chat-store';
import { useToastStore } from '@/store/toast-store';
import { useToolsStore } from '@/store/tools-store';
import { ToolDialog } from '@/components/tools/tool-dialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/input';

/**
 * Social post writer (Phase 2) — template-driven: platform, tone, length and
 * hashtags are explicit structured inputs (not an open-ended "write a post").
 */
export function SocialDialog() {
  const open = useToolsStore((s) => s.active) === 'social';
  const close = useToolsStore((s) => s.close);

  const [input, setInput] = useState<SocialInput>({
    platform: 'linkedin',
    topic: '',
    tone: 'professional',
    length: 'medium',
    hashtags: true,
  });
  const [usePage, setUsePage] = useState(false);

  const generate = async () => {
    const chat = useChatStore.getState();
    if (usePage) {
      const page = await readActiveTabPage();
      if (page.ok) {
        await chat.addContextSlot({
          kind: 'page',
          label: page.title ?? 'Current tab',
          content: page.text ?? '',
          url: page.url,
          addedAt: Date.now(),
        });
      } else {
        useToastStore
          .getState()
          .push('error', 'Couldn’t attach the page', page.needsActivation
            ? 'Click the extension icon once to grant this tab access, then retry.'
            : page.error ?? 'Unknown error.');
      }
    }
    await chat.sendText(buildSocialPrompt(input));
    useToastStore.getState().push('info', 'Generating…', `Drafting your ${PLATFORM_LABELS[input.platform]} post.`);
    close();
  };

  return (
    <ToolDialog
      open={open}
      onClose={close}
      title="Social post writer"
      description="Structured template: pick platform, tone and length — the draft streams into the chat."
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Platform
            <Select
              value={input.platform}
              onChange={(e) => setInput({ ...input, platform: e.target.value as SocialPlatform })}
            >
              {(Object.keys(PLATFORM_LABELS) as SocialPlatform[]).map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABELS[p]}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Tone
            <Select
              value={input.tone}
              onChange={(e) => setInput({ ...input, tone: e.target.value as SocialTone })}
            >
              {['professional', 'friendly', 'bold', 'insightful', 'humorous'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Length
            <Select
              value={input.length}
              onChange={(e) => setInput({ ...input, length: e.target.value as SocialLength })}
            >
              {['short', 'medium', 'long'].map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </label>
          <label className="mt-5 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={input.hashtags}
              onChange={(e) => setInput({ ...input, hashtags: e.target.checked })}
            />
            Include hashtags
          </label>
        </div>

        <Textarea
          value={input.topic}
          onChange={(e) => setInput({ ...input, topic: e.target.value })}
          rows={3}
          placeholder="What is the post about? e.g. 'We just shipped an offline AI browser extension'"
        />

        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={usePage} onChange={(e) => setUsePage(e.target.checked)} />
          Also attach the current page as context
        </label>

        <Button onClick={() => void generate()} disabled={!input.topic.trim()} className="self-end">
          <Sparkles className="h-4 w-4" /> Generate in chat
        </Button>
      </div>
    </ToolDialog>
  );
}