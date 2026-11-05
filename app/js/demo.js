// Realistic sample data (Metro Manila prices) so you can explore the dashboard before logging your own.
import { todayISO, addDays, shiftMonthKey, monthKey, dayOfWeek } from './dates.js';

function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export const DEMO_SETTINGS = { monthlyIncome: 70000, monthlyBudget: 55000, categoryBudgets: { food: 8000, coffee: 2000, shopping: 3000 }, demoSettings: true };

export function makeDemo() {
  const r = rng(20261105);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const between = (a, b) => Math.round((a + r() * (b - a)) / 5) * 5;
  const today = todayISO();
  const curKey = monthKey(today);
  const start = shiftMonthKey(curKey, -3) + '-01';
  const ex = [];
  const add = (date, amount, category, merchant, method = 'Cash', note = '') => ex.push({ date, amount, category, merchant, method, note });

  for (let d = start; d <= today; d = addDays(d, 1)) {
    const dow = dayOfWeek(d);
    const weekend = dow === 0 || dow === 6;
    const thisMonth = d.startsWith(curKey);
    const foodBoost = thisMonth ? 1.45 : 1; // makes a "Food is up" insight appear
    // Lunch / dinner
    if (r() < 0.75 * foodBoost) {
      const [m, lo, hi, meth] = pick([
        ['Jollibee', 150, 280, 'Cash'], ['Mang Inasal', 160, 240, 'Cash'], ['Carinderia', 80, 140, 'Cash'], ['Carinderia', 80, 140, 'Cash'],
        ['GrabFood', 280, 650, 'GCash'], ['foodpanda', 250, 600, 'GCash'], ['Chowking', 160, 300, 'Cash'],
        ["McDonald's", 140, 280, 'Cash'], ['Bonchon', 300, 520, 'Credit card'],
      ]);
      add(d, between(lo, hi), 'food', m, meth);
    }
    if (weekend && r() < 0.3) add(d, between(700, 1800), 'food', pick(['Samgyupsal', "Shakey's", 'Army Navy', 'Yellow Cab']), 'Credit card');
    // Coffee & snacks
    if (r() < 0.55) {
      const [m, lo, hi, meth] = pick([['Starbucks', 170, 260, 'GCash'], ['7-Eleven', 55, 140, 'Cash'], ['Tiger Sugar', 120, 180, 'Cash'], ['But First, Coffee', 90, 150, 'GCash']]);
      add(d, between(lo, hi), 'coffee', m, meth);
    }
    // Commute
    if (!weekend && r() < 0.8) {
      if (r() < 0.35) add(d, between(160, 380), 'transport', 'Grab', 'GCash');
      else add(d, between(30, 70), 'transport', pick(['MRT/LRT', 'Jeep']), 'Cash');
    }
    if (r() < 0.12) add(d, between(40, 120), 'transport', 'Parking', 'Cash');
    // Gas weekly
    if (dow === 6 && r() < 0.7) add(d, between(1200, 2200), 'gas', pick(['Petron', 'Shell', 'Caltex']), 'Credit card');
    // Groceries weekly
    if (dow === 0 && r() < 0.85) add(d, between(1500, 2800), 'groceries', pick(['SM Supermarket', 'Puregold', 'Robinsons Supermarket']), 'Debit card');
    if (r() < 0.08) add(d, between(250, 600), 'groceries', 'Palengke', 'Cash');
    // Shopping
    if (r() < 0.08) add(d, between(250, 2000), 'shopping', pick(['Shopee', 'Lazada', 'Uniqlo', 'TikTok Shop']), pick(['GCash', 'Credit card']));
    // Fun
    if (weekend && r() < 0.18) add(d, between(350, 900), 'entertainment', 'Cinema', 'Credit card');
    // Health & personal
    if (r() < 0.05) add(d, between(150, 900), 'health', pick(['Mercury Drug', 'Watsons']), 'Cash');
    if (r() < 0.03) add(d, between(200, 600), 'personal', 'Salon', 'Cash');
    // Monthly-ish
    const day = Number(d.slice(8));
    if (day === 15) add(d, 3000, 'family', 'Palawan Express', 'Cash', 'Padala kay Nanay');
    if (day === 10) add(d, between(3100, 4300), 'bills', 'Meralco', 'GCash');
    if (day === 18) add(d, between(380, 520), 'bills', 'Maynilad', 'GCash');
    if (day === 22) add(d, 369, 'subscriptions', 'Disney+', 'Credit card'); // untracked → detected
    if (day === 25 && r() < 0.6) add(d, between(80, 150), 'bills', 'Late payment fee', 'Credit card', 'credit card late fee');
  }

  const first = shiftMonthKey(curKey, -3);
  const rec = (name, amount, kind, category, day, method, freq = 'monthly') => ({
    name, amount, kind, category, method, freq, active: true, autoLog: true, nextDue: `${first}-${String(day).padStart(2, '0')}`,
  });
  const recurring = [
    rec('Rent', 12000, 'bill', 'housing', 1, 'Bank transfer'),
    rec('Netflix', 549, 'subscription', 'subscriptions', 5, 'Credit card'),
    rec('Spotify', 149, 'subscription', 'subscriptions', 12, 'Credit card'),
    rec('YouTube Premium', 159, 'subscription', 'subscriptions', 20, 'Credit card'),
    rec('iCloud+', 49, 'subscription', 'subscriptions', 8, 'Credit card'),
    rec('PLDT Fiber', 1699, 'bill', 'bills', 14, 'GCash'),
    rec('Globe Postpaid', 999, 'bill', 'bills', 27, 'Credit card'),
    rec('Anytime Fitness', 1500, 'subscription', 'health', 3, 'Credit card'),
  ];
  return { expenses: ex, recurring };
}
