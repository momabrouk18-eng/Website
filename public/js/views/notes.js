import { store } from '../store.js';
import { $, $$, esc, pill, emptyState, pageHead, fdate, todayISO, opts, supplierOptions, confirmDialog, toast } from '../ui.js';

const TYPES = ['Meeting', 'Call', 'Idea', 'Fair visit', 'Factory visit', 'General'];
let q = '';

export function render(main, params) {
  if (params[0]) return editor(main, params[0]);
  const all = store.all('notes').slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const ql = q.toLowerCase();
  const rows = ql ? all.filter(n => [n.title, n.body, n.type].some(v => String(v || '').toLowerCase().includes(ql))) : all;
  main.innerHTML = pageHead('Notes', 'Meeting notes, call notes and ideas. Link them to a supplier so they show up on its page.', '<button class="btn primary" id="add">New note</button>') +
    (all.length ? `<div class="toolbar"><input type="search" id="q" placeholder="Search notes" value="${esc(q)}"></div>
    <div class="panel"><ul class="log">${rows.map(n => `<li><a href="#/notes/${n.id}" style="color:inherit;text-decoration:none;display:block">
      <div class="log-head"><b>${fdate(n.date)}</b>${pill(n.type || 'General')}${n.supplierId ? `<span>${esc(store.get('suppliers', n.supplierId)?.name || '')}</span>` : ''}</div>
      <h3 style="margin-bottom:2px">${esc(n.title || 'Untitled')}</h3><p class="muted">${esc((n.body || '').slice(0, 180))}${(n.body || '').length > 180 ? '…' : ''}</p></a></li>`).join('') || '<li class="muted">No notes match.</li>'}</ul></div>`
      : `<div class="panel">${emptyState('No notes yet', 'Capture what was agreed in meetings and calls while it is fresh.', '<button class="btn primary" data-add>Write first note</button>')}</div>`);
  const add = () => { const n = store.add('notes', { title: '', body: '', date: todayISO(), type: 'Meeting' }); location.hash = `#/notes/${n.id}`; };
  $('#add', main).addEventListener('click', add);
  $('[data-add]', main)?.addEventListener('click', add);
  $('#q', main)?.addEventListener('input', e => { q = e.target.value; render(main, []); const i = $('#q', main); i.focus(); i.setSelectionRange(q.length, q.length); });
}

function editor(main, id) {
  const n = store.get('notes', id);
  if (!n) { main.innerHTML = emptyState('Note not found', 'It may have been deleted.', '<a class="btn" href="#/notes">Back to notes</a>'); return; }
  main.dataset.live = 'off';
  main.innerHTML = pageHead(n.title || 'New note', '', '<button class="btn danger" id="del">Delete</button><a class="btn primary" href="#/notes">Done</a>', '<a href="#/notes">Notes</a>') + `
    <div class="panel"><div class="panel-body form-grid" id="f">
      <label class="field span-2">Title<input name="title" value="${esc(n.title)}" placeholder="Call with Shenzhen supplier about Q1 prices"></label>
      <label class="field">Date<input type="date" name="date" value="${esc(n.date)}"></label>
      <label class="field">Type<select name="type">${opts(TYPES, n.type)}</select></label>
      <label class="field span-2">Supplier<select name="supplierId">${opts(supplierOptions(), n.supplierId)}</select></label>
      <label class="field span-2">Notes<textarea name="body" rows="16" placeholder="Attendees, what was agreed, open points, next steps…">${esc(n.body)}</textarea></label>
      <p class="help span-2" id="saved">Saves automatically.</p>
    </div></div>`;
  let t;
  let dirty = false;
  const read = () => Object.fromEntries($$('#f [name]', main).map(el => [el.name, el.value]));
  const save = () => {
    clearTimeout(t);
    if (!dirty) return;
    dirty = false;
    const d = read();
    store.update('notes', id, d);
    $('h1', main).textContent = d.title || 'New note';
    $('#saved', main).textContent = `Saved ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  };
  $('#f', main).addEventListener('input', () => { dirty = true; clearTimeout(t); t = setTimeout(save, 400); });
  $('#f', main).addEventListener('change', e => e.target.tagName === 'SELECT' && $('#f', main).dispatchEvent(new Event('input')));
  $('#del', main).addEventListener('click', async () => {
    if (!(await confirmDialog('Delete this note?'))) return;
    store.remove('notes', id); toast('Note deleted'); location.hash = '#/notes';
  });
  if (!n.title && !n.body) $('[name="title"]', main).focus();
  return () => {
    save();
    const cur = store.get('notes', id);
    if (cur && !cur.title?.trim() && !cur.body?.trim()) store.remove('notes', id);
  };
}
