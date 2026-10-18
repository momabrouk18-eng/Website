import { store } from '../store.js';
import { $, $$, esc, num, fmt, money, pct, convert, CURRENCIES, opts, pageHead, todayISO, addDays, fdate, daysBetween } from '../ui.js';
import { CALENDAR } from '../data/calendar.js';

const TOOLS = [
  ['fx', 'Currency'],
  ['cbm', 'Cartons & containers'],
  ['margin', 'Margin & markup'],
  ['tiers', 'Price breaks'],
  ['lead', 'Lead-time planner'],
  ['units', 'Unit converter']
];
let tool = 'fx';
const state = {
  fx: { amount: 100, from: 'USD' },
  cbm: { l: 120, w: 15, h: 75, kg: 14.5, perCtn: 1, units: 1000 },
  margin: { cost: 100, price: 135, mode: 'price', target: 25 },
  tiers: { rows: [[500, 12.5], [1000, 11.8], [3000, 11.2], [5000, 10.9]], qty: 2000, cur: 'USD' },
  lead: { start: todayISO(), payDays: 3, prod: 35, toPort: 3, transit: 28, clear: 7, toWh: 2 },
  units: { inch: 55, cm: 120 }
};

const CONTAINERS = [['20GP', 28, 21700], ['40GP', 58, 26500], ['40HQ', 68, 26500]];

export function render(main) {
  main.dataset.live = 'off';
  main.innerHTML = pageHead('Calculators', 'Quick numbers you need between calls.') + `
    <div class="tabs">${TOOLS.map(([k, l]) => `<button data-tool="${k}" class="${tool === k ? 'active' : ''}">${l}</button>`).join('')}</div>
    <div id="tool"></div>`;
  $$('[data-tool]', main).forEach(b => b.addEventListener('click', () => { tool = b.dataset.tool; render(main); }));
  const box = $('#tool', main);
  ({ fx, cbm, margin, tiers, lead, units })[tool](box);
}

const field = (name, label, val, extra = '') => `<label class="field">${label}<input type="number" step="any" name="${name}" value="${esc(val)}" ${extra}></label>`;
const bind = (box, st, draw) => {
  box.addEventListener('input', e => {
    const el = e.target;
    if (!el.name || el.dataset.skip) return;
    st[el.name] = el.type === 'number' ? el.value : el.value;
    draw();
  });
  draw();
};

function fx(box) {
  const st = state.fx;
  const r = store.settings().rates;
  box.innerHTML = `<div class="grid side"><div class="panel"><div class="panel-body form-grid">
      ${field('amount', 'Amount', st.amount)}
      <label class="field">From<select name="from">${opts(CURRENCIES, st.from)}</select></label>
    </div><div class="panel-body flush"><table class="data" id="fx-out"></table></div></div>
    <div class="panel"><div class="panel-head"><h2>Rates used</h2><button class="btn sm" id="upd">Update now</button></div><div class="panel-body">
      ${CURRENCIES.filter(c => c !== 'USD').map(c => `<div class="kv-row"><span>1 USD</span><span>${fmt(r[c], 4)} ${c}</span></div>`).join('')}
      <p class="help mt">Indicative market rates. Customs and banks may use a different rate on the day. You can type your own rates in <a href="#/settings">Settings</a>.</p></div></div></div>`;
  bind(box, st, () => {
    $('#fx-out', box).innerHTML = `<tbody>${CURRENCIES.filter(c => c !== st.from).map(c => `<tr><td>${c}</td><td class="num strong">${fmt(convert(st.amount, st.from, c), 2)}</td><td class="num muted">1 ${st.from} = ${fmt(convert(1, st.from, c), 4)} ${c}</td></tr>`).join('')}</tbody>`;
  });
  box.addEventListener('change', () => { st.from = $('[name=from]', box).value; $('[name=amount]', box).dispatchEvent(new Event('input', { bubbles: true })); });
  $('#upd', box).addEventListener('click', async () => { await window.refreshRates(true); fx(box); });
}

