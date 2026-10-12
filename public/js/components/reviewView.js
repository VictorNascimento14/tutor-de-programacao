/** Renderizacao do resultado do code review. */
import { $, el, icon, escapeHtml, copyText, mount, afterPaint } from '../lib/dom.js';
import { highlight, codeBlockHtml } from '../lib/highlight.js';
import { countTo, toast } from '../lib/motion.js';

const SEV_META = {
  critical: { label: 'Critico', icon: 'shield', color: 'var(--critical)' },
  high: { label: 'Alto', icon: 'bug', color: 'var(--high)' },
  medium: { label: 'Medio', icon: 'info', color: 'var(--medium)' },
  low: { label: 'Baixo', icon: 'brush', color: 'var(--low)' },
  info: { label: 'Info', icon: 'info', color: 'var(--info)' },
};

const CAT_META = {
  security: { label: 'Seguranca', icon: 'shield' },
  bug: { label: 'Bug provavel', icon: 'bug' },
  performance: { label: 'Performance', icon: 'zap' },
  maintainability: { label: 'Manutenibilidade', icon: 'layers' },
  'best-practice': { label: 'Boas praticas', icon: 'check' },
  style: { label: 'Estilo', icon: 'brush' },
};

const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

const corDoScore = (score) =>
  score >= 85 ? 'var(--success)' : score >= 65 ? 'var(--low)' : score >= 45 ? 'var(--medium)' : 'var(--critical)';

/* ------------------------------------------------------------- metricas -- */
function tomMetrica(chave, valor) {
  const regras = {
    maintainability: valor >= 70 ? 'good' : valor >= 45 ? 'warn' : 'bad',
    maxNesting: valor <= 3 ? 'good' : valor <= 5 ? 'warn' : 'bad',
    avgComplexity: valor <= 6 ? 'good' : valor <= 12 ? 'warn' : 'bad',
  };
  return regras[chave] || null;
}

function renderMetrics(host, metrics) {
  const itens = [
    { label: 'Linhas', value: metrics.lines, hint: `${metrics.sloc} efetivas` },
    { label: 'Funcoes', value: metrics.functions, hint: metrics.longestFunction ? `maior: ${metrics.longestFunction.length}L` : '—' },
    { label: 'Complexidade', value: metrics.avgComplexity, hint: 'media por funcao', key: 'avgComplexity' },
    { label: 'Aninhamento', value: metrics.maxNesting, hint: 'niveis maximos', key: 'maxNesting' },
    { label: 'Manutenibilidade', value: metrics.maintainability, hint: 'de 0 a 100', key: 'maintainability' },
    { label: 'Comentarios', value: `${metrics.commentRatio}%`, hint: `${metrics.comments} linhas` },
  ];

  host.replaceChildren(
    ...itens.map((item, i) =>
      el(
        'div.metric',
        {
          style: { '--i': i },
          dataset: item.key ? { tone: tomMetrica(item.key, Number(item.value)) || '' } : {},
        },
        [
          el('span.metric__label', { text: item.label }),
          el('span.metric__value', { text: String(item.value) }),
          el('span.metric__hint', { text: item.hint }),
        ],
      ),
    ),
  );
}

/* ------------------------------------------------------------- achados --- */
function renderSnippet(snippet) {
  if (!snippet?.code) return null;

  const linhas = snippet.code.split('\n');
  const pre = el('pre.snippet');

  linhas.forEach((linha, i) => {
    const numero = snippet.startLine + i;
    pre.append(
      el(
        'div.snippet__line',
        { class: numero === snippet.focusLine ? 'is-focus' : '' },
        [
          el('span.snippet__no', { text: String(numero) }),
          el('span.snippet__code', { html: highlight(linha, snippet.language || 'javascript') || ' ' }),
        ],
      ),
    );
  });

  return pre;
}

function renderDiff(fix) {
  if (!fix) return null;

  const lado = (tipo, titulo, codigo, cor) =>
    el(`div.diff__side.diff__side--${tipo}`, {}, [
      el('div.diff__label', {}, [icon(cor), titulo]),
      el('pre', { html: highlight(codigo, 'javascript') }),
    ]);

  return el('div.diff', {}, [
    fix.before && lado('before', 'Evite', fix.before, 'x'),
    fix.after && lado('after', 'Prefira', fix.after, 'check'),
  ]);
}

