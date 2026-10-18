import { store } from '../store.js';
import { $, $$, esc, num, fmt, money, pct, pill, stars, emptyState, openForm, pageHead, fdate, toast, supplierLink } from '../ui.js';
import { compute } from './landed.js';
import { taskRow, wireTaskList, editTask } from './tasks.js';

export const STAGES = ['Idea', 'Research', 'Assessment', 'Presented', 'Approved', 'Sampling', 'Costing', 'Launch prep', 'Launched', 'Dropped'];
const STAGE_TONE = { Idea: '', Research: 'sky', Assessment: 'sky', Presented: 'brass', Approved: 'jade', Sampling: 'jade', Costing: 'jade', 'Launch prep': 'jade', Launched: 'jade', Dropped: 'seal' };

const FIELDS = () => [
  { type: 'section', label: 'The idea' },
  { name: 'name', label: 'Product or category', required: true, span: true, placeholder: 'Mini LED 65" TV' },
  { name: 'category', label: 'Category', list: [...new Set(store.all('opportunities').map(o => o.category).filter(Boolean))] },
  { name: 'stage', label: 'Stage', type: 'select', options: STAGES, default: 'Idea' },
  { name: 'description', label: 'Why this could work', type: 'textarea', span: true, rows: 3, placeholder: 'Mini LED prices dropped ~30% this year; competitors only sell it above 40k EGP…' },
  { type: 'section', label: 'Market' },
  { name: 'marketSize', label: 'Market potential', placeholder: '~8k units/year in Egypt' },
  { name: 'competition', label: 'Competition', type: 'select', options: ['', 'Low', 'Medium', 'High'] },
  { name: 'competitors', label: 'Main competitors & their prices', type: 'textarea', span: true, rows: 2, placeholder: 'TCL C755 – 39,999 EGP; Hisense U7 – 42,500 EGP' },
  { name: 'target', label: 'Target shelf price', type: 'number', help: 'per unit, local currency' },
  { name: 'volume', label: 'Expected volume year 1', type: 'number', help: 'units' },
  { type: 'section', label: 'Cost & suppliers' },
  { name: 'landedId', label: 'Use a landed cost calculation', type: 'select', options: () => [['', '— enter manually —'], ...store.all('landed').map(l => [l.id, l.name || 'Untitled'])] },
  { name: 'estCost', label: 'Or estimated landed cost', type: 'number', help: 'per unit, local currency' },
  { name: 'suppliers', label: 'Potential suppliers', type: 'multi', span: true, options: () => store.all('suppliers').map(s => [s.id, s.name]), emptyText: 'Add suppliers first to link them here.' },
  { type: 'section', label: 'Assessment' },
  { name: 'sDemand', label: 'Customer demand', type: 'rating' },
  { name: 'sMargin', label: 'Margin potential', type: 'rating' },
  { name: 'sFit', label: 'Fits our brand & range', type: 'rating' },
  { name: 'sSupply', label: 'Supply reliability', type: 'rating' },
  { name: 'sRisk', label: 'Low risk', type: 'rating', help: 'tech, legal, stock' },
  { name: 'decisionDate', label: 'Decision date', type: 'date' },
  { name: 'risks', label: 'Risks & open questions', type: 'textarea', span: true, rows: 2 },
  { name: 'next', label: 'Recommended next step', type: 'textarea', span: true, rows: 2 }
];

export function oppNumbers(o) {
  const l = o.landedId ? store.get('landed', o.landedId) : null;
  const r = l ? compute(l) : null;
  const cost = r ? r.perUnit : num(o.estCost);
  const vat = l ? num(l.vat) : 14;
  const net = num(o.target) / (1 + vat / 100);
  const margin = net && cost ? (net - cost) / net * 100 : null;
  const ratings = [o.sDemand, o.sMargin, o.sFit, o.sSupply, o.sRisk].map(num).filter(Boolean);
  const score = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const revenue = net * num(o.volume);
  const profit = margin !== null ? (net - cost) * num(o.volume) : null;
  return { cost, net, margin, score, revenue, profit, landed: l };
}

export function newOpportunity(prefill = {}) {
  openForm({
    title: 'New opportunity', fields: FIELDS(), values: prefill, wide: true, submitLabel: 'Add opportunity',
    onSubmit: d => { const o = store.add('opportunities', { ...d, history: [{ stage: d.stage, date: new Date().toISOString() }] }); location.hash = `#/opportunities/${o.id}`; }
  });
}

function setStage(id, stage) {
  const o = store.get('opportunities', id);
  if (!o || o.stage === stage) return;
  store.update('opportunities', id, { stage, history: [...(o.history || []), { stage, date: new Date().toISOString() }] });
  toast(`Moved to ${stage}`);
}