function cbm(box) {
  const st = state.cbm;
  box.innerHTML = `<div class="grid side"><div class="panel"><div class="panel-head"><div><h2>Carton</h2><p>Outer carton (master carton) size</p></div></div><div class="panel-body form-grid">
      ${field('l', 'Length (cm)', st.l)}${field('w', 'Width (cm)', st.w)}${field('h', 'Height (cm)', st.h)}${field('kg', 'Gross weight (kg)', st.kg)}
      ${field('perCtn', 'Units per carton', st.perCtn)}${field('units', 'Total units', st.units)}
    </div></div><div class="panel"><div class="panel-body" id="cbm-out"></div></div></div>`;
  bind(box, st, () => {
    const cbmCtn = num(st.l) * num(st.w) * num(st.h) / 1e6;
    const ctns = Math.ceil(num(st.units) / Math.max(1, num(st.perCtn)));
    const totalCbm = cbmCtn * ctns, totalKg = num(st.kg) * ctns;
    const volAir = num(st.l) * num(st.w) * num(st.h) / 6000 * ctns;
    const volExp = num(st.l) * num(st.w) * num(st.h) / 5000 * ctns;
    $('#cbm-out', box).innerHTML = `
      <div class="big-result"><span>Shipment volume</span><b>${fmt(totalCbm, 2)} CBM</b><span>${fmt(ctns, 0)} cartons · ${fmt(totalKg, 0)} kg · ${fmt(cbmCtn, 4)} CBM per carton</span></div>
      <h3 class="mt mb">Container fit <small class="muted">(approx. usable volume)</small></h3>
      ${CONTAINERS.map(([name, cap, maxKg]) => {
        const fitCtn = Math.floor(cap / cbmCtn * 0.92);
        const n = Math.ceil(totalCbm / (cap * 0.92));
        const fill = Math.min(100, totalCbm / cap * 100);
        return `<div class="kv-row"><span><b>${name}</b> · ~${fmt(fitCtn, 0)} cartons / ${fmt(fitCtn * num(st.perCtn), 0)} units each</span><span>${totalCbm <= cap * 0.92 ? `${fmt(fill, 0)}% full` : `${n} containers`}${totalKg > maxKg * n ? ' · <span class="pill seal">too heavy</span>' : ''}</span></div>`;
      }).join('')}
      <p class="help mt">Below ~15 CBM, LCL (shared container) is usually cheaper than a full 20GP.</p>
      <h3 class="mt mb">Air &amp; courier</h3>
      <div class="kv-row"><span>Chargeable weight, air (÷6000)</span><span>${fmt(Math.max(volAir, totalKg), 1)} kg</span></div>
      <div class="kv-row"><span>Chargeable weight, express (÷5000)</span><span>${fmt(Math.max(volExp, totalKg), 1)} kg</span></div>`;
  });
}

function margin(box) {
  const st = state.margin;
  box.innerHTML = `<div class="grid side"><div class="panel"><div class="panel-body form-grid">
      ${field('cost', 'Cost per unit', st.cost)}${field('price', 'Selling price (excl. VAT)', st.price)}
      ${field('target', 'Target margin %', st.target)}
    </div></div><div class="panel"><div class="panel-body" id="m-out"></div></div></div>`;
  bind(box, st, () => {
    const c = num(st.cost), p = num(st.price), t = num(st.target);
    const m = p ? (p - c) / p * 100 : 0, mu = c ? (p - c) / c * 100 : 0;
    const need = t < 100 ? c / (1 - t / 100) : 0;
    $('#m-out', box).innerHTML = `
      <div class="grid cols-2"><div class="big-result ${m >= t ? 'good' : m >= 0 ? 'warn' : 'bad'}"><span>Margin</span><b>${pct(m)}</b><span>profit ÷ price</span></div>
      <div class="big-result"><span>Markup</span><b>${pct(mu)}</b><span>profit ÷ cost</span></div></div>
      <div class="mt"><div class="kv-row"><span>Profit per unit</span><span>${fmt(p - c, 2)}</span></div>
      <div class="kv-row"><span>Price needed for ${pct(t, 0)} margin</span><span><b>${fmt(need, 2)}</b></span></div>
      <div class="kv-row"><span>Max cost at this price for ${pct(t, 0)} margin</span><span>${fmt(p * (1 - t / 100), 2)}</span></div></div>
      <p class="help mt">A 25% margin is a 33% markup. Mixing them up is the most common pricing mistake.</p>`;
  });
}

