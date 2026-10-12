/** Ponto de entrada da aplicacao. */
import { $, $$, el, icon, copyText, debounce, relativeTime, afterPaint } from './lib/dom.js';
import {
  initRipple,
  initMagnetic,
  initSpotlight,
  initReveal,
  initTheme,
  toggleTheme,
  moveIndicator,
  moveThumb,
  countTo,
  toast,
  progress,
  confetti,
} from './lib/motion.js';
import { renderMarkdown } from './lib/markdown.js';
import { api } from './api.js';
import { state, patch } from './state.js';
import { createEditor } from './components/editor.js';
import { renderReview, renderReviewLoading } from './components/reviewView.js';
import { renderDebug, renderDebugLoading } from './components/debugView.js';
import { createChatSim, BOTS, renderBlueprint, highlightBlueprintState } from './components/chatbots.js';

const VIEWS = {
  review: {
    title: 'Code Review',
    subtitle: 'Cole o codigo e receba uma revisao explicada linha a linha',
  },
  debug: {
    title: 'Resolver bug',
    subtitle: 'Cole o erro e receba causas provaveis, roteiro e correcao',
  },
  tutor: {
    title: 'Tutor',
    subtitle: 'Entenda o conceito por tras do codigo, nao so a sintaxe',
  },
  chatbots: {
    title: 'Chatbots (demo)',
    subtitle: 'Tres protótipos de front-end prontos para virar chatbot real',
  },
  catalog: {
    title: 'Catalogo de regras',
    subtitle: 'Tudo o que o motor local sabe procurar',
  },
};

let editor = null;
let chatSim = null;

/* ========================================================================
   Navegacao
   ===================================================================== */
function irPara(view) {
  if (!VIEWS[view]) return;

  state.view = view;

  for (const node of $$('.view')) node.classList.toggle('is-active', node.dataset.view === view);

  for (const item of $$('.nav__item')) {
    const ativo = item.dataset.nav === view;
    item.classList.toggle('is-active', ativo);
    if (ativo) moveIndicator($('#nav-indicator'), item);
  }

  $('#view-title').textContent = VIEWS[view].title;
  $('#view-subtitle').textContent = VIEWS[view].subtitle;

  document.body.classList.remove('menu-open');
  if (location.hash.slice(1) !== view) history.replaceState(null, '', `#${view}`);

  initReveal($(`#view-${view}`));

  // Controles que dependem de medidas de layout.
  if (view === 'tutor') moveThumb($('#tutor-mode'));
  if (view === 'chatbots') moveThumb($('#bot-switch'));
  if (view === 'review') editor?.refresh();
}

/* ========================================================================
   Sidebar: progresso e historico
   ===================================================================== */
const CONQUISTA_ICON = {
  'primeira-analise': 'scan',
  'cinco-analises': 'scan',
  'dez-analises': 'target',
  'cacador-de-bugs': 'bug',
  curioso: 'cap',
  estudioso: 'book',
  'nivel-3': 'trophy',
  'nivel-5': 'trophy',
};

function renderProgresso(progresso, recompensa) {
  if (!progresso) return;
  state.session.progresso = progresso;

  const anel = $('#level-ring-fill');
  const circunferencia = 2 * Math.PI * 17;
  if (anel) {
    anel.style.strokeDasharray = String(circunferencia);
    anel.style.strokeDashoffset = String(circunferencia * (1 - progresso.percentualNivel / 100));
  }

  $('#level-number').textContent = progresso.nivel;
  $('#level-label').textContent = progresso.nivel;
  $('#xp-current').textContent = progresso.xpNoNivel;
  $('#xp-target').textContent = progresso.xpParaProximoNivel;
  $('#xp-bar-fill').style.width = `${progresso.percentualNivel}%`;

  countTo($('#stat-reviews'), progresso.analises);
  countTo($('#stat-bugs'), progresso.bugsDiagnosticados);
  countTo($('#stat-issues'), progresso.problemasEncontrados);

  $('#achievements').replaceChildren(
    ...(progresso.conquistasDetalhadas || []).map((c) =>
      el('span.achievement', { title: c.descricao }, [icon(CONQUISTA_ICON[c.id] || 'trophy'), c.titulo]),
    ),
  );

  if (recompensa?.subiuDeNivel) {
    const badge = $('.level-badge');
    badge.classList.remove('is-up');
    void badge.offsetWidth;
    badge.classList.add('is-up');
    confetti();
    toast(`Nivel ${recompensa.nivel}!`, 'Voce subiu de nivel.', 'success');
  }

  for (const conquista of recompensa?.novasConquistas || []) {
    toast(conquista.titulo, conquista.descricao, 'success');
  }
}

