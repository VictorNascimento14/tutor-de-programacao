/** Cliente da API. Mantem o id de sessao em memoria + localStorage. */

const SESSION_KEY = 'tutor.sessao';

let sessionId = null;
try {
  sessionId = localStorage.getItem(SESSION_KEY);
} catch {
  /* ignora */
}

function guardarSessao(id) {
  if (!id || id === sessionId) return;
  sessionId = id;
  try {
    localStorage.setItem(SESSION_KEY, id);
  } catch {
    /* ignora */
  }
}

export const getSessionId = () => sessionId;

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export { ApiError };

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (sessionId) headers['X-Session-Id'] = sessionId;

  let resposta;
  try {
    resposta = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Nao foi possivel falar com o servidor. Ele esta rodando?', 0);
  }

  const texto = await resposta.text();
  let dados = null;
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      throw new ApiError('O servidor devolveu uma resposta invalida', resposta.status);
    }
  }

  if (!resposta.ok || dados?.ok === false) {
    const erro = dados?.error || {};
    throw new ApiError(erro.message || `Erro ${resposta.status}`, resposta.status, erro.details);
  }

  if (dados?.sessionId) guardarSessao(dados.sessionId);
  return dados;
}

export const api = {
  health: () => request('/api/health'),
  meta: () => request('/api/meta'),
  sample: (id) => request(`/api/samples/${encodeURIComponent(id)}`),

  review: (payload) => request('/api/review', { method: 'POST', body: payload }),
  debug: (payload) => request('/api/debug', { method: 'POST', body: payload }),
  tutor: (payload) => request('/api/tutor', { method: 'POST', body: payload }),

  session: () => request('/api/session'),
  historyItem: (id) => request(`/api/session/history/${encodeURIComponent(id)}`),
  clearHistory: () => request('/api/session/history', { method: 'DELETE' }),

  /**
   * Pergunta ao tutor com streaming via SSE.
   * @param {object} payload
   * @param {{ onDelta: Function, onMeta: Function, onError: Function }} handlers
   * @returns {Promise<void>}
   */
  async tutorStream(payload, { onDelta, onMeta, onError } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (sessionId) headers['X-Session-Id'] = sessionId;

    const resposta = await fetch('/api/tutor/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!resposta.ok || !resposta.body) {
      throw new ApiError('Falha ao abrir o stream do tutor', resposta.status);
    }

    const leitor = resposta.body.getReader();
    const decodificador = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;

      buffer += decodificador.decode(value, { stream: true });

      // Eventos SSE sao separados por linha em branco.
      const partes = buffer.split('\n\n');
      buffer = partes.pop() || '';

      for (const parte of partes) {
        let evento = 'message';
        let data = '';

        for (const linha of parte.split('\n')) {
          if (linha.startsWith('event: ')) evento = linha.slice(7).trim();
          else if (linha.startsWith('data: ')) data += linha.slice(6);
        }

        if (!data) continue;

        let payloadEvento;
        try {
          payloadEvento = JSON.parse(data);
        } catch {
          continue;
        }

        if (evento === 'delta') onDelta?.(payloadEvento.texto);
        else if (evento === 'meta') {
          if (payloadEvento.sessionId) guardarSessao(payloadEvento.sessionId);
          onMeta?.(payloadEvento);
        } else if (evento === 'erro') onError?.(new ApiError(payloadEvento.mensagem, 500));
      }
    }
  },
};