export function render(main, params) {
  return params[0] ? detail(main, params[0]) : board(main);
}

let showDropped = false;
function board(main) {
  const all = store.all('opportunities');
  const lanes = STAGES.filter(s => showDropped || (s !== 'Dropped'));
  main.innerHTML = pageHead('Opportunities', 'New products and categories, from first idea to launch. Drag cards between stages.',
    `<label class="check no-print"><input type="checkbox" id="dropped" ${showDropped ? 'checked' : ''}> Show dropped</label><button class="btn primary" id="add">New opportunity</button>`) +
    (all.length ? `<div class="kanban">${lanes.map(st => {
      const items = all.filter(o => (o.stage || 'Idea') === st);
      return `<section class="lane" data-lane="${esc(st)}" aria-label="${esc(st)}"><div class="lane-head">${esc(st)}<span>${items.length}</span></div>
        ${items.map(o => {
          const n = oppNumbers(o);
          return `<article class="card" draggable="true" data-id="${o.id}" tabindex="0">
            <h4>${esc(o.name)}</h4>
            <div class="meta">${o.category ? `<span>${esc(o.category)}</span>` : ''}${n.margin !== null ? pill(`${fmt(n.margin, 0)}% margin`, n.margin >= 25 ? 'jade' : n.margin >= 10 ? 'brass' : 'seal') : ''}${n.score ? `<span class="stars">★ ${fmt(n.score, 1)}</span>` : ''}</div>
          </article>`;
        }).join('')}
      </section>`;
    }).join('')}</div>` : `<div class="panel">${emptyState('No opportunities yet', 'Capture product ideas as soon as you spot them at a fair, on Alibaba or in a competitor’s store. Assess them later.', '<button class="btn primary" data-add>Add first idea</button>')}</div>`);

  $('#add', main).addEventListener('click', () => newOpportunity());
  $('[data-add]', main)?.addEventListener('click', () => newOpportunity());
  $('#dropped', main).addEventListener('change', e => { showDropped = e.target.checked; board(main); });
  $$('.card', main).forEach(c => {
    c.addEventListener('click', () => (location.hash = `#/opportunities/${c.dataset.id}`));
    c.addEventListener('keydown', e => { if (e.key === 'Enter') location.hash = `#/opportunities/${c.dataset.id}`; });
    c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', c.dataset.id); e.dataTransfer.effectAllowed = 'move'; });
  });
  $$('.lane', main).forEach(l => {
    l.addEventListener('dragover', e => { e.preventDefault(); l.classList.add('drop'); });
    l.addEventListener('dragleave', () => l.classList.remove('drop'));
    l.addEventListener('drop', e => { e.preventDefault(); l.classList.remove('drop'); setStage(e.dataTransfer.getData('text/plain'), l.dataset.lane); });
  });
}

