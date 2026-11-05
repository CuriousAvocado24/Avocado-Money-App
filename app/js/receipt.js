// Receipt scanning (on-device OCR with Tesseract.js) + parsing of receipts and payment SMS / e-wallet messages.
import { todayISO, toISO, addDays } from './dates.js';
import { findMerchant, guessCategory } from './categories.js';

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let workerPromise = null;
let progressCb = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load the receipt reader. Check your internet connection (needed the first time only).'));
    document.head.appendChild(s);
  });
}

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      if (!window.Tesseract) await loadScript(TESSERACT_URL);
      return window.Tesseract.createWorker('eng', 1, {
        logger: (m) => progressCb && progressCb(m),
      });
    })();
    workerPromise.catch(() => { workerPromise = null; });
  }
  return workerPromise;
}

async function loadImage(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Could not open that image.')); });
  }
  return { img, url };
}

function drawScaled(img, maxDim) {
  const s = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** Grayscale + contrast boost: thermal receipts are faint. */
function enhance(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    let g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    g = (g - 128) * 1.6 + 140;
    g = g < 0 ? 0 : g > 255 ? 255 : g;
    p[i] = p[i + 1] = p[i + 2] = g;
  }
  ctx.putImageData(d, 0, 0);
  return canvas;
}

/** Turn a photo into a compact JPEG for storage (≈100–200 KB). */
export async function compressPhoto(file) {
  const { img, url } = await loadImage(file);
  const c = drawScaled(img, 1100);
  URL.revokeObjectURL(url);
  return c.toDataURL('image/jpeg', 0.7);
}

/** Read a receipt photo. onProgress(0..1, label). Returns { text, amount, merchant, date, category } */
export async function scanReceipt(file, onProgress) {
  const { img, url } = await loadImage(file);
  const canvas = enhance(drawScaled(img, 1800));
  URL.revokeObjectURL(url);
  progressCb = (m) => {
    if (!onProgress) return;
    if (m.status === 'recognizing text') onProgress(0.3 + m.progress * 0.7, 'Reading text…');
    else onProgress(Math.min(0.3, (m.progress || 0) * 0.3), 'Loading reader…');
  };
  onProgress && onProgress(0.02, 'Loading reader…');
  const worker = await getWorker();
  const { data } = await worker.recognize(canvas);
  progressCb = null;
  return { text: data.text, ...parseReceiptText(data.text) };
}

/* ---------------- Parsing ---------------- */

const AMOUNT_RE = /(\d{1,3}(?:,\d{3})+|\d+)[.,](\d{2})(?!\d)/g;

export function amountsIn(line) {
  const out = [];
  let m;
  AMOUNT_RE.lastIndex = 0;
  while ((m = AMOUNT_RE.exec(line))) {
    const v = parseFloat(m[1].replace(/,/g, '') + '.' + m[2]);
    if (v > 0 && v < 10000000) out.push(v);
  }
  return out;
}

const STRONG = /(t[o0]ta[l1i]\s*amount\s*due|amount\s*due|grand\s*t[o0]ta[l1i]|t[o0]ta[l1i]\s*due|t[o0]ta[l1i]\s*sales?\s*\(?vat\s*inc|net\s*amount\s*due)/i;
const KEYS = [
  [/t[o0]ta[l1i]\s*amount\s*due|net\s*amount\s*due/i, 10],
  [/amount\s*due/i, 9],
  [/grand\s*t[o0]ta[l1i]/i, 9],
  [/t[o0]ta[l1i]\s*due/i, 8],
  [/t[o0]ta[l1i]\s*(sales?|amount|php|₱)?/i, 6],
  [/amount\s*paid|you\s*paid|total\s*payment/i, 4],
  [/balance/i, 2],
];
const EXCLUDE = /sub\s*-?\s*t[o0]ta[l1i]|vat|tax|change|cash|tender|discount|disc\b|items?\b|qty|quantity|exempt|zero|savings|points|service\s*charge|rounding|sc\/pwd|senior/i;

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

export function parseDate(text) {
  const today = todayISO();
  const min = addDays(today, -400);
  const valid = (y, m, d) => {
    if (y < 100) y += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(y, m - 1, d);
    if (dt.getMonth() !== m - 1) return null;
    const iso = toISO(dt);
    return iso <= addDays(today, 1) && iso >= min ? iso : null;
  };
  let m;
  const t = text.replace(/\s+/g, ' ');
  if ((m = t.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/))) { const r = valid(+m[1], +m[2], +m[3]); if (r) return r; }
  const re = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/g;
  while ((m = re.exec(t))) {
    let a = +m[1], b = +m[2];
    const y = +m[3];
    const r = valid(y, a, b) || (a > 12 ? valid(y, b, a) : null);
    if (r) return r;
  }
  if ((m = t.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/))) {
    const mo = MONTHS[m[1].toLowerCase().slice(0, 4)] || MONTHS[m[1].toLowerCase().slice(0, 3)];
    if (mo) { const r = valid(+m[3], mo, +m[2]); if (r) return r; }
  }
  if ((m = t.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/))) {
    const mo = MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (mo) { const r = valid(+m[3], mo, +m[1]); if (r) return r; }
  }
  return null;
}

