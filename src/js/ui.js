import { store } from './store.js';
import { pauseScroll } from './motion.js';

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const CURRENCIES = ['USD', 'CNY', 'EGP', 'TRY', 'EUR'];

// ---------- numbers & money ----------
export const num = v => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
export function fmt(n, digits = 2) {
  if (n === null || n === undefined || !Number.isFinite(+n)) return '—';
  return (+n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export function money(n, cur = 'USD', digits) {
  if (n === null || n === undefined || !Number.isFinite(+n)) return '—';
  const d = digits ?? (Math.abs(n) >= 1000 ? 0 : 2);
  return `${fmt(n, d)} ${cur}`;
}
export function pct(n, digits = 1) {
  if (!Number.isFinite(+n)) return '—';
  return `${fmt(n, digits)}%`;
}
// Convert between currencies using settings rates (units per 1 USD).
export function convert(amount, from, to) {
  const r = store.settings().rates;
  const a = num(amount);
  if (from === to) return a;
  const usd = a / (r[from] || 1);
  return usd * (r[to] || 1);
}

// ---------- dates ----------
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}
export function fdate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-GB', opts);
}
export function relDay(iso) {
  if (!iso) return '';
  const diff = daysBetween(todayISO(), iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${-diff} days late`;
  if (diff < 7) return `In ${diff} days`;
  return fdate(iso, { day: 'numeric', month: 'short' });
}
export function dueClass(iso) {
  if (!iso) return '';
  const diff = daysBetween(todayISO(), iso);
  if (diff < 0) return 'late';
  if (diff === 0) return 'today';
  return '';
}

// ---------- small renderers ----------
export function stars(n, max = 5) {
  const v = Math.round(num(n));
  if (!v) return '<span class="muted">Not rated</span>';
  return `<span class="stars" aria-label="${v} of ${max}">${'★'.repeat(v)}<span class="off">${'★'.repeat(max - v)}</span></span>`;
}
export function pill(text, tone = '') {
  return `<span class="pill ${tone}">${esc(text)}</span>`;
}
export function emptyState(title, text, actionHtml = '') {
  return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${actionHtml}</div>`;
}
export function opts(list, selected) {
  return list.map(o => {
    const [v, l] = Array.isArray(o) ? o : typeof o === 'object' ? [o.value, o.label] : [o, o];
    return `<option value="${esc(v)}" ${String(v) === String(selected ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
  }).join('');
}
export function supplierOptions(includeBlank = true) {
  const list = store.all('suppliers').slice().sort((a, b) => a.name.localeCompare(b.name)).map(s => [s.id, s.name]);
  return includeBlank ? [['', '—'], ...list] : list;
}
export function supplierName(id) {
  const s = store.get('suppliers', id);
  return s ? s.name : '';
}
export function supplierLink(id) {
  const s = store.get('suppliers', id);
  return s ? `<a href="#/suppliers/${esc(s.id)}">${esc(s.name)}</a>` : '<span class="muted">—</span>';
}

// ---------- toast ----------
export function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $('#toast-root').append(el);
  setTimeout(() => el.remove(), 2600);
}
window.addEventListener('store-error', e => toast(e.detail, 'err'));

// ---------- modal ----------
let lastFocus = null;
export function modal({ title, body, foot = '', wide = false, onMount }) {
  closeModal();
  lastFocus = document.activeElement;
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-back" data-close-back data-lenis-prevent>
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-head"><h2 id="modal-title">${esc(title)}</h2>
          <button class="icon-btn" data-close aria-label="Close"><svg width="18" height="18" viewBox="0 0 18 18"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
        </div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
      </div>
    </div>`;
  pauseScroll(true);
  const back = $('.modal-back', root);
  back.addEventListener('mousedown', e => { if (e.target === back) closeModal(); });
  $$('[data-close]', root).forEach(b => b.addEventListener('click', closeModal));
  const m = $('.modal', root);
  const first = $('input, select, textarea', m);
  (first || $('[data-close]', m)).focus();
  onMount && onMount(m);
  return m;
}
export function closeModal() {
  const root = $('#modal-root');
  if (root && root.innerHTML) {
    root.innerHTML = '';
    pauseScroll(false);
    lastFocus && lastFocus.focus && lastFocus.focus();
  }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

export function confirmDialog(text, okLabel = 'Delete') {
  return new Promise(resolve => {
    modal({
      title: 'Are you sure?',
      body: `<p>${esc(text)}</p>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn danger" id="cfm-ok">${esc(okLabel)}</button>`,
      onMount: m => {
        $('#cfm-ok', m).addEventListener('click', () => { closeModal(); resolve(true); });
        $$('[data-close]', m).forEach(b => b.addEventListener('click', () => resolve(false)));
      }
    });
  });
}

// ---------- forms ----------
// field: { name, label, type, options, help, span, placeholder, required, step, suffix }
function fieldHtml(f, value) {
  const v = value ?? f.default ?? '';
  const id = `f-${f.name}`;
  const req = f.required ? 'required' : '';
  const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
  let input = '';
  switch (f.type) {
    case 'section':
      return `<div class="section-title">${esc(f.label)}</div>`;
    case 'textarea':
      input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 4}" ${ph} ${req}>${esc(v)}</textarea>`; break;
    case 'select':
      input = `<select id="${id}" name="${f.name}" ${req}>${opts(typeof f.options === 'function' ? f.options() : f.options, v)}</select>`; break;
    case 'checkbox':
      return `<label class="check ${f.span ? 'span-2' : ''}"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>`;
    case 'rating':
      input = `<div class="rating" data-rating="${f.name}">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-v="${i}" class="${i <= num(v) ? 'on' : ''}" aria-label="${i} stars">★</button>`).join('')}<input type="hidden" name="${f.name}" value="${esc(v)}"></div>`; break;
    case 'multi': {
      const sel = Array.isArray(v) ? v : [];
      const list = typeof f.options === 'function' ? f.options() : f.options;
      input = list.length
        ? `<div class="row" style="gap:6px 14px">${list.map(([val, lab]) => `<label class="check"><input type="checkbox" data-multi="${f.name}" value="${esc(val)}" ${sel.includes(val) ? 'checked' : ''}> ${esc(lab)}</label>`).join('')}</div>`
        : `<p class="help">${esc(f.emptyText || 'Nothing to choose yet.')}</p>`;
      break;
    }
    case 'money': {
      const cur = f.currencyName;
      input = `<div class="input-group"><input id="${id}" type="number" step="any" name="${f.name}" value="${esc(v)}" ${ph} ${req}><select name="${cur}">${opts(CURRENCIES, f.currencyValue)}</select></div>`;
      break;
    }
    default:
      input = `<input id="${id}" type="${f.type || 'text'}" ${f.type === 'number' ? `step="${f.step || 'any'}"` : ''} name="${f.name}" value="${esc(v)}" ${ph} ${req} ${f.list ? `list="${id}-list"` : ''}>`;
      if (f.list) input += `<datalist id="${id}-list">${f.list.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`;
  }
  return `<label class="field ${f.span ? 'span-2' : ''}" for="${id}">${esc(f.label)}${f.help ? ` <small>${esc(f.help)}</small>` : ''}${input}</label>`;
}

export function formHtml(fields, values = {}) {
  return `<div class="form-grid">${fields.map(f => {
    if (f.type === 'money') return fieldHtml({ ...f, currencyValue: values[f.currencyName] || f.currencyDefault || store.settings().buyCurrency }, values[f.name]);
    return fieldHtml(f, values[f.name]);
  }).join('')}</div>`;
}

export function wireRatings(root) {
  $$('[data-rating]', root).forEach(r => {
    r.addEventListener('click', e => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      const v = +b.dataset.v;
      const hidden = $('input', r);
      hidden.value = hidden.value == v ? '' : v;
      $$('button', r).forEach(x => x.classList.toggle('on', +x.dataset.v <= num(hidden.value)));
    });
  });
}

export function readForm(root, fields) {
  const out = {};
  fields.forEach(f => {
    if (f.type === 'section') return;
    if (f.type === 'checkbox') { out[f.name] = $(`[name="${f.name}"]`, root)?.checked || false; return; }
    if (f.type === 'multi') { out[f.name] = $$(`[data-multi="${f.name}"]:checked`, root).map(x => x.value); return; }
    const el = $(`[name="${f.name}"]`, root);
    let v = el ? el.value.trim() : '';
    if (f.type === 'number' || f.type === 'money' || f.type === 'rating') v = v === '' ? '' : num(v);
    out[f.name] = v;
    if (f.type === 'money') out[f.currencyName] = $(`[name="${f.currencyName}"]`, root).value;
  });
  return out;
}

export function openForm({ title, fields, values = {}, onSubmit, onDelete, submitLabel = 'Save', wide = false }) {
  if (onDelete && !store.canDelete()) onDelete = null; // only admins delete
  modal({
    title, wide,
    body: `<form id="modal-form" novalidate>${formHtml(fields, values)}</form>`,
    foot: `${onDelete ? '<button class="btn danger left" id="form-del">Delete</button>' : ''}<button class="btn" data-close>Cancel</button><button class="btn primary" id="form-ok">${esc(submitLabel)}</button>`,
    onMount: m => {
      wireRatings(m);
      const form = $('#modal-form', m);
      const submit = e => {
        e && e.preventDefault();
        const missing = fields.filter(f => f.required && !$(`[name="${f.name}"]`, form)?.value.trim());
        if (missing.length) {
          toast(`Add ${missing.map(f => f.label.toLowerCase()).join(', ')} to save.`, 'err');
          $(`[name="${missing[0].name}"]`, form).focus();
          return;
        }
        const data = readForm(form, fields);
        closeModal();
        onSubmit(data);
      };
      form.addEventListener('submit', submit);
      $('#form-ok', m).addEventListener('click', submit);
      form.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') submit(e);
      });
      if (onDelete) $('#form-del', m).addEventListener('click', async () => {
        if (await confirmDialog('This cannot be undone.')) onDelete();
      });
    }
  });
}

export function copyText(text) {
  const done = () => toast('Copied');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => fallback());
  else fallback();
  function fallback() {
    const t = document.createElement('textarea');
    t.value = text; document.body.append(t); t.select();
    try { document.execCommand('copy'); done(); } catch { toast('Copy failed. Select the text and copy it manually.', 'err'); }
    t.remove();
  }
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function toCSV(rows, columns) {
  const q = v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map(c => q(c.label)).join(','), ...rows.map(r => columns.map(c => q(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(','))].join('\n');
}

export function pageHead(title, sub = '', actions = '', crumbs = '') {
  return `<div class="page-head"><div>${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}<h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</div>`;
}

// Times in a given IANA zone
export function zoneParts(tz, date = new Date()) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false, day: 'numeric', month: 'short' }).formatToParts(date);
  const g = t => p.find(x => x.type === t)?.value;
  const h = +g('hour') % 24, m = +g('minute');
  return { h, m, hours: h + m / 60, time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, weekday: g('weekday'), day: g('day'), month: g('month') };
}
export function zoneOffsetHours(tz, date = new Date()) {
  const a = zoneParts(tz, date), b = zoneParts('UTC', date);
  let d = a.hours - b.hours;
  if (d > 12) d -= 24; if (d < -12) d += 24;
  return Math.round(d * 4) / 4;
}
export function chinaStatus(date = new Date()) {
  const s = store.settings();
  const cn = zoneParts('Asia/Shanghai', date);
  const weekend = cn.weekday === 'Sun';
  const sat = cn.weekday === 'Sat';
  const t = cn.hours;
  if (weekend) return { key: 'closed', label: 'Sunday in China', detail: 'Most offices are closed. Factories may run a skeleton shift.' };
  if (t >= s.lunchStart && t < s.lunchEnd) return { key: 'lunch', label: 'Lunch break in China', detail: 'Expect slow replies until after lunch.' };
  if (t >= s.factoryStart && t < s.factoryEnd) return { key: 'open', label: sat ? 'Saturday in China' : 'China is at work', detail: sat ? 'Many factories work Saturdays; sales offices may be quiet.' : 'Good time for calls and WeChat.' };
  if (t >= s.factoryEnd && t < 21) return { key: 'lunch', label: 'Evening in China', detail: 'Sales reps often still answer WeChat.' };
  return { key: 'closed', label: 'Night in China', detail: 'Send messages now; replies come in their morning.' };
}