function renderFinding(finding, index, { onFocusLine }) {
  const sev = SEV_META[finding.severity] || SEV_META.info;
  const cat = CAT_META[finding.category] || { label: finding.category, icon: 'layers' };

  const inner = el('div.finding__inner', {}, [
    el('div.finding__meta', {}, [
      el('span.chip', {}, [icon(cat.icon), cat.label]),
      el('span.chip', { text: finding.ruleId }),
      finding.concept && el('span.chip.chip--accent', {}, [icon('cap'), finding.concept]),
      finding.origem === 'ia' && el('span.chip.chip--brand', {}, [icon('sparkle'), 'IA']),
    ]),

    renderSnippet({ ...finding.snippet, language: finding.language }),

    finding.why &&
      el('div.finding__block', {}, [
        el('h5', {}, [icon('info'), 'Por que isso importa']),
        el('p', { text: finding.why }),
      ]),

    finding.how &&
      el('div.finding__block', {}, [
        el('h5', {}, [icon('check'), 'Como resolver']),
        el('p', { text: finding.how }),
      ]),

    finding.fix &&
      el('div.finding__block', {}, [el('h5', {}, [icon('git'), 'Antes e depois']), renderDiff(finding.fix)]),
  ]);

  const head = el('button.finding__head', { type: 'button' }, [
    el('span.finding__sev', { title: sev.label }, icon(sev.icon)),
    el('span.finding__title', {}, [
      el('strong', { text: finding.title }),
      el('small', { text: finding.message }),
    ]),
    el('span.finding__line', {
      text: `L${finding.line}`,
      title: `Ir para a linha ${finding.line}`,
      role: 'button',
    }),
    el('span.finding__chevron', {}, icon('chevron')),
  ]);

  const node = el(
    'div.finding',
    {
      dataset: { sev: finding.severity, cat: finding.category, id: finding.id },
      style: { '--i': index },
    },
    [head, el('div.finding__wrap', {}, el('div.finding__body', {}, inner))],
  );

  head.addEventListener('click', (ev) => {
    // Clique no numero da linha nao abre o acordeao: so navega.
    if (ev.target.closest('.finding__line')) {
      onFocusLine?.(finding.line);
      return;
    }
    node.classList.toggle('is-open');
    if (node.classList.contains('is-open')) onFocusLine?.(finding.line);
  });

  return node;
}

/* -------------------------------------------------------------- filtros -- */
function renderFilters(host, result, aplicar) {
  const porCategoria = result.summary.byCategory || {};
  const total = result.findings.length;

  const chips = [
    el('button.filter-chip.is-on', { dataset: { filter: 'all' } }, [
      icon('layers'),
      'Tudo ',
      el('b', { text: String(total) }),
    ]),
    ...SEV_ORDER.filter((sev) => result.summary.bySeverity[sev] > 0).map((sev) =>
      el('button.filter-chip', { dataset: { filter: `sev:${sev}` } }, [
        icon(SEV_META[sev].icon),
        SEV_META[sev].label,
        ' ',
        el('b', { text: String(result.summary.bySeverity[sev]) }),
      ]),
    ),
    ...Object.entries(porCategoria).map(([cat, n]) =>
      el('button.filter-chip', { dataset: { filter: `cat:${cat}` } }, [
        icon(CAT_META[cat]?.icon || 'layers'),
        CAT_META[cat]?.label || cat,
        ' ',
        el('b', { text: String(n) }),
      ]),
    ),
  ];

  host.replaceChildren(...chips);

  host.addEventListener('click', (ev) => {
    const chip = ev.target.closest('.filter-chip');
    if (!chip) return;
    for (const c of host.children) c.classList.toggle('is-on', c === chip);
    aplicar(chip.dataset.filter);
  });
}

/* ---------------------------------------------------------------- plano -- */
function renderPlan(host, result) {
  const { tutor } = result;
  if (!tutor?.nextSteps?.length && !tutor?.observations?.length) {
    host.replaceChildren();
    return;
  }

  const passos = tutor.nextSteps.map((passo, i) => {
    const node = el('div.plan__step', { style: { '--i': i } }, [
      el('span.plan__step-no', { text: String(passo.order) }),
      el('div.plan__step-text', {}, [
        el('strong', { text: `${passo.title} (linha ${passo.line})` }),
        el('small', { text: passo.action }),
      ]),
    ]);

    node.addEventListener('click', () => node.classList.toggle('is-done'));
    return node;
  });

  mount(
    host,
    el('h4', {}, [icon('target'), 'Plano de acao priorizado']),
    el('div.plan__steps', {}, passos),

    tutor.observations?.length > 0 &&
      el('ul.observations', {}, tutor.observations.map((obs) => el('li', { text: obs }))),

    tutor.concepts?.length > 0 &&
      el(
        'div.plan__concepts',
        {},
        tutor.concepts.map((c) =>
          el('button.chip.chip--accent', { dataset: { concept: c } }, [icon('cap'), c]),
        ),
      ),
  );
}

