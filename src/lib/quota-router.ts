import type { Settings } from '@/store/settings-store';
import type { OllamaModel } from '@/shared/types';
import { isGeminiModel } from '@/lib/gemini';
import { isCloudModel, parseCloudModel } from '@/lib/openai-compatible';

export interface RouteCandidate {
  model: string;
  provider: 'gemini' | 'groq' | 'openrouter' | 'deepseek' | 'ollama';
  label: string;
}

/**
 * Detects if an error is a transient quota, rate-limit, or high-demand issue
 * that warrants an automatic failover to another available model/provider.
 */
export function isTransientCapacityError(error: any): boolean {
  if (!error) return false;
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('too large') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('overloaded') ||
    msg.includes('capacity') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('tpm') ||
    msg.includes('rpm') ||
    msg.includes('service unavailable')
  );
}

/**
 * Builds an intelligent prioritized list of model candidates.
 * When `requestedModel === 'auto'` or when a model experiences high demand,
 * the agent smoothly routes to the next healthy provider with active quota.
 */
export function getRouteCandidates(
  requestedModel: string,
  settings: Settings,
  localModels: OllamaModel[] = [],
): RouteCandidate[] {
  const hasServerProxy = Boolean(settings.serverProxyUrl?.trim() || settings.pinSessionToken?.trim());
  const hasGroq = Boolean(settings.groqApiKey?.trim()) || hasServerProxy;
  const hasGemini = Boolean(settings.geminiApiKey?.trim()) || hasServerProxy;
  const hasOpenRouter = Boolean(settings.openRouterApiKey?.trim()) || hasServerProxy;
  const hasDeepSeek = Boolean(settings.deepSeekApiKey?.trim()) || hasServerProxy;
  const hasLocal = localModels.length > 0;

  // Build pool of all viable healthy providers in optimal priority
  const pool: RouteCandidate[] = [];

  if (hasGroq) {
    pool.push({
      model: 'groq:qwen/qwen3.8-27b',
      provider: 'groq',
      label: 'Qwen 3.8 27B (Groq)',
    });
    pool.push({
      model: 'groq:openai/gpt-oss-120b',
      provider: 'groq',
      label: 'GPT-OSS 120B (Groq)',
    });
    pool.push({
      model: 'groq:openai/gpt-oss-20b',
      provider: 'groq',
      label: 'GPT-OSS 20B (Groq)',
    });
    pool.push({
      model: 'groq:qwen/qwen3.6-27b',
      provider: 'groq',
      label: 'Qwen 3.6 27B (Groq)',
    });
  }

  if (hasGemini) {
    pool.push({
      model: 'gemini-3.7-flash',
      provider: 'gemini',
      label: 'Gemini 3.7 Flash',
    });
    pool.push({
      model: 'gemini-3.6-flash',
      provider: 'gemini',
      label: 'Gemini 3.6 Flash',
    });
  }

  if (hasOpenRouter) {
    pool.push({
      model: 'openrouter:openrouter/free',
      provider: 'openrouter',
      label: 'OpenRouter Free Auto',
    });
    pool.push({
      model: 'openrouter:nvidia/nemotron-3-super-120b-a12b:free',
      provider: 'openrouter',
      label: 'Nemotron 120B (OpenRouter)',
    });
  }

  if (hasDeepSeek) {
    pool.push({
      model: 'deepseek:deepseek-chat',
      provider: 'deepseek',
      label: 'DeepSeek V3 (Official)',
    });
  }

  if (hasLocal && localModels[0]) {
    pool.push({
      model: localModels[0].name,
      provider: 'ollama',
      label: `${localModels[0].name} (Local)`,
    });
  }

  // If user selected "auto", use the smart prioritized pool
  if (requestedModel === 'auto' || !requestedModel) {
    return pool.length > 0
      ? pool
      : [
          {
            model: 'gemini-3.7-flash',
            provider: 'gemini',
            label: 'Gemini 3.7 Flash',
          },
        ];
  }

  // If user selected a specific model, make it candidate #1
  const firstCandidate: RouteCandidate = {
    model: requestedModel,
    provider: isGeminiModel(requestedModel)
      ? 'gemini'
      : isCloudModel(requestedModel)
      ? parseCloudModel(requestedModel).provider
      : 'ollama',
    label: requestedModel,
  };

  // Filter out the requested model from the fallback pool so we don't retry the same failing model
  const fallbacks = pool.filter((c) => c.model !== requestedModel);

  return [firstCandidate, ...fallbacks];
}
