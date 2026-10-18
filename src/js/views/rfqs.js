import { store, uid } from '../store.js';
import { $, $$, esc, num, fmt, money, convert, pill, emptyState, openForm, pageHead, fdate, relDay, dueClass, toast, confirmDialog, supplierOptions, CURRENCIES, todayISO, download, toCSV } from '../ui.js';
import { newSupplier } from './suppliers.js';

const STATUSES = ['Draft', 'Sent', 'Quotes in', 'Negotiating', 'Awarded', 'Closed'];
const TONE = { Draft: '', Sent: 'sky', 'Quotes in': 'brass', Negotiating: 'brass', Awarded: 'jade', Closed: '' };
const DEFAULT_WEIGHTS = { price: 40, quality: 20, lead: 15, moq: 10, terms: 15 };

const RFQ_FIELDS = [
  { name: 'product', label: 'Product', required: true, span: true, placeholder: '43" Full HD Smart TV' },
  { name: 'ref', label: 'Reference', placeholder: 'RFQ-2026-014' },
  { name: 'status', label: 'Status', type: 'select', options: STATUSES, default: 'Draft' },
  { name: 'qty', label: 'Quantity', type: 'number', placeholder: '2000' },
  { name: 'target', label: 'Target price', type: 'money', currencyName: 'targetCur', help: 'per unit' },
  { name: 'incoterm', label: 'Requested Incoterm', type: 'select', options: ['FOB', 'EXW', 'FCA', 'CFR', 'CIF', 'DAP', 'DDP'] },
  { name: 'deadline', label: 'Quote deadline', type: 'date' },
  { name: 'specs', label: 'Specification', type: 'textarea', span: true, rows: 5, placeholder: 'Panel: 43" FHD, Android TV 11, 1.5GB/8GB, Wi-Fi 5, 2×8W speakers, DVB-T2/S2, 3×HDMI…' },
  { name: 'oppId', label: 'Linked opportunity', type: 'select', options: () => [['', '—'], ...store.all('opportunities').map(o => [o.id, o.name])] },
  { name: 'notes', label: 'Notes', type: 'textarea', span: true, rows: 3 }
];

const QUOTE_FIELDS = () => [
  { name: 'supplierId', label: 'Supplier', type: 'select', options: () => supplierOptions(), required: true },
  { name: 'date', label: 'Quote date', type: 'date', default: todayISO() },
  { name: 'price', label: 'Unit price', type: 'money', currencyName: 'currency', required: true },
  { name: 'moq', label: 'MOQ', type: 'number' },
  { name: 'lead', label: 'Lead time (days)', type: 'number' },
  { name: 'incoterm', label: 'Incoterm', type: 'select', options: ['FOB', 'EXW', 'FCA', 'CFR', 'CIF', 'DAP', 'DDP'] },
  { name: 'payment', label: 'Payment terms', list: ['30% deposit, 70% before shipment', '30% deposit, 70% against B/L', '100% before shipment', 'L/C at sight', 'OA 30 days'] },
  { name: 'terms', label: 'How good are the payment terms?', type: 'rating' },
  { name: 'quality', label: 'Expected quality', type: 'rating', help: 'specs, sample, reputation' },
  { name: 'sampleCost', label: 'Sample cost', type: 'number', help: 'USD' },
  { name: 'warranty', label: 'Warranty / spare parts', placeholder: '1% FOC spare parts, 12 months' },
  { name: 'validUntil', label: 'Valid until', type: 'date' },
  { name: 'notes', label: 'Notes', type: 'textarea', span: true, rows: 3 }
];

