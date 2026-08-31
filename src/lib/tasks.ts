/**
 * Context-menu / popup task templates ("Summarize / Rewrite / Translate
 * selection", "Ask about this page", quick chat). Tasks are turned into chat
 * turns by the side panel — the templates below are injected as the user-side
 * instruction, while the attached content goes into a context slot.
 */
import type { ContextTask, ContextTaskKind } from '@/shared/types';
import { uid } from '@/lib/util';

export const TASK_LABELS: Record<ContextTaskKind, string> = {
  summarize: 'Summarize selection',
  rewrite: 'Rewrite selection',
  translate: 'Translate selection',
  'ask-page': 'Ask about this page',
  'quick-chat': 'Quick chat',
  'extract-page': 'Extract page data',
  ocr: 'OCR image text',
};

export const TRANSLATE_TARGET_LANGS = [
  'English',
  'Bengali (বাংলা)',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Dutch',
  'Polish',
  'Turkish',
  'Japanese',
  'Chinese (Simplified)',
  'Korean',
  'Arabic',
  'Russian',
  'Hindi',
];

export function makeTask(
  kind: ContextTaskKind,
  partial: Partial<ContextTask> = {},
): ContextTask {
  return {
    id: uid(),
    kind,
    createdAt: Date.now(),
    ...partial,
  };
}

/** User-turn instruction for each task kind. */
export function buildTaskUserPrompt(task: ContextTask): string {
  switch (task.kind) {
    case 'summarize':
      return 'Summarize the selected text. Capture the key points and keep it tight — no preamble.';
    case 'rewrite':
      return 'Rewrite the selected text to be clearer and more polished, preserving its meaning and tone. Show only the rewritten text.';
    case 'translate':
      return `Translate the selected text into ${task.targetLang ?? 'English'}. Respond with only the translation.`;
    case 'ask-page':
      return task.text?.trim() || 'Summarize this page in a few paragraphs, then list the main takeaways as bullets.';
    case 'quick-chat':
      return task.text?.trim() || '';
    case 'extract-page':
      return 'Below is the page content attached as context. Extract the main facts, data, and links into clean structured markdown (tables where appropriate).';
    case 'ocr':
      return 'The attached context was extracted via OCR from the screen. Please analyze and structure this information clearly.';
    default:
      return task.text?.trim() || '';
  }
}

/** Optional one-line hint added to the system prompt for this task. */
export function buildTaskHint(task: ContextTask): string {
  switch (task.kind) {
    case 'translate':
      return `Translate to ${task.targetLang ?? 'English'}.`;
    case 'summarize':
      return 'Summarize the attached selection/page.';
    case 'rewrite':
      return 'Polish/rewrite the attached selection.';
    case 'extract-page':
      return 'Structured extraction from the attached page.';
    default:
      return '';
  }
}

/** True when the task needs the page/selction attached as a context slot. */
export function taskNeedsContent(task: ContextTask): boolean {
  return task.kind === 'summarize' || task.kind === 'rewrite' || task.kind === 'translate' ||
    task.kind === 'extract-page';
}