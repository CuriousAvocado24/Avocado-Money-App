// The game layer: XP, levels, streaks, weekly quests, badges and goal growth.
// Everything is derived from what you log, so Undo and edits always keep the score honest.
import { state, savingsBalance, savingsIsSet } from './store.js';
import { todayISO, addDays, fromISO, toISO, monthKey, shiftMonthKey, diffDays } from './dates.js';
import { moneyShort } from './format.js';
import { owes, owedToMe, isCleared, debtLeft, debtTotal, debtPaid, activeOwes } from './debts.js';

/* ---------------- Levels ---------------- */
export const LEVELS = [
  'Seed', 'Sprout', 'Seedling', 'Sapling', 'Young tree', 'Grower', 'Orchard hand', 'Orchard keeper', 'Harvester', 'Guac master', 'Avocado legend',
];
const xpFor = (lvl) => 200 * (lvl - 1) ** 2; // L2 200 (~4 days), L5 3,200 (~2 months), L10 16,200 (~a year of daily logging)
export function levelOf(xp) {
  let l = 1;
  while (xpFor(l + 1) <= xp) l++;
  const cur = xpFor(l);
  const next = xpFor(l + 1);
  return { level: l, name: LEVELS[Math.min(l, LEVELS.length) - 1], xp, into: xp - cur, need: next - cur, progress: (xp - cur) / (next - cur) };
}

/* ---------------- Goal growth ---------------- */
const STAGES = [
  [0, '🌰', 'Seed'], [0.1, '🌱', 'Sprout'], [0.3, '🌿', 'Seedling'], [0.55, '🪴', 'Sapling'], [0.8, '🌳', 'Tree'], [1, '🥑', 'Harvest'],
];
export function goalStage(g) {
  const p = g.target > 0 ? g.saved / g.target : 0;
  let s = STAGES[0];
  for (const st of STAGES) if (p >= st[0]) s = st;
  return { pct: Math.min(1, p), emoji: s[1], name: s[2], done: p >= 1 };
}
export function goalPace(g) {
  if (!g.deadline || g.saved >= g.target) return null;
  const days = diffDays(todayISO(), g.deadline);
  if (days <= 0) return { overdue: true, perMonth: g.target - g.saved, perWeek: g.target - g.saved };
  const left = g.target - g.saved;
  return { overdue: false, days, perWeek: left / Math.max(1, days / 7), perMonth: left / Math.max(1, days / 30.44) };
}

/* ---------------- Activity & streaks ---------------- */
function activityByDay() {
  const days = new Map();
  const get = (d) => { if (!days.has(d)) days.set(d, { exp: 0, inc: 0, check: false, dep: 0, debt: 0 }); return days.get(d); };
  for (const e of state.expenses) if (!e.recurringId) { if (e.debtId) get(e.date).debt++; else get(e.date).exp++; }
  for (const d of state.debts) for (const h of d.history || []) if (h.kind === 'collect') get(h.date).debt++;
  for (const i of state.income) if (!i.recurringId) get(i.date).inc++;
  for (const c of state.checkins) get(c).check = true;
  for (const g of state.goals) for (const h of g.history || []) if (h.amount > 0) get(h.date).dep++;
  return days;
}

function streaks(days) {
  const t = todayISO();
  // Today counts if you've logged; otherwise the streak is still alive from yesterday.
  let d = days.has(t) ? t : addDays(t, -1);
  let current = 0;
  while (days.has(d)) { current++; d = addDays(d, -1); }
  let best = 0, run = 0, prev = null;
  for (const day of [...days.keys()].sort()) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return { current, best: Math.max(best, current), today: days.has(t) };
}

/* ---------------- Weekly quests ---------------- */
const mondayOf = (iso) => { const d = fromISO(iso); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return toISO(d); };
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const sumCat = (cat, from, to) => state.expenses.filter((e) => e.category === cat && e.date >= from && e.date <= to).reduce((a, e) => a + e.amount, 0);
const round50 = (v) => Math.max(50, Math.round(v / 50) * 50);