const HIST_ICON = { review: 'scan', debug: 'bug', tutor: 'cap' };

function renderHistorico(historico = []) {
  state.session.historico = historico;
  const host = $('#history');

  if (!historico.length) {
    host.replaceChildren(
      el('p.history__empty', {
        html: 'Suas analises aparecem aqui.<br /><small>Nada e salvo em banco de dados.</small>',
      }),
    );
    return;
  }

  host.replaceChildren(
    ...historico.map((item) =>
      el(
        'button.history-item',
        { type: 'button', dataset: { id: item.id, tipo: item.tipo }, title: item.resumo || item.titulo },
        [
          el(
            'span.history-item__badge',
            { dataset: item.grade ? { grade: item.grade } : {} },
            item.grade ? item.grade : icon(HIST_ICON[item.tipo] || 'scan'),
          ),
          el('span.history-item__body', {}, [
            el('strong', { text: item.titulo }),
            el('small', { text: `${relativeTime(item.criadoEm)} · ${item.resumo || ''}` }),
          ]),
        ],
      ),
    ),
  );
}

async function abrirHistorico(id) {
  const item = state.session.historico.find((h) => h.id === id);
  if (!item) return;

  try {
    progress.start();
    const { data } = await api.historyItem(id);

    if (data.tipo === 'review') {
      irPara('review');
      editor.setValue(data.codigo || '');
      const achados = renderReview(data.resultado, handlersReview);
      editor.setFindings(achados);
      patch('review', { result: data.resultado });
    } else if (data.tipo === 'debug') {
      irPara('debug');
      renderDebug(data.resultado, handlersDebug);
      patch('debug', { result: data.resultado });
    } else {
      irPara('tutor');
    }
  } catch (erro) {
    toast('Nao foi possivel abrir', erro.message, 'error');
  } finally {
    progress.stop();
  }
}

async function recarregarSessao() {
  try {
    const { data } = await api.session();
    renderProgresso(data.progresso);
    renderHistorico(data.historico);
  } catch {
    /* sessao nova: nada a carregar */
  }
}

/* ========================================================================
   Code review
   ===================================================================== */
const handlersReview = {
  onFocusLine: (line) => editor?.focusLine(line),
  onConcept: (conceito) => {
    irPara('tutor');
    $('#tutor-input').value = `Me explique: ${conceito}`;
    enviarPergunta();
  },
};

async function analisar() {
  const codigo = editor.value.trim();

  if (!codigo) {
    toast('Nada para analisar', 'Cole um trecho de codigo primeiro.', 'warn');
    $('#code-input').focus();
    return;
  }

  const botao = $('#btn-analyze');
  botao.disabled = true;
  botao.classList.add('is-loading');
  progress.start();
  renderReviewLoading();
  patch('review', { loading: true });

  try {
    const resposta = await api.review({
      code: codigo,
      language: $('#lang-select').value,
    });

    const resultado = resposta.data;
    patch('review', { result: resultado, loading: false });

    const achados = renderReview(resultado, handlersReview);
    editor.setFindings(achados);
    atualizarLinguagem(resultado.language.label);

    renderProgresso(resposta.progresso, resposta.recompensa);
    await recarregarSessao();

    if (!resultado.findings.length) {
      confetti({ count: 80 });
      toast('Codigo limpo', 'Nenhum problema encontrado pelas regras.', 'success');
    } else {
      const { blockers } = resultado.summary;
      toast(
        `${resultado.findings.length} ${resultado.findings.length === 1 ? 'achado' : 'achados'}`,
        blockers ? `${blockers} de alta severidade — comece por eles.` : 'Nada critico.',
        blockers ? 'warn' : 'info',
      );
    }
  } catch (erro) {
    $('#review-result').hidden = true;
    $('#review-empty').hidden = false;
    toast('Falha na analise', erro.message, 'error');
    patch('review', { loading: false });
  } finally {
    botao.disabled = false;
    botao.classList.remove('is-loading');
    progress.stop();
  }
}

