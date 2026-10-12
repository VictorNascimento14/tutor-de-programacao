/** Renderizacao do diagnostico de bugs. */
import { $, el, icon, copyText, mount, afterPaint } from '../lib/dom.js';
import { highlight } from '../lib/highlight.js';
import { toast } from '../lib/motion.js';

const SEV_ICON = { critical: 'shield', high: 'bug', medium: 'info', low: 'brush' };

/* ------------------------------------------------------------- loading -- */
export function renderDebugLoading() {
  const host = $('#debug-result');
  $('#debug-empty').hidden = true;
  host.hidden = false;

  host.replaceChildren(
    el('div.diag-head', {}, [
      el('div.skeleton', { style: { width: '42px', height: '42px', borderRadius: '12px', flex: 'none' } }),
      el('div', { style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '8px' } }, [
        el('div.skeleton', { style: { width: '55%', height: '18px' } }),
        el('div.skeleton', { style: { width: '35%', height: '12px' } }),
        el('div.skeleton', { style: { width: '100%', height: '13px', marginTop: '6px' } }),
        el('div.skeleton', { style: { width: '80%', height: '13px' } }),
      ]),
    ]),
    ...Array.from({ length: 3 }, (_, i) =>
      el('div.skeleton', { style: { height: '70px', opacity: String(1 - i * 0.22) } }),
    ),
  );
}

/* --------------------------------------------------------------- frames -- */
function renderFrames(stack) {
  if (!stack.hasStack) return null;

  const frames = stack.frames.slice(0, 14);

  return el('div.section', {}, [
    el('div.section__title', {}, [icon('layers'), `Stack trace (${stack.frames.length} frames)`]),
    el(
      'div.frames',
      {},
      frames.map((frame, i) => {
        const ehOrigem =
          stack.origin && frame.file === stack.origin.file && frame.line === stack.origin.line;

        return el(
          'div.frame',
          {
            class: [!frame.appCode ? 'is-noise' : '', ehOrigem ? 'is-origin' : ''].filter(Boolean).join(' '),
            style: { '--i': i },
            title: `${frame.file}:${frame.line}`,
          },
          [
            el('span.frame__idx', { text: String(i) }),
            el('span.frame__fn', { text: frame.fn }),
            el('span.frame__file', { text: frame.file }),
            el('span.frame__loc', { text: `:${frame.line}${frame.column ? `:${frame.column}` : ''}` }),
            ehOrigem && el('span.frame__tag', { text: 'origem' }),
          ],
        );
      }),
    ),
    stack.origin &&
      el('p', {
        style: { fontSize: '0.78rem', color: 'var(--text-3)', lineHeight: '1.6' },
        text:
          `Comece a investigar por ${stack.origin.file}:${stack.origin.line} — ` +
          'e o primeiro frame do codigo da aplicacao. Os frames esmaecidos sao de bibliotecas ' +
          'e do runtime, raramente a causa.',
      }),
  ]);
}

/* --------------------------------------------------------------- causas -- */
function renderCauses(causas, titulo = 'Causas provaveis') {
  if (!causas?.length) return null;

  return el('div.section', {}, [
    el('div.section__title', {}, [icon('target'), titulo]),
    ...causas.map((causa, i) => {
      const node = el('div.cause', { style: { '--i': i } }, [
        el('div.cause__top', {}, [
          el('strong', { text: causa.title }),
          el('span.cause__pct', { text: `${causa.percentual ?? Math.round(causa.confidence * 100)}%` }),
        ]),
        el('p.cause__detail', { text: causa.detail }),
        el('div.cause__meter', { style: { '--i': i } }, el('span')),
      ]);

      afterPaint(() => {
        const barra = node.querySelector('.cause__meter span');
        if (barra) barra.style.width = `${causa.percentual ?? Math.round(causa.confidence * 100)}%`;
      });

      return node;
    }),
  ]);
}

/* ------------------------------------------------------------ checklist -- */
function renderChecklist(passos) {
  if (!passos?.length) return null;

  return el('div.section', {}, [
    el('div.section__title', {}, [icon('check'), 'Roteiro de investigacao']),
    el(
      'div.checklist',
      {},
      passos.map((passo, i) => {
        const node = el('button.check-item', { type: 'button', style: { '--i': i } }, [
          el('span.check-item__box', {}, icon('check')),
          el('span.check-item__text', { text: passo }),
        ]);
        node.addEventListener('click', () => node.classList.toggle('is-done'));
        return node;
      }),
    ),
  ]);
}

/* ---------------------------------------------------------------- fixes -- */
function renderFixes(correcoes, linguagem) {
  if (!correcoes?.length) return null;

  return el('div.section', {}, [
    el('div.section__title', {}, [icon('git'), 'Como corrigir']),
    ...correcoes.map((fix, i) => {
      const node = el('div.fix', { style: { '--i': i } }, [
        el('div.fix__head', {}, [
          el('strong', { text: fix.title }),
          el('p', { text: fix.explanation }),
        ]),
      ]);

      if (fix.code) {
        const bloco = el('div.code-block', {}, [
          el('div.code-block__head', {}, [
            el('span.code-block__lang', { text: linguagem || 'codigo' }),
            el('button.copy-btn', { type: 'button', dataset: { copy: '' } }, [
              icon('copy'),
              el('span', { text: 'copiar' }),
            ]),
          ]),
          el('pre', {}, el('code', { html: highlight(fix.code, linguagem || 'javascript') })),
        ]);
        node.append(bloco);
      }

      return node;
    }),
  ]);
}

