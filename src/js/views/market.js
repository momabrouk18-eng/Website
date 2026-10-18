import { store } from '../store.js';
import { $, $$, esc, num, fmt, money, pill, emptyState, openForm, pageHead, fdate, todayISO, download, toCSV } from '../ui.js';

const PRICE_FIELDS = () => [
  { name: 'brand', label: 'Brand', required: true, list: ['Samsung', 'LG', 'TCL', 'Hisense', 'Xiaomi', 'Toshiba', 'Sharp', 'Tornado', 'Unionaire', 'Philips', 'Sony', 'Vestel', 'Beko'] },
  { name: 'model', label: 'Model', required: true },
  { name: 'category', label: 'Category', list: [...new Set(store.all('market').map(m => m.category).filter(Boolean))] },
  { name: 'size', label: 'Size / key spec', placeholder: '55" 4K QLED' },
  { name: 'retailer', label: 'Retailer', list: ['Amazon.eg', 'Noon', 'B.TECH', 'Carrefour', 'Raya Shop', 'Hyper One', '2B', 'Jumia', 'Trendyol', 'Hepsiburada', 'MediaMarkt'] },
  { name: 'country', label: 'Market', default: 'Egypt', list: ['Egypt', 'Türkiye', 'UAE', 'Saudi Arabia'] },
  { name: 'price', label: 'Shelf price', type: 'money', currencyName: 'currency', currencyDefault: 'EGP', required: true },
  { name: 'promo', label: 'Promotion price', type: 'number', help: 'if on offer' },
  { name: 'date', label: 'Seen on', type: 'date', default: todayISO() },
  { name: 'url', label: 'Link', type: 'url' },
  { name: 'notes', label: 'Specs & notes', type: 'textarea', span: true, rows: 3 }
];
const TREND_FIELDS = [
  { name: 'title', label: 'Headline', required: true, span: true, placeholder: 'Mini LED panel prices fall again' },
  { name: 'kind', label: 'Type', type: 'select', options: ['Trend', 'Competitor move', 'New product', 'Price change', 'Regulation', 'Fair / event'] },
  { name: 'date', label: 'Date', type: 'date', default: todayISO() },
  { name: 'impact', label: 'Relevance for us', type: 'select', options: ['Watch', 'Medium', 'High'] },
  { name: 'source', label: 'Source link', type: 'url' },
  { name: 'body', label: 'What it means', type: 'textarea', span: true, rows: 5 }
];

let tab = 'prices';
let q = '';