function atualizarLinguagem(label) {
  const chip = $('#lang-detected');
  chip.textContent = label;
  chip.classList.remove('is-updated');
  void chip.offsetWidth;
  chip.classList.add('is-updated');
}

/* ========================================================================
   Diagnostico de bugs
   ===================================================================== */
const handlersDebug = {
  onFocusLine: () => {
    $('#debug-code-disclosure').open = true;
    $('#debug-code-input').focus();
  },
  onConcept: (conceito) => {
    irPara('tutor');
    $('#tutor-input').value = `Me explique: ${conceito}`;
    enviarPergunta();
  },
};

async function diagnosticar() {
  const erroTexto = $('#error-input').value.trim();

  if (!erroTexto) {
    toast('Cole o erro', 'Preciso da mensagem ou do stack trace.', 'warn');
    $('#error-input').focus();
    return;
  }

  const botao = $('#btn-diagnose');
  botao.disabled = true;
  botao.classList.add('is-loading');
  progress.start();
  renderDebugLoading();

  try {
    const resposta = await api.debug({
      error: erroTexto,
      code: $('#debug-code-input').value,
      language: 'auto',
    });

    patch('debug', { result: resposta.data });
    renderDebug(resposta.data, handlersDebug);
    renderProgresso(resposta.progresso, resposta.recompensa);
    await recarregarSessao();

    toast(
      resposta.data.reconhecido ? 'Padrao reconhecido' : 'Diagnostico generico',
      resposta.data.title,
      resposta.data.reconhecido ? 'success' : 'info',
    );
  } catch (erro) {
    $('#debug-result').hidden = true;
    $('#debug-empty').hidden = false;
    toast('Falha no diagnostico', erro.message, 'error');
  } finally {
    botao.disabled = false;
    botao.classList.remove('is-loading');
    progress.stop();
  }
}

/* ========================================================================
   Tutor
   ===================================================================== */
function bolhaTutor(autor, conteudo = '') {
  const bubble = el('div.msg__bubble.md', { html: conteudo });

  const node = el(`div.msg.msg--${autor}`, {}, [
    el('span.msg__avatar', {}, icon(autor === 'user' ? 'search' : 'cap')),
    bubble,
  ]);

  $('#tutor-chat').append(node);
  $('#tutor-welcome')?.remove();
  node.scrollIntoView({ block: 'end', behavior: 'smooth' });

  return { node, bubble };
}

async function enviarPergunta() {
  const input = $('#tutor-input');
  const pergunta = input.value.trim();
  if (!pergunta || state.tutor.loading) return;

  input.value = '';
  input.style.height = 'auto';

  bolhaTutor('user', `<p>${pergunta.replace(/</g, '&lt;')}</p>`);

  const { bubble } = bolhaTutor('bot', '<div class="typing"><span></span><span></span><span></span></div>');
  patch('tutor', { loading: true });
  $('#tutor-send').disabled = true;

  let acumulado = '';
  let primeiro = true;
  // Depois do evento `meta` a bolha ganha rodape e sugestoes. Sem esta trava,
  // um `pintar` ainda pendente no debounce sobrescreveria tudo.
  let finalizado = false;

  const pintar = () => {
    if (finalizado) return;
    bubble.innerHTML = `${renderMarkdown(acumulado)}<span class="caret"></span>`;
    $('#tutor-chat').scrollTop = $('#tutor-chat').scrollHeight;
  };

  const pintarDebounced = debounce(pintar, 55);

  try {
    await api.tutorStream(
      {
        question: pergunta,
        mode: state.tutor.mode,
        level: state.tutor.level,
        code: state.review.code?.slice(0, 8000) || '',
      },
      {
        onDelta(texto) {
          acumulado += texto;
          if (primeiro) {
            primeiro = false;
            pintar();
          } else {
            pintarDebounced();
          }
        },

        onMeta(meta) {
          finalizado = true;
          bubble.innerHTML = renderMarkdown(acumulado);

          const rodape = el('div.msg__meta', {}, [
            meta.concept && el('span.chip.chip--accent', {}, [icon('cap'), meta.concept.title]),
            el('span.chip', {}, [
              icon(meta.engine === 'ia' ? 'sparkle' : 'book'),
              meta.engine === 'ia' ? 'resposta por IA' : 'base local',
            ]),
            el('button.copy-btn', { type: 'button', dataset: { copyText: acumulado } }, [
              icon('copy'),
              el('span', { text: 'copiar' }),
            ]),
          ]);
          bubble.append(rodape);

          if (meta.related?.length) {
            bubble.append(
              el(
                'div.suggestions',
                { style: { justifyContent: 'flex-start', marginTop: '10px' } },
                meta.related.map((rel) =>
                  el('button.chip', { dataset: { ask: `Me explique ${rel.title}` } }, [
                    icon('arrow-right'),
                    rel.title,
                  ]),
                ),
              ),
            );
          }

          renderProgresso(meta.progresso, meta.recompensa);
        },

        onError(erro) {
          bubble.innerHTML = `<p>Nao consegui responder: ${erro.message}</p>`;
        },
      },
    );

    if (!acumulado) {
      finalizado = true;
      bubble.innerHTML = '<p>Nao recebi resposta. Tente reformular a pergunta.</p>';
    }
    await recarregarSessao();
  } catch (erro) {
    finalizado = true;
    bubble.innerHTML = `<p>Erro ao falar com o servidor: ${erro.message}</p>`;
    toast('Falha no tutor', erro.message, 'error');
  } finally {
    patch('tutor', { loading: false });
    $('#tutor-send').disabled = false;
    $('#tutor-chat').scrollTop = $('#tutor-chat').scrollHeight;
  }
}

