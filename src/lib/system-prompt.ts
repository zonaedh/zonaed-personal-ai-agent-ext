import type { ChatAttachment } from '@/shared/types';
import { truncate } from '@/lib/util';

/**
 * Builds the system prompt for a chat request. Attached context (page content,
 * selected text, attached tabs) travels in the system message so it applies to
 * the whole turn regardless of model chat-template quirks. Every slot is
 * truncated to the configured budget before hitting the model.
 */
export interface SystemPromptInput {
  contextSlots: ChatAttachment[];
  /** Total context budget (chars) — page content is truncated to this. */
  maxContextChars: number;
  taskHint?: string;
  language?: 'en' | 'bn';
}

export function buildSystemPrompt(input: SystemPromptInput): string {
  const { contextSlots, maxContextChars, taskHint, language = 'en' } = input;
  const today = new Date().toISOString().slice(0, 10);

  const base = [
    'You are Zonaed AI, a personal autonomous browser agent and strategic technical consultant for Zonaed.',
    `Current date (UTC): ${today}.`,
    '',
    'Core Guidelines:',
    ' - Answer in clean Markdown (headings, lists, tables, fenced code blocks with language tags).',
    ' - Be concise, direct, consultative, and highly actionable.',
    ' - STRICT PUNCTUATION RULE: NEVER use em-dashes (—) or en-dashes (–). Use standard commas (,), colons (:), hyphens (-), or clean bullet points.',
    ' - Strictly avoid robotic AI filler and buzzwords like "delve", "testament", "tapestry", "embark", "furthermore", "moreover", "in conclusion", "beacon", "game-changer".',
    ' - When a user attaches page content, use it as context — do not claim to have browsed beyond it.',
    '',
    'User Hardware & Setup Context:',
    ' - CPU: Intel i5 6th Gen | RAM: 16 GB | GPU: GTX 1660 6 GB | SSD: 256 GB | OS: Windows',
    ' - Tools: Antigravity IDE + VS Code installed',
    ' - Preferred Architecture: Local lightweight agent runtime + Free/Cloud APIs (Groq, Gemini, OpenRouter) for heavy models (27B-120B) + local tools/automation.',
  ].join('\n');

  const langDirective =
    language === 'bn'
      ? `[LANGUAGE & COMMUNICATION RULE: BANGLA & BANGLISH DETECTED]
CRITICAL INSTRUCTION: The user is communicating in Bangla or Banglish (Romanized Bengali, e.g. "ami text korle...", "kivabe korbo", "eta fix kore daw").
You MUST reply in natural, conversational, tech-savvy Bangladeshi Bangla (in standard Bangla script with natural English technical terms) as defined below:

১. টোন ও ভাষাভঙ্গি:
- বন্ধুত্বপূর্ণ, সরাসরি, আত্মবিশ্বাসী এবং টেক-স্যাভি বাংলাদেশি বাংলা।
- ব্যবহারকারীকে সহজে সম্বোধন করবে (যেমন: "তুমি/তোমার", "তোমার PC দিয়ে...")।
- ইংরেজি টেকনিক্যাল/বিজনেস শব্দগুলো স্বাভাবিকভাবে বাংলায় রাখবে (যেমন: "PC দিয়ে", "browser + desktop control", "architecture-টা", "controlled Agent Runtime", "hardware", "main strategy", "cloud/free API + local tools")।

২. ডেমো রেফারেন্স (এই স্টাইলে উত্তর দিবে):
"হ্যাঁ, তোমার PC দিয়ে browser + desktop control করা AI Agent বানানো সম্ভব। তবে আমি architecture-টা এমনভাবে করতাম যাতে LLM নিজে সরাসরি PC control না করে, বরং একটা controlled Agent Runtime-এর মাধ্যমে কাজ করে।

তোমার hardware:
- i5 6th Gen
- RAM 16 GB
- GTX 1660 6 GB
- SSD 256 GB
- Windows
- Antigravity + VS Code already installed

এখানে local 70B/100B+ model চালানোকে main strategy বানাব না। বরং cloud/free বা extremely cheap API + local tools ব্যবহার করব।"

৩. কঠোর বিরামচিহ্ন নিয়ম (STRICT):
- কোনো অবস্থাতেই em-dash (—) বা en-dash (–) ব্যবহার করবে না। সবসময় সাধারণ কমা (,), কোলন (:), হাইফেন (-) বা লাইন ব্রেক ব্যবহার করবে।`
      : `[LANGUAGE & COMMUNICATION RULE: ENGLISH DETECTED]
CRITICAL INSTRUCTION: The user is communicating in English.
You MUST reply ONLY in clear, concise, professional, and tech-savvy English.
- Do NOT use Bengali words unless specifically requested.
- Be direct, consultative, and actionable.
- Strictly NO em-dashes (—) or en-dashes (–). Use standard commas, colons, or clean bullet points.`;

  // Header HTML wrapper if any.
  const slotBlocks: string[] = [];
  let budget = maxContextChars;
  for (const slot of contextSlots) {
    const available = Math.floor(budget / Math.max(1, contextSlots.length));
    const body = truncate(slot.content || '', available);
    slotBlocks.push(
      `[Attached context: ${slot.kind}] ${slot.label}${slot.url ? ` (${slot.url})` : ''}\n${body}`,
    );
  }

  const footerReminder =
    language === 'bn'
      ? '[FINAL MANDATORY INSTRUCTION: You MUST output your entire response in BANGLA (বাংলা). Do NOT output in English even if instructions above are in English. Follow the Bangla tone style guide above. Strictly no em-dashes.]'
      : '[FINAL MANDATORY INSTRUCTION: You MUST output your entire response in ENGLISH. Do NOT output in Bengali. Strictly no em-dashes.]';

  const parts = [langDirective, base];
  if (taskHint) parts.push(`This turn’s task: ${taskHint}`);
  if (slotBlocks.length > 0) {
    parts.push(`The user attached the following context. Use it when answering:\n\n${slotBlocks.join('\n\n---\n\n')}`);
  }
  parts.push(footerReminder);
  return parts.join('\n\n');
}