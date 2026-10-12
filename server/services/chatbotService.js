/**
 * Servico Hibrido de Chatbots:
 * Integra os 3 modelos de bots (Lumi/Servicos, Ze/Delivery, Kai/Demandas)
 * com motor de decisao JEV (typesafe/jev-1.13) e geracao conversacional DeepSeek (deepseek/deepseek-v4.1-flash).
 *
 * Utiliza cache em memoria (chatbotCache.js) para preservar historico multi-turno
 * e variaveis acumuladas (servicos, carrinho, demandas, horarios) sem repetir perguntas.
 */
import { executeHybrid, extrairJson } from '../providers/openrouter.js';
import { hasOpenRouter } from '../config.js';
import { logger } from '../utils/index.js';
import {
  getChatbotCache,
  updateChatbotCache,
  mergeChatbotVars,
} from './chatbotCache.js';

const CATALOGO_DELIVERY = [
  { categoria: 'burgers', title: 'Classico', price: 3290, desc: 'Carne, queijo, alface e tomate' },
  { categoria: 'burgers', title: 'Bacon duplo', price: 4490, desc: 'Dois burgers, cheddar e bacon' },
  { categoria: 'burgers', title: 'Veggie', price: 3590, desc: 'Grao de bico, abobrinha e tahine' },
  { categoria: 'pizzas', title: 'Margherita', price: 4290, desc: 'Molho, mucarela, tomate e basilico' },
  { categoria: 'pizzas', title: 'Calabresa', price: 4690, desc: 'Calabresa artesanal e cebola roxa' },
  { categoria: 'pizzas', title: 'Quatro queijos', price: 5290, desc: 'Mucarela, provolone, gorgonzola e parmesao' },
  { categoria: 'pizzas', title: 'Vegetariana', price: 4890, desc: 'Abobrinha, berinjela, pimentao e rucula' },
  { categoria: 'bebidas', title: 'Guarana 350ml', price: 690, desc: 'Lata gelada' },
  { categoria: 'bebidas', title: 'Suco de laranja', price: 1290, desc: '500ml natural' },
  { categoria: 'bebidas', title: 'Cerveja long neck', price: 1190, desc: '330ml' },
  { categoria: 'bebidas', title: 'Agua com gas', price: 590, desc: '500ml' },
  { categoria: 'sobremesas', title: 'Pudim', price: 1490, desc: 'Fatia generosa' },
  { categoria: 'sobremesas', title: 'Brownie', price: 1890, desc: 'Com sorvete' },
];

/**
 * Extrai itens do catalogo da Cantina do Ze a partir do texto em linguagem natural
 * com suporte a pedidos genericos (ex: "um hamburguer" -> Classico, "uma pizza" -> Margherita)
 * e deteccao de quantidades ("dois", "2x", etc).
 */
