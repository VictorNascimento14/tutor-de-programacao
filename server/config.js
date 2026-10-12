/**
 * Configuracao central da aplicacao.
 * Le variaveis de ambiente (e opcionalmente um arquivo .env) sem dependencias.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

/** Carrega .env de forma simples (KEY=VALUE, ignora comentarios). */
function loadDotEnv() {
  const file = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

const int = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: int(process.env.PORT, 3000),
  host: process.env.HOST || '127.0.0.1',
  env: process.env.NODE_ENV || 'development',

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    maxTokens: int(process.env.ANTHROPIC_MAX_TOKENS, 3000),
    baseUrl: 'https://api.anthropic.com/v1/messages',
    version: '2023-06-01',
  },

  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    mainModel: process.env.OPENROUTER_MAIN_MODEL || 'deepseek/deepseek-v4.1-flash',
    jevModel: process.env.OPENROUTER_JEV_MODEL || 'typesafe/jev-1.13',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api',
  },

  limits: {
    maxBodyBytes: int(process.env.MAX_BODY_BYTES, 1024 * 1024),
    maxCodeChars: int(process.env.MAX_CODE_CHARS, 120000),
    rateLimitMax: int(process.env.RATE_LIMIT_MAX, 120),
    rateLimitWindowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 60000),
  },

  session: {
    /** Quantas analises guardamos na memoria por sessao. */
    historySize: int(process.env.HISTORY_SIZE, 30),
    /** Tempo de vida de uma sessao inativa (2 horas). */
    ttlMs: int(process.env.SESSION_TTL_MS, 2 * 60 * 60 * 1000),
    maxSessions: int(process.env.MAX_SESSIONS, 500),
  },
};

/** O provedor OpenRouter esta configurado? */
export const hasOpenRouter = () => Boolean(config.openrouter.apiKey);

/** O provedor de IA esta configurado? */
export const hasAiProvider = () => Boolean(config.openrouter.apiKey || config.anthropic.apiKey);

