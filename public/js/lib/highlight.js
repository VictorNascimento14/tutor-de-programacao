/**
 * Realce de sintaxe leve e sem dependencias.
 * Usa um unico regex combinado por gramatica, o que evita o classico bug de
 * substituicoes aninhadas (realcar dentro do que ja foi realcado).
 * Todos os grupos internos das regras sao nao-capturantes.
 */
import { escapeHtml } from './dom.js';

const JS_KEYWORDS =
  'const|let|var|function|return|if|else|for|while|do|switch|case|default|break|continue|' +
  'new|delete|typeof|instanceof|in|of|this|super|class|extends|static|get|set|' +
  'import|export|from|as|async|await|yield|try|catch|finally|throw|void|' +
  'interface|type|enum|implements|declare|namespace|readonly|public|private|protected|abstract|satisfies|keyof|infer';

const PY_KEYWORDS =
  'def|class|return|if|elif|else|for|while|break|continue|pass|import|from|as|' +
  'try|except|finally|raise|with|lambda|global|nonlocal|assert|del|yield|await|async|' +
  'and|or|not|is|in|match|case';

const SQL_KEYWORDS =
  'SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|' +
  'INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|ALTER|DROP|AND|OR|NOT|NULL|' +
  'AS|DISTINCT|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|END|EXISTS|IN|BETWEEN|LIKE|ASC|DESC|' +
  'PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|DEFAULT|EXPLAIN|ANALYZE|ANY|WITH|RETURNING';

const C_KEYWORDS =
  'public|private|protected|class|interface|extends|implements|static|final|void|new|' +
  'return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|throws|' +
  'import|package|namespace|using|var|int|long|double|float|boolean|bool|string|String|' +
  'char|byte|short|struct|func|package|type|map|chan|go|defer|range|nil|const|abstract';

