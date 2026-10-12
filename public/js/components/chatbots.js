/**
 * Chatbots demo (apenas front-end).
 *
 * Tres simuladores com fluxo roteirizado por maquina de estados. Nao existe
 * back-end, NLU nem persistencia: a ideia e servir de esqueleto pronto para
 * ser ligado a um servico real depois.
 *
 * Um estado tem a forma:
 *   chave: {
 *     title, note,                 // documentacao exibida no blueprint
 *     messages: [...] | (ctx) => [...],
 *     replies:  [...] | (ctx) => [...],
 *   }
 *
 * Tipos de mensagem: text, cards, summary, tracker, rating, kanban, chart.
 */
import { $, el, icon, clear, sleep, fmtMoney, fmtTime, prefersReducedMotion, afterPaint } from '../lib/dom.js';
import { getSessionId } from '../api.js';

/* ========================================================================
   Formatacao inline das bolhas (negrito, enfase e codigo)
   ===================================================================== */
const escapar = (texto) =>
  String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const inline = (texto) =>
  escapar(texto)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br />');

/* ========================================================================
   Engine
   ===================================================================== */
export function createChatSim({ feed, replies, input, sendBtn, head, screen, onStateChange }) {
  let script = null;
  let ctx = null;
  let runId = 0;
  let cartFab = null;

  const velocidade = () => (prefersReducedMotion() ? 0 : 1);

  /* ---------------------------------------------------------- primitivas */
  function scrollToEnd() {
    const irAoFim = (behavior) => {
      feed.scrollTo({ top: feed.scrollHeight, behavior });
    };

    afterPaint(() => irAoFim(prefersReducedMotion() ? 'instant' : 'smooth'));
    // O scroll suave depende do compositor e nao avanca em aba de segundo
    // plano. Esta correcao instantanea garante a ultima mensagem visivel.
    setTimeout(() => irAoFim('instant'), 420);
  }

  function addNode(node) {
    feed.append(node);
    scrollToEnd();
    return node;
  }

  function bubble(texto, autor = 'bot') {
    return addNode(
      el(`div.bot-msg.bot-msg--${autor}`, {}, [
        el('div.bubble', {}, [
          el('span', { html: inline(texto) }),
          el('span.bubble__time', { text: fmtTime() }),
        ]),
      ]),
    );
  }

  async function typing(ms) {
    if (!velocidade()) return;
    const node = addNode(
      el('div.bot-msg', {}, el('div.bot-typing', {}, [el('span'), el('span'), el('span')])),
    );
    await sleep(ms);
    node.remove();
  }

  /* ------------------------------------------------- blocos especiais -- */
  function renderCards(mensagem) {
    const lista = mensagem.cards || [];

    return addNode(
      el(
        'div.bot-cards',
        { class: lista.length === 1 ? 'bot-cards--single' : '' },
        lista.map((card) =>
          el(`div.bot-card${lista.length === 1 ? '.bot-card--wide' : ''}`, {}, [
            el('div.bot-card__art', { text: card.emoji || '•' }),
            el('div.bot-card__body', {}, [
              el('strong', { text: card.title }),
              el('small', { text: card.desc || '' }),
              el('div.bot-card__foot', {}, [
                el('span.bot-card__price', {
                  text: card.price != null ? fmtMoney(card.price) : card.tag || '',
                }),
                el(
                  'button.bot-card__add',
                  {
                    type: 'button',
                    title: card.actionLabel || 'Selecionar',
                    on: { click: () => escolherCard(card) },
                  },
                  icon(card.actionIcon || 'plus'),
                ),
              ]),
            ]),
          ]),
        ),
      ),
    );
  }

  function renderSummary(mensagem) {
    const { title, rows = [], total } = mensagem.summary;

    return addNode(
      el('div.bot-summary', {}, [
        el('div.bot-summary__title', {}, [icon(mensagem.icon || 'clipboard'), title]),
        ...rows.map(([chave, valor]) =>
          el('div.bot-summary__row', {}, [el('span', { text: chave }), el('b', { text: String(valor) })]),
        ),
        total &&
          el('div.bot-summary__row.bot-summary__row--total', {}, [
            el('span', { text: total[0] }),
            el('b', { text: String(total[1]) }),
          ]),
      ]),
    );
  }

  function renderTracker(mensagem) {
    const { steps = [], autoAdvanceMs = 0 } = mensagem.tracker;

    const nodes = steps.map((passo, i) =>
      el('div.tracker-step', { class: i === 0 ? 'is-current' : '' }, [
        el('span.tracker-step__dot', {}, icon('check')),
        el('div.tracker-step__text', {}, [
          el('strong', { text: passo.title }),
          el('small', { text: passo.sub || '' }),
        ]),
      ]),
    );

    const host = addNode(el('div.bot-tracker', {}, nodes));

    if (autoAdvanceMs && velocidade()) {
      const meuRun = runId;
      let atual = 0;

      const avancar = () => {
        if (meuRun !== runId || !host.isConnected) return;
        nodes[atual].classList.remove('is-current');
        nodes[atual].classList.add('is-done');
        atual += 1;

        if (atual < nodes.length) {
          nodes[atual].classList.add('is-current');
          setTimeout(avancar, autoAdvanceMs);
        } else {
          scrollToEnd();
        }
      };

      setTimeout(avancar, autoAdvanceMs);
    } else {
      nodes[0]?.classList.add('is-done');
    }

    return host;
  }

  function renderRating(mensagem) {
    const host = addNode(el('div.bot-rating'));

    for (let nota = 1; nota <= 5; nota += 1) {
      const botao = el('button', { type: 'button', title: `${nota} de 5` }, icon('star'));

      botao.addEventListener('mouseenter', () => {
        [...host.children].forEach((b, i) => b.classList.toggle('is-on', i < nota));
      });

      botao.addEventListener('click', () => {
        [...host.children].forEach((b, i) => b.classList.toggle('is-on', i < nota));
        host.style.pointerEvents = 'none';
        ctx.vars.nota = nota;
        responder(`${'★'.repeat(nota)} (${nota}/5)`, mensagem.next);
      });

      host.append(botao);
    }

    host.addEventListener('mouseleave', () => {
      const nota = ctx.vars.nota || 0;
      [...host.children].forEach((b, i) => b.classList.toggle('is-on', i < nota));
    });

    return host;
  }

  function renderKanban(mensagem) {
    const colunas = mensagem.kanban(ctx);

    return addNode(
      el(
        'div.bot-kanban',
        {},
        colunas.map((coluna) =>
          el('div.kanban-col', {}, [
            el('div.kanban-col__head', {}, [coluna.title, el('b', { text: String(coluna.cards.length) })]),
            ...coluna.cards.map((card) =>
              el('div.kanban-card', { dataset: { prio: card.prio || 'baixa' }, class: card.novo ? 'is-new' : '' }, [
                el('strong', { text: card.title }),
                el('small', { text: card.meta || '' }),
              ]),
            ),
          ]),
        ),
      ),
    );
  }

  function renderChart(mensagem) {
    const linhas = mensagem.chart(ctx);
    const maior = Math.max(1, ...linhas.map(([, valor]) => valor));

    const host = addNode(
      el('div.bot-chart', {}, [
        mensagem.chartTitle &&
          el('div.bot-summary__title', {}, [icon('layers'), mensagem.chartTitle]),
        ...linhas.map(([rotulo, valor], i) =>
          el('div.chart-row', { style: { '--i': i } }, [
            el('span', { text: rotulo }),
            el('div.chart-bar', {}, el('i', { dataset: { pct: String((valor / maior) * 100) } })),
            el('b', { text: String(valor) }),
          ]),
        ),
      ]),
    );

    afterPaint(() => {
      for (const barra of host.querySelectorAll('.chart-bar i')) {
        barra.style.width = `${barra.dataset.pct}%`;
      }
    });

    return host;
  }

  /* -------------------------------------------------- carrinho flutuante */
  function ensureCartFab() {
    if (cartFab) return cartFab;

    cartFab = el('button.cart-fab', { type: 'button' }, [
      icon('cart'),
      el('span.cart-fab__count', { text: '0' }),
      el('span', { text: '·' }),
      el('span.cart-fab__total', { text: 'R$ 0,00' }),
    ]);

    cartFab.addEventListener('click', () => {
      if (ctx.vars.carrinho?.length) responder('Ver meu carrinho', 'carrinho');
    });

    screen.append(cartFab);
    return cartFab;
  }

  function atualizarCarrinho() {
    const fab = ensureCartFab();
    const itens = ctx.vars.carrinho || [];
    const totalQtd = itens.reduce((soma, item) => soma + (Number(item.qty) || 1), 0);
    const total = itens.reduce(
      (soma, item) => soma + (Number(item.price) || 0) * (Number(item.qty) || 1),
      0,
    );

    fab.querySelector('.cart-fab__count').textContent = String(totalQtd);
    fab.querySelector('.cart-fab__total').textContent = fmtMoney(total);
    fab.classList.toggle('is-on', totalQtd > 0);

    fab.classList.remove('is-bumped');
    void fab.offsetWidth;
    fab.classList.add('is-bumped');
  }

  /* ------------------------------------------------------------- fluxo -- */
  async function emitir(mensagem) {
    const meuRun = runId;

    await typing(mensagem.delay ?? 520);
    if (meuRun !== runId) return;

    if (mensagem.text) {
      bubble(typeof mensagem.text === 'function' ? mensagem.text(ctx) : mensagem.text);
    } else if (mensagem.cards) {
      renderCards(mensagem);
    } else if (mensagem.summary) {
      renderSummary({ ...mensagem, summary: typeof mensagem.summary === 'function' ? mensagem.summary(ctx) : mensagem.summary });
    } else if (mensagem.tracker) {
      renderTracker(mensagem);
    } else if (mensagem.rating) {
      renderRating(mensagem);
    } else if (mensagem.kanban) {
      renderKanban(mensagem);
    } else if (mensagem.chart) {
      renderChart(mensagem);
    }
  }

  function renderReplies(lista) {
    clear(replies);
    if (!lista?.length) return;

    lista.forEach((reply, i) => {
      const botao = el(
        `button.quick-reply${reply.ghost ? '.quick-reply--ghost' : ''}`,
        { type: 'button', style: { '--i': i } },
        [reply.icon && icon(reply.icon), reply.label],
      );

      botao.addEventListener('click', () => responder(reply.label, reply.next, reply));
      replies.append(botao);
    });
  }

  /** Mostra a fala do usuario, executa a acao e avanca de estado. */
  function responder(rotulo, proximo, reply) {
    if (rotulo) bubble(rotulo, 'user');
    clear(replies);

    if (reply?.do) {
      script.actions?.[reply.do]?.(ctx, reply);
      if (ctx.vars.carrinho) atualizarCarrinho();
    }

    if (proximo) go(proximo);
  }

  function escolherCard(card) {
    responder(card.title, card.next, card);
  }

  async function go(chave) {
    const estado = script.states[chave];
    if (!estado) {
      bubble('Esse caminho ainda nao foi mapeado neste protótipo.');
      return;
    }

    ctx.state = chave;
    onStateChange?.(chave);
    const meuRun = runId;

    // Antes das mensagens: elas podem ler o que a acao escreveu no contexto
    // (por exemplo o protocolo gerado, exibido no recibo).
    if (estado.onEnter) {
      script.actions?.[estado.onEnter]?.(ctx);
      if (ctx.vars.carrinho) atualizarCarrinho();
    }

    const mensagens = typeof estado.messages === 'function' ? estado.messages(ctx) : estado.messages || [];
    for (const mensagem of mensagens) {
      if (meuRun !== runId) return;
      await emitir(mensagem);
    }

    if (meuRun !== runId) return;

    const lista = typeof estado.replies === 'function' ? estado.replies(ctx) : estado.replies;
    renderReplies(lista);
  }

  function renderJevBadge(decision, timing) {
    const answers = decision.answers || {};
    const chaves = Object.keys(answers);
    const primeira = chaves[0] ? answers[chaves[0]] : null;
    const escolha = primeira?.choice || 'processado';
    const conf = Math.round((primeira?.confidence || decision.confidence || 1) * 100);
    const ms = timing?.jevMs || decision.latencyMs || 0;

    return addNode(
      el('div.bot-msg.bot-msg--jev', {}, [
        el('div.jev-pill', {}, [
          el('span.jev-pill__icon', { html: '⚡' }),
          el('strong', { text: 'JEV (typesafe/jev-1.13):' }),
          el('span', { text: `decisao: ${escolha} (${conf}%)` }),
          el('small', { text: `· ${ms}ms · DeepSeek v4.1` }),
        ]),
      ]),
    );
  }

  /* -------------------------------------------- entrada de texto livre */
  async function enviarTexto() {
    const texto = input.value.trim();
    if (!texto) return;
    input.value = '';

    bubble(texto, 'user');

    const normalizado = texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();

    // 1. Verifica se o texto digitado coincide com algum card ou botao SOMENTE se for comando curto
    const palavras = normalizado.split(/\s+/).filter(Boolean);
    const ehPedidoOuFrase = palavras.length >= 3 || /^(quero|me da|me vê|me ve|manda|pedir|adiciona|vou querer|tem como|por favor)/i.test(normalizado);

    if (!ehPedidoOuFrase) {
      const estadoAtual = script.states[ctx.state];
      if (estadoAtual) {
        const mensagens = typeof estadoAtual.messages === 'function' ? estadoAtual.messages(ctx) : estadoAtual.messages || [];
        for (const msg of mensagens) {
          if (Array.isArray(msg.cards)) {
            const cardMatch = msg.cards.find((c) => {
              const cNome = (c.title || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
              return cNome === normalizado;
            });
            if (cardMatch) {
              escolherCard(cardMatch);
              return;
            }
          }
        }

        const listaReplies = typeof estadoAtual.replies === 'function' ? estadoAtual.replies(ctx) : estadoAtual.replies || [];
        const replyMatch = listaReplies.find((r) => {
          const rNome = (r.label || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^[^\w]+/, '');
          return rNome === normalizado;
        });
        if (replyMatch) {
          responder(replyMatch.label, replyMatch.next, replyMatch);
          return;
        }
      }

      const regra = (script.keywords || []).find((k) => k.re.test(normalizado));
      if (regra) {
        clear(replies);
        go(regra.next);
        return;
      }
    }

    clear(replies);
    await typing(500);

    try {
      const sid = typeof getSessionId === 'function' ? getSessionId() : null;
      const resp = await fetch('/api/chatbots/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sid ? { 'X-Session-Id': sid } : {}),
        },
        body: JSON.stringify({
          sessionId: sid,
          botId: script.id,
          message: texto,
          currentState: ctx.state,
          vars: ctx.vars,
        }),
      });

      if (resp.ok) {
        const dados = await resp.json();
        if (dados.ok && dados.reply) {
          bubble(dados.reply);

          if (dados.decision?.answers) {
            renderJevBadge(dados.decision, dados.timing);
          }

          // Sincroniza variaveis do cache retornado pelo servidor
          if (dados.vars && typeof dados.vars === 'object') {
            Object.assign(ctx.vars, dados.vars);
          } else if (Array.isArray(dados.items) && dados.items.length > 0) {
            // Fallback caso o backend nao devolva dados.vars
            if (!ctx.vars.carrinho) ctx.vars.carrinho = [];
            for (const item of dados.items) {
              const qtd = Math.max(1, Number(item.qty) || 1);
              const exist = ctx.vars.carrinho.find((i) => i.title === item.title);
              if (exist) {
                exist.qty = (Number(exist.qty) || 1) + qtd;
              } else {
                ctx.vars.carrinho.push({
                  title: item.title,
                  price: Number(item.price) || 0,
                  qty: qtd,
                });
              }
            }
          }

          if (ctx.vars.carrinho && typeof atualizarCarrinho === 'function') {
            atualizarCarrinho();
          }

          // Se o backend extraiu itens para o carrinho (ex: pedidos de delivery direto pelo chat)
          if (Array.isArray(dados.items) && dados.items.length > 0) {
            // Mostra atalhos para ver carrinho, continuar ou fechar pedido
            renderReplies([
              { label: 'Ver carrinho', icon: 'cart', next: 'carrinho' },
              { label: '🍕 Ver pizzas', next: 'cat_pizzas' },
              { label: '🍔 Ver burgers', next: 'cat_burgers' },
              { label: '🥤 Bebidas', next: 'cat_bebidas' },
              { label: 'Fechar pedido', icon: 'check', next: 'carrinho' },
            ]);
            return;
          }

          // Transiciona de estado SOMENTE se for diferente do atual para nao repetir perguntas
          if (dados.nextState && dados.nextState !== ctx.state && script.states[dados.nextState]) {
            await sleep(650);
            go(dados.nextState);
            return;
          }

          const estado = script.states[ctx.state];
          renderReplies(typeof estado?.replies === 'function' ? estado.replies(ctx) : estado?.replies);
          return;
        }
      }
    } catch (e) {
      console.warn('Fallback chatbot local:', e);
    }

    bubble(
      script.fallback ||
        'Nao entendi. Este prototipo responde por botoes — o reconhecimento de linguagem natural entra quando o bot for ligado a um servico de NLU.',
    );
    const estado = script.states[ctx.state];
    renderReplies(typeof estado?.replies === 'function' ? estado.replies(ctx) : estado?.replies);
  }

  sendBtn.addEventListener('click', enviarTexto);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      enviarTexto();
    }
  });

  /* --------------------------------------------------------------- API -- */
  function load(novoScript) {
    runId += 1;
    script = novoScript;
    ctx = { vars: structuredClone(novoScript.initialVars || {}), state: novoScript.start };

    clear(feed);
    clear(replies);
    input.value = '';
    input.placeholder = novoScript.placeholder || 'Digite uma mensagem...';

    head.dataset.bot = novoScript.id;
    $('#bot-name').textContent = novoScript.name;
    const avatar = $('#bot-avatar');
    clear(avatar).append(icon(novoScript.avatar || 'bot'));

    if (cartFab) {
      cartFab.remove();
      cartFab = null;
    }
    if (ctx.vars.carrinho) atualizarCarrinho();

    go(novoScript.start);
  }

  return {
    load,
    restart: () => load(script),
    /** Salta para um estado (usado ao clicar em um no do blueprint). */
    goTo(chave) {
      if (!script?.states[chave]) return;
      clear(replies);
      bubble(`_pular para_ \`${chave}\``, 'user');
      go(chave);
    },
    get currentState() {
      return ctx?.state;
    },
  };
}