/* ----------------------------------------------------------- bloco JEV -- */
function renderJev(result) {
  if (!result.jev?.answers) return null;

  const answers = result.jev.answers;
  const entries = Object.entries(answers);
  if (!entries.length) return null;

  const rotulos = {
    securityVerdict: 'Veredito de Seguranca',
    actionPriority: 'Prioridade de Acao',
    productionReady: 'Pronto para Producao',
  };

  const cores = {
    critical: 'var(--critical)',
    warning: 'var(--medium)',
    clean: 'var(--success)',
    immediate_security_fix: 'var(--critical)',
    bug_fix: 'var(--high)',
    refactor: 'var(--medium)',
    approve: 'var(--success)',
    ready: 'var(--success)',
    needs_changes: 'var(--critical)',
  };

  const cards = entries.map(([chave, ans]) => {
    const cor = cores[ans.choice] || 'var(--accent)';
    const conf = Math.round((ans.confidence || 1) * 100);

    return el('div.jev-card', {}, [
      el('span.jev-card__label', { text: rotulos[chave] || chave }),
      el('strong.jev-card__choice', { text: ans.choice, style: { color: cor } }),
      el('span.jev-card__conf', { text: `${conf}% confianca` }),
    ]);
  });

  return el('div.jev-block', {}, [
    el('div.jev-block__head', {}, [
      el('div.jev-block__title', {}, [
        el('span.jev-icon', { text: '⚡' }),
        el('h4', { text: 'Decisao Estruturada JEV' }),
        el('span.chip.chip--accent', { text: 'typesafe/jev-1.13' }),
      ]),
      el('small.jev-block__meta', {
        text: `${result.jev.latencyMs ? `${result.jev.latencyMs}ms · ` : ''}Modo Hibrido (JEV + DeepSeek v4.1)`,
      }),
    ]),
    el('div.jev-cards', {}, cards),
  ]);
}

/* ------------------------------------------------------------- bloco IA -- */
function renderAi(result) {
  if (!result.ia) return null;

  return el('div.ai-block', {}, [
    el('h4', {}, [icon('sparkle'), `Analise complementar por IA (${result.ia.modelo || 'DeepSeek'})`]),
    result.ia.resumo && el('p', { text: result.ia.resumo }),

    result.ia.pontosFortes?.length > 0 &&
      el('div', {}, [
        el('h4', { text: 'Pontos fortes', style: { marginTop: '12px' } }),
        el('ul', {}, result.ia.pontosFortes.map((p) => el('li', { text: p }))),
      ]),

    result.ia.proximosPassos?.length > 0 &&
      el('div', {}, [
        el('h4', { text: 'Sugestoes', style: { marginTop: '12px' } }),
        el('ul', {}, result.ia.proximosPassos.map((p) => el('li', { text: p }))),
      ]),
  ]);
}



/* ============================================================== publico == */

/** Mostra o estado de carregando (esqueleto). */
export function renderReviewLoading() {
  const host = $('#review-result');
  const vazio = $('#review-empty');
  vazio.hidden = true;
  host.hidden = false;

  host.replaceChildren(
    el('div.score-row', {}, [
      el('div.skeleton', { style: { width: '108px', height: '108px', borderRadius: '50%', flex: 'none' } }),
      el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '8px' } }, [
        el('div.skeleton', { style: { width: '45%', height: '18px' } }),
        el('div.skeleton', { style: { width: '100%', height: '13px' } }),
        el('div.skeleton', { style: { width: '85%', height: '13px' } }),
        el('div.skeleton', { style: { width: '60%', height: '22px', marginTop: '6px' } }),
      ]),
    ]),
    el(
      'div.metrics',
      {},
      Array.from({ length: 6 }, () => el('div.skeleton', { style: { height: '62px' } })),
    ),
    el(
      'div.findings',
      {},
      Array.from({ length: 4 }, (_, i) =>
        el('div.skeleton', { style: { height: '52px', opacity: String(1 - i * 0.18) } }),
      ),
    ),
  );
}

/**
 * Renderiza o resultado completo.
 * @param {object} result
 * @param {{ onFocusLine: Function, onConcept: Function }} handlers
 */
