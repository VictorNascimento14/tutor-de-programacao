/** Estado da aplicacao em memoria, com assinatura simples de mudancas. */

const listeners = new Set();

export const state = {
  view: 'review',
  meta: null,

  review: {
    code: '',
    language: 'auto',
    detected: null,
    result: null,
    filter: 'all',
    loading: false,
  },

  debug: {
    error: '',
    code: '',
    result: null,
    loading: false,
  },

  tutor: {
    mode: 'explicar',
    level: 'intermediario',
    messages: [],
    loading: false,
  },

  chatbot: 'servicos',

  session: {
    progresso: null,
    historico: [],
  },

  engine: { local: true, ia: false, modelo: null },
};

/** Registra um observador; devolve a funcao para cancelar. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Notifica observadores sobre uma mudanca. */
export function notify(key, value) {
  for (const fn of listeners) {
    try {
      fn(key, value, state);
    } catch (erro) {
      console.error('Observador de estado falhou:', erro);
    }
  }
}

/** Atualiza um ramo do estado e notifica. */
export function patch(key, partial) {
  if (typeof state[key] === 'object' && state[key] !== null && !Array.isArray(state[key])) {
    Object.assign(state[key], partial);
  } else {
    state[key] = partial;
  }
  notify(key, state[key]);
  return state[key];
}
