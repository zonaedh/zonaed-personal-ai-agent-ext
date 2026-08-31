/**
 * Negative Feedback Engine (Feature 4)
 * Converts user thumbs-down feedback into persistent memory rules
 * that prevent the same mistakes from recurring.
 */

import { upsertMemory, getEnabledMemories, type StoredMemory } from '@/db/db';

export type FeedbackType =
  | 'too-long'
  | 'too-short'
  | 'wrong-tone'
  | 'wrong-lang'
  | 'inaccurate'
  | 'ignored'
  | 'custom';

/** Maps feedback types to concrete memory rules. */
const FEEDBACK_RULES: Record<Exclude<FeedbackType, 'custom' | 'ignored'>, string> = {
  'too-long':
    'User prefers concise, direct answers. Keep responses shorter, skip unnecessary introductions, and get straight to the point.',
  'too-short':
    'User wants more detailed, comprehensive answers. Provide thorough explanations with examples when relevant.',
  'wrong-tone':
    'Use a more natural, casual tone. Avoid overly formal or academic language. Write like a knowledgeable friend.',
  'wrong-lang':
    'Pay attention to the language the user is writing in. Always respond in the same language the user used.',
  'inaccurate':
    'Double-check facts and technical details before responding. User has reported inaccuracy in previous responses.',
};

/**
 * Submit negative feedback and save it as a persistent memory rule.
 * Prevents duplicates by checking for similar existing rules.
 *
 * @param feedbackType - The category of feedback
 * @param customText - Optional custom explanation (used for 'custom' and 'ignored' types)
 * @returns The saved memory, or null if a similar rule already exists
 */
export async function submitNegativeFeedback(
  feedbackType: FeedbackType,
  customText?: string,
): Promise<StoredMemory | null> {
  let ruleFact: string;

  if (feedbackType === 'custom') {
    if (!customText?.trim()) return null;
    ruleFact = customText.trim();
  } else if (feedbackType === 'ignored') {
    ruleFact = customText?.trim()
      ? `Pay close attention to user instructions. Specific issue: ${customText.trim()}`
      : 'Pay close attention to user instructions. Do not skip or ignore any part of the request.';
  } else {
    ruleFact = FEEDBACK_RULES[feedbackType];
  }

  if (!ruleFact) return null;

  // Check for duplicate/similar rules
  const existingRules = await getEnabledMemories();
  const ruleWords = ruleFact.toLowerCase().split(/\s+/).slice(0, 5).join(' ');
  const isDuplicate = existingRules.some(
    (m) =>
      m.category === 'rule' &&
      m.fact.toLowerCase().includes(ruleWords.slice(0, 30)),
  );

  if (isDuplicate) {
    // Update the existing similar rule instead of creating a new one
    const existing = existingRules.find(
      (m) =>
        m.category === 'rule' &&
        m.fact.toLowerCase().includes(ruleWords.slice(0, 30)),
    );
    if (existing?.id !== undefined) {
      const id = await upsertMemory({
        id: existing.id,
        category: 'rule',
        fact: ruleFact,
        source: 'auto-learned',
        enabled: true,
      });
      return {
        id,
        category: 'rule',
        fact: ruleFact,
        source: 'auto-learned',
        enabled: true,
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
      };
    }
  }

  // Save as new rule
  const id = await upsertMemory({
    category: 'rule',
    fact: ruleFact,
    source: 'auto-learned',
    enabled: true,
  });

  return {
    id,
    category: 'rule',
    fact: ruleFact,
    source: 'auto-learned',
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Available feedback options for the UI. */
export const FEEDBACK_OPTIONS: Array<{ type: FeedbackType; label: string; emoji: string }> = [
  { type: 'too-long', label: 'Too long / verbose', emoji: '📏' },
  { type: 'too-short', label: 'Too short / incomplete', emoji: '📝' },
  { type: 'wrong-tone', label: 'Wrong tone / too formal', emoji: '🎭' },
  { type: 'wrong-lang', label: 'Wrong language', emoji: '🌐' },
  { type: 'inaccurate', label: 'Inaccurate information', emoji: '❌' },
  { type: 'ignored', label: 'Ignored my instructions', emoji: '⚠️' },
];
