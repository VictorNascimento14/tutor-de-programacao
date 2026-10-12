/**
 * Editor de codigo: textarea transparente sobre um <pre> realcado,
 * com numeracao de linhas, marcadores de achados e drag-and-drop.
 */
import { $, $$, el, debounce, afterPaint } from '../lib/dom.js';
import { highlight } from '../lib/highlight.js';
import { toast } from '../lib/motion.js';

const LINE_HEIGHT = 21; // precisa casar com --code-line em tokens.css
const PADDING_TOP = 13;

export function createEditor({
  root,
  textarea,
  highlightNode,
  gutter,
  marks,
  counter,
  onChange,
  getLanguage,
}) {
  const codeNode = highlightNode.querySelector('code');
  let achados = [];

  /* ------------------------------------------------------------ render -- */
  function renderHighlight() {
    const codigo = textarea.value;
    // A quebra final garante que a ultima linha vazia apareca.
    codeNode.innerHTML = highlight(codigo, getLanguage()) + '\n';
  }

  function renderGutter() {
    const total = Math.max(1, textarea.value.split('\n').length);
    const porLinha = new Map();

    for (const achado of achados) {
      const atual = porLinha.get(achado.line);
      if (!atual || peso(achado.severity) > peso(atual)) porLinha.set(achado.line, achado.severity);
    }

    const frag = document.createDocumentFragment();
    for (let i = 1; i <= total; i += 1) {
      const sev = porLinha.get(i);
      frag.append(
        el('span', {
          text: String(i),
          class: sev ? 'has-issue' : '',
          dataset: sev ? { sev, line: String(i) } : { line: String(i) },
        }),
      );
    }
    gutter.replaceChildren(frag);
  }

  function renderMarks() {
    const frag = document.createDocumentFragment();
    for (const achado of achados) {
      frag.append(
        el('div.editor__mark', {
          dataset: { sev: achado.severity, line: String(achado.line) },
          style: { top: `${PADDING_TOP + (achado.line - 1) * LINE_HEIGHT}px` },
        }),
      );
    }
    marks.replaceChildren(frag);
  }

  function renderCounter() {
    if (!counter) return;
    const linhas = textarea.value ? textarea.value.split('\n').length : 0;
    const chars = textarea.value.length;
    counter.textContent = `${linhas} ${linhas === 1 ? 'linha' : 'linhas'} · ${chars.toLocaleString('pt-BR')} chars`;
  }

  const peso = (sev) => ['info', 'low', 'medium', 'high', 'critical'].indexOf(sev);

  function render() {
    renderHighlight();
    renderGutter();
    renderCounter();
    syncScroll();
  }

  /* ------------------------------------------------------------- scroll */
  function syncScroll() {
    highlightNode.scrollTop = textarea.scrollTop;
    highlightNode.scrollLeft = textarea.scrollLeft;
    gutter.scrollTop = textarea.scrollTop;
    marks.style.transform = `translateY(${-textarea.scrollTop}px)`;
  }

  /* -------------------------------------------------------------- eventos */
  const onInputDebounced = debounce(() => {
    render();
    onChange?.(textarea.value);
  }, 60);

  textarea.addEventListener('input', () => {
    // Realce imediato mantem a sensacao de resposta instantanea.
    renderHighlight();
    renderCounter();
    onInputDebounced();
  });

  textarea.addEventListener('scroll', syncScroll, { passive: true });

  // Tab insere indentacao em vez de mudar o foco.
  textarea.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Tab' || ev.ctrlKey || ev.metaKey) return;
    ev.preventDefault();

    const { selectionStart: inicio, selectionEnd: fim, value } = textarea;

    if (inicio === fim) {
      textarea.value = `${value.slice(0, inicio)}  ${value.slice(fim)}`;
      textarea.selectionStart = textarea.selectionEnd = inicio + 2;
    } else {
      // Indenta/desindenta o bloco selecionado.
      const linhaInicio = value.lastIndexOf('\n', inicio - 1) + 1;
      const bloco = value.slice(linhaInicio, fim);
      const novo = ev.shiftKey
        ? bloco.replace(/^ {1,2}/gm, '')
        : bloco.replace(/^/gm, '  ');

      textarea.value = value.slice(0, linhaInicio) + novo + value.slice(fim);
      textarea.selectionStart = linhaInicio;
      textarea.selectionEnd = linhaInicio + novo.length;
    }

    render();
    onChange?.(textarea.value);
  });

  /* ------------------------------------------------------ drag and drop */
  let dragDepth = 0;

  root.addEventListener('dragenter', (ev) => {
    ev.preventDefault();
    dragDepth += 1;
    root.classList.add('is-dragover');
  });

  root.addEventListener('dragover', (ev) => ev.preventDefault());

  root.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) root.classList.remove('is-dragover');
  });

  root.addEventListener('drop', async (ev) => {
    ev.preventDefault();
    dragDepth = 0;
    root.classList.remove('is-dragover');

    const arquivo = ev.dataTransfer?.files?.[0];
    if (arquivo) await carregarArquivo(arquivo);
  });

  async function carregarArquivo(arquivo) {
    if (arquivo.size > 600_000) {
      toast('Arquivo muito grande', 'O limite para colar aqui e de 600 KB.', 'warn');
      return null;
    }

    const texto = await arquivo.text();
    setValue(texto);
    toast('Arquivo carregado', arquivo.name, 'success');
    return arquivo.name;
  }

  /* ---------------------------------------------------------------- API */
  function setValue(valor) {
    textarea.value = valor ?? '';
    achados = [];
    renderMarks();
    render();
    onChange?.(textarea.value);
    textarea.scrollTop = 0;
    syncScroll();
  }

  function setFindings(lista = []) {
    achados = lista.map(({ line, severity }) => ({ line, severity }));
    renderGutter();
    renderMarks();
    syncScroll();
  }

  /** Rola ate a linha e pisca o marcador. */
  function focusLine(line) {
    const alvo = PADDING_TOP + (line - 1) * LINE_HEIGHT;
    const visivel = textarea.clientHeight;

    textarea.scrollTo({
      top: Math.max(0, alvo - visivel / 2.4),
      behavior: 'smooth',
    });

    // Reposiciona o caret na linha, o que tambem ajuda leitores de tela.
    const linhas = textarea.value.split('\n');
    const offset = linhas.slice(0, line - 1).reduce((soma, l) => soma + l.length + 1, 0);
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(offset, offset + (linhas[line - 1]?.length || 0));

    afterPaint(syncScroll);

    const mark = $(`.editor__mark[data-line="${line}"]`, marks);
    if (mark) {
      mark.classList.remove('is-flash');
      void mark.offsetWidth;
      mark.classList.add('is-flash');
    }

    for (const span of $$('span', gutter)) span.classList.remove('is-focus');
    $(`span[data-line="${line}"]`, gutter)?.classList.add('is-focus');
  }

  render();

  return {
    get value() {
      return textarea.value;
    },
    setValue,
    setFindings,
    focusLine,
    carregarArquivo,
    refresh: render,
  };
}
