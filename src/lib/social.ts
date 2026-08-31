/**
 * Social post writer (Phase 2) — template-driven, NOT a generic "write a post"
 * black box (spec §4). Platform, tone, length and hashtags are explicit inputs
 * that shape a structured prompt.
 */
export type SocialPlatform = 'linkedin' | 'x' | 'facebook';
export type SocialTone = 'professional' | 'friendly' | 'bold' | 'insightful' | 'humorous';
export type SocialLength = 'short' | 'medium' | 'long';

export interface SocialInput {
  platform: SocialPlatform;
  topic: string;
  tone: SocialTone;
  length: SocialLength;
  hashtags: boolean;
  context?: string; // optional attached page content
}

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: 'LinkedIn',
  x: 'X (Twitter)',
  facebook: 'Facebook',
};

export const LENGTH_GUIDE: Record<SocialLength, string> = {
  short: '1–2 sentences (under 280 characters where the platform requires it)',
  medium: '1 short paragraph or 3–5 lines',
  long: '2–4 short paragraphs with clear structure',
};

const PLATFORM_RULES: Record<SocialPlatform, string> = {
  linkedin:
    'LinkedIn best practices: hook in the first line, short paragraphs, generous line breaks, no external-link-first structure, end with a question or CTA to invite comments.',
  x: 'X (Twitter) best practices: punchy and quotable, ideally a single tweet under 280 characters, one clear idea, optional thread numbering if longer.',
  facebook:
    'Facebook best practices: conversational and personal, 1–3 short paragraphs, emoji are acceptable in moderation, invite reactions/comments.',
};

const TONE_GUIDE: Record<SocialTone, string> = {
  professional: 'polished and credible, industry-appropriate vocabulary',
  friendly: 'warm and approachable, like talking to a peer',
  bold: 'confident and opinionated, strong verbs, takes a stance',
  insightful: 'teaches something — a takeaway, stat or lesson',
  humorous: 'light and playful, tasteful wit',
};

export function buildSocialPrompt(input: SocialInput): string {
  const parts = [
    `Write a ${PLATFORM_LABELS[input.platform]} post about: ${input.topic.trim()}`,
    `Tone: ${TONE_GUIDE[input.tone]}.`,
    `Length: ${LENGTH_GUIDE[input.length]}.`,
    `Platform rules: ${PLATFORM_RULES[input.platform]}`,
    input.hashtags
      ? 'Include 3–5 relevant hashtags at the end.'
      : 'Do not include hashtags.',
    'Respond with ONLY the post text — no preamble, no quotes around it, no explanation.',
  ];
  return parts.join('\n');
}

export function buildSocialContextLabel(input: SocialInput): string {
  return `${PLATFORM_LABELS[input.platform]} post (${input.tone}, ${input.length}${input.hashtags ? ', hashtags' : ''})`;
}