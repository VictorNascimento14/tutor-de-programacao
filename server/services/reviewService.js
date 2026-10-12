/**
 * Servico de code review.
 * Combina motor local de analise estatica (57 regras) com modo hibrido:
 * - JEV Decision Engine (typesafe/jev-1.13) para decisoes de veredito e prioridade
 * - LLM Principal (deepseek/deepseek-v4.1-flash) para enriquecimento explicativo e correcoes
 */
import { analyzeCode } from '../engine/analyzer.js';
import { config, hasOpenRouter } from '../config.js';
import { badRequest, tooLarge, logger } from '../utils/index.js';
import { executeHybrid, extrairJson as extrairJsonOr } from '../providers/openrouter.js';
import { provedorDisponivel as temAnthropic, completar as completarAnthropic, extrairJson as extrairJsonAnt } from '../providers/anthropic.js';

const SYSTEM_REVIEW = `Voce e um revisor de codigo senior e tambem professor.
Analise o codigo e responda APENAS com um objeto JSON valido, sem texto ao redor, no formato:
{
  "resumo": "2 a 3 frases sobre o estado geral do codigo",
  "pontosFortes": ["o que esta bem feito", "..."],
  "achados": [
    {
      "titulo": "nome curto do problema",
      "linha": 12,
      "severidade": "critical|high|medium|low|info",
      "categoria": "security|bug|performance|maintainability|best-practice|style",
      "mensagem": "o que esta errado",
      "porque": "por que isso importa, de forma didatica, com a consequencia concreta",
      "como": "como corrigir",
      "conceito": "nome do conceito para estudar",
      "correcao": { "antes": "codigo atual", "depois": "codigo corrigido" }
    }
  ],
  "proximosPassos": ["acao priorizada 1", "acao 2"]
}
Seja especifico e cite numeros de linha reais. Nao invente problemas que nao existem.
Escreva em portugues do Brasil, sem emojis.`;

/** Valida a entrada da analise. */
function validar(payload) {
  const codigo = typeof payload.code === 'string' ? payload.code : '';

  if (!codigo.trim()) throw badRequest('Envie o codigo que deve ser analisado');
  if (codigo.length > config.limits.maxCodeChars) {
    throw tooLarge(
      `Codigo muito grande (${codigo.length} caracteres). Limite: ${config.limits.maxCodeChars}.`,
    );
  }

  return {
    codigo,
    languageHint: typeof payload.language === 'string' ? payload.language : 'auto',
    categorias: Array.isArray(payload.categories) ? payload.categories : [],
    usarIa: payload.useAi !== false,
  };
}

/** Converte os achados da IA para o formato interno. */
function normalizarAchadosIa(dadosIa, totalLinhas) {
  const SEVERIDADES = ['critical', 'high', 'medium', 'low', 'info'];
  const CATEGORIAS = ['security', 'bug', 'performance', 'maintainability', 'best-practice', 'style'];

  return (dadosIa.achados || [])
    .filter((achado) => achado && achado.titulo)
    .slice(0, 40)
    .map((achado, indice) => ({
      id: `ai_${indice}`,
      ruleId: 'ai/analise',
      title: String(achado.titulo).slice(0, 120),
      severity: SEVERIDADES.includes(achado.severidade) ? achado.severidade : 'medium',
      category: CATEGORIAS.includes(achado.categoria) ? achado.categoria : 'maintainability',
      line: Math.max(1, Math.min(Number(achado.linha) || 1, Math.max(1, totalLinhas))),
      message: String(achado.mensagem || '').slice(0, 600),
      why: String(achado.porque || '').slice(0, 1200),
      how: String(achado.como || '').slice(0, 800),
      concept: achado.conceito ? String(achado.conceito).slice(0, 80) : null,
      fix:
        achado.correcao?.antes || achado.correcao?.depois
          ? {
              before: String(achado.correcao.antes || '').slice(0, 1500),
              after: String(achado.correcao.depois || '').slice(0, 1500),
            }
          : null,
      origem: 'ia',
    }));
}

/**
 * Executa a revisao de codigo de forma hibrida.
 * @returns {Promise<object>} resultado completo
 */