export function scoreQuotes(rfq) {
  const qs = (rfq.quotes || []).filter(q => num(q.price) > 0);
  const w = { ...DEFAULT_WEIGHTS, ...(rfq.weights || {}) };
  const totalW = Object.values(w).reduce((a, b) => a + num(b), 0) || 1;
  const usd = q => convert(q.price, q.currency, 'USD');
  const minP = Math.min(...qs.map(usd));
  const leads = qs.map(q => num(q.lead)).filter(Boolean);
  const minL = leads.length ? Math.min(...leads) : 0;
  const moqs = qs.map(q => num(q.moq)).filter(Boolean);
  const minM = moqs.length ? Math.min(...moqs) : 0;
  return (rfq.quotes || []).map(q => {
    if (!num(q.price)) return { q, total: 0, parts: {} };
    const parts = {
      price: minP / usd(q),
      quality: num(q.quality) ? num(q.quality) / 5 : 0.5,
      lead: num(q.lead) && minL ? minL / num(q.lead) : 0.5,
      moq: num(q.moq) && minM ? minM / num(q.moq) : 0.5,
      terms: num(q.terms) ? num(q.terms) / 5 : 0.5
    };
    const total = Object.keys(parts).reduce((a, k) => a + parts[k] * num(w[k]), 0) / totalW * 100;
    return { q, total, parts, usd: usd(q) };
  }).sort((a, b) => b.total - a.total);
}

export function render(main, params) {
  return params[0] ? detail(main, params[0]) : list(main);
}

function newRfq() {
  openForm({
    title: 'New RFQ', fields: RFQ_FIELDS, wide: true, submitLabel: 'Create RFQ',
    onSubmit: d => { const r = store.add('rfqs', { ...d, quotes: [], weights: { ...DEFAULT_WEIGHTS } }); location.hash = `#/rfqs/${r.id}`; }
  });
}

