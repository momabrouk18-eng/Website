import { $, $$, esc, pageHead } from '../ui.js';
import { GLOSSARY } from '../data/glossary.js';

let q = '';
let group = '';

export function render(main) {
  const groups = [...new Set(GLOSSARY.map(g => g.group))];
  main.innerHTML = pageHead('Glossary', 'Trade, sourcing and customs terms you will hear every day, in plain words.') + `
    <div class="toolbar"><input type="search" id="q" placeholder="Search terms" value="${esc(q)}">
      <div class="tabs" style="margin:0;border:0">${['', ...groups].map(g => `<button data-g="${esc(g)}" class="${group === g ? 'active' : ''}">${g || 'All'}</button>`).join('')}</div></div>
    <div class="panel" id="list"></div>`;
  const draw = () => {
    const ql = q.toLowerCase();
    const rows = GLOSSARY.filter(g => (!group || g.group === group) && (!ql || [g.term, g.full, g.def].some(v => v.toLowerCase().includes(ql))));
    $('#list', main).innerHTML = rows.length ? rows.map(g => `<dl class="gloss"><dt>${esc(g.term)}${g.full ? `<small>${esc(g.full)}</small>` : ''}</dt><dd>${esc(g.def)}</dd></dl>`).join('') : '<p class="empty">No terms match.</p>';
  };
  draw();
  $('#q', main).addEventListener('input', e => { q = e.target.value; draw(); });
  $$('[data-g]', main).forEach(b => b.addEventListener('click', () => { group = b.dataset.g; render(main); }));
}
