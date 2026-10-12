/**
 * Provedor OpenRouter Hibrido:
 * - JEV Decision Engine (typesafe/jev-1.13 via /api/alpha/decisions)
 * - LLM Principal de Geracao (deepseek/deepseek-v4.1-flash via /api/v1/chat/completions)
 *
 * Executa chamadas em paralelo de forma segura e resiliente, com tratamento
 * robusto de timeouts, falhas e parseamento estruturado.
 */
import { config, hasOpenRouter } from '../config.js';
import { logger, AppError } from '../utils/index.js';

const DEFAULT_TIMEOUT_MS = 40_000;

/** Monta headers padrao para o OpenRouter. */
function buildHeaders() {
  if (!hasOpenRouter()) {
    throw new AppError(503, 'Chave da API OpenRouter nao configurada');
  }
  return {
    'Authorization': `Bearer ${config.openrouter.apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'Tutor de Programacao',
  };
}

/**
 * Invoca o motor de decisoes JEV (typesafe/jev-1.13) na rota alpha/decisions.
 * @param {object} params
 * @param {object|string} params.state Estado a ser avaliado
 * @param {object} params.questions Dicionario de perguntas/criterios de decisao
 * @param {string} [params.model] Modelo do JEV (padrao: typesafe/jev-1.13)
 * @param {number} [params.timeoutMs]
 * @returns {Promise<{ ok: boolean, model: string, answers: object, usage?: object, latencyMs: number, error?: string }>}
 */
export async function callJevDecisions({
  state,
  questions,
  model = config.openrouter.jevModel,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const inicio = Date.now();
  if (!hasOpenRouter()) {
    return {
      ok: false,
      model,
      answers: {},
      latencyMs: 0,
      error: 'OpenRouter nao configurado',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${config.openrouter.baseUrl}/alpha/decisions`;
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: buildHeaders(),
      body: JSON.stringify({
        model,
        state: state || {},
        questions: questions || {},
      }),
    });

    const latencyMs = Date.now() - inicio;

    if (!res.ok) {
      const detalhe = await res.text();
      logger.warn(`JEV (${model}) erro HTTP ${res.status}: ${detalhe.slice(0, 300)}`);
      return {
        ok: false,
        model,
        answers: {},
        latencyMs,
        error: `JEV HTTP ${res.status}: ${detalhe.slice(0, 150)}`,
      };
    }

    const json = await res.json();
    return {
      ok: true,
      model: json.model || model,
      answers: json.answers || {},
      usage: json.usage,
      latencyMs,
      id: json.id,
      provider: json.provider || 'TypeSafe',
    };
  } catch (err) {
    const latencyMs = Date.now() - inicio;
    const msg = err.name === 'AbortError' ? 'Timeout no JEV' : err.message;
    logger.warn('Falha na chamada JEV:', msg);
    return {
      ok: false,
      model,
      answers: {},
      latencyMs,
      error: msg,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chamada de chat completions no OpenRouter para o modelo principal (ex: DeepSeek v4.1 Flash).
 * @param {object} params
 * @param {string} [params.system]
 * @param {Array<{role: string, content: string}>} [params.messages]
 * @param {number} [params.maxTokens]
 * @param {number} [params.temperature]
 * @param {string} [params.model]
 * @param {boolean} [params.stream]
 * @param {number} [params.timeoutMs]
 */
export async function callChatCompletions({
  system,
  messages = [],
  maxTokens = 3000,
  temperature = 0.3,
  model = config.openrouter.mainModel,
  stream = false,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const inicio = Date.now();
  if (!hasOpenRouter()) throw new AppError(503, 'OpenRouter nao configurado');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const payloadMessages = [];
  if (system) {
    payloadMessages.push({ role: 'system', content: system });
  }
  payloadMessages.push(...messages);

  try {
    const url = `${config.openrouter.baseUrl}/v1/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: buildHeaders(),
      body: JSON.stringify({
        model,
        messages: payloadMessages,
        max_tokens: maxTokens,
        temperature,
        stream,
      }),
    });

    const latencyMs = Date.now() - inicio;

    if (!res.ok) {
      const detalhe = await res.text();
      logger.warn(`OpenRouter (${model}) erro HTTP ${res.status}: ${detalhe.slice(0, 300)}`);
      throw new AppError(
        res.status === 401 ? 401 : 502,
        res.status === 401
          ? 'Chave OpenRouter invalida'
          : `OpenRouter respondeu ${res.status}`,
      );
    }

    if (stream) return res;

    const dados = await res.json();
    const choice = dados.choices?.[0];
    let content = choice?.message?.content || '';

    // Remove eventuais tags <think>...</think> retornadas pelo DeepSeek
    if (content.includes('</think>')) {
      const semThink = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (semThink) content = semThink;
    }

    // Se o content contiver monólogo de raciocínio/scratchpad em inglês sem tags <think>
    if (
      content &&
      /^(we need|need follow|user wants|state carrinho|need respond|i need to|let's think|the user says|rule \d+:|instructions:)/i.test(
        content.trim(),
      )
    ) {
      const jsonNoContent = extrairJson(content);
      if (jsonNoContent) {
        content = JSON.stringify(jsonNoContent);
      } else {
        // NUNCA vaze o monólogo interno de raciocínio do modelo como texto
        content = '';
      }
    }

    // Se o modelo devolver apenas reasoning e content vazio, tenta extrair JSON do reasoning
    if (!content && choice?.message?.reasoning) {
      const jsonNoReasoning = extrairJson(choice.message.reasoning);
      if (jsonNoReasoning) {
        content = JSON.stringify(jsonNoReasoning);
      } else {
        // NUNCA vaze o monólogo interno de raciocínio do modelo como texto para o usuário
        content = '';
      }
    }

    return {
      ok: true,
      text: content.trim(),
      reasoning: choice?.message?.reasoning || null,
      model: dados.model || model,
      usage: dados.usage,
      latencyMs,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new AppError(504, 'O modelo LLM nao respondeu dentro do tempo limite');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resposta completa em texto usando a LLM principal.
 */
export async function completar({
  system,
  prompt,
  maxTokens,
  model = config.openrouter.mainModel,
}) {
  const res = await callChatCompletions({
    system,
    messages: [{ role: 'user', content: prompt }],
    maxTokens,
    model,
  });
  return res.text;
}

/**
 * Resposta em streaming via OpenRouter.
 * @param {object} params
 * @param {(texto: string) => void} onDelta
 */
export async function completarStream(
  { system, prompt, maxTokens, model = config.openrouter.mainModel },
  onDelta,
) {
  const resposta = await callChatCompletions({
    system,
    messages: [{ role: 'user', content: prompt }],
    maxTokens,
    model,
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
        const delta = evento.choices?.[0]?.delta;
        const texto = delta?.content || delta?.reasoning || '';
        if (texto) {
          completo += texto;
          onDelta(texto);
        }
      } catch {
        /* chunk parcial */
      }
    }
  }

  return completo;
}

/**
 * Executa JEV (decisoes) e LLM principal (geracao) EM PARALELO de forma hibrida.
 * Ambas as requisicoes partem ao mesmo tempo, garantindo minima latencia e total resiliencia.
 *
 * @param {object} params
 * @param {object} params.jevState Estado para o JEV
 * @param {object} params.jevQuestions Perguntas e criterios para o JEV
 * @param {string} params.llmPrompt Prompt para a LLM principal
 * @param {string} params.llmSystem Prompt de sistema para a LLM principal
 * @param {number} [params.maxTokens]
 * @returns {Promise<{ jev: object, llm: object, totalLatencyMs: number, hybrid: boolean }>}
 */
export async function executeHybrid({
  jevState,
  jevQuestions,
  llmPrompt,
  llmSystem,
  messages,
  llmMessages,
  maxTokens = 3000,
}) {
  const inicio = Date.now();

  const jevPromise = callJevDecisions({
    state: jevState,
    questions: jevQuestions,
  });

  const chatMessages = messages || llmMessages || [{ role: 'user', content: llmPrompt }];

  const llmPromise = callChatCompletions({
    system: llmSystem,
    messages: chatMessages,
    maxTokens,
  }).catch((err) => ({
    ok: false,
    text: '',
    error: err.message,
    model: config.openrouter.mainModel,
  }));

  // Execucao simultanea paralela
  const [jevResultSettled, llmResultSettled] = await Promise.allSettled([
    jevPromise,
    llmPromise,
  ]);

  const jevResult =
    jevResultSettled.status === 'fulfilled'
      ? jevResultSettled.value
      : { ok: false, error: jevResultSettled.reason?.message, answers: {} };

  const llmResult =
    llmResultSettled.status === 'fulfilled'
      ? llmResultSettled.value
      : { ok: false, error: llmResultSettled.reason?.message, text: '' };

  const totalLatencyMs = Date.now() - inicio;

  return {
    jev: jevResult,
    llm: llmResult,
    totalLatencyMs,
    hybrid: true,
  };
}

/**
 * Extrai JSON estruturado de respostas com markdown ou texto misto.
 */
export function extrairJson(texto) {
  if (!texto || typeof texto !== 'string') return null;
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

export const provedorDisponivel = hasOpenRouter;
export const modeloPrincipal = () => config.openrouter.mainModel;
export const modeloJev = () => config.openrouter.jevModel;