function list(main) {
  const all = store.all('rfqs');
  main.innerHTML = pageHead('RFQs & quotes', 'Ask several suppliers for the same thing, line up their quotes and see who really offers the best deal.', '<button class="btn primary" id="add">New RFQ</button>') +
    `<div class="panel">${all.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Product</th><th>Status</th><th class="num">Qty</th><th class="num">Target</th><th class="num">Quotes</th><th>Best offer</th><th>Deadline</th></tr></thead><tbody>
    ${all.map(r => {
      const ranked = scoreQuotes(r);
      const top = ranked[0];
      return `<tr class="clickable" data-go="#/rfqs/${r.id}"><td><div class="strong">${esc(r.product)}</div><small class="muted">${esc(r.ref || '')}</small></td>
        <td>${pill(r.status || 'Draft', TONE[r.status])}</td><td class="num">${r.qty ? fmt(r.qty, 0) : '—'}</td><td class="num">${r.target ? money(r.target, r.targetCur) : '—'}</td>
        <td class="num">${(r.quotes || []).length}</td>
        <td>${top && top.total ? `${esc(store.get('suppliers', top.q.supplierId)?.name || '—')}<br><small class="muted">${money(top.q.price, top.q.currency)}</small>` : '<span class="muted">—</span>'}</td>
        <td class="nowrap ${dueClass(r.deadline) === 'late' && !['Awarded', 'Closed'].includes(r.status) ? 'strong' : ''}">${r.deadline ? relDay(r.deadline) : '—'}</td></tr>`;
    }).join('')}</tbody></table></div>`
      : emptyState('No RFQs yet', 'Create an RFQ with the spec and quantity, then add each supplier’s quote as it comes in. The comparison scores them for you.', '<button class="btn primary" data-add>Create first RFQ</button>')}</div>`;
  $('#add', main).addEventListener('click', newRfq);
  $('[data-add]', main)?.addEventListener('click', newRfq);
}

function detail(main, id) {
  const r = store.get('rfqs', id);
  if (!r) { main.innerHTML = emptyState('RFQ not found', 'It may have been deleted.', '<a class="btn" href="#/rfqs">Back</a>'); return; }
  const w = { ...DEFAULT_WEIGHTS, ...(r.weights || {}) };
  const ranked = scoreQuotes(r);
  const target = r.target ? convert(r.target, r.targetCur || 'USD', 'USD') : 0;
  const winner = r.awardedQuote ? (r.quotes || []).find(q => q.id === r.awardedQuote) : null;

  main.innerHTML = pageHead(r.product, `${pill(r.status || 'Draft', TONE[r.status])} ${esc([r.ref, r.qty ? `${fmt(r.qty, 0)} pcs` : '', r.incoterm, r.target ? `target ${money(r.target, r.targetCur)}` : '', r.deadline ? `quotes by ${fdate(r.deadline)}` : ''].filter(Boolean).join(' · '))}`,
    `<button class="btn" id="edit">Edit RFQ</button><button class="btn" id="email">Write RFQ email</button><button class="btn" onclick="window.print()">Print</button><button class="btn primary" id="addq">Add quote</button>`,
    '<a href="#/rfqs">RFQs</a>') + `
    ${winner ? `<div class="note-from mb"><p><b>Awarded to ${esc(store.get('suppliers', winner.supplierId)?.name || 'supplier')}</b> at ${money(winner.price, winner.currency)} per unit.</p>${store.all('orders').some(x => x.rfqId === id) ? `<a class="btn sm" style="margin-left:auto" href="#/orders/${store.all('orders').find(x => x.rfqId === id).id}">Open order</a>` : '<button class="btn sm primary" style="margin-left:auto" id="mk-order">Create order</button>'}</div>` : ''}
    <div class="panel mb">
      <div class="panel-head"><div><h2>Quote comparison</h2><p>Highest score first. Lowest price, shortest lead time and lowest MOQ score best.</p></div></div>
      <div class="table-wrap">${ranked.length ? `<table class="data"><thead><tr><th>#</th><th>Supplier</th><th class="num">Unit price</th><th class="num">vs target</th><th class="num">MOQ</th><th class="num">Lead time</th><th>Terms</th><th>Quality</th><th class="num">Score</th><th></th></tr></thead><tbody>
      ${ranked.map((x, i) => {
        const q = x.q;
        const diff = target && x.usd ? (x.usd - target) / target * 100 : null;
        return `<tr class="${i === 0 && x.total ? 'best' : ''}">
          <td class="muted">${i + 1}</td>
          <td><a href="#/suppliers/${q.supplierId}" class="strong">${esc(store.get('suppliers', q.supplierId)?.name || 'Unknown supplier')}</a><br><small class="muted">${esc([q.incoterm, q.date ? fdate(q.date, { day: 'numeric', month: 'short' }) : ''].filter(Boolean).join(' · '))}</small></td>
          <td class="num strong">${money(q.price, q.currency, 2)}${q.currency !== 'USD' ? `<br><small class="muted">${money(x.usd, 'USD', 2)}</small>` : ''}</td>
          <td class="num">${diff === null ? '—' : `<span class="pill ${diff <= 0 ? 'jade' : diff < 5 ? 'brass' : 'seal'}">${diff > 0 ? '+' : ''}${fmt(diff, 1)}%</span>`}</td>
          <td class="num">${q.moq ? fmt(q.moq, 0) : '—'}</td>
          <td class="num">${q.lead ? q.lead + ' d' : '—'}</td>
          <td><small>${esc(q.payment || '—')}</small></td>
          <td>${q.quality ? '★'.repeat(q.quality) : '—'}</td>
          <td class="num"><b>${fmt(x.total, 0)}</b><div class="meter" style="margin-top:4px"><span style="width:${x.total}%"></span></div></td>
          <td class="nowrap no-print"><button class="btn sm ghost" data-q="${q.id}">Edit</button><button class="btn sm ghost" data-lc="${q.id}" title="Work out landed cost for this quote">Landed cost</button>${r.awardedQuote === q.id ? '' : `<button class="btn sm ghost" data-award="${q.id}">Award</button>`}</td>
        </tr>`;
      }).join('')}</tbody></table>`
        : emptyState('No quotes yet', 'Add each supplier’s offer as it comes in. Missing a supplier? You can add them from the quote form.', '<button class="btn primary" data-addq>Add first quote</button>')}</div>
    </div>
    <div class="grid cols-2">
      <div class="panel"><div class="panel-head"><div><h2>What matters most</h2><p>Weights used for the score</p></div></div><div class="panel-body form-grid" id="weights">
        ${[['price', 'Price'], ['quality', 'Quality'], ['lead', 'Lead time'], ['moq', 'MOQ'], ['terms', 'Payment terms']].map(([k, l]) => `<label class="field">${l} <small>${w[k]}</small><input type="range" min="0" max="60" step="5" name="${k}" value="${w[k]}"></label>`).join('')}
      </div></div>
      <div class="panel"><div class="panel-head"><h2>Specification</h2></div><div class="panel-body"><p style="white-space:pre-wrap;margin:0">${esc(r.specs || 'No specification yet. Edit the RFQ to add one.')}</p>${r.notes ? `<p class="help mt" style="white-space:pre-wrap">${esc(r.notes)}</p>` : ''}</div></div>
    </div>`;

  const editQuote = qid => {
    const q = qid ? r.quotes.find(x => x.id === qid) : null;
    const fields = QUOTE_FIELDS();
    openForm({
      title: q ? 'Edit quote' : 'Add quote', fields, values: q || { incoterm: r.incoterm, currency: 'USD' }, wide: true,
      submitLabel: q ? 'Save' : 'Add quote',
      onSubmit: d => {
        const quotes = q ? r.quotes.map(x => (x.id === qid ? { ...x, ...d } : x)) : [...(r.quotes || []), { id: uid(), ...d }];
        const status = !q && ['Draft', 'Sent'].includes(r.status) ? 'Quotes in' : r.status;
        store.update('rfqs', id, { quotes, status });
      },
      onDelete: q ? () => store.update('rfqs', id, { quotes: r.quotes.filter(x => x.id !== qid), awardedQuote: r.awardedQuote === qid ? '' : r.awardedQuote }) : null
    });
    if (!store.all('suppliers').length) {
      const sel = document.querySelector('#modal-form [name="supplierId"]');
      sel?.insertAdjacentHTML('afterend', '<button type="button" class="btn sm mt" id="mk-sup">Add a supplier first</button>');
      document.getElementById('mk-sup')?.addEventListener('click', () => newSupplier({}, () => editQuote(qid)));
    }
  };

  $('#mk-order', main)?.addEventListener('click', () => import('./orders.js').then(m => m.editOrder(null, {
    rfqId: id, supplierId: winner.supplierId, product: r.product, qty: r.qty || winner.moq || '', unitPrice: winner.price, currency: winner.currency,
    incoterm: winner.incoterm || r.incoterm || 'FOB', oppId: r.oppId || '', po: `PO-${new Date().getFullYear()}-`
  })));
  $('#addq', main).addEventListener('click', () => editQuote());
  $('[data-addq]', main)?.addEventListener('click', () => editQuote());
  $$('[data-q]', main).forEach(b => b.addEventListener('click', () => editQuote(b.dataset.q)));
  $$('[data-award]', main).forEach(b => b.addEventListener('click', async () => {
    if (!(await confirmDialog('Mark this quote as the winner? The RFQ status changes to Awarded.', 'Award'))) return;
    store.update('rfqs', id, { awardedQuote: b.dataset.award, status: 'Awarded' });
    toast('Awarded');
  }));
  $$('[data-lc]', main).forEach(b => b.addEventListener('click', () => {
    const q = r.quotes.find(x => x.id === b.dataset.lc);
    sessionStorage.setItem('landed-prefill', JSON.stringify({
      name: `${r.product} – ${store.get('suppliers', q.supplierId)?.name || 'quote'}`, product: r.product, supplierId: q.supplierId,
      unitPrice: q.price, currency: q.currency, incoterm: q.incoterm || 'FOB', qty: r.qty || q.moq || 1000
    }));
    location.hash = '#/landed/new';
  }));
  $('#edit', main).addEventListener('click', () => openForm({
    title: 'Edit RFQ', fields: RFQ_FIELDS, values: r, wide: true,
    onSubmit: d => store.update('rfqs', id, d),
    onDelete: () => { store.remove('rfqs', id); location.hash = '#/rfqs'; }
  }));
  $('#email', main).addEventListener('click', () => {
    sessionStorage.setItem('tpl-prefill', JSON.stringify({ id: 'rfq', values: { product: r.product, qty: r.qty || '', specs: r.specs || '', incoterm: r.incoterm || 'FOB', deadline: r.deadline ? fdate(r.deadline) : '' } }));
    location.hash = '#/templates';
  });
  $('#weights', main).addEventListener('input', e => { e.target.previousElementSibling.textContent = e.target.value; });
  $('#weights', main).addEventListener('change', () => {
    store.update('rfqs', id, { weights: Object.fromEntries($$('#weights input', main).map(i => [i.name, +i.value])) });
  });
}