/* ========================================================================
   1. CHATBOT DE SERVICOS
   ===================================================================== */
const HORARIOS = ['08:00', '10:30', '13:00', '15:30', '17:00'];

export const botServicos = {
  id: 'servicos',
  name: 'Lumi · Lumen Servicos',
  avatar: 'headset',
  placeholder: 'Ex: quero agendar uma visita',
  start: 'inicio',

  descricao:
    'Atendimento de uma empresa de servicos. Cobre os quatro pedidos que concentram a maior parte ' +
    'do volume em suportes reais: agendamento, financeiro, acompanhamento de pedido e transbordo ' +
    'para um atendente humano. O fluxo termina sempre em um desfecho claro (protocolo, boleto ou fila), ' +
    'nunca em beco sem saida.',

  intents: ['agendar_visita', 'segunda_via', 'status_pedido', 'falar_atendente', 'avaliar_atendimento'],

  nextSteps: [
    'Trocar os estados por intencoes de um servico de NLU (Dialogflow, Rasa ou um modelo proprio) e manter esta maquina como camada de dialogo.',
    'Ligar `agendar_confirma` a uma API de agenda real: consulta de disponibilidade, reserva e envio de confirmacao.',
    'Autenticar antes de `segunda_via`: CPF mais token por SMS, porque a partir dali o bot expoe dado financeiro.',
    'Persistir cada conversa com `protocolo`, estado final e transcricao, para medir resolucao sem atendente.',
    'Implementar o transbordo de verdade (`atendente`) com fila, horario de funcionamento e repasse do historico.',
  ],

  initialVars: { servico: null, servicos: [], horario: null, data: 'amanha', protocolo: null, nota: 0 },

  keywords: [
    { re: /emergencia|urgente|urgencia|socorro/, next: 'agendar_emergencia' },
    { re: /agenda|visita|marcar|horario/, next: 'agendar_tipo' },
    { re: /boleto|segunda via|fatura|pagar|cobranca/, next: 'financeiro' },
    { re: /pedido|status|andamento|acompanh/, next: 'status' },
    { re: /atendente|humano|pessoa|falar com/, next: 'atendente' },
    { re: /menu|inicio|voltar|opcoes/, next: 'menu' },
  ],

  fallback:
    'Nao consegui identificar o assunto. Posso ajudar com _agendamento_, _segunda via de boleto_, ' +
    '_status de pedido_ ou te transferir para um atendente.',

  actions: {
    gerarProtocolo(ctx) {
      if (!ctx.vars.protocolo) {
        ctx.vars.protocolo = `#${String(Math.floor(Math.random() * 90000) + 10000)}`;
      }
    },
    guardarServico(ctx, reply) {
      const serv = (typeof reply === 'string' ? reply : (reply?.title || reply?.label)) || 'Manutencao';
      if (!Array.isArray(ctx.vars.servicos)) {
        ctx.vars.servicos = [];
      }
      if (!ctx.vars.servicos.includes(serv)) {
        ctx.vars.servicos.push(serv);
      }
      ctx.vars.servico = ctx.vars.servicos.join(' e ');
    },
    guardarHorario(ctx, reply) {
      ctx.vars.horario = (typeof reply === 'string' ? reply : (reply?.label || reply?.title)) || '08:00';
    },
  },

  states: {
    inicio: {
      title: 'Boas-vindas',
      note: 'Apresenta o bot, deixa claro que e um assistente e oferece o menu.',
      messages: [
        { text: 'Ola! Eu sou a **Lumi**, assistente virtual da Lumen Servicos. 👋', delay: 400 },
        { text: 'Consigo resolver a maior parte dos pedidos por aqui mesmo. O que voce precisa hoje?' },
      ],
      replies: [
        { label: 'Agendar visita tecnica', icon: 'clock', next: 'agendar_tipo' },
        { label: 'Segunda via de boleto', icon: 'clipboard', next: 'financeiro' },
        { label: 'Status do meu pedido', icon: 'target', next: 'status' },
        { label: 'Falar com atendente', icon: 'headset', next: 'atendente', ghost: true },
      ],
    },

    menu: {
      title: 'Menu principal',
      note: 'Estado de retorno. Toda ramificacao volta para ca, evitando beco sem saida.',
      messages: [{ text: 'Claro. Em que mais posso ajudar?' }],
      replies: [
        { label: 'Agendar visita tecnica', icon: 'clock', next: 'agendar_tipo' },
        { label: 'Segunda via de boleto', icon: 'clipboard', next: 'financeiro' },
        { label: 'Status do meu pedido', icon: 'target', next: 'status' },
        { label: 'Encerrar', icon: 'check', next: 'avaliacao', ghost: true },
      ],
    },

    agendar_tipo: {
      title: 'Agendamento · tipo de servico',
      note: 'Catalogo em cards. Em producao, vem da API de servicos com preco e SLA reais.',
      messages: [
        { text: 'Vamos agendar. Qual servico voce precisa?' },
        {
          cards: [
            { emoji: '🔧', title: 'Manutencao', desc: 'Revisao preventiva, ate 2h', price: 18900, next: 'agendar_data', do: 'guardarServico' },
            { emoji: '⚡', title: 'Instalacao', desc: 'Equipamento novo, ate 4h', price: 34900, next: 'agendar_data', do: 'guardarServico' },
            { emoji: '🔍', title: 'Vistoria', desc: 'Laudo tecnico, ate 1h', price: 12900, next: 'agendar_data', do: 'guardarServico' },
            { emoji: '🚨', title: 'Emergencia', desc: 'Atendimento em 4h', price: 49900, next: 'agendar_data', do: 'guardarServico' },
          ],
        },
      ],
      replies: [{ label: 'Voltar ao menu', icon: 'chevron', next: 'menu', ghost: true }],
    },

    agendar_data: {
      title: 'Agendamento · horario',
      note: 'Horarios fixos no protótipo. A versao real consulta disponibilidade da agenda.',
      messages: [
        { text: (ctx) => `**${ctx.vars.servico || 'Manutencao'}** anotado. Tenho estes horarios para amanha:` },
      ],
      replies: HORARIOS.map((hora) => ({ label: hora, icon: 'clock', next: 'agendar_confirma', do: 'guardarHorario' })),
    },

    agendar_confirma: {
      title: 'Agendamento · confirmacao',
      note: 'Recibo com protocolo. E o ponto que grava no sistema de agenda.',
      onEnter: 'gerarProtocolo',
      messages: [
        { text: 'Confirmando os dados do seu agendamento:', delay: 450 },
        {
          icon: 'check',
          summary: (ctx) => ({
            title: ctx.vars.servico?.includes('Emergencia') ? 'Atendimento Emergencial Confirmado' : 'Agendamento confirmado',
            rows: [
              ['Servico', ctx.vars.servico || 'Manutencao'],
              ['Data', ctx.vars.data || 'amanha'],
              ['Horario', ctx.vars.horario || '08:00'],
              ['Tecnico', ctx.vars.tecnico || (ctx.vars.servico?.includes('Emergencia') ? 'Plantão Emergencial' : 'a definir')],
              ['Protocolo', ctx.vars.protocolo || '—'],
            ],
            total: ['Status', ctx.vars.statusAgendamento || (ctx.vars.servico?.includes('Emergencia') ? '🚨 Plantão Acionado' : 'Agendado')],
          }),
        },
        {
          text:
            'Pronto! Voce recebe a confirmacao por e-mail e um aviso no dia anterior.\n' +
            'Se precisar remarcar, use o protocolo acima.',
        },
      ],
      replies: [
        { label: 'Remarcar', icon: 'clock', next: 'agendar_data', ghost: true },
        { label: 'Outra coisa', icon: 'chevron', next: 'menu' },
        { label: 'Finalizar', icon: 'check', next: 'avaliacao' },
      ],
    },

    agendar_emergencia: {
      title: 'Agendamento · Emergência Imediata',
      note: 'Correção para chamado urgente: atendimento em até 4h com plantão acionado.',
      messages: [
        { text: '🚨 **Chamado atualizado para Atendimento de Emergência!**', delay: 350 },
        {
          icon: 'zap',
          summary: (ctx) => ({
            title: 'Atendimento Emergencial Confirmado',
            rows: [
              ['Servico', ctx.vars.servico || 'Emergencia'],
              ['Data', ctx.vars.data || 'Hoje (imediato)'],
              ['Horario', ctx.vars.horario || 'Em até 4h (plantão)'],
              ['Tecnico', ctx.vars.tecnico || 'Plantão Emergencial'],
              ['Protocolo', ctx.vars.protocolo || '—'],
            ],
            total: ['Status', ctx.vars.statusAgendamento || '🚨 Plantão Acionado'],
          }),
        },
        {
          text:
            'Priorizamos seu chamado no sistema com sucesso. Um técnico do plantão foi notificado e chegará em até 4h hoje.\n' +
            'Você pode acompanhar o chamado ou falar com o suporte nos botões abaixo.',
        },
      ],
      replies: [
        { label: 'Rastrear técnico', icon: 'target', next: 'status' },
        { label: 'Falar com atendente', icon: 'headset', next: 'atendente' },
        { label: 'Voltar ao menu', icon: 'chevron', next: 'menu', ghost: true },
      ],
    },

    financeiro: {
      title: 'Financeiro · segunda via',
      note: 'Em producao este estado exige autenticacao antes de expor dado financeiro.',
      messages: [
        { text: 'Para emitir a segunda via eu preciso identificar sua conta.' },
        {
          text:
            '🔒 _No protótipo esta etapa e simulada._ No sistema real: CPF ou CNPJ mais um token ' +
            'enviado por SMS, antes de qualquer dado aparecer.',
        },
        {
          icon: 'clipboard',
          summary: {
            title: 'Fatura em aberto',
            rows: [
              ['Competencia', '10/2026'],
              ['Vencimento', '20/10/2026'],
              ['Servico', 'Plano Lumen Pro'],
            ],
            total: ['Total', fmtMoney(24790)],
          },
        },
      ],
      replies: [
        { label: 'Enviar por e-mail', icon: 'send', next: 'financeiro_enviado' },
        { label: 'Copiar codigo de barras', icon: 'copy', next: 'financeiro_enviado' },
        { label: 'Voltar', icon: 'chevron', next: 'menu', ghost: true },
      ],
    },

    financeiro_enviado: {
      title: 'Financeiro · entrega',
      note: 'Desfecho do fluxo financeiro.',
      messages: [
        { text: 'Enviado! Chega em ate 2 minutos no e-mail cadastrado.' },
        { text: 'Lembrando: o pagamento e compensado em 1 dia util apos a quitacao.' },
      ],
      replies: [
        { label: 'Outra coisa', icon: 'chevron', next: 'menu' },
        { label: 'Finalizar', icon: 'check', next: 'avaliacao' },
      ],
    },

    status: {
      title: 'Status do pedido',
      note: 'Tracker que avanca sozinho, simulando atualizacao em tempo real.',
      messages: [
        { text: 'Encontrei um pedido ativo no seu cadastro: **#48213**.' },
        {
          tracker: {
            autoAdvanceMs: 1500,
            steps: [
              { title: 'Pedido recebido', sub: 'hoje, 09:12' },
              { title: 'Em analise tecnica', sub: 'hoje, 10:40' },
              { title: 'Tecnico designado', sub: 'previsto para hoje' },
              { title: 'Em execucao', sub: 'amanha' },
              { title: 'Concluido', sub: '—' },
            ],
          },
        },
        { text: 'A previsao de conclusao e **amanha ate as 18h**. Quer receber avisos de cada etapa?' },
      ],
      replies: [
        { label: 'Sim, me avise', icon: 'check', next: 'status_avisos' },
        { label: 'Nao, obrigado', icon: 'x', next: 'menu', ghost: true },
      ],
    },

    status_avisos: {
      title: 'Status · notificacoes',
      note: 'Opt-in de notificacao. Precisa de consentimento registrado em producao.',
      messages: [{ text: 'Combinado. Vou te avisar por WhatsApp em cada mudanca de etapa.' }],
      replies: [
        { label: 'Outra coisa', icon: 'chevron', next: 'menu' },
        { label: 'Finalizar', icon: 'check', next: 'avaliacao' },
      ],
    },

    atendente: {
      title: 'Transbordo para humano',
      note: 'Caminho de escape obrigatorio. Sem ele, o usuario fica preso no bot.',
      messages: [
        { text: 'Sem problema, vou te transferir.' },
        {
          icon: 'headset',
          summary: {
            title: 'Fila de atendimento',
            rows: [
              ['Posicao', '2 de 7'],
              ['Espera estimada', '3 min'],
              ['Setor', 'Suporte tecnico'],
            ],
            total: ['Horario', 'seg a sex, 8h-18h'],
          },
        },
        { text: 'O atendente recebe todo o historico desta conversa, entao voce nao precisa repetir nada.' },
      ],
      replies: [
        { label: 'Aguardar na fila', icon: 'clock', next: 'avaliacao' },
        { label: 'Voltar ao bot', icon: 'bot', next: 'menu', ghost: true },
      ],
    },

    avaliacao: {
      title: 'Avaliacao (CSAT)',
      note: 'Metrica de satisfacao. E o dado que mostra se o bot resolve ou irrita.',
      messages: [
        { text: 'Antes de encerrar: como voce avalia este atendimento?' },
        { rating: true, next: 'fim' },
      ],
      replies: [{ label: 'Pular', icon: 'x', next: 'fim', ghost: true }],
    },

    fim: {
      title: 'Encerramento',
      note: 'Fecha o ciclo e deixa o canal aberto para um novo contato.',
      messages: [
        {
          text: (ctx) =>
            ctx.vars.nota >= 4
              ? 'Que bom saber! Obrigada pela avaliacao. 💜'
              : ctx.vars.nota
                ? 'Obrigada pelo retorno — vou registrar para melhorarmos.'
                : 'Sem problema.',
        },
        { text: 'Qualquer coisa, estou por aqui 24h. Ate logo!' },
      ],
      replies: [{ label: 'Comecar de novo', icon: 'chat', next: 'inicio' }],
    },
  },
};

