import { store } from '../store.js';
import { $, $$, esc, money, pill, stars, emptyState, openForm, pageHead, fdate, relDay, todayISO, addDays, supplierOptions, supplierLink, toast, daysBetween } from '../ui.js';

const STATUSES = ['Requested', 'Paid', 'Shipped', 'Received', 'Testing', 'Approved', 'Rejected'];
const TONE = { Requested: '', Paid: 'sky', Shipped: 'sky', Received: 'brass', Testing: 'brass', Approved: 'jade', Rejected: 'seal' };
const COURIERS = ['DHL', 'FedEx', 'UPS', 'Aramex', 'SF Express', 'EMS'];

const FIELDS = () => [
  { name: 'product', label: 'Product / model', required: true, span: true },
  { name: 'supplierId', label: 'Supplier', type: 'select', options: () => supplierOptions() },
  { name: 'oppId', label: 'Opportunity', type: 'select', options: () => [['', '—'], ...store.all('opportunities').map(o => [o.id, o.name])] },
  { name: 'qty', label: 'Quantity', type: 'number', default: 1 },
  { name: 'status', label: 'Status', type: 'select', options: STATUSES, default: 'Requested' },
  { name: 'requested', label: 'Requested on', type: 'date', default: todayISO() },
  { name: 'eta', label: 'Expected arrival', type: 'date', default: addDays(todayISO(), 10) },
  { name: 'courier', label: 'Courier', list: COURIERS },
  { name: 'tracking', label: 'Tracking number' },
  { name: 'cost', label: 'Sample + shipping cost', type: 'money', currencyName: 'costCur' },
  { name: 'refundable', label: 'Refundable against first order', type: 'checkbox' },
  { name: 'received', label: 'Received on', type: 'date' },
  { name: 'score', label: 'Evaluation', type: 'rating' },
  { name: 'evaluation', label: 'Test results & comments', type: 'textarea', span: true, rows: 4, placeholder: 'Picture quality, build, packaging, remote, software, power use vs spec…' }
];

function trackUrl(courier, n) {
  if (!n) return '';
  const c = (courier || '').toLowerCase();
  const e = encodeURIComponent(n);
  if (c.includes('dhl')) return `https://www.dhl.com/global-en/home/tracking/tracking-express.html?tracking-id=${e}`;
  if (c.includes('fedex')) return `https://www.fedex.com/fedextrack/?trknbr=${e}`;
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${e}`;
  if (c.includes('aramex')) return `https://www.aramex.com/track/results?ShipmentNumber=${e}`;
  if (c.includes('sf')) return `https://www.sf-international.com/us/en/dynamic_function/waybill/#search/bill-number/${e}`;
  return `https://www.17track.net/en/track?nums=${e}`;
}

export function editSample(id, prefill = {}) {
  const s = id ? store.get('samples', id) : null;
  openForm({
    title: s ? 'Edit sample' : 'Request sample', fields: FIELDS(), values: s || prefill, wide: true, submitLabel: s ? 'Save' : 'Add sample',
    onSubmit: d => { s ? store.update('samples', id, d) : store.add('samples', d); toast('Saved'); },
    onDelete: s ? () => store.remove('samples', id) : null
  });
}

let filter = 'open';

export function render(main) {
  const all = store.all('samples');
  const isOpen = x => !['Approved', 'Rejected'].includes(x.status);
  const rows = all.filter(x => filter === 'all' || (filter === 'open' ? isOpen(x) : !isOpen(x)));
  main.innerHTML = pageHead('Samples', 'Every sample you asked for: where it is, what it cost and how it tested.', '<button class="btn primary" id="add">Request sample</button>') + `
    <div class="tabs">${[['open', 'In progress'], ['closed', 'Decided'], ['all', 'All']].map(([k, l]) => `<button data-f="${k}" class="${filter === k ? 'active' : ''}">${l}<span class="n">${k === 'all' ? all.length : all.filter(x => k === 'open' ? isOpen(x) : !isOpen(x)).length}</span></button>`).join('')}</div>
    <div class="panel">${rows.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Sample</th><th>Supplier</th><th>Status</th><th>Tracking</th><th>Arrival</th><th class="num">Cost</th><th>Result</th><th></th></tr></thead><tbody>
      ${rows.map(x => {
        const late = isOpen(x) && !x.received && x.eta && x.eta < todayISO();
        const next = STATUSES[STATUSES.indexOf(x.status) + 1];
        return `<tr>
          <td><a href="javascript:void 0" class="strong" data-e="${x.id}">${esc(x.product)}</a><br><small class="muted">${x.qty ? x.qty + ' pcs · ' : ''}requested ${fdate(x.requested, { day: 'numeric', month: 'short' })}</small></td>
          <td>${supplierLink(x.supplierId)}</td>
          <td>${pill(x.status || 'Requested', TONE[x.status])}</td>
          <td>${x.tracking ? `<a href="${trackUrl(x.courier, x.tracking)}" target="_blank" rel="noopener">${esc(x.courier || '')} ${esc(x.tracking)}</a>` : '<span class="muted">—</span>'}</td>
          <td class="nowrap">${x.received ? `Received ${fdate(x.received, { day: 'numeric', month: 'short' })}<br><small class="muted">${x.requested ? daysBetween(x.requested, x.received) + ' days' : ''}</small>` : x.eta ? `<span class="${late ? 'pill seal' : ''}">${late ? 'Late · ' : ''}${relDay(x.eta)}</span>` : '—'}</td>
          <td class="num">${x.cost ? money(x.cost, x.costCur) : '—'}${x.refundable ? '<br><small class="muted">refundable</small>' : ''}</td>
          <td>${stars(x.score)}</td>
          <td class="no-print nowrap">${next && isOpen(x) && next !== 'Rejected' ? `<button class="btn sm" data-next="${x.id}">Mark ${next.toLowerCase()}</button>` : ''}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`
      : emptyState(filter === 'open' ? 'No samples on the way' : 'Nothing here yet', 'Track each sample from request to verdict. Add the tracking number and it links straight to the courier.', '<button class="btn primary" data-add>Request a sample</button>')}</div>`;

  $('#add', main).addEventListener('click', () => editSample());
  $('[data-add]', main)?.addEventListener('click', () => editSample());
  $$('[data-f]', main).forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; render(main); }));
  $$('[data-e]', main).forEach(a => a.addEventListener('click', () => editSample(a.dataset.e)));
  $$('[data-next]', main).forEach(b => b.addEventListener('click', () => {
    const x = store.get('samples', b.dataset.next);
    const next = STATUSES[STATUSES.indexOf(x.status) + 1];
    const patch = { status: next };
    if (next === 'Received' && !x.received) patch.received = todayISO();
    store.update('samples', x.id, patch);
    if (next === 'Testing' || next === 'Received') toast('Add your test results by opening the sample.');
  }));
}
