import { store, session, ROLES } from './store.js';
import { reveal, scrollToTop } from './motion.js';
import { unmountAll } from './islands.jsx';
import { refreshRates, startRates } from './live/rates.js';
import { loadHolidays, onHolidays } from './live/holidays.js';
import { orderAlerts } from './views/orders.js';
import { $, $$, esc, zoneParts, chinaStatus, todayISO, toast } from './ui.js';

const I = {
  home: '<path d="M3 9l7-6 7 6v8H3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  tasks: '<path d="M4 5h12M4 10h12M4 15h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  supp: '<circle cx="7" cy="7" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2 17c0-3 2.5-5 5-5s5 2 5 5M13 4a3 3 0 010 6M15 12c2 .6 3 2.5 3 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  rfq: '<path d="M5 2h7l4 4v12H5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 10h5M8 13h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  ship: '<path d="M2 13h16l-2 4H4z M5 13V8h7v5 M12 9h3l2 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  sample: '<path d="M3 6l7-3 7 3v8l-7 3-7-3z M3 6l7 3 7-3M10 9v8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  opp: '<path d="M10 2a5 5 0 00-3 9v2h6v-2a5 5 0 00-3-9zM8 16h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  market: '<path d="M3 16l4-5 3 3 6-8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  cost: '<rect x="4" y="2" width="12" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 6h6M7 10h1M10 10h1M13 10h0M7 14h1M10 14h1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  tools: '<path d="M12 3a4 4 0 00-4 5L3 13l2 2 5-5a4 4 0 005-4l-2 2-2-2 2-2a4 4 0 00-1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  cal: '<rect x="3" y="4" width="14" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 8h14M7 2v4M13 2v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  tpl: '<path d="M3 4h14v10H8l-4 3v-3H3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  gloss: '<path d="M4 3h9a3 3 0 013 3v11H7a3 3 0 01-3-3z M4 14a3 3 0 013-3h9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  notes: '<path d="M4 3h12v14H4z M7 7h6M7 10h6M7 13h3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>'
};

const NAV = [
  { group: 'Today', items: [
    { href: '#/', label: 'Dashboard', icon: 'home', view: 'dashboard' },
    { href: '#/tasks', label: 'Tasks', icon: 'tasks', view: 'tasks', badge: () => store.all('tasks').filter(t => !t.done && t.due && t.due <= todayISO()).length }
  ] },
  { group: 'Sourcing', items: [
    { href: '#/suppliers', label: 'Suppliers', icon: 'supp', view: 'suppliers', badge: () => store.all('suppliers').filter(s => s.nextFollowUp && s.nextFollowUp <= todayISO()).length },
    { href: '#/rfqs', label: 'RFQs & quotes', icon: 'rfq', view: 'rfqs' },
    { href: '#/orders', label: 'Orders & shipments', icon: 'ship', view: 'orders', badge: () => store.all('orders').filter(o => orderAlerts(o).some(a => a.kind !== 'eta' && a.date <= todayISO())).length },
    { href: '#/samples', label: 'Samples', icon: 'sample', view: 'samples' }
  ] },
  { group: 'Products', items: [
    { href: '#/opportunities', label: 'Opportunities', icon: 'opp', view: 'opportunities' },
    { href: '#/market', label: 'Market intel', icon: 'market', view: 'market' }
  ] },
  { group: 'Costing', items: [
    { href: '#/landed', label: 'Landed cost', icon: 'cost', view: 'landed' },
    { href: '#/tools', label: 'Calculators', icon: 'tools', view: 'tools' }
  ] },
  { group: 'Reference', items: [
    { href: '#/calendar', label: 'Calendar', icon: 'cal', view: 'calendar' },
    { href: '#/templates', label: 'Message templates', icon: 'tpl', view: 'templates' },
    { href: '#/glossary', label: 'Glossary', icon: 'gloss', view: 'glossary' },
    { href: '#/notes', label: 'Notes', icon: 'notes', view: 'notes' }
  ] },
  { group: 'Workspace', items: [
    { href: '#/team', label: 'Team', icon: 'supp', view: 'team', badge: () => session.isAdmin() ? store.users().filter(u => u.role === 'pending').length : 0 }
  ] }
];

