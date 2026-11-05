// Quick Add — the screen the app opens to. Amount → (merchant) → category → Save.
import { state, addExpense, deleteExpense, addIncome, deleteIncome, saveSettings, saveReceipt, normMerchant, savingsBalance, savingsIsSet } from '../store.js';
import { todayISO, addDays, fmtDay } from '../dates.js';
import { cat, categoriesByUse, guessCategory, METHODS, methodEmoji, INCOME_SOURCES, src, guessSource } from '../categories.js';
import { money, esc, currencySymbol } from '../format.js';
import { ICONS, toast, openSheet, pickSheet } from '../ui.js';
import { scanReceipt, compressPhoto, parseMessage } from '../receipt.js';

const fresh = () => ({ amount: '', merchant: '', category: null, catTouched: false, date: todayISO(), method: state.settings.lastMethod || 'Cash', receiptId: null, receiptThumb: null });
let draft = null;
let el = null;
let lastCat = null;
let mode = 'expense'; // or 'income'

/** Open Quick Add in a given mode (the dashboard's "Add income" button uses this). */
export function setMode(m) {
  if (m !== mode) { mode = m; draft = fresh(); }
}

export function render(root) {
  el = root;
  if (!draft) draft = fresh();
  if (!draft.amount && !draft.merchant && draft.date !== todayISO() && !draft.catTouched) draft.date = todayISO();
  const inc = mode === 'income';
  const cats = inc ? INCOME_SOURCES : categoriesByUse();
  const recents = inc ? recentSources() : recentMerchants();
  root.innerHTML = `
  <div class="qa ${inc ? 'qa-income' : ''}">
    <div class="seg-ctl qa-mode" role="tablist" aria-label="Entry type">
      <button role="tab" data-mode="expense" class="${inc ? '' : 'on'}" aria-selected="${!inc}">− Expense</button>
      <button role="tab" data-mode="income" class="${inc ? 'on' : ''}" aria-selected="${inc}">+ Income</button>
    </div>
    <div class="qa-top">
      <button class="pill" data-act="date">📅 <span data-date>${esc(fmtDay(draft.date))}</span></button>
      ${inc ? '' : `<button class="pill" data-act="method"><span data-method>${methodEmoji(draft.method)} ${esc(draft.method)}</span></button>`}
      <span class="spacer"></span>
      ${inc ? '' : `<button class="icon-btn" data-act="paste" aria-label="Paste a payment SMS">${ICONS.paste}</button>
      <button class="icon-btn accent" data-act="scan" aria-label="Scan a receipt">${ICONS.camera}</button>`}
    </div>
    <div class="qa-amount num" data-amount aria-live="polite"></div>
    <div class="qa-receipt" data-receipt></div>
    <input class="field" data-merchant placeholder="${inc ? 'From? e.g. Salary, client name, Mama' : 'What for? e.g. Jollibee, Grab, Meralco'}" value="${esc(draft.merchant)}" autocomplete="off" autocorrect="off" enterkeyhint="done" maxlength="60">
    ${recents.length ? `<div class="chips" data-recents>${recents.map((r, i) => `<button class="chip" data-recent="${i}">${inc ? src(r.category).emoji : cat(r.category).emoji} ${esc(r.merchant)}</button>`).join('')}</div>` : ''}
    <div class="cats ${inc ? 'one-row' : ''}" data-cats role="radiogroup" aria-label="${inc ? 'Income type' : 'Category'}">
      ${cats.map((c) => `<button class="cat" role="radio" data-cat="${c.id}"><span class="e">${c.emoji}</span>${esc(c.short)}</button>`).join('')}
    </div>
    <div class="keypad">
      ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((k) => `<button class="key" data-key="${k}" aria-label="${k === 'del' ? 'Delete' : k}">${k === 'del' ? ICONS.del : k}</button>`).join('')}
    </div>
    <button class="btn primary save-btn" data-act="save">Save</button>
  </div>`;

  const merchantInput = root.querySelector('[data-merchant]');
  merchantInput.addEventListener('input', () => {
    draft.merchant = merchantInput.value;
    if (!draft.catTouched) draft.category = mode === 'income' ? guessSource(draft.merchant) : guessCategory(draft.merchant);
    paint();
  });
  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.mode === mode) return;
    const keep = draft.amount;
    mode = b.dataset.mode;
    draft = fresh();
    draft.amount = keep;
    lastCat = null;
    render(root);
  }));
  merchantInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') merchantInput.blur(); });

  root.querySelectorAll('[data-key]').forEach((b) => b.addEventListener('click', () => press(b.dataset.key)));
  root.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    draft.category = draft.category === b.dataset.cat && draft.catTouched ? null : b.dataset.cat;
    draft.catTouched = !!draft.category;
    paint();
  }));
  root.querySelectorAll('[data-recent]').forEach((b) => b.addEventListener('click', () => {
    const r = recents[+b.dataset.recent];
    draft.merchant = r.merchant;
    draft.category = r.category;
    draft.catTouched = true;
    if (!draft.amount && r.lastAmount) draft.amount = String(r.lastAmount);
    merchantInput.value = r.merchant;
    paint();
  }));
  root.querySelector('[data-act="save"]').addEventListener('click', save);
  root.querySelector('[data-act="scan"]')?.addEventListener('click', () => document.getElementById('receipt-input').click());
  root.querySelector('[data-act="paste"]')?.addEventListener('click', pasteSheet);
  root.querySelector('[data-act="date"]').addEventListener('click', pickDate);
  root.querySelector('[data-act="method"]')?.addEventListener('click', async () => {
    const v = await pickSheet({ title: 'Paid with', value: draft.method, options: METHODS.map((m) => ({ value: m.id, label: `${m.emoji}  ${m.id}` })) });
    if (v) { draft.method = v; saveSettings({ lastMethod: v }); paint(); }
  });
  paint();
}

