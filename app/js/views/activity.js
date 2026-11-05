// Activity: every expense and income, searchable and filterable.
import { state } from '../store.js';
import { fmtDay, monthName } from '../dates.js';
import { cat, src, CATEGORIES, methodEmoji } from '../categories.js';
import { money, moneyRound, esc } from '../format.js';
import { ICONS } from '../ui.js';
import { openExpenseSheet, openIncomeSheet } from '../sheets.js';

let filter = { q: '', category: null, month: null };
let limit = 150;

export function setActivityFilter(f) {
  filter = { q: '', category: null, month: null, ...f };
  limit = 150;
}

export function render(root) {
  const used = new Set(state.expenses.map((e) => e.category));
  if (filter.category && filter.category.startsWith('__') && !state.income.length) filter.category = null;
  const chips = CATEGORIES.filter((c) => used.has(c.id));
  root.innerHTML = `
    <div class="page-head"><h1>Every <em>peso</em></h1><div class="head-actions"><a class="icon-btn accent" href="#/add" aria-label="Add expense">${ICONS.plus}</a></div></div>
    <div class="search">${ICONS.search}<input class="field" type="search" data-q placeholder="Search merchant, note, amount" value="${esc(filter.q)}" autocomplete="off"></div>
    <div class="chips" style="margin-bottom:6px">
      <button class="chip ${!filter.category ? 'on' : ''}" data-c="">All</button>
      ${state.income.length ? `<button class="chip ${filter.category === '__income' ? 'on' : ''}" data-c="__income">💰 Income</button><button class="chip ${filter.category === '__spent' ? 'on' : ''}" data-c="__spent">🧾 Spending</button>` : ''}
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
  const fc = filter.category;
  const exp = fc === '__income' ? [] : state.expenses.filter((e) => !fc || fc === '__spent' || e.category === fc).map((e) => ({ ...e, _inc: false, _text: `${e.merchant} ${e.note} ${cat(e.category).name} ${e.method} ${e.amount}` }));
  const inc = fc && fc !== '__income' ? [] : state.income.map((i) => ({ ...i, _inc: true, _text: `${i.from} ${i.note} ${src(i.source).name} income ${i.amount}` }));
  const list = exp.concat(inc).filter((e) =>
    (!filter.month || e.date.startsWith(filter.month)) && (!q || e._text.toLowerCase().includes(q))
  ).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  const out = list.filter((e) => !e._inc).reduce((a, e) => a + e.amount, 0);
  const inTotal = list.filter((e) => e._inc).reduce((a, e) => a + e.amount, 0);
  let html = `${filter.month ? `<div class="chips" style="margin:8px -16px 0"><button class="chip on" data-clear-month>${esc(monthName(filter.month))} ✕</button></div>` : ''}
    ${list.length ? `<div class="day-head"><span>${list.length} entries</span><span>${inTotal ? `<span class="inc-amt">+${moneyRound(inTotal)}</span> · ` : ''}−${moneyRound(out)}</span></div>` : ''}`;
  if (!list.length) {
    const any = state.expenses.length || state.income.length;
    html += `<div class="card empty"><div class="big">🧾</div><h2>${any ? 'No matches' : 'Nothing logged yet'}</h2><p>${any ? 'Try a different search or category.' : 'Tap + to log your first expense or income.'}</p></div>`;
  } else {
    let curDay = null;
    let dayItems = [];
    const flush = () => {
      if (!dayItems.length) return;
      const t = dayItems.reduce((a, e) => a + (e._inc ? 0 : e.amount), 0);
      html += `<div class="day-head"><span>${esc(fmtDay(curDay))}</span><span class="num">${t ? '−' + money(t) : ''}</span></div><div class="list">` +
        dayItems.map((e) => {
          if (e._inc) {
            const sc = src(e.source);
            return `<button class="row" data-inc="${e.id}"><span class="e">${sc.emoji}</span><div class="main"><div class="t1">${esc(e.from || sc.name)}</div><div class="t2">${esc(sc.name)}${e.recurringId ? ' · 🔁' : ''}${e.note ? ' · ' + esc(e.note) : ''}</div></div><div class="right"><div class="amt inc-amt">+${money(e.amount)}</div></div></button>`;
          }
          const c = cat(e.category);
          return `<button class="row" data-id="${e.id}"><span class="e">${c.emoji}</span><div class="main"><div class="t1">${esc(e.merchant || c.name)}</div><div class="t2">${esc(c.name)} · ${methodEmoji(e.method)} ${esc(e.method)}${e.recurringId ? ' · 🔁' : ''}${e.receiptId ? ' · 🧾' : ''}${e.note ? ' · ' + esc(e.note) : ''}</div></div><div class="right"><div class="amt">−${money(e.amount)}</div></div></button>`;
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
  box.querySelectorAll('[data-inc]').forEach((b) => (b.onclick = () => {
    const i = state.income.find((x) => x.id === b.dataset.inc);
    if (i) openIncomeSheet(i);
  }));
  box.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => {
    const e = state.expenses.find((x) => x.id === b.dataset.id);
    if (e) openExpenseSheet(e);
  }));
}