export function extrairItensDeliveryHeuristica(texto) {
  if (!texto || typeof texto !== 'string') return [];
  const norm = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  function extrairQtd(regex) {
    const m = norm.match(regex);
    if (!m) return 1;
    const qStr = m[1] || m[2];
    if (!qStr) return 1;
    if (qStr === 'um' || qStr === 'uma') return 1;
    if (qStr === 'dois' || qStr === 'duas') return 2;
    if (qStr === 'tres') return 3;
    if (qStr === 'quatro') return 4;
    const n = parseInt(qStr, 10);
    return isNaN(n) ? 1 : Math.max(1, n);
  }

  const itens = [];

  // Burgers
  if (norm.includes('bacon duplo') || norm.includes('bacon')) {
    const qty = extrairQtd(/(?:^|\s)(\d+|um|uma|dois|duas|tres|quatro)\s*(?:x\s*)?(?:burgers?|hamburguers?|lanches?)?\s*bacon/i) || 1;
    itens.push({ title: 'Bacon duplo', price: 4490, qty });
  } else if (norm.includes('veggie') || norm.includes('vegetariano')) {
    const qty = extrairQtd(/(?:^|\s)(\d+|um|uma|dois|duas|tres|quatro)\s*(?:x\s*)?(?:burgers?|hamburguers?)?\s*veggie/i) || 1;
    itens.push({ title: 'Veggie', price: 3590, qty });
  } else if (
    norm.includes('classico') ||
    (norm.includes('adicion') && /hamburguer|hamburger|burger|burguer/i.test(norm))
  ) {
    const qty = extrairQtd(/(?:^|\s)(\d+|um|uma|dois|duas|tres|quatro)\s*(?:x\s*)?(?:burgers?|hamburguers?|lanches?)?\s*classico/i) || 1;
    itens.push({ title: 'Classico', price: 3290, qty });
  }

  // Pizzas
  if (norm.includes('calabresa')) {
    const qty = extrairQtd(/(?:^|\s)(\d+|um|uma|dois|duas|tres|quatro)\s*(?:x\s*)?(?:pizzas?\s*(?:de\s*)?)?calabresa/i) || 1;
    itens.push({ title: 'Calabresa', price: 4690, qty });
  } else if (norm.includes('quatro queijos') || norm.includes('4 queijos')) {
    const qty = extrairQtd(/(?:^|\s)(\d+|um|uma|dois|duas|tres|quatro)\s*(?:x\s*)?(?:pizzas?\s*(?:de\s*)?)?(?:quatro|4)\s*queijos/i) || 1;
    itens.push({ title: 'Quatro queijos', price: 5290, qty });
  } else if (norm.includes('vegetariana')) {
    const qty = extrairQtd(/(?:^|\s)(\d+|um|uma|dois|duas|tres|quatro)\s*(?:x\s*)?(?:pizzas?\s*(?:de\s*)?)?vegetariana/i) || 1;
    itens.push({ title: 'Vegetariana', price: 4890, qty });
  } else if (norm.includes('margherita') || norm.includes('margarita')) {
    const qty = extrairQtd(/(?:^|\s)(\d+|um|uma|dois|duas|tres|quatro)\s*(?:x\s*)?(?:pizzas?\s*(?:de\s*)?)?margh?erita/i) || 1;
    itens.push({ title: 'Margherita', price: 4290, qty });
  }

  // Bebidas
  if (norm.includes('guarana') || norm.includes('refri') || norm.includes('refrigerante')) {
    const qty = extrairQtd(/(?:^|\s)(\d+|um|uma|dois|duas|tres|quatro)\s*(?:x\s*)?(?:latas?\s*de\s*)?(?:guarana|refri|refrigerante)/i) || 1;
    itens.push({ title: 'Guarana 350ml', price: 690, qty });
  } else if (norm.includes('suco')) {
    const qty = extrairQtd(/(?:^|\s)(\d+|um|uma|dois|duas|tres|quatro)\s*(?:x\s*)?sucos?/i) || 1;
    itens.push({ title: 'Suco de laranja', price: 1290, qty });
  } else if (norm.includes('cerveja')) {
    const qty = extrairQtd(/(?:^|\s)(\d+|um|uma|dois|duas|tres|quatro)\s*(?:x\s*)?cervejas?/i) || 1;
    itens.push({ title: 'Cerveja long neck', price: 1190, qty });
  } else if (norm.includes('agua')) {
    const qty = extrairQtd(/(?:^|\s)(\d+|um|uma|dois|duas|tres|quatro)\s*(?:x\s*)?aguas?/i) || 1;
    itens.push({ title: 'Agua com gas', price: 590, qty });
  }

  // Sobremesas
  if (norm.includes('pudim')) {
    const qty = extrairQtd(/(?:^|\s)(\d+|um|uma|dois|duas|tres|quatro)\s*(?:x\s*)?pudim/i) || 1;
    itens.push({ title: 'Pudim', price: 1490, qty });
  } else if (norm.includes('brownie')) {
    const qty = extrairQtd(/(?:^|\s)(\d+|um|uma|dois|duas|tres|quatro)\s*(?:x\s*)?brownie/i) || 1;
    itens.push({ title: 'Brownie', price: 1890, qty });
  }

  return itens;
}

function ehScratchpadInglesText(text) {
  if (!text || typeof text !== 'string') return false;
  return /^(we need|need follow|user wants|state carrinho|need respond|i need to|let's think|the user says|rule \d+:|instructions:)/i.test(
    text.trim(),
  );
}

function getFallbackPersona(botId) {
  if (botId === 'delivery') {
    return 'Maravilha! Já atualizei o seu pedido com carinho. Quer conferir o total ou adicionar mais alguma delícia?';
  }
  if (botId === 'servicos') {
    return 'Com certeza! Estou à disposição para te atender e dar continuidade ao seu agendamento. Como prefere prosseguir?';
  }
  return 'Entendido! Registro e prioridade atualizados no nosso quadro. Como deseja prosseguir?';
}

/**
 * Remove qualquer residuo de raciocinio em ingles, scratchpad ou monologo interno do modelo.
 * Garante que a resposta exibida ao usuario seja 100% em Portugues e na persona correta.
 */
