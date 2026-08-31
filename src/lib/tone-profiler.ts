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
const BANGLISH_WORDS = new Set([
  'ami', 'amr', 'amar', 'amake', 'amader', 'tumi', 'tmr', 'tomar', 'tomake', 'tomader',
  'apni', 'apnr', 'apnar', 'apnake', 'apnader', 'she', 'shey', 'taar', 'tar', 'tader', 'take',
  'era', 'ora', 'ini', 'uni', 'keno', 'kno', 'kivabe', 'kibhabe', 'kivabhe', 'kemon', 'kmn',
  'ki', 'kothay', 'kothae', 'koi', 'kokhon', 'kobe', 'koto', 'kototuku', 'konta', 'kon', 'kono',
  'koro', 'korbe', 'korbo', 'korte', 'kore', 'kora', 'kori', 'korsi', 'koresi', 'korsilam',
  'korchisilam', 'korchi', 'kortesi', 'kortam', 'koren', 'korben', 'korlei', 'korle', 'korar',
  'banano', 'banate', 'banabo', 'banai', 'banao', 'banaite', 'banaisi', 'banay', 'daw', 'dao',
  'den', 'diben', 'dibo', 'dibe', 'dilam', 'dite', 'disi', 'dicchi', 'dici', 'lagbe', 'lage',
  'laglo', 'lagtese', 'dorkar', 'ache', 'ase', 'nai', 'nei', 'silo', 'chilo', 'thakbe', 'thake',
  'thak', 'thako', 'thaken', 'thakle', 'ashbe', 'ashe', 'asho', 'ashen', 'ashlam', 'ashle',
  'jabe', 'jay', 'jao', 'jan', 'gelam', 'geche', 'gese', 'gaisi', 'gele', 'parbo', 'parbe',
  'pari', 'paren', 'parben', 'parle', 'parbona', 'bolo', 'bolte', 'bolbo', 'bolbe', 'boli',
  'bolsi', 'bollen', 'bolen', 'bollei', 'dekho', 'dekhte', 'dekhbo', 'dekhbe', 'dekhi', 'dekhsi',
  'dekhlen', 'dekhen', 'shono', 'shunte', 'shunbo', 'shunbe', 'shuni', 'shunsi', 'shunlen',
  'shunlam', 'bujhi', 'bujhlam', 'bujhlen', 'bujhina', 'bujhte', 'chai', 'chao', 'chan',
  'chailam', 'chaise', 'chaile', 'nebo', 'nibo', 'nao', 'nen', 'nilam', 'nite', 'pelam',
  'pailam', 'pelen', 'pao', 'pan', 'peyechi', 'paici', 'pawar', 'ajke', 'aj', 'kalke', 'kal',
  'gotokal', 'poroshu', 'ekta', 'duita', 'tinta', 'koyekta', 'onek', 'onk', 'beshi', 'bishi',
  'kom', 'khub', 'ektu', 'aro', 'r', 'ar', 'o', 'e', 'ei', 'oi', 'eta', 'ota', 'eita', 'oita',
  'eikhane', 'oikhane', 'ekhane', 'okhane', 'kotha', 'barta', 'nam', 'naam', 'kaj', 'kaaj',
  'bhalo', 'valo', 'kharap', 'thik', 'bhul', 'vul', 'sundor', 'shohoj', 'kothin', 'druto',
  'aste', 'shuru', 'sesh', 'shesh', 'jemon', 'jemne', 'emne', 'temne', 'tai', 'tahole', 'tobe',
  'jodi', 'jodio', 'jehetu', 'karon', 'karone', 'kintu', 'jeta', 'seta', 'sheta', 'shob',
  'sob', 'shobai', 'sobai', 'shobgula', 'sobgula', 'egula', 'ogula', 'aigula', 'oigula',
  'kichu', 'ekdom', 'hobe', 'hocche', 'hoitase', 'hoise', 'hoilo', 'hoy', 'hoye', 'gulo',
  'gula', 'jonno', 'jonne', 'kache', 'theke', 'diye', 'dia', 'moto', 'moton', 'motoi', 'er'
]);

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
  if (scriptRatio > 0.1) return 'bn';

  // 2. Banglish dictionary matching
  const words = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'en';

  let banglishMatchCount = 0;
  for (const w of words) {
    if (BANGLISH_WORDS.has(w)) {
      banglishMatchCount++;
    }
  }

  // If at least 1 strong Banglish word in short text or >= 10% in longer text
  if (banglishMatchCount >= 1 && (words.length <= 5 || banglishMatchCount / words.length >= 0.1)) {
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
