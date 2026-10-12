/**
 * Armazenamento em memoria (sem banco de dados).
 * Guarda historico de analises e progresso de aprendizado por sessao.
 * Tudo e perdido ao reiniciar o servidor - por design, nesta etapa do projeto.
 */
import { config } from '../config.js';
import { uid, nowIso, truncate } from '../utils/index.js';

/** @type {Map<string, object>} */
const sessions = new Map();

const XP_POR_SEVERIDADE = { critical: 25, high: 15, medium: 8, low: 4, info: 2 };
const XP_POR_NIVEL = 120;

function criarSessao(id) {
  return {
    id,
    criadaEm: nowIso(),
    atualizadaEm: nowIso(),
    historico: [],
    progresso: {
      xp: 0,
      nivel: 1,
      analises: 0,
      bugsDiagnosticados: 0,
      perguntasFeitas: 0,
      problemasEncontrados: 0,
      conceitosVistos: [],
      conquistas: [],
    },
  };
}

/** Obtem (ou cria) a sessao. */
export function getSession(sessionId) {
  const id = sessionId && sessions.has(sessionId) ? sessionId : sessionId || uid('s');

  if (!sessions.has(id)) {
    // Protecao simples contra crescimento ilimitado de memoria.
    if (sessions.size >= config.session.maxSessions) {
      const maisAntiga = [...sessions.entries()].sort(
        (a, b) => new Date(a[1].atualizadaEm) - new Date(b[1].atualizadaEm),
      )[0];
      if (maisAntiga) sessions.delete(maisAntiga[0]);
    }
    sessions.set(id, criarSessao(id));
  }

  const session = sessions.get(id);
  session.atualizadaEm = nowIso();
  return session;
}

const CONQUISTAS = [
  { id: 'primeira-analise', titulo: 'Primeira revisao', descricao: 'Analisou o primeiro trecho de codigo', teste: (p) => p.analises >= 1 },
  { id: 'cinco-analises', titulo: 'Revisor dedicado', descricao: '5 analises realizadas', teste: (p) => p.analises >= 5 },
  { id: 'dez-analises', titulo: 'Olho clinico', descricao: '10 analises realizadas', teste: (p) => p.analises >= 10 },
  { id: 'cacador-de-bugs', titulo: 'Cacador de bugs', descricao: 'Diagnosticou 3 erros', teste: (p) => p.bugsDiagnosticados >= 3 },
  { id: 'curioso', titulo: 'Mente curiosa', descricao: 'Fez 5 perguntas ao tutor', teste: (p) => p.perguntasFeitas >= 5 },
  { id: 'estudioso', titulo: 'Estudioso', descricao: 'Encontrou 8 conceitos diferentes', teste: (p) => p.conceitosVistos.length >= 8 },
  { id: 'nivel-3', titulo: 'Nivel 3', descricao: 'Alcancou o nivel 3', teste: (p) => p.nivel >= 3 },
  { id: 'nivel-5', titulo: 'Nivel 5', descricao: 'Alcancou o nivel 5', teste: (p) => p.nivel >= 5 },
];

/** Concede XP e devolve o que mudou (para o front animar). */
function concederXp(session, quantidade, conceitos = []) {
  const progresso = session.progresso;
  const nivelAnterior = progresso.nivel;

  progresso.xp += quantidade;
  progresso.nivel = Math.floor(progresso.xp / XP_POR_NIVEL) + 1;

  for (const conceito of conceitos) {
    if (conceito && !progresso.conceitosVistos.includes(conceito)) {
      progresso.conceitosVistos.push(conceito);
    }
  }

  const novasConquistas = [];
  for (const conquista of CONQUISTAS) {
    if (progresso.conquistas.includes(conquista.id)) continue;
    if (conquista.teste(progresso)) {
      progresso.conquistas.push(conquista.id);
      novasConquistas.push({ id: conquista.id, titulo: conquista.titulo, descricao: conquista.descricao });
    }
  }

  return {
    xpGanho: quantidade,
    subiuDeNivel: progresso.nivel > nivelAnterior,
    nivel: progresso.nivel,
    novasConquistas,
  };
}

