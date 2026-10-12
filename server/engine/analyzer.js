/**
 * Motor de analise estatica local.
 * Executa o catalogo de regras sobre o codigo e produz achados, metricas e nota.
 */
import { detectLanguage } from './languageDetect.js';
import { computeMetrics, stripNoise } from './metrics.js';
import { rulesFor, SEVERITY_META, SEVERITY_ORDER, CATEGORY_META } from './rules/index.js';
import { uid, clamp, countBy } from '../utils/index.js';

const COMMENT_START = {
  js: /^\s*(\/\/|\/\*|\*)/,
  py: /^\s*#/,
  c: /^\s*(\/\/|\/\*|\*|#)/,
  sql: /^\s*--/,
  markup: /^\s*(<!--|\/\*|\*)/,
  other: /^\s*(\/\/|#)/,
};

/** Quantas vezes a mesma regra pode pesar na nota final. */
const MAX_WEIGHTED_PER_RULE = 5;

/** Oculta o conteudo de strings para evitar falsos positivos. */
const blankStrings = (line) =>
  line
    .replace(/'(?:\\.|[^'\\])*'/g, (m) => `'${' '.repeat(Math.max(0, m.length - 2))}'`)
    .replace(/"(?:\\.|[^"\\])*"/g, (m) => `"${' '.repeat(Math.max(0, m.length - 2))}"`)
    .replace(/`(?:\\.|[^`\\])*`/g, (m) => `\`${' '.repeat(Math.max(0, m.length - 2))}\``);

/** Executa uma regra baseada em regex, linha por linha. */
function runLineRule(rule, ctx) {
  const { lines, commentRe } = ctx;
  const hits = [];

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw.trim()) continue;

    const isComment = commentRe.test(raw);
    if (rule.onlyComments && !isComment) continue;
    if (!rule.onlyComments && rule.skipComments !== false && isComment) continue;

    const subject = rule.ignoreStrings ? blankStrings(raw) : raw;
    if (!rule.test.test(subject)) continue;

    if (rule.exclude?.test(subject)) continue;
    if (rule.excludeLine?.test(raw)) continue;

    if (rule.excludeNearby) {
      const window = lines.slice(Math.max(0, i - 6), i + 7).join('\n');
      if (rule.excludeNearby.test(window)) continue;
    }

    if (rule.requiresFollowing) {
      const following = lines.slice(i + 1, i + 5);
      if (!following.some((l) => rule.requiresFollowing.test(l))) continue;
    }

    hits.push({ line: i + 1 });
    if (hits.length >= 30) break; // evita explosao de achados identicos
  }

  return hits;
}

/** Executa uma regra com analise global. */
function runCollectRule(rule, ctx) {
  const hits = [];
  rule.collect({
    ...ctx,
    push: (hit) => {
      if (hits.length < 30) hits.push(hit);
    },
  });
  return hits;
}

/** Monta o recorte de codigo em volta de uma linha. */
function snippetAround(lines, line, radius = 2) {
  const start = Math.max(0, line - 1 - radius);
  const end = Math.min(lines.length, line + radius);
  return {
    startLine: start + 1,
    code: lines.slice(start, end).join('\n'),
    focusLine: line,
  };
}

/**
 * Analisa um trecho de codigo.
 * @param {string} code
 * @param {object} [options]
 * @param {string} [options.languageHint]
 * @param {string[]} [options.categories] filtra categorias consideradas
 */
export function analyzeCode(code, options = {}) {
  const source = String(code ?? '');
  const language = detectLanguage(source, options.languageHint);
  const lines = source.split(/\r?\n/);
  const metrics = computeMetrics(source, language);
  const commentRe = COMMENT_START[language.family] || COMMENT_START.other;

  const ctx = {
    code: source,
    cleanCode: stripNoise(source, language.family),
    lines,
    metrics,
    language,
    commentRe,
  };

  const allowed = options.categories?.length ? new Set(options.categories) : null;
  const findings = [];

  for (const rule of rulesFor(language.id)) {
    if (allowed && !allowed.has(rule.category)) continue;

    let hits = [];
    try {
      hits = rule.collect ? runCollectRule(rule, ctx) : runLineRule(rule, ctx);
    } catch {
      continue; // uma regra com problema nao pode derrubar a analise
    }

    for (const hit of hits) {
      const line = clamp(hit.line || 1, 1, Math.max(1, lines.length));
      findings.push({
        id: uid('f'),
        ruleId: rule.id,
        title: rule.title,
        severity: rule.severity,
        severityLabel: SEVERITY_META[rule.severity].label,
        category: rule.category,
        categoryLabel: CATEGORY_META[rule.category]?.label || rule.category,
        line,
        message: hit.extra ? `${rule.message} (${hit.extra})` : rule.message,
        why: rule.why,
        how: rule.how,
        concept: rule.concept,
        fix: rule.fix || null,
        snippet: snippetAround(lines, line),
        evidence: (lines[line - 1] || '').trim().slice(0, 200),
      });
    }
  }

  findings.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.line - b.line,
  );

  const score = computeScore(findings, metrics);
  const bySeverity = countBy(findings, (f) => f.severity);
  const byCategory = countBy(findings, (f) => f.category);

  return {
    language: { id: language.id, label: language.label, family: language.family },
    metrics,
    findings,
    score,
    grade: gradeFor(score),
    summary: {
      total: findings.length,
      bySeverity: Object.fromEntries(SEVERITY_ORDER.map((s) => [s, bySeverity[s] || 0])),
      byCategory,
      blockers: findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length,
    },
    tutor: buildTutorSummary(findings, metrics, score, language),
    engine: 'local',
  };
}