export function render(main) {
  const all = store.all('market');
  const prices = all.filter(m => m.type === 'price');
  const trends = all.filter(m => m.type === 'trend');

  main.innerHTML = pageHead('Market intel', 'Competitor prices you spot in stores and online, plus trends worth acting on.',
    tab === 'prices' ? '<button class="btn" id="csv">Export CSV</button><button class="btn primary" id="add">Log a price</button>' : '<button class="btn primary" id="add">Add trend</button>') + `
    <div class="tabs">${[['prices', 'Competitor prices', prices.length], ['trends', 'Trends & news', trends.length]].map(([k, l, n]) => `<button data-t="${k}" class="${tab === k ? 'active' : ''}">${l}<span class="n">${n}</span></button>`).join('')}</div>
    <div id="body"></div>`;

  const body = $('#body', main);
  if (tab === 'prices') {
    // Group by brand + model; show latest price and change since previous sighting.
    const groups = {};
    prices.forEach(p => { const k = `${p.brand}|${p.model}`.toLowerCase(); (groups[k] = groups[k] || []).push(p); });
    let rows = Object.values(groups).map(list => {
      list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const [latest, prev] = list;
      const lp = num(latest.promo) || num(latest.price);
      const pp = prev ? (num(prev.promo) || num(prev.price)) : 0;
      return { latest, count: list.length, change: prev && pp ? (lp - pp) / pp * 100 : null, eff: lp };
    });
    const ql = q.toLowerCase();
    if (ql) rows = rows.filter(r => [r.latest.brand, r.latest.model, r.latest.category, r.latest.size, r.latest.retailer].some(v => String(v || '').toLowerCase().includes(ql)));
    rows.sort((a, b) => (a.latest.category || '').localeCompare(b.latest.category || '') || a.eff - b.eff);
    body.innerHTML = prices.length ? `
      <div class="toolbar"><input type="search" id="q" placeholder="Filter by brand, model, size…" value="${esc(q)}"></div>
      <div class="panel"><div class="table-wrap"><table class="data"><thead><tr><th>Product</th><th>Category</th><th>Retailer</th><th class="num">Price</th><th class="num">Change</th><th>Seen</th></tr></thead><tbody>
      ${rows.map(r => {
        const p = r.latest;
        return `<tr class="clickable" data-id="${p.id}"><td><div class="strong">${esc(p.brand)} ${esc(p.model)}</div><small class="muted">${esc(p.size || '')}</small></td>
          <td>${esc(p.category || '—')}</td><td>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.retailer || 'link')}</a>` : esc(p.retailer || '—')}<br><small class="muted">${esc(p.country || '')}</small></td>
          <td class="num strong">${num(p.promo) ? `${money(p.promo, p.currency)}<br><small class="muted" style="text-decoration:line-through">${money(p.price, p.currency)}</small>` : money(p.price, p.currency)}</td>
          <td class="num">${r.change === null ? '<span class="muted">—</span>' : pill(`${r.change > 0 ? '+' : ''}${fmt(r.change, 1)}%`, r.change > 0 ? 'seal' : r.change < 0 ? 'jade' : '')}<br><small class="muted">${r.count} sighting${r.count > 1 ? 's' : ''}</small></td>
          <td class="muted nowrap">${fdate(p.date, { day: 'numeric', month: 'short' })}</td></tr>`;
      }).join('')}</tbody></table></div></div>
      <p class="help mt">Log the same brand and model again later to track how its price moves.</p>`
      : `<div class="panel">${emptyState('No competitor prices yet', 'Every time you see a competitor price in a store or online, log it here. Over a few weeks you get a clear picture of the market.', '<button class="btn primary" data-add>Log first price</button>')}</div>`;
    $('#q', body)?.addEventListener('input', e => { q = e.target.value; render(main); $('#q', main).focus(); $('#q', main).setSelectionRange(q.length, q.length); });
    $$('tr[data-id]', body).forEach(tr => tr.addEventListener('click', () => editPrice(tr.dataset.id)));
    $('#csv', main).addEventListener('click', () => download(`competitor-prices-${todayISO()}.csv`, toCSV(prices, [
      { label: 'Brand', value: 'brand' }, { label: 'Model', value: 'model' }, { label: 'Category', value: 'category' }, { label: 'Spec', value: 'size' },
      { label: 'Retailer', value: 'retailer' }, { label: 'Market', value: 'country' }, { label: 'Price', value: 'price' }, { label: 'Promo', value: 'promo' },
      { label: 'Currency', value: 'currency' }, { label: 'Date', value: 'date' }, { label: 'Link', value: 'url' }
    ]), 'text/csv'));
  } else {
    const sorted = trends.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    body.innerHTML = sorted.length ? `<div class="panel"><ul class="log">${sorted.map(t => `<li>
      <div class="log-head"><b>${fdate(t.date)}</b>${pill(t.kind || 'Trend', 'sky')}${t.impact === 'High' ? pill('High relevance', 'seal') : t.impact === 'Medium' ? pill('Medium', 'brass') : ''}
        <button class="btn sm ghost" style="margin-left:auto" data-e="${t.id}">Edit</button></div>
      <h3 style="margin:2px 0 4px">${esc(t.title)}</h3><p>${esc(t.body || '')}</p>${t.source ? `<a href="${esc(t.source)}" target="_blank" rel="noopener"><small>Source</small></a>` : ''}
      </li>`).join('')}</ul></div>`
      : `<div class="panel">${emptyState('No trends logged yet', 'Note new technologies, competitor launches and price shifts as you read about them, with a line on what it means for us.', '<button class="btn primary" data-add>Add first trend</button>')}</div>`;
    $$('[data-e]', body).forEach(b => b.addEventListener('click', () => editTrend(b.dataset.e)));
  }

  $$('[data-t]', main).forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; render(main); }));
  const add = () => (tab === 'prices' ? editPrice() : editTrend());
  $('#add', main).addEventListener('click', add);
  $('[data-add]', main)?.addEventListener('click', add);
}

function editPrice(id) {
  const p = id ? store.get('market', id) : null;
  openForm({
    title: p ? 'Edit price' : 'Log a competitor price', fields: PRICE_FIELDS(), values: p || {}, wide: true,
    submitLabel: p ? 'Save' : 'Log price',
    onSubmit: d => (p ? store.update('market', id, d) : store.add('market', { ...d, type: 'price' })),
    onDelete: p ? () => store.remove('market', id) : null
  });
}
function editTrend(id) {
  const t = id ? store.get('market', id) : null;
  openForm({
    title: t ? 'Edit trend' : 'Add trend', fields: TREND_FIELDS, values: t || {}, wide: true,
    onSubmit: d => (t ? store.update('market', id, d) : store.add('market', { ...d, type: 'trend' })),
    onDelete: t ? () => store.remove('market', id) : null
  });
}
