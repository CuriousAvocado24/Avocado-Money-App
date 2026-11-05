import { state, normMerchant, advanceDate } from './store.js';
import { todayISO, addDays, monthKey, shiftMonthKey, daysInMonth, diffDays } from './dates.js';
import { cat } from './categories.js';

export const sum = (list) => list.reduce((a, e) => a + e.amount, 0);
export const inMonth = (key) => state.expenses.filter((e) => e.date.startsWith(key));
export const between = (from, to) => state.expenses.filter((e) => e.date >= from && e.date <= to);
export const lastDays = (n, end = todayISO()) => between(addDays(end, -(n - 1)), end);

export function byCategory(list) {
  const m = {};
  for (const e of list) m[e.category] = (m[e.category] || 0) + e.amount;
  return Object.entries(m)
    .map(([id, total]) => ({ id, total, cat: cat(id) }))
    .sort((a, b) => b.total - a.total);
}

export function byMerchant(list) {
  const m = new Map();
  for (const e of list) {
    const k = normMerchant(e.merchant) || '__' + e.category;
    const g = m.get(k) || { name: e.merchant || cat(e.category).name, category: e.category, total: 0, count: 0 };
    g.total += e.amount;
    g.count++;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

export function dailyTotals(key, variableOnly = false) {
  const dim = daysInMonth(key);
  const out = Array.from({ length: dim }, () => 0);
  for (const e of inMonth(key)) if (!variableOnly || !e.recurringId) out[Number(e.date.slice(8)) - 1] += e.amount;
  return out;
}

export const incomeInMonth = (key) => state.income.filter((e) => e.date.startsWith(key));
export const incomeBetween = (from, to) => state.income.filter((e) => e.date >= from && e.date <= to);

export function monthlyTotals(endKey, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = shiftMonthKey(endKey, -i);
    out.push({ key, total: sum(inMonth(key)), income: sum(incomeInMonth(key)) });
  }
  return out;
}

/** Income to plan with: the Settings figure, or what you actually logged (this month if bigger, else the recent monthly average). */
export function effectiveIncome(key = monthKey(todayISO())) {
  const set = Number(state.settings.monthlyIncome) || 0;
  if (set > 0) return set;
  const prev = [1, 2, 3].map((i) => sum(incomeInMonth(shiftMonthKey(key, -i)))).filter((v) => v > 0);
  const avg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : 0;
  return Math.max(avg, sum(incomeInMonth(key)));
}

export function monthlyEquivalent(r) {
  switch (r.freq) {
    case 'weekly': return (r.amount * 52) / 12;
    case 'quarterly': return r.amount / 3;
    case 'yearly': return r.amount / 12;
    default: return r.amount;
  }
}
/** Active bills & subscriptions (recurring income is tracked separately). */
export const activeRecurring = () => state.recurring.filter((r) => r.active && r.kind !== 'income');
export const activeIncomeRecurring = () => state.recurring.filter((r) => r.active && r.kind === 'income');
export const fixedMonthly = (kind) =>
  activeRecurring().filter((r) => !kind || r.kind === kind).reduce((a, r) => a + monthlyEquivalent(r), 0);

/** Upcoming occurrences of recurring items in [from, to]. Unpaid manual bills that are overdue can be included. */
export function occurrences(from, to, { includeOverdue = false } = {}) {
  const today = todayISO();
  const out = [];
  for (const r of activeRecurring()) {
    let d = r.nextDue;
    let guard = 0;
    while (d <= to && guard++ < 60) {
      const overdue = d < today;
      if (d >= from || (includeOverdue && overdue && !r.autoLog)) out.push({ r, date: d, overdue });
      d = advanceDate(d, r.freq, r.day);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Everything about the current month's budget pace. */
export function monthStatus(key = monthKey(todayISO())) {
  const today = todayISO();
  const isCurrent = key === monthKey(today);
  const dim = daysInMonth(key);
  const list = inMonth(key);
  const spent = sum(list);
  const dayNum = isCurrent ? Number(today.slice(8)) : dim;
  const daysLeft = isCurrent ? dim - dayNum + 1 : 0;
  const budget = Number(state.settings.monthlyBudget) || 0;
  const monthEnd = `${key}-${String(dim).padStart(2, '0')}`;
  const upcoming = isCurrent ? occurrences(today, monthEnd, { includeOverdue: true }) : [];
  const upcomingTotal = upcoming.reduce((a, o) => a + o.r.amount, 0);
  // Project the month: fixed costs still to come + variable spending at the current pace.
  const variableSoFar = sum(list.filter((e) => !e.recurringId));
  const projected = isCurrent && dayNum >= 3 ? spent + upcomingTotal + (variableSoFar / dayNum) * (daysLeft - 1) : spent;
  const remaining = budget - spent - upcomingTotal;
  const safePerDay = budget && isCurrent ? Math.max(0, remaining) / daysLeft : 0;
  // Pace: fixed costs land on their due dates; only day-to-day spending is spread evenly across the month.
  const fixedSoFar = spent - variableSoFar;
  const fixedThisMonth = fixedSoFar + upcomingTotal;
  const expected = Math.min(budget, fixedSoFar + Math.max(0, budget - fixedThisMonth) * (dayNum / dim));
  const pace = budget && expected > 0 ? spent / expected : 0;
  const pacePos = budget ? expected / budget : 0;
  return { key, isCurrent, dim, dayNum, daysLeft, list, spent, budget, upcoming, upcomingTotal, projected, remaining, safePerDay, pace, pacePos, fixedThisMonth };
}

/** Spending at the same point in the previous month, for a fair "vs last month". */
export function vsLastMonth(key, dayNum) {
  const prev = shiftMonthKey(key, -1);
  const prevSpent = sum(inMonth(prev).filter((e) => Number(e.date.slice(8)) <= dayNum));
  return { prevSpent, prevKey: prev };
}

/** Find repeating charges that look like subscriptions but aren't tracked yet. */
export function detectSubscriptions() {
  const tracked = new Set(state.recurring.map((r) => normMerchant(r.name)));
  const skip = new Set(['food', 'groceries', 'coffee', 'transport', 'gas', 'shopping']);
  const groups = new Map();
  const since = addDays(todayISO(), -120);
  for (const e of state.expenses) {
    if (e.recurringId || e.date < since || skip.has(e.category)) continue;
    const k = normMerchant(e.merchant);
    if (!k || tracked.has(k) || /\b(fee|fees|penalty|interest|charge)\b/.test(k)) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const out = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const months = new Set(sorted.map((e) => monthKey(e.date)));
    if (months.size < 2) continue;
    const amounts = sorted.map((e) => e.amount);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    if (max > min * 1.15) continue;
    let monthlyGaps = 0;
    for (let i = 1; i < sorted.length; i++) {
      const g = diffDays(sorted[i - 1].date, sorted[i].date);
      if (g >= 25 && g <= 35) monthlyGaps++;
    }
    if (!monthlyGaps) continue;
    const last = sorted[sorted.length - 1];
    out.push({ name: last.merchant, amount: last.amount, category: last.category, lastDate: last.date, count: sorted.length, method: last.method });
  }
  return out.sort((a, b) => b.amount - a.amount);
}
