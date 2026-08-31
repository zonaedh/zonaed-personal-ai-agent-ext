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
 * Common Banglish (Romanized Bengali) keywords.
 * If user types phonetically in English letters, this detects it as Bangla context.
 */
const BANGLISH_KEYWORDS = [
  'ami', 'amake', 'amader', 'amr', 'amar', 'tumi', 'tomake', 'tomader', 'tomar',
  'apni', 'apnake', 'apnader', 'apnar', 'keno', 'kivabe', 'kibhabe', 'kemon',
  'koro', 'korbe', 'korbo', 'korte', 'kore', 'kora', 'korsi', 'koresi', 'korchi',
  'daw', 'dao', 'dorkar', 'ache', 'achey', 'nai', 'hobe', 'hocche', 'hoise',
  'eta', 'eita', 'ota', 'oita', 'tokhn', 'jokhn', 'ekhn', 'karon', 'bhalo', 'valo',
  'chai', 'dekho', 'bolo', 'bolte', 'bolbo', 'bolbe', 'shune', 'shono', 'khub',
  'beshi', 'kom', 'shob', 'sob', 'jeta', 'seta', 'thakbe', 'ashbe', 'jabe',
  'parbo', 'parbe', 'thik', 'bhul', 'vul', 'lagbe', 'dite', 'dicchi', 'dilam',
  'nebo', 'nibo', 'bujhlam', 'bujhte', 'bolchi', 'korar', 'dile', 'gele', 'ashle',
  'ki', 'kintu', 'ar', 'r', 'na', 'hoye', 'hoy', 'geche', 'gula', 'gulo', 'tai',
];

const BANGLISH_REGEX = new RegExp(
  `\\b(${BANGLISH_KEYWORDS.join('|')})\\b`,
  'gi',
);

/**
 * Detect the primary language of user text based on:
 * 1. Bengali Unicode character analysis (U+0980 - U+09FF)
 * 2. Banglish (Romanized Bengali phonetic words in English script)
 */
export function detectLanguage(text: string): DetectedLanguage {
  const trimmed = text.trim();
  if (!trimmed) return 'en';

  const chars = [...trimmed.replace(/\s+/g, '')];
  if (chars.length === 0) return 'en';

  // 1. Bengali Unicode script check
  let banglaCount = 0;
  for (const ch of chars) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0980 && code <= 0x09ff) banglaCount++;
  }

  const scriptRatio = banglaCount / chars.length;
  if (scriptRatio > 0.15) return 'bn';

  // 2. Banglish keyword matching
  const banglishMatches = trimmed.match(BANGLISH_REGEX);
  if (banglishMatches && banglishMatches.length >= 2) {
    return 'bn';
  }

  // 3. Mixed / Single word check
  if (banglishMatches && banglishMatches.length === 1 && trimmed.split(/\s+/).length <= 4) {
    return 'bn';
  }

  return 'en';
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
