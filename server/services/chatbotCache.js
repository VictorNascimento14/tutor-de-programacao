/**
 * Cache em memoria para os Chatbots (Lumi, Ze, Kai).
 *
 * Armazena historico de conversas multi-turno e variaveis acumuladas
 * (servicos selecionados, itens do carrinho, demandas, horarios)
 * sem necessidade de banco de dados externo.
 */
import { uid, nowIso } from '../utils/index.js';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora de inatividade
const MAX_HISTORY_TURNS = 20;

/** @type {Map<string, object>} */
const cacheMap = new Map();

/**
 * Cria a estrutura inicial de variaveis para cada bot.
 * @param {'servicos'|'delivery'|'demandas'} botId
 */
function getInitialVars(botId) {
  switch (botId) {
    case 'servicos':
      return {
        servicos: [],
        servico: null,
        horario: null,
        data: 'amanha',
        protocolo: null,
        nota: 0,
      };
    case 'delivery':
      return {
        carrinho: [],
        endereco: null,
        pagamento: null,
        taxa: 790,
      };
    case 'demandas':
      return {
        rascunho: {},
        demandas: [
          { title: 'Corrigir erro no checkout', prio: 'alta', status: 'fazendo', meta: 'Ana · hoje' },
          { title: 'Revisar textos da landing', prio: 'baixa', status: 'backlog', meta: 'Bruno · sexta' },
          { title: 'Atualizar dependencias', prio: 'media', status: 'backlog', meta: 'Carla · semana' },
          { title: 'Deploy da v2.1', prio: 'alta', status: 'feito', meta: 'Diego · ontem' },
          { title: 'Documentar a API', prio: 'media', status: 'fazendo', meta: 'Ana · amanha' },
        ],
      };
    default:
      return {};
  }
}

/**
 * Monta a chave unica de cache por sessao e bot.
 */
function buildKey(sessionId, botId) {
  const sid = String(sessionId || 'anon').trim() || 'anon';
  const bid = String(botId || 'servicos').trim() || 'servicos';
  return `${sid}::${bid}`;
}

/**
 * Obtem ou inicializa o registro de cache do chatbot.
 * @param {string} sessionId
 * @param {'servicos'|'delivery'|'demandas'} botId
 * @returns {object}
 */
export function getChatbotCache(sessionId, botId = 'servicos') {
  const key = buildKey(sessionId, botId);

  if (!cacheMap.has(key)) {
    cacheMap.set(key, {
      sessionId: String(sessionId || 'anon'),
      botId,
      criadoEm: nowIso(),
      atualizadoEm: Date.now(),
      currentState: 'inicio',
      completedStates: [],
      history: [],
      vars: getInitialVars(botId),
    });
  }

  const record = cacheMap.get(key);
  record.atualizadoEm = Date.now();
  return record;
}

/**
 * Mescla e normaliza variaveis acumuladas sem sobrescrever dados anteriores indevidamente.
 * @param {'servicos'|'delivery'|'demandas'} botId
 * @param {object} targetVars
 * @param {object} incomingVars
 */
