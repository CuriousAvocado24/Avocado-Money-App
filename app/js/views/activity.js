// Activity: every expense, searchable and filterable.
import { state } from '../store.js';
import { fmtDay, monthName } from '../dates.js';
import { cat, CATEGORIES, methodEmoji } from '../categories.js';
import { money, moneyRound, esc } from '../format.js';
import { ICONS } from '../ui.js';
import { openExpenseSheet } from '../sheets.js';

let filter = { q: '', category: null, month: null };
let limit = 150;

export function setActivityFilter(f) {
  filter = { q: '', category: null, month: null, ...f };
  limit = 150;
}

export function render(root) {
  const used = new Set(state.expenses.map((e) => e.category));
  const chips = CATEGORIES.filter((c) => used.has(c.id));
  root.innerHTML = `
    <div class="page-head"><h1>Activity</h1><div class="head-actions"><a class="icon-btn accent" href="#/add" aria-label="Add expense">${ICONS.plus}</a></div></div>
    <div class="search">${ICONS.search}<input class="field" type="search" data-q placeholder="Search merchant, note, amount" value="${esc(filter.q)}" autocomplete="off"></div>
    <div class="chips" style="margin-bottom:6px">
      <button class="chip ${!filter.category ? 'on' : ''}" data-c="">All</button>
      ${chips.map((c) => `<button class="chip ${filter.category === c.id ? 'on' : ''}" data-c="${c.id}">${c.emoji} ${esc(c.short)}</button>`).join('')}
    </div>
    <div data-list></div>`;
  const qi = root.querySelector('[data-q]');
  qi.addEventListener('input', () => { filter.q = qi.value; limit = 150; renderList(root); });
  root.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => {
    filter.category = b.dataset.c || null;
    root.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b));
    renderList(root);
  }));
  renderList(root);
}

function renderList(root) {
  const box = root.querySelector('[data-list]');
  const q = filter.q.trim().toLowerCase();
  const list = state.expenses.filter((e) =>
    (!filter.category || e.category === filter.category) &&
    (!filter.month || e.date.startsWith(filter.month)) &&
    (!q || `${e.merchant} ${e.note} ${cat(e.category).name} ${e.method} ${e.amount}`.toLowerCase().includes(q))
  );
  const total = list.reduce((a, e) => a + e.amount, 0);
  let html = `${filter.month ? `<div class="chips" style="margin:8px -16px 0"><button class="chip on" data-clear-month>${esc(monthName(filter.month))} ✕</button></div>` : ''}
    ${list.length ? `<div class="day-head"><span>${list.length} expenses</span><span>${moneyRound(total)}</span></div>` : ''}`;
  if (!list.length) {
    html += `<div class="card empty"><div class="big">🧾</div><h2>${state.expenses.length ? 'No matches' : 'No expenses yet'}</h2><p>${state.expenses.length ? 'Try a different search or category.' : 'Tap + to log your first one.'}</p></div>`;
  } else {
    let curDay = null;
    let dayItems = [];
    const flush = () => {
      if (!dayItems.length) return;
      const t = dayItems.reduce((a, e) => a + e.amount, 0);
      html += `<div class="day-head"><span>${esc(fmtDay(curDay))}</span><span class="num">${money(t)}</span></div><div class="list">` +
        dayItems.map((e) => {
          const c = cat(e.category);
          return `<button class="row" data-id="${e.id}"><span class="e">${c.emoji}</span><div class="main"><div class="t1">${esc(e.merchant || c.name)}</div><div class="t2">${esc(c.name)} · ${methodEmoji(e.method)} ${esc(e.method)}${e.recurringId ? ' · 🔁' : ''}${e.receiptId ? ' · 🧾' : ''}${e.note ? ' · ' + esc(e.note) : ''}</div></div><div class="right"><div class="amt">${money(e.amount)}</div></div></button>`;
        }).join('') + '</div>';
      dayItems = [];
    };
    for (const e of list.slice(0, limit)) {
      if (e.date !== curDay) { flush(); curDay = e.date; }
      dayItems.push(e);
    }
    flush();
    if (list.length > limit) html += `<button class="btn block" data-more>Show more</button>`;
  }
  box.innerHTML = html;
  box.querySelector('[data-clear-month]')?.addEventListener('click', () => { filter.month = null; renderList(root); });
  box.querySelector('[data-more]')?.addEventListener('click', () => { limit += 200; renderList(root); });
  box.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => {
    const e = state.expenses.find((x) => x.id === b.dataset.id);
    if (e) openExpenseSheet(e);
  }));
}