function tiers(box) {
  const st = state.tiers;
  const drawInputs = () => `
    <table class="data"><thead><tr><th>From quantity</th><th>Unit price</th><th></th></tr></thead><tbody>
      ${st.rows.map((r, i) => `<tr><td><input type="number" data-skip="1" data-r="${i}" data-c="0" value="${esc(r[0])}"></td><td><input type="number" step="any" data-skip="1" data-r="${i}" data-c="1" value="${esc(r[1])}"></td><td><button class="icon-btn" data-del="${i}" aria-label="Remove tier">✕</button></td></tr>`).join('')}
    </tbody></table><div class="panel-body"><button class="btn sm" id="add-tier">Add price break</button></div>`;
  box.innerHTML = `<div class="grid side"><div class="panel"><div class="panel-head"><h2>Supplier price breaks</h2>
      <select name="cur" style="width:auto">${opts(CURRENCIES, st.cur)}</select></div><div id="tiers-in">${drawInputs()}</div></div>
    <div class="panel"><div class="panel-body form-grid">${field('qty', 'Quantity you plan to order', st.qty)}</div><div class="panel-body" id="t-out"></div></div></div>`;
  const draw = () => {
    const rows = st.rows.map(r => [num(r[0]), num(r[1])]).filter(r => r[0] && r[1]).sort((a, b) => a[0] - b[0]);
    const q = num(st.qty);
    const tier = rows.filter(r => r[0] <= q).pop();
    const next = rows.find(r => r[0] > q);
    let html = '';
    if (!rows.length) html = '<p class="help">Add at least one price break.</p>';
    else if (!tier) html = `<div class="big-result bad"><span>Below MOQ</span><b>${fmt(rows[0][0], 0)} pcs</b><span>Minimum order at ${money(rows[0][1], st.cur)}</span></div>`;
    else {
      const total = q * tier[1];
      html = `<div class="big-result"><span>Your price</span><b>${money(tier[1], st.cur, 2)}</b><span>Total ${money(total, st.cur)} for ${fmt(q, 0)} pcs</span></div>`;
      if (next) {
        const nextTotal = next[0] * next[1];
        const extra = nextTotal - total;
        html += `<div class="mt"><div class="kv-row"><span>Next break</span><span>${fmt(next[0], 0)} pcs at ${money(next[1], st.cur, 2)}</span></div>
          <div class="kv-row"><span>Extra spend to reach it</span><span>${money(extra, st.cur)} for ${fmt(next[0] - q, 0)} more pcs</span></div>
          <div class="kv-row"><span>Effective price of the extra units</span><span><b>${money(extra / (next[0] - q), st.cur, 2)}</b></span></div>
          <div class="kv-row"><span>Saving per unit</span><span>${money(tier[1] - next[1], st.cur, 2)} (${pct((tier[1] - next[1]) / tier[1] * 100)})</span></div></div>
          <p class="help mt">If you can sell the extra units, they effectively cost ${money(extra / (next[0] - q), st.cur, 2)} each.</p>`;
      }
    }
    $('#t-out', box).innerHTML = html;
  };
  box.addEventListener('input', e => {
    if (e.target.dataset.r !== undefined) st.rows[+e.target.dataset.r][+e.target.dataset.c] = e.target.value;
    else if (e.target.name === 'qty') st.qty = e.target.value;
    draw();
  });
  box.addEventListener('change', e => { if (e.target.name === 'cur') { st.cur = e.target.value; draw(); } });
  box.addEventListener('click', e => {
    if (e.target.closest('#add-tier')) { st.rows.push(['', '']); tiers(box); }
    const d = e.target.closest('[data-del]');
    if (d) { st.rows.splice(+d.dataset.del, 1); tiers(box); }
  });
  draw();
}

