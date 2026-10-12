/** Utilitarios compartilhados do servidor. */
import { randomUUID } from 'node:crypto';

export const uid = (prefix = 'id') => `${prefix}_${randomUUID().slice(0, 12)}`;

export const nowIso = () => new Date().toISOString();

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Erro de aplicacao com status HTTP associado. */
export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, message, details);
export const notFound = (message = 'Recurso nao encontrado') => new AppError(404, message);
export const tooLarge = (message) => new AppError(413, message);

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const activeLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

const paint = (color, text) => `\u001b[${color}m${text}\u001b[0m`;

function emit(level, color, args) {
  if (LEVELS[level] < activeLevel) return;
  const stamp = new Date().toISOString().slice(11, 23);
  const tag = paint(color, level.toUpperCase().padEnd(5));
  // eslint-disable-next-line no-console
  console.log(`${paint('90', stamp)} ${tag}`, ...args);
}

export const logger = {
  debug: (...args) => emit('debug', '90', args),
  info: (...args) => emit('info', '36', args),
  warn: (...args) => emit('warn', '33', args),
  error: (...args) => emit('error', '31', args),
};

/** Normaliza strings para busca (sem acentos, minusculo). */
export function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Trunca preservando palavras. */
export function truncate(text = '', max = 160) {
  const value = String(text);
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

/** Agrupa itens por chave derivada. */
export function groupBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = keyFn(item);
    (out[key] ||= []).push(item);
  }
  return out;
}

/** Conta ocorrencias por chave. */
export function countBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = keyFn(item);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}
