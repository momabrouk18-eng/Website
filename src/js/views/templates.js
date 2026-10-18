import { store } from '../store.js';
import { $, $$, esc, pageHead, copyText, openForm, toast, supplierOptions, opts } from '../ui.js';
import { TEMPLATES } from '../data/templates.js';

let current = 'rfq';
let lang = 'en';
const values = {};

const varsIn = text => [...new Set((text.match(/\{(\w+)\}/g) || []).map(v => v.slice(1, -1)))];
const LABELS = { contact: 'Contact name', company: 'Our company', market: 'Our market', product: 'Product', specs: 'Specification', qty: 'Quantity', incoterm: 'Incoterm', packaging: 'Packaging', deadline: 'Deadline', name: 'Your name', target: 'Target price', address: 'Delivery address', po: 'PO number', issue: 'Issue', acid: 'ACID number' };
const LONG = ['specs', 'address', 'issue'];

function allTemplates() {
  return [...store.all('templates').map(t => ({ ...t, custom: true })), ...TEMPLATES];
}

function fill(text) {
  return text.replace(/\{(\w+)\}/g, (m, k) => (values[k] ? values[k] : m));
}

const FIELDS = [
  { name: 'title', label: 'Template name', required: true, span: true },
  { name: 'category', label: 'Group', default: 'My templates' },
  { type: 'section', label: 'Write {curly braces} around words to fill in, e.g. {contact} or {product}.' },
  { name: 'en', label: 'English', type: 'textarea', span: true, rows: 9 },
  { name: 'cn', label: 'Chinese', type: 'textarea', span: true, rows: 9 }
];

function editTemplate(t) {
  const isCustom = t && t.custom;
  openForm({
    title: isCustom ? 'Edit template' : t ? 'Save as my template' : 'New template', fields: FIELDS, wide: true,
    values: t ? { title: isCustom ? t.title : `${t.title} (mine)`, category: isCustom ? t.category : 'My templates', en: t.en, cn: t.cn } : {},
    onSubmit: d => {
      if (isCustom) store.update('templates', t.id, d);
      else { const n = store.add('templates', d); current = n.id; }
      toast('Template saved');
    },
    onDelete: isCustom ? () => { store.remove('templates', t.id); current = 'rfq'; } : null
  });
}

export function render(main) {
  const s = store.settings();
  values.name = values.name || s.name || '';
  values.company = values.company || s.company || '';
  values.market = values.market || 'Egypt';
  try {
    const pre = JSON.parse(sessionStorage.getItem('tpl-prefill') || 'null');
    if (pre) { current = pre.id; Object.assign(values, pre.values); sessionStorage.removeItem('tpl-prefill'); }
  } catch {}

  const list = allTemplates();
  const t = list.find(x => x.id === current) || list[0];
  current = t.id;
  const groups = {};
  list.forEach(x => { (groups[x.category || 'Other'] = groups[x.category || 'Other'] || []).push(x); });
  const vars = varsIn(`${t.en || ''}\n${t.cn || ''}`);

  main.innerHTML = pageHead('Message templates', 'Ready-to-send emails and WeChat messages in English and Chinese. Fill in the blanks once and copy.',
    '<button class="btn" id="new">New template</button>') + `
  <div class="grid" style="grid-template-columns:minmax(200px,260px) minmax(0,1fr)" id="tpl-grid">
    <div class="panel" style="align-self:start">${Object.entries(groups).map(([g, items]) => `
      <div style="padding:10px 12px 0;font-size:.8rem;color:var(--ink-3)">${esc(g)}</div>
      <ul class="list-pick">${items.map(x => `<li><button data-t="${esc(x.id)}" class="${x.id === t.id ? 'active' : ''}">${esc(x.title)}</button></li>`).join('')}</ul>`).join('')}
    </div>
    <div class="stack">
      <div class="panel"><div class="panel-head"><h2>${esc(t.title)}</h2>
        <div class="row"><button class="btn sm" id="edit">${t.custom ? 'Edit template' : 'Customise'}</button></div></div>
        <div class="panel-body">
          ${vars.length ? `<div class="form-grid" id="vars">
            ${vars.includes('contact') ? `<label class="field">Fill from supplier<select id="from-sup">${opts(supplierOptions(), '')}</select></label>` : ''}
            ${vars.map(v => `<label class="field ${LONG.includes(v) ? 'span-2' : ''}">${esc(LABELS[v] || v)}${LONG.includes(v) ? `<textarea name="${v}" rows="3">${esc(values[v] || '')}</textarea>` : `<input name="${v}" value="${esc(values[v] || '')}">`}</label>`).join('')}
          </div>` : ''}
        </div>
      </div>
      <div class="panel"><div class="panel-head">
        <div class="tabs" style="margin:0;border:0">${[['en', 'English'], ['cn', '中文'], ['both', 'Both']].map(([k, l]) => `<button data-l="${k}" class="${lang === k ? 'active' : ''}">${l}</button>`).join('')}</div>
        <div class="row"><button class="btn sm" id="mail">Open in email</button><button class="btn sm primary" id="copy">Copy</button></div></div>
        <div class="panel-body"><pre class="tpl-text ${lang === 'cn' ? 'cn' : ''}" id="out"></pre><p class="help mt">Blanks still in {braces} are not filled in yet.</p></div>
      </div>
    </div>
  </div>`;

  const out = () => {
    const en = fill(t.en || ''), cn = fill(t.cn || '');
    return lang === 'en' ? en : lang === 'cn' ? cn : `${cn}\n\n———\n\n${en}`;
  };
  const draw = () => { $('#out', main).textContent = out(); };
  draw();

  $$('[data-t]', main).forEach(b => b.addEventListener('click', () => { current = b.dataset.t; render(main); }));
  $$('[data-l]', main).forEach(b => b.addEventListener('click', () => { lang = b.dataset.l; render(main); }));
  $('#vars', main)?.addEventListener('input', e => { if (e.target.name) { values[e.target.name] = e.target.value; draw(); } });
  $('#from-sup', main)?.addEventListener('change', e => {
    const sup = store.get('suppliers', e.target.value);
    if (!sup) return;
    values.contact = sup.contact || sup.name;
    const c = $('[name="contact"]', main); if (c) c.value = values.contact;
    draw();
    values._email = sup.email || '';
  });
  $('#copy', main).addEventListener('click', () => copyText(out()));
  $('#mail', main).addEventListener('click', () => {
    const body = out();
    const subj = t.id === 'rfq' ? `RFQ: ${values.product || ''}` : t.title;
    location.href = `mailto:${encodeURIComponent(values._email || '')}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
  });
  $('#edit', main).addEventListener('click', () => editTemplate(t));
  $('#new', main).addEventListener('click', () => editTemplate(null));

  const mq = matchMedia('(max-width: 860px)');
  const fit = () => { const g = $('#tpl-grid', main); if (g) g.style.gridTemplateColumns = mq.matches ? '1fr' : 'minmax(200px,260px) minmax(0,1fr)'; };
  fit(); mq.addEventListener('change', fit);
  return () => mq.removeEventListener('change', fit);
}