function detail(main, id) {
  const o = store.get('opportunities', id);
  if (!o) { main.innerHTML = emptyState('Opportunity not found', 'It may have been deleted.', '<a class="btn" href="#/opportunities">Back</a>'); return; }
  const n = oppNumbers(o);
  const home = n.landed ? compute(n.landed).home : store.settings().homeCurrency;
  const idx = STAGES.indexOf(o.stage || 'Idea');
  const tasks = store.all('tasks').filter(t => t.oppId === id);
  const rfqs = store.all('rfqs').filter(r => r.oppId === id);
  const samples = store.all('samples').filter(s => s.oppId === id);
  const tone = n.margin === null ? '' : n.margin >= 25 ? 'good' : n.margin >= 10 ? 'warn' : 'bad';

  main.innerHTML = pageHead(o.name, `${pill(o.stage || 'Idea', STAGE_TONE[o.stage])} ${esc(o.category || '')}`,
    `<button class="btn" id="edit">Edit</button><button class="btn" onclick="window.print()">Print one-pager</button>
     <select id="stage" class="no-print" style="width:auto" aria-label="Stage">${STAGES.map(s => `<option ${s === o.stage ? 'selected' : ''}>${s}</option>`).join('')}</select>
     ${idx < STAGES.length - 2 ? `<button class="btn primary" id="advance">Move to ${STAGES[idx + 1]}</button>` : ''}`,
    '<a href="#/opportunities">Opportunities</a>') + `
  <p class="print-only"><b>${esc(store.settings().company || '')}</b> · Opportunity assessment · ${fdate(new Date().toISOString())} · Prepared by ${esc(store.settings().name || '')}</p>
  <div class="grid cols-3 mb">
    <div class="big-result ${tone}"><span>Gross margin</span><b>${n.margin === null ? '—' : pct(n.margin)}</b><span>${n.cost ? `Landed ${money(n.cost, home)} vs net ${money(n.net, home)}` : 'Add a target price and cost'}</span></div>
    <div class="big-result"><span>Year-1 revenue (net)</span><b>${n.revenue ? money(n.revenue, home, 0) : '—'}</b><span>${o.volume ? `${fmt(o.volume, 0)} units` : 'Add expected volume'}</span></div>
    <div class="big-result"><span>Assessment score</span><b>${n.score ? fmt(n.score, 1) + ' / 5' : '—'}</b><span>${n.profit ? `Gross profit ${money(n.profit, home, 0)}` : 'Rate the five criteria'}</span></div>
  </div>
  <div class="grid side">
    <div class="stack">
      <div class="panel"><div class="panel-head"><h2>Why this could work</h2></div><div class="panel-body"><p style="white-space:pre-wrap">${esc(o.description || '—')}</p>
        <dl class="facts mt"><dt>Market potential</dt><dd>${esc(o.marketSize || '—')}</dd><dt>Competition</dt><dd>${esc(o.competition || '—')}</dd>
        <dt>Competitors</dt><dd style="white-space:pre-wrap">${esc(o.competitors || '—')}</dd><dt>Target shelf price</dt><dd>${o.target ? money(o.target, home) : '—'}</dd>
        <dt>Decision date</dt><dd>${o.decisionDate ? fdate(o.decisionDate) : '—'}</dd></dl></div></div>
      <div class="panel"><div class="panel-head"><h2>Risks &amp; next step</h2></div><div class="panel-body">
        <p style="white-space:pre-wrap"><b>Risks:</b> ${esc(o.risks || '—')}</p><p style="white-space:pre-wrap;margin:0"><b>Next step:</b> ${esc(o.next || '—')}</p></div></div>
      <div class="panel no-print"><div class="panel-head"><h2>Tasks</h2><button class="btn sm" id="addtask">Add task</button></div>
        ${tasks.length ? `<ul class="agenda" id="tl">${tasks.map(taskRow).join('')}</ul>` : '<div class="panel-body"><p class="help">No tasks linked yet.</p></div>'}</div>
    </div>
    <div class="stack">
      <div class="panel"><div class="panel-head"><h2>Assessment</h2></div><div class="panel-body">
        <div class="kv-row"><span>Customer demand</span>${stars(o.sDemand)}</div><div class="kv-row"><span>Margin potential</span>${stars(o.sMargin)}</div>
        <div class="kv-row"><span>Brand &amp; range fit</span>${stars(o.sFit)}</div><div class="kv-row"><span>Supply reliability</span>${stars(o.sSupply)}</div>
        <div class="kv-row"><span>Low risk</span>${stars(o.sRisk)}</div></div></div>
      <div class="panel"><div class="panel-head"><h2>Suppliers</h2></div><div class="panel-body">${(o.suppliers || []).length ? o.suppliers.map(sid => `<div class="kv-row"><span>${supplierLink(sid)}</span></div>`).join('') : '<p class="help">None linked yet.</p>'}
        ${n.landed ? `<p class="help mt">Cost from <a href="#/landed/${n.landed.id}">${esc(n.landed.name)}</a></p>` : ''}</div></div>
      ${rfqs.length || samples.length ? `<div class="panel"><div class="panel-head"><h2>Linked work</h2></div><div class="panel-body">
        ${rfqs.map(r => `<div class="kv-row"><a href="#/rfqs/${r.id}">RFQ: ${esc(r.product)}</a>${pill(r.status || 'Draft')}</div>`).join('')}
        ${samples.map(s => `<div class="kv-row"><a href="#/samples">Sample: ${esc(s.product)}</a>${pill(s.status)}</div>`).join('')}</div></div>` : ''}
      <div class="panel"><div class="panel-head"><h2>Stage history</h2></div><ul class="log">${(o.history || []).slice().reverse().map(h => `<li><div class="log-head"><b>${esc(h.stage)}</b>${fdate(h.date)}</div></li>`).join('')}</ul></div>
    </div>
  </div>`;

  $('#edit', main).addEventListener('click', () => openForm({
    title: 'Edit opportunity', fields: FIELDS(), values: o, wide: true,
    onSubmit: d => {
      const history = d.stage !== o.stage ? [...(o.history || []), { stage: d.stage, date: new Date().toISOString() }] : o.history;
      store.update('opportunities', id, { ...d, history });
    },
    onDelete: () => { store.remove('opportunities', id); location.hash = '#/opportunities'; }
  }));
  $('#stage', main).addEventListener('change', e => setStage(id, e.target.value));
  $('#advance', main)?.addEventListener('click', () => setStage(id, STAGES[idx + 1]));
  $('#addtask', main).addEventListener('click', () => editTask(null, { oppId: id }));
  wireTaskList(main);
}
