// Purchase orders: from confirmation to the warehouse, with payments, shipping documents and delays.
import { store, uid } from '../store.js';
import { $, $$, esc, num, fmt, money, convert, pill, emptyState, openForm, pageHead, fdate, relDay, todayISO, addDays, daysBetween, supplierOptions, supplierLink, toast, confirmDialog, download, toCSV, modal, closeModal } from '../ui.js';

// Each stage, and the date field that records when it happened.
export const STAGES = [
  { key: 'confirmed', label: 'Confirmed', field: 'orderDate' },
  { key: 'deposit', label: 'Deposit paid', field: 'depositPaid' },
  { key: 'production', label: 'In production', field: 'productionStart' },
  { key: 'ready', label: 'Ready to ship', field: 'readyActual' },
  { key: 'shipped', label: 'Shipped', field: 'shipped' },
  { key: 'port', label: 'At port', field: 'arrived' },
  { key: 'cleared', label: 'Customs cleared', field: 'cleared' },
  { key: 'warehouse', label: 'In warehouse', field: 'delivered' }
];
const stageIndex = o => Math.max(0, STAGES.findIndex(s => s.key === (o.stage || 'confirmed')));
const isOpen = o => !o.cancelled && o.stage !== 'warehouse';

export function orderTotals(o) {
  const total = num(o.qty) * num(o.unitPrice);
  const deposit = total * num(o.depositPct) / 100;
  return { total, deposit, balance: total - deposit, totalUSD: convert(total, o.currency || 'USD', 'USD') };
}

// Problems and things due soon, used here and on the dashboard.
export function orderAlerts(o, today = todayISO()) {
  if (!isOpen(o)) return [];
  const out = [];
  const t = orderTotals(o);
  const soon = d => d && d <= addDays(today, 3);
  if (num(o.depositPct) > 0 && !o.depositPaid && soon(o.depositDue)) out.push({ date: o.depositDue, kind: 'pay', text: `Deposit due: ${money(t.deposit, o.currency)}` });
  if (t.balance > 0 && !o.balancePaid && soon(o.balanceDue)) out.push({ date: o.balanceDue, kind: 'pay', text: `Balance due: ${money(t.balance, o.currency)}` });
  if (!o.readyActual && !o.shipped && o.promisedReady && o.promisedReady < today) out.push({ date: o.promisedReady, kind: 'late', text: 'Production is late' });
  if (!o.shipped && o.etd && o.etd < today && stageIndex(o) < 4) out.push({ date: o.etd, kind: 'late', text: 'Not shipped by planned ETD' });
  if (o.shipped && !o.arrived && soon(o.eta)) out.push({ date: o.eta, kind: o.eta < today ? 'late' : 'eta', text: o.eta < today ? 'Ship is late (past ETA)' : 'Arriving at port' });
  return out;
}

// On-time shipping for a supplier, from real orders: ready or shipped within 3 days of the promised date.
export function supplierOnTime(supplierId) {
  const done = store.all('orders').filter(o => o.supplierId === supplierId && o.promisedReady && (o.readyActual || o.shipped));
  if (!done.length) return null;
  const onTime = done.filter(o => daysBetween(o.promisedReady, o.readyActual || o.shipped) <= 3).length;
  return { onTime, total: done.length, pct: onTime / done.length * 100 };
}

