/**
 * Servico do modo Tutor.
 * Tres modos de resposta: explicar, socratico (perguntas guia) e exemplos.
 */
import { searchConcepts, conceptIndex } from '../knowledge/concepts.js';
import { badRequest } from '../utils/index.js';
import { provedorDisponivel, completar, completarStream } from '../providers/ai.js';

export const MODOS = {
  explicar: {
    id: 'explicar',
    label: 'Explicar',
    descricao: 'Resposta direta e didatica, com analogia e exemplo de codigo',
  },
  socratico: {
    id: 'socratico',
    label: 'Socratico',
    descricao: 'Em vez da resposta, perguntas que te levam a conclusao',
  },
  exemplos: {
    id: 'exemplos',
    label: 'Exemplos',
    descricao: 'Foco em codigo comentado, com casos de uso e contraexemplos',
  },
};

const NIVEIS = {
  iniciante: 'Explique como para alguem que programa ha poucos meses. Evite jargao sem definir.',
  intermediario: 'Assuma familiaridade com a linguagem. Pode usar termos tecnicos comuns.',
  avancado: 'Publico experiente. Va direto aos detalhes finos, trade-offs e casos de borda.',
};

const SYSTEM_BASE = `Voce e um tutor de programacao experiente, paciente e direto.
Principios:
- Explique o POR QUE, nao apenas o COMO. A consequencia concreta importa mais que a regra.
- Use uma analogia do mundo real quando o conceito for abstrato.
- Mostre codigo curto e comentado: antes e depois, quando fizer sentido.
- Aponte os erros mais comuns relacionados ao tema.
- Termine com um exercicio pratico pequeno.
Formate em Markdown com titulos (##), listas e blocos de codigo com a linguagem indicada.
Escreva em portugues do Brasil. Nao use emojis.`;

const SYSTEM_SOCRATICO = `Voce e um tutor que usa o metodo socratico.
NAO entregue a resposta pronta. Conduza com perguntas.
Estrutura da resposta:
1. Uma frase reconhecendo a duvida e delimitando o que esta em jogo.
2. De 3 a 5 perguntas em ordem crescente de profundidade, cada uma com uma dica curta
   do que observar para responder.
3. Um pequeno experimento que a pessoa pode rodar para descobrir sozinha.
4. Uma unica pista decisiva, no final, marcada como "Se travar".
Formate em Markdown. Escreva em portugues do Brasil. Nao use emojis.`;

const SYSTEM_EXEMPLOS = `Voce e um tutor focado em codigo.
Responda priorizando exemplos executaveis:
1. O exemplo minimo que demonstra o conceito.
2. Um contraexemplo: a versao errada, com o comentario do que da errado e por que.
3. Uma variacao realista, de codigo de producao.
4. Como testar ou verificar o comportamento.
Comente o codigo linha a linha onde for relevante. Pouco texto fora do codigo.
Formate em Markdown. Escreva em portugues do Brasil. Nao use emojis.`;

const systemPara = (modo, nivel) => {
  const base =
    modo === 'socratico' ? SYSTEM_SOCRATICO : modo === 'exemplos' ? SYSTEM_EXEMPLOS : SYSTEM_BASE;
  return `${base}\n\nNivel do aluno: ${NIVEIS[nivel] || NIVEIS.intermediario}`;
};

function validar(payload) {
  const pergunta = typeof payload.question === 'string' ? payload.question.trim() : '';
  if (!pergunta) throw badRequest('Escreva a sua pergunta');
  if (pergunta.length > 4000) throw badRequest('Pergunta muito longa');

  return {
    pergunta,
    modo: MODOS[payload.mode] ? payload.mode : 'explicar',
    nivel: NIVEIS[payload.level] ? payload.level : 'intermediario',
    codigo: typeof payload.code === 'string' ? payload.code.slice(0, 20000) : '',
    usarIa: payload.useAi !== false,
  };
}

