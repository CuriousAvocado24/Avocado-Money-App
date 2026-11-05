// Debt maths: balances, payoff projections and attack order. Debts you owe are "bosses" you defeat.
import { state } from './store.js';
import { todayISO, addMonths, fromISO } from './dates.js';

export const DEBT_TYPES = [
  { id: 'card', name: 'Credit card', emoji: '💳', rate: 3 },
  { id: 'bnpl', name: 'Buy now, pay later', emoji: '🛍️', rate: 0 },
  { id: 'personal', name: 'Personal / bank loan', emoji: '🏦', rate: 1.5 },
  { id: 'salary', name: 'Salary / SSS / Pag-IBIG loan', emoji: '💼', rate: 0.8 },
  { id: 'family', name: 'Family or friend', emoji: '🤝', rate: 0 },
  { id: 'car', name: 'Car / motor loan', emoji: '🚗', rate: 1 },
  { id: 'home', name: 'Home loan', emoji: '🏠', rate: 0.6 },
  { id: 'other', name: 'Other', emoji: '📄', rate: 0 },
];
export const debtType = (id) => DEBT_TYPES.find((t) => t.id === id) || DEBT_TYPES[DEBT_TYPES.length - 1];

const r2 = (n) => Math.round(n * 100) / 100;

/** Total ever borrowed/lent on this debt: starting amount + anything added later. */
export const debtTotal = (d) => r2((Number(d.original) || 0) + (d.history || []).filter((h) => h.kind === 'add').reduce((a, h) => a + h.amount, 0));

/** Payments made: linked expenses (debts you owe) or collections (money owed to you). */
export function debtPaid(d) {
  if (d.kind === 'owed') return r2((d.history || []).filter((h) => h.kind === 'collect').reduce((a, h) => a + h.amount, 0));
  return r2(state.expenses.filter((e) => e.debtId === d.id).reduce((a, e) => a + e.amount, 0));
}
export const debtLeft = (d) => Math.max(0, r2(debtTotal(d) - debtPaid(d)));
export const isCleared = (d) => debtLeft(d) <= 0.009;
export const debtPayments = (d) =>
  d.kind === 'owed'
    ? (d.history || []).filter((h) => h.kind === 'collect')
    : state.expenses.filter((e) => e.debtId === d.id).map((e) => ({ date: e.date, amount: e.amount }));

export const owes = () => state.debts.filter((d) => d.kind !== 'owed');
export const owedToMe = () => state.debts.filter((d) => d.kind === 'owed');
export const activeOwes = () => owes().filter((d) => !isCleared(d));

/** The monthly payment we plan with: your plan, else the minimum, else 5% of what's left (min 500). */
export const plannedPayment = (d) => Number(d.plan) || Number(d.minPay) || Math.max(500, Math.round(debtLeft(d) * 0.05));

/**
 * Months to clear a balance paying `pay` per month at `rate`% interest per month.
 * Returns { months, interest } or null if the payment never beats the interest.
 */
export function payoff(balance, ratePct, pay) {
  let bal = balance;
  let interest = 0;
  const r = (Number(ratePct) || 0) / 100;
  if (bal <= 0) return { months: 0, interest: 0 };
  if (pay <= bal * r) return null;
  let m = 0;
  while (bal > 0.01 && m < 600) {
    const i = bal * r;
    interest += i;
    bal = bal + i - pay;
    m++;
  }
  return m >= 600 ? null : { months: m, interest };
}

/**
 * Plan for all your debts with a strategy. Extra money freed when a debt is cleared rolls onto the next one.
 * Returns the order, the debt-free date and total interest.
 */
export function debtPlan(strategy = state.settings.debtStrategy || 'avalanche') {
  const list = activeOwes().map((d) => ({ d, bal: debtLeft(d), rate: (Number(d.rate) || 0) / 100, pay: plannedPayment(d) }));
  if (!list.length) return { order: [], months: 0, date: null, interest: 0, stuck: false };
  const order = [...list].sort((a, b) =>
    strategy === 'snowball' ? a.bal - b.bal || b.rate - a.rate : b.rate - a.rate || a.bal - b.bal
  );
  const budget = list.reduce((a, x) => a + x.pay, 0);
  let interest = 0;
  let m = 0;
  const doneAt = new Map();
  while (order.some((x) => x.bal > 0.01) && m < 600) {
    m++;
    let money = budget;
    for (const x of order) if (x.bal > 0.01) { const i = x.bal * x.rate; x.bal += i; interest += i; }
    // Minimums first…
    for (const x of order) if (x.bal > 0.01) { const p = Math.min(x.pay, x.bal, money); x.bal -= p; money -= p; }
    // …then everything left attacks the target debt.
    for (const x of order) if (x.bal > 0.01 && money > 0) { const p = Math.min(x.bal, money); x.bal -= p; money -= p; }
    for (const x of order) if (x.bal <= 0.01 && !doneAt.has(x.d.id)) doneAt.set(x.d.id, m);
  }
  const stuck = m >= 600;
  const today = todayISO();
  return {
    order: order.map((x) => ({ debt: x.d, months: doneAt.get(x.d.id) ?? null, date: doneAt.has(x.d.id) ? addMonths(today, doneAt.get(x.d.id)) : null })),
    months: stuck ? null : m,
    date: stuck ? null : addMonths(today, m),
    interest,
    stuck,
    budget,
  };
}

export const monthYear = (iso) => (iso ? fromISO(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '');

/** Boss look by size of what's left. */
export function boss(d) {
  if (isCleared(d)) return { emoji: '🏆', name: 'Defeated' };
  const left = debtLeft(d);
  if (left < 5000) return { emoji: '🐛', name: 'Bug' };
  if (left < 25000) return { emoji: '🦎', name: 'Lizard' };
  if (left < 100000) return { emoji: '🐊', name: 'Croc' };
  return { emoji: '🐉', name: 'Dragon' };
}

export const totalOwed = () => activeOwes().reduce((a, d) => a + debtLeft(d), 0);
export const totalOwedToMe = () => owedToMe().reduce((a, d) => a + debtLeft(d), 0);
export const monthlyInterest = () => activeOwes().reduce((a, d) => a + debtLeft(d) * ((Number(d.rate) || 0) / 100), 0);
