// On-device "what to cut" engine. Pure rules on your own data — nothing leaves the phone.
import { state } from './store.js';
import { todayISO, addDays, monthKey, shiftMonthKey, daysInMonth, dayOfWeek, monthName } from './dates.js';
import { sum, inMonth, lastDays, between, byCategory, byMerchant, monthStatus, fixedMonthly, activeRecurring, monthlyEquivalent, detectSubscriptions } from './analytics.js';
import { cat } from './categories.js';
import { moneyRound as m, pct, plural } from './format.js';

const STREAMING = /netflix|disney|hbo|prime video|amazon prime|viu|youtube|iwant|vivamax|crunchyroll|apple tv/i;

export function buildInsights() {
  const out = [];
  const today = todayISO();
  const curKey = monthKey(today);
  const st = monthStatus(curKey);
  const income = Number(state.settings.monthlyIncome) || 0;
  const last30 = lastDays(30);
  const prev30 = between(addDays(today, -59), addDays(today, -30));
  const total30 = sum(last30);
  // Typical monthly spending: average of up to 3 previous full months that have data.
  const prevMonths = [1, 2, 3].map((i) => shiftMonthKey(curKey, -i)).filter((k) => inMonth(k).length > 0);

  if (state.expenses.length < 5) return { insights: [], totalSave: 0, ready: false };

  // 1) Budget pace
  if (st.budget && st.dayNum >= 3) {
    const over = st.projected - st.budget;
    if (st.spent > st.budget) {
      out.push({ id: 'over', emoji: '🚨', tone: 'bad', title: `You're ${m(st.spent - st.budget)} over budget`,
        body: `You've spent ${m(st.spent)} of your ${m(st.budget)} budget for ${monthName(curKey)}. Pause non-essential spending until the month resets, or raise the budget if it was too tight.`, save: 0 });
    } else if (over > st.budget * 0.03) {
      out.push({ id: 'pace', emoji: '📈', tone: 'warn', title: `On pace to overspend by ${m(over)}`,
        body: `At your current pace you'll end ${monthName(curKey)} around ${m(st.projected)}. Keeping to ${m(st.safePerDay)}/day for the next ${plural(st.daysLeft, 'day')} keeps you on budget.`, save: over });
    } else {
      out.push({ id: 'pace-ok', emoji: '✅', tone: 'good', title: 'On track with your budget',
        body: `Projected month total: ${m(st.projected)} of ${m(st.budget)}. You can spend about ${m(st.safePerDay)} a day and still finish on budget.`, save: 0 });
    }
  }

  // 2) Category spikes vs your usual month
  if (prevMonths.length >= 1 && st.dayNum >= 7) {
    const scale = st.dim / st.dayNum;
    const cur = byCategory(st.list.filter((e) => !e.recurringId));
    for (const c of cur) {
      if (['housing', 'bills', 'subscriptions', 'education', 'travel'].includes(c.id)) continue;
      const avg = prevMonths.reduce((a, k) => a + sum(inMonth(k).filter((e) => e.category === c.id && !e.recurringId)), 0) / prevMonths.length;
      const proj = c.total * scale;
      if (avg > 0 && proj > avg * 1.25 && proj - avg > Math.max(1000, total30 * 0.03)) {
        out.push({ id: 'spike-' + c.id, emoji: c.cat.emoji, tone: 'warn',
          title: `${c.cat.name} is up ${pct(proj / avg - 1)}`,
          body: `You're heading for ${m(proj)} on ${c.cat.name.toLowerCase()} this month vs. your usual ${m(avg)}. Bringing it back to normal frees up ${m(proj - avg)}.`, save: proj - avg });
      }
    }
  }

  // 3) Eating out / delivery
  const food = last30.filter((e) => e.category === 'food');
  if (food.length >= 8) {
    const t = sum(food);
    const delivery = food.filter((e) => /grabfood|foodpanda|delivery|grab food/i.test(e.merchant + ' ' + e.note));
    const avg = t / food.length;
    const swap = Math.round(food.length / 3);
    const save = swap * avg * 0.6; // home-cooked meal ≈ 40% of the restaurant price
    out.push({ id: 'food', emoji: '🍳', tone: 'tip', title: `${plural(food.length, 'meal')} out in 30 days (${m(t)})`,
      body: `${delivery.length ? `${plural(delivery.length, 'was a delivery', 'were deliveries')} — delivery fees and markups add 20–30%. ` : ''}Cooking ${swap} of those at home (or bringing baon) saves about ${m(save)} a month.`, save });
  }

  // 4) Small daily habits (coffee, milk tea, convenience stores) — the "latte factor"
  const small = last30.filter((e) => e.category === 'coffee');
  if (small.length >= 6) {
    const t = sum(small);
    out.push({ id: 'coffee', emoji: '☕', tone: 'tip', title: `${m(t)} on coffee & snacks this month`,
      body: `That's ${plural(small.length, 'purchase')} — about ${m(t * 12)} a year. Cutting it in half (brew at home, skip the 7-Eleven runs) saves ${m(t / 2)}/month without giving it up entirely.`, save: t / 2 });
  }

  // 5) Subscriptions
  const subs = activeRecurring().filter((r) => r.kind === 'subscription');
  const subsMonthly = fixedMonthly('subscription');
  if (subs.length >= 3) {
    const cheapest = [...subs].sort((a, b) => monthlyEquivalent(a) - monthlyEquivalent(b))[0];
    out.push({ id: 'subs', emoji: '📺', tone: 'tip', title: `${plural(subs.length, 'subscription')} cost ${m(subsMonthly)}/month`,
      body: `That's ${m(subsMonthly * 12)} a year. Go through them one by one: if you didn't use it in the last 2 weeks, cancel it. Even dropping just ${cheapest.name} saves ${m(monthlyEquivalent(cheapest) * 12)}/year.`, save: monthlyEquivalent(cheapest), action: { label: 'Review subscriptions', href: '#/bills' } });
  }
  const streaming = subs.filter((r) => STREAMING.test(r.name));
  if (streaming.length >= 2) {
    const sorted = [...streaming].sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a));
    const save = sorted.slice(1).reduce((a, r) => a + monthlyEquivalent(r), 0);
    out.push({ id: 'rotate', emoji: '🔁', tone: 'tip', title: `${streaming.length} streaming services at once`,
      body: `${streaming.map((r) => r.name).join(', ')}. Try rotating: keep one, binge what you want, cancel, then switch next month. You'd save about ${m(save)}/month.`, save });
  }

  // 6) Untracked repeating charges
  for (const s of detectSubscriptions().slice(0, 3)) {
    const kind = s.category === 'subscriptions' || s.category === 'entertainment' ? 'subscription' : ['bills', 'housing'].includes(s.category) ? 'recurring bill' : 'regular payment';
    out.push({ id: 'detect-' + s.name, emoji: '🔎', tone: 'info', title: `Looks like a ${kind}: ${s.name}`,
      body: `${m(s.amount)} paid ${s.count} times, about a month apart. Track it so it counts in your fixed costs and "safe to spend"${kind === 'subscription' ? " — and decide if it's still worth it" : ''}.`, save: 0,
      action: { label: 'Track it', detect: s } });
  }

  // 7) Gas
  const gas = sum(last30.filter((e) => e.category === 'gas'));
  const gasPrev = sum(prev30.filter((e) => e.category === 'gas'));
  if (gas >= 1500) {
    const up = gasPrev > 0 && gas > gasPrev * 1.2;
    out.push({ id: 'gas', emoji: '⛽', tone: up ? 'warn' : 'tip', title: up ? `Gas is up ${pct(gas / gasPrev - 1)} vs last 30 days` : `${m(gas)} on gas in 30 days`,
      body: `Fill up on station promo days and use the loyalty card (Petron Value Card, Shell Go+, Caltex), keep tires properly inflated, combine errands into one trip, and avoid peak-hour traffic idling. Those habits typically trim 10–15%.`, save: gas * 0.1 });
  }

  // 8) Online shopping / impulse buys
  const shop = last30.filter((e) => e.category === 'shopping');
  const shopT = sum(shop);
  if (shop.length >= 4 && shopT > total30 * 0.1) {
    out.push({ id: 'shop', emoji: '🛍️', tone: 'tip', title: `${m(shopT)} on shopping (${plural(shop.length, 'order')})`,
      body: `Try the 48-hour rule: leave it in the cart for two days before checking out. Most impulse buys don't survive it. Unsubscribe from 11.11/12.12 sale notifications too. Aim to cut this by a quarter.`, save: shopT * 0.25 });
  }

  // 9) Weekend splurges
  const wants = last30.filter((e) => cat(e.category).group === 'wants' && !e.recurringId);
  const wantsT = sum(wants);
  const weekend = sum(wants.filter((e) => [0, 5, 6].includes(dayOfWeek(e.date))));
  if (wantsT > 2000 && weekend / wantsT > 0.6) {
    out.push({ id: 'weekend', emoji: '🎉', tone: 'tip', title: `${pct(weekend / wantsT)} of fun money goes on Fri–Sun`,
      body: `Set a weekend cap (e.g. ${m((weekend / 4) * 0.8)} per weekend) and plan one free activity. Small cap, big difference.`, save: weekend * 0.15 });
  }

  // 10) 50/30/20
  if (income > 0) {
    const ref = st.dayNum >= 10 ? st.list : inMonth(shiftMonthKey(curKey, -1));
    const scale = st.dayNum >= 10 ? st.dim / st.dayNum : 1;
    const needs = sum(ref.filter((e) => cat(e.category).group === 'needs')) * scale;
    const want = sum(ref.filter((e) => cat(e.category).group === 'wants')) * scale;
    const saved = income - needs - want;
    if (want > income * 0.3) {
      out.push({ id: 'wants', emoji: '⚖️', tone: 'warn', title: `Wants are ${pct(want / income)} of income`,
        body: `The 50/30/20 rule suggests ~30% for wants (${m(income * 0.3)}). Trimming wants to that level frees ${m(want - income * 0.3)} a month for savings.`, save: want - income * 0.3 });
    }
    if (saved < income * 0.2) {
      out.push({ id: 'savings', emoji: '🐷', tone: saved < 0 ? 'bad' : 'warn', title: saved < 0 ? 'Spending more than you earn' : `Saving ${pct(Math.max(0, saved) / income)} of income`,
        body: saved < 0
          ? `You're on track to spend ${m(-saved)} more than your income this month. Start with the biggest category above and set a budget for it.`
          : `Aim for 20% (${m(income * 0.2)}/month). Pay yourself first: on payday, move savings to a separate account (e.g. a digital bank or GSave/Maya Savings) before spending.`, save: 0 });
    } else {
      out.push({ id: 'savings-ok', emoji: '🌱', tone: 'good', title: `You're saving about ${pct(saved / income)} of income`,
        body: `Nice — that beats the 20% target. Make sure it's working for you: build a 3–6 month emergency fund first (${m((needs || income * 0.5) * 3)}–${m((needs || income * 0.5) * 6)}), then look at Pag-IBIG MP2 or index funds.`, save: 0 });
    }
  }

  // 11) Fees & penalties
  const fees = last30.filter((e) => /\b(fee|fees|penalty|late|interest|convenience|service charge|charge)\b/i.test(e.merchant + ' ' + e.note));
  if (fees.length) {
    const t = sum(fees);
    out.push({ id: 'fees', emoji: '🧾', tone: 'warn', title: `${m(t)} in fees and charges`,
      body: `Late fees, interest and convenience fees are pure loss. Turn on auto-pay or reminders for bills, and pay credit cards in full.`, save: t });
  }

  // 12) Positive reinforcement: categories down vs usual
  if (prevMonths.length >= 1 && st.dayNum >= 10) {
    const scale = st.dim / st.dayNum;
    for (const c of byCategory(prevMonths.flatMap((k) => inMonth(k)).filter((e) => !e.recurringId)).slice(0, 6)) {
      const avg = c.total / prevMonths.length;
      const proj = sum(st.list.filter((e) => e.category === c.id && !e.recurringId)) * scale;
      if (avg > 1500 && proj < avg * 0.8) {
        out.push({ id: 'down-' + c.id, emoji: '👏', tone: 'good', title: `${c.cat.name} is down ${pct(1 - proj / avg)}`,
          body: `Heading for ${m(proj)} vs. your usual ${m(avg)}. Whatever you're doing, keep it up.`, save: 0 });
        break;
      }
    }
  }

  // 13) No-spend days
  const spentDays = new Set(st.list.filter((e) => !e.recurringId).map((e) => e.date));
  const noSpend = st.dayNum - spentDays.size;
  if (st.isCurrent && st.dayNum >= 7) {
    out.push({ id: 'nospend', emoji: '🗓️', tone: noSpend >= 4 ? 'good' : 'info', title: `${plural(noSpend, 'no-spend day')} this month`,
      body: noSpend >= 4 ? 'Great discipline. Try for one more each week.' : 'Challenge: pick 2 days a week where you spend nothing (pack lunch, skip the coffee run). It resets impulse habits fast.', save: 0 });
  }

  const tone = { bad: 0, warn: 1, tip: 2, info: 3, good: 4 };
  out.sort((a, b) => (b.save || 0) - (a.save || 0) || tone[a.tone] - tone[b.tone]);
  // 'pace' and 'wants' summarize the specific tips, so they don't add to the total (no double counting).
  const totalSave = out.filter((i) => !['pace', 'wants'].includes(i.id)).reduce((a, i) => a + (i.save || 0), 0);
  return { insights: out, totalSave, ready: true };
}

export const MONEY_TIPS = [
  ['50/30/20 rule', 'About 50% of take-home pay for needs (rent, food, bills, transport), 30% for wants, and 20% for savings and debt payments.'],
  ['Pay yourself first', 'Move your savings out the day salary lands — before you spend. Automate it if your bank allows.'],
  ['Emergency fund', 'Build 3–6 months of essential expenses in an easy-to-reach account before investing.'],
  ['The 48-hour rule', "For anything non-essential, wait two days. If you still want it, buy it — guilt-free."],
  ['Audit subscriptions monthly', 'Cancel anything you did not use in the last 2 weeks. You can always resubscribe.'],
  ['Track every peso for 30 days', "Awareness alone cuts spending. You can't fix what you don't see."],
  ['Pay credit cards in full', 'Card interest in the Philippines can be up to 3% a month — one of the most expensive debts you can carry.'],
  ['Plan meals & bring baon', 'Cooking in batches on Sunday and bringing lunch is the single biggest food saving for most people.'],
];