/** Monta o prompt enviado a IA. */
function montarPrompt({ pergunta, codigo, conceito }) {
  let prompt = `Pergunta do aluno: ${pergunta}`;

  if (codigo.trim()) {
    prompt += `\n\nCodigo que o aluno esta analisando:\n\`\`\`\n${codigo}\n\`\`\``;
  }

  if (conceito) {
    prompt +=
      `\n\n(Referencia interna, use como apoio sem copiar literalmente - ` +
      `o conceito central parece ser "${conceito.title}": ${conceito.tldr})`;
  }

  return prompt;
}

/** Renderiza um conceito da base local como Markdown. */
function conceitoParaMarkdown(conceito, modo) {
  const partes = [];

  if (modo === 'socratico') {
    partes.push(`## ${conceito.title}`);
    partes.push(
      'Antes da resposta, tente responder a estas perguntas - elas constroem o entendimento ' +
        'na ordem certa:\n',
    );

    const perguntas = [
      `O que voce espera que aconteca quando ${conceito.title.toLowerCase()} entra em jogo? Escreva sua previsao antes de testar.`,
      `Qual problema concreto isso resolve? Se o recurso nao existisse, o que voce faria no lugar?`,
      `Qual o custo? Todo recurso tem um - memoria, complexidade, performance ou acoplamento.`,
      `Onde isso NAO deve ser usado? Saber o limite e o que separa conhecer de dominar.`,
    ];
    partes.push(perguntas.map((p, i) => `${i + 1}. ${p}`).join('\n'));

    partes.push(`\n## Experimento\n\n${conceito.exercise}`);
    partes.push(`\n## Se travar\n\n${conceito.tldr}`);
    partes.push(`\n> ${conceito.analogy}`);
    return partes.join('\n');
  }

  partes.push(`## ${conceito.title}`);
  partes.push(`**Em uma frase:** ${conceito.tldr}`);

  if (modo !== 'exemplos') {
    partes.push(`\n### A analogia\n\n${conceito.analogy}`);
    for (const secao of conceito.sections) {
      partes.push(`\n### ${secao.heading}\n\n${secao.body}`);
    }
  }

  partes.push(`\n### Na pratica\n\n\`\`\`${conceito.example.language}\n${conceito.example.code}\n\`\`\``);

  partes.push('\n### Erros comuns\n');
  for (const erro of conceito.mistakes) {
    partes.push(`- **${erro.title}** - ${erro.detail}`);
  }

  partes.push(`\n### Exercicio\n\n${conceito.exercise}`);

  if (conceito.related?.length) {
    partes.push(`\n### Para estudar depois\n\n${conceito.related.join(', ')}`);
  }

  return partes.join('\n');
}

/** Resposta quando nenhum conceito da base combina com a pergunta. */
function respostaGenerica(pergunta, modo) {
  const titulo = pergunta.length > 70 ? `${pergunta.slice(0, 70)}...` : pergunta;

  if (modo === 'socratico') {
    return [
      `## Sobre: ${titulo}`,
      '',
      'Essa pergunta nao esta no meu catalogo offline de conceitos, mas o caminho para responder ' +
        'qualquer duvida tecnica e o mesmo. Tente nesta ordem:',
      '',
      '1. **Qual e o resultado que voce esperava, exatamente?** Escreva em uma frase. ' +
        'Metade das duvidas se resolve aqui, porque a expectativa estava imprecisa.',
      '2. **O que acontece de fato?** Mensagem de erro completa, ou valor observado. Sem parafrasear.',
      '3. **Qual e a menor reproducao possivel?** Corte tudo que nao e necessario para o problema aparecer.',
      '4. **Qual a sua hipotese?** Especifica e testavel - nao "deve ser o framework".',
      '5. **Como testar essa hipotese em um unico passo?**',
      '',
      '## Se travar',
      '',
      'Com a chave de IA configurada (`ANTHROPIC_API_KEY` no arquivo `.env`), eu respondo ' +
        'qualquer pergunta em linguagem natural. Sem ela, eu cubro os conceitos do catalogo ' +
        'listado na barra lateral.',
    ].join('\n');
  }

  return [
    `## Sobre: ${titulo}`,
    '',
    'Esse tema nao esta no catalogo offline de conceitos. Duas formas de seguir:',
    '',
    '### 1. Escolher um conceito do catalogo',
    '',
    'Os conceitos abaixo estao disponiveis com explicacao completa, analogia, exemplo de codigo, ' +
      'erros comuns e exercicio:',
    '',
    ...conceptIndex.map((c) => `- **${c.title}** - ${c.tldr}`),
    '',
    '### 2. Ativar a IA para perguntas livres',
    '',
    'Defina `ANTHROPIC_API_KEY` no arquivo `.env` e reinicie o servidor. ' +
      'O modo Tutor passa a responder qualquer pergunta, com os mesmos tres modos ' +
      '(Explicar, Socratico e Exemplos).',
    '',
    '### Enquanto isso',
    '',
    'Se a sua duvida e sobre um erro especifico, a aba **Resolver bug** tem uma base com ' +
      'mais de 30 erros comuns de JavaScript, Python, Java e HTTP, com causas provaveis ' +
      'e roteiro de investigacao.',
  ].join('\n');
}

