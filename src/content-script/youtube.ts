/**
 * YouTube On-Demand Extractor:
 * Extracts video title, creator, views, description, chapter markers,
 * and timed captions/transcripts from YouTube watch pages.
 */
import type { YouTubeChapter, YouTubeVideoData } from '@/shared/types';

export async function extractYouTubeVideoData(): Promise<YouTubeVideoData> {
  try {
    const url = location.href;
    const urlObj = new URL(url);

    // Extract Video ID
    let videoId = urlObj.searchParams.get('v') || '';
    if (!videoId && url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0]?.split('/')[0] || '';
    } else if (!videoId && url.includes('/embed/')) {
      videoId = url.split('/embed/')[1]?.split('?')[0] || '';
    }

    if (!videoId && !url.includes('youtube.com/')) {
      return {
        ok: false,
        error: 'Active tab is not a YouTube video page.',
      };
    }

    // 1. Extract Title
    const titleEl = document.querySelector<HTMLElement>(
      'h1.ytd-watch-metadata yt-formatted-string, #title h1, h1.title, #container > h1',
    );
    const title = titleEl?.textContent?.replace(/\s+/g, ' ').trim() || document.title.replace(' - YouTube', '').trim();

    // 2. Extract Author / Channel
    const authorEl = document.querySelector<HTMLElement>(
      'ytd-channel-name #text, #channel-name a, #owner-name a, ytd-video-owner-renderer a',
    );
    const author = authorEl?.textContent?.trim() || '';
    const channelUrl = authorEl?.getAttribute('href') ? `https://www.youtube.com${authorEl.getAttribute('href')}` : '';

    // 3. Extract Views & Date
    const viewsEl = document.querySelector<HTMLElement>(
      '#info-container #info span, #info-strings yt-formatted-string, ytd-watch-info-text #info span',
    );
    const views = viewsEl?.textContent?.trim() || '';

    // 4. Extract Description
    const descEl = document.querySelector<HTMLElement>(
      '#description-inline-expander, #description, ytd-text-inline-expander#description-inline-expander',
    );
    const description = (descEl?.innerText || descEl?.textContent || '').replace(/\s+/g, ' ').trim();

    // 5. Extract Chapters
    const chapters: YouTubeChapter[] = [];
    const chapterEls = document.querySelectorAll<HTMLElement>(
      'ytd-macro-markers-list-item-renderer, ytd-chapter-renderer',
    );
    chapterEls.forEach((ch) => {
      const time = ch.querySelector('#time, .macro-markers-time')?.textContent?.trim() || '';
      const chTitle = ch.querySelector('#details h4, #title')?.textContent?.trim() || '';
      if (time && chTitle) {
        chapters.push({ time, title: chTitle });
      }
    });

    // If no DOM chapter elements, parse timestamps from description (e.g. 01:23 Topic)
    if (chapters.length === 0 && description) {
      const timestampRegex = /(?:(\d{1,2}:\d{2}(?::\d{2})?))\s+[-–—]?\s*([^\n\r.]+)/g;
      let match: RegExpExecArray | null;
      while ((match = timestampRegex.exec(description)) !== null) {
        if (match[1] && match[2]) {
          chapters.push({ time: match[1].trim(), title: match[2].trim() });
        }
      }
    }

    // 6. Extract Transcript
    let transcript = '';

    // Check if transcript DOM panel is already open
    const transcriptSegments = document.querySelectorAll<HTMLElement>(
      'ytd-transcript-segment-renderer, ytd-transcript-search-panel-renderer [role="button"]',
    );
    if (transcriptSegments.length > 0) {
      const lines: string[] = [];
      transcriptSegments.forEach((seg) => {
        const timestamp = seg.querySelector('.segment-timestamp, .yt-core-attributed-string')?.textContent?.trim() || '';
        const text = seg.querySelector('.segment-text, .yt-core-attributed-string--link-inherit-color')?.textContent?.trim() || '';
        if (text) {
          lines.push(timestamp ? `[${timestamp}] ${text}` : text);
        }
      });
      transcript = lines.join(' ');
    }

    // If transcript not yet open, attempt to fetch captions XML directly if available from page scripts
    if (!transcript && videoId) {
      try {
        transcript = await tryFetchCaptions(videoId);
      } catch (err) {
        console.warn('Could not direct fetch captions:', err);
      }
    }

    // Fallback if no captions track found: synthesize rich context from chapters + description
    if (!transcript) {
      transcript = [
        `Video Title: ${title}`,
        `Creator: ${author}`,
        chapters.length > 0 ? `Chapters:\n${chapters.map((c) => `- ${c.time}: ${c.title}`).join('\n')}` : '',
        `Description Summary:\n${description.slice(0, 3000)}`,
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    return {
      ok: true,
      videoId,
      url,
      title,
      author,
      channelUrl,
      views,
      description: description.slice(0, 5000),
      chapters,
      transcript: transcript.slice(0, 50000),
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || 'Failed to extract YouTube video information.',
    };
  }
}

/** Attempt to parse timedtext captions from YouTube player data */
async function tryFetchCaptions(videoId: string): Promise<string> {
  try {
    // Probe page scripts for captionTracks
    const scriptElements = Array.from(document.querySelectorAll('script'));
    for (const script of scriptElements) {
      const content = script.textContent || '';
      if (content.includes('captionTracks') && content.includes('baseUrl')) {
        const match = content.match(/"captionTracks":\s*(\[.*?\])/);
        if (match && match[1]) {
          const tracks = JSON.parse(match[1]);
          const englishTrack = tracks.find((t: any) => t.languageCode === 'en' || t.languageCode?.startsWith('en')) || tracks[0];
          if (englishTrack?.baseUrl) {
            const res = await fetch(englishTrack.baseUrl);
            const xml = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'text/xml');
            const textNodes = Array.from(doc.querySelectorAll('text'));
            return textNodes.map((n) => n.textContent?.trim()).filter(Boolean).join(' ');
          }
        }
      }
    }
  } catch {}
  return '';
}