function renderConceitos(conceitos = []) {
  $('#concept-list').replaceChildren(
    ...conceitos.map((conceito) =>
      el('button.concept-item', { type: 'button', dataset: { ask: `Me explique ${conceito.title}` } }, [
        el('div.concept-item__top', {}, [
          el('strong', { text: conceito.title }),
          el('span.level-tag', { dataset: { level: conceito.level }, text: conceito.level }),
        ]),
        el('small', { text: conceito.tldr }),
      ]),
    ),
  );

  $('#tutor-suggestions').replaceChildren(
    ...conceitos.slice(0, 6).map((conceito) =>
      el('button.chip.chip--brand', { dataset: { ask: `Me explique ${conceito.title}` } }, [
        icon('sparkle'),
        conceito.title,
      ]),
    ),
  );
}

/* ========================================================================
   Exemplos e catalogo
   ===================================================================== */
async function carregarExemplo(id) {
  try {
    progress.start();
    const { data } = await api.sample(id);

    if (data.tipo === 'review') {
      irPara('review');
      $('#lang-select').value = data.linguagem;
      editor.setValue(data.codigo);
      atualizarLinguagem(data.linguagem);
      toast('Exemplo carregado', `${data.titulo} — clique em Analisar.`, 'info');
    } else {
      irPara('debug');
      $('#error-input').value = data.erro || '';
      $('#debug-code-input').value = data.codigo || '';
      if (data.codigo) $('#debug-code-disclosure').open = true;
      toast('Exemplo carregado', `${data.titulo} — clique em Diagnosticar.`, 'info');
    }
  } catch (erro) {
    toast('Falha ao carregar exemplo', erro.message, 'error');
  } finally {
    progress.stop();
  }
}

function renderExemplos(exemplos = []) {
  const criar = (exemplo) =>
    el('button.sample-btn', { type: 'button', dataset: { sample: exemplo.id }, title: exemplo.descricao }, [
      icon(exemplo.tipo === 'debug' ? 'bug' : 'play'),
      exemplo.titulo,
    ]);

  $('#samples-review').replaceChildren(
    ...exemplos.filter((e) => e.tipo === 'review').map(criar),
  );
  $('#samples-debug').replaceChildren(
    ...exemplos.filter((e) => e.tipo === 'debug').map(criar),
  );
}

const CAT_LABEL = {
  security: 'Seguranca',
  bug: 'Bug provavel',
  performance: 'Performance',
  maintainability: 'Manutenibilidade',
  'best-practice': 'Boas praticas',
  style: 'Estilo',
};

