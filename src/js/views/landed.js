import { store } from '../store.js';
import { $, $$, esc, num, fmt, money, pct, convert, CURRENCIES, opts, emptyState, pageHead, fdate, toast, confirmDialog, supplierOptions, download, toCSV, todayISO } from '../ui.js';

const INCOTERMS = [
  ['EXW', 'EXW – Ex Works'], ['FCA', 'FCA – Free Carrier'], ['FOB', 'FOB – Free On Board'],
  ['CFR', 'CFR – Cost & Freight'], ['CIF', 'CIF – Cost, Insurance & Freight'], ['DAP', 'DAP – Delivered At Place'], ['DDP', 'DDP – Delivered Duty Paid']
];
const FREIGHT_INCLUDED = ['CFR', 'CIF', 'DAP', 'DDP'];
const INSURANCE_INCLUDED = ['CIF', 'DDP'];
const ORIGIN_NEEDED = ['EXW'];

export function country(id) {
  return store.all('countries').find(c => c.id === id) || store.all('countries')[0];
}

export function defaults() {
  const s = store.settings();
  const c = country(s.homeCountry);
  return {
    name: '', product: '', supplierId: '', country: c.id,
    qty: 1000, unitPrice: '', currency: s.buyCurrency || 'USD', incoterm: 'FOB',
    originCharges: 0, originCur: 'USD', freight: '', freightCur: 'USD', insurancePct: 0.5,
    duty: c.duty, extraDuty: c.extraDuty, specialTax: c.specialTax, vat: c.vat, vatRecoverable: c.vatRecoverable,
    customsFees: 0, clearance: 0, inland: 0, otherLocal: 0, bankPct: 0.3,
    retail: '', retailInclVat: true, channelPct: 0, targetMargin: 25
  };
}

// All amounts end in the destination country's currency.
export function compute(x) {
  const c = country(x.country);
  const home = c.currency;
  const qty = Math.max(1, num(x.qty));
  const cv = (amt, cur) => convert(num(amt), cur || 'USD', home);
  const inc = x.incoterm;

  const goods = cv(num(x.unitPrice) * qty, x.currency);
  const origin = ORIGIN_NEEDED.includes(inc) ? cv(x.originCharges, x.originCur) : 0;
  const freight = FREIGHT_INCLUDED.includes(inc) ? 0 : cv(x.freight, x.freightCur);
  const insurance = INSURANCE_INCLUDED.includes(inc) ? 0 : (goods + origin + freight) * num(x.insurancePct) / 100;
  const cif = goods + origin + freight + insurance;
  const ddp = inc === 'DDP';
  const duty = ddp ? 0 : cif * num(x.duty) / 100;
  const extraDuty = ddp ? 0 : cif * num(x.extraDuty) / 100;
  const special = ddp ? 0 : (cif + duty + extraDuty) * num(x.specialTax) / 100;
  const vat = ddp ? 0 : (cif + duty + extraDuty + special) * num(x.vat) / 100;
  const bank = goods * num(x.bankPct) / 100;
  const local = num(x.customsFees) + num(x.clearance) + num(x.inland) + num(x.otherLocal);
  const vatInCost = x.vatRecoverable ? 0 : vat;
  const total = cif + duty + extraDuty + special + bank + local + vatInCost;
  const perUnit = total / qty;
  const cashOut = total + (x.vatRecoverable ? vat : 0);

  // Selling side
  const retail = num(x.retail);
  const netRetail = x.retailInclVat ? retail / (1 + num(x.vat) / 100) : retail;
  const netToUs = netRetail * (1 - num(x.channelPct) / 100);
  const profit = netToUs - perUnit;
  const margin = netToUs ? profit / netToUs * 100 : null;
  const markup = perUnit ? profit / perUnit * 100 : null;
  const maxLanded = netToUs * (1 - num(x.targetMargin) / 100);
  // Approx. max FOB/unit price that still hits target margin, assuming other costs scale with price.
  const priceShare = goods && total ? goods / total : 0;
  const maxUnitPrice = retail && priceShare ? convert(maxLanded * priceShare, home, x.currency) : null;

  const parts = [
    { key: 'Product', v: goods, color: 'var(--jade)' },
    { key: 'Origin charges', v: origin, color: '#7FB7A6' },
    { key: 'Freight', v: freight, color: 'var(--sky)' },
    { key: 'Insurance', v: insurance, color: '#8DB3D3' },
    { key: 'Customs duty', v: duty + extraDuty, color: 'var(--brass)' },
    { key: 'Special consumption tax', v: special, color: '#D9B871' },
    { key: 'VAT (not recoverable)', v: vatInCost, color: 'var(--seal)' },
    { key: 'Bank fees', v: bank, color: '#9AA5AB' },
    { key: 'Clearance & local', v: local, color: '#5E6C74' }
  ].filter(p => p.v > 0);

  return { home, qty, goods, origin, freight, insurance, cif, duty, extraDuty, special, vat, vatInCost, bank, local, total, perUnit, cashOut, retail, netRetail, netToUs, profit, margin, markup, maxLanded, maxUnitPrice, parts, perUnitUSD: convert(perUnit, home, 'USD') };
}

