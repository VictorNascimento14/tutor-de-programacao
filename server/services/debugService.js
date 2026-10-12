/**
 * Servico de diagnostico de bugs.
 * Combina parsing do stack trace, base de conhecimento e analise do codigo relacionado.
 */
import { parseStackTrace } from '../engine/stacktrace.js';
import { matchErrorKnowledge } from '../knowledge/errors.js';
import { analyzeCode } from '../engine/analyzer.js';
import { detectLanguage } from '../engine/languageDetect.js';
import { config } from '../config.js';
import { badRequest, tooLarge, logger, uid } from '../utils/index.js';
import { provedorDisponivel, completar, extrairJson } from '../providers/ai.js';

const SYSTEM_DEBUG = `Voce e um especialista em depuracao e tambem professor.
Analise o erro e responda APENAS com um objeto JSON valido, sem texto ao redor:
{
  "explicacao": "o que esse erro significa, em linguagem clara, 2 a 4 frases",
  "causaMaisProvavel": "a causa mais provavel considerando o codigo enviado",
  "causas": [{ "titulo": "...", "detalhe": "...", "confianca": 0.4 }],
  "roteiro": ["passo de investigacao 1", "passo 2"],
  "correcoes": [{ "titulo": "...", "explicacao": "...", "codigo": "codigo corrigido" }],
  "conceito": "conceito para estudar",
  "prevencao": "como evitar esse erro no futuro"
}
A soma das confiancas deve ficar proxima de 1. Aponte a LINHA exata quando o codigo for enviado.
Escreva em portugues do Brasil, sem emojis.`;

function validar(payload) {
  const erro = typeof payload.error === 'string' ? payload.error.trim() : '';

  if (!erro) throw badRequest('Cole a mensagem de erro ou o stack trace');
  if (erro.length > 20000) throw tooLarge('Texto de erro muito grande');

  const codigo = typeof payload.code === 'string' ? payload.code : '';
  if (codigo.length > config.limits.maxCodeChars) throw tooLarge('Codigo muito grande');

  return {
    erro,
    codigo,
    languageHint: typeof payload.language === 'string' ? payload.language : 'auto',
    contexto: typeof payload.context === 'string' ? payload.context.slice(0, 2000) : '',
    usarIa: payload.useAi !== false,
  };
}

/** Normaliza as confiancas das causas para somar 1. */
function normalizarConfianca(causas) {
  const total = causas.reduce((soma, causa) => soma + (causa.confidence || 0), 0) || 1;
  return causas.map((causa) => ({
    ...causa,
    confidence: Math.round(((causa.confidence || 0) / total) * 100) / 100,
    percentual: Math.round(((causa.confidence || 0) / total) * 100),
  }));
}

/** Correlaciona o stack trace com achados do codigo enviado. */
function correlacionar(stack, analise) {
  if (!analise || !stack.origin) return [];

  const linhaDoErro = stack.origin.line;
  return analise.findings
    .filter((finding) => Math.abs(finding.line - linhaDoErro) <= 5)
    .slice(0, 5)
    .map((finding) => ({
      title: finding.title,
      line: finding.line,
      severity: finding.severity,
      message: finding.message,
      distancia: Math.abs(finding.line - linhaDoErro),
    }));
}

/**
 * Diagnostica um erro.
 * @returns {Promise<object>}
 */
