/**
 * Memory & Custom Skills Engine for Zonaed AI.
 * Handles auto-detection, pre-flight context injection, and conversational learning.
 * Integrates: Memory, Skills, Output Styles, Few-Shot Examples, Knowledge Base.
 */

import {
  getEnabledMemories,
  getEnabledSkills,
  seedMemoryAndSkillsIfEmpty,
  upsertMemory,
  type StoredMemory,
  type StoredSkill,
} from '@/db/db';
import { detectOutputStyle, type OutputStyle } from '@/lib/output-styles';
import { getFewShotContext } from '@/lib/few-shot-bank';
import { getKnowledgeContext } from '@/lib/knowledge-base';

let isSeeded = false;

/** Ensures seed memories and default skills are initialized. */
export async function ensureMemorySeeded(): Promise<void> {
  if (isSeeded) return;
  try {
    await seedMemoryAndSkillsIfEmpty();
    isSeeded = true;
  } catch (err) {
    console.warn('Failed to seed memory & skills:', err);
  }
}

/** Formats all active memories into a clean, prioritized preamble block. */
export async function getMemoryContext(): Promise<string> {
  await ensureMemorySeeded();
  const memories = await getEnabledMemories();
  if (memories.length === 0) return '';

  const grouped: Record<string, string[]> = {
    persona: [],
    rule: [],
    preference: [],
    business: [],
    general: [],
  };

  for (const m of memories) {
    const cat = m.category || 'general';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(m.fact);
  }

  const persona = grouped['persona'] ?? [];
  const rule = grouped['rule'] ?? [];
  const preference = grouped['preference'] ?? [];
  const business = grouped['business'] ?? [];
  const general = grouped['general'] ?? [];

  const lines: string[] = ['[LONG-TERM USER MEMORY & PERSONAL CONTEXT]'];
  lines.push('You must consistently apply these personalized facts, preferences, and rules:');

  if (persona.length > 0) {
    lines.push(`• User Persona: ${persona.join('; ')}`);
  }
  if (rule.length > 0) {
    lines.push(`• Strict Rules: ${rule.join('; ')}`);
  }
  if (preference.length > 0) {
    lines.push(`• Preferences: ${preference.join('; ')}`);
  }
  if (business.length > 0) {
    lines.push(`• Business Context: ${business.join('; ')}`);
  }
  if (general.length > 0) {
    lines.push(`• Additional Knowledge: ${general.join('; ')}`);
  }

  return lines.join('\n');
}

/** Matches prompt against custom skill triggers and returns applicable playbooks. */
export async function getRelevantSkillsContext(userPrompt: string): Promise<{
  text: string;
  matchedSkills: StoredSkill[];
}> {
  await ensureMemorySeeded();
  const skills = await getEnabledSkills();
  if (skills.length === 0) return { text: '', matchedSkills: [] };

  const promptLower = userPrompt.toLowerCase();
  const matched = skills.filter((skill) => {
    if (!skill.triggers || skill.triggers.length === 0) return false;
    return skill.triggers.some((t) => promptLower.includes(t.toLowerCase().trim()));
  });

  if (matched.length === 0) return { text: '', matchedSkills: [] };

  const blocks = matched.map(
    (s) => `--- SPECIALIZED SKILL: ${s.name} ---\n${s.instructions}`,
  );

  return {
    text: `[ACTIVE SPECIALIZED SKILLS DETECTED]\n${blocks.join('\n\n')}`,
    matchedSkills: matched,
  };
}

/**
 * Pre-flight context builder that combines ALL personalization layers:
 * 1. Long-term memory (persona, rules, preferences)
 * 2. Custom skills (trigger-matched playbooks)
 * 3. Output style templates (task-specific formatting)
 * 4. Few-shot examples (user-approved response patterns)
 * 5. Domain knowledge base (business/product context)
 */
export async function buildPersonalizedPreamble(userPrompt: string): Promise<{
  preamble: string;
  matchedSkills: StoredSkill[];
  outputStyle: OutputStyle | null;
}> {
  const [memoryContext, skillsResult] = await Promise.all([
    getMemoryContext(),
    getRelevantSkillsContext(userPrompt),
  ]);

  // Feature 2: Auto-detect output style
  const outputStyle = detectOutputStyle(userPrompt, skillsResult.matchedSkills);

  // Feature 3 + 5: Fetch few-shot examples and knowledge context in parallel
  const [fewShotExamples, knowledgeContext] = await Promise.all([
    getFewShotContext(userPrompt, outputStyle),
    getKnowledgeContext(userPrompt),
  ]);

  const parts = [
    memoryContext,
    skillsResult.text,
    outputStyle?.instructions ?? '',
    fewShotExamples,
    knowledgeContext,
  ].filter(Boolean);

  return {
    preamble: parts.join('\n\n'),
    matchedSkills: skillsResult.matchedSkills,
    outputStyle,
  };
}

/**
 * Auto-learning engine: detects explicit user memory instructions in conversation
 * and automatically saves them to Dexie IndexedDB.
 */
export async function detectAndLearnMemories(userText: string): Promise<StoredMemory | null> {
  const text = userText.trim();
  if (!text) return null;

  // Trigger patterns
  const patterns: Array<{ regex: RegExp; category: StoredMemory['category'] }> = [
    { regex: /(?:please\s+)?remember(?:\s+that|:)?\s+([^.?!]+[.?!]?)/i, category: 'general' },
    { regex: /(?:always\s+remember|keep\s+in\s+mind)(?:\s+that|:)?\s+([^.?!]+[.?!]?)/i, category: 'preference' },
    { regex: /(?:my\s+name\s+is|i\s+am|i'm)\s+([A-Z][a-zA-Z\s]+)/i, category: 'persona' },
    { regex: /(?:my\s+company\s+is|my\s+business\s+is|we\s+are\s+a)\s+([^.?!]+[.?!]?)/i, category: 'business' },
    { regex: /(?:my\s+target\s+audience\s+is|my\s+clients\s+are)\s+([^.?!]+[.?!]?)/i, category: 'business' },
    { regex: /(?:always\s+(?:format|write|respond)\s+as|never\s+use|do\s+not\s+use)\s+([^.?!]+[.?!]?)/i, category: 'rule' },
  ];

  for (const { regex, category } of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const fact = match[1].trim().replace(/^that\s+/i, '');
      if (fact.length > 3 && fact.length < 300) {
        try {
          const id = await upsertMemory({
            category,
            fact,
            source: 'auto-learned',
            enabled: true,
          });
          return {
            id,
            category,
            fact,
            source: 'auto-learned',
            enabled: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
        } catch (err) {
          console.warn('Failed to auto-save memory:', err);
        }
      }
    }
  }

  return null;
}

