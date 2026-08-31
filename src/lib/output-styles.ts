/**
 * Output Style Templates (Feature 2)
 * Predefined output format modes that automatically activate based on task context.
 * Each style injects specific formatting instructions into the system prompt.
 */

import type { StoredSkill } from '@/db/db';

export interface OutputStyle {
  id: string;
  name: string;
  triggers: string[];
  instructions: string;
}

/** Registry of predefined output styles with format-specific instructions. */
const STYLES: OutputStyle[] = [
  {
    id: 'marketing-copy',
    name: 'Marketing Copy',
    triggers: [
      'ad copy', 'social post', 'caption', 'facebook post', 'instagram',
      'social media', 'ক্যাপশন', 'পোস্ট লিখ', 'ফেসবুক', 'ইনস্টাগ্রাম',
    ],
    instructions: `[OUTPUT FORMAT: Marketing Copy]
Format your response as high-converting marketing copy:
1. Start with a compelling hook (first 1-2 lines must grab attention).
2. Body: 3-5 short paragraphs. Keep each under 3 sentences.
3. Use power words and emotional triggers naturally.
4. End with ONE clear, unambiguous call-to-action (CTA).
5. Never write generic filler. Every sentence must serve the conversion goal.`,
  },
  {
    id: 'code-review',
    name: 'Code Review',
    triggers: [
      'review code', 'refactor', 'debug', 'code review', 'fix this code',
      'কোড রিভিউ', 'বাগ ফিক্স', 'ডিবাগ',
    ],
    instructions: `[OUTPUT FORMAT: Code Review]
Format your response as a structured code review:
1. Issue Summary: one-line description of the problem.
2. Root Cause: brief technical explanation.
3. Fix: provide the corrected code in a fenced code block with proper language tag.
4. Explanation: 2-3 sentences on why this fix works.
5. Keep it concise. No unnecessary theory.`,
  },
  {
    id: 'email-draft',
    name: 'Email Draft',
    triggers: [
      'email', 'mail', 'outreach', 'cold email', 'write email',
      'ইমেইল', 'মেইল লিখ',
    ],
    instructions: `[OUTPUT FORMAT: Email Draft]
Format your response as a ready-to-send email:
1. Subject Line: clear, compelling, under 60 characters.
2. Opening: personalized greeting + context (1-2 sentences).
3. Body: the core message (keep under 120 words).
4. CTA: what you want the reader to do next.
5. Sign-off: professional but warm closing.`,
  },
  {
    id: 'business-plan',
    name: 'Business Strategy',
    triggers: [
      'business plan', 'strategy', 'roadmap', '30-60-90', 'growth plan',
      'বিজনেস প্ল্যান', 'স্ট্র্যাটেজি', 'রোডম্যাপ',
    ],
    instructions: `[OUTPUT FORMAT: Business Strategy]
Format your response as an actionable business document:
1. Executive Summary: 2-3 sentence overview.
2. Key Metrics/Goals: use a table if comparing data.
3. Action Items: break into 30/60/90 day phases.
4. Resource Requirements: what's needed to execute.
5. Be data-driven. Avoid vague generalizations.`,
  },
  {
    id: 'bangla-content',
    name: 'Bangla Content',
    triggers: [
      'বাংলায় লিখ', 'ব্লগ', 'আর্টিকেল', 'বাংলা কনটেন্ট',
      'write in bangla', 'bengali article',
    ],
    instructions: `[OUTPUT FORMAT: Bangla Content]
বাংলায় কনটেন্ট লিখবে:
1. প্রতিটি প্যারাগ্রাফ ছোট রাখবে (2-3 বাক্য)।
2. Heading গুলো বাংলায় দিবে।
3. ইংরেজি টেকনিক্যাল শব্দ স্বাভাবিকভাবে রাখবে।
4. সহজ, কথ্য বাংলা ব্যবহার করবে, সাহিত্যিক না।`,
  },
  {
    id: 'comparison',
    name: 'Comparison/Analysis',
    triggers: [
      'compare', 'vs', 'versus', 'difference between', 'which is better',
      'তুলনা', 'কোনটা ভালো', 'পার্থক্য',
    ],
    instructions: `[OUTPUT FORMAT: Comparison Analysis]
Format your response as a structured comparison:
1. Quick verdict: 1-2 sentence recommendation upfront.
2. Comparison table: use markdown table with key criteria as rows.
3. Detailed breakdown: explain each criterion briefly.
4. Final recommendation: who should pick what and why.`,
  },
];

/**
 * Detect the most appropriate output style for a given user prompt.
 * First checks matched skills for context, then falls back to keyword triggers.
 */
export function detectOutputStyle(
  userPrompt: string,
  matchedSkills: StoredSkill[] = [],
): OutputStyle | null {
  const promptLower = userPrompt.toLowerCase();

  // Skill-to-style mapping (if a skill is active, prefer its related style)
  const skillStyleMap: Record<string, string> = {
    'Digital Marketing Strategist': 'marketing-copy',
    'Direct Response Copywriter': 'marketing-copy',
    'Code Reviewer & Architecture Optimizer': 'code-review',
  };

  for (const skill of matchedSkills) {
    const styleId = skillStyleMap[skill.name];
    if (styleId) {
      const style = STYLES.find((s) => s.id === styleId);
      if (style) return style;
    }
  }

  // Keyword trigger matching
  for (const style of STYLES) {
    const matched = style.triggers.some((trigger) =>
      promptLower.includes(trigger.toLowerCase()),
    );
    if (matched) return style;
  }

  return null;
}

/** Get all available output styles for UI display. */
export function getAllOutputStyles(): OutputStyle[] {
  return [...STYLES];
}
