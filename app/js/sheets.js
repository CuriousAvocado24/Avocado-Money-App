// Shared edit sheets: expense, subscription/bill, settings, install help.
import { state, updateExpense, deleteExpense, restoreExpense, getReceipt, saveRecurring, deleteRecurring, markPaid, saveSettings, exportAll, importAll, eraseAll, clearDemo, hasDemo, insertDemo } from './store.js';
import { todayISO, addDays, addMonths, fmtShort, inDays } from './dates.js';
import { CATEGORIES, METHODS, cat, guessCategory } from './categories.js';
import { money, esc, CURRENCIES } from './format.js';
import { openSheet, confirmSheet, toast, saveFile, isStandalone } from './ui.js';
import { monthlyEquivalent } from './analytics.js';
import { makeDemo, DEMO_SETTINGS } from './demo.js';

const catOptions = (sel) => CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('');
const methodOptions = (sel) => METHODS.map((m) => `<option ${m.id === sel ? 'selected' : ''}>${esc(m.id)}</option>`).join('');
const num = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };

/* ---------------- Expense ---------------- */
export function openExpenseSheet(e) {
  openSheet({
    title: 'Edit expense',
    body: `<div class="form">
      <label>Amount<input class="field num" data-f="amount" inputmode="decimal" value="${e.amount}"></label>
      <label>Merchant / what for<input class="field" data-f="merchant" value="${esc(e.merchant)}" maxlength="60"></label>
      <label>Category<select class="field" data-f="category">${catOptions(e.category)}</select></label>
      <div class="row2">
        <label>Date<input class="field" type="date" data-f="date" value="${e.date}"></label>
        <label>Paid with<select class="field" data-f="method">${methodOptions(e.method)}</select></label>
      </div>
      <label>Note<input class="field" data-f="note" value="${esc(e.note)}" placeholder="Optional" maxlength="120"></label>
      ${e.recurringId ? '<p class="muted" style="font-size:13px">🔁 Logged automatically from Bills & subscriptions.</p>' : ''}
      <div data-receipt></div>
      <button class="btn primary block" data-save>Save changes</button>
      <button class="btn block danger" data-del>Delete expense</button>
    </div>`,
    onMount: async (s, close) => {
      const f = (k) => s.querySelector(`[data-f="${k}"]`);
      s.querySelector('[data-save]').onclick = async () => {
        const amount = num(f('amount').value);
        if (!(amount > 0)) { toast('Enter an amount'); return; }
        await updateExpense(e.id, { amount, merchant: f('merchant').value.trim(), category: f('category').value, date: f('date').value || e.date, method: f('method').value, note: f('note').value.trim() });
        close();
        toast('Saved');
      };
      s.querySelector('[data-del]').onclick = async () => {
        const removed = await deleteExpense(e.id);
        close();
        toast(`Deleted ${money(e.amount)}`, { label: 'Undo', run: () => restoreExpense(removed) });
      };
      if (e.receiptId) {
        const url = await getReceipt(e.receiptId);
        if (url) s.querySelector('[data-receipt]').innerHTML = `<label>Receipt<img class="receipt-img" src="${url}" alt="Receipt photo"></label>`;
      }
    },
  });
}

/* ---------------- Subscriptions & bills ---------------- */
export const PRESETS = [
  ['Netflix', 'subscriptions', 'subscription', '🎬'],
  ['Spotify', 'subscriptions', 'subscription', '🎵'],
  ['YouTube Premium', 'subscriptions', 'subscription', '▶️'],
  ['Disney+', 'subscriptions', 'subscription', '🏰'],
  ['iCloud+', 'subscriptions', 'subscription', '☁️'],
  ['Google One', 'subscriptions', 'subscription', '🗂️'],
  ['ChatGPT', 'subscriptions', 'subscription', '🤖'],
  ['Gym', 'health', 'subscription', '🏋️'],
  ['Meralco', 'bills', 'bill', '⚡'],
  ['Water', 'bills', 'bill', '💧'],
  ['Internet', 'bills', 'bill', '📶'],
  ['Mobile plan', 'bills', 'bill', '📱'],
  ['Rent', 'housing', 'bill', '🏠'],
  ['Insurance', 'bills', 'bill', '🛡️'],
  ['Loan', 'bills', 'bill', '🏦'],
  ['Credit card', 'bills', 'bill', '💳'],
];

