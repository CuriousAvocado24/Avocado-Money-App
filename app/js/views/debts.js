// Debts: boss battles. Each debt you owe is a boss with HP; every payment is a hit.
import { state, saveDebt, deleteDebt, debtHistory, addExpense, adjustSavings, saveSettings, savingsIsSet } from '../store.js';
import { todayISO, fmtShort, addMonths } from '../dates.js';
import { money, moneyRound, esc, pct, plural } from '../format.js';
import { ICONS, openSheet, confirmSheet, toast, celebrate } from '../ui.js';
import { DEBT_TYPES, debtType, debtTotal, debtPaid, debtLeft, isCleared, owes, owedToMe, plannedPayment, payoff, debtPlan, monthYear, boss, totalOwed, totalOwedToMe, monthlyInterest } from '../debts.js';

const num = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };

export function render(root) {
  const strategy = state.settings.debtStrategy || 'avalanche';
  const plan = debtPlan(strategy);
  const active = owes().filter((d) => !isCleared(d));
  const defeated = owes().filter((d) => isCleared(d));
  const lent = owedToMe();
  const allOwe = owes();
  const totalBorrowed = allOwe.reduce((a, d) => a + debtTotal(d), 0);
  const totalPaid = allOwe.reduce((a, d) => a + Math.min(debtPaid(d), debtTotal(d)), 0);
  const owed = totalOwed();
  const target = plan.order[0]?.debt;

  const summary = allOwe.length ? `
    <div class="card savings-card">
      <span class="avo" aria-hidden="true">⚔️</span>
      <div class="hero-label">${active.length ? 'You owe' : 'Debt status'}</div>
      <div class="hero-num">${active.length ? moneyRound(owed) : 'Debt-free 🕊️'}</div>
      <div class="hero-sub">${active.length
        ? plan.stuck ? 'At these payments one debt never shrinks. Raise its payment below.' : `Debt-free by <b>${esc(monthYear(plan.date))}</b> (${plural(plan.months, 'month')}) paying ${moneyRound(plan.budget)}/month`
        : `You beat ${plural(defeated.length, 'boss', 'bosses')}. Keep it that way.`}</div>
      <div class="flow">
        <div><small>Paid off</small><b>${moneyRound(totalPaid)}</b></div>
        <div><small>Progress</small><b>${totalBorrowed ? pct(totalPaid / totalBorrowed) : '—'}</b></div>
        <div><small>Interest/mo</small><b>${moneyRound(monthlyInterest())}</b></div>
      </div>
    </div>` : '';

  const strategyCard = active.length > 1 ? `
    <div class="card">
      <div class="card-title"><h2>Battle <em>plan</em></h2></div>
      <div class="seg-ctl" style="margin-bottom:10px"><button data-strat="avalanche" class="${strategy === 'avalanche' ? 'on' : ''}">🏔️ Avalanche</button><button data-strat="snowball" class="${strategy === 'snowball' ? 'on' : ''}">⛄ Snowball</button></div>
      <p class="text-2" style="font-size:14px">${strategy === 'avalanche'
        ? 'Pay minimums on everything, then throw every extra peso at the <b>highest interest</b> debt. Saves the most money.'
        : 'Pay minimums on everything, then throw every extra peso at the <b>smallest</b> debt. Quick wins keep you motivated.'}
      When a boss falls, its payment rolls onto the next one.</p>
      <p style="font-size:14px;margin-top:8px">Total interest on this plan: <b>${moneyRound(plan.interest)}</b></p>
    </div>` : '';

  const bossCard = (d, planned) => {
    const left = debtLeft(d);
    const total = debtTotal(d);
    const b = boss(d);
    const t = debtType(d.type);
    const pay = plannedPayment(d);
    const p = payoff(left, d.rate, pay);
    const isTarget = target && target.id === d.id && active.length > 1;
    return `
      <div class="card boss ${isTarget ? 'target' : ''}">
        <button class="goal" data-debt="${d.id}">
          <div class="g-top">
            <span class="plant" aria-hidden="true">${b.emoji}</span>
            <div style="min-width:0">
              <h3>${esc(d.name)}</h3>
              <div class="g-sub">${t.emoji} ${esc(t.name)}${Number(d.rate) ? ` · ${d.rate}%/mo` : ''}${d.dueDay ? ` · due every ${d.dueDay}${['th', 'st', 'nd', 'rd'][(d.dueDay % 10 < 4 && Math.floor(d.dueDay / 10) !== 1) ? d.dueDay % 10 : 0]}` : ''}</div>
            </div>
            <div class="g-amt">${moneyRound(left)}<small>of ${moneyRound(total)}</small></div>
          </div>
          ${isTarget ? '<div class="badge accent" style="margin-top:10px">🎯 Attack this one next</div>' : ''}
          <div class="hp" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${left}" aria-label="${esc(d.name)} remaining"><i style="width:${total ? ((left / total) * 100).toFixed(1) : 0}%"></i><span>HP ${pct(total ? left / total : 0)}</span></div>
          <div class="g-foot">
            <span>${p || planned?.date ? `${moneyRound(pay)}/mo · defeated ${esc(monthYear(planned?.date || addMonthsISO(p.months)))}` : `<span class="status bad">${moneyRound(pay)}/mo doesn't cover the interest</span>`}</span>
            <span class="btn small primary" role="button">⚔️ Pay</span>
          </div>
        </button>
      </div>`;
  };

  const lentRow = (d) => {
    const left = debtLeft(d);
    const total = debtTotal(d);
    return `<button class="row" data-debt="${d.id}">
      <span class="e">${isCleared(d) ? '✅' : '🤝'}</span>
      <div class="main"><div class="t1">${esc(d.name)}</div><div class="t2">${isCleared(d) ? 'Paid you back in full' : `${moneyRound(total - left)} of ${moneyRound(total)} back${d.dueDate ? ' · expected ' + esc(fmtShort(d.dueDate)) : ''}`}</div></div>
      <div class="right"><div class="amt">${moneyRound(left)}</div>${isCleared(d) ? '' : '<span class="btn small" role="button" style="margin-top:4px">Collect</span>'}</div>
    </button>`;
  };

  root.innerHTML = `
    <div class="page-head"><h1>Beat your <em>debts</em></h1><div class="head-actions"><button class="icon-btn accent" data-new aria-label="Add a debt">${ICONS.plus}</button></div></div>
    ${summary}
    ${strategyCard}
    ${active.length ? `<div class="section-label">Bosses to beat</div>${plan.order.map((o) => bossCard(o.debt, o)).join('')}` : ''}
    ${!allOwe.length ? `<div class="card empty"><div class="big">⚔️</div><h2>No debts <em>yet</em></h2><p>Add credit cards, loans, SPayLater/GGives, or money you owe family. Each one becomes a boss: every payment knocks off HP, and beating one earns 300 XP.</p><div class="btns"><button class="btn primary" data-new>Add a debt</button></div></div>` : ''}
    ${defeated.length ? `<div class="section-label">Defeated 🏆</div><div class="list">${defeated.map((d) => `<button class="row" data-debt="${d.id}"><span class="e">🏆</span><div class="main"><div class="t1">${esc(d.name)}</div><div class="t2">Paid off · ${moneyRound(debtTotal(d))}</div></div><div class="right"><span class="badge accent">+300 XP</span></div></button>`).join('')}</div>` : ''}
    <div class="section-label">Owed to me</div>
    ${lent.length ? `<div class="list">${lent.map(lentRow).join('')}</div><p class="muted" style="font-size:13px;margin:-6px 4px 14px">Total waiting to come back: ${moneyRound(totalOwedToMe())}</p>` : `<div class="card muted" style="font-size:14px">Lent money to someone? Track it here so it doesn't get forgotten. <button data-new-owed style="color:var(--accent);font-weight:600">Add one</button></div>`}
    <div class="card tip-list" style="font-size:14px">
      <div class="tip"><h3>Debt XP</h3><p>+25 XP per payment (up to 3 a day), +300 XP for every boss defeated, +100 XP when someone pays you back in full. Badges: First strike, Halfway there, Boss slayer, Triple slayer, Steady payer, Debt-free, and Collector.</p></div>
    </div>`;

  root.querySelectorAll('[data-new]').forEach((b) => (b.onclick = () => openDebtSheet({ kind: 'owe' })));
  root.querySelector('[data-new-owed]')?.addEventListener('click', () => openDebtSheet({ kind: 'owed' }));
  root.querySelectorAll('[data-strat]').forEach((b) => (b.onclick = () => saveSettings({ debtStrategy: b.dataset.strat })));
  root.querySelectorAll('[data-debt]').forEach((b) => (b.onclick = (ev) => {
    const d = state.debts.find((x) => x.id === b.dataset.debt);
    if (!d) return;
    if (isCleared(d)) return openDebtSheet({ ...d });
    openPayDebtSheet(d);
  }));
}

const addMonthsISO = (m) => addMonths(todayISO(), m);

/* ---------------- Sheets ---------------- */

export function openDebtSheet(d0 = {}) {
  const isNew = !d0.id;
  const d = { kind: 'owe', type: 'card', name: '', original: '', rate: '', minPay: '', plan: '', dueDay: '', dueDate: '', ...d0 };
  const owed = d.kind === 'owed';
  openSheet({
    title: isNew ? (owed ? 'Money owed to me' : 'Add a debt') : d.name,
    body: `<div class="form">
      ${isNew ? `<div class="seg-ctl" data-kind><button data-k="owe" class="${owed ? '' : 'on'}">I owe</button><button data-k="owed" class="${owed ? 'on' : ''}">Owed to me</button></div>` : ''}
      <div data-owe-only style="${owed ? 'display:none' : ''}">
        <div class="preset-grid">${DEBT_TYPES.map((t) => `<button class="preset ${t.id === d.type ? 'on-preset' : ''}" data-type="${t.id}"><span class="e">${t.emoji}</span>${esc(t.name)}</button>`).join('')}</div>
      </div>
      <label><span data-name-lbl>${owed ? 'Who owes you?' : 'Name'}</span><input class="field" data-f="name" value="${esc(d.name)}" placeholder="${owed ? 'e.g. Mark' : 'e.g. BPI credit card'}" maxlength="40"></label>
      <label><span data-amt-lbl>${owed ? 'Amount they owe' : isNew ? 'How much you owe right now' : 'Starting balance'}</span><input class="field num" data-f="original" inputmode="decimal" value="${d.original}" placeholder="0"></label>
      <div data-owe-only style="${owed ? 'display:none' : ''}" class="form">
        <div class="row2">
          <label>Interest % per month<input class="field num" data-f="rate" inputmode="decimal" value="${d.rate}" placeholder="${debtType(d.type).rate || 0}"></label>
          <label>Due day of month<input class="field num" data-f="dueDay" inputmode="numeric" value="${d.dueDay}" placeholder="e.g. 15"></label>
        </div>
        <div class="row2">
          <label>Minimum payment<input class="field num" data-f="minPay" inputmode="decimal" value="${d.minPay}" placeholder="0"></label>
          <label>I plan to pay /mo<input class="field num" data-f="plan" inputmode="decimal" value="${d.plan}" placeholder="optional"></label>
        </div>
        <p class="muted" data-proj style="font-size:13px"></p>
      </div>
      <div data-owed-only style="${owed ? '' : 'display:none'}" class="form">
        <label>Expect it back by (optional)<input class="field" type="date" data-f="dueDate" value="${d.dueDate || ''}"></label>
        ${isNew && savingsIsSet() ? `<div class="toggle-row"><span class="lbl">Take it out of my savings<small>Turn off if you lent it a while ago and your savings number already reflects it.</small></span><label class="switch"><input type="checkbox" data-f="fromSavings" checked><span></span></label></div>` : ''}
      </div>
      <button class="btn primary block" data-save>${isNew ? (owed ? 'Add' : '⚔️ Add boss') : 'Save changes'}</button>
      ${!isNew ? `<button class="btn block" data-more>${owed ? '+ Lent more' : '+ Borrowed more'}</button><button class="btn block danger" data-del>Delete</button>` : ''}
    </div>`,
    onMount: (s, close) => {
      const f = (k) => s.querySelector(`[data-f="${k}"]`);
      let kind = d.kind;
      let type = d.type;
      const proj = () => {
        const el = s.querySelector('[data-proj]');
        const bal = num(f('original').value);
        const pay = num(f('plan').value) || num(f('minPay').value);
        if (!bal || !pay) { el.textContent = ''; return; }
        const p = payoff(bal, f('rate').value === '' ? debtType(type).rate : num(f('rate').value), pay);
        el.textContent = p ? `Paying ${money(pay)}/month: defeated in ${plural(p.months, 'month')}, about ${money(Math.round(p.interest))} in interest.` : `${money(pay)}/month doesn't cover the interest. Pay more or this debt keeps growing.`;
      };
      ['original', 'rate', 'minPay', 'plan'].forEach((k) => f(k).addEventListener('input', proj));
      proj();
      s.querySelectorAll('[data-type]').forEach((b) => (b.onclick = () => {
        type = b.dataset.type;
        s.querySelectorAll('[data-type]').forEach((x) => x.classList.toggle('on-preset', x === b));
        if (f('rate').value === '') f('rate').placeholder = String(debtType(type).rate);
        if (!f('name').value) f('name').placeholder = `e.g. ${debtType(type).name}`;
        proj();
      }));
      s.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => {
        kind = b.dataset.k;
        s.querySelectorAll('[data-k]').forEach((x) => x.classList.toggle('on', x === b));
        s.querySelectorAll('[data-owe-only]').forEach((x) => (x.style.display = kind === 'owe' ? '' : 'none'));
        s.querySelectorAll('[data-owed-only]').forEach((x) => (x.style.display = kind === 'owed' ? '' : 'none'));
        s.querySelector('[data-name-lbl]').textContent = kind === 'owed' ? 'Who owes you?' : 'Name';
        s.querySelector('[data-amt-lbl]').textContent = kind === 'owed' ? 'Amount they owe' : 'How much you owe right now';
      }));
      if (isNew) setTimeout(() => f('name').focus(), 300);
      s.querySelector('[data-save]').onclick = async () => {
        const name = f('name').value.trim() || (kind === 'owe' ? debtType(type).name : '');
        const original = num(f('original').value);
        if (!name) return toast('Give it a name');
        if (!(original > 0)) return toast('Enter the amount');
        const out = { ...d, kind, name, original };
        if (kind === 'owe') Object.assign(out, { type, rate: f('rate').value === '' ? debtType(type).rate : num(f('rate').value), minPay: num(f('minPay').value), plan: num(f('plan').value), dueDay: Math.min(31, Math.max(0, Math.round(num(f('dueDay').value)))) || '' });
        else out.dueDate = f('dueDate').value || '';
        await saveDebt(out);
        if (isNew && kind === 'owed' && f('fromSavings')?.checked) await adjustSavings(-original);
        close();
        toast(isNew ? (kind === 'owe' ? `⚔️ ${name} joined the battle` : `Tracking ${money(original)} from ${name}`) : 'Saved');
      };
      s.querySelector('[data-more]')?.addEventListener('click', () => { close(); setTimeout(() => openMoreSheet(d), 220); });
      s.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (await confirmSheet({ title: `Delete ${d.name}?`, message: 'Payments you logged stay in your spending history.', confirm: 'Delete', danger: true })) {
          await deleteDebt(d.id);
          close();
          toast('Deleted');
        }
      });
    },
  });
}

