/**
 * Personalized LinkedIn & Cold Outreach Generator for Zonaed AI.
 * Reads active prospect profiles or websites and drafts high-converting, human outreach messages.
 */

export type OutreachChannel = 'all_variations' | 'linkedin' | 'cold_email' | 'video_pitch';
export type OutreachTone = 'casual_friendly' | 'value_first' | 'bold_authority';

export interface OutreachConfig {
  channel: OutreachChannel;
  tone: OutreachTone;
  yourOffer: string;
  specificAngle?: string;
}

export const OUTREACH_CHANNEL_LABELS: Record<OutreachChannel, string> = {
  all_variations: 'All 3 Formats (LinkedIn Connection, Cold Email & Video Script)',
  linkedin: 'LinkedIn Connection Note & Follow-up DM',
  cold_email: 'Short Direct-Response Cold Email',
  video_pitch: '30-Second Loom / Video Pitch Script',
};

export const OUTREACH_TONE_LABELS: Record<OutreachTone, string> = {
  casual_friendly: 'Casual & Friendly (Peer-to-Peer, No Pitch Slap)',
  value_first: 'Value-First (Free Audit / Insight Teaser)',
  bold_authority: 'Bold & Direct (Results-Oriented Problem Solver)',
};

export function buildOutreachPrompt(
  page: { title: string; url: string; text: string },
  config: OutreachConfig,
): string {
  return `You are a World-Class Cold Outreach & Sales Copywriting Specialist.
You are crafting highly personalized, non-spammy outreach messages to the prospect or company on this page.

PROSPECT / COMPANY CONTEXT:
Page Title: ${page.title}
Page URL: ${page.url}
Page Content Extract:
${page.text.slice(0, 8000)}

OUTREACH PARAMETERS:
- Format / Channel: ${OUTREACH_CHANNEL_LABELS[config.channel]}
- Tone of Voice: ${OUTREACH_TONE_LABELS[config.tone]}
- Your Offer / Service: ${config.yourOffer || 'Digital Marketing, Growth Strategy, and Customer Acquisition'}
${config.specificAngle ? `- Specific Angle or Angle: ${config.specificAngle}` : ''}

WRITING RULES:
1. ZERO EM DASHES OR EN DASHES: Do NOT use em dashes (—) or en dashes (–). Use standard commas, colons, or clean bullet points.
2. 100% HUMAN & CONVERSATIONAL: Write like a real professional sending a thoughtful message from their phone. No awkward corporate jargon.
3. NO SPAM CLICHÉS: Never say "I hope this email finds you well", "synergy", "game-changer", "unleash", "delve", "testament", "tapestry", "moreover", "furthermore".
4. COMPACT & PUNCHY: Keep cold emails under 120 words. Keep LinkedIn notes under 280 characters.

OUTPUT FORMAT:

# 🎯 Personalized Outreach Playbook

## 📌 Prospect Insights Summary
- Prospect/Company: [Name or Business Name]
- Key Observation: [Specific observation from their page to show genuine research]

## 1. LinkedIn Connection Request (< 280 Characters)
[A genuine connection note referencing what they do]

## 2. LinkedIn Follow-Up DM (After They Accept)
[A conversational opening message that starts a dialogue without pitch-slapping]

## 3. High-Converting Cold Email (Under 120 Words)
- Subject Line: [Short, curiosity-driven subject in lower case or sentence case]
- Email Body:
[Personalized opening hook]
[Core value / observed opportunity]
[Low-friction Call to Action (e.g. "Open to checking out a 2-min breakdown?")]

## 4. 30-Second Video / Loom Pitch Script
[Exact spoken script if recording a quick video for them]

Generate the personalized outreach messages now.`;
}