/* ========================================================================
   2. CHATBOT DE DELIVERY DE COMIDA
   ===================================================================== */
export const botDelivery = {
  id: 'delivery',
  name: 'Zé · Cantina do Zé',
  avatar: 'utensils',
  placeholder: 'Ex: quero uma pizza',
  start: 'inicio',

  descricao:
    'Pedido de comida ponta a ponta: cardapio em carrossel, carrinho com badge flutuante, ' +
    'endereco, forma de pagamento, resumo com taxas e rastreamento do pedido. ' +
    'E o fluxo mais exigente dos tres porque acumula estado (o carrinho) e termina em transacao.',

  intents: ['ver_cardapio', 'adicionar_item', 'ver_carrinho', 'escolher_endereco', 'pagar', 'rastrear_pedido'],

  nextSteps: [
    'Trocar o cardapio fixo por uma API de catalogo com disponibilidade, preco e tempo de preparo por item.',
    'Mover o carrinho para o servidor: no cliente ele e manipulavel, e preco nunca deve vir do front-end.',
    'Integrar pagamento por um provedor (Pix, cartao) usando chave de idempotencia para o retry nao cobrar duas vezes.',
    'Substituir o tracker simulado por eventos reais via WebSocket ou SSE, vindos do sistema da cozinha.',
    'Validar o endereco contra a area de entrega e calcular a taxa pela distancia, nao por valor fixo.',
    'Guardar o historico para oferecer "repetir ultimo pedido" — o atalho que mais converte neste tipo de bot.',
  ],

  initialVars: { carrinho: [], endereco: null, pagamento: null, taxa: 790 },

  keywords: [
    { re: /^(pizza|pizzas|cardapio|menu|comida|fome|comer)$/, next: 'cardapio' },
    { re: /^(carrinho|sacola)$/, next: 'carrinho' },
    { re: /^(bebida|bebidas|refri|suco|cerveja)$/, next: 'cat_bebidas' },
    { re: /^(sobremesa|sobremesas|doce|doces|pudim)$/, next: 'cat_sobremesas' },
    { re: /^(rastrear|onde esta|entrega|status)$/, next: 'rastreio' },
  ],

  fallback:
    'Nao peguei esse pedido. Posso te mostrar o _cardapio_, abrir seu _carrinho_ ou _rastrear_ um pedido.',

  actions: {
    adicionar(ctx, reply) {
      if (!ctx.vars.carrinho) ctx.vars.carrinho = [];
      const exist = ctx.vars.carrinho.find((i) => i.title === reply.title);
      if (exist) {
        exist.qty = (Number(exist.qty) || 1) + 1;
      } else {
        ctx.vars.carrinho.push({ title: reply.title, price: reply.price, qty: 1 });
      }
    },
    limpar(ctx) {
      ctx.vars.carrinho = [];
    },
    guardarEndereco(ctx, reply) {
      ctx.vars.endereco = (typeof reply === 'string' ? reply : (reply?.label || reply?.title)) || 'Rua das Flores, 123';
    },
    guardarPagamento(ctx, reply) {
      ctx.vars.pagamento = (typeof reply === 'string' ? reply : (reply?.label || reply?.title)) || 'Cartao';
    },
  },

  states: {
    inicio: {
      title: 'Boas-vindas',
      note: 'Abre com o atalho de maior conversao: repetir o ultimo pedido.',
      messages: [
        { text: 'E ai! Aqui e o **Zé** da Cantina. 🍕', delay: 380 },
        { text: 'Bora montar seu pedido? Se preferir, repito o ultimo: _1 Margherita + 1 Guarana_.' },
      ],
      replies: [
        { label: 'Ver cardapio', icon: 'utensils', next: 'cardapio' },
        { label: 'Repetir ultimo pedido', icon: 'clock', next: 'repetir' },
        { label: 'Rastrear pedido', icon: 'target', next: 'rastreio', ghost: true },
      ],
    },

    repetir: {
      title: 'Repetir pedido anterior',
      note: 'Atalho sobre o historico do cliente. Depende de pedidos persistidos.',
      onEnter: 'repetirPedido',
      messages: [
        { text: 'Repeti seu ultimo pedido no carrinho. Quer adicionar mais alguma coisa?' },
      ],
      replies: [
        { label: 'Fechar pedido', icon: 'check', next: 'carrinho' },
        { label: 'Ver cardapio', icon: 'utensils', next: 'cardapio', ghost: true },
      ],
    },

    cardapio: {
      title: 'Cardapio · categorias',
      note: 'Menu de categorias. Mantem a lista curta para caber na tela do celular.',
      messages: [{ text: 'Temos isto hoje:' }],
      replies: [
        { label: '🍕 Pizzas', next: 'cat_pizzas' },
        { label: '🍔 Burgers', next: 'cat_burgers' },
        { label: '🥤 Bebidas', next: 'cat_bebidas' },
        { label: '🍮 Sobremesas', next: 'cat_sobremesas' },
        { label: 'Ver carrinho', icon: 'cart', next: 'carrinho', ghost: true },
      ],
    },

    cat_pizzas: {
      title: 'Cardapio · pizzas',
      note: 'Carrossel horizontal de produtos. Cada botao adiciona ao carrinho.',
      messages: [
        { text: 'Pizzas media (6 fatias), massa fina:' },
        {
          cards: [
            { emoji: '🍕', title: 'Margherita', desc: 'Molho, mucarela, tomate e basilico', price: 4290, next: 'adicionado', do: 'adicionar' },
            { emoji: '🍖', title: 'Calabresa', desc: 'Calabresa artesanal e cebola roxa', price: 4690, next: 'adicionado', do: 'adicionar' },
            { emoji: '🧀', title: 'Quatro queijos', desc: 'Mucarela, provolone, gorgonzola e parmesao', price: 5290, next: 'adicionado', do: 'adicionar' },
            { emoji: '🌿', title: 'Vegetariana', desc: 'Abobrinha, berinjela, pimentao e rucula', price: 4890, next: 'adicionado', do: 'adicionar' },
          ],
        },
      ],
      replies: [{ label: 'Voltar ao cardapio', icon: 'chevron', next: 'cardapio', ghost: true }],
    },

    cat_burgers: {
      title: 'Cardapio · burgers',
      note: 'Mesma estrutura de produtos, outra categoria.',
      messages: [
        { text: 'Burgers 180g, pao brioche:' },
        {
          cards: [
            { emoji: '🍔', title: 'Classico', desc: 'Carne, queijo, alface e tomate', price: 3290, next: 'adicionado', do: 'adicionar' },
            { emoji: '🥓', title: 'Bacon duplo', desc: 'Dois burgers, cheddar e bacon', price: 4490, next: 'adicionado', do: 'adicionar' },
            { emoji: '🌱', title: 'Veggie', desc: 'Grao de bico, abobrinha e tahine', price: 3590, next: 'adicionado', do: 'adicionar' },
          ],
        },
      ],
      replies: [{ label: 'Voltar ao cardapio', icon: 'chevron', next: 'cardapio', ghost: true }],
    },

    cat_bebidas: {
      title: 'Cardapio · bebidas',
      note: 'Itens de ticket baixo, bons para aumentar o valor do pedido.',
      messages: [
        {
          cards: [
            { emoji: '🥤', title: 'Guarana 350ml', desc: 'Lata gelada', price: 690, next: 'adicionado', do: 'adicionar' },
            { emoji: '🍊', title: 'Suco de laranja', desc: '500ml, natural', price: 1290, next: 'adicionado', do: 'adicionar' },
            { emoji: '🍺', title: 'Cerveja long neck', desc: '330ml', price: 1190, next: 'adicionado', do: 'adicionar' },
            { emoji: '💧', title: 'Agua com gas', desc: '500ml', price: 590, next: 'adicionado', do: 'adicionar' },
          ],
        },
      ],
      replies: [{ label: 'Voltar ao cardapio', icon: 'chevron', next: 'cardapio', ghost: true }],
    },

    cat_sobremesas: {
      title: 'Cardapio · sobremesas',
      note: 'Oferta final, apresentada antes do fechamento.',
      messages: [
        {
          cards: [
            { emoji: '🍮', title: 'Pudim', desc: 'Fatia generosa', price: 1490, next: 'adicionado', do: 'adicionar' },
            { emoji: '🍫', title: 'Brownie', desc: 'Com sorvete de creme', price: 1890, next: 'adicionado', do: 'adicionar' },
          ],
        },
      ],
      replies: [{ label: 'Voltar ao cardapio', icon: 'chevron', next: 'cardapio', ghost: true }],
    },

    adicionado: {
      title: 'Item adicionado',
      note: 'Confirma a acao e devolve o usuario ao fluxo, sem perder o contexto.',
      messages: [
        {
          text: (ctx) => {
            const itens = ctx.vars.carrinho || [];
            const ultimo = itens[itens.length - 1];
            const totalQtd = itens.reduce((soma, item) => soma + (Number(item.qty) || 1), 0);
            return `**${ultimo?.title}** no carrinho. Agora sao ${totalQtd} ${totalQtd === 1 ? 'item' : 'itens'}.`;
          },
          delay: 300,
        },
      ],
      replies: [
        { label: 'Adicionar mais', icon: 'plus', next: 'cardapio' },
        { label: 'Fechar pedido', icon: 'cart', next: 'carrinho' },
      ],
    },

    carrinho: {
      title: 'Carrinho',
      note: 'Resumo com subtotal e taxa. Em producao, o total vem calculado do servidor.',
      messages: (ctx) =>
        ctx.vars.carrinho?.length
          ? [
              { text: 'Seu carrinho:' },
              {
                icon: 'cart',
                summary: (c) => {
                  const itens = c.vars.carrinho || [];
                  const subtotal = itens.reduce(
                    (soma, i) => soma + (Number(i.price) || 0) * (Number(i.qty) || 1),
                    0,
                  );
                  return {
                    title: 'Resumo do pedido',
                    rows: [
                      ...itens.map((item) => {
                        const qtd = Number(item.qty) || 1;
                        const label = qtd > 1 ? `${qtd}x ${item.title}` : item.title;
                        const preco = (Number(item.price) || 0) * qtd;
                        return [label, fmtMoney(preco)];
                      }),
                      ['Entrega', fmtMoney(c.vars.taxa)],
                    ],
                    total: ['Total', fmtMoney(subtotal + c.vars.taxa)],
                  };
                },
              },
            ]
          : [{ text: 'Seu carrinho esta vazio. Quer ver o cardapio?' }],
      replies: (ctx) =>
        ctx.vars.carrinho.length
          ? [
              { label: 'Confirmar endereco', icon: 'arrow-right', next: 'endereco' },
              { label: 'Adicionar mais', icon: 'plus', next: 'cardapio', ghost: true },
              { label: 'Limpar carrinho', icon: 'trash', next: 'cardapio', do: 'limpar', ghost: true },
            ]
          : [{ label: 'Ver cardapio', icon: 'utensils', next: 'cardapio' }],
    },

    endereco: {
      title: 'Entrega · endereco',
      note: 'Enderecos salvos. A versao real valida contra a area de cobertura.',
      messages: [{ text: 'Para onde eu mando?' }],
      replies: [
        { label: 'Casa · Rua das Acacias, 120', icon: 'target', next: 'pagamento', do: 'guardarEndereco' },
        { label: 'Trabalho · Av. Central, 900', icon: 'target', next: 'pagamento', do: 'guardarEndereco' },
        { label: 'Usar outro endereco', icon: 'plus', next: 'endereco_novo', ghost: true },
      ],
    },

    endereco_novo: {
      title: 'Entrega · novo endereco',
      note: 'Em producao: captura de CEP com autocomplete e validacao de cobertura.',
      messages: [
        {
          text:
            'Me manda o CEP e o numero.\n_No protótipo este campo nao e validado — ' +
            'a versao real consulta o CEP e confere se esta na area de entrega._',
        },
      ],
      replies: [
        { label: 'Usar endereco salvo', icon: 'chevron', next: 'endereco', ghost: true },
        { label: 'Seguir assim', icon: 'arrow-right', next: 'pagamento', do: 'guardarEndereco' },
      ],
    },

    pagamento: {
      title: 'Pagamento',
      note: 'Escolha do meio de pagamento. O ponto que exige idempotencia.',
      messages: [
        { text: (ctx) => `Entrega em **${ctx.vars.endereco}**. Como voce quer pagar?` },
      ],
      replies: [
        { label: 'Pix', icon: 'zap', next: 'confirmado', do: 'guardarPagamento' },
        { label: 'Cartao de credito', icon: 'clipboard', next: 'confirmado', do: 'guardarPagamento' },
        { label: 'Dinheiro na entrega', icon: 'cart', next: 'confirmado', do: 'guardarPagamento' },
      ],
    },

    confirmado: {
      title: 'Pedido confirmado',
      note: 'Recibo final. Em producao, so apos a confirmacao do provedor de pagamento.',
      messages: [
        { text: 'Pedido confirmado! 🎉', delay: 420 },
        {
          icon: 'check',
          summary: (ctx) => {
            const itens = ctx.vars.carrinho || [];
            const subtotal = itens.reduce(
              (soma, i) => soma + (Number(i.price) || 0) * (Number(i.qty) || 1),
              0,
            );
            const totalQtd = itens.reduce((soma, i) => soma + (Number(i.qty) || 1), 0);
            return {
              title: `Pedido #${Math.floor(Math.random() * 9000) + 1000}`,
              rows: [
                ['Itens', String(totalQtd)],
                ['Subtotal', fmtMoney(subtotal)],
                ['Entrega', fmtMoney(ctx.vars.taxa)],
                ['Pagamento', ctx.vars.pagamento],
                ['Previsao', '35 a 45 min'],
              ],
              total: ['Total', fmtMoney(subtotal + ctx.vars.taxa)],
            };
          },
        },
        { text: 'Ja mandei para a cozinha. Pode acompanhar aqui:' },
        {
          tracker: {
            autoAdvanceMs: 2200,
            steps: [
              { title: 'Pedido recebido', sub: 'agora' },
              { title: 'Na cozinha', sub: 'em preparo' },
              { title: 'Saiu para entrega', sub: 'com o entregador' },
              { title: 'Entregue', sub: 'bom apetite' },
            ],
          },
        },
      ],
      replies: [
        { label: 'Fazer outro pedido', icon: 'plus', next: 'inicio', do: 'limpar' },
        { label: 'Avaliar', icon: 'star', next: 'avaliar', ghost: true },
      ],
    },

    rastreio: {
      title: 'Rastreamento',
      note: 'Consulta de pedido em andamento, independente do fluxo de compra.',
      messages: [
        { text: 'Seu pedido **#7731** esta em rota. 🛵' },
        {
          tracker: {
            autoAdvanceMs: 1700,
            steps: [
              { title: 'Pedido recebido', sub: '19:02' },
              { title: 'Na cozinha', sub: '19:08' },
              { title: 'Saiu para entrega', sub: '19:26' },
              { title: 'Entregue', sub: 'previsto 19:45' },
            ],
          },
        },
      ],
      replies: [
        { label: 'Ver cardapio', icon: 'utensils', next: 'cardapio' },
        { label: 'Falar com a loja', icon: 'headset', next: 'inicio', ghost: true },
      ],
    },

    avaliar: {
      title: 'Avaliacao do pedido',
      note: 'Avaliacao pos-entrega, usada para ranquear itens e entregadores.',
      messages: [
        { text: 'Como foi o pedido?' },
        { rating: true, next: 'fim_avaliacao' },
      ],
      replies: [{ label: 'Pular', icon: 'x', next: 'inicio', ghost: true }],
    },

    fim_avaliacao: {
      title: 'Encerramento',
      note: 'Fecha o ciclo e convida a um novo pedido.',
      messages: [{ text: 'Valeu demais! Ate a proxima. 🍕' }],
      replies: [{ label: 'Novo pedido', icon: 'plus', next: 'inicio', do: 'limpar' }],
    },
  },
};