export function mergeChatbotVars(botId, targetVars, incomingVars = {}) {
  if (!incomingVars || typeof incomingVars !== 'object') return targetVars;

  if (botId === 'servicos') {
    if (!Array.isArray(targetVars.servicos)) {
      targetVars.servicos = [];
    }

    // Se for chamado de emergencia ou override explicito, substitui servicos de rotina
    const ehChamadoEmergencia =
      incomingVars.overrideServicos ||
      (Array.isArray(incomingVars.servicos) && incomingVars.servicos.includes('Emergencia')) ||
      (typeof incomingVars.servico === 'string' && incomingVars.servico.includes('Emergencia'));

    if (ehChamadoEmergencia) {
      targetVars.servicos = ['Emergencia'];
      targetVars.servico = 'Emergencia (Atendimento Imediato)';
    } else {
      // Acumula servicos recebidos como array
      if (Array.isArray(incomingVars.servicos)) {
        for (const s of incomingVars.servicos) {
          if (s && !targetVars.servicos.includes(s)) {
            targetVars.servicos.push(s);
          }
        }
      }

      // Acumula servico unico recebido
      if (incomingVars.servico && typeof incomingVars.servico === 'string') {
        const partes = incomingVars.servico.split(/,|\be\b/i).map((p) => p.trim()).filter(Boolean);
        for (const p of partes) {
          if (!targetVars.servicos.includes(p)) {
            targetVars.servicos.push(p);
          }
        }
      }

      // Atualiza texto amigavel composto
      if (targetVars.servicos.length > 0) {
        targetVars.servico = targetVars.servicos.join(' e ');
      }
    }

    if (incomingVars.horario) targetVars.horario = incomingVars.horario;
    if (incomingVars.data) targetVars.data = incomingVars.data;
    if (incomingVars.protocolo) targetVars.protocolo = incomingVars.protocolo;
    if (incomingVars.statusAgendamento) targetVars.statusAgendamento = incomingVars.statusAgendamento;
    if (incomingVars.tecnico) targetVars.tecnico = incomingVars.tecnico;
    if (incomingVars.nota != null) targetVars.nota = incomingVars.nota;
  } else if (botId === 'delivery') {
    if (!Array.isArray(targetVars.carrinho)) {
      targetVars.carrinho = [];
    }

    if (Array.isArray(incomingVars.carrinho)) {
      targetVars.carrinho = incomingVars.carrinho;
    }

    if (incomingVars.endereco) targetVars.endereco = incomingVars.endereco;
    if (incomingVars.pagamento) targetVars.pagamento = incomingVars.pagamento;
    if (incomingVars.taxa != null) targetVars.taxa = incomingVars.taxa;
  } else if (botId === 'demandas') {
    if (Array.isArray(incomingVars.demandas)) {
      targetVars.demandas = incomingVars.demandas;
    }
    if (incomingVars.rascunho && typeof incomingVars.rascunho === 'object') {
      targetVars.rascunho = { ...targetVars.rascunho, ...incomingVars.rascunho };
    }
  }

  // Copia outras propriedades genericas
  for (const [k, v] of Object.entries(incomingVars)) {
    if (targetVars[k] === undefined && v !== undefined) {
      targetVars[k] = v;
    }
  }

  return targetVars;
}

/**
 * Atualiza o cache do chatbot com a nova interacao.
 * @param {object} params
 * @param {string} params.sessionId
 * @param {'servicos'|'delivery'|'demandas'} params.botId
 * @param {string} [params.userMessage]
 * @param {string} [params.botReply]
 * @param {object} [params.vars]
 * @param {string} [params.currentState]
 * @param {string} [params.nextState]
 * @returns {object}
 */
export function updateChatbotCache({
  sessionId,
  botId = 'servicos',
  userMessage = '',
  botReply = '',
  vars = {},
  currentState,
  nextState,
}) {
  const record = getChatbotCache(sessionId, botId);
  record.atualizadoEm = Date.now();

  if (currentState) {
    record.currentState = currentState;
    if (!record.completedStates.includes(currentState)) {
      record.completedStates.push(currentState);
    }
  }

  if (nextState) {
    record.nextState = nextState;
  }

  mergeChatbotVars(botId, record.vars, vars);

  if (userMessage) {
    record.history.push({
      role: 'user',
      text: String(userMessage).trim(),
      timestamp: Date.now(),
    });
  }

  if (botReply) {
    record.history.push({
      role: 'assistant',
      text: String(botReply).trim(),
      timestamp: Date.now(),
    });
  }

  // Mantem o tamanho do historico sob controle na memoria
  if (record.history.length > MAX_HISTORY_TURNS) {
    record.history = record.history.slice(-MAX_HISTORY_TURNS);
  }

  return record;
}

/**
 * Limpa o cache de um chatbot ou sessao inteira.
 * @param {string} sessionId
 * @param {'servicos'|'delivery'|'demandas'} [botId]
 */
export function clearChatbotCache(sessionId, botId) {
  if (botId) {
    cacheMap.delete(buildKey(sessionId, botId));
  } else {
    const prefix = `${String(sessionId || 'anon').trim() || 'anon'}::`;
    for (const key of cacheMap.keys()) {
      if (key.startsWith(prefix)) {
        cacheMap.delete(key);
      }
    }
  }
}

/**
 * Estatisticas do cache em memoria.
 */
export function getChatbotCacheStats() {
  return {
    totalSessoes: cacheMap.size,
  };
}

// Limpeza periodica de itens expirados
const timerLimpeza = setInterval(() => {
  const agora = Date.now();
  for (const [key, record] of cacheMap.entries()) {
    if (agora - record.atualizadoEm > CACHE_TTL_MS) {
      cacheMap.delete(key);
    }
  }
}, 10 * 60 * 1000);
timerLimpeza.unref?.();