function renderCatalogo(catalogo) {
  $('#rule-count').textContent = catalogo.total;

  $('#empty-chips').replaceChildren(
    ...Object.entries(catalogo.byCategory).map(([cat, n]) =>
      el('span.chip', {}, [`${CAT_LABEL[cat] || cat} `, el('b', { text: String(n) })]),
    ),
  );

  $('#catalog-stats').replaceChildren(
    el('div.metric', { style: { '--i': 0 } }, [
      el('span.metric__label', { text: 'Regras' }),
      el('span.metric__value', { text: String(catalogo.total) }),
      el('span.metric__hint', { text: 'no motor local' }),
    ]),
    ...Object.entries(catalogo.byCategory).map(([cat, n], i) =>
      el('div.metric', { style: { '--i': i + 1 } }, [
        el('span.metric__label', { text: CAT_LABEL[cat] || cat }),
        el('span.metric__value', { text: String(n) }),
        el('span.metric__hint', { text: 'regras' }),
      ]),
    ),
  );

  $('#catalog-list').replaceChildren(
    ...catalogo.rules.map((regra) =>
      el(
        'div.rule-row',
        { dataset: { busca: `${regra.id} ${regra.title} ${regra.concept || ''} ${regra.category}`.toLowerCase() } },
        [
          el('span.rule-row__sev', { dataset: { sev: regra.severity } }),
          el('div.rule-row__body', {}, [
            el('strong', { text: regra.title }),
            el('small', { text: regra.id }),
          ]),
          el('div.rule-row__tags', {}, [
            el('span.chip', { text: CAT_LABEL[regra.category] || regra.category }),
            regra.concept && el('span.chip.chip--accent', { text: regra.concept }),
            el('span.chip', {
              text: regra.languages[0] === '*' ? 'todas as linguagens' : regra.languages.join(', '),
            }),
          ]),
        ],
      ),
    ),
  );
}

/* ========================================================================
   Paleta de comandos
   ===================================================================== */
let paletaItens = [];
let paletaSelecao = 0;

function construirPaleta() {
  const itens = [
    { grupo: 'Navegacao', icone: 'scan', titulo: 'Code Review', sub: 'Revisar um trecho de codigo', acao: () => irPara('review') },
    { grupo: 'Navegacao', icone: 'bug', titulo: 'Resolver bug', sub: 'Diagnosticar um erro', acao: () => irPara('debug') },
    { grupo: 'Navegacao', icone: 'cap', titulo: 'Tutor', sub: 'Perguntar sobre um conceito', acao: () => irPara('tutor') },
    { grupo: 'Navegacao', icone: 'chat', titulo: 'Chatbots (demo)', sub: 'Protótipos de front-end', acao: () => irPara('chatbots') },
    { grupo: 'Navegacao', icone: 'book', titulo: 'Catalogo de regras', sub: 'Ver todas as regras do motor', acao: () => irPara('catalog') },

    { grupo: 'Acoes', icone: 'sparkle', titulo: 'Analisar o codigo atual', sub: 'Executa a revisao', acao: () => { irPara('review'); analisar(); } },
    { grupo: 'Acoes', icone: 'trash', titulo: 'Limpar o editor', sub: 'Remove o codigo colado', acao: () => editor.setValue('') },
    { grupo: 'Acoes', icone: 'sun', titulo: 'Alternar tema', sub: 'Claro ou escuro', acao: () => toggleTheme() },
    { grupo: 'Acoes', icone: 'trash', titulo: 'Limpar historico', sub: 'Apaga a sessao em memoria', acao: limparHistorico },
  ];

  for (const exemplo of state.meta?.exemplos || []) {
    itens.push({
      grupo: 'Exemplos',
      icone: exemplo.tipo === 'debug' ? 'bug' : 'play',
      titulo: exemplo.titulo,
      sub: exemplo.descricao,
      acao: () => carregarExemplo(exemplo.id),
    });
  }

  for (const conceito of state.meta?.conceitos || []) {
    itens.push({
      grupo: 'Conceitos',
      icone: 'cap',
      titulo: conceito.title,
      sub: conceito.tldr,
      acao: () => {
        irPara('tutor');
        $('#tutor-input').value = `Me explique ${conceito.title}`;
        enviarPergunta();
      },
    });
  }

  for (const bot of Object.values(BOTS)) {
    itens.push({
      grupo: 'Chatbots',
      icone: 'chat',
      titulo: bot.name,
      sub: bot.descricao.slice(0, 90),
      acao: () => {
        irPara('chatbots');
        trocarBot(bot.id);
      },
    });
  }

  paletaItens = itens;
}