/* ---------------------------------------------------- achados do codigo -- */
function renderRelacionados(diag, onFocus) {
  if (!diag.relacionados?.length && !diag.analiseCodigo) return null;

  const filhos = [el('div.section__title', {}, [icon('scan'), 'Analise do codigo enviado'])];

  if (diag.analiseCodigo) {
    const { score, grade, totalAchados } = diag.analiseCodigo;
    filhos.push(
      el('div.metrics', {}, [
        el('div.metric', { style: { '--i': 0 } }, [
          el('span.metric__label', { text: 'Nota' }),
          el('span.metric__value', { text: `${score}` }),
          el('span.metric__hint', { text: grade.label }),
        ]),
        el('div.metric', { style: { '--i': 1 } }, [
          el('span.metric__label', { text: 'Achados' }),
          el('span.metric__value', { text: String(totalAchados) }),
          el('span.metric__hint', { text: 'pelo motor local' }),
        ]),
      ]),
    );
  }

  if (diag.relacionados?.length) {
    filhos.push(
      el('p', {
        style: { fontSize: '0.78rem', color: 'var(--text-3)' },
        text: 'Problemas encontrados perto da linha do erro — podem ser a causa:',
      }),
      el(
        'div.findings',
        {},
        diag.relacionados.map((rel, i) => {
          const node = el('div.finding', { dataset: { sev: rel.severity }, style: { '--i': i } }, [
            el('div.finding__head', { style: { cursor: 'pointer' } }, [
              el('span.finding__sev', {}, icon(SEV_ICON[rel.severity] || 'info')),
              el('span.finding__title', {}, [
                el('strong', { text: rel.title }),
                el('small', { text: rel.message }),
              ]),
              el('span.finding__line', { text: `L${rel.line}` }),
            ]),
          ]);
          node.addEventListener('click', () => onFocus?.(rel.line));
          return node;
        }),
      ),
    );
  }

  return el('div.section', {}, filhos);
}

/* ============================================================== publico == */

export function renderDebug(diag, handlers = {}) {
  const host = $('#debug-result');
  $('#debug-empty').hidden = true;
  host.hidden = false;

  const confianca = Math.round(diag.confidence * 100);

  const cabecalho = el('div.diag-head', { dataset: { sev: diag.severity } }, [
    el('div.diag-head__ico', {}, icon(SEV_ICON[diag.severity] || 'bug')),
    el('div.diag-head__body', {}, [
      el('h3', { text: diag.title }),
      el('p.diag-head__type', { text: `${diag.errorType}: ${diag.errorMessage}` }),
      el('p.diag-head__plain', { text: diag.ia?.explicacao || diag.plain }),
      el('div.confidence', {}, [
        el('small', { text: 'confianca' }),
        el('div.confidence__bar', {}, el('span')),
        el('small', { text: `${confianca}%` }),
      ]),
      el('div.finding__meta', { style: { marginTop: '10px' } }, [
        diag.reconhecido
          ? el('span.chip.chip--accent', {}, [icon('check'), 'padrao reconhecido'])
          : el('span.chip', {}, [icon('info'), 'padrao generico']),
        diag.concept && el('button.chip.chip--brand', { dataset: { concept: diag.concept } }, [icon('cap'), diag.concept]),
        diag.engine === 'local+ia' && el('span.chip.chip--brand', {}, [icon('sparkle'), 'com IA']),
      ]),
    ]),
  ]);

  const causas = diag.ia?.causas?.length ? diag.ia.causas : diag.causes;
  const roteiro = diag.ia?.roteiro?.length ? diag.ia.roteiro : diag.checklist;
  const correcoes = diag.ia?.correcoes?.length ? diag.ia.correcoes : diag.fixes;

  mount(
    host,
    cabecalho,

    diag.ia?.causaMaisProvavel &&
      el('div.ai-block', {}, [
        el('h4', {}, [icon('sparkle'), 'Hipotese principal']),
        el('p', { text: diag.ia.causaMaisProvavel }),
      ]),

    diag.aviso && el('div.chip.chip--brand', { text: diag.aviso }),

    renderCauses(causas),
    renderFrames(diag.stack),
    renderChecklist(roteiro),
    renderFixes(correcoes, diag.language),
    renderRelacionados(diag, handlers.onFocusLine),

    (diag.ia?.prevencao || diag.prevention) &&
      el('div.plan', {}, [
        el('h4', {}, [icon('shield'), 'Como evitar no futuro']),
        el('p', {
          style: { fontSize: '0.825rem', color: 'var(--text-2)', lineHeight: '1.68' },
          text: diag.ia?.prevencao || diag.prevention,
        }),
      ]),

    diag.alternativas?.length > 0 &&
      el('div.section', {}, [
        el('div.section__title', {}, [icon('info'), 'Outros padroes parecidos']),
        ...diag.alternativas.map((alt, i) =>
          el('div.cause', { style: { '--i': i } }, [
            el('div.cause__top', {}, [el('strong', { text: alt.title })]),
            el('p.cause__detail', { text: alt.plain }),
          ]),
        ),
      ]),
  );

  afterPaint(() => {
    const barra = host.querySelector('.confidence__bar span');
    if (barra) barra.style.width = `${confianca}%`;
  });

  host.addEventListener('click', async (ev) => {
    const conceito = ev.target.closest('[data-concept]');
    if (conceito) {
      handlers.onConcept?.(conceito.dataset.concept);
      return;
    }

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
}
