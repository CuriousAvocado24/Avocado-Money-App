import { esc } from './format.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const ICONS = {
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  paste: '<svg viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  fwd: '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><path d="M18 9l-6 6M12 9l6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
};

/** Bottom sheet. Returns a close() function. */
export function openSheet({ title = '', body = '', onMount, onClose, tall = false }) {
  const root = document.getElementById('sheet-root');
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop"></div>
    <div class="sheet ${tall ? 'tall' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grab"></div>
      ${title ? `<div class="sheet-head"><h2>${esc(title)}</h2><button class="sheet-x" aria-label="Close">✕</button></div>` : ''}
      <div class="sheet-body">${body}</div>
    </div>`;
  root.appendChild(wrap);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 280);
    onClose && onClose();
  };
  wrap.querySelector('.sheet-backdrop').addEventListener('click', close);
  wrap.querySelector('.sheet-x')?.addEventListener('click', close);
  const sheet = wrap.querySelector('.sheet');
  // Swipe down on the grab handle / header to dismiss
  let startY = null;
  sheet.addEventListener('touchstart', (e) => {
    if (sheet.scrollTop <= 0 && e.target.closest('.sheet-grab, .sheet-head')) startY = e.touches[0].clientY;
  }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (startY == null) return;
    const dy = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  sheet.addEventListener('touchend', (e) => {
    if (startY == null) return;
    const dy = e.changedTouches[0].clientY - startY;
    startY = null;
    sheet.style.transform = '';
    if (dy > 90) close();
  });
  onMount && onMount(sheet, close);
  return close;
}

export function confirmSheet({ title, message, confirm = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    openSheet({
      title,
      body: `<p class="text-2" style="margin-bottom:16px">${esc(message)}</p>
        <div class="form"><button class="btn block ${danger ? 'danger' : 'primary'}" data-ok>${esc(confirm)}</button>
        <button class="btn block" data-cancel>Cancel</button></div>`,
      onMount: (s, close) => {
        s.querySelector('[data-ok]').onclick = () => { result = true; close(); };
        s.querySelector('[data-cancel]').onclick = close;
      },
      onClose: () => resolve(result),
    });
  });
}

/** Choose from a list. options: [{value, label, sub}] */
export function pickSheet({ title, options, value }) {
  return new Promise((resolve) => {
    let result = null;
    openSheet({
      title,
      body: `<div class="option-list">${options
        .map((o, i) => `<button class="option" data-i="${i}">${esc(o.label)}${o.value === value ? '<span class="check">✓</span>' : o.sub ? `<span class="sub">${esc(o.sub)}</span>` : ''}</button>`)
        .join('')}</div>`,
      onMount: (s, close) => {
        s.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { result = options[+b.dataset.i].value; close(); }));
      },
      onClose: () => resolve(result),
    });
  });
}

let toastTimer = null;
export function toast(msg, action) {
  const t = document.getElementById('toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) t.querySelector('button').onclick = () => { t.classList.remove('show'); action.run(); };
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), action ? 5000 : 2600);
}

/** Share a file via the iOS share sheet (Save to Files, AirDrop…) or fall back to a download. */
export async function saveFile(name, text, type) {
  const blob = new Blob([text], { type });
  try {
    const file = new File([blob], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

export const isStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Brand-colored confetti burst. */
export function confetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#3F5B1F', '#A8C85A', '#D4DE6E', '#9A4A2C', '#F4D774', '#E9EFC0'];
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = colors[i % colors.length];
    p.style.setProperty('--dx', (Math.random() * 160 - 80).toFixed(0) + 'px');
    p.style.setProperty('--r', (Math.random() * 720 - 360).toFixed(0) + 'deg');
    p.style.animationDelay = (Math.random() * 0.35).toFixed(2) + 's';
    p.style.borderRadius = i % 3 ? '3px' : '50%';
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2400);
}

/** Celebration sheet for big moments (goal planted/harvested, level up, badges). title may contain <em>. */
export function celebrate({ emoji, title, text, small = false }) {
  confetti();
  if (small) { toast(`${emoji} ${title.replace(/<[^>]+>/g, '')}`); return; }
  openSheet({
    body: `<div class="celebrate"><div class="big">${emoji}</div><h2>${title}</h2><p>${esc(text)}</p><button class="btn primary block" data-ok>Nice</button></div>`,
    onMount: (s, close) => (s.querySelector('[data-ok]').onclick = close),
  });
}

let popTimer = null;
/** Little "+10 XP" pill at the top of the screen. */
export function xpPop(text) {
  let el = document.querySelector('.xp-pop');
  if (!el) { el = document.createElement('div'); el.className = 'xp-pop'; el.setAttribute('aria-live', 'polite'); document.body.appendChild(el); }
  el.textContent = text;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(popTimer);
  popTimer = setTimeout(() => el.classList.remove('show'), 1600);
}