function renderPaleta(filtro = '') {
  const termo = filtro
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

  const visiveis = termo
    ? paletaItens.filter((item) =>
        `${item.titulo} ${item.sub} ${item.grupo}`
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .includes(termo),
      )
    : paletaItens;

  const host = $('#palette-results');
  paletaSelecao = 0;

  if (!visiveis.length) {
    host.replaceChildren(el('p.palette__empty', { text: 'Nada encontrado.' }));
    return;
  }

  const frag = document.createDocumentFragment();
  let grupoAtual = null;

  visiveis.forEach((item, indice) => {
    if (item.grupo !== grupoAtual) {
      grupoAtual = item.grupo;
      frag.append(el('div.palette-group', { text: grupoAtual }));
    }

    frag.append(
      el(
        'button.palette-item',
        {
          type: 'button',
          class: indice === 0 ? 'is-sel' : '',
          dataset: { indice: String(indice) },
          on: { click: () => { fecharPaleta(); item.acao(); } },
        },
        [
          el('span.palette-item__ico', {}, icon(item.icone)),
          el('span.palette-item__body', {}, [
            el('strong', { text: item.titulo }),
            el('small', { text: item.sub }),
          ]),
          el('span.palette-item__arrow', {}, icon('arrow-right')),
        ],
      ),
    );
  });

  host.replaceChildren(frag);
  host.dataset.total = String(visiveis.length);
}

function abrirPaleta() {
  construirPaleta();
  $('#palette').hidden = false;
  $('#palette-input').value = '';
  renderPaleta('');
  setTimeout(() => $('#palette-input').focus(), 30);
}

function fecharPaleta() {
  $('#palette').hidden = true;
}

function moverSelecaoPaleta(delta) {
  const itens = $$('.palette-item');
  if (!itens.length) return;

  paletaSelecao = (paletaSelecao + delta + itens.length) % itens.length;
  itens.forEach((node, i) => node.classList.toggle('is-sel', i === paletaSelecao));
  itens[paletaSelecao].scrollIntoView({ block: 'nearest' });
}

/* ========================================================================
   Chatbots
   ===================================================================== */
function trocarBot(id) {
  const script = BOTS[id];
  if (!script) return;

  state.chatbot = id;

  for (const botao of $$('#bot-switch button')) {
    botao.classList.toggle('is-active', botao.dataset.bot === id);
  }
  moveThumb($('#bot-switch'));

  renderBlueprint(script, script.start);
  chatSim.load(script);
}

/* ========================================================================
   Historico
   ===================================================================== */
async function limparHistorico() {
  try {
    const { data } = await api.clearHistory();
    renderHistorico(data.historico);
    toast('Historico limpo', '', 'success');
  } catch (erro) {
    toast('Falha ao limpar', erro.message, 'error');
  }
}

/* ========================================================================
   Bootstrap
   ===================================================================== */
function montarEditor() {
  editor = createEditor({
    root: $('#editor'),
    textarea: $('#code-input'),
    highlightNode: $('#editor-highlight'),
    gutter: $('#gutter'),
    marks: $('#editor-marks'),
    counter: $('#code-counter'),
    getLanguage: () => {
      const escolhida = $('#lang-select').value;
      return escolhida !== 'auto' ? escolhida : state.review.result?.language.id || 'javascript';
    },
    onChange: (codigo) => patch('review', { code: codigo }),
  });
}