function recentMerchants() {
  const seen = new Map();
  for (const e of state.expenses) {
    if (e.recurringId || !e.merchant) continue;
    const k = normMerchant(e.merchant);
    if (!seen.has(k)) seen.set(k, { merchant: e.merchant, category: e.category, count: 0, lastAmount: e.amount });
    seen.get(k).count++;
    if (seen.size > 40) break;
  }
  return [...seen.values()].sort((a, b) => b.count - a.count).slice(0, 8);
}

function recentSources() {
  const seen = new Map();
  for (const i of state.income) {
    if (!i.from) continue;
    const k = normMerchant(i.from);
    if (!seen.has(k)) seen.set(k, { merchant: i.from, category: i.source, count: 0, lastAmount: i.amount });
    seen.get(k).count++;
    if (seen.size > 20) break;
  }
  return [...seen.values()].sort((a, b) => b.count - a.count).slice(0, 6);
}

function amountDisplay() {
  const a = draft.amount;
  if (!a) return '0';
  const [i, d] = a.split('.');
  const int = Number(i || 0).toLocaleString('en-US');
  return d !== undefined ? `${int}.${d}` : int;
}

function paint() {
  if (!el) return;
  const amt = el.querySelector('[data-amount]');
  const disp = amountDisplay();
  amt.innerHTML = `<span class="cur">${esc(currencySymbol())}</span><span class="val">${disp}</span>`;
  amt.classList.toggle('empty', !draft.amount);
  amt.classList.toggle('long', disp.length > 8);
  el.querySelectorAll('[data-cat]').forEach((b) => {
    const on = b.dataset.cat === draft.category;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on);
  });
  const sel = el.querySelector('.cat.on');
  if (sel && draft.category !== lastCat) sel.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  lastCat = draft.category;
  el.querySelector('[data-date]').textContent = fmtDay(draft.date);
  const mEl = el.querySelector('[data-method]');
  if (mEl) mEl.textContent = `${methodEmoji(draft.method)} ${draft.method}`;
  const n = parseFloat(draft.amount);
  const btn = el.querySelector('[data-act="save"]');
  btn.disabled = !(n > 0);
  if (mode === 'income') btn.textContent = n > 0 ? `Add +${money(n)}${draft.category ? ' · ' + src(draft.category).short : ''}` : 'Add income';
  else btn.textContent = n > 0 ? `Save ${money(n)}${draft.category ? ' · ' + cat(draft.category).short : ''}` : 'Save';
  const rc = el.querySelector('[data-receipt]');
  rc.innerHTML = draft.receiptThumb ? `<button class="chip" data-rm-receipt><img src="${draft.receiptThumb}" alt="">Receipt attached ✕</button>` : '';
  rc.querySelector('[data-rm-receipt]')?.addEventListener('click', () => { draft.receiptId = null; draft.receiptThumb = null; paint(); });
}

function press(k) {
  let a = draft.amount;
  if (k === 'del') a = a.slice(0, -1);
  else if (k === '.') { if (!a.includes('.')) a = (a || '0') + '.'; }
  else {
    const [i, d] = a.split('.');
    if (d !== undefined && d.length >= 2) return;
    if (d === undefined && (i || '').replace(/^0+/, '').length >= 8) return;
    a = a === '0' ? k : a + k;
  }
  draft.amount = a;
  paint();
}

const savingsNote = () => (savingsIsSet() ? ` · Savings ${money(Math.round(savingsBalance()))}` : '');