export async function revisarCodigo(payload) {
  const { codigo, languageHint, categorias, usarIa } = validar(payload);

  const resultado = analyzeCode(codigo, { languageHint, categories: categorias });
  const totalLinhas = codigo.split(/\r?\n/).length;

  const prompt =
    `Linguagem detectada: ${resultado.language.label}\n\n` +
    `Codigo (com numeros de linha):\n` +
    codigo
      .split(/\r?\n/)
      .map((linha, i) => `${String(i + 1).padStart(4)} | ${linha}`)
      .join('\n');

  // 1. Provedor Principal OpenRouter (JEV Decisoes + DeepSeek LLM em paralelo)
  if (usarIa && hasOpenRouter()) {
    try {
      const jevState = {
        code: codigo.slice(0, 6000),
        language: resultado.language.label,
        totalLines: totalLinhas,
        localFindingsCount: resultado.findings.length,
      };

      const jevQuestions = {
        securityVerdict: {
          type: 'choice',
          instructions: 'Avalie a presenca de vulnerabilidades ou riscos criticos no codigo',
          criteria: {
            critical: 'Possui falhas graves de seguranca (ex: SQL Injection, credenciais no codigo, RCE, XSS)',
            warning: 'Possui riscos moderados de bugs, performance ou qualidade',
            clean: 'Codigo seguro, estavel e sem falhas criticas detectadas'
          }
        },
        actionPriority: {
          type: 'choice',
          instructions: 'Qual a prioridade de acao imediata recomendada para o desenvolvedor?',
          criteria: {
            immediate_security_fix: 'Corrigir falhas criticas de seguranca antes do deploy',
            bug_fix: 'Resolver excecoes e erros de logica em execucao',
            refactor: 'Melhorar legibilidade, tipagem e padroes de projeto',
            approve: 'Aprovar o codigo'
          }
        },
        productionReady: {
          type: 'choice',
          instructions: 'O codigo esta pronto para ir para producao?',
          criteria: {
            ready: 'Sim, atende aos padroes de producao',
            needs_changes: 'Nao, requer alteracoes antes do deploy'
          }
        }
      };

      const resHibrido = await executeHybrid({
        jevState,
        jevQuestions,
        llmSystem: SYSTEM_REVIEW,
        llmPrompt: prompt,
        maxTokens: 3500,
      });

      if (resHibrido.jev?.ok && resHibrido.jev?.answers) {
        resultado.jev = {
          model: resHibrido.jev.model || 'typesafe/jev-1.13',
          answers: resHibrido.jev.answers,
          confidence: resHibrido.jev.answers.securityVerdict?.confidence || 1,
          latencyMs: resHibrido.jev.latencyMs,
          usage: resHibrido.jev.usage,
        };
      }

      const textoLlm = resHibrido.llm?.text;
      const dadosIa = extrairJsonOr(textoLlm);

      if (dadosIa) {
        resultado.ia = {
          resumo: String(dadosIa.resumo || '').slice(0, 1200),
          pontosFortes: (dadosIa.pontosFortes || []).slice(0, 6).map((p) => String(p).slice(0, 220)),
          proximosPassos: (dadosIa.proximosPassos || []).slice(0, 6).map((p) => String(p).slice(0, 220)),
          achados: normalizarAchadosIa(dadosIa, totalLinhas),
          modelo: resHibrido.llm?.model || config.openrouter.mainModel,
          latencyMs: resHibrido.llm?.latencyMs,
        };
      }

      resultado.engine = resultado.jev ? 'local+hybrid(jev+deepseek)' : 'local+ia';
      return resultado;
    } catch (erro) {
      logger.warn('Enriquecimento hibrido OpenRouter falhou, tentando fallback:', erro.message);
    }
  }

  // 2. Fallback legado Anthropic (se configurado)
  if (usarIa && temAnthropic()) {
    try {
      const texto = await completarAnthropic({ system: SYSTEM_REVIEW, prompt, maxTokens: 4000 });
      const dadosIa = extrairJsonAnt(texto);

      if (dadosIa) {
        resultado.ia = {
          resumo: String(dadosIa.resumo || '').slice(0, 1200),
          pontosFortes: (dadosIa.pontosFortes || []).slice(0, 6).map((p) => String(p).slice(0, 220)),
          proximosPassos: (dadosIa.proximosPassos || []).slice(0, 6).map((p) => String(p).slice(0, 220)),
          achados: normalizarAchadosIa(dadosIa, totalLinhas),
          modelo: config.anthropic.model,
        };
        resultado.engine = 'local+ia';
      }
    } catch (erro) {
      logger.warn('Enriquecimento Anthropic falhou:', erro.message);
      resultado.aviso = 'A analise com IA nao estava disponivel. Resultado do motor local.';
    }
  }

  return resultado;
}