/** Registra uma analise de codigo no historico. */
export function registrarAnalise(session, resultado, codigo) {
  const progresso = session.progresso;
  progresso.analises += 1;
  progresso.problemasEncontrados += resultado.findings.length;

  const xp =
    15 +
    resultado.findings.reduce(
      (total, finding) => total + (XP_POR_SEVERIDADE[finding.severity] || 0),
      0,
    );

  const recompensa = concederXp(
    session,
    Math.min(xp, 140),
    resultado.findings.map((f) => f.concept),
  );

  const item = {
    id: uid('h'),
    tipo: 'review',
    criadoEm: nowIso(),
    titulo: `${resultado.language.label} - ${resultado.findings.length} ${
      resultado.findings.length === 1 ? 'achado' : 'achados'
    }`,
    resumo: truncate(resultado.tutor.verdict, 120),
    score: resultado.score,
    grade: resultado.grade.letter,
    linguagem: resultado.language.label,
    totalAchados: resultado.findings.length,
    bloqueadores: resultado.summary.blockers,
    codigo: String(codigo || '').slice(0, 40000),
    resultado,
  };

  session.historico.unshift(item);
  session.historico = session.historico.slice(0, config.session.historySize);

  return { item, recompensa };
}

/** Registra um diagnostico de bug. */
export function registrarDiagnostico(session, diagnostico, textoErro) {
  session.progresso.bugsDiagnosticados += 1;

  const recompensa = concederXp(session, 20, [diagnostico.concept]);

  const item = {
    id: uid('h'),
    tipo: 'debug',
    criadoEm: nowIso(),
    titulo: diagnostico.title,
    resumo: truncate(diagnostico.plain, 120),
    erro: truncate(textoErro, 200),
    severidade: diagnostico.severity,
    confianca: diagnostico.confidence,
    resultado: diagnostico,
  };

  session.historico.unshift(item);
  session.historico = session.historico.slice(0, config.session.historySize);

  return { item, recompensa };
}

/** Registra uma pergunta ao tutor. */
export function registrarPergunta(session, pergunta, conceito) {
  session.progresso.perguntasFeitas += 1;
  const recompensa = concederXp(session, 10, [conceito]);

  const item = {
    id: uid('h'),
    tipo: 'tutor',
    criadoEm: nowIso(),
    titulo: truncate(pergunta, 70),
    resumo: conceito ? `Conceito: ${conceito}` : 'Pergunta livre',
    resultado: null,
  };

  session.historico.unshift(item);
  session.historico = session.historico.slice(0, config.session.historySize);

  return { item, recompensa };
}

/** Visao publica da sessao (sem o codigo completo de cada item). */
export function serializeSession(session) {
  const proximoNivelEm = session.progresso.nivel * XP_POR_NIVEL;
  const nivelAnteriorEm = (session.progresso.nivel - 1) * XP_POR_NIVEL;

  return {
    id: session.id,
    criadaEm: session.criadaEm,
    progresso: {
      ...session.progresso,
      xpNoNivel: session.progresso.xp - nivelAnteriorEm,
      xpParaProximoNivel: proximoNivelEm - nivelAnteriorEm,
      percentualNivel: Math.round(
        ((session.progresso.xp - nivelAnteriorEm) / XP_POR_NIVEL) * 100,
      ),
      conquistasDetalhadas: CONQUISTAS.filter((c) => session.progresso.conquistas.includes(c.id)).map(
        ({ id, titulo, descricao }) => ({ id, titulo, descricao }),
      ),
    },
    historico: session.historico.map(
      ({ id, tipo, criadoEm, titulo, resumo, score, grade, linguagem, totalAchados, bloqueadores, severidade }) => ({
        id,
        tipo,
        criadoEm,
        titulo,
        resumo,
        score,
        grade,
        linguagem,
        totalAchados,
        bloqueadores,
        severidade,
      }),
    ),
  };
}

/** Recupera um item completo do historico. */
export const getHistoryItem = (session, itemId) =>
  session.historico.find((item) => item.id === itemId) || null;

export function clearSession(session) {
  session.historico = [];
  return session;
}

/** Remove sessoes expiradas periodicamente. */
const limpeza = setInterval(() => {
  const limite = Date.now() - config.session.ttlMs;
  for (const [id, session] of sessions) {
    if (new Date(session.atualizadaEm).getTime() < limite) sessions.delete(id);
  }
}, 10 * 60 * 1000);
limpeza.unref?.();

export const sessionStats = () => ({ ativas: sessions.size });
