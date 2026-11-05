// Date helpers. All dates are local "YYYY-MM-DD" strings so nothing shifts with time zones.
const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const fromISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s, n) => {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const daysInMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
/** Add months, clamping to the month's last day. `anchorDay` keeps e.g. the 31st stable across short months. */
export const addMonths = (s, n, anchorDay) => {
  const [y, m, d] = s.split('-').map(Number);
  const target = new Date(y, m - 1 + n, 1);
  const key = `${target.getFullYear()}-${pad(target.getMonth() + 1)}`;
  const day = Math.min(anchorDay || d, daysInMonth(key));
  return `${key}-${pad(day)}`;
};
export const monthKey = (s) => s.slice(0, 7);
export const shiftMonthKey = (key, n) => addMonths(`${key}-01`, n).slice(0, 7);
export const diffDays = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
export const dayOfWeek = (s) => fromISO(s).getDay();

export function fmtDay(s) {
  const t = todayISO();
  if (s === t) return 'Today';
  if (s === addDays(t, -1)) return 'Yesterday';
  if (s === addDays(t, 1)) return 'Tomorrow';
  const d = fromISO(s);
  const opts = { weekday: 'short', month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}
export const fmtShort = (s) => fromISO(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export function monthName(key, style = 'long') {
  const [y, m] = key.split('-').map(Number);
  const opts = { month: style };
  if (style === 'long' && y !== new Date().getFullYear()) opts.year = 'numeric';
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', opts);
}
export function inDays(s) {
  const n = diffDays(todayISO(), s);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}
