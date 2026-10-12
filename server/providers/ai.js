/**
 * Facade unificada de Provedores de IA:
 * Prioriza o motor hibrido OpenRouter (JEV + DeepSeek v4.1 Flash),
 * com fallback para Anthropic (se configurado) e motor local offline.
 */
import { config, hasOpenRouter } from '../config.js';
import * as openrouter from './openrouter.js';
import * as anthropic from './anthropic.js';

export const provedorDisponivel = () =>
  hasOpenRouter() || anthropic.provedorDisponivel();

export const modeloAtual = () => {
  if (hasOpenRouter()) {
    return `${config.openrouter.jevModel} (JEV) + ${config.openrouter.mainModel}`;
  }
  if (anthropic.provedorDisponivel()) {
    return config.anthropic.model;
  }
  return 'motor local offline';
};

/**
 * Completa texto usando o modelo principal disponivel.
 */
export async function completar({ system, prompt, maxTokens }) {
  if (hasOpenRouter()) {
    return openrouter.completar({ system, prompt, maxTokens });
  }
  if (anthropic.provedorDisponivel()) {
    return anthropic.completar({ system, prompt, maxTokens });
  }
  throw new Error('Nenhum provedor de IA disponivel');
}

/**
 * Resposta em streaming.
 */
export async function completarStream({ system, prompt, maxTokens }, onDelta) {
  if (hasOpenRouter()) {
    return openrouter.completarStream({ system, prompt, maxTokens }, onDelta);
  }
  if (anthropic.provedorDisponivel()) {
    return anthropic.completarStream({ system, prompt, maxTokens }, onDelta);
  }
  throw new Error('Nenhum provedor de IA disponivel');
}

/**
 * Extrai JSON de texto livre.
 */
export function extrairJson(texto) {
  return openrouter.extrairJson(texto) || anthropic.extrairJson(texto);
}

export { openrouter, anthropic };
