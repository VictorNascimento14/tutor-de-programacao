/** Helpers minimos de DOM. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * Aplica estilos inline.
 * `Object.assign(node.style, ...)` ignora silenciosamente custom properties
 * (`--i`), entao elas precisam passar por setProperty.
 */
export function setStyle(node, estilos = {}) {
  for (const [chave, valor] of Object.entries(estilos)) {
    if (valor === undefined || valor === null) continue;
    if (chave.startsWith('--')) node.style.setProperty(chave, String(valor));
    else node.style[chave] = valor;
  }
  return node;
}

/**
 * Executa depois do proximo quadro, com rede de seguranca.
 * `requestAnimationFrame` nao dispara em aba oculta ou com o compositor
 * pausado; sem o timeout, animacoes que definem o valor final em rAF ficam
 * presas no estado inicial.
 */
export function afterPaint(fn) {
  let executado = false;
  const rodar = () => {
    if (executado) return;
    executado = true;
    fn();
  };

  // O duplo rAF garante que o estado inicial foi pintado antes da transicao.
  requestAnimationFrame(() => requestAnimationFrame(rodar));
  setTimeout(rodar, 80);
}

/**
 * Cria um elemento.
 * @param {string} tag  'div.classe.outra' ou 'button'
 * @param {object} [props] atributos; `html`, `text`, `dataset`, `style`, `on`
 * @param {Array|Node|string} [children]
 */
export function el(tag, props = {}, children = []) {
  const [name, ...classes] = tag.split('.');
  const node = document.createElement(name || 'div');
  if (classes.length) node.className = classes.join(' ');

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;

    if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'class') node.className = [node.className, value].filter(Boolean).join(' ');
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') setStyle(node, value);
    else if (key === 'on') for (const [evt, fn] of Object.entries(value)) node.addEventListener(evt, fn);
    else node.setAttribute(key, value === true ? '' : value);
  }

  for (const child of [children].flat(3)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return node;
}

/** `<svg class="ico"><use href="#id"/></svg>` */
export function icon(id, cls = 'ico') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', cls);
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${id}`);
  svg.append(use);
  return svg;
}

export const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function clear(node) {
  if (node) node.replaceChildren();
  return node;
}

/**
 * Substitui os filhos ignorando valores vazios.
 * `replaceChildren` nativo converte null/undefined/false em texto, o que faz
 * aparecer "nullundefined" na tela quando se usa `condicao && elemento`.
 */
export function mount(host, ...children) {
  if (!host) return host;
  host.replaceChildren(
    ...children.flat(3).filter((child) => child !== null && child !== undefined && child !== false),
  );
  return host;
}

/** Delegacao de evento por seletor. */
export function on(root, event, selector, handler) {
  root.addEventListener(event, (ev) => {
    const target = ev.target.closest(selector);
    if (target && root.contains(target)) handler(ev, target);
  });
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const fmtMoney = (centavos) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtTime = (date = new Date()) =>
  date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const hora = Math.floor(min / 60);
  if (hora < 24) return `${hora} h`;
  return `${Math.floor(hora / 24)} d`;
}

/** Copia texto para a area de transferencia, com fallback. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand?.('copy');
    area.remove();
    return Boolean(ok);
  }
}

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Debounce simples. */
export function debounce(fn, ms = 180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
