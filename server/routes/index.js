/** Definicao de todas as rotas da API. */
import { Router, sendJson, openSse } from '../http/router.js';
import { readJsonBody } from '../http/middleware.js';
import { config, hasAiProvider, hasOpenRouter } from '../config.js';
import { notFound } from '../utils/index.js';

import { revisarCodigo } from '../services/reviewService.js';
import { diagnosticarErro } from '../services/debugService.js';
import { responderPergunta, responderPerguntaStream, MODOS, listarConceitos } from '../services/tutorService.js';
import { processChatbotMessage } from '../services/chatbotService.js';
import { getChatbotCache, clearChatbotCache } from '../services/chatbotCache.js';
import { callJevDecisions, executeHybrid } from '../providers/openrouter.js';
import {
  getSession,
  registrarAnalise,
  registrarDiagnostico,
  registrarPergunta,
  serializeSession,
  getHistoryItem,
  clearSession,
  sessionStats,
} from '../services/sessionStore.js';
import { ruleCatalog } from '../engine/rules/index.js';
import { LANGUAGES } from '../engine/languageDetect.js';
import { exemplos } from '../knowledge/samples.js';

/** Resolve a sessao a partir do header ou do corpo. */
const resolverSessao = (req, body = {}) =>
  getSession(req.headers['x-session-id'] || body.sessionId || '');

export const router = new Router();

// --------------------------------------------------------------------- meta
router.get('/api/health', (req, res) => {
  const modeloDescricao = hasOpenRouter()
    ? `${config.openrouter.jevModel} (JEV) + ${config.openrouter.mainModel}`
    : config.anthropic.apiKey
      ? config.anthropic.model
      : null;

  sendJson(res, 200, {
    ok: true,
    status: 'online',
    uptime: Math.round(process.uptime()),
    engine: {
      local: true,
      ia: hasAiProvider(),
      openrouter: hasOpenRouter(),
      jevModel: hasOpenRouter() ? config.openrouter.jevModel : null,
      mainModel: hasOpenRouter() ? config.openrouter.mainModel : null,
      modelo: modeloDescricao,
    },
    sessoes: sessionStats(),
    versao: '1.0.0',
  });
});

router.get('/api/meta', (req, res) => {
  sendJson(res, 200, {
    ok: true,
    data: {
      linguagens: LANGUAGES.filter((l) => l.id !== 'plaintext'),
      modosTutor: Object.values(MODOS),
      conceitos: listarConceitos(),
      catalogo: ruleCatalog(),
      exemplos: exemplos.map(({ id, titulo, descricao, linguagem, tipo }) => ({
        id,
        titulo,
        descricao,
        linguagem,
        tipo,
      })),
      iaAtiva: hasAiProvider(),
      limites: {
        maxCodeChars: config.limits.maxCodeChars,
      },
    },
  });
});

router.get('/api/samples/:id', (req, res, params) => {
  const exemplo = exemplos.find((item) => item.id === params.id);
  if (!exemplo) throw notFound('Exemplo nao encontrado');
  sendJson(res, 200, { ok: true, data: exemplo });
});

// ------------------------------------------------------------------- review
router.post('/api/review', async (req, res) => {
  const body = await readJsonBody(req);
  const session = resolverSessao(req, body);

  const resultado = await revisarCodigo(body);
  const { item, recompensa } = registrarAnalise(session, resultado, body.code);

  sendJson(res, 200, {
    ok: true,
    sessionId: session.id,
    data: resultado,
    historyId: item.id,
    recompensa,
    progresso: serializeSession(session).progresso,
  });
});

// -------------------------------------------------------------------- debug
router.post('/api/debug', async (req, res) => {
  const body = await readJsonBody(req);
  const session = resolverSessao(req, body);

  const diagnostico = await diagnosticarErro(body);
  const { item, recompensa } = registrarDiagnostico(session, diagnostico, body.error);

  sendJson(res, 200, {
    ok: true,
    sessionId: session.id,
    data: diagnostico,
    historyId: item.id,
    recompensa,
    progresso: serializeSession(session).progresso,
  });
});