const FIELDS = () => [
  { type: 'section', label: 'Order' },
  { name: 'po', label: 'PO number', required: true, placeholder: 'PO-2026-031' },
  { name: 'supplierId', label: 'Supplier', type: 'select', options: () => supplierOptions(), required: true },
  { name: 'product', label: 'Product', required: true, span: true, placeholder: '55" 4K Google TV' },
  { name: 'qty', label: 'Quantity', type: 'number' },
  { name: 'unitPrice', label: 'Unit price', type: 'money', currencyName: 'currency' },
  { name: 'incoterm', label: 'Incoterm', type: 'select', options: ['FOB', 'EXW', 'FCA', 'CFR', 'CIF', 'DAP', 'DDP'] },
  { name: 'orderDate', label: 'Order confirmed on', type: 'date', default: todayISO() },
  { type: 'section', label: 'Payment' },
  { name: 'depositPct', label: 'Deposit', type: 'number', help: '% of total', default: 30 },
  { name: 'depositDue', label: 'Deposit due', type: 'date', default: addDays(todayISO(), 3) },
  { name: 'balanceDue', label: 'Balance due', type: 'date', help: 'e.g. before shipment' },
  { type: 'section', label: 'Dates promised by the supplier and forwarder' },
  { name: 'promisedReady', label: 'Goods ready', type: 'date', help: 'supplier promise' },
  { name: 'etd', label: 'Planned departure (ETD)', type: 'date' },
  { name: 'eta', label: 'Planned arrival (ETA)', type: 'date' },
  { name: 'port', label: 'Arrival port', list: ['Alexandria', 'Port Said', 'Damietta', 'Sokhna', 'Cairo Airport', 'Mersin', 'Istanbul (Ambarlı)'] },
  { type: 'section', label: 'Shipping details' },
  { name: 'forwarder', label: 'Forwarder' },
  { name: 'container', label: 'Container / vessel', placeholder: '1×40HQ · MSC Aurora' },
  { name: 'bl', label: 'B/L or AWB number' },
  { name: 'acid', label: 'ACID number' },
  { name: 'inspection', label: 'Pre-shipment inspection', placeholder: 'Passed AQL 2.5 on 12 Nov' },
  { type: 'section', label: 'Links' },
  { name: 'oppId', label: 'Opportunity', type: 'select', options: () => [['', '—'], ...store.all('opportunities').map(o => [o.id, o.name])] },
  { name: 'landedId', label: 'Landed cost calculation', type: 'select', options: () => [['', '—'], ...store.all('landed').map(l => [l.id, l.name || 'Untitled'])] },
  { name: 'notes', label: 'Notes', type: 'textarea', span: true, rows: 3 }
];

export function editOrder(id, prefill = {}) {
  const o = id ? store.get('orders', id) : null;
  openForm({
    title: o ? 'Edit order' : 'New order', fields: FIELDS(), values: o || { currency: 'USD', incoterm: 'FOB', ...prefill }, wide: true,
    submitLabel: o ? 'Save' : 'Create order',
    onSubmit: d => {
      if (o) { store.update('orders', id, d); toast('Saved'); return; }
      const created = store.add('orders', { ...d, stage: 'confirmed', docs: [], history: [{ stage: 'confirmed', date: d.orderDate || todayISO(), by: store.settings().name }] });
      toast('Order created');
      location.hash = `#/orders/${created.id}`;
    },
    onDelete: o ? () => { store.remove('orders', id); location.hash = '#/orders'; } : null
  });
}

function advance(o, toIndex) {
  const st = STAGES[toIndex];
  modal({
    title: `Mark as “${st.label}”`,
    body: `<label class="field">Date<input type="date" id="adv-date" value="${todayISO()}"></label>`,
    foot: '<button class="btn" data-close>Cancel</button><button class="btn primary" id="adv-ok">Save</button>',
    onMount: m => {
      $('#adv-ok', m).addEventListener('click', () => {
        const date = $('#adv-date', m).value || todayISO();
        const patch = { stage: st.key, [st.field]: date, history: [...(o.history || []), { stage: st.key, date, by: store.settings().name }] };
        // Fill in skipped stages' dates so the record stays complete.
        STAGES.slice(1, toIndex).forEach(s => { if (!o[s.field]) patch[s.field] = date; });
        closeModal();
        store.update('orders', o.id, patch);
        toast(st.label);
      });
    }
  });
}

export function render(main, params) {
  return params[0] ? detail(main, params[0]) : list(main);
}

