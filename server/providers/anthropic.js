/**
 * Provedor opcional de IA (Claude).
 * Ativo apenas quando ANTHROPIC_API_KEY esta definida.
 * Sem a chave, todo o sistema funciona com o motor de analise local.
 */
import { config, hasAiProvider } from '../config.js';
import { logger, AppError } from '../utils/index.js';

const TIMEOUT_MS = 60_000;

async function chamar({ system, messages, maxTokens, stream = false }) {
  if (!hasAiProvider()) throw new AppError(503, 'Provedor de IA nao configurado');

  const controlador = new AbortController();
  const timer = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const resposta = await fetch(config.anthropic.baseUrl, {
      method: 'POST',
      signal: controlador.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropic.apiKey,
        'anthropic-version': config.anthropic.version,
      },
      body: JSON.stringify({
        model: config.anthropic.model,
        max_tokens: maxTokens || config.anthropic.maxTokens,
        system,
        messages,
        stream,
      }),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      logger.warn('Falha na API Anthropic:', resposta.status, detalhe.slice(0, 300));
      throw new AppError(
        resposta.status === 401 ? 401 : 502,
        resposta.status === 401
          ? 'Chave da API invalida'
          : `Provedor de IA respondeu ${resposta.status}`,
      );
    }

    return resposta;
  } catch (erro) {
    if (erro.name === 'AbortError') {
      throw new AppError(504, 'O provedor de IA nao respondeu no tempo limite');
    }
    throw erro;
  } finally {
    clearTimeout(timer);
  }
}

/** Resposta completa em texto. */
export async function completar({ system, prompt, maxTokens }) {
  const resposta = await chamar({
    system,
    messages: [{ role: 'user', content: prompt }],
    maxTokens,
  });

  const dados = await resposta.json();
  return (dados.content || [])
    .filter((bloco) => bloco.type === 'text')
    .map((bloco) => bloco.text)
    .join('')
    .trim();
}

/**
 * Resposta em streaming.
 * @param {(texto: string) => void} onDelta chamado a cada pedaco de texto
 */
export async function completarStream({ system, prompt, maxTokens }, onDelta) {
  const resposta = await chamar({
    system,
    messages: [{ role: 'user', content: prompt }],
    maxTokens,
    stream: true,
  });

  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  let buffer = '';
  let completo = '';

  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;

    buffer += decodificador.decode(value, { stream: true });
    const linhas = buffer.split('\n');
    buffer = linhas.pop() || '';

    for (const linha of linhas) {
      if (!linha.startsWith('data: ')) continue;
      const payload = linha.slice(6).trim();
      if (!payload || payload === '[DONE]') continue;

      try {
        const evento = JSON.parse(payload);
        if (evento.type === 'content_block_delta' && evento.delta?.text) {
          completo += evento.delta.text;
          onDelta(evento.delta.text);
        }
      } catch {
        /* evento parcial; sera completado no proximo chunk */
      }
    }
  }

  return completo;
}

/** Extrai o primeiro objeto JSON de um texto livre. */
export function extrairJson(texto) {
  const comBloco = texto.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidato = comBloco ? comBloco[1] : texto;

  const inicio = candidato.indexOf('{');
  const fim = candidato.lastIndexOf('}');
  if (inicio === -1 || fim <= inicio) return null;

  try {
    return JSON.parse(candidato.slice(inicio, fim + 1));
  } catch {
    return null;
  }
}

export const provedorDisponivel = hasAiProvider;
export const modeloAtual = () => config.anthropic.model;
