/**
 * Domain Knowledge Base (Feature 5)
 * Retrieves and injects relevant business/product context into the system prompt
 * based on keyword matching against the user's prompt.
 */

import { getEnabledKnowledge, type StoredKnowledge } from '@/db/db';

/** Max chars budget for knowledge context injection. */
const KNOWLEDGE_BUDGET = 3000;

/** Category display labels for context formatting. */
const CATEGORY_LABELS: Record<string, string> = {
  product: 'Product',
  faq: 'FAQ',
  competitor: 'Competitor Intel',
  pricing: 'Pricing',
  process: 'Process',
  general: 'Knowledge',
};

/**
 * Retrieve and format relevant domain knowledge for the current user prompt.
 * Uses simple keyword matching against knowledge titles, categories, and content.
 * Returns a formatted context block ready for system prompt injection.
 */
export async function getKnowledgeContext(userPrompt: string): Promise<string> {
  const allKnowledge = await getEnabledKnowledge();
  if (allKnowledge.length === 0) return '';

  const promptLower = userPrompt.toLowerCase();
  const promptWords = promptLower
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Score each knowledge item by relevance
  const scored: Array<{ item: StoredKnowledge; score: number }> = [];

  for (const item of allKnowledge) {
    let score = 0;
    const titleLower = item.title.toLowerCase();
    const contentLower = item.content.toLowerCase();
    const categoryLower = item.category.toLowerCase();

    // Title match (highest weight)
    for (const word of promptWords) {
      if (titleLower.includes(word)) score += 3;
    }

    // Category match
    if (promptLower.includes(categoryLower)) score += 2;
    for (const word of promptWords) {
      if (categoryLower.includes(word)) score += 2;
    }

    // Content keyword match (lower weight)
    for (const word of promptWords) {
      if (contentLower.includes(word)) score += 1;
    }

    if (score > 0) {
      scored.push({ item, score });
    }
  }

  if (scored.length === 0) return '';

  // Sort by score descending, take top relevant items within budget
  scored.sort((a, b) => b.score - a.score);

  const lines: string[] = ['[DOMAIN KNOWLEDGE - Your Business Context]'];
  let budgetRemaining = KNOWLEDGE_BUDGET;

  for (const { item } of scored) {
    const label = CATEGORY_LABELS[item.category] ?? item.category;
    const entry = `- ${label}: ${item.title}\n  ${item.content}`;

    if (entry.length > budgetRemaining) break;
    lines.push(entry);
    budgetRemaining -= entry.length;
  }

  return lines.length > 1 ? lines.join('\n') : '';
}