export function limparRespostaDoModelo(reply, botId = 'servicos') {
  if (!reply || typeof reply !== 'string') {
    return getFallbackPersona(botId);
  }

  let limpo = reply.trim();

  // Remove <think>...</think> se restar
  if (limpo.includes('</think>')) {
    limpo = limpo.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  }

  // Detecta monologo ou raciocinio analitico em ingles do modelo
  const ehScratchpadIngles =
    ehScratchpadInglesText(limpo) ||
    (/\b(we need answer|need follow rules|user wants add|respond only json|format requires items|catalog burgers)\b/i.test(limpo));

  if (ehScratchpadIngles) {
    const jsonExtraido = extrairJson(limpo);
    if (jsonExtraido?.reply && !ehScratchpadInglesText(jsonExtraido.reply)) {
      return jsonExtraido.reply;
    }
    return getFallbackPersona(botId);
  }

  return limpo;
}

const BOTS_CONFIG = {
  servicos: {
    nome: 'Lumi',
    empresa: 'Lumen Servicos',
    persona:
      'Voce e Lumi, atendente virtual inteligente da Lumen Servicos. Seja cordial, agil, profissional e prestativa. Responda em no maximo 2 ou 3 frases claras em Portugues do Brasil.',
    questions: {
      intencao: {
        type: 'choice',
        instructions: 'Identifique o objetivo principal da mensagem do usuario',
        criteria: {
          emergencia: 'Usuario relata emergencia, chamado urgente, precisa de tecnico agora ou quer mudar/corrigir agendamento para emergencia',
          agendar: 'Usuario quer agendar visita tecnica, instalacao, manutencao, escolher data ou horario',
          financeiro: 'Usuario quer segunda via de boleto, fatura, notas fiscais ou pagar',
          status: 'Usuario quer consultar andamento de chamado tecnico ou ordem de servico aberta',
          atendente: 'Usuario quer falar com um atendente humano ou suporte avancado',
          duvidas_gerais: 'Duvidas gerais sobre a empresa, servicos prestados ou saudacoes'
        }
      },
      urgencia: {
        type: 'choice',
        instructions: 'Classifique a urgencia do chamado',
        criteria: {
          critica: 'Parada total de operacoes, falha geral, perigo imediato, emergencia ou necessidade agora',
          alta: 'Servico essencial com lentidao ou instabilidade severa',
          normal: 'Solicitacoes de rotina, agendamentos futuros ou duvidas'
        }
      }
    },
    stateMap: {
      emergencia: 'agendar_emergencia',
      agendar: 'agendar_tipo',
      financeiro: 'financeiro',
      status: 'status',
      atendente: 'atendente',
      duvidas_gerais: 'menu'
    }
  },

  delivery: {
    nome: 'Ze',
    empresa: 'Cantina do Ze',
    persona:
      'Voce e o Ze, dono e atendente da Cantina do Ze (pizzas artesanais, burgers e lanches). Seja descontraido, acolhedor e focado em comida gostosa. Responda em ate 2 frases em Portugues do Brasil.',
    questions: {
      intencao: {
        type: 'choice',
        instructions: 'Identifique se o cliente quer ver o cardapio de pizzas/burgers, pedir um sabor especifico ou ver carrinho',
        criteria: {
          ver_pizzas: 'Cliente quer pizza, quer pedir pizza ou ver o cardapio/sabores de pizza mas NAO especificou o sabor exato (ex: "quero uma pizza", "quero pizza", "quais pizzas tem", "cardapio de pizzas")',
          ver_burgers: 'Cliente quer burger, quer pedir lanche ou ver opcoes de hamburgueres mas NAO especificou o sabor exato (ex: "quero um burger", "quero hamburguer", "quais lanches tem")',
          fazer_pedido: 'Cliente escolheu e citou um sabor ou item especifico do cardapio para o carrinho (ex: "quero calabresa", "manda margherita", "quero bacon duplo", "1 guarana")',
          ver_bebidas: 'Cliente quer apenas ver refrigerantes, sucos ou bebidas',
          ver_cardapio: 'Cliente quer ver o cardapio geral completo com todas as categorias',
          rastreio: 'Cliente pergunta sobre onde esta o pedido, entrega ou demora',
          carrinho: 'Cliente quer ver o total, fechar pedido ou endereco',
          duvida_geral: 'Cumprimento ou conversa geral'
        }
      },
      fomeNivel: {
        type: 'choice',
        instructions: 'O cliente demonstra pressa ou grande apetite?',
        criteria: {
          alta_fome: 'Pede rapidez, combo grande ou muita comida',
          normal: 'Pedido individual ou consulta padrao'
        }
      }
    },
    stateMap: {
      fazer_pedido: 'carrinho',
      ver_pizzas: 'cat_pizzas',
      ver_burgers: 'cat_burgers',
      ver_bebidas: 'cat_bebidas',
      ver_cardapio: 'cardapio',
      rastreio: 'rastreio',
      carrinho: 'carrinho',
      duvida_geral: 'inicio'
    }
  },

  demandas: {
    nome: 'Kai',
    empresa: 'Organizador de Demandas',
    persona:
      'Voce e Kai, assistente agil de gestao tecnica de tarefas e kanban. Seja direto, organizado, focado em prioridades e engenharia. Responda em ate 2 ou 3 frases em Portugues do Brasil.',
    questions: {
      intencao: {
        type: 'choice',
        instructions: 'Identifique a acao desejada no quadro de demandas',
        criteria: {
          nova_tarefa: 'Usuario quer criar, cadastrar ou reportar uma nova tarefa, bug ou demanda',
          quadro: 'Usuario quer ver o quadro kanban, backlog ou status das colunas',
          resumo: 'Usuario pede relatorio, metricas ou resumo semanal das entregas',
          duvida_geral: 'Cumprimento ou duvida geral sobre organizacao'
        }
      },
      prioridadeSugerida: {
        type: 'choice',
        instructions: 'Qual o nivel de criticidade da demanda citada?',
        criteria: {
          critica: 'Bug em producao, travamento de checkout, vulnerabilidade',
          alta: 'Bloqueio de sprint ou funcionalidade chave',
          media: 'Desenvolvimento padrao de funcionalidade',
          baixa: 'Melhoria cosmetica, refatoracao futura ou ajuste visual'
        }
      }
    },
    stateMap: {
      nova_tarefa: 'nova_titulo',
      quadro: 'quadro',
      resumo: 'resumo',
      duvida_geral: 'menu'
    }
  }
};

