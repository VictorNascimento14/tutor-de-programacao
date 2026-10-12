/** Micro-interacoes: ripple, botao magnetico, reveal, contagem, confete, toasts. */
import { $, $$, el, icon, prefersReducedMotion, afterPaint } from './dom.js';

/* ------------------------------------------------------------ ripple ---- */
export function initRipple() {
  document.addEventListener('pointerdown', (ev) => {
    const target = ev.target.closest('.primary-btn, .icon-btn, .quick-reply, .nav__item, .ghost-btn, .chip, .sample-btn');
    if (!target || prefersReducedMotion()) return;

    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = el('span.ripple', {
      style: {
        width: `${size}px`,
        height: `${size}px`,
        left: `${ev.clientX - rect.left - size / 2}px`,
        top: `${ev.clientY - rect.top - size / 2}px`,
      },
    });

    if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
    target.append(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
}

/* ------------------------------------------------- botao magnetico ------ */
export function initMagnetic() {
  if (prefersReducedMotion()) return;

  for (const node of $$('[data-magnetic]')) {
    node.addEventListener('pointermove', (ev) => {
      const rect = node.getBoundingClientRect();
      const dx = (ev.clientX - rect.left - rect.width / 2) / rect.width;
      const dy = (ev.clientY - rect.top - rect.height / 2) / rect.height;
      node.style.transform = `translate(${dx * 5}px, ${dy * 4}px) scale(1.025)`;
    });

    node.addEventListener('pointerleave', () => {
      node.style.transform = '';
    });
  }
}

/* ---------------------------------------------------------- spotlight --- */
export function initSpotlight() {
  const spot = $('#spotlight');
  if (!spot || prefersReducedMotion()) return;

  let raf = null;
  window.addEventListener('pointermove', (ev) => {
    document.body.classList.add('has-pointer');
    if (raf) return;
    raf = requestAnimationFrame(() => {
      spot.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
      raf = null;
    });
  });
}

/* ------------------------------------------------------------ reveal ---- */
export function initReveal(root = document) {
  const nodes = $$('[data-reveal]', root).filter((n) => !n.classList.contains('is-visible'));
  if (!nodes.length) return;

  if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
    nodes.forEach((n) => n.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, index) => {
        if (!entry.isIntersecting) return;
        entry.target.style.setProperty('--reveal-delay', `${index * 70}ms`);
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.06, rootMargin: '0px 0px -40px' },
  );

  nodes.forEach((n) => observer.observe(n));
}

/* ----------------------------------------------- contagem numerica ----- */
export function countTo(node, target, { duration = 900, suffix = '' } = {}) {
  if (!node) return;
  const from = Number(node.textContent.replace(/\D/g, '')) || 0;
  const to = Number(target) || 0;

  if (prefersReducedMotion() || from === to) {
    node.textContent = `${to}${suffix}`;
    return;
  }

  let terminou = false;
  const finalizar = () => {
    if (terminou) return;
    terminou = true;
    node.textContent = `${to}${suffix}`;
  };

  const start = performance.now();
  const step = (now) => {
    if (terminou) return;
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - progress) ** 3;
    node.textContent = `${Math.round(from + (to - from) * eased)}${suffix}`;
    if (progress < 1) requestAnimationFrame(step);
    else terminou = true;
  };

  requestAnimationFrame(step);

  // Rede de seguranca: em aba oculta o rAF nao roda e o numero ficaria parado.
  setTimeout(finalizar, duration + 150);
}

/* -------------------------------------------- indicador de navegacao --- */
export function moveIndicator(indicator, activeItem) {
  if (!indicator || !activeItem) return;
  indicator.style.opacity = '1';
  indicator.style.height = `${activeItem.offsetHeight}px`;
  indicator.style.transform = `translateY(${activeItem.offsetTop}px)`;
}

/** Move o "thumb" de um controle segmentado para o botao ativo. */
export function moveThumb(container) {
  const thumb = $('.segmented__thumb', container);
  const active = $('button.is-active', container);
  if (!thumb || !active) return;
  thumb.style.width = `${active.offsetWidth}px`;
  thumb.style.transform = `translateX(${active.offsetLeft - active.parentElement.offsetLeft}px)`;
}

/* ------------------------------------------------------------ toasts --- */
const ICON_BY_KIND = { success: 'check', error: 'x', warn: 'info', info: 'info' };

export function toast(title, message = '', kind = 'info', ms = 4200) {
  const host = $('#toasts');
  if (!host) return;

  const node = el('div.toast', { dataset: { kind } }, [
    el('span.toast__icon', {}, icon(ICON_BY_KIND[kind] || 'info')),
    el('div.toast__body', {}, [el('strong', { text: title }), message && el('small', { text: message })]),
  ]);

  host.append(node);

  const remove = () => {
    node.classList.add('is-leaving');
    setTimeout(() => node.remove(), 300);
  };

  const timer = setTimeout(remove, ms);
  node.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

/* ------------------------------------------------- barra de progresso -- */
export const progress = {
  start() {
    $('#topprogress')?.classList.add('is-active');
  },
  stop() {
    $('#topprogress')?.classList.remove('is-active');
  },
};

/* ---------------------------------------------------------- confete ---- */
const CORES = ['#7c5cff', '#22d3ee', '#34d399', '#fbbf24', '#ff8a4c', '#ff6b9d'];

export function confetti({ count = 110, duration = 2600 } = {}) {
  const canvas = $('#confetti');
  if (!canvas || prefersReducedMotion()) return;

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);
  canvas.classList.add('is-on');

  const w = window.innerWidth;
  const h = window.innerHeight;

  const particles = Array.from({ length: count }, () => ({
    x: w / 2 + (Math.random() - 0.5) * w * 0.5,
    y: h * 0.42 + (Math.random() - 0.5) * 70,
    vx: (Math.random() - 0.5) * 11,
    vy: Math.random() * -13 - 4,
    size: Math.random() * 6 + 3,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.26,
    color: CORES[(Math.random() * CORES.length) | 0],
    square: Math.random() > 0.4,
  }));

  const inicio = performance.now();

  const frame = (now) => {
    const elapsed = now - inicio;
    ctx.clearRect(0, 0, w, h);

    for (const p of particles) {
      p.vy += 0.3;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - elapsed / duration);
      ctx.fillStyle = p.color;

      if (p.square) ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, w, h);
      canvas.classList.remove('is-on');
    }
  };

  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------- tema ---- */
const TEMA_KEY = 'tutor.tema';

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(TEMA_KEY, theme);
  } catch {
    /* modo privado: segue sem persistir */
  }
}

export function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(TEMA_KEY);
  } catch {
    /* ignora */
  }

  const prefereClaro = window.matchMedia('(prefers-color-scheme: light)').matches;
  applyTheme(saved || (prefereClaro ? 'light' : 'dark'));
}

export function toggleTheme() {
  const atual = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';

  // Transicao circular quando o navegador suporta View Transitions.
  if (document.startViewTransition && !prefersReducedMotion()) {
    document.startViewTransition(() => applyTheme(atual));
    return atual;
  }

  applyTheme(atual);
  return atual;
}