const STRING_RE = /`(?:\\[\s\S]|[^`\\])*`|'(?:\\[\s\S]|[^'\\\n])*'|"(?:\\[\s\S]|[^"\\\n])*"/;
const NUMBER_RE = /\b(?:0[xXbBoO][\da-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?)n?\b/;

const GRAMMARS = {
  js: [
    ['comment', /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*/],
    ['string', STRING_RE],
    ['tag', /<\/?[A-Z][\w.]*|<\/?[a-z][\w-]*(?=[\s/>])/],
    ['decorator', /@[A-Za-z_]\w*/],
    ['number', NUMBER_RE],
    ['keyword', new RegExp(`\\b(?:${JS_KEYWORDS})\\b`)],
    ['boolean', /\b(?:true|false|null|undefined|NaN|Infinity)\b/],
    ['class', /\b[A-Z][A-Za-z0-9_]*\b/],
    ['func', /\b[a-zA-Z_$][\w$]*(?=\s*\()/],
    ['attr', /\b[a-zA-Z_$][\w$-]*(?=\s*=(?!=))/],
    ['operator', /=>|\?\?=?|\.{3}|[+\-*/%=<>!&|^~?:]+/],
    ['punct', /[{}()[\];,.]/],
  ],

  py: [
    ['comment', /#[^\n]*/],
    ['string', /(?:[rfbu]{0,2})(?:'''[\s\S]*?(?:'''|$)|"""[\s\S]*?(?:"""|$))|(?:[rfbu]{0,2})(?:'(?:\\[\s\S]|[^'\\\n])*'|"(?:\\[\s\S]|[^"\\\n])*")/],
    ['decorator', /@[A-Za-z_][\w.]*/],
    ['number', NUMBER_RE],
    ['keyword', new RegExp(`\\b(?:${PY_KEYWORDS})\\b`)],
    ['boolean', /\b(?:True|False|None|self|cls)\b/],
    ['class', /\b[A-Z][A-Za-z0-9_]*\b/],
    ['func', /\b[a-zA-Z_]\w*(?=\s*\()/],
    ['operator', /:=|->|[+\-*/%=<>!&|^~]+/],
    ['punct', /[{}()[\]:;,.]/],
  ],

  sql: [
    ['comment', /--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/],
    ['string', /'(?:''|[^'])*'/],
    ['number', NUMBER_RE],
    ['keyword', new RegExp(`\\b(?:${SQL_KEYWORDS})\\b`, 'i')],
    ['boolean', /\b(?:TRUE|FALSE|NULL)\b/i],
    ['func', /\b[a-zA-Z_]\w*(?=\s*\()/],
    ['operator', /\$\d+|::|[+\-*/%=<>!]+/],
    ['punct', /[()[\];,.]/],
  ],

  c: [
    ['comment', /\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|#[^\n]*/],
    ['string', STRING_RE],
    ['decorator', /@[A-Za-z_]\w*/],
    ['number', NUMBER_RE],
    ['keyword', new RegExp(`\\b(?:${C_KEYWORDS})\\b`)],
    ['boolean', /\b(?:true|false|null|nil|NULL)\b/],
    ['class', /\b[A-Z][A-Za-z0-9_]*\b/],
    ['func', /\b[a-zA-Z_]\w*(?=\s*\()/],
    ['operator', /:=|->|[+\-*/%=<>!&|^~?:]+/],
    ['punct', /[{}()[\];,.]/],
  ],

  markup: [
    ['comment', /<!--[\s\S]*?(?:-->|$)|\/\*[\s\S]*?(?:\*\/|$)/],
    ['string', STRING_RE],
    ['tag', /<\/?[a-zA-Z][\w-]*|\/?>/],
    ['number', /\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms|deg|fr)?\b|#[\da-fA-F]{3,8}\b/],
    ['attr', /[a-zA-Z-]+(?=\s*[:=])/],
    ['keyword', /@[a-zA-Z-]+|![a-zA-Z]+/],
    ['punct', /[{}();,]/],
  ],

  shell: [
    ['comment', /#[^\n]*/],
    ['string', STRING_RE],
    ['keyword', /\b(?:if|then|else|fi|for|do|done|while|case|esac|function|return|export|source|local)\b/],
    ['func', /^\s*[a-zA-Z_][\w-]*(?=\s)/],
    ['operator', /\|\||&&|[|><&]/],
    ['number', NUMBER_RE],
  ],
};

const LANG_TO_FAMILY = {
  javascript: 'js', js: 'js', jsx: 'js', typescript: 'js', ts: 'js', tsx: 'js', json: 'js',
  python: 'py', py: 'py',
  sql: 'sql',
  java: 'c', csharp: 'c', cs: 'c', php: 'c', go: 'c', c: 'c', cpp: 'c', rust: 'c', kotlin: 'c', swift: 'c',
  html: 'markup', css: 'markup', scss: 'markup', xml: 'markup', vue: 'markup', svelte: 'markup',
  bash: 'shell', sh: 'shell', shell: 'shell', zsh: 'shell', powershell: 'shell',
};

const compiled = new Map();

function grammarFor(language) {
  const family = LANG_TO_FAMILY[String(language || '').toLowerCase()] || 'js';
  if (compiled.has(family)) return compiled.get(family);

  const rules = GRAMMARS[family] || GRAMMARS.js;
  const flags = family === 'sql' ? 'gmi' : 'gm';
  const regex = new RegExp(rules.map(([, re]) => `(${re.source})`).join('|'), flags);

  const entry = { regex, names: rules.map(([name]) => name) };
  compiled.set(family, entry);
  return entry;
}

/**
 * Realca o codigo e devolve HTML seguro.
 * @param {string} code
 * @param {string} language id da linguagem (javascript, python, sql, ...)
 */
export function highlight(code, language = 'javascript') {
  const source = String(code ?? '');
  if (!source) return '';

  // Arquivos muito grandes: devolve apenas escapado, para nao travar a UI.
  if (source.length > 220_000) return escapeHtml(source);

  const { regex, names } = grammarFor(language);
  regex.lastIndex = 0;

  let out = '';
  let last = 0;
  let match;
  let guard = 0;

  while ((match = regex.exec(source)) !== null) {
    if (guard++ > 60_000) break;

    if (match[0].length === 0) {
      regex.lastIndex += 1;
      continue;
    }

    if (match.index > last) out += escapeHtml(source.slice(last, match.index));

    const groupIndex = match.findIndex((value, i) => i > 0 && value !== undefined) - 1;
    const name = names[groupIndex] || 'punct';

    out += `<span class="t-${name}">${escapeHtml(match[0])}</span>`;
    last = match.index + match[0].length;
  }

  if (last < source.length) out += escapeHtml(source.slice(last));
  return out;
}

/** Bloco de codigo completo, com cabecalho e botao de copiar. */
export function codeBlockHtml(code, language = 'javascript', { label } = {}) {
  return `<div class="code-block">
  <div class="code-block__head">
    <span class="code-block__lang">${escapeHtml(label || language)}</span>
    <button class="copy-btn" data-copy type="button">
      <svg class="ico"><use href="#i-copy"/></svg><span>copiar</span>
    </button>
  </div>
  <pre><code>${highlight(code, language)}</code></pre>
</div>`;
}