/**
 * Processa uma mensagem de texto enviada para um dos 3 chatbots usando JEV + DeepSeek
 * e mantendo o contexto salvo em cache de memoria.
 *
 * @param {object} params
 * @param {string} [params.sessionId]
 * @param {'servicos'|'delivery'|'demandas'} params.botId
 * @param {string} params.message
 * @param {string} [params.currentState]
 * @param {object} [params.vars]
 * @returns {Promise<object>}
 */
export async function processChatbotMessage({
  sessionId = 'anon',
  botId = 'servicos',
  message = '',
  currentState = 'inicio',
  vars = {},
}) {
  const botDef = BOTS_CONFIG[botId] || BOTS_CONFIG.servicos;
  const textoLimpo = String(message || '').trim();

  if (!textoLimpo) {
    return {
      ok: false,
      error: 'Mensagem vazia',
    };
  }

  // 1. Recupera o cache da conversa em memoria e sincroniza variaveis recebidas do cliente
  const cache = getChatbotCache(sessionId, botId);
  mergeChatbotVars(botId, cache.vars, vars);
  if (currentState) {
    cache.currentState = currentState;
  }

  // 2. Extracao e acumulacao contextual antes de chamar os modelos
  const norm = textoLimpo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  let ehEmergencia = false;
  let pedePizzaGenerica = false;
  let pedeBurgerGenerico = false;
  if (botId === 'servicos') {
    ehEmergencia =
      /emerg[eê]ncia|urgente|urg[eê]ncia|socorro|pra agora|para agora|imediato|agora/i.test(norm);

    if (ehEmergencia) {
      cache.vars.servicos = ['Emergencia'];
      cache.vars.servico = 'Emergencia (Atendimento Imediato)';
      cache.vars.data = 'Hoje (imediato)';
      cache.vars.horario = 'Em até 4h (plantão)';
      cache.vars.statusAgendamento = '🚨 Emergência / Plantão acionado';
      cache.vars.tecnico = 'Plantão Emergencial';
      const numProtocolo = cache.vars.protocolo
        ? cache.vars.protocolo.replace(/^#(EMERG-)?/, '')
        : String(Math.floor(10000 + Math.random() * 90000));
      cache.vars.protocolo = `#EMERG-${numProtocolo}`;
    } else {
      // Detecta servicos mencionados no texto
      const servicosEncontrados = [];
      if (/manutenc/i.test(norm) || /revis/i.test(norm)) servicosEncontrados.push('Manutencao');
      if (/instal/i.test(norm)) servicosEncontrados.push('Instalacao');
      if (/vistor/i.test(norm) || /laudo/i.test(norm)) servicosEncontrados.push('Vistoria');

      for (const s of servicosEncontrados) {
        if (!cache.vars.servicos.includes(s)) {
          cache.vars.servicos.push(s);
        }
      }
      if (cache.vars.servicos.length > 0) {
        cache.vars.servico = cache.vars.servicos.join(' e ');
      } else if (
        (norm.includes('ja selecionei') || norm.includes('ja escolhi') || norm.includes('meus servicos')) &&
        !cache.vars.servico
      ) {
        // Se o usuario indicou que ja escolheu, inicializa com Manutencao padrao
        cache.vars.servicos = ['Manutencao'];
        cache.vars.servico = 'Manutencao';
      }

      // Detecta horario citado
      const horaMatch = textoLimpo.match(/\b(0?8:00|0?8h|10:30|10h30|13:00|13h|15:30|15h30|17:00|17h)\b/i);
      if (horaMatch) {
        let h = horaMatch[1].toLowerCase();
        if (h === '8h' || h === '8:00' || h === '08h') h = '08:00';
        else if (h === '10h30') h = '10:30';
        else if (h === '13h') h = '13:00';
        else if (h === '15h30') h = '15:30';
        else if (h === '17h') h = '17:00';
        cache.vars.horario = h;
        cache.vars.data = 'amanha';
        if (!cache.vars.protocolo) {
          cache.vars.protocolo = `#${Math.floor(10000 + Math.random() * 90000)}`;
        }
      }
    }
  } else if (botId === 'delivery') {
    pedePizzaGenerica =
      /\bpizzas?\b/i.test(norm) &&
      !/\b(calabresa|margh?erita|margarita|quatro\s*queijos|4\s*queijos|vegetariana)\b/i.test(norm);

    pedeBurgerGenerico =
      /\b(hamburguer|hamburger|burger|burguer|lanche)s?\b/i.test(norm) &&
      !/\b(classico|bacon|veggie)\b/i.test(norm) &&
      !/\b(adiciona|adicionar)\b/i.test(norm);

    if (/(rua|avenida|av\.?|alameda|travessa|apto|bairro|n[ºo]\s*\d+)/i.test(norm)) {
      cache.vars.endereco = textoLimpo;
    }
    if (/\b(pix|cartao|credito|debito|dinheiro)\b/i.test(norm)) {
      cache.vars.pagamento = norm.includes('pix') ? 'Pix' : norm.includes('dinheiro') ? 'Dinheiro' : 'Cartao';
    }
  } else if (botId === 'demandas') {
    const prioMatch = norm.match(/\b(critica|alta|media|baixa)\b/i);
    if (prioMatch) {
      if (!cache.vars.rascunho) cache.vars.rascunho = {};
      cache.vars.rascunho.prio = prioMatch[1];
    }
  }

  // Se OpenRouter nao estiver configurado, devolve fallback
  if (!hasOpenRouter()) {
    return {
      ok: true,
      botId,
      sessionId: cache.sessionId,
      reply: `${botDef.nome}: Recebi sua mensagem: "${textoLimpo}". Configure OPENROUTER_API_KEY para respostas inteligentes.`,
      decision: null,
      nextState: null,
      vars: cache.vars,
      engine: 'fallback_sem_chave',
    };
  }

  // 3. Monta historico recente formatado
  const historicoFormatado = cache.history
    .slice(-6)
    .map((t) => `${t.role === 'user' ? 'Usuario' : botDef.nome}: "${t.text}"`)
    .join('\n');

  const jevState = {
    bot: botId,
    currentState,
    message: textoLimpo,
    varsEmCache: {
      servicos: cache.vars.servicos || [],
      servico: cache.vars.servico || null,
      horario: cache.vars.horario || null,
      carrinhoTotalItens: cache.vars.carrinho?.length || 0,
      endereco: cache.vars.endereco || null,
    },
  };

  let llmSystem = '';

  if (botId === 'servicos') {
    if (ehEmergencia) {
      llmSystem = `${botDef.persona}
ATENÇÃO: O USUÁRIO DECLAROU UMA SITUAÇÃO DE EMERGÊNCIA OU EXIGIU ATENDIMENTO IMEDIATO ("${textoLimpo}").
O agendamento anterior foi corrigido imediatamente para Atendimento Emergencial!

DADOS ATUALIZADOS DO CHAMADO DE EMERGÊNCIA:
- Serviço: Emergência (Atendimento Imediato)
- Previsão de chegada: Em até 4 horas hoje (plantão técnico acionado)
- Novo Protocolo de Emergência: ${cache.vars.protocolo}
- Status: Plantão acionado com prioridade máxima

SUA RESPOSTA DEVE:
1. Confirmar com total prontidão que o agendamento foi corrigido/atualizado para Atendimento de Emergência.
2. Informar com clareza que o técnico do plantão foi acionado e chegará em até 4h hoje.
3. Citar o protocolo de emergência ${cache.vars.protocolo}.
4. Finalizar em no máximo 2 frases completas e acolhedoras. NUNCA corte a resposta pela metade.`;
    } else {
      const servicosJaEscolhidos =
        cache.vars.servicos?.length > 0 ? cache.vars.servicos.join(', ') : cache.vars.servico || 'Nenhum ainda';

      llmSystem = `${botDef.persona}
Voce esta conversando com o usuario no estado atual: "${currentState}".

MEMORIA DA CONVERSA (DADOS SALVOS EM CACHE):
- Servicos ja selecionados: ${servicosJaEscolhidos}
- Horario selecionado: ${cache.vars.horario || 'Nenhum ainda'}
- Data agendada: ${cache.vars.data || 'amanha'}
- Protocolo: ${cache.vars.protocolo || 'Nao gerado'}

HISTORICO RECENTE:
${historicoFormatado || '(inicio da conversa)'}

DIRETRIZES FUNDAMENTAIS PARA CONTINUIDADE:
1. NUNCA pergunte "Qual servico voce precisa?" se o usuario ja escolheu servicos (${servicosJaEscolhidos}) ou se disser que ja selecionou.
2. Se o usuario disser que ja selecionou os servicos ou perguntar por datas e horarios (ex: "já selecionei meus serviços, me diga as datas disponiveis"):
   Confirme com presteza o(s) servico(s) (${servicosJaEscolhidos}) e apresente diretamente os horarios disponiveis para amanha: 08:00, 10:30, 13:00, 15:30 e 17:00.
3. Se o usuario adicionar outro servico (ex: "quero instalacao tambem"):
   Confirme que adicionou e que agora estao marcados (${servicosJaEscolhidos}), e ofereca os horarios para amanha (08:00, 10:30, 13:00, 15:30 e 17:00).
4. Se o usuario escolher um horario (ex: "10:30"):
   Confirme o agendamento completo para amanha as 10:30 com protocolo ${cache.vars.protocolo || '#54921'}.
5. Responda em no maximo 2 ou 3 frases cordiais e objetivas.`;
    }
  } else if (botId === 'delivery') {
    const itensCarrinho =
      (cache.vars.carrinho || [])
        .map((i) => `${i.qty || 1}x ${i.title} (R$ ${((i.price || 0) / 100).toFixed(2)})`)
        .join(', ') || 'Nenhum item ainda';

    llmSystem = `${botDef.persona}
Voce esta conversando com o cliente no estado atual: "${currentState}".

CARRINHO EM CACHE: ${itensCarrinho}
ENDERECO: ${cache.vars.endereco || 'Nao informado'}
FORMA DE PAGAMENTO: ${cache.vars.pagamento || 'Nao informada'}

HISTORICO RECENTE:
${historicoFormatado || '(inicio)'}

Catalogo da Cantina do Ze com precos em centavos:
- Burgers: 'Classico' (3290), 'Bacon duplo' (4490), 'Veggie' (3590)
- Pizzas: 'Margherita' (4290), 'Calabresa' (4690), 'Quatro queijos' (5290), 'Vegetariana' (4890)
- Bebidas: 'Guarana 350ml' (690), 'Suco de laranja' (1290), 'Cerveja long neck' (1190), 'Agua com gas' (590)
- Sobremesas: 'Pudim' (1490), 'Brownie' (1890)

REGRAS:
1. SE o cliente pedir pizza de forma generica sem citar sabor exato (ex: "quero uma pizza", "quero pizza", "quais pizzas tem", "tem pizza?"):
   - NUNCA adicione nenhum item ou pizza ao carrinho automaticamente.
   - Responda em ate 2 frases amigaveis do Ze apresentando os sabores disponiveis (Margherita, Calabresa, Quatro queijos e Vegetariana) e convidando a escolher o sabor no cardapio logo abaixo.
   - Responda com texto livre amigavel (SEM JSON).
2. SE o cliente pedir burger ou lanche de forma generica sem citar o sabor exato (ex: "quero um burger", "quero hamburguer", "quais lanches tem"):
   - NUNCA adicione nenhum item ao carrinho automaticamente.
   - Responda em ate 2 frases apresentando os lanches (Classico, Bacon duplo e Veggie) e convidando a escolher no cardapio logo abaixo.
   - Responda com texto livre amigavel (SEM JSON).
3. SE o cliente escolher ou adicionar um item com sabor especifico (ex: "quero uma calabresa", "manda margherita", "quero bacon duplo", "1 guarana", "quero um classico"):
   Responda SEMPRE E APENAS com um JSON no formato:
   {
     "reply": "fala acolhedora do Ze confirmando a adicao do sabor escolhido em ate 2 frases",
     "items": [
       { "title": "Calabresa", "price": 4690, "qty": 1 }
     ],
     "action": "adicionar_carrinho"
   }
4. Se o cliente perguntar o total, fechar pedido ou ver carrinho:
   Responda em texto amigavel informando os itens em cache e o total (+ taxa R$ 7,90) e convide a informar o endereco.
5. Se nao for pedido de itens, responda com texto livre acolhedor do Ze.
6. NUNCA pense em voz alta em ingles nem gere textos como 'We need...', 'User wants...'. Responda DIRETAMENTE como o Ze em Portugues do Brasil.`;
  } else {
    const demandasResumo = (cache.vars.demandas || [])
      .slice(0, 5)
      .map((d) => `- [${d.status}] ${d.title} (Prio: ${d.prio || 'media'})`)
      .join('\n');

    llmSystem = `${botDef.persona}
Voce esta conversando no estado: "${currentState}".

DEMANDAS EM CACHE:
${demandasResumo}

HISTORICO RECENTE:
${historicoFormatado || '(inicio)'}

REGRAS:
1. Se o usuario estiver criando tarefa ou bug, confirme o titulo e a prioridade no quadro backlog.
2. Se pedir quadro ou resumo, resuma as demandas acima em 2 ou 3 frases tecnicas e agilistas.
3. Nao repita perguntas iniciais se a acao ja estiver em andamento.`;
  }

  const llmPrompt = `Mensagem do usuario: "${textoLimpo}"`;

  try {
    const resHibrido = await executeHybrid({
      jevState,
      jevQuestions: botDef.questions,
      llmSystem,
      llmPrompt,
      maxTokens: 1200,
    });

    const jevAnswers = resHibrido.jev?.answers || {};
    const intencaoChoice = jevAnswers.intencao?.choice || 'duvidas_gerais';
    let nextState = botDef.stateMap[intencaoChoice] || null;

    let reply = resHibrido.llm?.text?.trim() || '';
    let items = [];
    let action = null;

    // Transicoes e tratamentos especificos por bot com apoio do cache
    if (botId === 'servicos') {
      if (
        ehEmergencia ||
        intencaoChoice === 'emergencia' ||
        jevAnswers.urgencia?.choice === 'critica' ||
        cache.vars.servicos?.includes('Emergencia')
      ) {
        nextState = 'agendar_emergencia';
      } else if (intencaoChoice === 'agendar') {
        if (cache.vars.horario) {
          nextState = 'agendar_confirma';
        } else if (
          cache.vars.servicos?.length > 0 ||
          cache.vars.servico ||
          currentState === 'agendar_data' ||
          norm.includes('ja selecionei') ||
          norm.includes('datas disponiveis')
        ) {
          // Servico ja escolhido: continua no fluxo de data/horarios sem regredir para agendar_tipo!
          nextState = 'agendar_data';
        } else {
          nextState = 'agendar_tipo';
        }
      } else if (
        currentState === 'agendar_data' &&
        (intencaoChoice === 'duvidas_gerais' || /data|horario|quando|disponivel/i.test(norm))
      ) {
        nextState = 'agendar_data';
      }
    } else if (botId === 'delivery') {
      if (pedePizzaGenerica || intencaoChoice === 'ver_pizzas') {
        nextState = 'cat_pizzas';
        items = [];
        action = null;
        if (!reply || extrairJson(reply) || reply.startsWith('Ze: Recebi sua mensagem') || reply.includes('Margherita pra você')) {
          reply = 'Opa, pizza é a nossa especialidade! Temos Margherita, Calabresa artesanal, Quatro queijos e Vegetariana. Dá uma olhada nas opções abaixo e escolha a sua:';
        }
      } else if (pedeBurgerGenerico || intencaoChoice === 'ver_burgers') {
        nextState = 'cat_burgers';
        items = [];
        action = null;
        if (!reply || extrairJson(reply) || reply.startsWith('Ze: Recebi sua mensagem')) {
          reply = 'Show! Nossos burgers são artesanais de 180g no pão brioche: Clássico, Bacon duplo e Veggie. Dá uma olhada nas opções abaixo e escolha o seu:';
        }
      } else if (intencaoChoice === 'ver_cardapio' || /\b(cardapio|menu|opcoes)\b/i.test(norm)) {
        nextState = 'cardapio';
        items = [];
        action = null;
      } else if (intencaoChoice === 'ver_bebidas' || /\b(bebidas?|o que tem pra beber)\b/i.test(norm)) {
        nextState = 'cat_bebidas';
        items = [];
        action = null;
      } else {
        const jsonLlm = extrairJson(reply);
        if (jsonLlm) {
          if (jsonLlm.reply) reply = jsonLlm.reply;
          if (Array.isArray(jsonLlm.items) && jsonLlm.items.length > 0) {
            items = jsonLlm.items;
            action = 'adicionar_carrinho';
            nextState = 'carrinho';
          }
        }

        // Se a LLM nao extraiu itens ou falhou no JSON, aplica fallback heuristico
        if (items.length === 0) {
          const itensHeuristicos = extrairItensDeliveryHeuristica(textoLimpo);
          if (itensHeuristicos.length > 0) {
            items = itensHeuristicos;
            action = 'adicionar_carrinho';
            nextState = 'carrinho';
            if (!reply || ehScratchpadInglesText(reply) || reply.startsWith('Ze: Recebi sua mensagem')) {
              const nomes = items.map((i) => `${i.qty > 1 ? i.qty + 'x ' : ''}${i.title}`).join(' e ');
              reply = `Boa pedida! Já adicionei ${nomes} ao seu carrinho. Se quiser trocar o sabor ou pedir uma bebida, só me avisar!`;
            }
          }
        }

        // Salva itens no carrinho do cache em memoria
        if (items.length > 0) {
          for (const item of items) {
            const qtd = Math.max(1, Number(item.qty) || 1);
            const exist = cache.vars.carrinho.find((i) => i.title === item.title);
            if (exist) {
              exist.qty = (Number(exist.qty) || 1) + qtd;
            } else {
              cache.vars.carrinho.push({
                title: item.title,
                price: Number(item.price) || 0,
                qty: qtd,
              });
            }
          }
        }
      }

      if (cache.vars.endereco && !cache.vars.pagamento && items.length > 0) {
        nextState = 'pagamento';
      } else if (cache.vars.pagamento && items.length > 0) {
        nextState = 'rastreio';
      }
    } else if (botId === 'demandas') {
      if (intencaoChoice === 'nova_tarefa') {
        const tit = textoLimpo
          .replace(/^(cria|crie|nova demanda|nova tarefa|cadastre|adiciona)\s*(uma\s*)?:?/i, '')
          .trim();
        if (tit.length > 3) {
          const nova = {
            title: tit,
            prio: cache.vars.rascunho?.prio || 'alta',
            status: 'backlog',
            meta: 'Kai · hoje',
            novo: true,
          };
          cache.vars.demandas.unshift(nova);
          nextState = 'quadro';
        }
      }
    }

    // Sanitiza a resposta do modelo para NUNCA vazar scratchpad ou raciocínio em inglês
    reply = limparRespostaDoModelo(reply, botId);

    if (!reply) {
      reply = `${botDef.nome}: Entendido! Como posso te ajudar a seguir?`;
    }

    // 4. Atualiza o cache da sessao em memoria com a mensagem do usuario e a resposta do bot
    updateChatbotCache({
      sessionId,
      botId,
      userMessage: textoLimpo,
      botReply: reply,
      currentState,
      nextState,
      vars: cache.vars,
    });

    return {
      ok: true,
      botId,
      sessionId: cache.sessionId,
      reply,
      items,
      action,
      vars: cache.vars,
      history: cache.history,
      decision: {
        answers: jevAnswers,
        model: resHibrido.jev?.model || 'typesafe/jev-1.13',
        confidence: jevAnswers.intencao?.confidence || 0.9,
        latencyMs: resHibrido.jev?.latencyMs || 0,
        ok: resHibrido.jev?.ok ?? false,
      },
      nextState,
      models: {
        decision: resHibrido.jev?.model || 'typesafe/jev-1.13',
        generation: resHibrido.llm?.model || 'deepseek/deepseek-v4.1-flash',
      },
      timing: {
        jevMs: resHibrido.jev?.latencyMs || 0,
        llmMs: resHibrido.llm?.latencyMs || 0,
        totalMs: resHibrido.totalLatencyMs,
      },
      engine: 'hybrid(jev+deepseek)+cache',
    };
  } catch (err) {
    logger.warn(`Erro no chatbot hibrido (${botId}):`, err.message);
    return {
      ok: true,
      botId,
      sessionId: cache.sessionId,
      reply: `${botDef.nome}: Desculpe, tive uma oscilacao temporaria, mas estou aqui para te ajudar. Pode repetir?`,
      decision: null,
      nextState: null,
      vars: cache.vars,
      engine: 'local_fallback',
    };
  }
}

export const LISTA_BOTS = Object.keys(BOTS_CONFIG);