function lead(box) {
  const st = state.lead;
  box.innerHTML = `<div class="grid side"><div class="panel"><div class="panel-head"><div><h2>Order timeline</h2><p>Typical sea shipment China → Egypt</p></div></div><div class="panel-body form-grid">
      <label class="field span-2">Order confirmed on<input type="date" name="start" value="${esc(st.start)}"></label>
      ${field('payDays', 'Deposit reaches supplier (days)', st.payDays)}${field('prod', 'Production lead time (days)', st.prod)}
      ${field('toPort', 'Factory to port & loading (days)', st.toPort)}${field('transit', 'Sea transit (days)', st.transit)}
      ${field('clear', 'Customs clearance (days)', st.clear)}${field('toWh', 'Port to warehouse (days)', st.toWh)}
      <p class="help span-2">Transit to Alexandria or Port Said is usually 25–35 days from South China; air is 5–8 days door to door.</p>
    </div></div><div class="panel"><div class="panel-body" id="l-out"></div></div></div>`;
  bind(box, st, () => {
    let d = st.start || todayISO();
    const steps = [];
    const push = (label, days) => { const from = d; d = addDays(d, num(days)); steps.push({ label, from, to: d }); };
    push('Deposit paid', st.payDays);
    // Production pauses over Chinese New Year if it overlaps.
    const prodStart = d;
    let prodEnd = addDays(d, num(st.prod));
    const cny = CALENDAR.find(e => e.title.startsWith('Spring Festival') && e.end >= prodStart && e.date <= prodEnd);
    let pause = 0;
    if (cny) { pause = daysBetween(addDays(cny.date, -10), addDays(cny.end, 10)); prodEnd = addDays(prodEnd, pause); }
    steps.push({ label: `Production${pause ? ` (+${pause} days CNY pause)` : ''}`, from: prodStart, to: prodEnd });
    d = prodEnd;
    push('To port & loading (ETD)', st.toPort);
    push('Sea transit (ETA)', st.transit);
    push('Customs clearance', st.clear);
    push('In the warehouse', st.toWh);
    const total = daysBetween(st.start, d);
    $('#l-out', box).innerHTML = `<div class="big-result ${pause ? 'warn' : ''}"><span>Goods in warehouse around</span><b>${fdate(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</b><span>${total} days after order${pause ? ' · includes Chinese New Year shutdown' : ''}</span></div>
      <ul class="agenda mt">${steps.map(s => `<li><span class="when">${fdate(s.to, { day: 'numeric', month: 'short' })}</span><span class="what"><span>${esc(s.label)}</span><small>${daysBetween(s.from, s.to)} days</small></span></li>`).join('')}</ul>`;
  });
}

function units(box) {
  const st = state.units;
  box.innerHTML = `<div class="grid cols-2"><div class="panel"><div class="panel-head"><h2>Screen size</h2></div><div class="panel-body form-grid">
      ${field('inch', 'Diagonal (inches)', st.inch)}<div id="u-in" class="span-2"></div></div></div>
    <div class="panel"><div class="panel-head"><h2>Length</h2></div><div class="panel-body form-grid">
      ${field('cm', 'Centimetres', st.cm)}<div id="u-cm" class="span-2"></div></div></div></div>`;
  bind(box, st, () => {
    const i = num(st.inch), cm = i * 2.54;
    const w = cm * 16 / Math.hypot(16, 9), h = cm * 9 / Math.hypot(16, 9);
    $('#u-in', box).innerHTML = `<div class="kv-row"><span>Diagonal</span><span>${fmt(cm, 1)} cm</span></div><div class="kv-row"><span>16:9 screen width × height</span><span>${fmt(w, 1)} × ${fmt(h, 1)} cm</span></div>`;
    const c = num(st.cm);
    $('#u-cm', box).innerHTML = `<div class="kv-row"><span>Inches</span><span>${fmt(c / 2.54, 2)}"</span></div><div class="kv-row"><span>Feet</span><span>${fmt(c / 30.48, 2)} ft</span></div><div class="kv-row"><span>Metres</span><span>${fmt(c / 100, 3)} m</span></div>`;
  });
}
