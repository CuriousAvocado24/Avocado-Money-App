// Subscriptions & bills.
import { state, saveRecurring } from '../store.js';
import { todayISO, fmtShort, inDays } from '../dates.js';
import { cat, src } from '../categories.js';
import { money, moneyRound, esc } from '../format.js';
import { ICONS, toast } from '../ui.js';
import { monthlyEquivalent, fixedMonthly, detectSubscriptions } from '../analytics.js';
import { openRecurringSheet, openPresetPicker, openPaySheet } from '../sheets.js';
import { advanceDate } from '../store.js';

const FREQ = { weekly: '/wk', monthly: '/mo', quarterly: '/3 mo', yearly: '/yr' };

export function render(root) {
  const subs = state.recurring.filter((r) => r.kind === 'subscription').sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a));
  const bills = state.recurring.filter((r) => r.kind === 'bill').sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  const paydays = state.recurring.filter((r) => r.kind === 'income').sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  const subsM = fixedMonthly('subscription');
  const billsM = fixedMonthly('bill');
  const detected = detectSubscriptions();
  const today = todayISO();

  const row = (r) => {
    const overdue = !r.autoLog && r.nextDue < today;
    return `<button class="row" data-id="${r.id}" style="${r.active ? '' : 'opacity:.5'}">
      <span class="e">${r.kind === 'income' ? src(r.category).emoji : cat(r.category).emoji}</span>
      <div class="main"><div class="t1">${esc(r.name)}</div>
        <div class="t2">${!r.active ? 'Paused' : `${overdue ? '<span class="badge bad">Overdue</span> ' : ''}Next ${fmtShort(r.nextDue)} · ${inDays(r.nextDue)}${r.autoLog ? ' · auto-logged' : ''}`}</div></div>
      <div class="right"><div class="amt ${r.kind === 'income' ? 'inc-amt' : ''}">${r.kind === 'income' ? '+' : ''}${money(r.amount)}<span class="muted" style="font-weight:500;font-size:13px">${FREQ[r.freq] || ''}</span></div>
        ${r.active && !r.autoLog ? `<span class="btn small" data-pay="${r.id}" role="button" style="margin-top:4px">${r.kind === 'income' ? 'Got it' : 'Pay'}</span>` : `<div class="amt-sub">${moneyRound(monthlyEquivalent(r) * 12)}/yr</div>`}</div>
    </button>`;
  };

  root.innerHTML = `
    <div class="page-head"><h1>Bills & <em>paydays</em></h1><div class="head-actions"><button class="icon-btn accent" data-add aria-label="Add subscription or bill">${ICONS.plus}</button></div></div>
    <div class="card">
      <div class="hero-label">Fixed costs every month</div>
      <div class="hero-num">${moneyRound(subsM + billsM)}</div>
      <div class="hero-sub">${moneyRound((subsM + billsM) * 12)} a year${state.settings.monthlyIncome ? ` · ${Math.round(((subsM + billsM) / state.settings.monthlyIncome) * 100)}% of income` : ''}</div>
      <div class="legend" style="margin-top:14px">
        <div class="legend-row"><span class="sw" style="background:var(--s1)"></span><span class="name">Bills</span><span class="val">${moneyRound(billsM)}</span><span class="target">${bills.length} items</span></div>
        <div class="legend-row"><span class="sw" style="background:var(--s2)"></span><span class="name">Subscriptions</span><span class="val">${moneyRound(subsM)}</span><span class="target">${subs.length} items</span></div>
      </div>
    </div>
    ${detected.length ? `<div class="section-label">Found in your spending</div><div class="list">${detected.map((d, i) => `
      <div class="row"><span class="e">🔎</span><div class="main"><div class="t1">${esc(d.name)}</div><div class="t2">${money(d.amount)} · paid ${d.count}× about a month apart</div></div><div class="right"><button class="btn small" data-track="${i}">Track</button></div></div>`).join('')}</div>` : ''}
    <div class="section-label">Paydays & regular income</div>
    ${paydays.length ? `<div class="list">${paydays.map(row).join('')}</div>` : `<div class="card muted" style="font-size:14px">Add your salary (e.g. every 15th and 30th) and it's logged as income automatically, so your savings grow on payday. <button data-add style="color:var(--accent);font-weight:600">Add a payday</button></div>`}
    <div class="section-label">Subscriptions</div>
    ${subs.length ? `<div class="list">${subs.map(row).join('')}</div>` : `<div class="card muted" style="font-size:14px">Netflix, Spotify, iCloud, gym… add them to see what they really cost per year.</div>`}
    <div class="section-label">Bills</div>
    ${bills.length ? `<div class="list">${bills.map(row).join('')}</div>` : `<div class="card muted" style="font-size:14px">Rent, Meralco, water, internet, phone… add them to get reminders and an accurate "safe to spend".</div>`}
    <button class="btn primary block" data-add style="margin-top:6px">+ Add bill, subscription or payday</button>`;

  root.querySelectorAll('[data-add]').forEach((b) => (b.onclick = openPresetPicker));
  root.querySelectorAll('[data-id]').forEach((b) => (b.onclick = (ev) => {
    const r = state.recurring.find((x) => x.id === b.dataset.id);
    if (!r) return;
    if (ev.target.closest('[data-pay]')) { openPaySheet(r, r.nextDue); return; }
    openRecurringSheet({ ...r });
  }));
  root.querySelectorAll('[data-track]').forEach((b) => (b.onclick = () => trackDetected(detected[+b.dataset.track])));
}

export async function trackDetected(d) {
  let next = d.lastDate;
  while (next <= todayISO()) next = advanceDate(next, 'monthly', Number(d.lastDate.slice(8)));
  // Past charges are already in your history, so auto-logging starts from the next one.
  await saveRecurring({ name: d.name, amount: d.amount, kind: d.category === 'bills' ? 'bill' : 'subscription', freq: 'monthly', nextDue: next, category: d.category === 'other' ? 'subscriptions' : d.category, method: d.method || 'Credit card', autoLog: true, active: true });
  toast(`Tracking ${d.name} · next ${fmtShort(next)}`);
}
