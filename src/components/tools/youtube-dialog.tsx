import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Layers,
  MessageSquare,
  PlaySquare,
  RefreshCw,
  Send,
  Share2,
  Sparkles,
  Tv,
  Twitter,
  Youtube,
} from 'lucide-react';
import { useToolsStore } from '@/store/tools-store';
import { useToastStore } from '@/store/toast-store';
import { useChatStore } from '@/store/chat-store';
import { useSettingsStore } from '@/store/settings-store';
import {
  getActiveTab,
  findYouTubeTab,
  extractYouTubeDataFromTab,
} from '@/lib/chrome';
import { generateGeminiText } from '@/lib/gemini';
import { upsertPrompt } from '@/db/db';
import { Button } from '@/components/ui/button';
import {
  DialogRoot,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { YouTubeVideoData } from '@/shared/types';
import { cn } from '@/lib/cn';

type ContentTab = 'linkedin' | 'twitter' | 'carousel' | 'transcript';

export function YouTubeDialog() {
  const active = useToolsStore((s) => s.active);
  const close = useToolsStore((s) => s.close);
  const toasts = useToastStore();
  const sendToChat = useChatStore((s) => s.sendText);

  const [isYouTubeTab, setIsYouTubeTab] = useState(false);
  const [ytTabId, setYtTabId] = useState<number | undefined>(undefined);
  const [videoData, setVideoData] = useState<YouTubeVideoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [activeTab, setActiveTab] = useState<ContentTab>('linkedin');
  const [linkedinPost, setLinkedinPost] = useState('');
  const [twitterThread, setTwitterThread] = useState('');
  const [carouselSlides, setCarouselSlides] = useState<
    { slideNumber: number; title: string; bullets: string[]; designTip: string }[]
  >([]);
  const [carouselRaw, setCarouselRaw] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (active !== 'youtube') return;
    void detectYouTube();
  }, [active]);

  const detectYouTube = async () => {
    const activeTabObj = await getActiveTab().catch(() => undefined);
    if (
      activeTabObj?.id !== undefined &&
      (activeTabObj.url?.includes('youtube.com/watch') || activeTabObj.url?.includes('youtu.be/'))
    ) {
      setIsYouTubeTab(true);
      setYtTabId(activeTabObj.id);
      return;
    }

    const ytTab = await findYouTubeTab();
    if (ytTab && ytTab.id !== undefined) {
      setIsYouTubeTab(true);
      setYtTabId(ytTab.id);
    } else {
      setIsYouTubeTab(false);
      setYtTabId(undefined);
    }
  };

  const handleOpenYouTube = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      void chrome.tabs.create({ url: 'https://www.youtube.com' });
    }
  };

  const extractAndGenerate = async () => {
    if (!ytTabId) {
      toasts.push('info', 'YouTube Video Not Found', 'Open a YouTube video watch page in a tab first.');
      return;
    }

    setLoading(true);
    try {
      toasts.push('info', 'Extracting Video Intelligence...', 'Fetching transcript, chapters & metadata...');
      const extracted = await extractYouTubeDataFromTab(ytTabId);

      if (!extracted.ok || !extracted.title) {
        throw new Error(extracted.error || 'Could not parse YouTube video details.');
      }

      setVideoData(extracted);
      toasts.push('success', 'Video Extracted!', `"${extracted.title.slice(0, 40)}..."`);
      
      // Auto trigger generation
      await generateAllContent(extracted);
    } catch (err: any) {
      toasts.push('error', 'Extraction Failed', err?.message || 'Could not fetch video info.');
    } finally {
      setLoading(false);
    }
  };

  const generateAllContent = async (data: YouTubeVideoData) => {
    setGenerating(true);
    const geminiKey = useSettingsStore.getState().geminiApiKey;

    const sourceContext = `
Title: ${data.title}
Creator: ${data.author}
Chapters: ${(data.chapters || []).map((c) => `${c.time} - ${c.title}`).join(', ')}
Transcript/Summary:
${(data.transcript || data.description || '').slice(0, 15000)}
    `.trim();

    try {
      // 1. LinkedIn Viral Post Prompt
      const linkedinPrompt = `You are a top 1% LinkedIn creator and digital marketing authority.
Transform the following YouTube video insights into a high-engagement, viral LinkedIn post:

${sourceContext}

Guidelines:
- Start with a powerful 1-2 sentence hook (Pattern interrupt).
- Zero fluff, zero AI clichés (never use: "delve", "testament", "tapestry", "embark", "game-changer").
- Break down the 3-4 key actionable takeaways with clean spacing.
- Include a high-converting question or CTA at the end.
- Add 3-4 relevant hashtags.
- Return ONLY the final formatted post without surrounding quotes.`;

      // 2. Twitter / X Thread Prompt
      const twitterPrompt = `You are a viral X (Twitter) ghostwriter.
Transform this YouTube video into a 5-6 tweet viral thread:

${sourceContext}

Guidelines:
- Tweet 1: Killer hook that makes scrolling impossible + "Here's the breakdown 🧵👇"
- Tweets 2-5: Core actionable frameworks and punchy lessons.
- Final Tweet: Quick summary + CTA to follow & repost.
- Number each tweet clearly (e.g. 1/6, 2/6...).
- Return ONLY the thread text.`;

      // 3. 5-Slide Carousel Blueprint Prompt
      const carouselPrompt = `You are a visual design strategist for LinkedIn & Instagram PDF carousels.
Create a high-retention 5-slide carousel blueprint based on this video:

${sourceContext}

Format as slide by slide:
[SLIDE 1: COVER HOOK]
Title: ...
Subtitle: ...

[SLIDE 2: THE PROBLEM / MISTAKE]
Headline: ...
Bullets: ...

[SLIDE 3: THE CORE FRAMEWORK]
Headline: ...
Key Concept: ...

[SLIDE 4: STEP-BY-STEP EXECUTION]
Headline: ...
Action Items: ...

[SLIDE 5: SUMMARY & CTA]
Key Takeaway: ...
CTA: Save this post & follow for more.`;

      if (geminiKey) {
        const [liRes, twRes, carRes] = await Promise.all([
          generateGeminiText(geminiKey, linkedinPrompt, 'gemini-2.5-flash').catch(() => ''),
          generateGeminiText(geminiKey, twitterPrompt, 'gemini-2.5-flash').catch(() => ''),
          generateGeminiText(geminiKey, carouselPrompt, 'gemini-2.5-flash').catch(() => ''),
        ]);

        if (liRes.trim()) setLinkedinPost(liRes.trim());
        if (twRes.trim()) setTwitterThread(twRes.trim());
        if (carRes.trim()) setCarouselRaw(carRes.trim());
      } else {
        // Fallback default template
        setLinkedinPost(`🚀 Key takeaways from: ${data.title}\n\nBy ${data.author}\n\n1. Strategy Breakdown\n2. Actionable Takeaway\n3. High-ROI Execution\n\nWhat are your thoughts on this?`);
        setTwitterThread(`1/4 Here is what you need to know about ${data.title} 🧵👇\n\n2/4 Core lesson...\n\n3/4 Execution step...\n\n4/4 If you found this valuable, follow & repost!`);
        setCarouselRaw(`[SLIDE 1: HOOK]\n${data.title}\n\n[SLIDE 2: THE BREAKTHROUGH]\nKey concepts by ${data.author}\n\n[SLIDE 3: EXECUTION]\nStep-by-step checklist\n\n[SLIDE 4: PRO TIPS]\nHigh-impact results\n\n[SLIDE 5: CTA]\nSave for later!`);
      }

      toasts.push('success', 'Viral Content Ready! ✨', 'LinkedIn post, Twitter thread & Carousel generated.');
    } catch (err: any) {
      toasts.push('error', 'Generation Failed', err?.message || 'Error creating content.');
    } finally {
      setGenerating(false);
    }
  };

  const copyContent = (text: string, type: string) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopied(type);
    toasts.push('success', 'Copied to Clipboard! 📋', `${type} ready to paste.`);
    setTimeout(() => setCopied(null), 2000);
  };

  const saveToSavedPrompts = async (title: string, body: string) => {
    if (!body) return;
    await upsertPrompt({
      title: `YouTube: ${title.slice(0, 30)}`,
      body,
      tags: ['youtube', 'content-repurpose'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    toasts.push('success', 'Saved to Prompts Library 💾', 'Accessible anytime in Dashboard.');
  };

  return (
    <DialogRoot open={active === 'youtube'} onOpenChange={(isOpen: boolean) => (!isOpen ? close() : undefined)}>
      <DialogContent className="max-w-2xl max-h-[calc(100vh-2rem)] flex flex-col !p-0 !gap-0 overflow-hidden rounded-2xl border-rose-500/20 bg-background/95 backdrop-blur-2xl">
        {/* Header */}
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-border/50 bg-gradient-to-b from-rose-500/5 to-transparent">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 via-red-600 to-pink-500 text-white shadow-md shadow-rose-600/25">
                <Youtube className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2 font-sans">
                  YouTube to Viral Content Studio
                  <span className="rounded-full bg-rose-500/15 text-rose-500 text-[10px] font-bold px-2 py-0.5 ring-1 ring-rose-500/30">
                    AI Studio
                  </span>
                </DialogTitle>
                <DialogDescription className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                  1-Click Video Transcript $\rightarrow$ Viral LinkedIn Posts, Threads &amp; PDF Carousels
                </DialogDescription>
              </div>
            </div>

            {!isYouTubeTab ? (
              <button
                onClick={handleOpenYouTube}
                className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 rounded-lg transition-colors"
              >
                <ExternalLink className="h-3 w-3" /> Open YouTube
              </button>
            ) : (
              <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-lg">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inset-0 rounded-full bg-rose-400 opacity-75" />
                  <span className="relative rounded-full h-1.5 w-1.5 bg-rose-500" />
                </span>
                Video Detected
              </div>
            )}
          </div>

          {/* Video Metadata Spotlight */}
          {videoData ? (
            <div className="flex items-center justify-between gap-3 mt-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5 text-xs">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-foreground truncate text-xs">{videoData.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                  <span>Channel: <strong className="text-foreground/80">{videoData.author}</strong></span>
                  {videoData.chapters && videoData.chapters.length > 0 ? (
                    <span>· {videoData.chapters.length} Chapters</span>
                  ) : null}
                </p>
              </div>
              <Button
                size="sm"
                onClick={extractAndGenerate}
                disabled={generating || loading}
                className="h-7 text-[11px] bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold gap-1 shrink-0"
              >
                <RefreshCw className={cn('h-3 w-3', (generating || loading) && 'animate-spin')} />
                Re-Generate
              </Button>
            </div>
          ) : null}

          {/* Segmented Format Switcher */}
          <div className="flex items-center gap-1 p-0.5 mt-3 rounded-lg bg-muted/50 border border-border/50">
            <button
              onClick={() => setActiveTab('linkedin')}
              className={cn(
                'flex-1 py-1 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1',
                activeTab === 'linkedin'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Share2 className="h-3 w-3" /> LinkedIn Post
            </button>
            <button
              onClick={() => setActiveTab('twitter')}
              className={cn(
                'flex-1 py-1 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1',
                activeTab === 'twitter'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Twitter className="h-3 w-3" /> X (Twitter) Thread
            </button>
            <button
              onClick={() => setActiveTab('carousel')}
              className={cn(
                'flex-1 py-1 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1',
                activeTab === 'carousel'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Layers className="h-3 w-3" /> 5-Slide Carousel
            </button>
            <button
              onClick={() => setActiveTab('transcript')}
              className={cn(
                'flex-1 py-1 text-[11px] font-bold rounded-md transition-all flex items-center justify-center gap-1',
                activeTab === 'transcript'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <PlaySquare className="h-3 w-3" /> Transcript
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-y-auto scroll-area p-5 flex flex-col gap-4">
          {!videoData ? (
            <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed rounded-xl bg-muted/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 mb-3">
                <Youtube className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Turn Any YouTube Video into High-ROI Content</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
                Open any YouTube video in your browser, then click <strong>"Extract &amp; Repurpose"</strong> to generate viral LinkedIn posts, Twitter threads, and visual carousel slides.
              </p>
              {!isYouTubeTab ? (
                <Button
                  onClick={handleOpenYouTube}
                  size="sm"
                  className="mt-4 bg-rose-600 hover:bg-rose-500 text-white text-xs rounded-xl font-bold gap-1.5"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open YouTube
                </Button>
              ) : (
                <Button
                  onClick={extractAndGenerate}
                  size="sm"
                  disabled={loading}
                  className="mt-4 bg-rose-600 hover:bg-rose-500 text-white text-xs rounded-xl font-bold gap-1.5 shadow-md shadow-rose-600/25"
                >
                  <Sparkles className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                  {loading ? 'Analyzing Video...' : 'Extract & Repurpose Now'}
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Tab 1: LinkedIn */}
              {activeTab === 'linkedin' ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Share2 className="h-3.5 w-3.5 text-rose-500" /> Viral LinkedIn Post Draft
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyContent(linkedinPost, 'LinkedIn Post')}
                        className="h-7 text-[11px] rounded-lg gap-1"
                      >
                        {copied === 'LinkedIn Post' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        {copied === 'LinkedIn Post' ? 'Copied' : 'Copy Post'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void saveToSavedPrompts('LinkedIn Post', linkedinPost)}
                        className="h-7 text-[11px] rounded-lg gap-1"
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    rows={12}
                    value={linkedinPost}
                    onChange={(e) => setLinkedinPost(e.target.value)}
                    placeholder="Generating LinkedIn post..."
                    className="text-xs bg-muted/20 rounded-xl leading-relaxed font-sans"
                  />
                </div>
              ) : null}

              {/* Tab 2: Twitter Thread */}
              {activeTab === 'twitter' ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Twitter className="h-3.5 w-3.5 text-cyan-500" /> X (Twitter) Viral Thread (Numbered)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyContent(twitterThread, 'Twitter Thread')}
                        className="h-7 text-[11px] rounded-lg gap-1"
                      >
                        {copied === 'Twitter Thread' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        {copied === 'Twitter Thread' ? 'Copied' : 'Copy Thread'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void saveToSavedPrompts('X Thread', twitterThread)}
                        className="h-7 text-[11px] rounded-lg gap-1"
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    rows={12}
                    value={twitterThread}
                    onChange={(e) => setTwitterThread(e.target.value)}
                    placeholder="Generating Twitter thread..."
                    className="text-xs bg-muted/20 rounded-xl leading-relaxed font-sans"
                  />
                </div>
              ) : null}

              {/* Tab 3: Carousel */}
              {activeTab === 'carousel' ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-purple-500" /> 5-Slide Carousel Blueprint (PDF/Canva Ready)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyContent(carouselRaw, 'Carousel Script')}
                        className="h-7 text-[11px] rounded-lg gap-1"
                      >
                        {copied === 'Carousel Script' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        {copied === 'Carousel Script' ? 'Copied' : 'Copy Script'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void saveToSavedPrompts('Carousel Script', carouselRaw)}
                        className="h-7 text-[11px] rounded-lg gap-1"
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    rows={12}
                    value={carouselRaw}
                    onChange={(e) => setCarouselRaw(e.target.value)}
                    placeholder="Generating 5-slide visual carousel structure..."
                    className="text-xs bg-muted/20 rounded-xl leading-relaxed font-sans"
                  />
                </div>
              ) : null}

              {/* Tab 4: Transcript & Chapters */}
              {activeTab === 'transcript' ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <PlaySquare className="h-3.5 w-3.5 text-rose-500" /> Video Chapters &amp; Extracted Transcript
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyContent(videoData.transcript || '', 'Transcript')}
                      className="h-7 text-[11px] rounded-lg gap-1"
                    >
                      <Copy className="h-3 w-3" /> Copy Raw
                    </Button>
                  </div>
                  {videoData.chapters && videoData.chapters.length > 0 ? (
                    <div className="flex flex-col gap-1 rounded-xl border bg-card p-3 text-xs">
                      <span className="font-bold text-[11px] text-muted-foreground uppercase">Video Chapters</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                        {videoData.chapters.map((c, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px] text-foreground">
                            <span className="font-mono text-rose-500 font-bold">{c.time}</span>
                            <span className="truncate">{c.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <Textarea
                    rows={8}
                    readOnly
                    value={videoData.transcript || videoData.description || 'No transcript available.'}
                    className="text-xs bg-muted/20 rounded-xl leading-relaxed font-mono text-[11px]"
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