function questsFor(weekStart, days) {
  const end = addDays(weekStart, 6);
  const today = todayISO();
  const over = end < today;
  const inWeek = (d) => d >= weekStart && d <= end;
  const activeDays = [...days.keys()].filter(inWeek).length;
  const checkins = state.checkins.filter(inWeek).length;
  const deposits = state.goals.reduce((a, g) => a + (g.history || []).filter((h) => h.amount > 0 && inWeek(h.date)).length, 0);
  const receipts = state.expenses.filter((e) => e.receiptId && inWeek(e.date)).length;
  const incomeLogs = state.income.filter((i) => inWeek(i.date)).length;
  const prior = (cat) => sumCat(cat, addDays(weekStart, -28), addDays(weekStart, -1)) / 4;

  const pool = [];
  pool.push({ id: 'log5', emoji: '📒', title: 'Log something on 5 days', target: 5, value: activeDays, xp: 60 });
  pool.push({ id: 'nospend2', emoji: '🧘', title: 'Check in 2 no-spend days', target: 2, value: checkins, xp: 50 });
  for (const [cat, label, emoji, xp] of [['food', 'Food & Dining', '🍔', 80], ['coffee', 'Coffee & Snacks', '☕', 50], ['shopping', 'Shopping', '🛍️', 70]]) {
    const avg = prior(cat);
    if (avg >= 300) {
      const limit = round50(avg * 0.85);
      const spent = sumCat(cat, weekStart, end);
      pool.push({ id: 'cap-' + cat, emoji, title: `Keep ${label} under ${moneyShort(limit)}`, target: limit, value: spent, xp, cap: true });
    }
  }
  if (state.goals.length) pool.push({ id: 'dep2', emoji: '🌱', title: 'Add to a goal twice', target: 2, value: deposits, xp: 60 });
  else pool.push({ id: 'plant', emoji: '🌰', title: 'Plant your first goal', target: 1, value: state.goals.length, xp: 40 });
  pool.push({ id: 'receipt2', emoji: '🧾', title: 'Scan 2 receipts', target: 2, value: receipts, xp: 40 });
  if (activeOwes().length) {
    const debtPays = state.expenses.filter((e) => e.debtId && inWeek(e.date)).length;
    pool.push({ id: 'debtpay', emoji: '⚔️', title: 'Hit a debt boss this week', target: 1, value: debtPays, xp: 50 });
  }
  if (state.income.length) pool.push({ id: 'income', emoji: '💼', title: 'Log your income', target: 1, value: incomeLogs, xp: 30 });

  // Always "log 5 days", plus two more picked by the week so they rotate.
  const rest = pool.slice(1);
  const h = hash(weekStart);
  const picks = [pool[0]];
  const a = h % rest.length;
  picks.push(rest[a]);
  if (rest.length > 1) picks.push(rest[(a + 1 + ((h >> 4) % (rest.length - 1))) % rest.length]);
  return picks.map((q) => {
    const done = q.cap ? over && q.value <= q.target : q.value >= q.target;
    const failed = q.cap && q.value > q.target;
    const progress = q.cap ? Math.min(1, q.value / q.target) : Math.min(1, q.value / q.target);
    return { ...q, done, failed, progress, weekStart, over };
  });
}

/* ---------------- Badges ---------------- */
function monthsWithData() {
  const set = new Set([...state.expenses, ...state.income].map((e) => monthKey(e.date)));
  return [...set].filter((k) => k < monthKey(todayISO())).sort();
}

export const BADGES = [
  { id: 'first-log', emoji: '🌱', name: 'First log', desc: 'Log your first expense or income.' },
  { id: 'payday', emoji: '💼', name: 'Payday', desc: 'Log your first income.' },
  { id: 'streak-7', emoji: '🔥', name: '7-day streak', desc: 'Log or check in 7 days in a row.' },
  { id: 'streak-30', emoji: '☀️', name: '30-day streak', desc: 'Keep a streak for 30 days.' },
  { id: 'planted', emoji: '🌰', name: 'Planted', desc: 'Create a savings goal.' },
  { id: 'harvest', emoji: '🥑', name: 'First harvest', desc: 'Fully fund a goal.' },
  { id: 'saved-10k', emoji: '🐷', name: '10K saved', desc: 'Reach 10,000 in savings.' },
  { id: 'saved-100k', emoji: '🏦', name: '100K saved', desc: 'Reach 100,000 in savings.' },
  { id: 'quiet-week', emoji: '🧘', name: 'Quiet week', desc: '3 no-spend check-ins within a week.' },
  { id: 'receipts-5', emoji: '🧾', name: 'Receipt keeper', desc: 'Attach 5 receipt photos.' },
  { id: 'budget-boss', emoji: '👑', name: 'Budget boss', desc: 'Finish a month under your budget.' },
  { id: 'saver-20', emoji: '📈', name: '20% saver', desc: 'Save 20% of a month’s income.' },
  { id: 'sub-slayer', emoji: '✂️', name: 'Subscription slayer', desc: 'Pause a subscription you don’t need.' },
  { id: 'entries-100', emoji: '📚', name: '100 entries', desc: 'Log 100 expenses and incomes.' },
  { id: 'quests-5', emoji: '🗺️', name: 'Quest runner', desc: 'Complete 5 weekly quests.' },
  { id: 'first-strike', emoji: '⚔️', name: 'First strike', desc: 'Make your first debt payment.' },
  { id: 'halfway', emoji: '🌓', name: 'Halfway there', desc: 'Pay off half of any debt.' },
  { id: 'boss-slayer', emoji: '🏆', name: 'Boss slayer', desc: 'Pay off a debt completely.' },
  { id: 'triple-slayer', emoji: '🗡️', name: 'Triple slayer', desc: 'Pay off 3 debts.' },
  { id: 'steady-payer', emoji: '📆', name: 'Steady payer', desc: 'Pay debts 3 months in a row.' },
  { id: 'debt-free', emoji: '🕊️', name: 'Debt-free', desc: 'Clear every debt you owe.' },
  { id: 'collector', emoji: '🤝', name: 'Collector', desc: 'Get money you lent paid back in full.' },
];