async function save() {
  const n = parseFloat(draft.amount);
  if (!(n > 0)) return;
  if (mode === 'income') {
    const source = draft.category || guessSource(draft.merchant) || 'otherIncome';
    const i = await addIncome({ amount: n, source, from: draft.merchant, date: draft.date });
    draft = fresh();
    render(el);
    toast(`Added +${money(n)} ${src(source).emoji}${savingsNote()}`, { label: 'Undo', run: async () => { await deleteIncome(i.id); toast('Removed'); } });
    return;
  }
  const category = draft.category || guessCategory(draft.merchant) || 'other';
  const e = await addExpense({ amount: n, merchant: draft.merchant, category, date: draft.date, method: draft.method, receiptId: draft.receiptId });
  const c = cat(category);
  draft = fresh();
  render(el);
  toast(`Saved ${money(n)} ${c.emoji}${savingsNote()}`, {
    label: 'Undo',
    run: async () => { await deleteExpense(e.id); toast('Removed'); },
  });
}

async function pickDate() {
  const t = todayISO();
  const v = await pickSheet({
    title: 'When?',
    value: draft.date,
    options: [
      { value: t, label: 'Today' },
      { value: addDays(t, -1), label: 'Yesterday' },
      { value: addDays(t, -2), label: fmtDay(addDays(t, -2)) },
      { value: addDays(t, -3), label: fmtDay(addDays(t, -3)) },
      { value: 'pick', label: 'Pick a date…' },
    ],
  });
  if (v === 'pick') {
    openSheet({
      title: 'Pick a date',
      body: `<div class="form"><input type="date" class="field" value="${draft.date}" max="${addDays(t, 1)}" data-d><button class="btn primary block" data-ok>Done</button></div>`,
      onMount: (s, close) => {
        s.querySelector('[data-ok]').onclick = () => { const d = s.querySelector('[data-d]').value; if (d) draft.date = d; paint(); close(); };
      },
    });
  } else if (v) { draft.date = v; paint(); }
}

function applyParsed(p, sourceLabel) {
  if (p.amount) draft.amount = String(p.amount);
  if (p.merchant) draft.merchant = p.merchant;
  if (p.category) { draft.category = p.category; draft.catTouched = true; }
  else if (p.merchant && !draft.catTouched) draft.category = guessCategory(p.merchant);
  if (p.date) draft.date = p.date;
  if (p.method) draft.method = p.method;
  render(el);
  toast(p.amount ? `${sourceLabel} — check it, then Save` : `Couldn't find the amount — type it in`);
}

function pasteSheet() {
  openSheet({
    title: 'Paste a payment message',
    body: `<div class="form">
      <p class="text-2" style="font-size:14px">Copy a GCash, Maya, bank or card SMS/email (e.g. “You have paid PHP 250.00 to Jollibee…”) and paste it here. Avocado Money pulls out the amount, merchant and date.</p>
      <textarea class="field" data-text placeholder="Paste here"></textarea>
      <button class="btn block" data-clip>📋 Paste from clipboard</button>
      <button class="btn primary block" data-ok>Use this</button>
    </div>`,
    onMount: (s, close) => {
      const ta = s.querySelector('[data-text]');
      s.querySelector('[data-clip]').onclick = async () => {
        try { ta.value = await navigator.clipboard.readText(); } catch { ta.focus(); toast('Long-press the box and tap Paste'); }
      };
      s.querySelector('[data-ok]').onclick = () => {
        if (!ta.value.trim()) return;
        const p = parseMessage(ta.value);
        close();
        applyParsed(p, 'Filled from message');
      };
    },
  });
}

/** Called by app.js when a receipt photo is chosen. */
export async function handleReceiptFile(file) {
  if (!file) return;
  if (mode !== 'expense') { mode = 'expense'; draft = null; }
  if (!draft) draft = fresh();
  let closeSheet;
  let bar, label;
  closeSheet = openSheet({
    title: 'Reading receipt',
    body: `<div class="form"><img class="receipt-img" data-img alt="Receipt"><div class="progress"><i data-bar></i></div><p class="text-2" data-label style="font-size:14px">Preparing photo…</p></div>`,
    onMount: (s) => { bar = s.querySelector('[data-bar]'); label = s.querySelector('[data-label]'); },
  });
  try {
    const thumb = await compressPhoto(file);
    document.querySelector('.sheet [data-img]')?.setAttribute('src', thumb);
    draft.receiptId = await saveReceipt(thumb);
    draft.receiptThumb = thumb;
    let parsed = {};
    try {
      parsed = await scanReceipt(file, (p, l) => { if (bar) bar.style.width = Math.round(p * 100) + '%'; if (label) label.textContent = l; });
    } catch (err) {
      console.warn(err);
      closeSheet();
      if (location.hash !== '#/add') location.hash = '#/add';
      else render(el);
      toast(navigator.onLine ? 'Couldn’t read that receipt — type the amount' : 'Offline: receipt saved, type the amount');
      return;
    }
    closeSheet();
    if (location.hash !== '#/add') location.hash = '#/add';
    setTimeout(() => applyParsed(parsed, 'Receipt read'), 50);
  } catch (err) {
    console.error(err);
    closeSheet();
    toast(err.message || 'Could not open that photo');
  }
}
