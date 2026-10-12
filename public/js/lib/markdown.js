/**
 * Renderizador Markdown minimo, suficiente para as respostas do tutor.
 * Estrategia: extrai os blocos de codigo primeiro (para nao processar o
 * conteudo deles), escapa o resto, e so entao aplica a formatacao inline.
 */
import { escapeHtml } from './dom.js';
import { codeBlockHtml } from './highlight.js';

const inline = (text) =>
  text
    .replace(/`([^`\n]+)`/g, (_, code) => `<code>${code}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

/**
 * Converte Markdown em HTML.
 * @param {string} source
 * @returns {string}
 */
export function renderMarkdown(source) {
  const text = String(source ?? '').replace(/\r\n/g, '\n');

  // 1. Retira os blocos cercados e guarda placeholders.
  const blocks = [];
  const withoutCode = text.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    blocks.push({ lang: lang || 'javascript', code: code.replace(/\n$/, '') });
    return `\u0000BLOCO${blocks.length - 1}\u0000`;
  });

  // 2. Escapa tudo o que restou.
  const safe = escapeHtml(withoutCode);

  // 3. Processa linha a linha.
  const lines = safe.split('\n');
  const out = [];
  let listType = null;
  let paragraph = [];
  let quote = [];

  const fecharParagrafo = () => {
    if (!paragraph.length) return;
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const fecharLista = () => {
    if (!listType) return;
    out.push(`</${listType}>`);
    listType = null;
  };

  const fecharQuote = () => {
    if (!quote.length) return;
    out.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
    quote = [];
  };

  const fecharTudo = () => {
    fecharParagrafo();
    fecharLista();
    fecharQuote();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // placeholder de bloco de codigo
    const placeholder = line.match(/^\u0000BLOCO(\d+)\u0000$/);
    if (placeholder) {
      fecharTudo();
      const { lang, code } = blocks[Number(placeholder[1])];
      out.push(codeBlockHtml(code, lang));
      continue;
    }

    if (!line.trim()) {
      fecharTudo();
      continue;
    }

    // titulos
    const heading = line.match(/^(#{1,5})\s+(.*)$/);
    if (heading) {
      fecharTudo();
      const level = Math.min(5, heading[1].length + 1);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    // separador
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      fecharTudo();
      out.push('<hr />');
      continue;
    }

    // citacao
    const blockquote = line.match(/^&gt;\s?(.*)$/);
    if (blockquote) {
      fecharParagrafo();
      fecharLista();
      quote.push(blockquote[1]);
      continue;
    }
    fecharQuote();

    // lista nao ordenada
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bullet) {
      fecharParagrafo();
      if (listType !== 'ul') {
        fecharLista();
        out.push('<ul>');
        listType = 'ul';
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }

    // lista ordenada
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (numbered) {
      fecharParagrafo();
      if (listType !== 'ol') {
        fecharLista();
        out.push('<ol>');
        listType = 'ol';
      }
      out.push(`<li>${inline(numbered[1])}</li>`);
      continue;
    }

    fecharLista();
    paragraph.push(line.trim());
  }

  fecharTudo();
  return out.join('\n');
}
