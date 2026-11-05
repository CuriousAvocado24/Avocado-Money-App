import { state, load, subscribe, processRecurring } from './store.js';
import { todayISO } from './dates.js';
import { isIOS, isStandalone, toast } from './ui.js';
import * as add from './views/add.js';
import * as home from './views/home.js';
import * as activity from './views/activity.js';
import * as bills from './views/bills.js';
import * as insights from './views/insights.js';
import { openInstallHelp } from './sheets.js';

const VIEWS = { add, home, activity, bills, insights };
const view = document.getElementById('view');
let current = null;
let lastDay = todayISO();

function route() {
  const name = (location.hash.match(/^#\/(\w+)/) || [])[1];
  if (!VIEWS[name]) {
    location.replace('#/' + (state.settings.openTo === 'home' ? 'home' : 'add'));
    return;
  }
  const changed = name !== current;
  current = name;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
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
    view.innerHTML = '<div class="card empty"><div class="big">⚠️</div><h2>Storage unavailable</h2><p>Gastos needs on-device storage. If you are in Private Browsing, switch to a normal tab.</p></div>';
    return;
  }
  await processRecurring({ silent: true });
  subscribe(rerender);
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
