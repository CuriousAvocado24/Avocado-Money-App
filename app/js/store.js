import { db } from './db.js';
import { todayISO, addDays, addMonths } from './dates.js';

export const DEFAULT_SETTINGS = {
  currency: 'PHP',
  monthlyIncome: 0,
  monthlyBudget: 0,
  categoryBudgets: {},
  openTo: 'add',
  lastMethod: 'Cash',
  installHintShown: false,
  demoSettings: false,
  // Savings tracker: what you had saved at a point in time; income adds to it, spending takes from it.
  savingsStart: null,
  savingsStartDate: null,
  savingsStartAt: 0,
  savingsGoal: 0,
  savingsGoalName: '',
};

export const state = {
  expenses: [],
  income: [],
  goals: [],
  checkins: [],
  seenBadges: {},
  recurring: [],
  settings: { ...DEFAULT_SETTINGS },
  merchantMap: {},
};

const listeners = new Set();
export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export function emit() {
  listeners.forEach((fn) => fn());
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const byDateDesc = (a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0);
const sortExp = () => state.expenses.sort(byDateDesc);
export const normMerchant = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export async function load() {
  const [ex, inc, goals, checkins, seen, rec, settings, mm] = await Promise.all([
    db.all('expenses'),
    db.all('income'),
    db.all('goals'),
    db.get('meta', 'checkins'),
    db.get('meta', 'seenBadges'),
    db.all('recurring'),
    db.get('meta', 'settings'),
    db.get('meta', 'merchantMap'),
  ]);
  state.expenses = ex;
  sortExp();
  state.income = inc.sort(byDateDesc);
  state.goals = goals.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  state.checkins = checkins || [];
  state.seenBadges = seen || {};
  state.recurring = rec;
  state.settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  state.merchantMap = mm || {};
  cleanupReceipts();
}

async function cleanupReceipts() {
  try {
    const keys = await db.keys('receipts');
    const used = new Set(state.expenses.map((e) => e.receiptId).filter(Boolean));
    const orphans = keys.filter((k) => !used.has(k));
    if (orphans.length) await db.bulkDel('receipts', orphans);
  } catch (e) {
    console.warn(e);
  }
}

export async function saveSettings(patch) {
  Object.assign(state.settings, patch);
  await db.put('meta', { ...state.settings }, 'settings');
  emit();
}

async function learn(e) {
  const k = normMerchant(e.merchant);
  if (!k || state.merchantMap[k] === e.category) return;
  state.merchantMap[k] = e.category;
  await db.put('meta', { ...state.merchantMap }, 'merchantMap');
}

function makeExpense(data) {
  return {
    id: data.id || uid(),
    amount: Math.round(Number(data.amount) * 100) / 100,
    category: data.category || 'other',
    merchant: (data.merchant || '').trim(),
    note: (data.note || '').trim(),
    date: data.date || todayISO(),
    method: data.method || 'Cash',
    receiptId: data.receiptId || null,
    recurringId: data.recurringId || null,
    demo: !!data.demo,
    createdAt: data.createdAt || Date.now(),
  };
}

export async function addExpense(data, { silent = false } = {}) {
  const e = makeExpense(data);
  state.expenses.push(e);
  sortExp();
  await db.put('expenses', e);
  if (!e.demo && !e.recurringId) await learn(e);
  if (!silent) emit();
  return e;
}

export async function updateExpense(id, patch) {
  const e = state.expenses.find((x) => x.id === id);
  if (!e) return;
  Object.assign(e, patch);
  e.amount = Math.round(Number(e.amount) * 100) / 100;
  sortExp();
  await db.put('expenses', e);
  if (!e.demo) await learn(e);
  emit();
}

/** Removes the expense. Its receipt photo is kept until next launch so "Undo" can restore it. */
export async function deleteExpense(id) {
  const i = state.expenses.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const [e] = state.expenses.splice(i, 1);
  await db.del('expenses', id);
  emit();
  return e;
}

export async function restoreExpense(e) {
  state.expenses.push(e);
  sortExp();
  await db.put('expenses', e);
  emit();
}

/* ---------- Income ---------- */

function makeIncome(data) {
  return {
    id: data.id || uid(),
    amount: Math.round(Number(data.amount) * 100) / 100,
    source: data.source || 'salary',
    from: (data.from || '').trim(),
    note: (data.note || '').trim(),
    date: data.date || todayISO(),
    recurringId: data.recurringId || null,
    demo: !!data.demo,
    createdAt: data.createdAt || Date.now(),
  };
}
const sortInc = () => state.income.sort(byDateDesc);

export async function addIncome(data, { silent = false } = {}) {
  const i = makeIncome(data);
  state.income.push(i);
  sortInc();
  await db.put('income', i);
  if (!silent) emit();
  return i;
}
export async function updateIncome(id, patch) {
  const i = state.income.find((x) => x.id === id);
  if (!i) return;
  Object.assign(i, patch);
  i.amount = Math.round(Number(i.amount) * 100) / 100;
  sortInc();
  await db.put('income', i);
  emit();
}
export async function deleteIncome(id) {
  const idx = state.income.findIndex((x) => x.id === id);
  if (idx < 0) return null;
  const [i] = state.income.splice(idx, 1);
  await db.del('income', id);
  emit();
  return i;
}
export async function restoreIncome(i) {
  state.income.push(i);
  sortInc();
  await db.put('income', i);
  emit();
}

/* ---------- Goals (the game) ---------- */

export async function saveGoal(g) {
  if (!g.id) {
    g.id = uid();
    g.createdAt = Date.now();
    g.history = g.history || [];
    g.saved = Number(g.saved) || 0;
    state.goals.push(g);
  } else {
    const i = state.goals.findIndex((x) => x.id === g.id);
    if (i >= 0) state.goals[i] = g;
  }
  g.target = Math.round(Number(g.target) * 100) / 100;
  if (g.saved >= g.target && !g.completedAt) g.completedAt = Date.now();
  if (g.saved < g.target) g.completedAt = null;
  await db.put('goals', g);
  emit();
  return g;
}

/** Add (or take out, with a negative amount) money from a goal. */
export async function depositGoal(g, amount, date = todayISO()) {
  amount = Math.round(Number(amount) * 100) / 100;
  g.saved = Math.max(0, Math.round((g.saved + amount) * 100) / 100);
  g.history = [...(g.history || []), { date, amount, at: Date.now() }];
  const justDone = g.saved >= g.target && !g.completedAt;
  if (justDone) g.completedAt = Date.now();
  if (g.saved < g.target) g.completedAt = null;
  await db.put('goals', g);
  emit();
  return justDone;
}

export async function deleteGoal(id) {
  state.goals = state.goals.filter((g) => g.id !== id);
  await db.del('goals', id);
  emit();
}

/** "I spent nothing today" — keeps your streak alive on quiet days. */
export async function checkIn(date = todayISO(), { silent = false } = {}) {
  if (state.checkins.includes(date)) return false;
  state.checkins = [...state.checkins, date];
  await db.put('meta', state.checkins, 'checkins');
  if (!silent) emit();
  return true;
}

export async function markBadgesSeen(ids) {
  const now = todayISO();
  for (const id of ids) if (!state.seenBadges[id]) state.seenBadges[id] = now;
  await db.put('meta', { ...state.seenBadges }, 'seenBadges');
}

/* ---------- Savings balance ---------- */

/** Counts toward savings if it happened after the moment you set your balance. */
function afterStart(e) {
  const d = state.settings.savingsStartDate;
  if (!d) return true;
  return e.date > d || (e.date === d && (e.createdAt || 0) > (state.settings.savingsStartAt || 0));
}
/** Your savings right now: starting amount + income since − spending since. */
export function savingsBalance() {
  const start = Number(state.settings.savingsStart) || 0;
  let v = start;
  for (const i of state.income) if (afterStart(i)) v += i.amount;
  for (const e of state.expenses) if (afterStart(e)) v -= e.amount;
  return v;
}
export const savingsIsSet = () => state.settings.savingsStart !== null && state.settings.savingsStart !== undefined;
export async function setSavingsBalance(amount) {
  await saveSettings({ savingsStart: Math.round(Number(amount) * 100) / 100, savingsStartDate: todayISO(), savingsStartAt: Date.now() });
}

export async function saveReceipt(dataUrl) {
  const id = 'r_' + uid();
  await db.put('receipts', { id, dataUrl, createdAt: Date.now() });
  return id;
}
export async function getReceipt(id) {
  const r = await db.get('receipts', id);
  return r ? r.dataUrl : null;
}

/* ---------- Recurring (subscriptions & bills) ---------- */

export function advanceDate(iso, freq, anchorDay) {
  switch (freq) {
    case 'weekly': return addDays(iso, 7);
    case 'quarterly': return addMonths(iso, 3, anchorDay);
    case 'yearly': return addMonths(iso, 12, anchorDay);
    default: return addMonths(iso, 1, anchorDay);
  }
}

export async function saveRecurring(r) {
  r.amount = Math.round(Number(r.amount) * 100) / 100;
  r.day = Number(r.nextDue.slice(8));
  if (!r.id) {
    r.id = uid();
    r.createdAt = Date.now();
  }
  const i = state.recurring.findIndex((x) => x.id === r.id);
  if (i >= 0) state.recurring[i] = r;
  else state.recurring.push(r);
  await db.put('recurring', r);
  await processRecurring({ silent: true });
  emit();
  return r;
}

export async function deleteRecurring(id) {
  state.recurring = state.recurring.filter((r) => r.id !== id);
  await db.del('recurring', id);
  emit();
}

/** Log a bill/subscription as paid and roll its due date forward. */
function logRecurring(r, amount, date) {
  if (r.kind === 'income') return addIncome({ amount, source: r.category, from: r.name, date, recurringId: r.id, demo: r.demo }, { silent: true });
  return addExpense({ amount, category: r.category, merchant: r.name, date, method: r.method, recurringId: r.id, demo: r.demo }, { silent: true });
}

export async function markPaid(r, amount, date = todayISO()) {
  await logRecurring(r, amount, date);
  r.nextDue = advanceDate(r.nextDue, r.freq, r.day);
  await db.put('recurring', r);
  emit();
}

/** Auto-log every recurring item whose due date has arrived. */
export async function processRecurring({ silent = false } = {}) {
  const today = todayISO();
  let any = false;
  for (const r of state.recurring) {
    if (!r.active || !r.autoLog) continue;
    let guard = 0;
    let changed = false;
    while (r.nextDue <= today && guard++ < 60) {
      await logRecurring(r, r.amount, r.nextDue);
      r.nextDue = advanceDate(r.nextDue, r.freq, r.day);
      changed = true;
    }
    if (changed) {
      any = true;
      await db.put('recurring', r);
    }
  }
  if (any && !silent) emit();
  return any;
}

/* ---------- Bulk data ---------- */

export async function exportAll() {
  const receipts = await db.all('receipts');
  return {
    app: 'gastos',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    merchantMap: state.merchantMap,
    expenses: state.expenses,
    income: state.income,
    goals: state.goals,
    checkins: state.checkins,
    seenBadges: state.seenBadges,
    recurring: state.recurring,
    receipts,
  };
}

export async function importAll(data) {
  if (!data || data.app !== 'gastos' || !Array.isArray(data.expenses)) throw new Error('This is not an Avocado Money backup file.');
  await Promise.all(['expenses', 'income', 'goals', 'recurring', 'receipts'].map((s) => db.clear(s)));
  await db.bulkPut('goals', data.goals || []);
  await db.put('meta', data.checkins || [], 'checkins');
  await db.put('meta', data.seenBadges || {}, 'seenBadges');
  await db.bulkPut('expenses', data.expenses.map(makeExpense));
  await db.bulkPut('income', (data.income || []).map(makeIncome));
  await db.bulkPut('recurring', data.recurring || []);
  if (Array.isArray(data.receipts)) await db.bulkPut('receipts', data.receipts);
  await db.put('meta', { ...DEFAULT_SETTINGS, ...(data.settings || {}) }, 'settings');
  await db.put('meta', data.merchantMap || {}, 'merchantMap');
  await load();
  emit();
}

export async function eraseAll() {
  await Promise.all(['expenses', 'income', 'goals', 'recurring', 'receipts', 'meta'].map((s) => db.clear(s)));
  state.expenses = [];
  state.income = [];
  state.goals = [];
  state.checkins = [];
  state.seenBadges = {};
  state.recurring = [];
  state.merchantMap = {};
  state.settings = { ...DEFAULT_SETTINGS, installHintShown: true };
  await db.put('meta', { ...state.settings }, 'settings');
  emit();
}

export async function insertDemo(expenses, recurring, settingsPatch, income = [], goals = []) {
  for (const g of goals) {
    g.id = uid();
    g.demo = true;
    g.createdAt = Date.now();
    state.goals.push(g);
  }
  await db.bulkPut('goals', goals);
  const ex = expenses.map((e) => makeExpense({ ...e, demo: true }));
  state.expenses.push(...ex);
  sortExp();
  await db.bulkPut('expenses', ex);
  const inc = income.map((i) => makeIncome({ ...i, demo: true }));
  state.income.push(...inc);
  sortInc();
  await db.bulkPut('income', inc);
  for (const r of recurring) {
    r.demo = true;
    r.id = uid();
    r.day = Number(r.nextDue.slice(8));
    state.recurring.push(r);
  }
  await db.bulkPut('recurring', recurring);
  if (settingsPatch) {
    Object.assign(state.settings, settingsPatch);
    await db.put('meta', { ...state.settings }, 'settings');
  }
  await processRecurring({ silent: true });
  emit();
}

export async function clearDemo() {
  const exIds = state.expenses.filter((e) => e.demo).map((e) => e.id);
  const recIds = state.recurring.filter((r) => r.demo).map((r) => r.id);
  const incIds = state.income.filter((e) => e.demo).map((e) => e.id);
  const goalIds = state.goals.filter((g) => g.demo).map((g) => g.id);
  state.goals = state.goals.filter((g) => !g.demo);
  await db.bulkDel('goals', goalIds);
  state.expenses = state.expenses.filter((e) => !e.demo);
  state.income = state.income.filter((e) => !e.demo);
  state.recurring = state.recurring.filter((r) => !r.demo);
  await db.bulkDel('expenses', exIds);
  await db.bulkDel('income', incIds);
  await db.bulkDel('recurring', recIds);
  if (state.settings.demoSettings) {
    Object.assign(state.settings, { monthlyIncome: 0, monthlyBudget: 0, categoryBudgets: {}, savingsStart: null, savingsStartDate: null, savingsStartAt: 0, savingsGoal: 0, savingsGoalName: '', demoSettings: false });
    await db.put('meta', { ...state.settings }, 'settings');
  }
  emit();
}

export const hasDemo = () => state.goals.some((g) => g.demo) || state.expenses.some((e) => e.demo) || state.income.some((e) => e.demo) || state.recurring.some((r) => r.demo);
