/** Deteccao heuristica de linguagem a partir do conteudo do codigo. */

export const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', family: 'js', ext: 'js' },
  { id: 'typescript', label: 'TypeScript', family: 'js', ext: 'ts' },
  { id: 'jsx', label: 'React / JSX', family: 'js', ext: 'jsx' },
  { id: 'python', label: 'Python', family: 'py', ext: 'py' },
  { id: 'java', label: 'Java', family: 'c', ext: 'java' },
  { id: 'csharp', label: 'C#', family: 'c', ext: 'cs' },
  { id: 'php', label: 'PHP', family: 'c', ext: 'php' },
  { id: 'go', label: 'Go', family: 'c', ext: 'go' },
  { id: 'sql', label: 'SQL', family: 'sql', ext: 'sql' },
  { id: 'html', label: 'HTML', family: 'markup', ext: 'html' },
  { id: 'css', label: 'CSS', family: 'markup', ext: 'css' },
  { id: 'plaintext', label: 'Texto', family: 'other', ext: 'txt' },
];

const BY_ID = new Map(LANGUAGES.map((lang) => [lang.id, lang]));

const EXT_MAP = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'jsx',
  jsx: 'jsx',
  py: 'python',
  java: 'java',
  cs: 'csharp',
  php: 'php',
  go: 'go',
  sql: 'sql',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'css',
};

/** Pontuacao por assinaturas tipicas de cada linguagem. */
const SIGNATURES = [
  { id: 'python', weight: 3, re: /^\s*def\s+\w+\s*\(.*\)\s*(->[^:]+)?:/m },
  { id: 'python', weight: 3, re: /^\s*(from\s+[\w.]+\s+)?import\s+[\w*.,\s]+$/m },
  { id: 'python', weight: 2, re: /^\s*class\s+\w+(\(\w*\))?\s*:/m },
  { id: 'python', weight: 2, re: /\bself\b\s*[.,)]/ },
  { id: 'python', weight: 2, re: /\b(elif|None|True|False)\b/ },
  { id: 'python', weight: 2, re: /\bprint\s*\(/ },

  { id: 'typescript', weight: 3, re: /\b(interface|type)\s+\w+\s*[={<]/ },
  { id: 'typescript', weight: 3, re: /:\s*(string|number|boolean|void|any|unknown|never)\b/ },
  { id: 'typescript', weight: 2, re: /\b(enum|namespace|declare|readonly)\b/ },
  { id: 'typescript', weight: 2, re: /\b(public|private|protected)\s+\w+\s*[:(]/ },

  { id: 'jsx', weight: 4, re: /<[A-Z]\w*[^>]*\/?>/ },
  { id: 'jsx', weight: 3, re: /\buse(State|Effect|Memo|Callback|Ref|Context|Reducer)\s*\(/ },
  { id: 'jsx', weight: 2, re: /\bclassName\s*=/ },
  { id: 'jsx', weight: 2, re: /from\s+['"]react['"]/ },

  { id: 'javascript', weight: 2, re: /\b(const|let|var)\s+\w+\s*=/ },
  { id: 'javascript', weight: 2, re: /\bfunction\s*\w*\s*\(|=>\s*[{(]/ },
  { id: 'javascript', weight: 2, re: /\b(console\.(log|error|warn)|require\s*\(|module\.exports)\b/ },
  { id: 'javascript', weight: 2, re: /\b(async|await|Promise)\b/ },

  { id: 'java', weight: 4, re: /\bpublic\s+(static\s+)?(class|void|final)\b/ },
  { id: 'java', weight: 3, re: /\bSystem\.out\.print/ },
  { id: 'java', weight: 2, re: /\bimport\s+(java|javax)\./ },

  { id: 'csharp', weight: 4, re: /\busing\s+System(\.\w+)*\s*;/ },
  { id: 'csharp', weight: 3, re: /\bConsole\.Write(Line)?\s*\(/ },
  { id: 'csharp', weight: 2, re: /\bnamespace\s+\w+/ },

  { id: 'php', weight: 5, re: /<\?php/ },
  { id: 'php', weight: 3, re: /\$\w+\s*(=|->)/ },
  { id: 'php', weight: 2, re: /\becho\s+/ },

  { id: 'go', weight: 5, re: /\bfunc\s+(\w+|\(\w+\s+\*?\w+\))\s*\w*\s*\(/ },
  { id: 'go', weight: 3, re: /\bpackage\s+main\b/ },
  { id: 'go', weight: 2, re: /:=/ },

  // SQL, HTML e CSS sao testados com as strings apagadas: do contrario um
  // `db.query("SELECT ... FROM ...")` dentro de um arquivo JavaScript faria o
  // arquivo inteiro ser detectado como SQL.
  { id: 'sql', weight: 4, re: /\bSELECT\b[\s\S]{0,200}\bFROM\b/i, semStrings: true },
  { id: 'sql', weight: 3, re: /\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|CREATE\s+TABLE)\b/i, semStrings: true },

  { id: 'html', weight: 4, re: /<(!DOCTYPE|html|head|body|div|section)\b/i, semStrings: true },
  { id: 'css', weight: 3, re: /[.#]?[\w-]+\s*\{[^}]*:[^}]*;[^}]*\}/, semStrings: true },
];

/** Apaga o conteudo das strings, preservando o tamanho das linhas. */
const apagarStrings = (codigo) =>
  codigo
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');

/**
 * Detecta a linguagem do codigo.
 * @param {string} code
 * @param {string} [hint] id de linguagem, extensao ou nome de arquivo
 */
export function detectLanguage(code = '', hint = '') {
  const normalizedHint = String(hint || '').toLowerCase().trim();

  if (normalizedHint && normalizedHint !== 'auto') {
    if (BY_ID.has(normalizedHint)) return BY_ID.get(normalizedHint);
    const ext = normalizedHint.includes('.')
      ? normalizedHint.split('.').pop()
      : normalizedHint;
    if (EXT_MAP[ext]) return BY_ID.get(EXT_MAP[ext]);
  }

  if (!code.trim()) return BY_ID.get('plaintext');

  const semStrings = apagarStrings(code);

  const scores = new Map();
  for (const signature of SIGNATURES) {
    const alvo = signature.semStrings ? semStrings : code;
    if (signature.re.test(alvo)) {
      scores.set(signature.id, (scores.get(signature.id) || 0) + signature.weight);
    }
  }

  // JSX e TypeScript herdam o peso de JavaScript (sao supersets).
  const jsScore = scores.get('javascript') || 0;
  if (scores.has('jsx')) scores.set('jsx', scores.get('jsx') + jsScore * 0.5);
  if (scores.has('typescript')) scores.set('typescript', scores.get('typescript') + jsScore * 0.5);

  let best = { id: 'plaintext', score: 0 };
  for (const [id, score] of scores) {
    if (score > best.score) best = { id, score };
  }

  return BY_ID.get(best.score >= 2 ? best.id : 'plaintext');
}

export const getLanguage = (id) => BY_ID.get(id) || BY_ID.get('plaintext');