export function render(main, params) {
  if (params[0] === 'compare') return compare(main);
  if (params[0]) return editor(main, params[0]);
  return list(main);
}

function list(main) {
  const all = store.all('landed');
  main.innerHTML = pageHead('Landed cost', 'What a product really costs once it reaches the warehouse, and what margin is left at the target shelf price.',
    `${all.length > 1 ? '<a class="btn" href="#/landed/compare">Compare</a>' : ''}<a class="btn primary" href="#/landed/new">New calculation</a>`) +
    `<div class="panel">${all.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Calculation</th><th>Terms</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Landed / unit</th><th class="num">Margin</th><th>Updated</th></tr></thead><tbody>
      ${all.map(l => {
        const r = compute(l);
        const tone = r.margin === null || !l.retail ? '' : r.margin >= num(l.targetMargin) ? 'jade' : r.margin >= 0 ? 'brass' : 'seal';
        return `<tr class="clickable" data-go="#/landed/${l.id}"><td><div class="strong">${esc(l.name || l.product || 'Untitled')}</div><small class="muted">${esc(country(l.country).name)}</small></td>
          <td>${esc(l.incoterm)}</td><td class="num">${fmt(l.qty, 0)}</td><td class="num">${money(l.unitPrice, l.currency)}</td>
          <td class="num strong">${money(r.perUnit, r.home)}<br><small class="muted">${money(r.perUnitUSD, 'USD')}</small></td>
          <td class="num">${l.retail ? `<span class="pill ${tone}">${pct(r.margin)}</span>` : '<span class="muted">—</span>'}</td>
          <td class="muted">${fdate(l.updatedAt)}</td></tr>`;
      }).join('')}</tbody></table></div>`
      : emptyState('No calculations yet', 'Start with a quote you have: unit price, quantity and Incoterm. Duties, VAT and margin are worked out as you type.', '<a class="btn primary" href="#/landed/new">New calculation</a>')}</div>`;
}

function editor(main, id) {
  const existing = id !== 'new' ? store.get('landed', id) : null;
  if (id !== 'new' && !existing) { main.innerHTML = emptyState('Calculation not found', 'It may have been deleted.', '<a class="btn" href="#/landed">Back</a>'); return; }
  const x = { ...defaults(), ...(existing || {}) };
  // Pre-fill from a quote (#/landed/new?quote) is passed through sessionStorage.
  try {
    const pre = JSON.parse(sessionStorage.getItem('landed-prefill') || 'null');
    if (pre && id === 'new') { Object.assign(x, pre); sessionStorage.removeItem('landed-prefill'); }
  } catch {}
  main.dataset.live = 'off';
  const countries = store.all('countries');
  const curSel = (name, val) => `<select name="${name}">${opts(CURRENCIES, val)}</select>`;
  const n = (name, label, help = '', extra = '') => `<label class="field">${label}${help ? ` <small>${help}</small>` : ''}<input type="number" step="any" name="${name}" value="${esc(x[name])}" ${extra}></label>`;

  main.innerHTML = pageHead(existing ? (x.name || 'Landed cost') : 'New landed cost', '', `
    ${existing ? `<button class="btn" id="dup">Duplicate</button>${store.canDelete() ? '<button class="btn danger" id="del">Delete</button>' : ''}` : ''}
    <button class="btn" onclick="window.print()">Print</button><button class="btn primary" id="save">${existing ? 'Save changes' : 'Save calculation'}</button>`,
    '<a href="#/landed">Landed cost</a>') + `
  <form id="lc" class="grid side" autocomplete="off">
    <div class="stack">
      <div class="panel"><div class="panel-head"><h2>Product &amp; quote</h2></div><div class="panel-body form-grid">
        <label class="field span-2">Name of this calculation<input name="name" value="${esc(x.name)}" placeholder="55&quot; 4K TV – Supplier A, FOB Shenzhen"></label>
        <label class="field">Supplier<select name="supplierId">${opts(supplierOptions(), x.supplierId)}</select></label>
        <label class="field">Importing into<select name="country">${countries.map(c => `<option value="${c.id}" ${c.id === x.country ? 'selected' : ''}>${esc(c.name)} (${c.currency})</option>`).join('')}</select></label>
        ${n('qty', 'Quantity', 'units', 'min="1"')}
        <label class="field">Unit price<div class="input-group"><input type="number" step="any" name="unitPrice" value="${esc(x.unitPrice)}" placeholder="0.00">${curSel('currency', x.currency)}</div></label>
        <label class="field span-2">Incoterm<select name="incoterm">${opts(INCOTERMS, x.incoterm)}</select></label>
      </div></div>

      <div class="panel"><div class="panel-head"><h2>Shipping</h2><p id="ship-hint"></p></div><div class="panel-body form-grid">
        <label class="field" data-show="EXW">Origin charges <small>pickup, export clearance</small><div class="input-group"><input type="number" step="any" name="originCharges" value="${esc(x.originCharges)}">${curSel('originCur', x.originCur)}</div></label>
        <label class="field" data-hide="CFR,CIF,DAP,DDP">Freight total <small>for the whole shipment</small><div class="input-group"><input type="number" step="any" name="freight" value="${esc(x.freight)}" placeholder="e.g. 2400 for a 40HQ">${curSel('freightCur', x.freightCur)}</div></label>
        <label class="field" data-hide="CIF,DDP">Insurance <small>% of goods + freight</small><input type="number" step="any" name="insurancePct" value="${esc(x.insurancePct)}"></label>
        ${n('bankPct', 'Bank &amp; transfer fees', '% of goods value')}
      </div></div>

      <div class="panel"><div class="panel-head"><div><h2>Duties &amp; taxes</h2><p id="country-note"></p></div></div><div class="panel-body form-grid" data-hide="DDP">
        ${n('duty', 'Customs duty', '% of CIF, from the HS code')}
        ${n('extraDuty', 'Additional duty', '% of CIF')}
        ${n('specialTax', 'Special consumption tax', '% after duty')}
        ${n('vat', 'VAT', '%')}
        <label class="check span-2"><input type="checkbox" name="vatRecoverable" ${x.vatRecoverable ? 'checked' : ''}> Import VAT is recovered (leave it out of product cost)</label>
      </div><div class="panel-body" data-show="DDP"><p class="help">With DDP the supplier pays duties and taxes, so they are already in the unit price.</p></div></div>

      <div class="panel"><div class="panel-head"><div><h2>Local costs</h2><p>In <span data-home></span>, for the whole shipment</p></div></div><div class="panel-body form-grid">
        ${n('customsFees', 'Customs &amp; port fees')}
        ${n('clearance', 'Clearance agent')}
        ${n('inland', 'Inland transport')}
        ${n('otherLocal', 'Other', 'inspection, storage…')}
      </div></div>

      <div class="panel"><div class="panel-head"><div><h2>Selling price</h2><p>Optional. Fill in to see the margin.</p></div></div><div class="panel-body form-grid">
        <label class="field">Target shelf price <small>per unit, <span data-home></span></small><input type="number" step="any" name="retail" value="${esc(x.retail)}"></label>
        ${n('channelPct', 'Retailer / channel margin', '% of net price')}
        ${n('targetMargin', 'Our target margin', '%')}
        <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="retailInclVat" ${x.retailInclVat ? 'checked' : ''}> Shelf price includes VAT</label>
      </div></div>
    </div>

    <div class="stack" style="position:sticky;top:76px;align-self:start">
      <div class="panel"><div class="panel-body" id="out"></div></div>
    </div>
  </form>`;

  const form = $('#lc', main);
  const read = () => {
    const d = {};
    $$('input, select', form).forEach(el => {
      if (!el.name) return;
      d[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : num(el.value)) : el.value;
    });
    return d;
  };

  const draw = () => {
    const d = { ...x, ...read() };
    const r = compute(d);
    const c = country(d.country);
    $$('[data-home]', main).forEach(e => (e.textContent = r.home));
    $('#country-note', main).textContent = c.note || '';
    const dutyBox = form.elements.duty;
    dutyBox.placeholder = 'Enter for this product';
    dutyBox.style.borderColor = d.incoterm !== 'DDP' && d.duty === '' ? 'var(--brass)' : '';
    $$('[data-show]', form).forEach(e => (e.hidden = !e.dataset.show.split(',').includes(d.incoterm)));
    $$('[data-hide]', form).forEach(e => (e.hidden = e.dataset.hide.split(',').includes(d.incoterm)));
    $('#ship-hint', main).textContent = {
      EXW: 'You pay everything from the factory door.', FCA: 'Supplier clears export; you pay main freight.', FOB: 'Supplier loads the ship; you pay freight from the port.',
      CFR: 'Freight is in the price; you insure.', CIF: 'Freight and insurance are in the price.', DAP: 'Delivered to your place; you pay duties.', DDP: 'Everything is in the price.'
    }[d.incoterm] || '';
    const m = r.margin;
    const tone = !d.retail ? '' : m >= num(d.targetMargin) ? 'good' : m >= 0 ? 'warn' : 'bad';
    const total = r.total || 1;
    const row = (k, v, cls = '') => v ? `<div class="kv-row ${cls}"><span>${k}</span><span>${money(v, r.home)}</span></div>` : '';
    $('#out', main).innerHTML = `
      ${d.incoterm !== 'DDP' && d.duty === '' ? '<p class="warn-box mb">Customs duty isn’t entered yet, so the cost below leaves it out. Enter the rate for this product’s HS code.</p>' : ''}
      <div class="big-result"><span>Landed cost per unit</span><b>${money(r.perUnit, r.home, 2)}</b><span>${money(r.perUnitUSD, 'USD', 2)} · ${fmt(r.qty, 0)} units</span></div>
      <div class="stackbar mt" aria-hidden="true">${r.parts.map(p => `<span style="width:${p.v / total * 100}%;background:${p.color}" title="${p.key}"></span>`).join('')}</div>
      <div class="bar-legend">${r.parts.map(p => `<span><i style="background:${p.color}"></i>${p.key} ${p.v / total < 0.01 ? '<1' : fmt(p.v / total * 100, 0)}%</span>`).join('')}</div>
      <div class="mt">
        ${row('Product', r.goods)}${row('Origin charges', r.origin)}${row('Freight', r.freight)}${row('Insurance', r.insurance)}
        <div class="kv-row"><span><b>CIF value</b></span><span><b>${money(r.cif, r.home)}</b></span></div>
        ${row('Customs duty', r.duty)}${row('Additional duty', r.extraDuty)}${row('Special consumption tax', r.special)}
        ${r.vat ? `<div class="kv-row"><span>VAT ${d.vatRecoverable ? '<small class="muted">(recovered, not in cost)</small>' : ''}</span><span>${money(r.vat, r.home)}</span></div>` : ''}
        ${row('Bank fees', r.bank)}${row('Clearance &amp; local', r.local)}
        <div class="kv-row total"><span>Landed cost, shipment</span><span>${money(r.total, r.home)}</span></div>
        ${d.vatRecoverable && r.vat ? `<p class="help mt">Cash needed incl. VAT paid at customs: <b>${money(r.cashOut, r.home)}</b></p>` : ''}
      </div>
      ${d.retail ? `
      <div class="big-result ${tone} mt"><span>Margin at ${money(r.retail, r.home)} shelf price</span><b>${pct(m)}</b><span>${money(r.profit, r.home, 2)} profit per unit · markup ${pct(r.markup)}</span></div>
      <div class="mt">
        <div class="kv-row"><span>Net price ${d.retailInclVat ? '(excl. VAT)' : ''}</span><span>${money(r.netRetail, r.home, 2)}</span></div>
        ${num(d.channelPct) ? `<div class="kv-row"><span>After channel margin</span><span>${money(r.netToUs, r.home, 2)}</span></div>` : ''}
        <div class="kv-row"><span>Max landed cost for ${pct(d.targetMargin, 0)} margin</span><span>${money(r.maxLanded, r.home, 2)}</span></div>
        ${r.maxUnitPrice ? `<div class="kv-row"><span>Max unit price to negotiate <small class="muted">approx.</small></span><span><b>${money(r.maxUnitPrice, d.currency, 2)}</b></span></div>` : ''}
      </div>` : ''}
      <p class="help mt">Rates: 1 USD = ${fmt(store.settings().rates[r.home], 2)} ${r.home}${d.currency !== 'USD' ? ` · ${fmt(store.settings().rates[d.currency], 2)} ${d.currency}` : ''}. Change them in <a href="#/settings">Settings</a>.</p>`;
  };

  // Changing country loads that country's tax defaults.
  form.addEventListener('change', e => {
    if (e.target.name === 'country') {
      const c = country(e.target.value);
      ['duty', 'extraDuty', 'specialTax', 'vat'].forEach(k => (form.elements[k].value = c[k] ?? ''));
      form.elements.vatRecoverable.checked = !!c.vatRecoverable;
    }
    draw();
  });
  form.addEventListener('input', draw);
  form.addEventListener('submit', e => e.preventDefault());
  draw();

  const save = () => {
    const d = read();
    if (!d.name) d.name = d.unitPrice ? `${d.incoterm} ${money(d.unitPrice, d.currency)} × ${fmt(d.qty, 0)}` : 'Untitled calculation';
    if (existing) { store.update('landed', existing.id, d); toast('Saved'); }
    else { const it = store.add('landed', d); toast('Calculation saved'); location.hash = `#/landed/${it.id}`; }
  };
  $('#save', main).addEventListener('click', save);
  $('#dup', main)?.addEventListener('click', () => {
    const it = store.add('landed', { ...read(), name: (read().name || 'Calculation') + ' (copy)' });
    location.hash = `#/landed/${it.id}`;
  });
  $('#del', main)?.addEventListener('click', async () => {
    if (!(await confirmDialog('Delete this calculation?'))) return;
    store.remove('landed', existing.id); location.hash = '#/landed';
  });
}

