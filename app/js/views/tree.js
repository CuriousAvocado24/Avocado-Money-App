// Tree tab: a living avocado tree drawn from your finances. Tap any part to see why it looks that way.
import { state, saveSettingsQuiet } from '../store.js';
import { todayISO, fmtShort } from '../dates.js';
import { esc, pct } from '../format.js';
import { openSheet } from '../ui.js';
import { columnChart } from '../charts.js';
import { treeState, STAGES, levelForStage } from '../tree.js';
import { openSettings, openSavingsSheet } from '../sheets.js';

const W = 360, H = 352, GY = 292; // ground line
const CX = 180;

// Canopy blobs (offsets in units of r) and fruit/flower/bug spots
const BLOBS = [[0, 0, 1], [-1.05, 0.35, 0.9], [1.05, 0.35, 0.9], [-0.6, -0.7, 0.85], [0.6, -0.7, 0.85], [-1.7, 0.75, 0.7], [1.7, 0.75, 0.7], [0, -1.2, 0.75], [0, 0.6, 0.85]];
const FRUIT = [[-0.5, 0.55], [0.55, 0.5], [-1.15, 0.85], [1.2, 0.85], [0.05, 0.95], [-0.2, -0.25], [0.95, -0.05], [-0.95, -0.05], [0.35, -0.75], [-0.45, -0.85], [1.6, 1.0], [-1.6, 1.0]];
const FLOWER = [[0.2, -1.55], [-1.3, -0.3], [1.35, -0.25]];
const BUG = [[-0.85, 0.15], [0.8, -0.45], [0.25, 0.75], [-0.3, -1.0], [1.4, 0.55]];

function leafColors(score) {
  if (score >= 0.7) return { back: '#3F5B1F', front: '#6E9A2E', hi: '#A8C85A' };
  if (score >= 0.4) return { back: '#5C6A26', front: '#8E9A3E', hi: '#C3C77A' };
  return { back: '#7A6230', front: '#B39250', hi: '#D9C089' };
}

function avocado(x, y, s, ripe) {
  const body = ripe ? '#2F4318' : '#9DBF4F';
  const shine = ripe ? '#5E7A2E' : '#C9DE8A';
  return `<g class="fruit">
    <line x1="${x}" y1="${y - 13 * s}" x2="${x}" y2="${y - 7 * s}" stroke="#5A3A24" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="${x}" cy="${y - 3 * s}" r="${4.6 * s}" fill="${body}"/>
    <ellipse cx="${x}" cy="${y + 3 * s}" rx="${7 * s}" ry="${8.5 * s}" fill="${body}"/>
    <ellipse cx="${x - 2.6 * s}" cy="${y + 1 * s}" rx="${1.8 * s}" ry="${3.4 * s}" fill="${shine}" opacity=".8"/>
  </g>`;
}

function blossom(x, y) {
  return `<g class="blossom">${[0, 72, 144, 216, 288].map((a) => {
    const r = (a * Math.PI) / 180;
    return `<circle cx="${(x + Math.cos(r) * 3.6).toFixed(1)}" cy="${(y + Math.sin(r) * 3.6).toFixed(1)}" r="2.9" fill="#FBF6E6"/>`;
  }).join('')}<circle cx="${x}" cy="${y}" r="2.2" fill="#F4D774"/></g>`;
}