export function openPresetPicker() {
  openSheet({
    title: 'Add subscription or bill',
    body: `<div class="preset-grid">${PRESETS.map((p, i) => `<button class="preset" data-p="${i}"><span class="e">${p[3]}</span>${esc(p[0])}</button>`).join('')}
      </div><div style="height:12px"></div><button class="btn block" data-custom>Something else…</button>`,
    onMount: (s, close) => {
      s.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => {
        const [name, category, kind] = PRESETS[+b.dataset.p];
        close();
        setTimeout(() => openRecurringSheet({ name, category, kind }), 200);
      }));
      s.querySelector('[data-custom]').onclick = () => { close(); setTimeout(() => openRecurringSheet({}), 200); };
    },
  });
}

export function openRecurringSheet(r0 = {}) {
  const isNew = !r0.id;
  const r = { name: '', amount: '', kind: 'subscription', freq: 'monthly', nextDue: addDays(todayISO(), 1), category: 'subscriptions', method: state.settings.lastMethod || 'Cash', autoLog: undefined, active: true, ...r0 };
  if (r.autoLog === undefined) r.autoLog = r.kind === 'subscription';
  openSheet({
    title: isNew ? 'New ' + (r.kind === 'bill' ? 'bill' : 'subscription') : r.name,
    body: `<div class="form">
      <div class="seg-ctl" data-kind><button data-k="subscription" class="${r.kind === 'subscription' ? 'on' : ''}">Subscription</button><button data-k="bill" class="${r.kind === 'bill' ? 'on' : ''}">Bill</button></div>
      <label>Name<input class="field" data-f="name" value="${esc(r.name)}" placeholder="e.g. Netflix" maxlength="40"></label>
      <div class="row2">
        <label>Amount<input class="field num" data-f="amount" inputmode="decimal" value="${r.amount}" placeholder="0"></label>
        <label>Repeats<select class="field" data-f="freq">
          ${[['weekly', 'Weekly'], ['monthly', 'Monthly'], ['quarterly', 'Every 3 months'], ['yearly', 'Yearly']].map(([v, l]) => `<option value="${v}" ${v === r.freq ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
      </div>
      <div class="row2">
        <label>Next due<input class="field" type="date" data-f="nextDue" value="${r.nextDue}"></label>
        <label>Paid with<select class="field" data-f="method">${methodOptions(r.method)}</select></label>
      </div>
      <label>Category<select class="field" data-f="category">${catOptions(r.category)}</select></label>
      <div class="toggle-row"><span class="lbl">Log automatically<small>Adds the expense on the due date. Turn off for bills that change each month.</small></span>
        <label class="switch"><input type="checkbox" data-f="autoLog" ${r.autoLog ? 'checked' : ''}><span></span></label></div>
      ${!isNew ? `<div class="toggle-row"><span class="lbl">Active<small>Pause instead of deleting</small></span><label class="switch"><input type="checkbox" data-f="active" ${r.active ? 'checked' : ''}><span></span></label></div>` : ''}
      <p class="muted" data-yearly style="font-size:13px"></p>
      <button class="btn primary block" data-save>${isNew ? 'Add' : 'Save changes'}</button>
      ${!isNew ? '<button class="btn block danger" data-del>Delete</button>' : ''}
    </div>`,
    onMount: (s, close) => {
      const f = (k) => s.querySelector(`[data-f="${k}"]`);
      let kind = r.kind;
      const upd = () => {
        const a = num(f('amount').value);
        s.querySelector('[data-yearly]').textContent = a > 0 ? `≈ ${money(monthlyEquivalent({ amount: a, freq: f('freq').value }))} a month · ${money(monthlyEquivalent({ amount: a, freq: f('freq').value }) * 12)} a year` : '';
      };
      f('amount').addEventListener('input', upd);
      f('freq').addEventListener('change', upd);
      f('name').addEventListener('change', () => { if (isNew) { const g = guessCategory(f('name').value); if (g) f('category').value = g; } });
      upd();
      s.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => {
        kind = b.dataset.k;
        s.querySelectorAll('[data-k]').forEach((x) => x.classList.toggle('on', x === b));
        if (isNew) {
          f('autoLog').checked = kind === 'subscription';
          if (kind === 'bill' && f('category').value === 'subscriptions') f('category').value = 'bills';
          if (kind === 'subscription' && f('category').value === 'bills') f('category').value = 'subscriptions';
        }
      }));
      if (isNew && !r.name) setTimeout(() => f('name').focus(), 300);
      else if (isNew && !r.amount) setTimeout(() => f('amount').focus(), 300);
      s.querySelector('[data-save]').onclick = async () => {
        const name = f('name').value.trim();
        const amount = num(f('amount').value);
        if (!name) return toast('Give it a name');
        if (!(amount > 0)) return toast('Enter the amount');
        const nextDue = f('nextDue').value || todayISO();
        await saveRecurring({ ...r, name, amount, kind, freq: f('freq').value, nextDue, method: f('method').value, category: f('category').value, autoLog: f('autoLog').checked, active: f('active') ? f('active').checked : true });
        close();
        toast(isNew ? `Added ${name}` : 'Saved');
      };
      s.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (await confirmSheet({ title: `Delete ${r.name}?`, message: 'Past expenses it logged stay in your history.', confirm: 'Delete', danger: true })) {
          await deleteRecurring(r.id);
          close();
          toast('Deleted');
        }
      });
    },
  });
}

export function openPaySheet(r, date) {
  openSheet({
    title: `Pay ${r.name}`,
    body: `<div class="form">
      <p class="text-2" style="font-size:14px">Due ${fmtShort(date)} (${inDays(date)}). Bills vary — enter what you actually paid.</p>
      <label>Amount paid<input class="field num" data-a inputmode="decimal" value="${r.amount}"></label>
      <label>Paid on<input class="field" type="date" data-d value="${todayISO()}"></label>
      <button class="btn primary block" data-ok>Mark as paid</button>
    </div>`,
    onMount: (s, close) => {
      s.querySelector('[data-ok]').onclick = async () => {
        const a = num(s.querySelector('[data-a]').value);
        if (!(a > 0)) return toast('Enter the amount');
        await markPaid(r, a, s.querySelector('[data-d]').value || todayISO());
        close();
        toast(`${r.name} paid · next due ${fmtShort(r.nextDue)}`);
      };
    },
  });
}

/* ---------------- Settings ---------------- */
export function openSettings() {
  const st = state.settings;
  openSheet({
    title: 'Settings',
    tall: true,
    body: `<div class="form">
      <div class="section-label" style="margin-top:0">Money</div>
      <label>Monthly take-home income<input class="field num" data-f="monthlyIncome" inputmode="decimal" value="${st.monthlyIncome || ''}" placeholder="Optional — unlocks the 50/30/20 check"></label>
      <label>Monthly spending budget<input class="field num" data-f="monthlyBudget" inputmode="decimal" value="${st.monthlyBudget || ''}" placeholder="e.g. 30000"></label>
      <button class="btn block" data-suggest>Suggest a budget for me</button>
      <button class="btn block" data-catbudgets>Category budgets ›</button>
      <label>Currency<select class="field" data-f="currency">${CURRENCIES.map(([c, n]) => `<option value="${c}" ${c === st.currency ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label>When I open the app, show<select class="field" data-f="openTo"><option value="add" ${st.openTo === 'add' ? 'selected' : ''}>Quick add (fastest)</option><option value="home" ${st.openTo === 'home' ? 'selected' : ''}>Dashboard</option></select></label>
      <button class="btn primary block" data-save>Save</button>

      <div class="section-label">Your data</div>
      <div class="option-list">
        <button class="option" data-x="csv">📄 Export spreadsheet (CSV)</button>
        <button class="option" data-x="backup">💾 Back up everything</button>
        <button class="option" data-x="restore">♻️ Restore from backup</button>
        ${hasDemo() ? '<button class="option" data-x="cleardemo">🧹 Remove demo data</button>' : '<button class="option" data-x="demo">🧪 Load demo data</button>'}
        <button class="option" data-x="install">📲 Install on Home Screen</button>
        <button class="option danger" data-x="erase">Erase all data</button>
      </div>
      <input type="file" accept="application/json,.json" data-restore hidden>
      <p class="muted" style="font-size:12.5px;text-align:center;margin-top:6px">Everything is stored only on this iPhone. Back up regularly — deleting the app deletes its data.<br>Gastos 1.0</p>
    </div>`,
    onMount: (s, close) => {
      const f = (k) => s.querySelector(`[data-f="${k}"]`);
      s.querySelector('[data-save]').onclick = async () => {
        await saveSettings({ monthlyIncome: num(f('monthlyIncome').value), monthlyBudget: num(f('monthlyBudget').value), currency: f('currency').value, openTo: f('openTo').value, demoSettings: false });
        close();
        toast('Settings saved');
      };
      s.querySelector('[data-suggest]').onclick = () => {
        const inc = num(f('monthlyIncome').value);
        const recent = suggestBudget(inc);
        if (!recent) return toast('Add your income or a few weeks of expenses first');
        f('monthlyBudget').value = Math.round(recent);
        toast(inc ? 'Set to 80% of income (needs + wants), leaving 20% to save' : 'Set to 90% of your recent monthly average');
      };
      s.querySelector('[data-catbudgets]').onclick = () => { close(); setTimeout(openCategoryBudgets, 220); };
      const restoreInput = s.querySelector('[data-restore]');
      restoreInput.onchange = async () => {
        const file = restoreInput.files[0];
        if (!file) return;
        try {
          const data = JSON.parse(await file.text());
          if (!(await confirmSheet({ title: 'Restore backup?', message: `This replaces everything on this phone with the backup (${data.expenses?.length || 0} expenses).`, confirm: 'Restore', danger: true }))) return;
          await importAll(data);
          close();
          toast('Backup restored');
        } catch (err) {
          toast(err.message || 'That file could not be read');
        }
      };
      s.querySelectorAll('[data-x]').forEach((b) => (b.onclick = async () => {
        const x = b.dataset.x;
        if (x === 'csv') {
          const rows = [['Date', 'Amount', 'Category', 'Merchant', 'Paid with', 'Note']].concat(
            state.expenses.map((e) => [e.date, e.amount, cat(e.category).name, e.merchant, e.method, e.note])
          );
          const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
          saveFile(`gastos-${todayISO()}.csv`, csv, 'text/csv');
        } else if (x === 'backup') {
          saveFile(`gastos-backup-${todayISO()}.json`, JSON.stringify(await exportAll()), 'application/json');
        } else if (x === 'restore') restoreInput.click();
        else if (x === 'demo') {
          const d = makeDemo();
          const patch = !state.settings.monthlyIncome && !state.settings.monthlyBudget ? DEMO_SETTINGS : null;
          await insertDemo(d.expenses, d.recurring, patch);
          close();
          toast('Demo data loaded — remove it any time in Settings');
          location.hash = '#/home';
        } else if (x === 'cleardemo') {
          await clearDemo();
          close();
          toast('Demo data removed');
        } else if (x === 'install') { close(); setTimeout(openInstallHelp, 220); }
        else if (x === 'erase') {
          if (await confirmSheet({ title: 'Erase everything?', message: 'All expenses, bills, receipts and settings on this phone will be deleted. This cannot be undone.', confirm: 'Erase all data', danger: true })) {
            await eraseAll();
            close();
            toast('All data erased');
          }
        }
      }));
    },
  });
}

function suggestBudget(income) {
  if (income > 0) return income * 0.8;
  const t = todayISO();
  const recent = state.expenses.filter((e) => e.date >= addMonths(t, -3) && e.date < t.slice(0, 7) + '-01');
  if (!recent.length) return 0;
  const months = new Set(recent.map((e) => e.date.slice(0, 7))).size;
  return (recent.reduce((a, e) => a + e.amount, 0) / months) * 0.9;
}

function openCategoryBudgets() {
  const b = state.settings.categoryBudgets || {};
  openSheet({
    title: 'Category budgets',
    tall: true,
    body: `<div class="form">
      <p class="text-2" style="font-size:14px">Optional monthly limits. Leave blank for no limit. They show as progress bars on the dashboard.</p>
      ${CATEGORIES.filter((c) => c.id !== 'other').map((c) => `<label>${c.emoji} ${esc(c.name)}<input class="field num" inputmode="decimal" data-c="${c.id}" value="${b[c.id] || ''}" placeholder="No limit"></label>`).join('')}
      <button class="btn primary block" data-save>Save</button></div>`,
    onMount: (s, close) => {
      s.querySelector('[data-save]').onclick = async () => {
        const out = {};
        s.querySelectorAll('[data-c]').forEach((i) => { const v = num(i.value); if (v > 0) out[i.dataset.c] = v; });
        await saveSettings({ categoryBudgets: out, demoSettings: false });
        close();
        toast('Category budgets saved');
      };
    },
  });
}

export function openInstallHelp() {
  saveSettings({ installHintShown: true });
  const installed = isStandalone();
  openSheet({
    title: installed ? 'Quick add from your Home Screen' : 'Install Gastos on your iPhone',
    body: `<div class="form">
      ${installed ? '' : `<ol class="steps">
        <li>Open this page in <b>Safari</b>.</li>
        <li>Tap the <b>Share</b> button (square with an arrow ↑).</li>
        <li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
        <li>Open Gastos from the new icon — it runs full-screen and works offline.</li>
      </ol>`}
      <div class="section-label">Make it a one-tap "widget"</div>
      <ol class="steps">
        <li>Put the Gastos icon in your <b>Dock</b> or on your first Home Screen page.</li>
        <li>Gastos opens straight to Quick Add: type the amount, tap a category, Save. About 3 seconds.</li>
        <li>Tap the <b>camera</b> button to snap a receipt — the amount, store and date are filled in for you.</li>
      </ol>
      <button class="btn primary block" data-ok>Got it</button>
    </div>`,
    onMount: (s, close) => (s.querySelector('[data-ok]').onclick = close),
  });
}
