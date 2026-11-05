import { state, load, subscribe, processRecurring } from './store.js';
import { todayISO } from './dates.js';
import { isIOS, isStandalone, toast, xpPop, celebrate } from './ui.js';
import { gameState } from './game.js';
import * as add from './views/add.js';
import * as home from './views/home.js';
import * as activity from './views/activity.js';
import * as bills from './views/bills.js';
import * as insights from './views/insights.js';
import * as goals from './views/goals.js';
import * as debts from './views/debts.js';
import { openInstallHelp } from './sheets.js';

const VIEWS = { add, home, activity, bills, insights, goals, debts };
const view = document.getElementById('view');
let current = null;
let lastDay = todayISO();

function route() {
  if (location.hash === '#/add/income' || location.hash === '#/add/expense') {
    add.setMode(location.hash.endsWith('income') ? 'income' : 'expense');
    location.replace('#/add');
    return;
  }
  const name = (location.hash.match(/^#\/(\w+)/) || [])[1];
  if (!VIEWS[name]) {
    location.replace('#/' + (state.settings.openTo === 'home' ? 'home' : 'add'));
    return;
  }
  const changed = name !== current;
  current = name;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === (name === 'debts' ? 'goals' : name === 'bills' ? 'home' : name)));
  VIEWS[name].render(view);
  if (changed) window.scrollTo(0, 0);
}

function rerender() {
  if (!current) return;
  // Don't yank the keyboard away while typing.
  const a = document.activeElement;
  if (a && view.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
  const y = window.scrollY;
  VIEWS[current].render(view);
  window.scrollTo(0, y);
}

async function start() {
  try {
    await load();
  } catch (e) {
    console.error(e);
    view.innerHTML = '<div class="card empty"><div class="big">⚠️</div><h2>Storage unavailable</h2><p>Avocado Money needs on-device storage. If you are in Private Browsing, switch to a normal tab.</p></div>';
    return;
  }
  await processRecurring({ silent: true });
  let last = gameState();
  subscribe(() => {
    rerender();
    // Game feedback: XP pops, level-ups and new badges
    const now = gameState();
    const gained = now.xp - last.xp;
    const newBadges = now.badges.filter((b) => b.earned && !b.seen && !last.badges.find((x) => x.id === b.id).earned);
    const busy = !!document.querySelector('.sheet-wrap');
    if (gained > 0 && gained <= 600 && busy) {
      xpPop(now.level.level > last.level.level ? `Level ${now.level.level}: ${now.level.name} 🥑` : newBadges.length ? `${newBadges[0].emoji} ${newBadges[0].name} unlocked` : `+${gained} XP 🥑`);
    } else if (gained > 0 && gained <= 600) {
      if (now.level.level > last.level.level) celebrate({ emoji: '🥑', title: `Level ${now.level.level}: <em>${now.level.name}</em>`, text: `You leveled up. ${now.level.need - now.level.into} XP to the next level.` });
      else if (newBadges.length) celebrate({ emoji: newBadges[0].emoji, title: `Badge <em>unlocked</em>`, text: `${newBadges[0].name}: ${newBadges[0].desc} +50 XP.` });
      else xpPop(`+${gained} XP 🥑`);
    }
    last = now;
  });
  window.addEventListener('hashchange', route);
  route();

  document.getElementById('receipt-input').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    add.handleReceiptFile(f);
  });

  // New day while the app sat in the background → log due bills and refresh.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const t = todayISO();
    if (t !== lastDay) {
      lastDay = t;
      await processRecurring();
      rerender();
    }
  });

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  if (isIOS() && !isStandalone() && !state.settings.installHintShown) setTimeout(openInstallHelp, 800);

  const devHost = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !location.search.includes('sw=1');
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !devHost) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e));
  }
  window.addEventListener('offline', () => toast('Offline — everything still works'));
}

start();
