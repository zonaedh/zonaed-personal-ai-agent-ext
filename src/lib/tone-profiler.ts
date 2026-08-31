/**
 * Adaptive Tone Profiler (Feature 1)
 * Auto-detects user language (Bangla/English/Mixed) and formality level.
 * Updates settings automatically for seamless language switching.
 */

export type DetectedLanguage = 'bn' | 'en' | 'mixed';
export type FormalityLevel = 'casual' | 'professional' | 'technical';

export interface ToneProfile {
  language: DetectedLanguage;
  formality: FormalityLevel;
  avgSentenceLength: number;
}

/**
 * Detect the primary language of user text based on Unicode character analysis.
 * Bengali Unicode range: U+0980 - U+09FF
 */
export function detectLanguage(text: string): DetectedLanguage {
  if (!text.trim()) return 'en';

  const chars = [...text.replace(/\s+/g, '')];
  if (chars.length === 0) return 'en';

  let banglaCount = 0;
  for (const ch of chars) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0980 && code <= 0x09ff) banglaCount++;
  }

  const ratio = banglaCount / chars.length;
  if (ratio > 0.4) return 'bn';
  if (ratio < 0.1) return 'en';
  return 'mixed';
}

/**
 * Detect the formality/complexity level from user text.
 * Uses keyword heuristics and structural indicators.
 */
export function detectFormality(text: string): FormalityLevel {
  const lower = text.toLowerCase();

  // Technical indicators: code blocks, technical terms, file paths
  const technicalSignals = [
    /```/,
    /\b(function|const |let |var |import |export |class |interface )/,
    /\b(api|sdk|npm|git|docker|kubernetes|typescript|javascript|python)\b/,
    /\b(error|debug|bug|refactor|deploy|build|compile)\b/,
    /[a-zA-Z]+\.[a-zA-Z]{2,4}\b/, // file extensions
    /https?:\/\//,
  ];

  let techScore = 0;
  for (const pattern of technicalSignals) {
    if (pattern.test(lower)) techScore++;
  }
  if (techScore >= 2) return 'technical';

  // Casual indicators: emojis, short text, slang, informal markers
  const casualSignals = [
    /[\u{1F600}-\u{1F64F}]/u, // emoticons
    /[\u{1F300}-\u{1F5FF}]/u, // misc symbols
    /[\u{1F680}-\u{1F6FF}]/u, // transport
    /[\u{1F1E0}-\u{1F1FF}]/u, // flags
    /\b(lol|haha|btw|idk|tbh|nah|yep|yea|gonna|wanna|gotta)\b/i,
    /!{2,}/, // multiple exclamation marks
    /\?{2,}/, // multiple question marks
  ];

  let casualScore = 0;
  for (const pattern of casualSignals) {
    if (pattern.test(text)) casualScore++;
  }

  // Short messages tend to be casual
  if (text.trim().length < 50) casualScore++;

  if (casualScore >= 2) return 'casual';

  return 'professional';
}

/**
 * Build a complete tone profile from user text.
 */
export function profileTone(text: string): ToneProfile {
  const sentences = text
    .split(/[.!?।\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const avgSentenceLength =
    sentences.length > 0
      ? sentences.reduce((acc, s) => acc + s.split(/\s+/).length, 0) / sentences.length
      : 0;

  return {
    language: detectLanguage(text),
    formality: detectFormality(text),
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
  };
}