// Acao do atalho "repetir pedido" (declarada depois para reusar os precos).
botDelivery.actions.repetirPedido = (ctx) => {
  ctx.vars.carrinho = [
    { title: 'Margherita', price: 4290 },
    { title: 'Guarana 350ml', price: 690 },
  ];
};

/* ========================================================================
   3. CHATBOT DE ORGANIZACAO DE DEMANDAS
   ===================================================================== */
export const botDemandas = {
  id: 'demandas',
  name: 'Kai · Organizador de demandas',
  avatar: 'clipboard',
  placeholder: 'Ex: nova demanda',
  start: 'inicio',

  descricao:
    'Assistente de organizacao de trabalho: cria demandas em etapas curtas (titulo, prioridade, ' +
    'prazo, responsavel), mostra o quadro por status e fecha a semana com um resumo. ' +
    'O ganho aqui nao e automacao, e reduzir o atrito de registrar — por isso cada pergunta ' +
    'tem resposta de um toque.',

  intents: ['criar_demanda', 'definir_prioridade', 'definir_prazo', 'atribuir_responsavel', 'listar_quadro', 'resumo_semana'],

  nextSteps: [
    'Trocar o estado em memoria por um backend com as demandas (ou integrar Jira, Linear, Trello, Plane).',
    'Extrair titulo, prazo e responsavel de uma frase unica com NLU, mantendo os botoes como confirmacao.',
    'Notificar o responsavel no canal dele assim que a demanda for criada.',
    'Gerar o resumo da semana por agendamento (cron) e enviar sem ninguem pedir.',
    'Registrar quem criou e quando — auditoria e o requisito que sempre aparece depois em ferramenta de time.',
    'Adicionar deteccao de duplicata por similaridade de titulo antes de criar.',
  ],

  initialVars: {
    rascunho: {},
    demandas: [
      { title: 'Corrigir erro no checkout', prio: 'alta', status: 'fazendo', meta: 'Ana · hoje' },
      { title: 'Revisar textos da landing', prio: 'baixa', status: 'backlog', meta: 'Bruno · sexta' },
      { title: 'Atualizar dependencias', prio: 'media', status: 'backlog', meta: 'Carla · semana' },
      { title: 'Deploy da v2.1', prio: 'alta', status: 'feito', meta: 'Diego · ontem' },
      { title: 'Documentar a API', prio: 'media', status: 'fazendo', meta: 'Ana · amanha' },
    ],
  },

  keywords: [
    { re: /nova|criar|adicionar|demanda|tarefa|task/, next: 'nova_titulo' },
    { re: /quadro|kanban|lista|minhas|ver tudo/, next: 'quadro' },
    { re: /resumo|semana|relatorio|status geral/, next: 'resumo' },
    { re: /menu|inicio|voltar/, next: 'menu' },
  ],

  fallback:
    'Nao entendi. Posso _criar uma demanda_, mostrar o _quadro_ ou gerar o _resumo da semana_.',

  actions: {
    guardarTitulo(ctx, reply) {
      ctx.vars.rascunho = { title: reply?.titleValue || reply?.label || reply?.title || (typeof reply === 'string' ? reply : 'Nova demanda') };
    },
    guardarPrioridade(ctx, reply) {
      if (!ctx.vars.rascunho) ctx.vars.rascunho = {};
      ctx.vars.rascunho.prio = reply?.value || 'media';
    },
    guardarPrazo(ctx, reply) {
      if (!ctx.vars.rascunho) ctx.vars.rascunho = {};
      ctx.vars.rascunho.prazo = reply?.label || reply?.title || 'Esta semana';
    },
    criar(ctx, reply) {
      const rascunho = ctx.vars.rascunho || {};
      ctx.vars.demandas.unshift({
        title: rascunho.title || 'Demanda sem titulo',
        prio: rascunho.prio || 'media',
        status: 'backlog',
        meta: `${reply?.label || reply?.title || 'A Fazer'} · ${rascunho.prazo || 'sem prazo'}`,
        novo: true,
      });
      ctx.vars.rascunho = {};
    },
  },

  states: {
    inicio: {
      title: 'Boas-vindas',
      note: 'Abre com o estado atual do quadro, nao com um menu vazio.',
      messages: [
        { text: 'Oi! Eu sou o **Kai**, organizo as suas demandas. 📋', delay: 380 },
        {
          text: (ctx) => {
            const fazendo = ctx.vars.demandas.filter((d) => d.status === 'fazendo').length;
            const backlog = ctx.vars.demandas.filter((d) => d.status === 'backlog').length;
            return `Hoje voce tem **${fazendo} em andamento** e **${backlog} no backlog**. Por onde comecamos?`;
          },
        },
      ],
      replies: [
        { label: 'Nova demanda', icon: 'plus', next: 'nova_titulo' },
        { label: 'Ver o quadro', icon: 'layers', next: 'quadro' },
        { label: 'Resumo da semana', icon: 'target', next: 'resumo', ghost: true },
      ],
    },

    menu: {
      title: 'Menu',
      note: 'Estado de retorno comum a todas as ramificacoes.',
      messages: [{ text: 'O que mais?' }],
      replies: [
        { label: 'Nova demanda', icon: 'plus', next: 'nova_titulo' },
        { label: 'Ver o quadro', icon: 'layers', next: 'quadro' },
        { label: 'Resumo da semana', icon: 'target', next: 'resumo' },
        { label: 'Encerrar', icon: 'check', next: 'fim', ghost: true },
      ],
    },

    nova_titulo: {
      title: 'Nova demanda · titulo',
      note: 'Sugestoes de um toque reduzem o atrito. Texto livre tambem e aceito.',
      messages: [
        { text: 'Qual e a demanda? Escolha uma sugestao ou digite o titulo.' },
      ],
      replies: [
        { label: 'Corrigir bug reportado', icon: 'bug', next: 'nova_prioridade', do: 'guardarTitulo' },
        { label: 'Implementar nova feature', icon: 'sparkle', next: 'nova_prioridade', do: 'guardarTitulo' },
        { label: 'Revisar pull request', icon: 'git', next: 'nova_prioridade', do: 'guardarTitulo' },
        { label: 'Escrever documentacao', icon: 'book', next: 'nova_prioridade', do: 'guardarTitulo' },
      ],
    },

    nova_prioridade: {
      title: 'Nova demanda · prioridade',
      note: 'Tres niveis. Mais que isso e ninguem usa de forma consistente.',
      messages: [
        { text: (ctx) => `**${ctx.vars.rascunho?.title || 'Demanda'}**. Qual a prioridade?`, delay: 360 },
      ],
      replies: [
        { label: '🔴 Alta · bloqueia alguem', value: 'alta', next: 'nova_prazo', do: 'guardarPrioridade' },
        { label: '🟡 Media · nesta semana', value: 'media', next: 'nova_prazo', do: 'guardarPrioridade' },
        { label: '🔵 Baixa · quando der', value: 'baixa', next: 'nova_prazo', do: 'guardarPrioridade' },
      ],
    },

    nova_prazo: {
      title: 'Nova demanda · prazo',
      note: 'Datas relativas sao mais rapidas de responder que um calendario.',
      messages: [{ text: 'Para quando?', delay: 320 }],
      replies: [
        { label: 'Hoje', icon: 'clock', next: 'nova_responsavel', do: 'guardarPrazo' },
        { label: 'Amanha', icon: 'clock', next: 'nova_responsavel', do: 'guardarPrazo' },
        { label: 'Esta semana', icon: 'clock', next: 'nova_responsavel', do: 'guardarPrazo' },
        { label: 'Sem prazo', icon: 'x', next: 'nova_responsavel', do: 'guardarPrazo', ghost: true },
      ],
    },

    nova_responsavel: {
      title: 'Nova demanda · responsavel',
      note: 'Ultima pergunta. Ao escolher, a demanda e criada e entra no quadro.',
      messages: [{ text: 'Quem assume?', delay: 320 }],
      replies: [
        { label: 'Ana', icon: 'bot', next: 'nova_criada', do: 'criar' },
        { label: 'Bruno', icon: 'bot', next: 'nova_criada', do: 'criar' },
        { label: 'Carla', icon: 'bot', next: 'nova_criada', do: 'criar' },
        { label: 'Eu mesmo', icon: 'bot', next: 'nova_criada', do: 'criar' },
      ],
    },

    nova_criada: {
      title: 'Demanda criada',
      note: 'Confirma com o recibo e ja mostra o quadro atualizado.',
      messages: [
        { text: 'Criada! 🎯', delay: 400 },
        {
          icon: 'check',
          summary: (ctx) => {
            const nova = ctx.vars.demandas[0];
            return {
              title: 'Demanda registrada',
              rows: [
                ['Titulo', nova.title],
                ['Prioridade', nova.prio],
                ['Responsavel e prazo', nova.meta],
                ['Status', 'backlog'],
              ],
              total: ['Total no quadro', String(ctx.vars.demandas.length)],
            };
          },
        },
        { text: 'Olha como ficou o quadro:' },
        {
          kanban: (ctx) => [
            { title: 'Backlog', cards: ctx.vars.demandas.filter((d) => d.status === 'backlog') },
            { title: 'Fazendo', cards: ctx.vars.demandas.filter((d) => d.status === 'fazendo') },
            { title: 'Feito', cards: ctx.vars.demandas.filter((d) => d.status === 'feito') },
          ],
        },
      ],
      replies: [
        { label: 'Criar outra', icon: 'plus', next: 'nova_titulo' },
        { label: 'Resumo da semana', icon: 'target', next: 'resumo', ghost: true },
        { label: 'Encerrar', icon: 'check', next: 'fim', ghost: true },
      ],
    },

    quadro: {
      title: 'Quadro (kanban)',
      note: 'Visao por status. Em producao, vem do backend e permite mover cartoes.',
      messages: [
        { text: 'Seu quadro agora:' },
        {
          kanban: (ctx) => [
            { title: 'Backlog', cards: ctx.vars.demandas.filter((d) => d.status === 'backlog') },
            { title: 'Fazendo', cards: ctx.vars.demandas.filter((d) => d.status === 'fazendo') },
            { title: 'Feito', cards: ctx.vars.demandas.filter((d) => d.status === 'feito') },
          ],
        },
        {
          text: (ctx) => {
            const altas = ctx.vars.demandas.filter((d) => d.prio === 'alta' && d.status !== 'feito');
            return altas.length
              ? `Atencao: **${altas.length}** ${altas.length === 1 ? 'demanda de prioridade alta' : 'demandas de prioridade alta'} ainda em aberto.`
              : 'Nenhuma prioridade alta em aberto. Bom momento para atacar o backlog.';
          },
        },
      ],
      replies: [
        { label: 'Nova demanda', icon: 'plus', next: 'nova_titulo' },
        { label: 'Resumo da semana', icon: 'target', next: 'resumo' },
        { label: 'Voltar', icon: 'chevron', next: 'menu', ghost: true },
      ],
    },

    resumo: {
      title: 'Resumo da semana',
      note: 'Relatorio agregado. Candidato natural a envio automatico por agendamento.',
      messages: [
        { text: 'Fechamento da semana:' },
        {
          chartTitle: 'Demandas por status',
          chart: (ctx) => [
            ['Backlog', ctx.vars.demandas.filter((d) => d.status === 'backlog').length],
            ['Fazendo', ctx.vars.demandas.filter((d) => d.status === 'fazendo').length],
            ['Feito', ctx.vars.demandas.filter((d) => d.status === 'feito').length],
          ],
        },
        {
          chartTitle: 'Por prioridade',
          chart: (ctx) => [
            ['Alta', ctx.vars.demandas.filter((d) => d.prio === 'alta').length],
            ['Media', ctx.vars.demandas.filter((d) => d.prio === 'media').length],
            ['Baixa', ctx.vars.demandas.filter((d) => d.prio === 'baixa').length],
          ],
        },
        {
          text: (ctx) => {
            const feitas = ctx.vars.demandas.filter((d) => d.status === 'feito').length;
            const total = ctx.vars.demandas.length;
            const pct = Math.round((feitas / Math.max(1, total)) * 100);
            return `Taxa de conclusao: **${pct}%** (${feitas} de ${total}). Quer que eu mande este resumo toda sexta?`;
          },
        },
      ],
      replies: [
        { label: 'Sim, toda sexta', icon: 'clock', next: 'resumo_agendado' },
        { label: 'Nao, obrigado', icon: 'x', next: 'menu', ghost: true },
      ],
    },

    resumo_agendado: {
      title: 'Resumo agendado',
      note: 'Opt-in de relatorio recorrente. Em producao: cron mais canal de envio.',
      messages: [
        { text: 'Agendado para **sexta, 17h**. Vou mandar sem voce precisar pedir.' },
      ],
      replies: [
        { label: 'Nova demanda', icon: 'plus', next: 'nova_titulo' },
        { label: 'Encerrar', icon: 'check', next: 'fim', ghost: true },
      ],
    },

    fim: {
      title: 'Encerramento',
      note: 'Fecha a conversa reforcando o estado atual.',
      messages: [
        {
          text: (ctx) =>
            `Fechado. Voce tem **${ctx.vars.demandas.filter((d) => d.status !== 'feito').length}** demandas em aberto. ` +
            'Boa execucao!',
        },
      ],
      replies: [{ label: 'Comecar de novo', icon: 'chat', next: 'inicio' }],
    },
  },
};

