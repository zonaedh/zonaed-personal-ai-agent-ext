/**
 * Competitor Ad & Content Spy Analyzer for Zonaed AI.
 * Deconstructs competitor landing pages, ads, and offers to formulate counter-attack strategies.
 */

export type SpyFocus = 'counter_attack' | 'ad_angles' | 'pricing_offer' | 'content_gaps';

export interface CompetitorSpyConfig {
  focus: SpyFocus;
  yourBrandOrOffer?: string;
  notes?: string;
}

export const SPY_FOCUS_LABELS: Record<SpyFocus, string> = {
  counter_attack: 'Full Counter-Positioning & Market Takeover Strategy',
  ad_angles: 'Reverse-Engineer Ad Copy Hooks & Creative Angles',
  pricing_offer: 'Pricing Structure, Offer Stacking & Guarantee Breakdown',
  content_gaps: 'Content Gaps & Organic Search Keyword Vulnerabilities',
};

export function buildCompetitorSpyPrompt(
  page: { title: string; url: string; text: string },
  config: CompetitorSpyConfig,
): string {
  return `You are a Master Competitive Intelligence Strategist and Growth Marketer.
You are analyzing a competitor website/landing page to reverse-engineer their marketing strategy and build a counter-attack plan.

COMPETITOR PAGE DETAILS:
URL: ${page.url}
Title: ${page.title}
Page Content Extract:
${page.text.slice(0, 9000)}

ANALYSIS FOCUS:
- Primary Goal: ${SPY_FOCUS_LABELS[config.focus]}
${config.yourBrandOrOffer ? `- Your Brand / Product Context: ${config.yourBrandOrOffer}` : ''}
${config.notes ? `- Specific Areas of Interest: ${config.notes}` : ''}

WRITING STYLE RULES:
1. NO EM DASHES OR EN DASHES: Do NOT use em dashes (—) or en dashes (–). Use standard commas, colons, or clean bullet points.
2. SHARP, DIRECT & ACTIONABLE: Cut through marketing fluff and analyze the real psychological mechanics behind their funnel.
3. NO ROBOTIC JARGON: Avoid AI buzzwords ("delve", "testament", "tapestry", "embark", "furthermore", "moreover", "in conclusion", "beacon", "game-changer", "unleash").

STRUCTURE YOUR REPORT AS FOLLOWS:

# 🕵️ Competitor Strategy Breakdown & Counter-Attack Playbook

## 1. Offer & Positioning Deconstruction
- Core Value Proposition: What are they promising?
- Pricing & Offer Structure: How do they package their products or services?
- Target Persona: Exactly who are they speaking to and what pain point are they targeting?

## 2. Psychological Triggers & Ad Hooks
- Primary Hook Angles: The 3 core emotional angles they use (e.g. Fear of missing out, Status, Speed, Ease)
- What makes their pitch persuasive?
- Social Proof Elements: How do they build credibility?

## 3. Vulnerabilities & Weaknesses (Where They Are Losing)
- Unclear claims or missing proof
- Customer friction points and common complaints in this category
- Segments of the market they are ignoring

## 4. Your Counter-Attack Playbook (How to Win Their Customers)
- Counter-Positioning Angle: How to frame your offer so theirs looks overpriced, outdated, or risky
- 3 High-Converting Ad Hooks you can run against this competitor
- Irresistible Offer Twist: What you can add to beat their guarantee or package

## 5. Steal-Worthy Tactics
- 2 clever marketing ideas they are using that you can adapt ethically for your own campaigns

Deliver the full competitive breakdown now.`;
}