function renderNav() {
  const route = (location.hash.replace(/^#\/?/, '').split('/')[0]) || '';
  $('#nav').innerHTML = NAV.map(g => `
    <div class="nav-group"><span>${g.group}</span>
      ${g.items.map(it => {
        const key = it.href.replace('#/', '');
        const active = key === route;
        const n = it.badge ? it.badge() : 0;
        return `<a class="nav-link ${active ? 'active' : ''}" href="${it.href}" ${active ? 'aria-current="page"' : ''}>
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">${I[it.icon]}</svg>${it.label}${n ? `<span class="count" title="Due today or late">${n}</span>` : ''}</a>`;
      }).join('')}
    </div>`).join('');
}

let cleanup = null;
let renderToken = 0;
let currentView = null;
const KNOWN = ['dashboard', 'tasks', 'suppliers', 'rfqs', 'orders', 'samples', 'opportunities', 'market', 'landed', 'tools', 'calendar', 'templates', 'glossary', 'notes', 'team', 'settings'];

// refresh = true when data changed underneath the same page (no scroll jump, no entrance animation)
async function route(refresh = false) {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const name = parts[0] || 'dashboard';
  const view = KNOWN.includes(name) ? name : 'dashboard';
  const token = ++renderToken;
  document.body.classList.remove('nav-open');
  renderNav();
  try {
    const mod = await import(`./views/${view}.js`);
    if (token !== renderToken) return;
    const main = $('#main');
    if (refresh && mod.refresh && currentView === view) { mod.refresh(main, parts.slice(1)); return; }
    if (typeof cleanup === 'function') cleanup();
    unmountAll();
    main.innerHTML = '';
    main.removeAttribute('data-live');
    currentView = view;
    cleanup = mod.render(main, parts.slice(1), { refresh }) || null;
    const title = main.querySelector('h1')?.textContent || main.querySelector('[aria-label]')?.getAttribute('aria-label');
    document.title = title ? `${title} – Sourcing Desk` : 'Sourcing Desk';
    if (!refresh) reveal(main);
    try { sessionStorage.removeItem('sd.reloaded'); } catch {}
  } catch (e) {
    console.error(e);
    // A new version was published while this tab was open: its old files are gone. Reload once.
    if (/dynamically imported module|Importing a module script failed|error loading dynamically imported/i.test(e.message || '')) {
      let tried = false;
      try { tried = sessionStorage.getItem('sd.reloaded') === '1'; sessionStorage.setItem('sd.reloaded', '1'); } catch {}
      if (!tried) { location.reload(); return; }
    }
    $('#main').innerHTML = `<div class="empty"><h3>This page didn’t load</h3><p>${esc(e.message)}</p><a class="btn" href="#/">Go to dashboard</a></div>`;
  }
}

// Re-render the current page when data changes (debounced), unless the user is typing in a dialog.
let pending = false;
function onData() {
  renderNav();
  renderMe();
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    if (document.querySelector('#modal-root .modal')) return;
    if ($('#main').dataset.live === 'off') return;
    route(true);
  });
}

function renderMe() {
  const p = session.profile;
  if (!p) return;
  $('#me').innerHTML = `${esc(p.name || p.email)}<small>${esc(ROLES[p.role] || '')} · ${esc(p.email)}</small>`;
}

// ---------- mobile menu ----------
$('#menu-btn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
$('#scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
document.addEventListener('click', e => {
  const go = e.target.closest('[data-go]');
  if (go) location.hash = go.dataset.go;
});

// ---------- top bar clocks ----------
function tickClocks() {
  const s = store.settings();
  const me = zoneParts(s.homeTz || 'Africa/Cairo');
  const cn = zoneParts('Asia/Shanghai');
  const st = chinaStatus();
  const homeLabel = (s.homeTz || 'Africa/Cairo').split('/').pop().replace(/_/g, ' ');
  $('#mini-clocks').innerHTML = `<span>${esc(homeLabel)} <b>${me.time}</b></span><span title="${esc(st.detail)}"><i class="dot ${st.key}"></i>China <b>${cn.time}</b></span>`;
}
let started = false;

// ---------- global search ----------
const searchInput = $('#global-search');
const results = $('#search-results');
let sel = -1;
function searchAll(q) {
  q = q.toLowerCase();
  const hits = [];
  const add = (label, sub, href) => hits.push({ label, sub, href });
  const has = (...vals) => vals.some(v => String(v ?? '').toLowerCase().includes(q));
  store.all('suppliers').forEach(s => has(s.name, s.nameCn, s.products, s.contact, s.city, s.category, s.wechat) && add(s.name, 'Supplier', `#/suppliers/${s.id}`));
  store.all('opportunities').forEach(o => has(o.name, o.category, o.description) && add(o.name, 'Opportunity', `#/opportunities/${o.id}`));
  store.all('orders').forEach(o => has(o.po, o.product, o.bl, o.acid, o.container) && add(`${o.po} · ${o.product || ''}`, 'Order', `#/orders/${o.id}`));
  store.all('rfqs').forEach(r => has(r.product, r.specs, r.ref) && add(r.product, 'RFQ', `#/rfqs/${r.id}`));
  store.all('landed').forEach(l => has(l.name) && add(l.name, 'Landed cost', `#/landed/${l.id}`));
  store.all('samples').forEach(s => has(s.product, s.tracking) && add(s.product, 'Sample', '#/samples'));
  store.all('tasks').forEach(t => has(t.title, t.notes) && add(t.title, t.done ? 'Task · done' : 'Task', '#/tasks'));
  store.all('notes').forEach(n => has(n.title, n.body) && add(n.title || 'Untitled note', 'Note', `#/notes/${n.id}`));
  store.all('market').forEach(m => has(m.brand, m.model, m.title, m.body) && add(m.model ? `${m.brand} ${m.model}` : m.title, 'Market intel', '#/market'));
  return hits.slice(0, 12);
}
function showResults() {
  const q = searchInput.value.trim();
  if (q.length < 2) { results.hidden = true; return; }
  const hits = searchAll(q);
  sel = -1;
  results.innerHTML = hits.length
    ? hits.map(h => `<a href="${h.href}"><span>${esc(h.label)}</span><small>${esc(h.sub)}</small></a>`).join('')
    : `<p class="help" style="padding:8px 10px">Nothing matches “${esc(q)}”.</p>`;
  results.hidden = false;
}
searchInput.addEventListener('input', showResults);
searchInput.addEventListener('keydown', e => {
  const links = $$('a', results);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    sel = Math.max(0, Math.min(links.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1)));
    links.forEach((l, i) => l.classList.toggle('sel', i === sel));
  } else if (e.key === 'Enter') {
    const l = links[sel >= 0 ? sel : 0];
    if (l) { location.hash = l.getAttribute('href'); results.hidden = true; searchInput.value = ''; searchInput.blur(); }
  } else if (e.key === 'Escape') { results.hidden = true; searchInput.blur(); }
});
results.addEventListener('click', e => { if (e.target.closest('a')) { results.hidden = true; searchInput.value = ''; } });
document.addEventListener('click', e => { if (!e.target.closest('.search')) results.hidden = true; });
document.addEventListener('keydown', e => {
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); searchInput.focus(); }
});

window.refreshRates = refreshRates;

// Called once a team member is signed in and their data has loaded.
export function startApp() {
  $('#gate').hidden = true;
  $('#shell').hidden = false;
  renderMe();
  if (started) { route(); return; }
  started = true;
  store.on(onData);
  window.addEventListener('hashchange', () => { route(); scrollToTop(); });
  tickClocks();
  setInterval(tickClocks, 30000);
  startRates();
  loadHolidays().catch(console.error);
  onHolidays(() => route(true));
  route();
}
