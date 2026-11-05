// Goals: the game screen. Level, streak, weekly quests, goals that grow into avocado trees, badges.
import { state, checkIn, markBadgesSeen, savingsBalance, savingsIsSet } from '../store.js';
import { fmtShort, todayISO } from '../dates.js';
import { money, moneyRound, esc, pct } from '../format.js';
import { ICONS, toast, openSheet } from '../ui.js';
import { gameState, goalStage, goalPace, LEVELS } from '../game.js';
import { activeOwes, owes, isCleared, totalOwed, boss, debtPlan, monthYear } from '../debts.js';
import { openGoalSheet, openDepositSheet, openSavingsSheet } from '../sheets.js';

export function render(root) {
  const g = gameState();
  const goals = [...state.goals].sort((a, b) => (a.saved >= a.target) - (b.saved >= b.target) || (b.createdAt || 0) - (a.createdAt || 0));
  const allocated = state.goals.reduce((a, x) => a + x.saved, 0);
  const lvl = g.level;
  const nextName = LEVELS[Math.min(lvl.level, LEVELS.length - 1)];

  const levelCard = `
    <div class="card level-card">
      <div class="lvl-top">
        <div class="badge-lvl" aria-hidden="true">${['🌰', '🌱', '🌱', '🌿', '🪴', '🪴', '🌳', '🌳', '🥑', '🥑', '👑'][Math.min(lvl.level, 11) - 1]}</div>
        <div style="flex:1;min-width:0">
          <div class="muted" style="font-size:13px;font-weight:600">Level ${lvl.level}</div>
          <h2>${esc(lvl.name)}</h2>
        </div>
        <div style="text-align:right"><b style="font-size:18px">${lvl.xp.toLocaleString('en-US')}</b><div class="muted" style="font-size:12px">XP</div></div>
      </div>
      <div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="${lvl.need}" aria-valuenow="${lvl.into}" aria-label="XP to next level"><i style="width:${(lvl.progress * 100).toFixed(1)}%"></i></div>
      <div class="meter-legend"><span>${lvl.into} / ${lvl.need} XP</span><span>Next: ${esc(nextName)}</span></div>
      <div class="stat-row">
        <div><b>${g.streak.current ? '🔥 ' + g.streak.current : '0'}</b><small>day streak</small></div>
        <div><b>${g.streak.best}</b><small>best streak</small></div>
        <div><b>${g.badges.filter((b) => b.earned).length}/${g.badges.length}</b><small>badges</small></div>
      </div>
    </div>`;

  // Only offer the no-spend check-in on days with nothing logged (logging already keeps the streak).
  const checkCard = g.streak.today ? '' : `
    <div class="card checkin">
      <span style="font-size:28px">🧘</span>
      <p><b>Spent nothing today?</b><br>Check in to keep your streak and earn 15 XP.</p>
      <button class="btn small primary" data-checkin>Check in</button>
    </div>`;

  const questCard = `
    <div class="card">
      <div class="card-title"><h2>This week's <em>quests</em></h2><span class="muted" style="font-size:13px">resets ${esc(fmtShort(g.weekEnds))}</span></div>
      ${g.quests.map((q) => `
        <div class="quest ${q.done ? 'done' : ''}">
          <span class="e">${q.done ? '✅' : q.emoji}</span>
          <div>
            <div class="t1">${esc(q.title)}</div>
            <div class="t2">${q.cap ? `${money(q.value)} spent of ${money(q.target)}${q.failed ? ' · over the limit' : q.over ? '' : ' · completes Sunday if you stay under'}` : `${Math.min(q.value, q.target)} of ${q.target}`}</div>
            <div class="mini ${q.failed ? 'over' : ''}"><i style="width:${(q.progress * 100).toFixed(0)}%"></i></div>
          </div>
          <span class="xp">${q.done ? 'Done ' : ''}+${q.xp} XP</span>
        </div>`).join('')}
    </div>`;

  const goalCards = goals.map((x) => {
    const st = goalStage(x);
    const pace = goalPace(x);
    return `
      <div class="card">
        <button class="goal ${st.done ? 'done' : ''}" data-goal="${x.id}">
          <div class="g-top">
            <span class="plant" aria-hidden="true">${st.emoji}</span>
            <div style="min-width:0">
              <h3>${esc(x.emoji)} ${esc(x.name)}</h3>
              <div class="g-sub">${st.done ? 'Harvested 🎉' : `${esc(st.name)} · ${pct(st.pct)}`}</div>
            </div>
            <div class="g-amt">${moneyRound(x.saved)}<small>of ${moneyRound(x.target)}</small></div>
          </div>
          <div class="growbar" role="progressbar" aria-valuemin="0" aria-valuemax="${x.target}" aria-valuenow="${x.saved}" aria-label="${esc(x.name)} progress"><i style="width:${(st.pct * 100).toFixed(1)}%"></i>${[0.1, 0.3, 0.55, 0.8].map((t) => `<span class="tick" style="left:${t * 100}%"></span>`).join('')}</div>
          <div class="g-foot">
            <span>${st.done ? `Done ${x.completedAt ? 'on ' + new Date(x.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}` : pace ? (pace.overdue ? '<span class="status bad">Target date passed</span>' : `${money(Math.ceil(pace.perMonth))}/mo to hit ${esc(fmtShort(x.deadline))}`) : `${money(x.target - x.saved)} to go`}</span>
            ${st.done ? '' : '<span class="btn small primary" role="button">+ Feed</span>'}
          </div>
        </button>
      </div>`;
  }).join('');

  const unseen = g.badges.filter((b) => b.earned && !b.seen).map((b) => b.id);
  const badgeGrid = `<div class="badges">${g.badges.map((b) => `
    <button class="bdg ${b.earned ? '' : 'locked'} ${unseen.includes(b.id) ? 'new' : ''}" data-badge="${b.id}" aria-label="${esc(b.name)}${b.earned ? ', earned' : ', locked'}">
      <span class="e">${b.emoji}</span><span class="n">${esc(b.name)}</span>
    </button>`).join('')}</div>`;

  root.innerHTML = `
    <div class="page-head"><h1>Grow your <em>money</em></h1><div class="head-actions"><button class="icon-btn accent" data-new aria-label="New goal">${ICONS.plus}</button></div></div>
    ${levelCard}
    ${checkCard}
    ${questCard}
    <div class="section-label">Debt bosses</div>
    <a class="card debt-card" href="#/debts">
      <span class="e">${activeOwes().length ? boss(debtPlan().order[0].debt).emoji : owes().length ? '🕊️' : '⚔️'}</span>
      <span class="mid"><b>${activeOwes().length ? `${activeOwes().length} to beat · ${moneyRound(totalOwed())}` : owes().length ? 'All bosses defeated' : 'Battle your debts'}</b>
        <small>${activeOwes().length ? `${owes().filter(isCleared).length} defeated · debt-free by ${esc(monthYear(debtPlan().date)) || '—'}` : 'Credit cards, loans, utang: +300 XP for each one you beat'}</small></span>
      <span class="btn small primary">Open</span>
    </a>
    <div class="section-label">Goals</div>
    ${goals.length ? goalCards : `<div class="card empty"><div class="big">🌰</div><h2>Plant your first <em>goal</em></h2><p>Emergency fund, a trip, a new phone… Every peso you add helps it grow from a seed into an avocado tree.</p><div class="btns"><button class="btn primary" data-new>Plant a goal</button></div></div>`}
    ${savingsIsSet() && goals.length ? `<p class="muted" style="font-size:13px;margin:-4px 4px 14px">In goals: ${moneyRound(allocated)} of your ${moneyRound(savingsBalance())} savings. <button data-savings style="color:var(--accent);font-weight:600">Update savings</button></p>` : ''}
    <div class="section-label">Badges</div>
    ${badgeGrid}
    <div class="section-label">How to earn XP</div>
    <div class="card tip-list" style="font-size:14px">
      <div class="tip"><h3>Log every day</h3><p>+10 XP per active day, +5 per expense (up to 6 a day), +10 per income.</p></div>
      <div class="tip"><h3>Feed your goals</h3><p>+20 XP per deposit (up to 3 a day), +250 XP when a goal is fully funded.</p></div>
      <div class="tip"><h3>Beat your debts</h3><p>+25 XP per debt payment, +300 XP per boss defeated, +100 XP when a loan you gave is paid back.</p></div>
      <div class="tip"><h3>Quests and badges</h3><p>Weekly quests give 30–80 XP each. Every badge is +50 XP.</p></div>
    </div>`;

  root.querySelectorAll('[data-new]').forEach((b) => (b.onclick = () => openGoalSheet()));
  root.querySelector('[data-savings]')?.addEventListener('click', openSavingsSheet);
  root.querySelectorAll('[data-goal]').forEach((b) => (b.onclick = () => {
    const x = state.goals.find((y) => y.id === b.dataset.goal);
    if (!x) return;
    if (x.saved >= x.target) openGoalSheet({ ...x });
    else openDepositSheet(x);
  }));
  root.querySelector('[data-checkin]')?.addEventListener('click', async () => {
    await checkIn();
  });
  root.querySelectorAll('[data-badge]').forEach((b) => (b.onclick = () => {
    const x = g.badges.find((y) => y.id === b.dataset.badge);
    openSheet({
      body: `<div class="celebrate"><div class="big" style="${x.earned ? '' : 'filter:grayscale(1);opacity:.4'}">${x.emoji}</div><h2>${esc(x.name)}</h2><p>${esc(x.desc)}${x.earned ? ' · Earned, +50 XP' : ' · Not yet'}</p><button class="btn primary block" data-ok>OK</button></div>`,
      onMount: (s, close) => (s.querySelector('[data-ok]').onclick = close),
    });
  }));
  if (unseen.length) markBadgesSeen(unseen);
}
