/**
 * Chain-of-Draft (Feature 6)
 * For complex content requests, generates an outline first,
 * then expands to full draft only after user approval.
 */

/**
 * Determine if the user's request is complex enough to benefit from
 * a draft-first approach (outline before full content).
 */
export function shouldUseDraftMode(userPrompt: string): boolean {
  const lower = userPrompt.toLowerCase();

  // Structural content keywords that benefit from outline-first
  const draftTriggers = [
    'blog post', 'blog', 'article', 'write an article',
    'proposal', 'business plan', 'marketing plan',
    'strategy document', 'whitepaper', 'case study',
    'comprehensive', 'detailed report', 'full guide',
    'ব্লগ পোস্ট', 'আর্টিকেল লিখ', 'বিজনেস প্ল্যান',
    'প্রপোজাল', 'স্ট্র্যাটেজি ডকুমেন্ট', 'বিস্তারিত',
  ];

  const hasTrigger = draftTriggers.some((t) => lower.includes(t));

  // Only trigger draft mode for substantial requests
  const isSubstantial = userPrompt.trim().length > 80;

  return hasTrigger && isSubstantial;
}

/**
 * Build a draft-mode system instruction that asks the model
 * to produce an outline first instead of the full content.
 */
export function buildDraftInstruction(): string {
  return `[DRAFT MODE ACTIVE]
IMPORTANT: Do NOT write the full content yet. Instead:

1. Create a structured outline with:
   - 3-5 main sections
   - 2-3 key points per section
   - Estimated word count per section

2. At the end, ask the user:
   "এই outline ঠিক আছে? কিছু পরিবর্তন করতে চাইলে বলো, নাহলে 'লিখো' বা 'proceed' বললেই full draft লিখে দেব।"

3. Wait for user approval before writing the complete content.`;
}

/**
 * Detect if the user is approving a previously shown draft outline.
 */
export function isDraftApproval(text: string): boolean {
  const lower = text.trim().toLowerCase();

  const approvalPatterns = [
    'approve', 'approved', 'go ahead', 'proceed', 'write it',
    'looks good', 'ok', 'ঠিক আছে', 'লিখো', 'এগিয়ে যাও',
    'চালাও', 'হ্যাঁ', 'yes', 'letsgo', "let's go", 'do it',
    'full draft', 'write the full', 'complete it',
  ];

  return approvalPatterns.some((p) => lower.includes(p));
}

/**
 * Build a system instruction for generating the full draft
 * based on the previously approved outline.
 */
export function buildFullDraftInstruction(outlineContent: string): string {
  return `[FULL DRAFT MODE - Expanding Approved Outline]
The user approved the following outline. Now write the complete, detailed content:

--- APPROVED OUTLINE ---
${outlineContent.slice(0, 3000)}
--- END OUTLINE ---

Instructions:
1. Follow the exact structure from the outline above.
2. Maintain consistent tone and quality throughout.
3. Each section should be well-developed with concrete details.
4. Do NOT ask for further approval, just write the complete content.`;
}