export async function diagnosticarErro(payload) {
  const { erro, codigo, languageHint, contexto, usarIa } = validar(payload);

  const stack = parseStackTrace(erro);
  const linguagem = codigo.trim()
    ? detectLanguage(codigo, languageHint)
    : { id: stack.language, label: stack.language, family: 'other' };

  const idioma = stack.language !== 'unknown' ? stack.language : linguagem.id;
  const correspondencias = matchErrorKnowledge(erro, idioma);
  const melhor = correspondencias[0];

  // Analise estatica do codigo relacionado, quando enviado.
  let analise = null;
  if (codigo.trim()) {
    try {
      analise = analyzeCode(codigo, { languageHint });
    } catch (e) {
      logger.warn('Analise do codigo de apoio falhou:', e.message);
    }
  }

  const base = melhor?.entry;

  const diagnostico = {
    id: uid('d'),
    title: base?.title || `Erro: ${stack.type}`,
    errorType: stack.type,
    errorMessage: stack.message,
    severity: base?.severity || 'medium',
    language: idioma,
    plain:
      base?.plain ||
      'Este erro nao esta no catalogo de padroes conhecidos. ' +
        'Use o roteiro de investigacao abaixo: ele vale para qualquer erro e costuma isolar a causa em poucos passos.',
    causes: normalizarConfianca(base?.causes || []),
    checklist: base?.checklist || [
      'Reproduza o erro de forma confiavel: quais passos exatos levam a ele?',
      'Leia a mensagem completa e identifique o tipo do erro.',
      'No stack trace, localize o primeiro arquivo do SEU projeto.',
      'Imprima os valores das variaveis envolvidas imediatamente antes da linha que falha.',
      'Formule uma hipotese especifica e teste apenas ela.',
      'Depois de corrigir, escreva um teste que falharia sem a correcao.',
    ],
    fixes: base?.fixes || [],
    concept: base?.concept || 'Metodo de depuracao',
    prevention: base?.prevention || null,
    stack: {
      type: stack.type,
      message: stack.message,
      hasStack: stack.hasStack,
      frames: stack.frames.slice(0, 25),
      appFrames: stack.appFrames.slice(0, 12),
      origin: stack.origin,
    },
    relacionados: correlacionar(stack, analise),
    analiseCodigo: analise
      ? {
          score: analise.score,
          grade: analise.grade,
          totalAchados: analise.findings.length,
          language: analise.language,
          metrics: analise.metrics,
          findings: analise.findings.slice(0, 12),
        }
      : null,
    confidence: melhor ? Math.min(0.95, 0.5 + melhor.score * 0.12) : 0.25,
    reconhecido: Boolean(base),
    alternativas: correspondencias.slice(1, 4).map(({ entry }) => ({
      id: entry.id,
      title: entry.title,
      plain: entry.plain,
    })),
    engine: 'local',
  };

  // Enriquecimento opcional com IA.
  if (usarIa && provedorDisponivel()) {
    try {
      const prompt =
        `Erro:\n${erro}\n\n` +
        (codigo.trim()
          ? `Codigo relacionado (${linguagem.label}), com numeros de linha:\n` +
            codigo
              .split(/\r?\n/)
              .map((linha, i) => `${String(i + 1).padStart(4)} | ${linha}`)
              .join('\n') +
            '\n\n'
          : '') +
        (contexto ? `Contexto adicional do desenvolvedor:\n${contexto}\n` : '');

      const texto = await completar({ system: SYSTEM_DEBUG, prompt, maxTokens: 3000 });
      const dadosIa = extrairJson(texto);

      if (dadosIa) {
        diagnostico.ia = {
          explicacao: String(dadosIa.explicacao || '').slice(0, 1500),
          causaMaisProvavel: String(dadosIa.causaMaisProvavel || '').slice(0, 600),
          causas: normalizarConfianca(
            (dadosIa.causas || []).slice(0, 5).map((causa) => ({
              title: String(causa.titulo || '').slice(0, 160),
              detail: String(causa.detalhe || '').slice(0, 700),
              confidence: Number(causa.confianca) || 0.2,
            })),
          ),
          roteiro: (dadosIa.roteiro || []).slice(0, 8).map((passo) => String(passo).slice(0, 300)),
          correcoes: (dadosIa.correcoes || []).slice(0, 4).map((correcao) => ({
            title: String(correcao.titulo || '').slice(0, 160),
            explanation: String(correcao.explicacao || '').slice(0, 700),
            code: String(correcao.codigo || '').slice(0, 2500),
          })),
          conceito: dadosIa.conceito ? String(dadosIa.conceito).slice(0, 80) : null,
          prevencao: dadosIa.prevencao ? String(dadosIa.prevencao).slice(0, 600) : null,
        };
        diagnostico.engine = 'local+ia';
        diagnostico.confidence = Math.min(0.95, diagnostico.confidence + 0.2);
      }
    } catch (e) {
      logger.warn('Diagnostico com IA falhou, seguindo com a base local:', e.message);
      diagnostico.aviso = 'A analise com IA nao estava disponivel. Resultado da base local.';
    }
  }

  return diagnostico;
}
