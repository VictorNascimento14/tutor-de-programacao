/** Metricas estaticas de codigo: tamanho, complexidade, aninhamento e duplicacao. */

const COMMENT_PREFIX = {
  js: ['//', '/*', '*', '*/'],
  py: ['#'],
  c: ['//', '/*', '*', '*/'],
  sql: ['--'],
  markup: ['<!--', '/*'],
  other: ['//', '#'],
};

const DECISION_RE =
  /\b(if|else\s+if|elif|for|foreach|while|case|catch|except|&&|\|\||\?\?)\b|\?[^.:]/g;

const FUNCTION_RE = [
  /\bfunction\s+\w+\s*\(/g,
  /\b\w+\s*[:=]\s*(async\s+)?function\s*\(/g,
  /\b(const|let|var)\s+\w+\s*=\s*(async\s*)?\([^)]*\)\s*=>/g,
  /\b\w+\s*\([^)]*\)\s*\{/g,
  /^\s*def\s+\w+\s*\(/gm,
  /\bfunc\s+\w*\s*\(/g,
];

/** Remove strings e comentarios para analises que nao devem considerar literais. */
export function stripNoise(code, family = 'js') {
  let out = code
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');

  if (family === 'py') {
    out = out.replace(/#[^\n]*/g, '');
  } else if (family === 'sql') {
    out = out.replace(/--[^\n]*/g, '');
  } else {
    out = out.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  }
  return out;
}

const isCommentLine = (line, family) =>
  (COMMENT_PREFIX[family] || COMMENT_PREFIX.other).some((prefix) => line.startsWith(prefix));

/** Detecta blocos duplicados de 4+ linhas significativas. */
function findDuplicatedBlocks(lines, windowSize = 4) {
  const seen = new Map();
  const duplicates = [];

  for (let i = 0; i + windowSize <= lines.length; i += 1) {
    const slice = lines.slice(i, i + windowSize).map((l) => l.trim());
    if (slice.some((l) => l.length < 4)) continue;

    const key = slice.join('\u0001');
    if (seen.has(key)) {
      const firstLine = seen.get(key);
      const last = duplicates[duplicates.length - 1];
      // Evita reportar janelas sobrepostas da mesma duplicacao.
      if (!last || i > last.line + windowSize) {
        duplicates.push({ line: i + 1, originalLine: firstLine + 1, size: windowSize });
      }
    } else {
      seen.set(key, i);
    }
  }
  return duplicates;
}

/** Calcula o maior nivel de aninhamento (chaves ou indentacao). */
function maxNesting(lines, family) {
  if (family === 'py') {
    let max = 0;
    for (const line of lines) {
      if (!line.trim()) continue;
      const indent = line.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
      max = Math.max(max, Math.floor(indent / 4));
    }
    return max;
  }

  let depth = 0;
  let max = 0;
  for (const char of lines.join('\n')) {
    if (char === '{') {
      depth += 1;
      max = Math.max(max, depth);
    } else if (char === '}') {
      depth = Math.max(0, depth - 1);
    }
  }
  return max;
}

/** Localiza funcoes e seus tamanhos aproximados. */
export function findFunctions(code, family) {
  const lines = code.split(/\r?\n/);
  const found = [];

  const header =
    family === 'py'
      ? /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(/
      : /^(\s*).*?\b(?:function\s+(\w+)|(\w+)\s*(?::|=)\s*(?:async\s+)?(?:function|\()|(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{)/;

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(header);
    if (!match) continue;

    const name = match.slice(2).find(Boolean) || '(anonima)';
    if (['if', 'for', 'while', 'switch', 'catch', 'return', 'else'].includes(name)) continue;

    const baseIndent = match[1].replace(/\t/g, '    ').length;
    let end = i;

    if (family === 'py') {
      for (let j = i + 1; j < lines.length; j += 1) {
        if (!lines[j].trim()) continue;
        const indent = lines[j].match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
        if (indent <= baseIndent) break;
        end = j;
      }
    } else {
      let depth = 0;
      let opened = false;
      for (let j = i; j < lines.length; j += 1) {
        for (const char of lines[j]) {
          if (char === '{') {
            depth += 1;
            opened = true;
          } else if (char === '}') depth -= 1;
        }
        end = j;
        if (opened && depth <= 0) break;
      }
    }

    const body = lines.slice(i, end + 1).join('\n');
    const params = (lines[i].match(/\(([^)]*)\)/)?.[1] || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    found.push({
      name,
      line: i + 1,
      endLine: end + 1,
      length: end - i + 1,
      params: params.length,
      complexity: (stripNoise(body, family).match(DECISION_RE) || []).length + 1,
    });
  }

  return found;
}

/**
 * Calcula todas as metricas do trecho de codigo.
 * @param {string} code
 * @param {{family: string}} language
 */
export function computeMetrics(code, language) {
  const family = language?.family || 'js';
  const lines = code.split(/\r?\n/);
  const trimmed = lines.map((l) => l.trim());

  const blank = trimmed.filter((l) => !l).length;
  const comments = trimmed.filter((l) => l && isCommentLine(l, family)).length;
  const sloc = lines.length - blank - comments;

  const clean = stripNoise(code, family);
  const decisions = (clean.match(DECISION_RE) || []).length;
  const functions = findFunctions(code, family);

  const functionCount =
    functions.length ||
    FUNCTION_RE.reduce((total, re) => total + (clean.match(re) || []).length, 0);

  const nesting = maxNesting(lines, family);
  const duplicated = findDuplicatedBlocks(
    lines.filter((l) => l.trim() && !isCommentLine(l.trim(), family)),
  );

  const cyclomatic = decisions + 1;
  const avgComplexity = functionCount ? cyclomatic / functionCount : cyclomatic;
  const longest = functions.reduce(
    (max, fn) => (fn.length > (max?.length || 0) ? fn : max),
    null,
  );

  // Indice de manutenibilidade simplificado (0-100, maior e melhor).
  const volume = Math.max(1, sloc) * Math.log2(Math.max(2, decisions + functionCount + 2));
  const rawMi =
    171 - 5.2 * Math.log(Math.max(1, volume)) - 0.23 * cyclomatic - 16.2 * Math.log(Math.max(1, sloc));
  const maintainability = Math.round(Math.min(100, Math.max(0, (rawMi * 100) / 171)));

  return {
    lines: lines.length,
    sloc,
    blank,
    comments,
    commentRatio: sloc ? Math.round((comments / (sloc + comments)) * 100) : 0,
    chars: code.length,
    functions: functionCount,
    functionList: functions,
    longestFunction: longest ? { name: longest.name, length: longest.length, line: longest.line } : null,
    cyclomatic,
    avgComplexity: Math.round(avgComplexity * 10) / 10,
    maxNesting: nesting,
    duplicatedBlocks: duplicated,
    maintainability,
  };
}
