import { store } from '../store.js';
import { $, $$, esc, relDay, dueClass, pill, emptyState, openForm, pageHead, todayISO, addDays, supplierOptions, supplierLink, toast } from '../ui.js';

const PRIORITY = ['High', 'Normal', 'Low'];
const PRI_TONE = { High: 'seal', Normal: '', Low: 'sky' };

const fields = () => [
  { name: 'title', label: 'Task', required: true, span: true, placeholder: 'Send RFQ for 32" TV to 3 suppliers' },
  { name: 'due', label: 'Due date', type: 'date', default: todayISO() },
  { name: 'priority', label: 'Priority', type: 'select', options: PRIORITY, default: 'Normal' },
  { name: 'supplierId', label: 'Supplier', type: 'select', options: () => supplierOptions() },
  { name: 'oppId', label: 'Opportunity', type: 'select', options: () => [['', '—'], ...store.all('opportunities').map(o => [o.id, o.name])] },
  { name: 'repeat', label: 'Repeats', type: 'select', options: [['', 'Does not repeat'], ['daily', 'Every workday'], ['weekly', 'Every week'], ['monthly', 'Every month']] },
  { name: 'notes', label: 'Notes', type: 'textarea', span: true, rows: 3 }
];

export function editTask(id, prefill = {}) {
  const t = id ? store.get('tasks', id) : null;
  openForm({
    title: t ? 'Edit task' : 'New task', fields: fields(), values: t || prefill, submitLabel: t ? 'Save' : 'Add task',
    onSubmit: d => { t ? store.update('tasks', id, d) : store.add('tasks', { ...d, done: false }); toast(t ? 'Saved' : 'Task added'); },
    onDelete: t ? () => { store.remove('tasks', id); toast('Task deleted'); } : null
  });
}

function nextDate(iso, repeat) {
  const base = iso || todayISO();
  if (repeat === 'daily') {
    let d = addDays(base, 1);
    const day = new Date(d + 'T00:00:00').getDay();
    if (day === 5) d = addDays(d, 2); // skip Fri/Sat weekend in Egypt
    if (day === 6) d = addDays(d, 1);
    return d;
  }
  if (repeat === 'weekly') return addDays(base, 7);
  if (repeat === 'monthly') { const d = new Date(base + 'T00:00:00'); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); }
  return '';
}

export function toggleTask(id) {
  const t = store.get('tasks', id);
  if (!t) return;
  if (!t.done && t.repeat) {
    const { id: _i, createdAt: _c, updatedAt: _u, doneAt: _d, ...rest } = t;
    store.add('tasks', { ...rest, done: false, due: nextDate(t.due, t.repeat) });
  }
  store.update('tasks', id, { done: !t.done, doneAt: !t.done ? new Date().toISOString() : '' });
}

export function taskRow(t) {
  const sup = t.supplierId ? store.get('suppliers', t.supplierId) : null;
  const opp = t.oppId ? store.get('opportunities', t.oppId) : null;
  return `<li data-task="${t.id}">
    <input type="checkbox" ${t.done ? 'checked' : ''} aria-label="Mark done" data-toggle="${t.id}" style="margin-top:3px">
    <span class="what"><a href="javascript:void 0" data-edit="${t.id}" style="${t.done ? 'text-decoration:line-through;color:var(--ink-3)' : ''}">${esc(t.title)}</a>
      <small>${[sup ? `<a href="#/suppliers/${sup.id}">${esc(sup.name)}</a>` : '', opp ? `<a href="#/opportunities/${opp.id}">${esc(opp.name)}</a>` : '', t.repeat ? '↻ repeats' : '', esc(t.notes || '').slice(0, 90)].filter(Boolean).join(' · ')}</small></span>
    ${t.priority && t.priority !== 'Normal' ? pill(t.priority, PRI_TONE[t.priority]) : ''}
    <span class="when ${t.done ? '' : dueClass(t.due)}" style="text-align:right">${t.due ? relDay(t.due) : ''}</span>
  </li>`;
}

export function wireTaskList(root) {
  $$('[data-toggle]', root).forEach(c => c.addEventListener('change', () => toggleTask(c.dataset.toggle)));
  $$('[data-edit]', root).forEach(a => a.addEventListener('click', e => { e.preventDefault(); editTask(a.dataset.edit); }));
}

let tab = 'open';

export function render(main) {
  const all = store.all('tasks');
  const today = todayISO();
  const groups = {
    open: all.filter(t => !t.done),
    late: all.filter(t => !t.done && t.due && t.due < today),
    today: all.filter(t => !t.done && t.due === today),
    week: all.filter(t => !t.done && t.due && t.due > today && t.due <= addDays(today, 7)),
    done: all.filter(t => t.done)
  };
  const rank = { High: 0, Normal: 1, Low: 2 };
  const list = groups[tab].slice().sort((a, b) => tab === 'done'
    ? (b.doneAt || '').localeCompare(a.doneAt || '')
    : (a.due || '9999').localeCompare(b.due || '9999') || (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1));

  main.innerHTML = pageHead('Tasks', 'Everything on your plate, with due dates and links to suppliers and products.', '<button class="btn primary" id="add">New task</button>') + `
    <div class="tabs" role="tablist">
      ${[['open', 'All open'], ['late', 'Late'], ['today', 'Today'], ['week', 'Next 7 days'], ['done', 'Done']].map(([k, l]) => `<button role="tab" data-tab="${k}" class="${tab === k ? 'active' : ''}">${l}<span class="n">${groups[k].length}</span></button>`).join('')}
    </div>
    <form class="toolbar" id="quick"><input id="quick-title" placeholder="Quick add: type a task and press Enter" style="flex:1;max-width:520px"><input type="date" id="quick-due" value="${today}" style="width:auto"><button class="btn">Add</button></form>
    <div class="panel">${list.length ? `<ul class="agenda" id="list">${list.map(taskRow).join('')}</ul>` :
      emptyState(tab === 'done' ? 'Nothing finished yet' : 'Nothing here', tab === 'done' ? 'Ticked-off tasks land here.' : 'Add a task above. Recurring ones, like a weekly supplier price check, repeat themselves when you tick them off.')}</div>`;

  $$('[data-tab]', main).forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; render(main); }));
  $('#add', main).addEventListener('click', () => editTask());
  $('#quick', main).addEventListener('submit', e => {
    e.preventDefault();
    const title = $('#quick-title', main).value.trim();
    if (!title) return;
    store.add('tasks', { title, due: $('#quick-due', main).value, priority: 'Normal', done: false });
  });
  wireTaskList(main);
}