function earnedBadges(ctx) {
  const e = new Set();
  const manual = state.expenses.filter((x) => !x.recurringId).length + state.income.filter((x) => !x.recurringId).length;
  if (manual > 0) e.add('first-log');
  if (state.income.length) e.add('payday');
  if (ctx.streak.best >= 7) e.add('streak-7');
  if (ctx.streak.best >= 30) e.add('streak-30');
  if (state.goals.length) e.add('planted');
  if (state.goals.some((g) => g.completedAt || g.saved >= g.target)) e.add('harvest');
  if (savingsIsSet() && ctx.savings >= 10000) e.add('saved-10k');
  if (savingsIsSet() && ctx.savings >= 100000) e.add('saved-100k');
  const cs = [...state.checkins].sort();
  for (let i = 2; i < cs.length; i++) if (diffDays(cs[i - 2], cs[i]) <= 6) { e.add('quiet-week'); break; }
  if (state.expenses.filter((x) => x.receiptId).length >= 5) e.add('receipts-5');
  const budget = Number(state.settings.monthlyBudget) || 0;
  for (const k of monthsWithData()) {
    const spent = state.expenses.filter((x) => x.date.startsWith(k)).reduce((a, x) => a + x.amount, 0);
    const inc = state.income.filter((x) => x.date.startsWith(k)).reduce((a, x) => a + x.amount, 0);
    if (budget && spent > 0 && spent <= budget) e.add('budget-boss');
    if (inc > 0 && inc - spent >= inc * 0.2) e.add('saver-20');
  }
  if (state.recurring.some((r) => r.kind === 'subscription' && !r.active)) e.add('sub-slayer');
  if (state.expenses.length + state.income.length >= 100) e.add('entries-100');
  if (ctx.questsDone >= 5) e.add('quests-5');
  const debtPays = state.expenses.filter((x) => x.debtId);
  if (debtPays.length) e.add('first-strike');
  if (owes().some((d) => debtTotal(d) > 0 && debtPaid(d) >= debtTotal(d) / 2)) e.add('halfway');
  const slain = owes().filter(isCleared).length;
  if (slain >= 1) e.add('boss-slayer');
  if (slain >= 3) e.add('triple-slayer');
  if (owes().length && slain === owes().length) e.add('debt-free');
  if (owedToMe().some(isCleared)) e.add('collector');
  const payMonths = [...new Set(debtPays.map((x) => monthKey(x.date)))].sort();
  for (let i = 2; i < payMonths.length; i++) if (shiftMonthKey(payMonths[i - 2], 2) === payMonths[i] && shiftMonthKey(payMonths[i - 1], 1) === payMonths[i]) { e.add('steady-payer'); break; }
  return e;
}

/* ---------------- Everything together ---------------- */
export function gameState() {
  const days = activityByDay();
  const streak = streaks(days);
  const savings = savingsBalance();

  // XP from daily activity (capped per day so it rewards consistency, not spam)
  let xp = 0;
  for (const d of days.values()) {
    xp += 10 + Math.min(d.exp, 6) * 5 + Math.min(d.inc, 3) * 10 + (d.check ? 15 : 0) + Math.min(d.dep, 3) * 20 + Math.min(d.debt, 3) * 25;
  }
  xp += state.goals.filter((g) => g.completedAt || g.saved >= g.target).length * 250;
  // Debt bosses defeated / loans collected
  xp += owes().filter(isCleared).length * 300 + owedToMe().filter(isCleared).length * 100;

  // Weekly quests: this week + every past week since you started (max a year)
  const thisWeek = mondayOf(todayISO());
  const first = [...days.keys()].sort()[0];
  let questsDone = 0;
  if (first) {
    let w = mondayOf(first);
    let guard = 0;
    while (w < thisWeek && guard++ < 52) {
      for (const q of questsFor(w, days)) if (q.done) { questsDone++; xp += q.xp; }
      w = addDays(w, 7);
    }
  }
  const quests = questsFor(thisWeek, days);
  for (const q of quests) if (q.done) { questsDone++; xp += q.xp; }

  const earned = earnedBadges({ streak, savings, questsDone });
  xp += earned.size * 50;

  return {
    xp,
    level: levelOf(xp),
    streak,
    quests,
    questsDone,
    weekEnds: addDays(thisWeek, 6),
    badges: BADGES.map((b) => ({ ...b, earned: earned.has(b.id), seen: !!state.seenBadges[b.id] })),
    savings,
    checkedInToday: state.checkins.includes(todayISO()),
  };
}
