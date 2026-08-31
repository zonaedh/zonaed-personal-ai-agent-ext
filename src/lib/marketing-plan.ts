/**
 * Digital Marketing Manager skill & Marketing Plan generator for Zonaed AI.
 * Researches active websites, crawls key subpages, formulates comprehensive
 * action plans, and exports directly to Google Docs.
 */

import { readActiveTabPage, scrapeActiveTab } from '@/lib/chrome';
import { copyToClipboard } from '@/lib/util';

export type MarketingGoal =
  | 'leads'
  | 'ecommerce'
  | 'b2b_sales'
  | 'brand_awareness'
  | 'local_business'
  | 'app_growth';

export type MarketingBudget = 'bootstrapped' | 'growth' | 'scale';

export type MarketingFocus =
  | 'full_funnel'
  | 'social_media'
  | 'paid_ads'
  | 'email_retention';

export interface MarketingPlanConfig {
  goal: MarketingGoal;
  budget: MarketingBudget;
  focus: MarketingFocus;
  targetLocations?: string;
  additionalNotes?: string;
  crawlSubpages?: boolean;
}

export const GOAL_LABELS: Record<MarketingGoal, string> = {
  leads: 'Lead Generation & Booked Calls',
  ecommerce: 'Direct E-commerce Sales & Orders',
  b2b_sales: 'B2B Client Acquisition',
  brand_awareness: 'Brand Authority & Market Presence',
  local_business: 'Local Foot Traffic & Inquiries',
  app_growth: 'App Downloads & User Signups',
};

export const BUDGET_LABELS: Record<MarketingBudget, string> = {
  bootstrapped: 'Bootstrapped / Low Budget (Focus on Organic & High ROI)',
  growth: 'Growth SMB (Balanced Organic + Paid Ads)',
  scale: 'Scale / Aggressive (Multi-Channel Full Funnel)',
};

export const FOCUS_LABELS: Record<MarketingFocus, string> = {
  full_funnel: 'Full Funnel (SMM + Paid Ads + Content + Email)',
  social_media: 'Organic Social Media & Content Pillars',
  paid_ads: 'Paid Ads Heavy (Meta + Google Ads)',
  email_retention: 'Email Marketing & Retention Funnels',
};

/**
 * Discovers and fetches key subpages (About, Services, Pricing, Contact)
 * on the same origin to construct a complete website intelligence report.
 */
export async function researchWebsite(crawlSubpages = true): Promise<{
  mainPage: { title: string; url: string; text: string };
  subpages: Array<{ url: string; title: string; text: string }>;
}> {
  const main = await readActiveTabPage();
  if (!main.ok || !main.url) {
    throw new Error(main.error ?? 'Could not read the active website.');
  }

  const result = {
    mainPage: {
      title: main.title ?? 'Active Page',
      url: main.url,
      text: main.text ?? '',
    },
    subpages: [] as Array<{ url: string; title: string; text: string }>,
  };

  if (!crawlSubpages) return result;

  try {
    const scrape = await scrapeActiveTab();
    if (!scrape?.links) return result;

    const origin = new URL(main.url).origin;
    const keyPatterns = [
      /\/(about|about-us|company|story)/i,
      /\/(services|solutions|features|what-we-do)/i,
      /\/(pricing|plans|packages|rates)/i,
      /\/(contact|contact-us|get-in-touch)/i,
      /\/(products|store|shop)/i,
    ];

    const visitedUrls = new Set<string>([main.url]);
    const targetUrls: string[] = [];

    for (const link of scrape.links) {
      if (!link.href) continue;
      try {
        const parsed = new URL(link.href, origin);
        if (parsed.origin !== origin) continue;
        const normalized = parsed.origin + parsed.pathname;
        if (visitedUrls.has(normalized)) continue;

        if (keyPatterns.some((pattern) => pattern.test(parsed.pathname))) {
          visitedUrls.add(normalized);
          targetUrls.push(normalized);
          if (targetUrls.length >= 4) break;
        }
      } catch {
        // ignore invalid link
      }
    }

    // Fetch subpages with timeout
    const fetchPromises = targetUrls.map(async (url) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) return null;
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        // Clean boilerplate tags
        doc.querySelectorAll('script, style, svg, noscript, nav, footer, header').forEach((el) => el.remove());
        const rawText = (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (rawText.length < 50) return null;
        return {
          url,
          title: doc.title || url,
          text: rawText.slice(0, 6000),
        };
      } catch {
        return null;
      }
    });

    const subpageResults = await Promise.all(fetchPromises);
    result.subpages = subpageResults.filter((p): p is NonNullable<typeof p> => p !== null);
  } catch (err) {
    console.warn('Subpage research skipped:', err);
  }

  return result;
}

/**
 * Builds the Digital Marketing Manager prompt with strict natural-human tone rules.
 */
