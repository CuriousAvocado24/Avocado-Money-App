// The Living Avocado Tree: one picture of your whole financial health.
// SIZE comes from your level (how long you've been growing); HEALTH comes from your finances right now.
import { state, savingsBalance, savingsIsSet } from './store.js';
import { todayISO, addDays, monthKey, shiftMonthKey } from './dates.js';
import { sum, inMonth, incomeInMonth, monthStatus } from './analytics.js';
import { gameState } from './game.js';
import { owes, activeOwes, debtTotal, debtLeft, boss } from './debts.js';
import { moneyRound, pct, plural } from './format.js';

const clamp = (v) => Math.max(0, Math.min(1, v));

export const STAGES = [
  { name: 'Seed', h: 0, w: 0, r: 0, blobs: 0 },
  { name: 'Sprout', h: 34, w: 4, r: 0, blobs: 0 },
  { name: 'Seedling', h: 64, w: 5, r: 0, blobs: 0 },
  { name: 'Sapling', h: 84, w: 8, r: 32, blobs: 3 },
  { name: 'Young tree', h: 104, w: 12, r: 40, blobs: 5 },
  { name: 'Grown tree', h: 122, w: 16, r: 46, blobs: 7 },
  { name: 'Fruiting tree', h: 136, w: 20, r: 51, blobs: 9 },
];
export const stageFor = (level) => (level <= 1 ? 0 : level === 2 ? 1 : level === 3 ? 2 : level <= 5 ? 3 : level <= 7 ? 4 : level <= 9 ? 5 : 6);
export const levelForStage = (s) => [1, 2, 3, 4, 6, 8, 10][s];

function activeDaysIn(n) {
  const days = new Set();
  const from = addDays(todayISO(), -(n - 1));
  for (const e of state.expenses) if (!e.recurringId && e.date >= from) days.add(e.date);
  for (const i of state.income) if (!i.recurringId && i.date >= from) days.add(i.date);
  for (const c of state.checkins) if (c >= from) days.add(c);
  for (const g of state.goals) for (const h of g.history || []) if (h.date >= from) days.add(h.date);
  return days;
}

