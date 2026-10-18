import { store } from '../store.js';
import { supplierOnTime, STAGES as ORDER_STAGES } from './orders.js';
import { $, $$, esc, fmt, fdate, relDay, dueClass, stars, pill, emptyState, openForm, pageHead, todayISO, addDays, num, download, toCSV, money, confirmDialog, toast } from '../ui.js';

export const STATUSES = ['Active', 'Prospect', 'Under evaluation', 'On hold', 'Not suitable'];
const STATUS_TONE = { Active: 'jade', Prospect: 'sky', 'Under evaluation': 'brass', 'On hold': '', 'Not suitable': 'seal' };
export const CHANNELS = ['WeChat', 'Email', 'Call', 'Video call', 'Meeting', 'Factory visit', 'Trade fair'];

export const SUPPLIER_FIELDS = [
  { type: 'section', label: 'Company' },
  { name: 'name', label: 'Company name', required: true, placeholder: 'Shenzhen Example Technology Co., Ltd.' },
  { name: 'nameCn', label: 'Chinese name', placeholder: '深圳示例科技有限公司' },
  { name: 'category', label: 'Category', list: ['TVs', 'Monitors', 'Audio', 'Small appliances', 'Accessories', 'Smart home', 'Mobile', 'Cables & chargers', 'Packaging'] },
  { name: 'products', label: 'Main products', placeholder: '43–65" Android TVs, soundbars' },
  { name: 'city', label: 'City', list: ['Shenzhen', 'Guangzhou', 'Dongguan', 'Ningbo', 'Yiwu', 'Xiamen', 'Hefei', 'Qingdao', 'Suzhou', 'Shanghai'] },
  { name: 'country', label: 'Country', default: 'China', list: ['China', 'Türkiye', 'Vietnam', 'Taiwan', 'South Korea', 'India', 'Egypt'] },
  { name: 'type', label: 'Supplier type', type: 'select', options: ['Factory', 'Trading company', 'Factory + trading', 'Agent'] },
  { name: 'status', label: 'Status', type: 'select', options: STATUSES, default: 'Prospect' },
  { type: 'section', label: 'Contact' },
  { name: 'contact', label: 'Contact person' },
  { name: 'role', label: 'Their role', placeholder: 'Sales manager' },
  { name: 'wechat', label: 'WeChat ID' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'phone', label: 'Phone / WhatsApp' },
  { name: 'website', label: 'Website or Alibaba page', type: 'url', placeholder: 'https://' },
  { type: 'section', label: 'Commercial terms' },
  { name: 'paymentTerms', label: 'Payment terms', list: ['30% deposit, 70% before shipment', '30% deposit, 70% against B/L copy', '100% T/T before shipment', 'L/C at sight', 'OA 30 days', 'OA 60 days'] },
  { name: 'incoterm', label: 'Usual Incoterm', type: 'select', options: ['', 'EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'DAP', 'DDP'] },
  { name: 'port', label: 'Loading port', list: ['Shenzhen (Yantian)', 'Shekou', 'Guangzhou (Nansha)', 'Ningbo', 'Shanghai', 'Xiamen', 'Qingdao', 'Hong Kong'] },
  { name: 'moq', label: 'Typical MOQ', placeholder: '500 pcs per model' },
  { name: 'leadTime', label: 'Typical lead time (days)', type: 'number' },
  { name: 'currency', label: 'Quote currency', type: 'select', options: ['USD', 'CNY', 'EUR'] },
  { name: 'certs', label: 'Certifications', placeholder: 'ISO 9001, CE, RoHS, CB' },
  { type: 'section', label: 'Performance' },
  { name: 'rQuality', label: 'Quality', type: 'rating' },
  { name: 'rPrice', label: 'Price', type: 'rating' },
  { name: 'rComm', label: 'Communication', type: 'rating' },
  { name: 'rDelivery', label: 'On-time delivery', type: 'rating' },
  { name: 'nextFollowUp', label: 'Next follow-up', type: 'date' },
  { name: 'notes', label: 'Notes', type: 'textarea', span: true }
];

export function score(s) {
  const r = [s.rQuality, s.rPrice, s.rComm, s.rDelivery].map(num).filter(Boolean);
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0;
}

export function newSupplier(prefill = {}, then) {
  openForm({
    title: 'Add supplier', fields: SUPPLIER_FIELDS, values: prefill, wide: true, submitLabel: 'Add supplier',
    onSubmit: data => {
      const s = store.add('suppliers', { ...data, log: [] });
      toast('Supplier added');
      then ? then(s) : (location.hash = `#/suppliers/${s.id}`);
    }
  });
}

export function logInteraction(supplierId) {
  const s = store.get('suppliers', supplierId);
  const fields = [
    { name: 'date', label: 'Date', type: 'date', default: todayISO(), required: true },
    { name: 'channel', label: 'Channel', type: 'select', options: CHANNELS },
    { name: 'summary', label: 'What was discussed', type: 'textarea', span: true, required: true, placeholder: 'Prices for 55" model confirmed at $182 FOB. Sample ships Friday.' },
    { name: 'next', label: 'Next follow-up', type: 'date', default: addDays(todayISO(), 3), help: 'Leave empty if none' }
  ];
  openForm({
    title: `Log contact — ${s.name}`, fields, submitLabel: 'Save to log',
    onSubmit: d => {
      const log = [{ id: Math.random().toString(36).slice(2, 10), date: d.date, channel: d.channel, summary: d.summary, by: store.settings().name }, ...(s.log || [])];
      store.update('suppliers', s.id, { log, lastContact: d.date > (s.lastContact || '') ? d.date : s.lastContact, nextFollowUp: d.next || '' });
      toast('Logged');
    }
  });
}

export function render(main, params) {
  if (params[0]) return detail(main, params[0]);
  return list(main);
}

let filters = { q: '', status: '', category: '', sort: 'follow' };

function list(main) {
  const all = store.all('suppliers');
  const cats = [...new Set(all.map(s => s.category).filter(Boolean))].sort();
  main.innerHTML = pageHead('Suppliers', 'Every supplier, their terms, how they perform and when to follow up next.',
    `<button class="btn" id="export">Export CSV</button><button class="btn primary" id="add">Add supplier</button>`) +
    (all.length ? `
    <div class="toolbar">
      <input type="search" id="q" placeholder="Search name, product, city…" value="${esc(filters.q)}">
      <select id="status"><option value="">All statuses</option>${STATUSES.map(s => `<option ${filters.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <select id="category"><option value="">All categories</option>${cats.map(c => `<option ${filters.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <select id="sort">
        <option value="follow" ${filters.sort === 'follow' ? 'selected' : ''}>Sort: next follow-up</option>
        <option value="name" ${filters.sort === 'name' ? 'selected' : ''}>Sort: name</option>
        <option value="score" ${filters.sort === 'score' ? 'selected' : ''}>Sort: rating</option>
        <option value="recent" ${filters.sort === 'recent' ? 'selected' : ''}>Sort: last contact</option>
      </select>
    </div>
    <div class="panel"><div class="table-wrap" id="tbl"></div></div>` :
      `<div class="panel">${emptyState('No suppliers yet', 'Add the suppliers you already work with first. Their terms and follow-ups will show up on your dashboard.', '<button class="btn primary" data-add>Add first supplier</button>')}</div>`);

  const draw = () => {
    const q = filters.q.toLowerCase();
    let rows = all.filter(s =>
      (!filters.status || s.status === filters.status) &&
      (!filters.category || s.category === filters.category) &&
      (!q || [s.name, s.nameCn, s.products, s.city, s.contact, s.category].some(v => String(v || '').toLowerCase().includes(q))));
    rows.sort((a, b) => {
      if (filters.sort === 'name') return a.name.localeCompare(b.name);
      if (filters.sort === 'score') return score(b) - score(a);
      if (filters.sort === 'recent') return (b.lastContact || '').localeCompare(a.lastContact || '');
      return (a.nextFollowUp || '9999').localeCompare(b.nextFollowUp || '9999');
    });
    $('#tbl', main).innerHTML = rows.length ? `
      <table class="data"><thead><tr><th>Supplier</th><th>Category</th><th>Status</th><th>Terms</th><th>Rating</th><th>Last contact</th><th>Follow up</th></tr></thead>
      <tbody>${rows.map(s => `<tr class="clickable" data-id="${s.id}">
        <td><div class="strong">${esc(s.name)}</div><small class="muted">${esc([s.nameCn, s.city].filter(Boolean).join(' · '))}</small></td>
        <td>${esc(s.category || '—')}<br><small class="muted">${esc(s.products || '')}</small></td>
        <td>${pill(s.status || 'Prospect', STATUS_TONE[s.status] ?? '')}</td>
        <td><small>${esc(s.paymentTerms || '—')}<br><span class="muted">${esc([s.incoterm, s.leadTime ? s.leadTime + ' days' : '', s.moq ? 'MOQ ' + s.moq : ''].filter(Boolean).join(' · '))}</span></small></td>
        <td>${stars(score(s))}</td>
        <td class="nowrap">${s.lastContact ? fdate(s.lastContact, { day: 'numeric', month: 'short' }) : '<span class="muted">—</span>'}</td>
        <td class="nowrap"><span class="${dueClass(s.nextFollowUp) === 'late' ? 'pill seal' : dueClass(s.nextFollowUp) === 'today' ? 'pill jade' : ''}">${s.nextFollowUp ? relDay(s.nextFollowUp) : '<span class="muted">—</span>'}</span></td>
      </tr>`).join('')}</tbody></table>` : `<p class="empty">No suppliers match these filters.</p>`;
  };
  if (all.length) {
    draw();
    $('#q', main).addEventListener('input', e => { filters.q = e.target.value; draw(); });
    ['status', 'category', 'sort'].forEach(k => $('#' + k, main).addEventListener('change', e => { filters[k] = e.target.value; draw(); }));
    $('#tbl', main).addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = `#/suppliers/${tr.dataset.id}`; });
  }
  $('#add', main).addEventListener('click', () => newSupplier());
  $('[data-add]', main)?.addEventListener('click', () => newSupplier());
  $('#export', main).addEventListener('click', () => {
    download(`suppliers-${todayISO()}.csv`, toCSV(all, [
      { label: 'Name', value: 'name' }, { label: 'Chinese name', value: 'nameCn' }, { label: 'Category', value: 'category' }, { label: 'Products', value: 'products' },
      { label: 'City', value: 'city' }, { label: 'Country', value: 'country' }, { label: 'Status', value: 'status' }, { label: 'Contact', value: 'contact' },
      { label: 'WeChat', value: 'wechat' }, { label: 'Email', value: 'email' }, { label: 'Phone', value: 'phone' }, { label: 'Payment terms', value: 'paymentTerms' },
      { label: 'Incoterm', value: 'incoterm' }, { label: 'MOQ', value: 'moq' }, { label: 'Lead time (days)', value: 'leadTime' }, { label: 'Rating', value: s => score(s).toFixed(1) },
      { label: 'Last contact', value: 'lastContact' }, { label: 'Next follow-up', value: 'nextFollowUp' }, { label: 'Notes', value: 'notes' }
    ]), 'text/csv');
  });
}

function detail(main, id) {
  const s = store.get('suppliers', id);
  if (!s) { main.innerHTML = emptyState('Supplier not found', 'It may have been deleted.', '<a class="btn" href="#/suppliers">Back to suppliers</a>'); return; }
  const quotes = [];
  store.all('rfqs').forEach(r => (r.quotes || []).filter(q => q.supplierId === id).forEach(q => quotes.push({ r, q })));
  const samples = store.all('samples').filter(x => x.supplierId === id);
  const notes = store.all('notes').filter(n => n.supplierId === id);
  const tasks = store.all('tasks').filter(t => t.supplierId === id && !t.done);
  const opps = store.all('opportunities').filter(o => (o.suppliers || []).includes(id));
  const orders = store.all('orders').filter(o => o.supplierId === id);
  const ot = supplierOnTime(id);
  const link = v => v ? (/^https?:/.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v.replace(/^https?:\/\//, '').slice(0, 40))}</a>` : esc(v)) : '—';

  main.innerHTML = pageHead(s.name, `${s.nameCn ? `<span class="cn">${esc(s.nameCn)}</span> · ` : ''}${esc([s.type, s.city, s.country].filter(Boolean).join(' · '))}`,
    `<button class="btn" id="edit">Edit</button><button class="btn" id="task">Add task</button><button class="btn primary" id="log">Log contact</button>`,
    '<a href="#/suppliers">Suppliers</a>') + `
  <div class="grid side">
    <div class="stack">
      <div class="panel">
        <div class="panel-head"><div><h2>Contact log</h2><p>${(s.log || []).length === 1 ? "1 entry" : `${(s.log || []).length} entries`}</p></div>
          ${s.nextFollowUp ? `<span class="pill ${dueClass(s.nextFollowUp) === 'late' ? 'seal' : 'jade'}">Follow up ${relDay(s.nextFollowUp).toLowerCase()}</span>` : ''}</div>
        ${(s.log || []).length ? `<ul class="log">${s.log.map(l => `<li><div class="log-head"><b>${fdate(l.date)}</b>${pill(l.channel || 'Note')}${l.by ? `<span>${esc(l.by)}</span>` : ''}${store.canDelete() ? `<button class="icon-btn" style="margin-left:auto" data-dellog="${l.id}" aria-label="Delete entry">✕</button>` : ''}</div><p>${esc(l.summary)}</p></li>`).join('')}</ul>`
          : emptyState('No contact logged yet', 'Log each call, WeChat or email here so you always know where things stand.')}
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Quotes from this supplier</h2></div>
        ${quotes.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>RFQ</th><th class="num">Unit price</th><th class="num">MOQ</th><th class="num">Lead time</th><th>Terms</th></tr></thead><tbody>
          ${quotes.map(({ r, q }) => `<tr class="clickable" data-go="#/rfqs/${r.id}"><td>${esc(r.product)}</td><td class="num">${money(q.price, q.currency)}</td><td class="num">${esc(q.moq || '—')}</td><td class="num">${q.lead ? q.lead + ' d' : '—'}</td><td><small>${esc([q.incoterm, q.payment].filter(Boolean).join(' · '))}</small></td></tr>`).join('')}
        </tbody></table></div>` : `<div class="panel-body"><p class="help">Quotes you add to an RFQ for this supplier will appear here.</p></div>`}
      </div>
      ${orders.length ? `<div class="panel"><div class="panel-head"><h2>Orders</h2>${ot ? `<span class="pill ${ot.pct >= 80 ? 'jade' : ot.pct >= 50 ? 'brass' : 'seal'}">${ot.onTime} of ${ot.total} on time</span>` : ''}</div><div class="table-wrap"><table class="data"><tbody>
        ${orders.map(x => `<tr class="clickable" data-go="#/orders/${x.id}"><td class="strong">${esc(x.po)}</td><td>${esc(x.product || '')}</td><td>${pill(x.cancelled ? 'Cancelled' : (ORDER_STAGES.find(s => s.key === x.stage) || ORDER_STAGES[0]).label)}</td><td class="muted nowrap">${fdate(x.orderDate)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
      ${samples.length ? `<div class="panel"><div class="panel-head"><h2>Samples</h2></div><div class="table-wrap"><table class="data"><tbody>
        ${samples.map(x => `<tr class="clickable" data-go="#/samples"><td>${esc(x.product)}</td><td>${pill(x.status)}</td><td class="muted">${fdate(x.requested)}</td><td>${stars(x.score)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
      ${notes.length ? `<div class="panel"><div class="panel-head"><h2>Notes</h2></div><ul class="log">${notes.map(n => `<li><div class="log-head"><b>${fdate(n.date)}</b>${pill(n.type || 'Note')}</div><a href="#/notes/${n.id}"><b>${esc(n.title || 'Untitled')}</b></a></li>`).join('')}</ul></div>` : ''}
    </div>
    <div class="stack">
      <div class="panel"><div class="panel-head"><h2>Details</h2>${pill(s.status || 'Prospect', STATUS_TONE[s.status] ?? '')}</div><div class="panel-body">
        <dl class="facts">
          <dt>Contact</dt><dd>${esc(s.contact || '—')}${s.role ? ` <span class="muted">(${esc(s.role)})</span>` : ''}</dd>
          <dt>WeChat</dt><dd>${esc(s.wechat || '—')}</dd>
          <dt>Email</dt><dd>${s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : '—'}</dd>
          <dt>Phone</dt><dd>${esc(s.phone || '—')}</dd>
          <dt>Web</dt><dd>${link(s.website)}</dd>
          <dt>Category</dt><dd>${esc(s.category || '—')}</dd>
          <dt>Products</dt><dd>${esc(s.products || '—')}</dd>
          <dt>Certifications</dt><dd>${esc(s.certs || '—')}</dd>
          <dt>Added by</dt><dd>${esc(s.createdByName || '—')}${s.updatedByName ? ` <span class="muted">· last edit ${esc(s.updatedByName)}</span>` : ''}</dd>
        </dl></div></div>
      <div class="panel"><div class="panel-head"><h2>Terms</h2></div><div class="panel-body">
        <dl class="facts">
          <dt>Payment</dt><dd>${esc(s.paymentTerms || '—')}</dd>
          <dt>Incoterm</dt><dd>${esc(s.incoterm || '—')}${s.port ? ` ${esc(s.port)}` : ''}</dd>
          <dt>MOQ</dt><dd>${esc(s.moq || '—')}</dd>
          <dt>Lead time</dt><dd>${s.leadTime ? `${esc(s.leadTime)} days` : '—'}</dd>
          <dt>Currency</dt><dd>${esc(s.currency || '—')}</dd>
        </dl></div></div>
      <div class="panel"><div class="panel-head"><h2>Performance</h2><b>${score(s) ? fmt(score(s), 1) + ' / 5' : ''}</b></div><div class="panel-body">
        <div class="kv-row"><span>Quality</span>${stars(s.rQuality)}</div>
        <div class="kv-row"><span>Price</span>${stars(s.rPrice)}</div>
        <div class="kv-row"><span>Communication</span>${stars(s.rComm)}</div>
        <div class="kv-row"><span>On-time delivery</span>${stars(s.rDelivery)}</div>
        ${ot ? `<div class="kv-row"><span>Shipped on time <small class="muted">from orders</small></span><b>${fmt(ot.pct, 0)}% <small class="muted">(${ot.onTime}/${ot.total})</small></b></div>` : ''}
      </div></div>
      ${tasks.length ? `<div class="panel"><div class="panel-head"><h2>Open tasks</h2></div><ul class="agenda">${tasks.map(t => `<li><span class="when ${dueClass(t.due)}">${t.due ? relDay(t.due) : ''}</span><span class="what"><a href="#/tasks">${esc(t.title)}</a></span></li>`).join('')}</ul></div>` : ''}
      ${opps.length ? `<div class="panel"><div class="panel-head"><h2>Linked opportunities</h2></div><ul class="agenda">${opps.map(o => `<li><span class="what"><a href="#/opportunities/${o.id}">${esc(o.name)}</a><small>${esc(o.stage)}</small></span></li>`).join('')}</ul></div>` : ''}
      ${s.notes ? `<div class="panel"><div class="panel-head"><h2>Notes</h2></div><div class="panel-body"><p style="white-space:pre-wrap;margin:0">${esc(s.notes)}</p></div></div>` : ''}
    </div>
  </div>`;

  $('#edit', main).addEventListener('click', () => openForm({
    title: 'Edit supplier', fields: SUPPLIER_FIELDS, values: s, wide: true,
    onSubmit: d => { store.update('suppliers', id, d); toast('Saved'); },
    onDelete: () => { store.remove('suppliers', id); toast('Supplier deleted'); location.hash = '#/suppliers'; }
  }));
  $('#log', main).addEventListener('click', () => logInteraction(id));
  $('#task', main).addEventListener('click', () => import('./tasks.js').then(m => m.editTask(null, { supplierId: id })));
  $$('[data-dellog]', main).forEach(b => b.addEventListener('click', async () => {
    if (!(await confirmDialog('Delete this log entry?'))) return;
    store.update('suppliers', id, { log: s.log.filter(l => l.id !== b.dataset.dellog) });
  }));
}