function ligarEventos() {
  /* navegacao */
  for (const item of $$('.nav__item')) {
    item.addEventListener('click', () => irPara(item.dataset.nav));
  }
  $('.brand').addEventListener('click', (ev) => {
    ev.preventDefault();
    irPara('review');
  });

  $('#sidebar-open').addEventListener('click', () => document.body.classList.add('menu-open'));
  $('#sidebar-close').addEventListener('click', () => document.body.classList.remove('menu-open'));
  $('#sidebar-backdrop').addEventListener('click', () => document.body.classList.remove('menu-open'));

  /* tema */
  $('#theme-toggle').addEventListener('click', () => {
    toggleTheme();
    afterPaint(() => {
      moveThumb($('#tutor-mode'));
      moveThumb($('#bot-switch'));
    });
  });

  /* review */
  $('#btn-analyze').addEventListener('click', analisar);
  $('#btn-clear-code').addEventListener('click', () => {
    editor.setValue('');
    $('#review-result').hidden = true;
    $('#review-empty').hidden = false;
    patch('review', { result: null });
  });

  $('#btn-upload').addEventListener('click', () => $('#file-input').click());
  $('#file-input').addEventListener('change', async (ev) => {
    const arquivo = ev.target.files?.[0];
    if (!arquivo) return;

    const nome = await editor.carregarArquivo(arquivo);
    if (nome) {
      const ext = nome.split('.').pop();
      const opcao = [...$('#lang-select').options].find((o) => o.value.startsWith(ext));
      if (opcao) $('#lang-select').value = opcao.value;
    }
    ev.target.value = '';
  });

  $('#lang-select').addEventListener('change', () => {
    editor.refresh();
    atualizarLinguagem($('#lang-select').selectedOptions[0].textContent);
  });

  /* debug */
  $('#btn-diagnose').addEventListener('click', diagnosticar);
  $('#btn-clear-error').addEventListener('click', () => {
    $('#error-input').value = '';
    $('#debug-code-input').value = '';
    $('#debug-result').hidden = true;
    $('#debug-empty').hidden = false;
  });

  /* exemplos (delegacao) */
  document.addEventListener('click', (ev) => {
    const amostra = ev.target.closest('[data-sample]');
    if (amostra) carregarExemplo(amostra.dataset.sample);

    const historico = ev.target.closest('.history-item');
    if (historico) abrirHistorico(historico.dataset.id);

    const pergunta = ev.target.closest('[data-ask]');
    if (pergunta) {
      irPara('tutor');
      $('#tutor-input').value = pergunta.dataset.ask;
      enviarPergunta();
    }
  });

  $('#clear-history').addEventListener('click', limparHistorico);

  /* tutor */
  const tutorInput = $('#tutor-input');
  tutorInput.addEventListener('input', () => {
    tutorInput.style.height = 'auto';
    tutorInput.style.height = `${Math.min(180, tutorInput.scrollHeight)}px`;
  });

  tutorInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      enviarPergunta();
    }
  });

  $('#tutor-send').addEventListener('click', enviarPergunta);

  $('#tutor-mode').addEventListener('click', (ev) => {
    const botao = ev.target.closest('button[data-mode]');
    if (!botao) return;

    for (const b of $$('#tutor-mode button')) b.classList.toggle('is-active', b === botao);
    moveThumb($('#tutor-mode'));
    patch('tutor', { mode: botao.dataset.mode });
    toast('Modo alterado', state.meta?.modosTutor?.find((m) => m.id === botao.dataset.mode)?.descricao || '', 'info', 2600);
  });

  $('#tutor-level').addEventListener('change', (ev) => patch('tutor', { level: ev.target.value }));

  /* copiar resposta do tutor */
  $('#tutor-chat').addEventListener('click', async (ev) => {
    const botao = ev.target.closest('[data-copy-text], [data-copy]');
    if (!botao) return;

    const texto =
      botao.dataset.copyText ?? botao.closest('.code-block')?.querySelector('pre')?.textContent ?? '';

    if (await copyText(texto)) {
      botao.classList.add('is-done');
      const label = botao.querySelector('span');
      if (label) label.textContent = 'copiado';
      setTimeout(() => {
        botao.classList.remove('is-done');
        if (label) label.textContent = 'copiar';
      }, 1800);
    }
  });

  /* chatbots */
  $('#bot-switch').addEventListener('click', (ev) => {
    const botao = ev.target.closest('button[data-bot]');
    if (botao) trocarBot(botao.dataset.bot);
  });

  $('#bot-restart').addEventListener('click', () => {
    chatSim.restart();
    toast('Conversa reiniciada', '', 'info', 2000);
  });

  $('#bp-flow').addEventListener('click', (ev) => {
    const node = ev.target.closest('.bp-node');
    if (!node) return;
    // Pular direto para um estado ajuda a inspecionar o fluxo.
    chatSim.goTo?.(node.dataset.state);
  });

  /* catalogo */
  $('#catalog-search').addEventListener(
    'input',
    debounce((ev) => {
      const termo = ev.target.value.toLowerCase().trim();
      for (const linha of $$('.rule-row')) {
        linha.classList.toggle('is-hidden', Boolean(termo) && !linha.dataset.busca.includes(termo));
      }
    }, 120),
  );

  /* paleta */
  $('#open-palette').addEventListener('click', abrirPaleta);
  $('[data-close-palette]').addEventListener('click', fecharPaleta);
  $('#palette-input').addEventListener('input', (ev) => renderPaleta(ev.target.value));

  $('#palette-input').addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      moverSelecaoPaleta(1);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      moverSelecaoPaleta(-1);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      $$('.palette-item')[paletaSelecao]?.click();
    }
  });

  /* atalhos globais */
  document.addEventListener('keydown', (ev) => {
    const digitando = ['INPUT', 'TEXTAREA'].includes(ev.target.tagName);

    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      $('#palette').hidden ? abrirPaleta() : fecharPaleta();
      return;
    }

    if (ev.key === 'Escape') {
      fecharPaleta();
      document.body.classList.remove('menu-open');
      return;
    }

    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
      ev.preventDefault();
      if (state.view === 'review') analisar();
      else if (state.view === 'debug') diagnosticar();
      else if (state.view === 'tutor') enviarPergunta();
      return;
    }

    if (digitando || ev.ctrlKey || ev.metaKey || ev.altKey) return;

    const atalhos = { 1: 'review', 2: 'debug', 3: 'tutor', 4: 'chatbots', 5: 'catalog' };
    if (atalhos[ev.key]) {
      ev.preventDefault();
      irPara(atalhos[ev.key]);
    }
  });

  /* responsivo */
  window.addEventListener(
    'resize',
    debounce(() => {
      const ativo = $('.nav__item.is-active');
      moveIndicator($('#nav-indicator'), ativo);
      moveThumb($('#tutor-mode'));
      moveThumb($('#bot-switch'));
    }, 140),
  );

  window.addEventListener('hashchange', () => {
    const view = location.hash.slice(1);
    if (VIEWS[view] && view !== state.view) irPara(view);
  });
}

