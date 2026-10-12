/** Middlewares: CORS, parse de corpo JSON e rate limit em memoria. */
import { config } from '../config.js';
import { AppError, badRequest, tooLarge } from '../utils/index.js';

export function applyCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Id');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}

export function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

/** Le o corpo da requisicao e devolve o JSON (ou {} quando vazio). */
export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const declared = Number.parseInt(req.headers['content-length'] ?? '', 10);
    if (Number.isFinite(declared) && declared > config.limits.maxBodyBytes) {
      reject(tooLarge('Corpo da requisicao muito grande'));
      return;
    }

    const chunks = [];
    let size = 0;
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > config.limits.maxBodyBytes) {
        settled = true;
        reject(tooLarge('Corpo da requisicao muito grande'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        reject(badRequest('JSON invalido no corpo da requisicao'));
      }
    });

    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

const buckets = new Map();

/** Rate limit simples por IP com janela deslizante aproximada. */
export function checkRateLimit(req) {
  const { rateLimitMax, rateLimitWindowMs } = config.limits;
  if (rateLimitMax <= 0) return;

  const ip = req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now - bucket.start > rateLimitWindowMs) {
    buckets.set(ip, { start: now, count: 1 });
    return;
  }

  bucket.count += 1;
  if (bucket.count > rateLimitMax) {
    const retryIn = Math.ceil((rateLimitWindowMs - (now - bucket.start)) / 1000);
    throw new AppError(429, `Muitas requisicoes. Tente novamente em ${retryIn}s.`);
  }
}

/** Limpeza periodica dos buckets para nao crescer indefinidamente. */
const sweeper = setInterval(() => {
  const cutoff = Date.now() - config.limits.rateLimitWindowMs * 2;
  for (const [ip, bucket] of buckets) {
    if (bucket.start < cutoff) buckets.delete(ip);
  }
}, 60_000);
sweeper.unref?.();