/**
 * Responde uma pergunta do aluno.
 * @returns {Promise<object>}
 */
export async function responderPergunta(payload) {
  const dados = validar(payload);
  const correspondencias = searchConcepts(dados.pergunta);
  const conceito = correspondencias[0]?.concept || null;

  if (dados.usarIa && provedorDisponivel()) {
    try {
      const resposta = await completar({
        system: systemPara(dados.modo, dados.nivel),
        prompt: montarPrompt({ ...dados, conceito }),
        maxTokens: 3000,
      });

      return {
        answer: resposta,
        mode: dados.modo,
        level: dados.nivel,
        concept: conceito ? { id: conceito.id, title: conceito.title } : null,
        related: correspondencias.slice(1, 4).map(({ concept }) => ({
          id: concept.id,
          title: concept.title,
          tldr: concept.tldr,
        })),
        engine: 'ia',
      };
    } catch {
      /* cai para a base local */
    }
  }

  return {
    answer: conceito
      ? conceitoParaMarkdown(conceito, dados.modo)
      : respostaGenerica(dados.pergunta, dados.modo),
    mode: dados.modo,
    level: dados.nivel,
    concept: conceito ? { id: conceito.id, title: conceito.title } : null,
    related: correspondencias.slice(1, 4).map(({ concept }) => ({
      id: concept.id,
      title: concept.title,
      tldr: concept.tldr,
    })),
    engine: 'local',
  };
}

/**
 * Versao em streaming, para a resposta aparecer progressivamente.
 * @param {object} payload
 * @param {(texto: string) => void} onDelta
 */
export async function responderPerguntaStream(payload, onDelta) {
  const dados = validar(payload);
  const correspondencias = searchConcepts(dados.pergunta);
  const conceito = correspondencias[0]?.concept || null;

  const meta = {
    mode: dados.modo,
    level: dados.nivel,
    concept: conceito ? { id: conceito.id, title: conceito.title } : null,
    related: correspondencias.slice(1, 4).map(({ concept }) => ({
      id: concept.id,
      title: concept.title,
      tldr: concept.tldr,
    })),
  };

  if (dados.usarIa && provedorDisponivel()) {
    try {
      const completo = await completarStream(
        {
          system: systemPara(dados.modo, dados.nivel),
          prompt: montarPrompt({ ...dados, conceito }),
          maxTokens: 3000,
        },
        onDelta,
      );
      return { ...meta, answer: completo, engine: 'ia' };
    } catch {
      /* cai para a base local */
    }
  }

  // Streaming simulado da base local, para a experiencia ficar consistente.
  const texto = conceito
    ? conceitoParaMarkdown(conceito, dados.modo)
    : respostaGenerica(dados.pergunta, dados.modo);

  const pedacos = texto.match(/[\s\S]{1,28}/g) || [];
  for (const pedaco of pedacos) {
    onDelta(pedaco);
    await new Promise((resolve) => setTimeout(resolve, 12));
  }

  return { ...meta, answer: texto, engine: 'local' };
}

export const listarConceitos = () => conceptIndex;
