/** Agregacao de todas as regras do motor local. */
import { universalRules } from './universal.js';
import { javascriptRules } from './javascript.js';
import { pythonRules } from './python.js';

export const allRules = [...universalRules, ...javascriptRules, ...pythonRules];

/** Regras aplicaveis a uma linguagem (sem `languages` = universal). */
export function rulesFor(languageId) {
  return allRules.filter((rule) => !rule.languages || rule.languages.includes(languageId));
}

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

export const SEVERITY_META = {
  critical: { label: 'Critico', weight: 22, color: '#ff4d6d' },
  high: { label: 'Alto', weight: 12, color: '#ff8a4c' },
  medium: { label: 'Medio', weight: 6, color: '#fbbf24' },
  low: { label: 'Baixo', weight: 2.5, color: '#38bdf8' },
  info: { label: 'Info', weight: 0.7, color: '#94a3b8' },
};

export const CATEGORY_META = {
  security: { label: 'Seguranca', icon: 'shield' },
  bug: { label: 'Bug provavel', icon: 'bug' },
  performance: { label: 'Performance', icon: 'zap' },
  maintainability: { label: 'Manutenibilidade', icon: 'layers' },
  'best-practice': { label: 'Boas praticas', icon: 'check' },
  style: { label: 'Estilo', icon: 'brush' },
};

/** Estatisticas do catalogo, usadas na tela "sobre o motor". */
export function ruleCatalog() {
  const byCategory = {};
  const bySeverity = {};
  for (const rule of allRules) {
    byCategory[rule.category] = (byCategory[rule.category] || 0) + 1;
    bySeverity[rule.severity] = (bySeverity[rule.severity] || 0) + 1;
  }
  return {
    total: allRules.length,
    byCategory,
    bySeverity,
    rules: allRules.map(({ id, title, severity, category, concept, languages }) => ({
      id,
      title,
      severity,
      category,
      concept,
      languages: languages || ['*'],
    })),
  };
}
