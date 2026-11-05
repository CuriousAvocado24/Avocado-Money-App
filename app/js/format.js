import { state } from './store.js';

export const CURRENCIES = [
  ['PHP', 'Philippine Peso (₱)', 'en-PH'],
  ['USD', 'US Dollar ($)', 'en-US'],
  ['EUR', 'Euro (€)', 'en-IE'],
  ['GBP', 'British Pound (£)', 'en-GB'],
  ['JPY', 'Japanese Yen (¥)', 'ja-JP'],
  ['SGD', 'Singapore Dollar (S$)', 'en-SG'],
  ['AUD', 'Australian Dollar (A$)', 'en-AU'],
  ['CAD', 'Canadian Dollar (C$)', 'en-CA'],
  ['HKD', 'Hong Kong Dollar (HK$)', 'en-HK'],
  ['AED', 'UAE Dirham (AED)', 'en-AE'],
  ['KRW', 'Korean Won (₩)', 'ko-KR'],
  ['INR', 'Indian Rupee (₹)', 'en-IN'],
];
const LOCALE = Object.fromEntries(CURRENCIES.map(([c, , l]) => [c, l]));
const cache = new Map();

function nf(kind) {
  const cur = state.settings.currency || 'PHP';
  const k = cur + kind;
  if (!cache.has(k)) {
    const opts = { style: 'currency', currency: cur };
    if (kind === 'whole') Object.assign(opts, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    if (kind === 'cents') Object.assign(opts, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (kind === 'short') Object.assign(opts, { notation: 'compact', maximumFractionDigits: 1 });
    cache.set(k, new Intl.NumberFormat(LOCALE[cur] || 'en-US', opts));
  }
  return cache.get(k);
}

/** ₱1,234 or ₱1,234.50 — hides ".00" */
export function money(n) {
  n = Number(n) || 0;
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  return nf(whole ? 'whole' : 'cents').format(n);
}
/** ₱1,235 — always rounded, for summaries */
export const moneyRound = (n) => nf('whole').format(Math.round(Number(n) || 0));
/** ₱12K — for axes */
export const moneyShort = (n) => nf('short').format(Number(n) || 0);
export function currencySymbol() {
  const p = nf('whole').formatToParts(0).find((x) => x.type === 'currency');
  return p ? p.value : '₱';
}
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const pct = (n) => `${Math.round(n * 100)}%`;
export const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;