async function carregarMeta() {
  try {
    const [{ data: meta }, saude] = await Promise.all([api.meta(), api.health().catch(() => null)]);
    state.meta = meta;

    /* linguagens */
    const select = $('#lang-select');
    for (const lang of meta.linguagens) {
      select.append(el('option', { value: lang.id, text: lang.label }));
    }

    renderExemplos(meta.exemplos);
    renderConceitos(meta.conceitos);
    renderCatalogo(meta.catalogo);

    /* status do motor */
    const pill = $('#engine-pill');
    if (meta.iaAtiva) {
      pill.classList.add('is-ai');
      $('#engine-label').textContent = `IA ativa · ${saude?.engine?.modelo || 'claude'}`;
      pill.title = 'Motor local + analise complementar por IA';
    } else {
      $('#engine-label').textContent = 'motor local';
      pill.title = 'Defina ANTHROPIC_API_KEY no .env para ativar a analise por IA';
    }

    state.engine = saude?.engine || state.engine;
  } catch (erro) {
    toast('Servidor indisponivel', erro.message, 'error', 8000);
  }
}

function montarChatbots() {
  chatSim = createChatSim({
    feed: $('#bot-feed'),
    replies: $('#bot-replies'),
    input: $('#bot-input'),
    sendBtn: $('#bot-send'),
    head: $('#bot-head'),
    screen: $('.phone__screen'),
    onStateChange: highlightBlueprintState,
  });

  trocarBot('servicos');
}

async function iniciar() {
  initTheme();
  initRipple();
  initSpotlight();

  montarEditor();
  montarChatbots();
  ligarEventos();

  initMagnetic();
  initReveal();

  const inicial = location.hash.slice(1);
  irPara(VIEWS[inicial] ? inicial : 'review');

  await carregarMeta();
  await recarregarSessao();

  afterPaint(() => {
    moveIndicator($('#nav-indicator'), $('.nav__item.is-active'));
    moveThumb($('#tutor-mode'));
    moveThumb($('#bot-switch'));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar);
} else {
  iniciar();
}
