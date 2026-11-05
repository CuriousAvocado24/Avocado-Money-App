// Small dependency-free SVG charts. Thin columns, 4px rounded tops, recessive grid, tap-to-inspect tooltips.
import { esc } from './format.js';

function niceMax(v) {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function colPath(x, y, w, h) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Column chart.
 * data: [{ label, value, tip, hl }]  — hl = accent-colored (current period); others use the de-emphasis step.
 * opts: { height, format, axisFormat, ref, refLabel, showLabel(i) }
 */
export function columnChart(container, data, opts = {}) {
  const { height = 160, format = String, axisFormat = String, ref = 0, refLabel = '', showLabel = () => true } = opts;
  const W = Math.max(240, container.clientWidth || 320);
  const H = height;
  const padT = 8, padB = 22, padR = 40;
  const plotW = W - padR;
  const plotH = H - padT - padB;
  const max = niceMax(Math.max(ref || 0, ...data.map((d) => d.value)));
  const y = (v) => padT + plotH - (v / max) * plotH;
  const band = plotW / data.length;
  const bw = Math.max(2, Math.min(24, band - 2));

  const ticks = [0, max / 2, max];
  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label || 'Chart')}">`;
  svg += '<g class="grid">' + ticks.slice(1).map((t) => `<line x1="0" x2="${plotW}" y1="${y(t)}" y2="${y(t)}"/>`).join('') + '</g>';
  svg += ticks.map((t) => `<text class="tick" x="${W - 2}" y="${y(t) + 4}" text-anchor="end">${esc(axisFormat(t))}</text>`).join('');
  data.forEach((d, i) => {
    const h = (d.value / max) * plotH;
    const x = i * band + (band - bw) / 2;
    svg += `<path class="bar ${d.hl ? 'hl' : ''}" data-i="${i}" d="${colPath(x, y(d.value), bw, h)}"/>`;
    if (showLabel(i)) svg += `<text class="tick" x="${i * band + band / 2}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
  });
  svg += `<line class="baseline" x1="0" x2="${plotW}" y1="${y(0)}" y2="${y(0)}"/>`;
  if (ref > 0) {
    svg += `<line class="ref" x1="0" x2="${plotW}" y1="${y(ref)}" y2="${y(ref)}"/>`;
    if (refLabel) svg += `<text class="ref-label" x="2" y="${y(ref) - 4}">${esc(refLabel)}</text>`;
  }
  svg += '</svg>';

  container.classList.add('chart');
  container.innerHTML = svg + '<div class="chart-tip"></div>';
  const tip = container.querySelector('.chart-tip');
  const bars = container.querySelectorAll('.bar');
  const svgEl = container.querySelector('svg');
  let active = -1;

  const show = (clientX) => {
    const rect = svgEl.getBoundingClientRect();
    const i = Math.floor((clientX - rect.left) / band);
    if (i < 0 || i >= data.length) return hide();
    if (i !== active) {
      bars[active]?.classList.remove('active');
      bars[i].classList.add('active');
      active = i;
    }
    const d = data[i];
    container.classList.add('hovering');
    tip.innerHTML = `${esc(d.tip || d.label)}<br><b>${esc(format(d.value))}</b>`;
    const cx = i * band + band / 2;
    const half = tip.offsetWidth / 2;
    tip.style.left = Math.min(Math.max(cx, half), W - half) + 'px';
    tip.style.top = Math.max(-46, y(d.value) - 50) + 'px';
    tip.classList.add('show');
  };
  const hide = () => {
    container.classList.remove('hovering');
    tip.classList.remove('show');
    bars[active]?.classList.remove('active');
    active = -1;
  };
  let timer = null;
  svgEl.addEventListener('pointerdown', (e) => { clearTimeout(timer); show(e.clientX); });
  svgEl.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) show(e.clientX); });
  svgEl.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  svgEl.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { clearTimeout(timer); timer = setTimeout(hide, 2200); } });
}
