// Insights: what to cut, ranked by how much it would save.
import { moneyRound, esc } from '../format.js';
import { buildInsights, MONEY_TIPS } from '../engine.js';
import { trackDetected } from './bills.js';
import { openSettings } from '../sheets.js';

export function render(root) {
  const { insights, totalSave, ready } = buildInsights();
  let html = `<div class="page-head"><h1>Where to <em>cut</em></h1><a class="pill" href="#/tree">🥑 Tree</a></div>`;
  if (!ready) {
    html += `<div class="card empty"><div class="big">💡</div><h2>Insights are <em>warming up</em></h2><p>Log at least a few days of expenses and Avocado Money will spot patterns and tell you exactly where to cut.</p><div class="btns"><a class="btn primary" href="#/add">Add an expense</a></div></div>`;
  } else {
    html += `<div class="card">
      <div class="hero-label">You could free up</div>
      <div class="hero-num">${moneyRound(totalSave)}<small style="font-size:20px;font-weight:600;color:var(--text-2)">/month</small></div>
      <div class="hero-sub">${moneyRound(totalSave * 12)} a year, if you act on the tips below. Estimates based on your last 30 days.</div>
    </div>`;
    html += insights.map((i, n) => `
      <div class="card insight">
        <span class="e">${i.emoji}</span>
        <div style="flex:1;min-width:0">
          <h3>${esc(i.title)}</h3>
          <p>${esc(i.body)}</p>
          ${i.save > 0 ? `<span class="save">Save ~${moneyRound(i.save)}/mo</span>` : ''}
          ${i.action ? `<div class="actions">${i.action.href ? `<a class="btn small" href="${i.action.href}">${esc(i.action.label)}</a>` : `<button class="btn small" data-action="${n}">${esc(i.action.label)}</button>`}</div>` : ''}
        </div>
      </div>`).join('');
    if (!insights.some((i) => i.id.startsWith('pace') || i.id === 'over')) {
      html += `<div class="card insight"><span class="e">🎯</span><div><h3>Set a monthly budget</h3><p>With a budget, Avocado Money tells you how much is safe to spend each day and warns you before you overspend.</p><div class="actions"><button class="btn small" data-settings>Set budget</button></div></div></div>`;
    }
  }
  html += `<div class="section-label">Money basics</div><div class="card tip-list">${MONEY_TIPS.map(([t, b]) => `<div class="tip"><h3>${esc(t)}</h3><p>${esc(b)}</p></div>`).join('')}</div>
    <p class="muted" style="font-size:12px;text-align:center;padding:0 12px">General budgeting tips, not personalized financial advice.</p>`;
  root.innerHTML = html;
  root.querySelectorAll('[data-action]').forEach((b) => (b.onclick = () => {
    const a = insights[+b.dataset.action].action;
    if (a.detect) trackDetected(a.detect);
  }));
  root.querySelector('[data-settings]')?.addEventListener('click', openSettings);
}
