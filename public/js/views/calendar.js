import { store } from '../store.js';
import { $, $$, esc, pill, pageHead, fdate, todayISO, openForm, daysBetween } from '../ui.js';
import { CALENDAR, EVENT_TYPES } from '../data/calendar.js';

let show = { cn: true, fair: true, plan: true, eg: true, custom: true };
let past = false;

const FIELDS = [
  { name: 'title', label: 'Event', required: true, span: true, placeholder: 'Visit to Dongguan factory' },
  { name: 'date', label: 'Starts', type: 'date', required: true, default: todayISO() },
  { name: 'end', label: 'Ends', type: 'date' },
  { name: 'note', label: 'Notes', type: 'textarea', span: true, rows: 3 }
];

function editEvent(id) {
  const e = id ? store.get('events', id) : null;
  openForm({
    title: e ? 'Edit event' : 'Add event', fields: FIELDS, values: e || {},
    onSubmit: d => (e ? store.update('events', id, d) : store.add('events', { ...d, type: 'custom' })),
    onDelete: e ? () => store.remove('events', id) : null
  });
}

export function render(main) {
  const today = todayISO();
  const all = [...CALENDAR, ...store.all('events').map(e => ({ ...e, type: 'custom' }))]
    .filter(e => show[e.type] !== false)
    .filter(e => past || (e.end || e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const byMonth = {};
  all.forEach(e => { const k = e.date.slice(0, 7); (byMonth[k] = byMonth[k] || []).push(e); });

  main.innerHTML = pageHead('Calendar', 'Chinese holidays that stop production, trade fairs worth visiting, Egyptian holidays and your own events. Dates marked estimated are not yet officially confirmed.',
    '<button class="btn primary" id="add">Add event</button>') + `
    <div class="toolbar">
      ${Object.entries({ cn: 'China holidays', fair: 'Trade fairs', plan: 'Planning', eg: 'Egypt holidays', custom: 'My events' }).map(([k, l]) => `<label class="check"><input type="checkbox" data-k="${k}" ${show[k] ? 'checked' : ''}> ${l}</label>`).join('')}
      <label class="check" style="margin-left:auto"><input type="checkbox" id="past" ${past ? 'checked' : ''}> Show past</label>
    </div>
    ${Object.keys(byMonth).map(m => `
      <div class="panel mb"><div class="panel-head"><h2>${new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2></div>
      <ul class="agenda">${byMonth[m].map(e => {
        const d = daysBetween(today, e.date);
        const on = e.date <= today && (e.end || e.date) >= today;
        return `<li>
          <span class="when ${on ? 'today' : ''}">${fdate(e.date, { day: 'numeric', month: 'short' })}${e.end && e.end !== e.date ? `<br>– ${fdate(e.end, { day: 'numeric', month: 'short' })}` : ''}</span>
          <span class="what"><span class="strong">${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a>` : esc(e.title)}</span>
            <small>${on ? 'Happening now' : d > 0 ? `In ${d} days` : ''}${e.estimated ? ' · estimated' : ''}${e.note ? ` · ${esc(e.note)}` : ''}</small></span>
          ${pill(EVENT_TYPES[e.type]?.label || '', EVENT_TYPES[e.type]?.tone || '')}
          ${e.type === 'custom' ? `<button class="btn sm ghost" data-e="${e.id}">Edit</button>` : ''}
        </li>`;
      }).join('')}</ul></div>`).join('') || '<div class="panel"><p class="empty">Nothing to show with these filters.</p></div>'}`;

  $$('[data-k]', main).forEach(c => c.addEventListener('change', () => { show[c.dataset.k] = c.checked; render(main); }));
  $('#past', main).addEventListener('change', e => { past = e.target.checked; render(main); });
  $('#add', main).addEventListener('click', () => editEvent());
  $$('[data-e]', main).forEach(b => b.addEventListener('click', () => editEvent(b.dataset.e)));
}