export function treeState() {
  const g = gameState();
  const today = todayISO();
  const cur = monthKey(today);
  const st = monthStatus(cur);
  const prevKeys = [1, 2, 3].map((i) => shiftMonthKey(cur, -i)).filter((k) => inMonth(k).length);
  const avgSpend = prevKeys.length ? prevKeys.reduce((a, k) => a + sum(inMonth(k)), 0) / prevKeys.length : st.dayNum >= 7 ? st.projected : 0;

  // 🌱 Roots: emergency fund (months of spending your savings cover)
  const bal = savingsIsSet() ? savingsBalance() : null;
  const months = bal === null ? 0 : avgSpend > 0 ? bal / avgSpend : bal > 0 ? 6 : 0;
  const roots = {
    id: 'roots', emoji: '🌱', name: 'Roots', area: 'Emergency fund', weight: 20,
    score: bal === null ? 0.15 : clamp(months / 6),
    value: bal === null ? 'Savings not set yet' : bal < 0 ? 'Savings below zero' : `${months.toFixed(1)} months of spending saved`,
    what: 'Deep roots keep a tree standing in a storm. Your roots are your safety net: how many months of spending your savings could cover.',
    grow: bal === null ? 'Tap your savings on Home and enter what you have now.' : months < 3 ? `Aim for 3 months (${moneyRound(avgSpend * 3)}). Plant an Emergency fund goal and feed it every payday.` : months < 6 ? `Great base. Keep going to 6 months (${moneyRound(avgSpend * 6)}).` : 'Fully rooted. Extra savings can start working for you (MP2, index funds).',
    action: bal === null ? { label: 'Set my savings', act: 'savings' } : { label: 'Open goals', href: '#/goals' },
  };

  // 🪵 Trunk: consistency (days logged in the last 2 weeks + streak)
  const active14 = activeDaysIn(14).size;
  const trunk = {
    id: 'trunk', emoji: '🪵', name: 'Trunk', area: 'Consistency', weight: 15,
    score: clamp(0.7 * (active14 / 14) + 0.3 * Math.min(1, g.streak.current / 14)),
    value: `${active14} of the last 14 days logged · 🔥 ${g.streak.current}-day streak`,
    what: 'A trunk thickens a little every day. Logging spending, income, or a no-spend check-in is how you water your tree.',
    grow: active14 >= 12 ? 'Rock solid. Keep the streak going.' : 'Log something every day, even if it is just the nightly "nothing today" check-in.',
    action: { label: 'Log now', href: '#/add' },
  };

  // 🍃 Leaves: this month's budget health
  let leavesScore = 0.5;
  let leavesValue = 'No monthly budget set';
  if (st.budget) {
    if (st.spent > st.budget) { leavesScore = 0.1; leavesValue = `${moneyRound(st.spent - st.budget)} over budget`; }
    else if (st.dayNum < 3) { leavesScore = 0.8; leavesValue = 'New month, fresh leaves'; }
    else {
      const p = st.pace || 0;
      leavesScore = p <= 0.9 ? 1 : p <= 1.3 ? 1 - ((p - 0.9) / 0.4) * 0.65 : 0.2;
      leavesValue = `${pct(st.spent / st.budget)} of budget used, ${p > 1.1 ? 'ahead of pace' : p < 0.9 ? 'under pace' : 'on pace'}`;
    }
  }
  const leaves = {
    id: 'leaves', emoji: '🍃', name: 'Leaves', area: 'Budget', weight: 20, score: clamp(leavesScore), value: leavesValue,
    what: 'Green, full leaves mean your spending is on track this month. They yellow when you run ahead of your budget and wilt when you go over.',
    grow: !st.budget ? 'Set a monthly budget in Settings so your tree knows what healthy looks like.' : st.spent <= st.budget && (st.pace || 0) <= 1.1 ? `On track. Stay at or under ${moneyRound(st.safePerDay)} a day to keep the leaves green.` : `Slow down: about ${moneyRound(st.safePerDay)} a day gets you back on budget.`,
    action: !st.budget ? { label: 'Set budget', act: 'settings' } : { label: 'Where to cut', href: '#/insights' },
  };

  // ☀️ Weather: cash flow (income vs spending)
  const useKey = st.dayNum >= 10 || !prevKeys.length ? cur : prevKeys[0];
  const inc = sum(incomeInMonth(useKey));
  const out = sum(inMonth(useKey));
  const rate = inc > 0 ? (inc - out) / inc : null;
  const weatherScore = rate === null ? 0.5 : rate >= 0.2 ? 1 : rate >= 0 ? 0.4 + 3 * rate : Math.max(0, 0.4 + rate);
  const weather = {
    id: 'weather', emoji: weatherScore >= 0.75 ? '☀️' : weatherScore >= 0.4 ? '⛅' : '🌧️', name: 'Weather', area: 'Cash flow', weight: 15,
    score: clamp(weatherScore), kind: weatherScore >= 0.75 ? 'sunny' : weatherScore >= 0.4 ? 'cloudy' : 'rainy',
    value: rate === null ? 'No income logged yet' : `Saving ${pct(Math.max(-9.99, rate))} of income ${useKey === cur ? 'this month' : 'last month'}`,
    what: 'Sunshine is money left over after spending. Saving 20% or more of what comes in is full sun; spending more than you earn brings rain.',
    grow: rate === null ? 'Log your income (or add your payday under Bills) so your tree gets sunlight.' : rate >= 0.2 ? 'Clear skies. Move the extra into a goal before it gets spent.' : 'Pay yourself first: move savings out on payday, then spend what is left.',
    action: rate === null ? { label: 'Add income', href: '#/add/income' } : { label: 'See tips', href: '#/insights' },
  };

  // 🥑 Avocados: goals + badges
  const goals = state.goals;
  const goalAvg = goals.length ? goals.reduce((a, x) => a + Math.min(1, x.saved / (x.target || 1)), 0) / goals.length : 0;
  const earned = g.badges.filter((b) => b.earned).length;
  const fruit = {
    id: 'fruit', emoji: '🥑', name: 'Avocados', area: 'Goals & badges', weight: 15,
    score: clamp((goals.length ? 0.7 * goalAvg : 0.1) + 0.3 * (earned / g.badges.length)),
    value: goals.length ? `${goals.filter((x) => x.saved >= x.target).length} of ${plural(goals.length, 'goal')} harvested · ${earned} badges` : `No goals yet · ${earned} badges`,
    what: 'Every goal hangs on your tree as an avocado that grows as you feed it, and ripens when it is fully funded. Every 3 badges add another one.',
    grow: goals.length ? 'Feed the goal closest to done for a quick harvest.' : 'Plant a goal: an emergency fund, a trip, a new phone.',
    action: { label: goals.length ? 'Feed a goal' : 'Plant a goal', href: '#/goals' },
  };

  // 🌸 Blossoms: this week's quests
  const qDone = g.quests.filter((q) => q.done).length;
  const flowers = {
    id: 'flowers', emoji: '🌸', name: 'Blossoms', area: 'Weekly quests', weight: 5, score: clamp(qDone / Math.max(1, g.quests.length)),
    value: `${qDone} of ${g.quests.length} quests done this week`,
    what: 'Each weekly quest you complete opens a blossom. They reset every Monday.',
    grow: qDone === g.quests.length ? 'In full bloom. New quests on Monday.' : `Next: ${g.quests.find((q) => !q.done)?.title || ''}`,
    action: { label: 'See quests', href: '#/goals' },
  };

  // 🐛 Pests: debts
  const all = owes();
  const act = activeOwes();
  const totalB = all.reduce((a, d) => a + debtTotal(d), 0);
  const left = act.reduce((a, d) => a + debtLeft(d), 0);
  const paidThisMonth = state.expenses.some((e) => e.debtId && e.date.startsWith(cur));
  const pests = {
    id: 'pests', emoji: act.length ? '🐛' : '🦋', name: 'Pests', area: 'Debts', weight: 10,
    score: !act.length ? 1 : clamp(0.25 + 0.6 * (1 - left / (totalB || 1)) + (paidThisMonth ? 0.15 : 0)),
    value: !all.length ? 'No debts tracked' : !act.length ? 'All debts cleared' : `${plural(act.length, 'debt')} left · ${moneyRound(left)}`,
    what: 'Each debt you owe is a bug nibbling on your tree. Payments shrink them; paying one off sends it away for good.',
    grow: !act.length ? 'Pest-free. Keep new debt off your tree.' : `Pay something on ${act[0].name} this month, and put any extras on the highest-interest debt.`,
    action: { label: act.length ? 'Battle debts' : 'Debts', href: '#/debts' },
    bugs: act.map((d) => boss(d).emoji),
  };

  const parts = [roots, trunk, leaves, weather, fruit, flowers, pests];
  const health = Math.round(parts.reduce((a, p) => a + p.score * p.weight, 0));
  const stage = stageFor(g.level.level);
  const watered = activeDaysIn(1).size > 0;
  const mood = health >= 80 ? 'Thriving' : health >= 60 ? 'Healthy' : health >= 40 ? 'Needs care' : 'Wilting';

  // Fruits: active goals sized by progress, harvested goals ripe, +1 ripe per 3 badges
  const fruits = [
    ...goals.filter((x) => x.saved >= x.target).map(() => ({ ripe: true, s: 1 })),
    ...goals.filter((x) => x.saved < x.target).map((x) => ({ ripe: false, s: 0.45 + 0.55 * Math.min(1, x.saved / (x.target || 1)) })),
    ...Array.from({ length: Math.floor(earned / 3) }, () => ({ ripe: true, s: 0.8 })),
  ];

  return { parts, health, mood, stage, stageName: STAGES[stage].name, level: g.level, watered, fruits, blossoms: qDone, bugs: pests.bugs, weather: weather.kind, roots: roots.score, leaves: leaves.score };
}