export function buildMarketingPlanPrompt(
  siteData: {
    mainPage: { title: string; url: string; text: string };
    subpages: Array<{ url: string; title: string; text: string }>;
  },
  config: MarketingPlanConfig,
): string {
  const subpagesText = siteData.subpages
    .map((s) => `--- SUBPAGE: ${s.title} (${s.url}) ---\n${s.text}`)
    .join('\n\n');

  return `You are an elite Digital Marketing Director acting as the dedicated Digital Marketing Manager for this business.

WEBSITE INFORMATION RESEARCH:
Primary Page: ${siteData.mainPage.title} (${siteData.mainPage.url})
Content:
${siteData.mainPage.text.slice(0, 8000)}

${subpagesText ? `ADDITIONAL DISCOVERED PAGES:\n${subpagesText}` : ''}

CAMPAIGN CONFIGURATION:
- Primary Goal: ${GOAL_LABELS[config.goal]}
- Budget & Resource Level: ${BUDGET_LABELS[config.budget]}
- Strategy Focus Area: ${FOCUS_LABELS[config.focus]}
${config.targetLocations ? `- Target Geographical Markets: ${config.targetLocations}` : ''}
${config.additionalNotes ? `- Specific Priorities: ${config.additionalNotes}` : ''}

WRITING STYLE AND TONE RULES (CRITICAL):
1. NO EM DASHES OR EN DASHES: Do NOT use em dashes (—) or en dashes (–) anywhere in your response. Use simple commas, periods, colons, or clean bullet points instead.
2. NATURAL HUMAN VOICE: Write like an experienced, practical marketing manager talking directly to the client or founder.
3. NO ROBOTIC AI CLICHÉS: Strictly avoid words like "delve", "testament", "tapestry", "embark", "furthermore", "moreover", "in conclusion", "beacon", "game-changer", "unleash", "skyrocket". Use clear, direct, conversational English.
4. ACTIONABLE & SPECIFIC: Provide real headline ideas, exact content pillar topics, ad copy hooks, and email subject lines tailored specifically to what this website sells.

FORMAT YOUR MARKETING PLAN WITH THESE SECTIONS:

# 🚀 Digital Marketing Strategy & Action Plan

## 1. Brand Overview & Value Proposition
- Mission and Core Offerings (what the business sells and the primary problem it solves)
- Target Audience Persona (who buys, their everyday pain points, and why they choose this brand)
- Key Selling Points (unique advantages over alternatives)

## 2. Social Media Marketing (SMM) Strategy
- Recommended Platforms (where the target buyers actually spend time)
- Weekly Posting Schedule and Content Rhythm
- Proven Hook Angles (3 hook ideas tailored to this niche)

## 3. High-Converting Content Pillars (4 Pillars)
- Pillar 1: Problem & Awareness (Educate on the problem)
- Pillar 2: Solution & Product Showcase (Show the product in action)
- Pillar 3: Social Proof & Trust (Customer results, reviews, behind the scenes)
- Pillar 4: Direct Conversion & Urgency (Clear offers and calls to action)
(Provide 2 concrete post ideas under each pillar)

## 4. Paid Advertising Strategy
- Meta Ads (Facebook & Instagram): Audience targeting suggestions, 2 primary ad copy hooks, and creative format advice
- Google Search & Intent Ads: High-intent keyword themes and search ad copy angles
- Retargeting Setup: How to bring back visitors who left without buying

## 5. Email Marketing & Retention Funnels
- Lead Magnet Concept: What valuable incentive will capture emails
- 5-Step Welcome Sequence: Subject line and core message for each email
- Ongoing Newsletter & Promo Cadence: How often to email and what to send

## 6. 90-Day Execution Roadmap & Key Milestones
- Month 1: Setup, foundation, organic content launch, and initial ad testing
- Month 2: Optimization, email sequence automation, and scaling winners
- Month 3: Full funnel retargeting, expansion, and key metrics review

Deliver the complete, fully fleshed out plan now with no placeholders.`;
}

/**
 * Exports the formatted marketing plan to Google Docs:
 * 1. Cleans any accidental em-dashes and copies plan to clipboard.
 * 2. Searches for any currently open Google Docs tab.
 * 3. If found, switches to it; if not, opens a new document at https://docs.new.
 */
export async function exportToGoogleDocs(planContent: string): Promise<{
  success: boolean;
  openedNew: boolean;
  docUrl: string;
}> {
  // Strip any em-dashes or en-dashes from exported text
  const cleanText = planContent
    .replace(/[—–]/g, ' - ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Copy to system clipboard
  await copyToClipboard(cleanText);

  // Check if a Google Doc tab is open
  const docTabs = await chrome.tabs.query({ url: '*://docs.google.com/document/*' });
  const targetTab = docTabs.find((t) => t.id !== undefined);

  if (targetTab && targetTab.id !== undefined) {
    await chrome.tabs.update(targetTab.id, { active: true });
    if (targetTab.windowId !== undefined) {
      await chrome.windows.update(targetTab.windowId, { focused: true });
    }
    return {
      success: true,
      openedNew: false,
      docUrl: targetTab.url ?? 'https://docs.google.com',
    };
  }

  // Open a new Google Doc
  const newTab = await chrome.tabs.create({ url: 'https://docs.new' });
  return {
    success: true,
    openedNew: true,
    docUrl: newTab.url ?? 'https://docs.new',
  };
}
