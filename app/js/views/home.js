// Dashboard: savings, this month at a glance, and your level.
import { state, savingsBalance, savingsIsSet } from '../store.js';
import { todayISO, addDays, monthKey, shiftMonthKey, monthName, fmtShort, inDays } from '../dates.js';
import { cat } from '../categories.js';
import { money, moneyRound, moneyShort, esc, pct } from '../format.js';
import { ICONS } from '../ui.js';
import { columnChart, groupedChart } from '../charts.js';
import { sum, byCategory, byMerchant, dailyTotals, monthlyTotals, monthStatus, vsLastMonth, fixedMonthly, occurrences, incomeInMonth, effectiveIncome } from '../analytics.js';
import { buildInsights } from '../engine.js';
import { gameState, goalStage } from '../game.js';
import { openSettings, openPaySheet, openInstallHelp, openSavingsSheet, loadDemo } from '../sheets.js';
import { setActivityFilter } from './activity.js';

let offset = 0;

export function render(root) {
  const curKey = monthKey(todayISO());
  const key = shiftMonthKey(curKey, offset);
  const s = monthStatus(key);
  const g = gameState();
  const header = `
    <div class="page-head">
      <div class="month-switch">
        <button data-m="-1" aria-label="Previous month">${ICONS.back}</button>
        <h1>${esc(monthName(key))}</h1>
        <button data-m="1" aria-label="Next month" ${offset >= 0 ? 'disabled' : ''}>${ICONS.fwd}</button>
      </div>
      <div class="head-actions"><button class="icon-btn" data-act="settings" aria-label="Settings">${ICONS.gear}</button></div>
    </div>
    <div style="display:flex;gap:8px;margin:-6px 0 14px">
      <a class="lvl-chip" href="#/goals" style="--p:${g.level.progress.toFixed(3)}"><span class="ring"><span>${g.level.level}</span></span>${esc(g.level.name)}</a>
      <a class="streak-chip ${g.streak.current ? '' : 'cold'}" href="#/goals">${g.streak.current ? `🔥 ${g.streak.current}-day streak` : '🔥 Start a streak'}</a>
    </div>`;

  if (!state.expenses.length && !state.income.length && !state.recurring.length && !savingsIsSet()) {
    root.innerHTML = header + `
      <div class="card empty">
        <div class="big">🥑</div>
        <h2>Welcome to Avocado <em>Money</em></h2>
        <p>Grow your savings like an avocado tree. Log what comes in and what goes out, plant goals, and level up as they grow.</p>
        <div class="btns">
          <button class="btn primary" data-act="savings">Set my current savings</button>
          <a class="btn" href="#/add">Log an expense</a>
          <button class="btn" data-act="demo">Explore with demo data</button>
          <button class="btn" data-act="install">📲 Install on Home Screen</button>
        </div>
      </div>`;
    wire(root);
    return;
  }

  // ---- Savings
  const incMonth = sum(incomeInMonth(key));
  const net = incMonth - s.spent;
  const topGoal = state.goals.filter((x) => x.saved < x.target).sort((a, b) => b.saved / b.target - a.saved / a.target)[0];
  const savingsCard = `
    <div class="card savings-card">
      <span class="avo" aria-hidden="true">🥑</span>
      <div class="hero-label">Your savings</div>
      <div class="hero-num" data-act="savings" role="button" tabindex="0">${savingsIsSet() ? moneyRound(savingsBalance()) : 'Set it'}</div>
      <div class="hero-sub">${savingsIsSet() ? 'Income adds to it, spending takes from it. Tap the number to correct it.' : 'Enter what you have saved now, and it updates as you log income and spending.'}</div>
      <div class="flow">
        <div><small>In · ${esc(monthName(key, 'short'))}</small><b>+${moneyShort(incMonth)}</b></div>
        <div><small>Out</small><b>−${moneyShort(s.spent)}</b></div>
        <div><small>${s.isCurrent ? 'Net so far' : net >= 0 ? 'Saved' : 'Overspent'}</small><b>${net >= 0 ? '' : '−'}${moneyShort(Math.abs(net))}</b></div>
      </div>
      <div class="row-btns">
        <a class="btn solid" href="#/add/income">+ Add income</a>
        <a class="btn" href="#/goals">${topGoal ? `${goalStage(topGoal).emoji} ${esc(topGoal.name)} ${pct(topGoal.saved / topGoal.target)}` : '🌰 Plant a goal'}</a>
      </div>
    </div>`;

  // ---- Budget hero
  const { prevSpent } = vsLastMonth(key, s.dayNum);
  const delta = prevSpent > 0 ? s.spent / prevSpent - 1 : null;
  const meterCls = !s.budget ? '' : s.spent > s.budget ? 'over' : s.pace > 1.1 ? 'warn' : '';
  const fill = s.budget ? Math.min(1, s.spent / s.budget) : 0;
  const pacePos = s.budget && s.isCurrent ? s.pacePos : null;
  const hero = `
    <div class="card">
      <div class="hero-label">${s.isCurrent ? 'Spent this month' : 'Spent in ' + esc(monthName(key))}</div>
      <div class="hero-num" style="font-size:40px">${moneyRound(s.spent)}</div>
      ${s.budget ? `
        <div class="hero-sub">${s.spent <= s.budget ? `${moneyRound(s.budget - s.spent)} left of ${moneyRound(s.budget)}` : `<span class="status bad">▲ ${moneyRound(s.spent - s.budget)} over</span> your ${moneyRound(s.budget)} budget`}${s.isCurrent ? ` · ${s.daysLeft} days to go` : ''}</div>
        <div class="meter ${meterCls}" role="meter" aria-valuemin="0" aria-valuemax="${s.budget}" aria-valuenow="${Math.round(s.spent)}" aria-label="Budget used"><i style="width:${fill * 100}%"></i>${pacePos ? `<span class="pace" style="left:calc(${pacePos * 100}% - 1px)" title="Where you should be today"></span>` : ''}</div>
        <div class="meter-legend"><span>${pct(s.spent / s.budget)} used</span>${pacePos ? `<span>${s.pace > 1.1 ? '<span class="status warn">Ahead of pace</span>' : s.pace < 0.9 ? '<span class="status good">Under pace</span>' : 'On pace'}</span>` : ''}</div>`
      : `<div class="hero-sub"><button data-act="settings" style="color:var(--accent);font-weight:600">Set a monthly budget</button> to see how much you can still spend.</div>`}
    </div>`;

  // ---- Tiles
  const fixed = fixedMonthly();
  const due7 = occurrences(todayISO(), addDays(todayISO(), 7), { includeOverdue: true });
  const due7t = due7.reduce((a, o) => a + o.r.amount, 0);
  const small = 'style="font-size:14px;font-weight:600;color:var(--text-2)"';
  const tiles = `
    <div class="tiles">
      ${s.isCurrent && s.budget
        ? `<div class="tile"><span class="tile-label">Safe to spend</span><span class="tile-value">${moneyRound(s.safePerDay)}<small ${small}>/day</small></span><span class="tile-foot">after upcoming bills</span></div>`
        : `<div class="tile"><span class="tile-label">Daily average</span><span class="tile-value">${moneyRound(s.spent / Math.max(1, s.dayNum))}</span><span class="tile-foot">${s.dayNum} days</span></div>`}
      <div class="tile"><span class="tile-label">vs. last month</span><span class="tile-value">${delta === null ? '—' : `<span class="status ${delta > 0 ? 'bad' : 'good'}">${delta > 0 ? '▲' : '▼'} ${pct(Math.abs(delta))}</span>`}</span><span class="tile-foot">${prevSpent > 0 ? `${moneyRound(prevSpent)} by day ${s.dayNum}` : 'not enough history'}</span></div>
      <a class="tile" href="#/bills"><span class="tile-label">Bills & subs</span><span class="tile-value">${moneyRound(fixed)}<small ${small}>/mo</small></span><span class="tile-foot">${state.recurring.filter((r) => r.active && r.kind !== 'income').length} active · manage ›</span></a>
      <a class="tile" href="#/bills"><span class="tile-label">Due in 7 days</span><span class="tile-value">${moneyRound(due7t)}</span><span class="tile-foot">${due7.length ? due7.slice(0, 2).map((o) => esc(o.r.name)).join(', ') + (due7.length > 2 ? '…' : '') : 'nothing due'}</span></a>
    </div>`;

  // ---- Insight teaser
  let teaser = '';
  if (s.isCurrent) {
    const ins = buildInsights();
    const top = ins.insights.find((i) => i.save > 0) || ins.insights[0];
    if (top) teaser = `<a class="card insight" href="#/insights" style="display:flex;color:inherit"><span class="e">${top.emoji}</span><div><h3>${esc(top.title)}</h3><p>${ins.totalSave > 0 ? `You could free up about <b>${moneyRound(ins.totalSave)}/month</b>. ` : ''}See all tips ›</p></div></a>`;
  }

  // ---- Categories
  const cats = byCategory(s.list);
  const maxCat = cats[0]?.total || 1;
  const cb = state.settings.categoryBudgets || {};
  const catRows = cats.slice(0, 8).map((c) => {
    const b = cb[c.id];
    const over = b && c.total > b;
    return `<button class="rank-row" data-cat="${c.id}">
      <span class="e">${c.cat.emoji}</span>
      <span class="name">${esc(c.cat.name)}</span>
      <span class="amt">${moneyRound(c.total)}</span>
      <span class="bar-track"><span class="t ${over ? 'over' : ''}"><i style="width:${(c.total / maxCat) * 100}%"></i></span><small>${b ? (over ? `<span class="status bad">over ${moneyShort(b)}</span>` : `${pct(c.total / b)} of ${moneyShort(b)}`) : pct(c.total / s.spent)}</small></span>
    </button>`;
  }).join('');
  const catCard = cats.length ? `<div class="card"><div class="card-title"><h2>Where it <em>went</em></h2><a class="link" href="#/activity">All ›</a></div><div class="rank">${catRows}</div></div>` : '';

  // ---- Needs / wants / not spent (50/30/20)
  const income = effectiveIncome(key);
  const needs = sum(s.list.filter((e) => cat(e.category).group === 'needs'));
  const wants = s.spent - needs;
  let nwCard = '';
  if (s.spent > 0) {
    const base = income > 0 ? Math.max(income, s.spent) : s.spent;
    const left = income > 0 ? Math.max(0, income - s.spent) : 0;
    const segs = [['Needs', needs, 'var(--s1)', '50%'], ['Wants', wants, 'var(--s2)', '30%']];
    if (income > 0) segs.push([s.isCurrent ? 'Not spent yet' : 'Saved', left, 'var(--s3)', '20%']);
    nwCard = `<div class="card"><div class="card-title"><h2>Needs vs. <em>wants</em></h2><span class="muted" style="font-size:13px">${income > 0 ? 'of income · 50/30/20' : 'share of spending'}</span></div>
      <div class="seg" role="img" aria-label="${segs.map(([n, v]) => `${n} ${pct(v / base)}`).join(', ')}">${segs.filter(([, v]) => v > 0).map(([, v, c]) => `<i style="width:${(v / base) * 100}%;background:${c}"></i>`).join('')}</div>
      <div class="legend">${segs.map(([n, v, c, t]) => `<div class="legend-row"><span class="sw" style="background:${c}"></span><span class="name">${n}</span><span class="val">${moneyRound(v)}</span><span class="target">${pct(v / base)}${income > 0 ? ` · aim ${t}` : ''}</span></div>`).join('')}</div>
      ${income > 0 ? '' : '<p class="muted" style="font-size:13px;margin-top:10px">Log your income to compare against the 50/30/20 rule.</p>'}
    </div>`;
  }

  // ---- Charts
  const months = monthlyTotals(key, 6);
  const hasIncome = months.some((m) => m.income > 0);
  const dailyCard = `<div class="card"><div class="card-title"><h2>Day-to-day <em>spending</em></h2>${s.budget ? `<span class="muted" style="font-size:13px">line = daily allowance</span>` : ''}</div><p class="card-sub">Excludes bills & subscriptions</p><div data-chart="daily"></div></div>`;
  const trendCard = `<div class="card"><div class="card-title"><h2>${hasIncome ? 'In vs. <em>out</em>' : 'Last 6 <em>months</em>'}</h2></div>
    ${hasIncome ? `<div class="legend" style="grid-template-columns:auto auto;justify-content:start;column-gap:18px;margin:-4px 0 10px"><div class="legend-row"><span class="sw" style="background:var(--s1)"></span>Income</div><div class="legend-row"><span class="sw" style="background:var(--s2)"></span>Spending</div></div>` : ''}
    <div data-chart="trend"></div></div>`;

  // ---- Top merchants
  const merchants = byMerchant(s.list.filter((e) => !e.recurringId)).slice(0, 5);
  const merchCard = merchants.length ? `<div class="section-label">Top places</div><div class="list">${merchants.map((m) => `
    <div class="row"><span class="e">${cat(m.category).emoji}</span><div class="main"><div class="t1">${esc(m.name)}</div><div class="t2">${m.count}× · avg ${moneyRound(m.total / m.count)}</div></div><div class="right"><div class="amt">${moneyRound(m.total)}</div></div></div>`).join('')}</div>` : '';

  // ---- Upcoming bills
  const up = s.isCurrent ? occurrences(todayISO(), addDays(todayISO(), 14), { includeOverdue: true }).slice(0, 6) : [];
  const upCard = up.length ? `<div class="section-label">Coming up</div><div class="list">${up.map((o, i) => `
    <div class="row"><span class="e">${cat(o.r.category).emoji}</span><div class="main"><div class="t1">${esc(o.r.name)}</div><div class="t2">${o.overdue ? '<span class="badge bad">Overdue</span> ' : ''}${fmtShort(o.date)} · ${inDays(o.date)}${o.r.autoLog ? ' · auto' : ''}</div></div>
    <div class="right"><div class="amt">${money(o.r.amount)}</div>${!o.r.autoLog ? `<button class="btn small" data-pay="${i}" style="margin-top:4px">Pay</button>` : ''}</div></div>`).join('')}</div>` : '';

  root.innerHTML = header + savingsCard + hero + tiles + teaser + trendCard + dailyCard + catCard + nwCard + upCard + merchCard;
  wire(root, { up });

  const daily = dailyTotals(key, true);
  const dailyBudget = s.budget ? Math.max(0, s.budget - s.fixedThisMonth) / s.dim : 0;
  columnChart(root.querySelector('[data-chart="daily"]'), daily.map((v, i) => ({
    label: String(i + 1), value: v, hl: s.isCurrent && i + 1 === s.dayNum, tip: fmtShort(`${key}-${String(i + 1).padStart(2, '0')}`),
  })), { height: 150, format: money, axisFormat: moneyShort, ref: dailyBudget, label: 'Spending per day', showLabel: (i) => i === 0 || (i + 1) % 7 === 0 });

  if (hasIncome) {
    groupedChart(root.querySelector('[data-chart="trend"]'), months.map((m) => ({
      label: monthName(m.key, 'short'), tip: monthName(m.key, 'long'), values: [m.income, m.total],
      extra: m.income ? `${m.income >= m.total ? 'Saved' : 'Overspent'} ${moneyRound(Math.abs(m.income - m.total))}` : '',
    })), { height: 170, format: moneyRound, axisFormat: moneyShort, series: [{ name: 'Income', color: 'var(--s1)' }, { name: 'Spent', color: 'var(--s2)' }], label: 'Income vs spending by month' });
  } else {
    const withData = months.filter((m) => m.total > 0);
    const avg = withData.length > 1 ? withData.reduce((a, m) => a + m.total, 0) / withData.length : 0;
    columnChart(root.querySelector('[data-chart="trend"]'), months.map((m) => ({
      label: monthName(m.key, 'short'), value: m.total, hl: m.key === key, tip: monthName(m.key, 'long'),
    })), { height: 150, format: moneyRound, axisFormat: moneyShort, ref: avg, refLabel: avg ? `avg ${moneyShort(avg)}` : '', label: 'Monthly spending' });
  }
}

function wire(root, { up = [] } = {}) {
  root.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { offset = Math.min(0, offset + Number(b.dataset.m)); render(root); }));
  root.querySelectorAll('[data-act="settings"]').forEach((b) => (b.onclick = openSettings));
  root.querySelectorAll('[data-act="savings"]').forEach((b) => (b.onclick = openSavingsSheet));
  root.querySelector('[data-act="install"]')?.addEventListener('click', openInstallHelp);
  root.querySelector('[data-act="demo"]')?.addEventListener('click', loadDemo);
  root.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => {
    setActivityFilter({ category: b.dataset.cat, month: shiftMonthKey(monthKey(todayISO()), offset) });
    location.hash = '#/activity';
  }));
  root.querySelectorAll('[data-pay]').forEach((b) => (b.onclick = () => { const o = up[+b.dataset.pay]; openPaySheet(o.r, o.date); }));
}