const JUNK = /receipt|invoice|official|vat\s*reg|\btin\b|\breg\b|tel\.?|phone|address|cashier|date|time|pos\b|terminal|street|\bst\.|\bave\b|city|branch|welcome|thank|order|table|server|guest|accreditation|permit|serial|\bmin\b|\bsn\b/i;

function titleCase(s) {
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ').trim();
}

export function parseReceiptText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let best = null;
  lines.forEach((line, i) => {
    for (const [re, score] of KEYS) {
      if (!re.test(line)) continue;
      if (!STRONG.test(line) && EXCLUDE.test(line)) break;
      let nums = amountsIn(line);
      if (!nums.length && lines[i + 1]) nums = amountsIn(lines[i + 1]);
      if (nums.length) {
        const v = nums[nums.length - 1];
        // Later lines win ties: the final TOTAL is usually below item totals.
        if (!best || score > best.score || (score === best.score && v >= best.v)) best = { v, score };
      }
      break;
    }
  });
  let amount = best ? best.v : null;
  if (!amount) {
    const all = lines.filter((l) => !EXCLUDE.test(l)).flatMap(amountsIn);
    if (all.length) amount = Math.max(...all);
  }

  const known = findMerchant(lines.slice(0, 12).join(' ')) || findMerchant(text);
  let merchant = known && known.name.length > 2 && !['Gas', 'Restaurant', 'Cafe', 'Jeep', 'Electricity', 'Palengke', 'Clinic', 'Hotel', 'Salon', 'Cinema', 'Padala', 'Rent', 'Tuition', 'Toll', 'Parking', 'Taxi'].includes(known.name) ? known.name : '';
  if (!merchant) {
    for (const l of lines.slice(0, 6)) {
      const letters = (l.match(/[a-z]/gi) || []).length;
      if (letters >= 3 && letters / l.length > 0.55 && !JUNK.test(l) && amountsIn(l).length === 0) {
        merchant = titleCase(l.replace(/[^\w&'.\- ]/g, '')).slice(0, 40);
        break;
      }
    }
  }
  const date = parseDate(text);
  const category = (merchant && guessCategory(merchant)) || (known && known.category) || null;
  return { amount, merchant, date, category };
}

/** Parse a pasted bank / GCash / Maya / card SMS or email notification. */
export function parseMessage(raw) {
  const t = raw.replace(/\s+/g, ' ').trim();
  let amount = null;
  let m = t.match(/(?:PHP|Php|php|₱|P)\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?/);
  if (m) amount = parseFloat(m[1].replace(/,/g, '') + (m[2] ? '.' + m[2] : ''));
  if (amount == null) { const a = amountsIn(t); if (a.length) amount = a[0]; }
  let merchant = '';
  for (const prep of ['at', 'to', 'for', 'with']) {
    const re = new RegExp(`\\b${prep}\\s+([A-Za-z0-9][A-Za-z0-9&'.\\-* ]{1,40}?)(?=\\s+(?:on|with|using|via|ref|reference|from|has|was|is|for|amount|dated)\\b|[.,;:]|\\s*$)`, 'i');
    m = t.match(re);
    if (m && !/^(?:php|p|₱)?\s?[\d,.]+$|^(?:php|p)\s/i.test(m[1].trim()) && !/^(your|the|a|an)\b/i.test(m[1])) { merchant = m[1].trim(); break; }
  }
  if (!merchant) { const k = findMerchant(t); if (k) merchant = k.name; }
  merchant = merchant.replace(/\*+/g, '').trim();
  if (merchant && merchant === merchant.toUpperCase()) merchant = titleCase(merchant);
  const known = findMerchant(merchant);
  if (known && known.name.length > 3) merchant = known.name;
  let method = null;
  if (/gcash/i.test(t)) method = 'GCash';
  else if (/maya|paymaya/i.test(t)) method = 'Maya';
  else if (/credit card|\bcc\b|mastercard|visa/i.test(t)) method = 'Credit card';
  else if (/debit|atm|bpi|bdo|metrobank|unionbank|security bank|landbank|rcbc|chinabank|pnb/i.test(t)) method = 'Debit card';
  return { amount, merchant, date: parseDate(t), category: guessCategory(merchant), method };
}