export const BOTS = {
  servicos: botServicos,
  delivery: botDelivery,
  demandas: botDemandas,
};

/* ========================================================================
   Blueprint: documenta o fluxo ao lado do simulador
   ===================================================================== */
export function renderBlueprint(script, estadoAtual) {
  const chaves = Object.keys(script.states);

  $('#bp-title').textContent = `Fluxo · ${script.name.split('·')[0].trim()}`;
  $('#bp-badge').textContent = `${chaves.length} estados`;
  $('#bp-desc').textContent = script.descricao;

  const flow = $('#bp-flow');
  flow.replaceChildren(
    ...chaves.map((chave, i) => {
      const estado = script.states[chave];

      const transicoes = [
        ...new Set(
          [
            ...(typeof estado.replies === 'function' ? [] : estado.replies || []),
            ...(typeof estado.messages === 'function'
              ? []
              : (estado.messages || []).flatMap((m) => m.cards || [])),
          ]
            .map((r) => r.next)
            .filter(Boolean),
        ),
      ];

      return el(
        'div.bp-node',
        {
          class: chave === estadoAtual ? 'is-current' : '',
          style: { '--i': i },
          dataset: { state: chave },
        },
        [
          el('span.bp-node__key', { text: chave }),
          el('div.bp-node__body', {}, [
            el('strong', { text: estado.title }),
            el('small', { text: estado.note }),
            transicoes.length > 0 &&
              el(
                'div.bp-node__next',
                {},
                transicoes.map((t) => el('span', { text: `→ ${t}` })),
              ),
          ]),
        ],
      );
    }),
  );

  $('#bp-intents').replaceChildren(
    ...script.intents.map((intent) => el('span.bp-intent', {}, [icon('target'), intent])),
  );

  $('#bp-steps').replaceChildren(
    ...script.nextSteps.map((passo) => el('li', { html: inline(passo) })),
  );
}

/** Realca o estado atual no blueprint e rola ate ele. */
export function highlightBlueprintState(chave) {
  const flow = $('#bp-flow');
  if (!flow) return;

  for (const node of flow.children) {
    const ativo = node.dataset.state === chave;
    node.classList.toggle('is-current', ativo);
    if (ativo) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