// -------------------------------------------------------------------- tutor
router.post('/api/tutor', async (req, res) => {
  const body = await readJsonBody(req);
  const session = resolverSessao(req, body);

  const resposta = await responderPergunta(body);
  const { recompensa } = registrarPergunta(session, body.question, resposta.concept?.title);

  sendJson(res, 200, {
    ok: true,
    sessionId: session.id,
    data: resposta,
    recompensa,
    progresso: serializeSession(session).progresso,
  });
});

router.post('/api/tutor/stream', async (req, res) => {
  const body = await readJsonBody(req);
  const session = resolverSessao(req, body);
  const sse = openSse(res);

  let encerrado = false;
  req.on('close', () => {
    encerrado = true;
  });

  try {
    const resultado = await responderPerguntaStream(body, (texto) => {
      if (!encerrado) sse.send('delta', { texto });
    });

    const { recompensa } = registrarPergunta(session, body.question, resultado.concept?.title);

    if (!encerrado) {
      sse.send('meta', {
        sessionId: session.id,
        concept: resultado.concept,
        related: resultado.related,
        engine: resultado.engine,
        mode: resultado.mode,
        recompensa,
        progresso: serializeSession(session).progresso,
      });
    }
  } catch (erro) {
    if (!encerrado) sse.send('erro', { mensagem: erro.message });
  } finally {
    sse.close();
  }
});

// ------------------------------------------------------------------ sessao
router.get('/api/session', (req, res) => {
  const session = resolverSessao(req);
  sendJson(res, 200, { ok: true, data: serializeSession(session) });
});

router.get('/api/session/history/:id', (req, res, params) => {
  const session = resolverSessao(req);
  const item = getHistoryItem(session, params.id);
  if (!item) throw notFound('Item do historico nao encontrado');
  sendJson(res, 200, { ok: true, data: item });
});

router.del('/api/session/history', (req, res) => {
  const session = resolverSessao(req);
  clearSession(session);
  sendJson(res, 200, { ok: true, data: serializeSession(session) });
});

// ----------------------------------------------------------------- chatbots
router.post('/api/chatbots/message', async (req, res) => {
  const body = await readJsonBody(req);
  const sessionId = req.headers['x-session-id'] || body.sessionId || '';
  const resultado = await processChatbotMessage({
    sessionId,
    botId: body.botId || 'servicos',
    message: body.message || '',
    currentState: body.currentState || 'inicio',
    history: Array.isArray(body.history) ? body.history : [],
    vars: body.vars || {},
  });

  sendJson(res, 200, resultado);
});

router.get('/api/chatbots/cache', (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const sessionId = req.headers['x-session-id'] || url.searchParams.get('sessionId') || '';
  const botId = url.searchParams.get('botId') || 'servicos';
  const cache = getChatbotCache(sessionId, botId);
  sendJson(res, 200, { ok: true, cache });
});

router.del('/api/chatbots/cache', (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const sessionId = req.headers['x-session-id'] || url.searchParams.get('sessionId') || '';
  const botId = url.searchParams.get('botId') || undefined;
  clearChatbotCache(sessionId, botId);
  sendJson(res, 200, { ok: true, message: 'Cache do chatbot limpo com sucesso' });
});

// ----------------------------------------------------------------- jev test
router.post('/api/jev/test', async (req, res) => {
  const body = await readJsonBody(req);
  const state = body.state || { message: 'Ola, teste de decisao' };
  const questions = body.questions || {
    intencao: {
      type: 'choice',
      instructions: 'Identifique o objetivo principal',
      criteria: {
        suporte: 'Duvidas tecnicas ou suporte',
        vendas: 'Compra ou orcamento',
        geral: 'Cumprimento ou geral',
      },
    },
  };

  const resultado = await callJevDecisions({ state, questions });
  sendJson(res, 200, {
    ok: resultado.ok,
    model: resultado.model,
    answers: resultado.answers,
    latencyMs: resultado.latencyMs,
    error: resultado.error,
  });
});