export function drawTree(t) {
  const st = STAGES[t.stage];
  const lc = leafColors(t.leaves);
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="tree-svg" role="img" aria-label="Your avocado tree: ${esc(t.stageName)}, health ${t.health} out of 100, ${esc(t.mood)}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="sky-top"/><stop offset="1" class="sky-bottom"/></linearGradient>
    <linearGradient id="soil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.watered ? '#4A3020' : '#7A5A3C'}"/><stop offset="1" stop-color="${t.watered ? '#2E1E14' : '#5A3A24'}"/></linearGradient>
  </defs>
  <rect width="${W}" height="${GY}" fill="url(#sky)"/>`;

  // Weather
  svg += `<g data-part="weather" class="weather tap">`;
  if (t.weather === 'sunny') {
    svg += `<g class="sun"><circle cx="300" cy="62" r="24" class="sun-core"/>${Array.from({ length: 10 }, (_, i) => {
      const a = (i * 36 * Math.PI) / 180;
      return `<line x1="${(300 + Math.cos(a) * 31).toFixed(1)}" y1="${(62 + Math.sin(a) * 31).toFixed(1)}" x2="${(300 + Math.cos(a) * 40).toFixed(1)}" y2="${(62 + Math.sin(a) * 40).toFixed(1)}" class="sun-ray"/>`;
    }).join('')}</g>`;
  } else {
    if (t.weather === 'cloudy') svg += `<circle cx="296" cy="58" r="20" class="sun-core" opacity=".75"/>`;
    const cloud = (x, y, s, cls) => `<g class="${cls}"><circle cx="${x}" cy="${y}" r="${14 * s}"/><circle cx="${x + 16 * s}" cy="${y - 8 * s}" r="${17 * s}"/><circle cx="${x + 34 * s}" cy="${y}" r="${13 * s}"/><rect x="${x}" y="${y}" width="${34 * s}" height="${13 * s}"/></g>`;
    svg += cloud(250, 70, 1, t.weather === 'rainy' ? 'cloud dark' : 'cloud') + cloud(60, 52, 0.8, t.weather === 'rainy' ? 'cloud dark' : 'cloud');
    if (t.weather === 'rainy') {
      svg += `<g class="rain">${Array.from({ length: 14 }, (_, i) => `<line x1="${50 + i * 21}" y1="${92 + (i % 3) * 14}" x2="${46 + i * 21}" y2="${104 + (i % 3) * 14}" style="animation-delay:${((i * 0.13) % 1).toFixed(2)}s"/>`).join('')}</g>`;
    }
  }
  svg += `<rect x="0" y="0" width="${W}" height="120" fill="transparent"/></g>`;

  // Hills
  svg += `<path d="M0 ${GY - 10} Q 90 ${GY - 34} 180 ${GY - 14} T ${W} ${GY - 18} V ${GY + 2} H 0 Z" class="hill-back"/>
          <path d="M0 ${GY - 2} Q 120 ${GY - 18} 220 ${GY - 4} T ${W} ${GY - 6} V ${GY + 2} H 0 Z" class="hill"/>`;

  // Soil + roots
  const nRoots = 2 + Math.round(t.roots * 6);
  const rootLen = 14 + t.roots * 42;
  svg += `<g data-part="roots" class="tap"><rect x="0" y="${GY}" width="${W}" height="${H - GY}" fill="url(#soil)"/>`;
  for (let i = 0; i < nRoots; i++) {
    const spread = (i - (nRoots - 1) / 2) * (t.stage >= 3 ? 22 : 12);
    const len = rootLen * (0.65 + 0.35 * Math.cos((i / Math.max(1, nRoots - 1) - 0.5) * 2));
    svg += `<path d="M${CX} ${GY + 2} Q ${CX + spread * 0.35} ${GY + len * 0.55} ${CX + spread} ${GY + len}" class="root" stroke-width="${Math.max(1.4, 3.2 - Math.abs(spread) / 30)}"/>`;
  }
  if (t.watered) svg += `<g class="drops">${[[60, 312], [120, 334], [250, 318], [305, 338]].map(([x, y]) => `<path d="M${x} ${y} q 3 5 0 7 q -3 -2 0 -7z" fill="#8CB8E8"/>`).join('')}</g>`;
  else svg += `<g class="cracks">${[[70, 308], [270, 326]].map(([x, y]) => `<path d="M${x} ${y} l 8 6 l -5 6 l 9 7" />`).join('')}</g>`;
  svg += `</g>`;

  // The plant
  svg += `<g class="sway">`;
  if (t.stage === 0) {
    svg += `<g data-part="trunk" class="tap"><ellipse cx="${CX}" cy="${GY + 12}" rx="13" ry="11" fill="#9A4A2C"/><ellipse cx="${CX - 4}" cy="${GY + 8}" rx="3.5" ry="2.5" fill="#BE6E48"/><path d="M${CX} ${GY + 2} q 2 -8 7 -12" stroke="#6E9A2E" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>`;
  } else if (t.stage <= 2) {
    const top = GY - st.h;
    svg += `<g data-part="trunk" class="tap"><path d="M${CX} ${GY} C ${CX - 3} ${GY - st.h * 0.5} ${CX + 3} ${GY - st.h * 0.7} ${CX} ${top}" stroke="#6E7F2E" stroke-width="${st.w}" fill="none" stroke-linecap="round"/></g>`;
    const leaves = t.stage === 1 ? [[-1, top + 4], [1, top + 2]] : [[-1, top + 4], [1, top + 2], [-1, top + 22], [1, top + 26]];
    svg += `<g data-part="leaves" class="tap">${leaves.map(([d, y]) => `<ellipse cx="${CX + d * 14}" cy="${y}" rx="14" ry="7" transform="rotate(${d * -28} ${CX + d * 14} ${y})" fill="${lc.front}"/>`).join('')}</g>`;
  } else {
    const r = st.r;
    const top = GY - st.h;
    const cy = top - r * 0.25;
    const w = st.w;
    // Trunk with two branches into the canopy
    svg += `<g data-part="trunk" class="tap">
      <path d="M${CX - w * 0.75} ${GY} C ${CX - w * 0.5} ${GY - st.h * 0.4} ${CX - w * 0.45} ${GY - st.h * 0.7} ${CX - w * 0.3} ${top} L ${CX + w * 0.3} ${top} C ${CX + w * 0.45} ${GY - st.h * 0.7} ${CX + w * 0.5} ${GY - st.h * 0.4} ${CX + w * 0.75} ${GY} Z" fill="#5A3A24"/>
      <path d="M${CX - w * 0.15} ${GY - st.h * 0.55} Q ${CX - r * 0.6} ${GY - st.h * 0.75} ${CX - r * 0.9} ${cy + r * 0.4}" stroke="#5A3A24" stroke-width="${Math.max(2, w * 0.35)}" fill="none" stroke-linecap="round"/>
      <path d="M${CX + w * 0.15} ${GY - st.h * 0.6} Q ${CX + r * 0.5} ${GY - st.h * 0.8} ${CX + r * 0.85} ${cy + r * 0.35}" stroke="#5A3A24" stroke-width="${Math.max(2, w * 0.3)}" fill="none" stroke-linecap="round"/>
      <path d="M${CX - w * 0.2} ${GY - 10} q 2 -14 -1 -26 M${CX + w * 0.15} ${GY - 18} q -2 -12 1 -22" stroke="#3E2818" stroke-width="1.2" fill="none" opacity=".6"/>
    </g>`;
    // Canopy
    const blobs = BLOBS.slice(0, st.blobs);
    svg += `<g data-part="leaves" class="tap canopy">`;
    svg += blobs.map(([dx, dy, s]) => `<circle cx="${CX + dx * r}" cy="${cy + dy * r + 4}" r="${s * r}" fill="${lc.back}"/>`).join('');
    svg += blobs.map(([dx, dy, s]) => `<circle cx="${CX + dx * r - 2}" cy="${cy + dy * r - 2}" r="${s * r * 0.9}" fill="${lc.front}"/>`).join('');
    svg += blobs.map(([dx, dy, s]) => `<circle cx="${CX + dx * r - s * r * 0.35}" cy="${cy + dy * r - s * r * 0.4}" r="${s * r * 0.32}" fill="${lc.hi}" opacity=".55"/>`).join('');
    if (t.leaves < 0.4) svg += `<g class="falling">${[[-40, 30], [55, 60], [10, 90]].map(([dx, dy], i) => `<ellipse cx="${CX + dx}" cy="${cy + dy}" rx="5" ry="2.6" fill="${lc.front}" style="animation-delay:${i * 1.3}s"/>`).join('')}</g>`;
    svg += `</g>`;
    // Blossoms (weekly quests)
    if (t.blossoms) svg += `<g data-part="flowers" class="tap">${FLOWER.slice(0, t.blossoms).map(([dx, dy]) => blossom(CX + dx * r, cy + dy * r)).join('')}</g>`;
    // Avocados (goals + badges)
    const spots = FRUIT.slice(0, Math.min(FRUIT.length, st.blobs + 3));
    const fr = t.fruits.slice(0, spots.length);
    if (fr.length) svg += `<g data-part="fruit" class="tap">${fr.map((f, i) => avocado(CX + spots[i][0] * r, cy + spots[i][1] * r + 10, f.s * (0.95 + t.stage * 0.07), f.ripe)).join('')}</g>`;
    // Pests (debts)
    if (t.bugs.length) svg += `<g data-part="pests" class="tap">${t.bugs.slice(0, BUG.length).map((b, i) => `<text x="${CX + BUG[i][0] * r}" y="${cy + BUG[i][1] * r}" font-size="22" text-anchor="middle" class="bug" style="animation-delay:${i * 0.4}s">${b}</text>`).join('')}</g>`;
  }
  svg += `</g></svg>`;
  return svg;
}

function recordHealth(health) {
  const today = todayISO();
  const hist = { ...(state.settings.treeHistory || {}) };
  if (hist[today] === health) return;
  hist[today] = health;
  const keys = Object.keys(hist).sort().slice(-90);
  saveSettingsQuiet({ treeHistory: Object.fromEntries(keys.map((k) => [k, hist[k]])) });
}

export function render(root) {
  const t = treeState();
  recordHealth(t.health);
  const nextStage = t.stage < 6 ? STAGES[t.stage + 1].name : null;
  const nextLevel = t.stage < 6 ? levelForStage(t.stage + 1) : null;
  const ranked = [...t.parts].sort((a, b) => (1 - b.score) * b.weight - (1 - a.score) * a.weight).filter((p) => p.score < 0.95).slice(0, 3);

  root.innerHTML = `
    <div class="page-head"><h1>Your avocado <em>tree</em></h1></div>
    <div class="card tree-card">
      <div class="tree-top">
        <div><div class="muted" style="font-size:13px;font-weight:600">Stage ${t.stage + 1} of 7</div><h2>${esc(t.stageName)}</h2></div>
        <div class="health-ring" style="--p:${(t.health / 100).toFixed(2)}" aria-label="Tree health ${t.health} out of 100"><span><b>${t.health}</b><small>health</small></span></div>
      </div>
      <div class="tree-stage" data-tree>${drawTree(t)}</div>
      <div class="tree-status">
        <span class="badge ${t.health >= 60 ? 'accent' : t.health < 40 ? 'bad' : ''}">${t.health >= 80 ? '🌟' : t.health >= 60 ? '🌿' : t.health >= 40 ? '🍂' : '🥀'} ${esc(t.mood)}</span>
        <span class="badge ${t.watered ? 'accent' : ''}">${t.watered ? '💧 Watered today' : '🏜️ Thirsty: log or check in today'}</span>
      </div>
      <p class="muted" style="font-size:13px;margin-top:10px">${nextStage ? `Grows into a <b>${esc(nextStage)}</b> at level ${nextLevel} (you're level ${t.level.level}). Size comes from steady effort; health comes from how your money is doing right now.` : 'Fully grown. Keep it healthy and keep the harvest coming.'} Tap any part of the tree.</p>
    </div>

    ${ranked.length ? `<div class="card"><div class="card-title"><h2>Help it <em>grow</em></h2><a class="link" href="#/insights">All tips ›</a></div>
      ${ranked.map((p) => `<button class="grow-row" data-part-row="${p.id}"><span class="e">${p.emoji}</span><span class="mid"><b>${esc(p.name)}: ${esc(p.area)}</b><small>${esc(p.grow)}</small></span><span class="chev">›</span></button>`).join('')}
    </div>` : ''}

    <div class="section-label">Tree check-up</div>
    <div class="list">${t.parts.map((p) => `
      <button class="row" data-part-row="${p.id}">
        <span class="e">${p.emoji}</span>
        <div class="main"><div class="t1">${esc(p.name)} <span class="muted" style="font-weight:500;font-size:13px">· ${esc(p.area)}</span></div>
          <div class="t2">${esc(p.value)}</div>
          <div class="mini-bar"><i style="width:${(p.score * 100).toFixed(0)}%" class="${p.score < 0.4 ? 'low' : p.score < 0.7 ? 'mid' : ''}"></i></div></div>
        <div class="right"><div class="amt">${Math.round(p.score * 100)}</div><div class="amt-sub">of 100</div></div>
      </button>`).join('')}</div>

    <div class="card"><div class="card-title"><h2>Health over <em>time</em></h2></div><div data-chart="health"></div></div>`;

  // Tap parts of the drawing or the rows
  const openPart = (id) => {
    const p = t.parts.find((x) => x.id === id);
    if (!p) return;
    openSheet({
      body: `<div class="celebrate" style="text-align:left">
        <div style="display:flex;align-items:center;gap:12px"><span style="font-size:44px">${p.emoji}</span><div><h2 style="margin:0">${esc(p.name)}</h2><div class="muted" style="font-size:14px">${esc(p.area)} · ${Math.round(p.score * 100)}/100</div></div></div>
        <div class="xpbar"><i style="width:${(p.score * 100).toFixed(0)}%"></i></div>
        <p style="color:var(--text);font-weight:600;margin-bottom:6px">${esc(p.value)}</p>
        <p>${esc(p.what)}</p>
        <p style="color:var(--text)"><b>How to grow it:</b> ${esc(p.grow)}</p>
        <button class="btn primary block" data-go>${esc(p.action.label)}</button>
      </div>`,
      onMount: (s, close) => {
        s.querySelector('[data-go]').onclick = () => {
          close();
          if (p.action.href) location.hash = p.action.href;
          else if (p.action.act === 'savings') setTimeout(openSavingsSheet, 250);
          else if (p.action.act === 'settings') setTimeout(openSettings, 250);
        };
      },
    });
  };
  root.querySelectorAll('[data-tree] [data-part]').forEach((g) => g.addEventListener('click', () => openPart(g.dataset.part)));
  root.querySelectorAll('[data-part-row]').forEach((b) => (b.onclick = () => openPart(b.dataset.partRow)));

  const hist = Object.entries(state.settings.treeHistory || {}).sort(([a], [b]) => a.localeCompare(b)).slice(-30);
  columnChart(root.querySelector('[data-chart="health"]'), hist.map(([d, v], i) => ({ label: fmtShort(d), value: v, hl: d === todayISO(), tip: fmtShort(d) })), {
    height: 110, format: (v) => `${Math.round(v)}/100`, axisFormat: (v) => String(Math.round(v)), label: 'Tree health by day',
    showLabel: (i) => i === 0 || i === hist.length - 1,
  });
}
