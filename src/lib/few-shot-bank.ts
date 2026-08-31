/**
 * Few-Shot Example Bank (Feature 3)
 * Stores user-approved responses as training examples and retrieves
 * relevant ones to inject as few-shot context in the system prompt.
 */

import { addExample, getExamplesByTag, searchExamples, type StoredExample } from '@/db/db';
import type { OutputStyle } from '@/lib/output-styles';

/** Max chars budget for few-shot context block (to respect token limits). */
const FEW_SHOT_BUDGET = 2000;

/**
 * Auto-detect the appropriate tag for an example based on content analysis.
 * Falls back to 'general' if no strong signal is found.
 */
export function autoDetectTag(userPrompt: string, assistantResponse: string): string {
  const combined = (userPrompt + ' ' + assistantResponse).toLowerCase();

  const tagSignals: Array<{ tag: string; keywords: string[] }> = [
    {
      tag: 'marketing-copy',
      keywords: ['campaign', 'ad copy', 'social post', 'caption', 'cta', 'hook', 'conversion', 'ক্যাপশন'],
    },
    {
      tag: 'code-review',
      keywords: ['function', 'const ', 'import ', 'refactor', 'debug', 'typescript', 'javascript', '```'],
    },
    {
      tag: 'email-draft',
      keywords: ['subject line', 'email', 'dear ', 'regards', 'sign-off', 'outreach'],
    },
    {
      tag: 'business-plan',
      keywords: ['strategy', 'roadmap', '30-60-90', 'kpi', 'revenue', 'growth', 'metric'],
    },
    {
      tag: 'bangla-content',
      keywords: ['বাংলা', 'ব্লগ', 'আর্টিকেল', 'কনটেন্ট', 'পোস্ট'],
    },
  ];

  for (const { tag, keywords } of tagSignals) {
    const matchCount = keywords.filter((kw) => combined.includes(kw)).length;
    if (matchCount >= 2) return tag;
  }

  return 'general';
}

/**
 * Save a user-approved response as a few-shot example.
 * Called when the user clicks 👍 on a message.
 */
export async function saveAsExample(
  userPrompt: string,
  assistantResponse: string,
  tag?: string,
): Promise<number> {
  const resolvedTag = tag ?? autoDetectTag(userPrompt, assistantResponse);
  return addExample(resolvedTag, userPrompt, assistantResponse);
}

/**
 * Build few-shot context string from stored examples.
 * Retrieves examples matching the current output style or prompt keywords.
 * Budget-capped to avoid exceeding token limits.
 */
export async function getFewShotContext(
  userPrompt: string,
  outputStyle?: OutputStyle | null,
): Promise<string> {
  let examples: StoredExample[] = [];

  // Strategy 1: Match by output style tag
  if (outputStyle?.id) {
    examples = await getExamplesByTag(outputStyle.id, 3);
  }

  // Strategy 2: If no style-matched examples, try keyword search from prompt
  if (examples.length === 0) {
    // Extract the first 3 significant words as search keywords
    const words = userPrompt
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 3);

    for (const word of words) {
      const found = await searchExamples(word, 2);
      examples.push(...found);
      if (examples.length >= 3) break;
    }

    // Deduplicate by id
    const seen = new Set<number>();
    examples = examples.filter((e) => {
      if (e.id === undefined || seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }

  if (examples.length === 0) return '';

  // Build the few-shot block within budget
  const lines: string[] = [
    '[YOUR PAST APPROVED RESPONSES - Match this exact style and quality]',
  ];
  let budgetRemaining = FEW_SHOT_BUDGET;

  for (let i = 0; i < Math.min(examples.length, 3); i++) {
    const ex = examples[i];
    if (!ex) continue;

    // Truncate long examples to fit budget
    const prompt = ex.userPrompt.slice(0, 200);
    const response = ex.assistantResponse.slice(0, 500);
    const block = `Example ${i + 1}:\nUser: ${prompt}\nYour Response: ${response}`;

    if (block.length > budgetRemaining) break;
    lines.push(block);
    lines.push('---');
    budgetRemaining -= block.length + 10;
  }

  return lines.join('\n');
}
