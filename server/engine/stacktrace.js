/** Parsing de mensagens de erro e stack traces de varias linguagens. */

const JS_FRAME =
  /^\s*at\s+(?:(?<fn>[\w$.<>[\] ]+?)\s+\()?(?<file>[^\s()]+?):(?<line>\d+):(?<col>\d+)\)?\s*$/;

const PY_FRAME =
  /^\s*File\s+"(?<file>[^"]+)",\s+line\s+(?<line>\d+)(?:,\s+in\s+(?<fn>[\w.<>]+))?/;

const JAVA_FRAME = /^\s*at\s+(?<fn>[\w$.]+)\((?<file>[\w$.]+):(?<line>\d+)\)/;

const ERROR_HEADER =
  /^\s*(?:Uncaught\s+)?(?<type>[A-Z]\w*(?:Error|Exception|Warning)|[A-Z]\w*)\s*:\s*(?<message>.+)$/;

const NODE_CODE = /\b(?<code>E[A-Z]{3,}|MODULE_NOT_FOUND|ERR_[A-Z_]+)\b/;

const isNoise = (line) =>
  /node_modules|node:internal|\(internal\/|webpack:|<anonymous>$|site-packages/.test(line);

/**
 * Extrai tipo, mensagem e frames de um texto de erro.
 * @param {string} input texto cru colado pelo usuario
 */
export function parseStackTrace(input = '') {
  const text = String(input).replace(/\r\n/g, '\n').trim();
  const lines = text.split('\n');
  const frames = [];

  let type = '';
  let message = '';
  let language = 'unknown';

  for (const line of lines) {
    let match = line.match(JS_FRAME);
    if (match) {
      language = 'javascript';
      frames.push({
        fn: (match.groups.fn || '(anonima)').trim(),
        file: match.groups.file,
        line: Number(match.groups.line),
        column: Number(match.groups.col),
        appCode: !isNoise(line),
      });
      continue;
    }

    match = line.match(PY_FRAME);
    if (match) {
      language = 'python';
      frames.push({
        fn: match.groups.fn || '(modulo)',
        file: match.groups.file,
        line: Number(match.groups.line),
        column: null,
        appCode: !isNoise(line),
      });
      continue;
    }

    match = line.match(JAVA_FRAME);
    if (match) {
      language = 'java';
      frames.push({
        fn: match.groups.fn,
        file: match.groups.file,
        line: Number(match.groups.line),
        column: null,
        appCode: !isNoise(line),
      });
    }
  }

  // O cabecalho do erro: em Python fica na ultima linha, em JS na primeira.
  const candidates = language === 'python' ? [...lines].reverse() : lines;
  for (const line of candidates) {
    if (JS_FRAME.test(line) || PY_FRAME.test(line) || JAVA_FRAME.test(line)) continue;
    const header = line.match(ERROR_HEADER);
    if (header) {
      type = header.groups.type;
      message = header.groups.message.trim();
      break;
    }
  }

  if (!type) {
    // Sem cabecalho formal: usa a primeira linha com conteudo como mensagem.
    const first = lines.find((l) => l.trim() && !JS_FRAME.test(l) && !PY_FRAME.test(l));
    message = (first || text).trim().slice(0, 300);
    const code = text.match(NODE_CODE);
    type = code ? code.groups.code : 'Erro';
  }

  if (language === 'unknown' && /Traceback \(most recent call last\)/.test(text)) {
    language = 'python';
  }

  const appFrames = frames.filter((f) => f.appCode);

  return {
    type,
    message,
    language,
    frames,
    appFrames,
    /** Primeiro frame do codigo da aplicacao - onde comecar a investigar. */
    origin: (language === 'python' ? appFrames[appFrames.length - 1] : appFrames[0]) || frames[0] || null,
    hasStack: frames.length > 0,
    raw: text.slice(0, 6000),
  };
}