export function renderReview(result, handlers = {}) {
  const host = $('#review-result');
  $('#review-empty').hidden = true;
  host.hidden = false;

  const scoreRingWrap = el('div.score-ring-wrap', {}, [
    el('svg.score-ring', { viewBox: '0 0 120 120' }, []),
  ]);

  // O anel e montado via innerHTML por ser SVG com classes especificas.
  scoreRingWrap.innerHTML = `
    <svg class="score-ring" viewBox="0 0 120 120">
      <circle class="score-ring__track" cx="60" cy="60" r="52"></circle>
      <circle class="score-ring__fill" cx="60" cy="60" r="52" id="score-ring-fill"></circle>
    </svg>
    <div class="score-ring__center"><strong id="score-value">0</strong><small>/100</small></div>
    <span class="grade-badge" id="grade-badge">${escapeHtml(result.grade.letter)}</span>`;

  const sevBars = el(
    'div.sev-bars',
    {},
    SEV_ORDER.filter((sev) => result.summary.bySeverity[sev] > 0).map((sev, i) =>
      el('span.sev-bar', { dataset: { sev }, style: { '--i': i } }, [
        icon(SEV_META[sev].icon),
        SEV_META[sev].label,
        ' ',
        el('b', { text: String(result.summary.bySeverity[sev]) }),
      ]),
    ),
  );

  const scoreRow = el('div.score-row', {}, [
    scoreRingWrap,
    el('div.score-info', {}, [
      el('h3', { text: `${result.grade.label} · ${result.language.label}` }),
      el('p', { text: result.tutor.verdict }),
      sevBars,
    ]),
  ]);

  const metricsHost = el('div.metrics');
  const filtersHost = el('div.filters');
  const findingsHost = el('div.findings');
  const planHost = el('div.plan');

  mount(
    host,
    scoreRow,
    metricsHost,
    renderJev(result),
    renderAi(result),
    result.aviso && el('div.chip.chip--brand', { text: result.aviso }),
    result.findings.length ? filtersHost : null,
    findingsHost,
    planHost,
  );

  renderMetrics(metricsHost, result.metrics);

  /* achados: locais + IA */
  const todos = [...result.findings, ...(result.ia?.achados || [])].map((f) => ({
    ...f,
    language: result.language.id,
  }));

  todos.sort(
    (a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity) || a.line - b.line,
  );

  if (todos.length) {
    findingsHost.replaceChildren(
      ...todos.map((f, i) => renderFinding(f, i, { onFocusLine: handlers.onFocusLine })),
    );

    renderFilters(filtersHost, { ...result, findings: todos }, (filtro) => {
      for (const node of findingsHost.children) {
        const [tipo, valor] = filtro.split(':');
        const visivel =
          filtro === 'all' ||
          (tipo === 'sev' && node.dataset.sev === valor) ||
          (tipo === 'cat' && node.dataset.cat === valor);
        node.classList.toggle('is-hidden', !visivel);
      }
    });
  } else {
    findingsHost.replaceChildren(
      el('div.result-empty', { style: { padding: '28px 16px' } }, [
        el('div.result-empty__art', { style: { width: '84px', height: '84px' } }, [
          (() => {
            const svg = el('div');
            svg.innerHTML = `<svg viewBox="0 0 120 120" class="floating">
              <circle cx="60" cy="60" r="44" class="art-ring"></circle>
              <path d="M42 62l12 12 24-26" class="art-code" style="stroke:var(--success)"></path>
            </svg>`;
            return svg.firstElementChild;
          })(),
        ]),
        el('h3', { text: 'Nenhum problema encontrado' }),
        el('p', { text: 'O catalogo de regras nao apontou nada neste trecho. Analise estatica ve a forma do codigo, nao o comportamento: testes continuam necessarios.' }),
      ]),
    );
  }

  renderPlan(planHost, result);

  /* animacoes de entrada */
  afterPaint(() => {
    const anel = $('#score-ring-fill', host);
    const circunferencia = 2 * Math.PI * 52;
    const cor = corDoScore(result.score);

    if (anel) {
      anel.style.stroke = cor;
      anel.style.strokeDasharray = String(circunferencia);
      anel.style.strokeDashoffset = String(circunferencia);
      afterPaint(() => {
        anel.style.strokeDashoffset = String(circunferencia * (1 - result.score / 100));
      });
    }

    const badge = $('#grade-badge', host);
    if (badge) badge.style.background = cor;

    countTo($('#score-value', host), result.score, { duration: 1100 });
  });

  /* conceitos levam ao tutor */
  planHost.addEventListener('click', (ev) => {
    const chip = ev.target.closest('[data-concept]');
    if (chip) handlers.onConcept?.(chip.dataset.concept);
  });

  /* copiar nos blocos de codigo */
  host.addEventListener('click', async (ev) => {
    const botao = ev.target.closest('[data-copy]');
    if (!botao) return;

    const codigo = botao.closest('.code-block')?.querySelector('pre')?.textContent || '';
    if (await copyText(codigo)) {
      botao.classList.add('is-done');
      botao.querySelector('span').textContent = 'copiado';
      setTimeout(() => {
        botao.classList.remove('is-done');
        botao.querySelector('span').textContent = 'copiar';
      }, 1800);
    } else {
      toast('Nao foi possivel copiar', '', 'error');
    }
  });

  return todos;
}

export { codeBlockHtml };
