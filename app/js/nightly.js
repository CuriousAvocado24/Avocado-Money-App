// Nightly check-in: a full-screen "Did you spend anything today?" at your chosen time.
// Web apps on iPhone can't schedule notifications without a server, so this shows when the app is open
// at/after that time, or the next time you open it. If you miss a night, the next morning asks about yesterday.
import { state, saveSettings, checkIn } from './store.js';
import { todayISO, addDays, fmtDay } from './dates.js';
import { money, esc } from './format.js';
import { confetti, toast } from './ui.js';
import { gameState } from './game.js';

let open = false;
let snoozeUntil = 0;
let timer = null;

const answered = () => state.settings.nightAnswered || [];
const loggedOn = (d) => state.expenses.filter((e) => e.date === d && !e.recurringId);
const activeOn = (d) => loggedOn(d).length > 0 || state.income.some((i) => i.date === d && !i.recurringId) || state.checkins.includes(d);

function minutesNow() { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
function minutesOf(hhmm) { const [h, m] = (hhmm || '20:00').split(':').map(Number); return h * 60 + (m || 0); }

/** Which day (if any) we should ask about right now. */
function dayToAsk() {
  if (state.settings.nightCheck === false) return null;
  if (Date.now() < snoozeUntil) return null;
  // Only once you've started using the app.
  if (!state.expenses.length && !state.income.length && !state.checkins.length) return null;
  const today = todayISO();
  const done = answered();
  if (minutesNow() >= minutesOf(state.settings.nightCheckTime)) return done.includes(today) ? null : today;
  // Morning catch-up: yesterday had nothing logged and you never answered.
  const y = addDays(today, -1);
  const firstUse = [...state.expenses, ...state.income].reduce((a, e) => (e.date < a ? e.date : a), today);
  if (y >= firstUse && !done.includes(y) && !activeOn(y)) return y;
  return null;
}

async function markAnswered(d) {
  const list = [...answered().filter((x) => x >= addDays(todayISO(), -14)), d];
  await saveSettings({ nightAnswered: [...new Set(list)] });
}

function show(day) {
  if (open || document.querySelector('.night')) return;
  open = true;
  const isToday = day === todayISO();
  const spent = loggedOn(day);
  const total = spent.reduce((a, e) => a + e.amount, 0);
  const g = gameState();
  const streak = g.streak.current;
  const when = isToday ? 'today' : fmtDay(day).toLowerCase();

  const el = document.createElement('div');
  el.className = 'night';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Daily check-in');
  el.innerHTML = `
    <div class="night-inner">
      <div class="night-avo" aria-hidden="true">🥑</div>
      <p class="night-eyebrow">${isToday ? 'Evening check-in' : 'Quick catch-up'}</p>
      ${spent.length
        ? `<h1>Anything else ${esc(when)}<em>?</em></h1>
           <p class="night-sub">You logged ${spent.length} ${spent.length === 1 ? 'expense' : 'expenses'} (${money(total)}). Make sure nothing slipped through.</p>`
        : `<h1>Did you spend anything <em>${esc(when)}</em>?</h1>
           <p class="night-sub">${streak ? `Keep your 🔥 ${streak}-day streak alive.` : 'Start a streak tonight.'} A no-spend day is worth 15 XP.</p>`}
      <div class="night-btns">
        ${spent.length
          ? `<button class="btn primary block" data-done>✅ That's everything</button>
             <button class="btn block ghost" data-log>+ Add another expense</button>`
          : `<button class="btn primary block" data-none>🧘 Nothing ${esc(when)} <span class="night-xp">+15 XP</span></button>
             <button class="btn block ghost" data-log>Yes, let me log it</button>`}
        ${isToday ? '<button class="night-later" data-later>Ask me in an hour</button>' : '<button class="night-later" data-skip>I don\'t remember, skip</button>'}
      </div>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));

  const close = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
    open = false;
  };
  el.querySelector('[data-none]')?.addEventListener('click', async () => {
    close();
    await markAnswered(day);
    await checkIn(day);
    confetti();
  });
  el.querySelector('[data-done]')?.addEventListener('click', async () => {
    close();
    await markAnswered(day);
    toast('Day closed. See you tomorrow 🥑');
  });
  el.querySelector('[data-log]')?.addEventListener('click', async () => {
    close();
    await markAnswered(day);
    location.hash = '#/add/expense';
    if (!isToday) setTimeout(() => toast(`Set the date to ${fmtDay(day)} with the 📅 button`), 400);
  });
  el.querySelector('[data-later]')?.addEventListener('click', () => {
    snoozeUntil = Date.now() + 60 * 60 * 1000;
    close();
  });
  el.querySelector('[data-skip]')?.addEventListener('click', async () => {
    close();
    await markAnswered(day);
  });
}

/** Check now; called on start, when the app comes back to the foreground, and every minute while open. */
export function maybeAsk() {
  if (open) return;
  // Don't interrupt while a sheet is open or you're typing.
  const a = document.activeElement;
  if (document.querySelector('.sheet-wrap') || (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'))) return;
  const d = dayToAsk();
  if (d) show(d);
}

export function startNightly() {
  setTimeout(maybeAsk, 1200);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(maybeAsk, 600); });
  clearInterval(timer);
  timer = setInterval(maybeAsk, 60 * 1000);
}

/** For Settings: preview the prompt right now. */
export function previewNightly() {
  snoozeUntil = 0;
  show(todayISO());
}