/** Nota 0-100 a partir dos achados e das metricas. */
function computeScore(findings, metrics) {
  const perRule = {};
  let penalty = 0;

  for (const finding of findings) {
    perRule[finding.ruleId] = (perRule[finding.ruleId] || 0) + 1;
    if (perRule[finding.ruleId] > MAX_WEIGHTED_PER_RULE) continue;
    penalty += SEVERITY_META[finding.severity].weight;
  }

  // Penalidade adicional para codigo estruturalmente dificil de manter.
  if (metrics.maintainability < 50) penalty += (50 - metrics.maintainability) * 0.25;
  if (metrics.maxNesting > 5) penalty += (metrics.maxNesting - 5) * 2;

  return clamp(Math.round(100 - penalty), 0, 100);
}

function gradeFor(score) {
  if (score >= 90) return { letter: 'A', label: 'Excelente' };
  if (score >= 80) return { letter: 'B', label: 'Bom' };
  if (score >= 65) return { letter: 'C', label: 'Aceitavel' };
  if (score >= 45) return { letter: 'D', label: 'Precisa de atencao' };
  return { letter: 'E', label: 'Critico' };
}

/** Veredito didatico + plano de acao priorizado. */
function buildTutorSummary(findings, metrics, score, language) {
  const critical = findings.filter((f) => f.severity === 'critical');
  const high = findings.filter((f) => f.severity === 'high');

  let verdict;
  if (!findings.length) {
    verdict =
      `Nenhum problema detectado pelo catalogo de regras neste trecho de ${language.label}. ` +
      'Vale lembrar que analise estatica nao substitui testes: ela ve a forma do codigo, nao o comportamento.';
  } else if (critical.length) {
    verdict =
      `Ha ${critical.length} ${critical.length === 1 ? 'problema critico' : 'problemas criticos'} ` +
      'que precisam ser resolvidos antes de qualquer outra coisa. ' +
      'Sao falhas com impacto direto em seguranca ou em perda de dados.';
  } else if (high.length) {
    verdict =
      `O codigo nao tem falhas criticas, mas ${high.length} ${high.length === 1 ? 'ponto de risco alto' : 'pontos de risco alto'} ` +
      'podem gerar bugs dificeis de rastrear em producao.';
  } else if (score >= 80) {
    verdict =
      'Base solida. O que sobrou sao ajustes de legibilidade e consistencia - ' +
      'o tipo de melhoria que facilita a vida de quem mantiver esse codigo depois.';
  } else {
    verdict =
      'Nada quebrado de imediato, mas o acumulo de pontos de manutencao deixa o codigo ' +
      'mais caro de alterar com seguranca.';
  }

  const seen = new Set();
  const nextSteps = findings
    .filter((finding) => {
      if (seen.has(finding.ruleId)) return false;
      seen.add(finding.ruleId);
      return true;
    })
    .slice(0, 5)
    .map((finding, index) => ({
      order: index + 1,
      title: finding.title,
      line: finding.line,
      severity: finding.severity,
      action: finding.how,
    }));

  const concepts = [...new Set(findings.map((f) => f.concept).filter(Boolean))].slice(0, 6);

  const observations = [];
  if (metrics.functions > 0) {
    observations.push(
      `${metrics.functions} ${metrics.functions === 1 ? 'funcao' : 'funcoes'} em ${metrics.sloc} linhas de codigo efetivo.`,
    );
  }
  if (metrics.avgComplexity > 8) {
    observations.push(
      `Complexidade media de ${metrics.avgComplexity} por funcao - acima de 8 costuma indicar excesso de ramificacoes.`,
    );
  }
  if (metrics.maintainability < 60) {
    observations.push(
      `Indice de manutenibilidade em ${metrics.maintainability}/100: refatorar agora custa menos que depois.`,
    );
  }
  if (metrics.duplicatedBlocks.length) {
    observations.push(`${metrics.duplicatedBlocks.length} bloco(s) duplicado(s) identificado(s).`);
  }

  return { verdict, nextSteps, concepts, observations };
}
