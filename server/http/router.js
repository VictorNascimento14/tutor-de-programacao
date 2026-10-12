/**
 * Router minimalista com suporte a parametros de rota (`/api/:id`).
 */
import { AppError, logger } from '../utils/index.js';

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    const segments = pattern.split('/').filter(Boolean);
    this.routes.push({ method, pattern, segments, handler });
    return this;
  }

  get(pattern, handler) {
    return this.add('GET', pattern, handler);
  }

  post(pattern, handler) {
    return this.add('POST', pattern, handler);
  }

  del(pattern, handler) {
    return this.add('DELETE', pattern, handler);
  }

  /** Procura rota compativel e devolve `{ handler, params }` ou null. */
  match(method, pathname) {
    const parts = pathname.split('/').filter(Boolean);
    let methodMismatch = false;

    for (const route of this.routes) {
      if (route.segments.length !== parts.length) continue;

      const params = {};
      let ok = true;
      for (let i = 0; i < route.segments.length; i += 1) {
        const segment = route.segments[i];
        if (segment.startsWith(':')) {
          params[segment.slice(1)] = decodeURIComponent(parts[i]);
        } else if (segment !== parts[i]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      if (route.method !== method) {
        methodMismatch = true;
        continue;
      }
      return { handler: route.handler, params };
    }

    if (methodMismatch) throw new AppError(405, `Metodo ${method} nao permitido nesta rota`);
    return null;
  }
}

/** Resposta JSON padronizada. */
export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/** Converte erros em respostas JSON consistentes. */
export function sendError(res, error) {
  const status = error instanceof AppError ? error.status : 500;
  if (status >= 500) logger.error(error.stack || error.message);

  sendJson(res, status, {
    ok: false,
    error: {
      status,
      message: status >= 500 ? 'Erro interno do servidor' : error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  });
}

/** Abre um stream SSE e devolve helpers de escrita. */
export function openSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': ok\n\n');

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  return {
    send,
    close() {
      try {
        res.write('event: done\ndata: {}\n\n');
      } catch {
        /* conexao ja encerrada */
      }
      res.end();
    },
  };
}