function openMoreSheet(d) {
  const owed = d.kind === 'owed';
  openSheet({
    title: owed ? `Lent more to ${d.name}` : `Borrowed more on ${d.name}`,
    body: `<div class="form"><label>Amount<input class="field num" data-a inputmode="decimal" placeholder="0"></label>
      ${owed && savingsIsSet() ? `<div class="toggle-row"><span class="lbl">Take it out of my savings</span><label class="switch"><input type="checkbox" data-s checked><span></span></label></div>` : ''}
      <button class="btn primary block" data-ok>Add to balance</button></div>`,
    onMount: (s, close) => {
      setTimeout(() => s.querySelector('[data-a]').focus(), 300);
      s.querySelector('[data-ok]').onclick = async () => {
        const v = num(s.querySelector('[data-a]').value);
        if (!(v > 0)) return toast('Enter an amount');
        await debtHistory(d, 'add', v);
        if (owed && s.querySelector('[data-s]')?.checked) await adjustSavings(-v);
        close();
        toast(`${d.name} is now ${money(debtLeft(d))}`);
      };
    },
  });
}

export function openPayDebtSheet(d) {
  const owed = d.kind === 'owed';
  const left = debtLeft(d);
  const quick = owed ? [] : [Number(d.minPay) || 0, plannedPayment(d)].filter((v, i, a) => v > 0 && v < left && a.indexOf(v) === i);
  openSheet({
    title: owed ? `${d.name} paid you back?` : `Attack ${d.name} ${boss(d).emoji}`,
    body: `<div class="form">
      <p class="text-2" style="font-size:14px">${money(left)} left${owed ? ' to collect' : ` · HP ${pct(left / (debtTotal(d) || 1))}`}</p>
      <label>${owed ? 'Amount received' : 'Payment amount'}<input class="field num" data-a inputmode="decimal" placeholder="0"></label>
      <div class="chips" style="margin:0">${quick.map((v) => `<button class="chip" data-q="${v}">${v === Number(d.minPay) ? 'Minimum' : 'Planned'} ${money(v)}</button>`).join('')}<button class="chip" data-q="${left}">${owed ? 'All' : 'Pay it all'} ${money(left)}</button></div>
      <label>Date<input class="field" type="date" data-d value="${todayISO()}"></label>
      ${owed && savingsIsSet() ? `<div class="toggle-row"><span class="lbl">Add it to my savings</span><label class="switch"><input type="checkbox" data-s checked><span></span></label></div>` : ''}
      ${owed ? '' : '<p class="muted" style="font-size:13px">Logged as a "Debt payments" expense, so it comes out of your savings and shows in your spending.</p>'}
      <button class="btn primary block" data-ok>${owed ? 'Collect' : '⚔️ Pay'}</button>
      <button class="btn block" data-edit>Edit ${owed ? 'details' : 'debt'}</button>
    </div>`,
    onMount: (s, close) => {
      const a = s.querySelector('[data-a]');
      setTimeout(() => a.focus(), 300);
      s.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { a.value = b.dataset.q; }));
      s.querySelector('[data-edit]').onclick = () => { close(); setTimeout(() => openDebtSheet({ ...d }), 220); };
      s.querySelector('[data-ok]').onclick = async () => {
        const v = Math.min(num(a.value), left);
        if (!(v > 0)) return toast('Enter an amount');
        const date = s.querySelector('[data-d]').value || todayISO();
        if (owed) {
          await debtHistory(d, 'collect', v, date);
          if (s.querySelector('[data-s]')?.checked) await adjustSavings(v);
        } else {
          await addExpense({ amount: v, category: 'debt', merchant: d.name, date, method: d.type === 'card' ? 'Bank transfer' : state.settings.lastMethod || 'Cash', debtId: d.id });
        }
        close();
        if (isCleared(d)) {
          celebrate(owed
            ? { emoji: '🤝', title: 'Paid back in <em>full</em>', text: `${d.name} paid you back everything. +100 XP.` }
            : { emoji: '🏆', title: 'Boss <em>defeated</em>', text: `${d.name} is paid off: ${money(debtTotal(d))} gone for good. +300 XP.` });
        } else toast(owed ? `+${money(v)} back from ${d.name}` : `⚔️ −${money(v)} HP · ${money(debtLeft(d))} left`);
      };
    },
  });
}

/** Quick Add helper: link a "Debt payments" expense to one of your debts. */
export async function linkDebtPayment(expense) {
  const list = owes().filter((d) => !isCleared(d));
  if (!list.length) return;
  const { pickSheet } = await import('../ui.js');
  const id = await pickSheet({ title: 'Which debt was this for?', options: list.map((d) => ({ value: d.id, label: `${boss(d).emoji}  ${d.name}`, sub: moneyRound(debtLeft(d)) })).concat([{ value: null, label: 'None of these' }]) });
  if (!id) return;
  const { updateExpense } = await import('../store.js');
  await updateExpense(expense.id, { debtId: id });
  const d = state.debts.find((x) => x.id === id);
  if (d && isCleared(d)) celebrate({ emoji: '🏆', title: 'Boss <em>defeated</em>', text: `${d.name} is paid off. +300 XP.` });
}
