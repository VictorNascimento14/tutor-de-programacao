/**
 * Teste de fumaca: sobe o servidor, exercita todas as rotas e confere os
 * invariantes principais. Roda com `npm run smoke`.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = Number(process.env.SMOKE_PORT || 3999);
const BASE = `http://127.0.0.1:${PORTA}`;

let falhas = 0;
let total = 0;

function verificar(descricao, condicao, detalhe = '') {
  total += 1;
  const ok = Boolean(condicao);
  if (!ok) falhas += 1;
  const marca = ok ? '\u001b[32mOK  \u001b[0m' : '\u001b[31mFALHA\u001b[0m';
  console.log(`${marca} ${descricao}${detalhe && !ok ? ` -> ${detalhe}` : ''}`);
}

const pedir = async (rota, opcoes = {}) => {
  const resposta = await fetch(`${BASE}${rota}`, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...(opcoes.headers || {}) },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  });
  return { status: resposta.status, json: await resposta.json().catch(() => null) };
};

async function esperarServidor(tentativas = 40) {
  for (let i = 0; i < tentativas; i += 1) {
    try {
      const resposta = await fetch(`${BASE}/api/health`);
      if (resposta.ok) return true;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function rodar() {
  console.log(`\nTutor de Programacao - teste de fumaca (porta ${PORTA})\n`);

  // ------------------------------------------------------------- health --
  const saude = await pedir('/api/health');
  verificar('GET /api/health responde 200', saude.status === 200, String(saude.status));
  verificar('motor local ativo', saude.json?.engine?.local === true);

  // --------------------------------------------------------------- meta --
  const meta = await pedir('/api/meta');
  const dados = meta.json?.data;
  verificar('GET /api/meta responde 200', meta.status === 200);
  verificar('catalogo tem regras', dados?.catalogo?.total > 40, `total=${dados?.catalogo?.total}`);
  verificar('conceitos carregados', dados?.conceitos?.length >= 10, `n=${dados?.conceitos?.length}`);
  verificar('exemplos carregados', dados?.exemplos?.length >= 5, `n=${dados?.exemplos?.length}`);
  verificar('linguagens carregadas', dados?.linguagens?.length >= 8);

  // ------------------------------------------------------------- review --
  const codigoRuim = [
    'const API_KEY = "sk-live-1234567890abcdef";',
    'var x = 1;',
    'if (x == 1) { eval("alert(1)"); }',
    'db.query("SELECT * FROM u WHERE id = " + req.query.id);',
    'try { salvar(); } catch (e) {}',
  ].join('\n');

  const review = await pedir('/api/review', { method: 'POST', body: { code: codigoRuim } });
  const r = review.json?.data;
  verificar('POST /api/review responde 200', review.status === 200);
  verificar('detecta JavaScript', r?.language?.id === 'javascript', r?.language?.id);
  verificar('encontra achados', r?.findings?.length >= 5, `n=${r?.findings?.length}`);
  verificar('acha o segredo no codigo', r?.findings?.some((f) => f.ruleId === 'sec/hardcoded-secret'));
  verificar('acha o eval', r?.findings?.some((f) => f.ruleId === 'js/no-eval'));
  verificar('acha a SQL injection', r?.findings?.some((f) => f.ruleId === 'js/sql-injection'));
  verificar('acha o catch vazio', r?.findings?.some((f) => f.ruleId === 'quality/empty-catch'));
  verificar('nota baixa para codigo ruim', r?.score <= 40, `score=${r?.score}`);
  verificar('todo achado tem explicacao', r?.findings?.every((f) => f.why && f.how));
  verificar('todo achado tem linha valida', r?.findings?.every((f) => f.line >= 1));
  verificar('devolve sessao', typeof review.json?.sessionId === 'string');
  verificar('concede XP', review.json?.recompensa?.xpGanho > 0);

  const sessao = review.json.sessionId;
  const comSessao = { 'X-Session-Id': sessao };

  // codigo limpo deve pontuar alto
  const limpo = await pedir('/api/review', {
    method: 'POST',
    headers: comSessao,
    body: {
      code: 'export function somar(a, b) {\n  return a + b;\n}\n',
    },
  });
  verificar('nota alta para codigo limpo', limpo.json?.data?.score >= 85, `score=${limpo.json?.data?.score}`);

  // entrada invalida
  const vazio = await pedir('/api/review', { method: 'POST', body: { code: '   ' } });
  verificar('rejeita codigo vazio com 400', vazio.status === 400, String(vazio.status));

  // -------------------------------------------------------------- debug --
  const debug = await pedir('/api/debug', {
    method: 'POST',
    headers: comSessao,
    body: {
      error:
        "TypeError: Cannot read properties of undefined (reading 'nome')\n" +
        '    at formatarPerfil (src/perfil.js:42:31)\n' +
        '    at handler (node_modules/express/lib/router.js:95:5)',
    },
  });
  const d = debug.json?.data;
  verificar('POST /api/debug responde 200', debug.status === 200);
  verificar('reconhece o padrao do erro', d?.reconhecido === true);
  verificar('interpreta o stack trace', d?.stack?.frames?.length === 2, `n=${d?.stack?.frames?.length}`);
  verificar(
    'identifica o frame da aplicacao como origem',
    d?.stack?.origin?.file?.includes('perfil.js'),
    d?.stack?.origin?.file,
  );
  verificar('marca node_modules como ruido', d?.stack?.frames?.some((f) => f.appCode === false));
  verificar('lista causas provaveis', d?.causes?.length >= 3);
  verificar(
    'confiancas somam ~100%',
    Math.abs(d.causes.reduce((s, c) => s + c.percentual, 0) - 100) <= 2,
    String(d?.causes?.reduce((s, c) => s + c.percentual, 0)),
  );
  verificar('tem roteiro de investigacao', d?.checklist?.length >= 3);
  verificar('tem correcoes com codigo', d?.fixes?.some((f) => f.code));

  const erroDesconhecido = await pedir('/api/debug', {
    method: 'POST',
    body: { error: 'FooBarError: algo muito especifico aconteceu' },
  });
  verificar('erro desconhecido ainda devolve roteiro', erroDesconhecido.json?.data?.checklist?.length >= 3);
  verificar('erro desconhecido marcado como generico', erroDesconhecido.json?.data?.reconhecido === false);

  // -------------------------------------------------------------- tutor --
  const tutor = await pedir('/api/tutor', {
    method: 'POST',
    headers: comSessao,
    body: { question: 'o que e closure em javascript?', mode: 'explicar' },
  });
  verificar('POST /api/tutor responde 200', tutor.status === 200);
  verificar('encontra o conceito', tutor.json?.data?.concept?.id === 'closures', tutor.json?.data?.concept?.id);
  verificar('resposta substancial', tutor.json?.data?.answer?.length > 800);
  verificar('resposta tem bloco de codigo', tutor.json?.data?.answer?.includes('```'));

  const socratico = await pedir('/api/tutor', {
    method: 'POST',
    body: { question: 'o que e closure', mode: 'socratico' },
  });
  verificar('modo socratico devolve perguntas', socratico.json?.data?.answer?.includes('?'));
  verificar(
    'modo socratico nao entrega a resposta pronta',
    socratico.json?.data?.answer?.includes('Se travar'),
  );

  // streaming
  const stream = await fetch(`${BASE}/api/tutor/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...comSessao },
    body: JSON.stringify({ question: 'o que e big-o', mode: 'explicar' }),
  });
  const texto = await stream.text();
  verificar('SSE emite deltas', (texto.match(/^event: delta$/gm) || []).length > 10);
  verificar('SSE emite meta', texto.includes('event: meta'));
  verificar('SSE encerra com done', texto.includes('event: done'));

  // ------------------------------------------------------------- sessao --
  const estado = await pedir('/api/session', { headers: comSessao });
  const prog = estado.json?.data?.progresso;
  verificar('GET /api/session responde 200', estado.status === 200);
  verificar('historico acumulou itens', estado.json?.data?.historico?.length >= 4, `n=${estado.json?.data?.historico?.length}`);
  verificar('contou as analises', prog?.analises === 2, `analises=${prog?.analises}`);
  verificar('contou os bugs', prog?.bugsDiagnosticados === 1);
  verificar('XP positivo', prog?.xp > 0);
  verificar('conquistas concedidas', prog?.conquistasDetalhadas?.length >= 1);

  const itemReview = estado.json.data.historico.find((h) => h.tipo === 'review');
  const item = await pedir(`/api/session/history/${itemReview.id}`, { headers: comSessao });
  verificar(
    'recupera item do historico com o codigo original',
    item.status === 200 && Boolean(item.json?.data?.codigo) && Boolean(item.json?.data?.resultado),
  );

  const inexistente = await pedir('/api/session/history/nao-existe', { headers: comSessao });
  verificar('item inexistente devolve 404', inexistente.status === 404);

  const limpar = await pedir('/api/session/history', { method: 'DELETE', headers: comSessao });
  verificar('limpa o historico', limpar.json?.data?.historico?.length === 0);

  // -------------------------------------------------------- estaticos ---
  const pagina = await fetch(`${BASE}/`);
  const html = await pagina.text();
  verificar('serve o index', pagina.status === 200 && html.includes('<title>'));
  verificar('versiona CSS e JS no HTML', /styles\/base\.css\?v=\d+/.test(html));

  const modulo = await fetch(`${BASE}/js/main.js`);
  const js = await modulo.text();
  verificar('serve os modulos', modulo.status === 200);
  verificar('versiona os imports relativos', /from '\.\/lib\/dom\.js\?v=\d+'/.test(js));

  const traversal = await fetch(`${BASE}/../package.json`);
  verificar('bloqueia path traversal', traversal.status === 404, String(traversal.status));

  const rotaRuim = await fetch(`${BASE}/api/nao-existe`);
  verificar('rota inexistente devolve 404', rotaRuim.status === 404);

  // ----------------------------------------------------------- resumo ---
  console.log(`\n${total - falhas}/${total} verificacoes passaram\n`);
  return falhas;
}

// ------------------------------------------------------------- execucao --
const servidor = spawn(process.execPath, [path.join(RAIZ, 'server', 'index.js')], {
  cwd: RAIZ,
  env: { ...process.env, PORT: String(PORTA), LOG_LEVEL: 'error' },
  stdio: ['ignore', 'ignore', 'inherit'],
});

const encerrar = (codigo) => {
  servidor.kill();
  process.exit(codigo);
};

if (!(await esperarServidor())) {
  console.error('O servidor nao subiu a tempo.');
  encerrar(1);
}

try {
  encerrar((await rodar()) === 0 ? 0 : 1);
} catch (erro) {
  console.error('\nErro durante o teste:', erro);
  encerrar(1);
}
