/**
 * Dexie (IndexedDB) schema + typed query helpers.
 * Tables:
 *  - chats:      conversation history (full-text search via searchText)
 *  - prompts:    saved prompt templates (Phase 2 social-writer templates)
 *  - scrapes:    structured extraction results        (Phase 3)
 *  - profiles:   form-autofill profiles               (Phase 3)
 *  - recipes:    saved automation action sequences    (Phase 4)
 *  - logs:       automation/OCR audit trail           (Phase 3/4)
 *  - memories:   long-term personalized facts & rules (Memory System)
 *  - skills:     modular custom skill instructions    (Skills System)
 */
import Dexie, { type EntityTable } from 'dexie';
import type { AutomationStep, ChatAttachment, ChatMessage, ChatSessionMeta } from '@/shared/types';

export interface StoredChat {
  id?: number;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  contextSlots: ChatAttachment[];
  /** Denormalized full text of the conversation for fast substring search. */
  searchText: string;
}

export interface StoredPrompt {
  id?: number;
  title: string;
  body: string;
  tags: string[];
  /** Which feature the prompt belongs to (e.g. 'social-linkedin'). */
  kind?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoredScrape {
  id?: number;
  url: string;
  title: string;
  kind: string;
  data: unknown;
  createdAt: number;
}

export interface ProfileField {
  key: string;
  value: string;
}

export interface StoredProfile {
  id?: number;
  name: string;
  fields: ProfileField[];
  createdAt: number;
  updatedAt: number;
}

export interface StoredRecipe {
  id?: number;
  name: string;
  steps: AutomationStep[];
  createdAt: number;
  updatedAt: number;
}

export interface StoredAutomationLog {
  id?: number;
  ts: number;
  kind: string;
  message: string;
  detail?: string;
}

export type MemoryCategory = 'persona' | 'preference' | 'business' | 'rule' | 'general';

export interface StoredMemory {
  id?: number;
  category: MemoryCategory;
  fact: string;
  source: 'auto-learned' | 'user-added';
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface StoredSkill {
  id?: number;
  name: string;
  description: string;
  instructions: string;
  triggers: string[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Feature 3: Few-Shot Example Bank - stores user-approved responses as training examples. */
export interface StoredExample {
  id?: number;
  /** Output style/context tag, e.g. "marketing-copy", "code-review", "bangla-casual" */
  tag: string;
  userPrompt: string;
  assistantResponse: string;
  createdAt: number;
}

/** Feature 5: Domain Knowledge Base - persistent business/product context. */
export type KnowledgeCategory = 'product' | 'faq' | 'competitor' | 'pricing' | 'process' | 'general';

export interface StoredKnowledge {
  id?: number;
  category: KnowledgeCategory;
  title: string;
  content: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

class AppDatabase extends Dexie {
  chats!: EntityTable<StoredChat, 'id'>;
  prompts!: EntityTable<StoredPrompt, 'id'>;
  scrapes!: EntityTable<StoredScrape, 'id'>;
  profiles!: EntityTable<StoredProfile, 'id'>;
  recipes!: EntityTable<StoredRecipe, 'id'>;
  logs!: EntityTable<StoredAutomationLog, 'id'>;
  memories!: EntityTable<StoredMemory, 'id'>;
  skills!: EntityTable<StoredSkill, 'id'>;
  examples!: EntityTable<StoredExample, 'id'>;
  knowledge!: EntityTable<StoredKnowledge, 'id'>;

  constructor() {
    super('local-ai-browser-agent');
    this.version(1).stores({
      chats: '++id, updatedAt, createdAt, title, searchText',
      prompts: '++id, updatedAt, title, *tags, kind',
      scrapes: '++id, url, kind, createdAt, title',
      profiles: '++id, name, updatedAt',
      recipes: '++id, name, updatedAt',
      logs: '++id, ts, kind',
    });
    this.version(2).stores({
      memories: '++id, category, enabled, updatedAt, createdAt',
      skills: '++id, name, enabled, updatedAt, *triggers',
    });
    this.version(3).stores({
      examples: '++id, tag, createdAt',
      knowledge: '++id, category, enabled, updatedAt',
    });
  }
}

export const db = new AppDatabase();

/* ---------------------------------------------------------------------------
 * Chat helpers
 * ------------------------------------------------------------------------- */

export async function listRecentChats(limit = 30): Promise<ChatSessionMeta[]> {
  const rows = await db.chats.orderBy('updatedAt').reverse().limit(limit).toArray();
  return rows.map((c) => ({
    id: c.id!,
    title: c.title,
    model: c.model,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: c.messages.length,
    preview: c.messages.find((m) => m.role === 'user')?.content?.slice(0, 80) ?? '',
  }));
}

export const listChatMetas = listRecentChats;

export async function searchChats(query: string, limit = 20): Promise<ChatSessionMeta[]> {
  const q = query.trim().toLowerCase();
  if (!q) return listRecentChats(limit);
  const rows = await db.chats
    .orderBy('updatedAt')
    .reverse()
    .filter((c) => c.title.toLowerCase().includes(q) || c.searchText.toLowerCase().includes(q))
    .limit(limit)
    .toArray();
  return rows.map((c) => ({
    id: c.id!,
    title: c.title,
    model: c.model,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messageCount: c.messages.length,
    preview: c.messages.find((m) => m.role === 'user')?.content?.slice(0, 80) ?? '',
  }));
}

export async function getChat(id: number): Promise<StoredChat | undefined> {
  return db.chats.get(id);
}

export async function upsertChat(chat: StoredChat): Promise<number> {
  const searchText = chat.messages.map((m) => m.content).join('\n');
  const now = Date.now();
  if (chat.id !== undefined) {
    await db.chats.update(chat.id, {
      ...chat,
      updatedAt: now,
      searchText,
    });
    return chat.id;
  }
  const id = await db.chats.add({
    ...chat,
    createdAt: chat.createdAt ?? now,
    updatedAt: now,
    searchText,
  });
  if (id === undefined) throw new Error('Failed to persist chat');
  return id;
}

export const persistSession = (
  existingId: number | null,
  messages: ChatMessage[],
  contextSlots: ChatAttachment[],
  title?: string,
  model?: string,
) =>
  upsertChat({
    ...(existingId !== null ? { id: existingId } : {}),
    title: title ?? (messages.find((m) => m.role === 'user')?.content?.slice(0, 40) ?? 'New Chat'),
    model: model ?? '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages,
    contextSlots,
    searchText: '',
  });

export async function deleteChat(id: number): Promise<void> {
  await db.chats.delete(id);
}

/* ---------------------------------------------------------------------------
 * Prompt helpers (Phase 2 templates + saved prompts)
 * ------------------------------------------------------------------------- */

export async function listPrompts(kind?: string): Promise<StoredPrompt[]> {
  let query = db.prompts.orderBy('updatedAt').reverse();
  const rows = await (kind ? query.filter((p) => p.kind === kind) : query).toArray();
  return rows;
}

export async function upsertPrompt(prompt: StoredPrompt): Promise<number> {
  const record: StoredPrompt = {
    ...prompt,
    updatedAt: Date.now(),
    createdAt: prompt.createdAt ?? Date.now(),
  };
  const id = await db.prompts.put(record);
  if (id === undefined) throw new Error('Failed to persist prompt');
  return id;
}

export async function deletePrompt(id: number): Promise<void> {
  await db.prompts.delete(id);
}

/* ---------------------------------------------------------------------------
 * Scrapes / profiles / recipes (Phases 3-4)
 * ------------------------------------------------------------------------- */

export async function listProfiles(): Promise<StoredProfile[]> {
  return db.profiles.orderBy('updatedAt').reverse().toArray();
}

export async function upsertProfile(profile: StoredProfile): Promise<number> {
  const record: StoredProfile = { ...profile, updatedAt: Date.now(), createdAt: profile.createdAt ?? Date.now() };
  const id = await db.profiles.put(record);
  if (id === undefined) throw new Error('Failed to persist profile');
  return id;
}

export async function deleteProfile(id: number): Promise<void> {
  await db.profiles.delete(id);
}

export async function saveScrape(scrape: StoredScrape): Promise<number> {
  const id = await db.scrapes.add(scrape);
  if (id === undefined) throw new Error('Failed to persist scrape');
  return Number(id);
}

export async function listScrapes(limit = 50): Promise<StoredScrape[]> {
  return db.scrapes.orderBy('createdAt').reverse().limit(limit).toArray();
}

export async function deleteScrape(id: number): Promise<void> {
  await db.scrapes.delete(id);
}

export async function listRecipes(): Promise<StoredRecipe[]> {
  return db.recipes.orderBy('updatedAt').reverse().toArray();
}

export async function saveRecipe(recipe: StoredRecipe): Promise<number> {
  const record: StoredRecipe = { ...recipe, updatedAt: Date.now(), createdAt: recipe.createdAt ?? Date.now() };
  const id = await db.recipes.put(record);
  if (id === undefined) throw new Error('Failed to persist recipe');
  return id;
}

export async function deleteRecipe(id: number): Promise<void> {
  await db.recipes.delete(id);
}

/* ---------------------------------------------------------------------------
 * Memory helpers (Persistent Long-Term Memory)
 * ------------------------------------------------------------------------- */

export async function listMemories(): Promise<StoredMemory[]> {
  return db.memories.orderBy('updatedAt').reverse().toArray();
}

export async function getEnabledMemories(): Promise<StoredMemory[]> {
  return db.memories.filter((m) => m.enabled).toArray();
}

export async function upsertMemory(memory: Partial<StoredMemory> & { fact: string; category: MemoryCategory }): Promise<number> {
  const record: StoredMemory = {
    category: memory.category,
    fact: memory.fact.trim(),
    source: memory.source ?? 'user-added',
    enabled: memory.enabled ?? true,
    updatedAt: Date.now(),
    createdAt: memory.createdAt ?? Date.now(),
  };
  if (memory.id !== undefined) record.id = memory.id;
  const id = await db.memories.put(record);
  if (id === undefined) throw new Error('Failed to persist memory');
  return id;
}

export async function toggleMemory(id: number, enabled: boolean): Promise<void> {
  await db.memories.update(id, { enabled, updatedAt: Date.now() });
}

export async function deleteMemory(id: number): Promise<void> {
  await db.memories.delete(id);
}

/* ---------------------------------------------------------------------------
 * Skills helpers (Modular Custom Skills)
 * ------------------------------------------------------------------------- */

export async function listSkills(): Promise<StoredSkill[]> {
  return db.skills.orderBy('updatedAt').reverse().toArray();
}

export async function getEnabledSkills(): Promise<StoredSkill[]> {
  return db.skills.filter((s) => s.enabled).toArray();
}

export async function upsertSkill(skill: Partial<StoredSkill> & { name: string; instructions: string }): Promise<number> {
  const record: StoredSkill = {
    name: skill.name.trim(),
    description: (skill.description ?? '').trim(),
    instructions: skill.instructions.trim(),
    triggers: skill.triggers ?? [],
    enabled: skill.enabled ?? true,
    updatedAt: Date.now(),
    createdAt: skill.createdAt ?? Date.now(),
  };
  if (skill.id !== undefined) record.id = skill.id;
  const id = await db.skills.put(record);
  if (id === undefined) throw new Error('Failed to persist skill');
  return id;
}

export async function toggleSkill(id: number, enabled: boolean): Promise<void> {
  await db.skills.update(id, { enabled, updatedAt: Date.now() });
}

export async function deleteSkill(id: number): Promise<void> {
  await db.skills.delete(id);
}

/* ---------------------------------------------------------------------------
 * Example Bank helpers (Few-Shot Examples - Feature 3)
 * ------------------------------------------------------------------------- */

export async function addExample(
  tag: string,
  userPrompt: string,
  assistantResponse: string,
): Promise<number> {
  const id = await db.examples.add({
    tag: tag.trim().toLowerCase(),
    userPrompt: userPrompt.trim(),
    assistantResponse: assistantResponse.trim(),
    createdAt: Date.now(),
  });
  if (id === undefined) throw new Error('Failed to persist example');
  return id;
}

export async function getExamplesByTag(tag: string, limit = 3): Promise<StoredExample[]> {
  return db.examples
    .where('tag')
    .equals(tag.trim().toLowerCase())
    .reverse()
    .limit(limit)
    .toArray();
}

export async function searchExamples(query: string, limit = 3): Promise<StoredExample[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return db.examples
    .orderBy('createdAt')
    .reverse()
    .filter((e) => e.userPrompt.toLowerCase().includes(q) || e.tag.includes(q))
    .limit(limit)
    .toArray();
}

export async function listExamples(limit = 50): Promise<StoredExample[]> {
  return db.examples.orderBy('createdAt').reverse().limit(limit).toArray();
}

export async function deleteExample(id: number): Promise<void> {
  await db.examples.delete(id);
}

/* ---------------------------------------------------------------------------
 * Knowledge Base helpers (Domain Knowledge - Feature 5)
 * ------------------------------------------------------------------------- */

export async function listKnowledge(): Promise<StoredKnowledge[]> {
  return db.knowledge.orderBy('updatedAt').reverse().toArray();
}

export async function getEnabledKnowledge(): Promise<StoredKnowledge[]> {
  return db.knowledge.filter((k) => k.enabled).toArray();
}

export async function upsertKnowledge(
  item: Partial<StoredKnowledge> & { title: string; content: string; category: KnowledgeCategory },
): Promise<number> {
  const record: StoredKnowledge = {
    category: item.category,
    title: item.title.trim(),
    content: item.content.trim(),
    enabled: item.enabled ?? true,
    updatedAt: Date.now(),
    createdAt: item.createdAt ?? Date.now(),
  };
  if (item.id !== undefined) record.id = item.id;
  const id = await db.knowledge.put(record);
  if (id === undefined) throw new Error('Failed to persist knowledge');
  return id;
}

export async function toggleKnowledge(id: number, enabled: boolean): Promise<void> {
  await db.knowledge.update(id, { enabled, updatedAt: Date.now() });
}

export async function deleteKnowledge(id: number): Promise<void> {
  await db.knowledge.delete(id);
}

/* ---------------------------------------------------------------------------
 * Seed default memories and skills if empty
 * ------------------------------------------------------------------------- */

export async function seedMemoryAndSkillsIfEmpty(): Promise<void> {
  const countMemories = await db.memories.count();
  if (countMemories === 0) {
    const initialMemories: StoredMemory[] = [
      {
        category: 'persona',
        fact: 'User is Zonaed, a digital marketer, founder, and strategist. PC Specs: i5 6th Gen, 16GB RAM, GTX 1660 6GB, 256GB SSD, Windows, Antigravity + VS Code.',
        source: 'user-added',
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        category: 'rule',
        fact: 'STRICT RULE: Never use em-dashes (—) or en-dashes (–) anywhere. Use simple commas, periods, colons, or clean bullet points.',
        source: 'user-added',
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        category: 'preference',
        fact: 'When speaking in Bangla, use natural, conversational, tech-savvy Bangladeshi Bangla (addressing user as "তুমি/তোমার"). Keep English tech terms natural (e.g. "তোমার PC দিয়ে", "architecture-টা", "controlled Agent Runtime", "main strategy").',
        source: 'user-added',
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        category: 'preference',
        fact: 'Strictly avoid robotic AI clichés like "delve", "testament", "tapestry", "embark", "furthermore", "moreover", "in conclusion", "beacon", "game-changer", "unleash".',
        source: 'user-added',
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        category: 'business',
        fact: 'Architecture Strategy: Use local lightweight tools + Cloud/Free APIs (Groq, Gemini, OpenRouter) for heavy 27B-120B models instead of overloading local GPU.',
        source: 'user-added',
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    await db.memories.bulkAdd(initialMemories);
  }

  const countSkills = await db.skills.count();
  if (countSkills === 0) {
    const initialSkills: StoredSkill[] = [
      {
        name: 'Digital Marketing Strategist',
        description: 'Comprehensive digital marketing planning across SMM, paid ads, content pillars, and email funnels.',
        instructions: `When giving marketing advice, act as a top-tier digital marketing director:
1. Provide actionable campaign structures for Meta Ads and Google Ads.
2. Formulate 4 clear content pillars: Problem-Awareness, Product Showcase, Social Proof, and Direct Conversion.
3. Suggest 5-step email welcome sequences and lead magnets.
4. Always break down advice into 30-60-90 day execution steps.`,
        triggers: ['marketing', 'campaign', 'smm', 'paid ads', 'funnel', 'lead generation', 'content pillar'],
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: 'Direct Response Copywriter',
        description: 'High-converting social posts, landing page headlines, hooks, and emails.',
        instructions: `When writing copy:
1. Lead with a compelling hook in the first 2 lines.
2. Focus heavily on customer benefits, pain points, and transformation rather than generic features.
3. Keep sentences punchy, conversational, and rhythmically varied.
4. Conclude with a single, unambiguous call to action (CTA).`,
        triggers: ['copy', 'copywriting', 'hook', 'headline', 'sales pitch', 'landing page', 'ad copy'],
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        name: 'Code Reviewer & Architecture Optimizer',
        description: 'Analyzes code quality, TypeScript type safety, performance, and clean architecture.',
        instructions: `When analyzing code:
1. Identify edge cases, race conditions, and type safety issues.
2. Offer concrete, concise refactoring snippets rather than long theoretical explanations.
3. Preserve existing code style and minimize unnecessary dependencies.`,
        triggers: ['code', 'typescript', 'javascript', 'refactor', 'bug', 'debug', 'review code', 'function'],
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
    await db.skills.bulkAdd(initialSkills);
  }
}

/* ---------------------------------------------------------------------------
 * Automation audit log & Storage Management
 * ------------------------------------------------------------------------- */

export async function appendLog(kind: string, message: string, detail?: string): Promise<void> {
  await db.logs.add({ ts: Date.now(), kind, message, detail });
}

export interface StorageStats {
  usedBytes: number;
  totalQuotaBytes: number;
  chatsCount: number;
  messagesCount: number;
  memoriesCount: number;
  skillsCount: number;
  promptsCount: number;
  profilesCount: number;
}

export async function getStorageStats(): Promise<StorageStats> {
  let usedBytes = 0;
  let totalQuotaBytes = 0;
  if (navigator?.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usedBytes = estimate.usage ?? 0;
      totalQuotaBytes = estimate.quota ?? 0;
    } catch {}
  }

  const [chats, memoriesCount, skillsCount, promptsCount, profilesCount] = await Promise.all([
    db.chats.toArray(),
    db.memories.count(),
    db.skills.count(),
    db.prompts.count(),
    db.profiles.count(),
  ]);

  const messagesCount = chats.reduce((acc, c) => acc + (c.messages?.length ?? 0), 0);

  return {
    usedBytes,
    totalQuotaBytes,
    chatsCount: chats.length,
    messagesCount,
    memoriesCount,
    skillsCount,
    promptsCount,
    profilesCount,
  };
}

export async function clearAllChats(): Promise<void> {
  await db.chats.clear();
}

export async function clearScrapesAndLogs(): Promise<void> {
  await Promise.all([db.scrapes.clear(), db.logs.clear()]);
}

export async function factoryResetAllData(): Promise<void> {
  await Promise.all([
    db.chats.clear(),
    db.scrapes.clear(),
    db.logs.clear(),
    db.prompts.clear(),
    db.profiles.clear(),
    db.memories.clear(),
    db.skills.clear(),
  ]);
  await seedMemoryAndSkillsIfEmpty();
}