let picked = [];
function compare(main) {
  const all = store.all('landed');
  picked = picked.filter(id => all.some(l => l.id === id));
  if (!picked.length) picked = all.slice(0, 3).map(l => l.id);
  const chosen = picked.map(id => all.find(l => l.id === id)).filter(Boolean);
  const res = chosen.map(l => ({ l, r: compute(l) }));
  const best = res.length ? Math.min(...res.map(x => convert(x.r.perUnit, x.r.home, 'USD'))) : 0;
  const line = (label, fn) => `<tr><td class="muted">${label}</td>${res.map(x => `<td class="num">${fn(x)}</td>`).join('')}</tr>`;

  main.innerHTML = pageHead('Compare landed costs', 'Put sourcing options side by side: different suppliers, Incoterms or countries of origin.',
    '<button class="btn" id="csv">Export CSV</button><button class="btn" onclick="window.print()">Print</button>', '<a href="#/landed">Landed cost</a>') + `
    <div class="panel mb no-print"><div class="panel-body"><div class="row" style="gap:6px 16px">${all.map(l => `<label class="check"><input type="checkbox" value="${l.id}" ${picked.includes(l.id) ? 'checked' : ''}> ${esc(l.name || 'Untitled')}</label>`).join('')}</div></div></div>
    <div class="panel"><div class="table-wrap">${res.length ? `<table class="data"><thead><tr><th></th>${res.map(x => `<th class="num"><a href="#/landed/${x.l.id}">${esc(x.l.name || 'Untitled')}</a></th>`).join('')}</tr></thead><tbody>
      ${line('Importing into', x => esc(country(x.l.country).name))}
      ${line('Supplier', x => esc(store.get('suppliers', x.l.supplierId)?.name || '—'))}
      ${line('Incoterm', x => esc(x.l.incoterm))}
      ${line('Quantity', x => fmt(x.l.qty, 0))}
      ${line('Unit price', x => money(x.l.unitPrice, x.l.currency, 2))}
      ${line('CIF / unit', x => money(x.r.cif / x.r.qty, x.r.home, 2))}
      ${line('Duties & taxes / unit', x => money((x.r.duty + x.r.extraDuty + x.r.special + x.r.vatInCost) / x.r.qty, x.r.home, 2))}
      ${line('Local costs / unit', x => money(x.r.local / x.r.qty, x.r.home, 2))}
      <tr class="best"><td class="strong">Landed / unit</td>${res.map(x => `<td class="num strong">${money(x.r.perUnit, x.r.home, 2)}<br><small>${money(x.r.perUnitUSD, 'USD', 2)}${Math.abs(x.r.perUnitUSD - best) < 0.005 ? ' · lowest' : ''}</small></td>`).join('')}</tr>
      ${line('Margin', x => x.l.retail ? pct(x.r.margin) : '—')}
      ${line('Cash needed', x => money(x.r.cashOut, x.r.home))}
    </tbody></table>` : emptyState('Pick at least one calculation', 'Tick the calculations above to compare them.')}</div></div>`;

  $$('.no-print input[type=checkbox]', main).forEach(c => c.addEventListener('change', () => {
    picked = $$('.no-print input:checked', main).map(i => i.value);
    compare(main);
  }));
  $('#csv', main).addEventListener('click', () => download(`landed-compare-${todayISO()}.csv`, toCSV(res, [
    { label: 'Calculation', value: x => x.l.name }, { label: 'Country', value: x => country(x.l.country).name }, { label: 'Incoterm', value: x => x.l.incoterm },
    { label: 'Qty', value: x => x.l.qty }, { label: 'Unit price', value: x => x.l.unitPrice }, { label: 'Currency', value: x => x.l.currency },
    { label: 'Landed/unit', value: x => x.r.perUnit.toFixed(2) }, { label: 'Home currency', value: x => x.r.home }, { label: 'Landed/unit USD', value: x => x.r.perUnitUSD.toFixed(2) },
    { label: 'Margin %', value: x => x.l.retail ? x.r.margin.toFixed(1) : '' }
  ]), 'text/csv'));
}