let tab = 'open';
function list(main) {
  const all = store.all('orders');
  const groups = { open: all.filter(isOpen), done: all.filter(o => o.stage === 'warehouse'), all };
  const rows = groups[tab].slice().sort((a, b) => (a.eta || a.promisedReady || '9999').localeCompare(b.eta || b.promisedReady || '9999'));
  main.innerHTML = pageHead('Orders & shipments', 'Every purchase order from confirmation to the warehouse: payments, production, shipping and customs.',
    `${all.length ? '<button class="btn" id="csv">Export CSV</button>' : ''}<button class="btn primary" id="add">New order</button>`) +
    (all.length ? `<div class="tabs">${[['open', 'In progress'], ['done', 'Delivered'], ['all', 'All']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'active' : ''}">${l}<span class="n">${groups[k].length}</span></button>`).join('')}</div>
    <div class="panel"><div class="table-wrap">${rows.length ? `<table class="data"><thead><tr><th>Order</th><th>Supplier</th><th>Stage</th><th class="num">Value</th><th>Payments</th><th>Arrival</th><th>Needs attention</th></tr></thead><tbody>
    ${rows.map(o => {
      const t = orderTotals(o);
      const i = stageIndex(o);
      const al = orderAlerts(o);
      const pay = o.cancelled ? '—' : `${num(o.depositPct) ? (o.depositPaid ? '✓ Deposit' : 'Deposit open') : ''}${num(o.depositPct) ? ' · ' : ''}${o.balancePaid ? '✓ Balance' : 'Balance open'}`;
      return `<tr class="clickable" data-go="#/orders/${o.id}">
        <td><div class="strong">${esc(o.po)}</div><small class="muted">${esc(o.product || '')}${o.qty ? ` · ${fmt(o.qty, 0)} pcs` : ''}</small></td>
        <td>${esc(store.get('suppliers', o.supplierId)?.name || '—')}</td>
        <td>${o.cancelled ? pill('Cancelled', 'seal') : `${pill(STAGES[i].label, i === 7 ? 'jade' : i >= 4 ? 'sky' : '')}<div class="meter" style="margin-top:6px;max-width:120px"><span style="width:${(i + 1) / STAGES.length * 100}%"></span></div>`}</td>
        <td class="num">${t.total ? money(t.total, o.currency) : '—'}</td>
        <td><small>${pay}</small></td>
        <td class="nowrap">${o.delivered ? `In warehouse ${fdate(o.delivered, { day: 'numeric', month: 'short' })}` : o.arrived ? `At port ${fdate(o.arrived, { day: 'numeric', month: 'short' })}` : o.eta ? `ETA ${fdate(o.eta, { day: 'numeric', month: 'short' })}` : '—'}</td>
        <td>${al.map(a => pill(a.text, a.kind === 'late' ? 'seal' : a.kind === 'pay' ? 'brass' : 'sky')).join(' ') || '<span class="muted">—</span>'}</td>
      </tr>`;
    }).join('')}</tbody></table>` : emptyState('Nothing here', tab === 'done' ? 'Delivered orders appear here.' : 'No orders in progress.')}</div></div>`
      : `<div class="panel">${emptyState('No orders yet', 'Create an order when a supplier confirms a PO. You can also create one straight from an awarded RFQ quote.', '<button class="btn primary" data-add>Create first order</button>')}</div>`);

  $('#add', main).addEventListener('click', () => editOrder());
  $('[data-add]', main)?.addEventListener('click', () => editOrder());
  $$('[data-t]', main).forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; list(main); }));
  $('#csv', main)?.addEventListener('click', () => download(`orders-${todayISO()}.csv`, toCSV(all, [
    { label: 'PO', value: 'po' }, { label: 'Supplier', value: o => store.get('suppliers', o.supplierId)?.name || '' }, { label: 'Product', value: 'product' },
    { label: 'Qty', value: 'qty' }, { label: 'Unit price', value: 'unitPrice' }, { label: 'Currency', value: 'currency' }, { label: 'Total', value: o => orderTotals(o).total },
    { label: 'Stage', value: o => o.cancelled ? 'Cancelled' : STAGES[stageIndex(o)].label }, { label: 'Order date', value: 'orderDate' }, { label: 'Deposit paid', value: 'depositPaid' },
    { label: 'Balance paid', value: 'balancePaid' }, { label: 'Promised ready', value: 'promisedReady' }, { label: 'Shipped', value: 'shipped' }, { label: 'ETA', value: 'eta' },
    { label: 'Arrived', value: 'arrived' }, { label: 'Cleared', value: 'cleared' }, { label: 'In warehouse', value: 'delivered' }, { label: 'B/L', value: 'bl' }, { label: 'ACID', value: 'acid' }
  ]), 'text/csv'));
}

function detail(main, id) {
  const o = store.get('orders', id);
  if (!o) { main.innerHTML = emptyState('Order not found', 'It may have been deleted.', '<a class="btn" href="#/orders">Back to orders</a>'); return; }
  const t = orderTotals(o);
  const i = stageIndex(o);
  const al = orderAlerts(o);
  const landed = o.landedId ? store.get('landed', o.landedId) : null;
  const opp = o.oppId ? store.get('opportunities', o.oppId) : null;
  const next = STAGES[i + 1];
  const d = v => (v ? fdate(v) : '<span class="muted">—</span>');
  const planVsActual = (label, plan, actual) => {
    const diff = plan && actual ? daysBetween(plan, actual) : null;
    return `<tr><td class="muted">${label}</td><td>${d(plan)}</td><td>${d(actual)}${diff ? ` <span class="pill ${diff > 3 ? 'seal' : diff > 0 ? 'brass' : 'jade'}">${diff > 0 ? '+' : ''}${diff} d</span>` : ''}</td></tr>`;
  };

  main.innerHTML = pageHead(o.po, `${o.cancelled ? pill('Cancelled', 'seal') : pill(STAGES[i].label, i === 7 ? 'jade' : 'sky')} ${esc([o.product, o.qty ? `${fmt(o.qty, 0)} pcs` : '', o.incoterm].filter(Boolean).join(' · '))}`,
    `<button class="btn" id="edit">Edit</button>${!o.cancelled && next ? `<button class="btn primary" id="next">Mark ${esc(next.label.toLowerCase())}</button>` : ''}`,
    '<a href="#/orders">Orders & shipments</a>') + `
  ${al.length ? `<div class="mb">${al.map(a => `<p class="${a.kind === 'late' ? 'warn-box' : 'warn-box'}" style="${a.kind === 'late' ? 'background:var(--seal-soft);color:var(--seal)' : a.kind === 'eta' ? 'background:var(--sky-soft);color:var(--sky)' : ''}">${esc(a.text)} · ${relDay(a.date)}</p>`).join('')}</div>` : ''}
  <div class="panel mb"><div class="panel-body">
    <ol class="stepper">${STAGES.map((s, k) => `<li class="${o.cancelled ? '' : k < i ? 'done' : k === i ? 'now' : ''}"><button ${o.cancelled || k <= i ? 'disabled' : ''} data-stage="${k}" title="${k > i ? `Mark ${esc(s.label.toLowerCase())}` : ''}"><span class="dot-step">${k < i || (k === i && i === 7) ? '✓' : k + 1}</span><b>${esc(s.label)}</b><small>${o[s.field] ? fdate(o[s.field], { day: 'numeric', month: 'short' }) : ''}</small></button></li>`).join('')}</ol>
  </div></div>
  <div class="grid side">
    <div class="stack">
      <div class="panel"><div class="panel-head"><h2>Dates: planned vs actual</h2></div><div class="table-wrap"><table class="data"><thead><tr><th></th><th>Planned</th><th>Actual</th></tr></thead><tbody>
        ${planVsActual('Deposit', o.depositDue, o.depositPaid)}
        ${planVsActual('Goods ready', o.promisedReady, o.readyActual)}
        ${planVsActual('Departure (ETD)', o.etd, o.shipped)}
        ${planVsActual('Arrival (ETA)', o.eta, o.arrived)}
        <tr><td class="muted">Customs cleared</td><td></td><td>${d(o.cleared)}</td></tr>
        <tr><td class="muted">In warehouse</td><td></td><td>${d(o.delivered)}</td></tr>
        ${o.orderDate && o.delivered ? `<tr><td class="strong">Order to warehouse</td><td></td><td class="strong">${daysBetween(o.orderDate, o.delivered)} days</td></tr>` : ''}
      </tbody></table></div></div>
      <div class="panel"><div class="panel-head"><div><h2>Documents</h2><p>Links to the PI, invoice, packing list, B/L, inspection report…</p></div><button class="btn sm" id="add-doc">Add link</button></div>
        ${(o.docs || []).length ? `<ul class="agenda">${o.docs.map(x => `<li><span class="what"><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a><small>${esc(x.url.replace(/^https?:\/\//, '').slice(0, 60))}</small></span>${store.canDelete() ? `<button class="icon-btn" data-deldoc="${esc(x.id)}" aria-label="Remove link">✕</button>` : ''}</li>`).join('')}</ul>`
          : '<div class="panel-body"><p class="help">Upload files to Google Drive or OneDrive and paste the share link here, so the whole team finds them in one place.</p></div>'}</div>
      <div class="panel"><div class="panel-head"><h2>History</h2></div><ul class="log">${(o.history || []).slice().reverse().map(h => `<li><div class="log-head"><b>${fdate(h.date)}</b>${pill(STAGES.find(s => s.key === h.stage)?.label || h.stage)}${h.by ? `<span>${esc(h.by)}</span>` : ''}</div></li>`).join('')}</ul></div>
    </div>
    <div class="stack">
      <div class="panel"><div class="panel-head"><h2>Payment</h2><b>${money(t.total, o.currency)}</b></div><div class="panel-body">
        ${num(o.depositPct) ? `<div class="kv-row"><span>Deposit ${fmt(o.depositPct, 0)}%<br><small class="muted">${o.depositPaid ? `paid ${fdate(o.depositPaid)}` : `due ${fdate(o.depositDue)}`}</small></span><span>${money(t.deposit, o.currency)} ${o.depositPaid ? pill('Paid', 'jade') : ''}</span></div>` : ''}
        <div class="kv-row"><span>Balance<br><small class="muted">${o.balancePaid ? `paid ${fdate(o.balancePaid)}` : o.balanceDue ? `due ${fdate(o.balanceDue)}` : 'no due date yet'}</small></span><span>${money(t.balance, o.currency)} ${o.balancePaid ? pill('Paid', 'jade') : ''}</span></div>
        ${o.currency !== 'USD' ? `<p class="help mt">≈ ${money(t.totalUSD, 'USD')}</p>` : ''}
        <div class="row mt">${num(o.depositPct) && !o.depositPaid ? '<button class="btn sm" data-pay="depositPaid">Mark deposit paid</button>' : ''}${!o.balancePaid ? '<button class="btn sm" data-pay="balancePaid">Mark balance paid</button>' : ''}</div>
      </div></div>
      <div class="panel"><div class="panel-head"><h2>Details</h2></div><div class="panel-body"><dl class="facts">
        <dt>Supplier</dt><dd>${supplierLink(o.supplierId)}</dd>
        <dt>Unit price</dt><dd>${o.unitPrice ? money(o.unitPrice, o.currency, 2) : '—'}</dd>
        <dt>Arrival port</dt><dd>${esc(o.port || '—')}</dd>
        <dt>Forwarder</dt><dd>${esc(o.forwarder || '—')}</dd>
        <dt>Container</dt><dd>${esc(o.container || '—')}</dd>
        <dt>B/L / AWB</dt><dd>${esc(o.bl || '—')}</dd>
        <dt>ACID</dt><dd>${esc(o.acid || '—')}</dd>
        <dt>Inspection</dt><dd>${esc(o.inspection || '—')}</dd>
        <dt>Opportunity</dt><dd>${opp ? `<a href="#/opportunities/${opp.id}">${esc(opp.name)}</a>` : '—'}</dd>
        <dt>Landed cost</dt><dd>${landed ? `<a href="#/landed/${landed.id}">${esc(landed.name)}</a>` : '—'}</dd>
      </dl>${o.notes ? `<p class="mt" style="white-space:pre-wrap">${esc(o.notes)}</p>` : ''}</div></div>
      ${!o.cancelled && isOpen(o) ? '<button class="btn danger" id="cancel">Cancel this order</button>' : ''}
    </div>
  </div>`;

  $('#edit', main).addEventListener('click', () => editOrder(id));
  $('#next', main)?.addEventListener('click', () => advance(o, i + 1));
  $$('[data-stage]', main).forEach(b => b.addEventListener('click', () => advance(o, +b.dataset.stage)));
  $$('[data-pay]', main).forEach(b => b.addEventListener('click', () => {
    store.update('orders', id, { [b.dataset.pay]: todayISO() });
    toast(b.dataset.pay === 'depositPaid' ? 'Deposit marked paid' : 'Balance marked paid');
  }));
  $('#add-doc', main).addEventListener('click', () => openForm({
    title: 'Add a document link', submitLabel: 'Add link',
    fields: [
      { name: 'label', label: 'Document', required: true, list: ['Proforma invoice', 'Commercial invoice', 'Packing list', 'Bill of lading', 'Certificate of origin', 'Inspection report', 'Photos'], span: true },
      { name: 'url', label: 'Link', type: 'url', required: true, placeholder: 'https://drive.google.com/…', span: true }
    ],
    onSubmit: x => {
      if (!/^https?:\/\//.test(x.url)) { toast('Paste a full link starting with https://', 'err'); return; }
      store.update('orders', id, { docs: [...(o.docs || []), { id: uid(), ...x }] });
    }
  }));
  $$('[data-deldoc]', main).forEach(b => b.addEventListener('click', () => store.update('orders', id, { docs: o.docs.filter(x => x.id !== b.dataset.deldoc) })));
  $('#cancel', main)?.addEventListener('click', async () => {
    if (!(await confirmDialog('The order stays in the list, marked as cancelled.', 'Cancel order'))) return;
    store.update('orders', id, { cancelled: true });
  });
}
