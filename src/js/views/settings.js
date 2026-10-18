import { store, COLLECTIONS, session } from '../store.js';
import { $, $$, esc, num, fmt, opts, pageHead, toast, download, todayISO, fdate, openForm, confirmDialog, CURRENCIES } from '../ui.js';

const ZONES = ['Africa/Cairo', 'Europe/Istanbul', 'Asia/Shanghai', 'Asia/Dubai', 'Europe/Vienna', 'Europe/London'];
const COUNTRY_FIELDS = [
  { name: 'name', label: 'Country', required: true },
  { name: 'currency', label: 'Currency', type: 'select', options: CURRENCIES },
  { name: 'duty', label: 'Default customs duty %', type: 'number' },
  { name: 'extraDuty', label: 'Additional duty %', type: 'number' },
  { name: 'specialTax', label: 'Special consumption tax %', type: 'number' },
  { name: 'vat', label: 'VAT %', type: 'number' },
  { name: 'vatRecoverable', label: 'Import VAT is normally recovered', type: 'checkbox', span: true },
  { name: 'note', label: 'Note shown in the calculator', type: 'textarea', span: true, rows: 3 }
];

export function render(main) {
  const s = store.settings();
  main.dataset.live = 'off';
  const hours = (a, b, la, lb) => `<label class="field">${la}<input type="time" name="${a}" value="${toTime(s[a])}"></label><label class="field">${lb}<input type="time" name="${b}" value="${toTime(s[b])}"></label>`;
  const counts = COLLECTIONS.filter(c => c !== 'countries').map(c => [c, store.all(c).length]).filter(([, n]) => n);

  main.innerHTML = pageHead('Settings & backup', 'Your personal preferences, and the settings the whole team shares.') + `
  <div class="grid cols-2">
    <div class="stack">
      <form class="panel" id="prof"><div class="panel-head"><div><h2>You</h2><p>Only for you</p></div></div><div class="panel-body form-grid">
        <label class="field">Your name<input name="name" value="${esc(s.name)}"></label>
        <label class="field">Your time zone<select name="homeTz">${opts(ZONES, s.homeTz)}</select></label>
        <label class="field">Appearance<select name="theme">${opts([['auto', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']], s.theme)}</select></label>
        <label class="field">Signed in as<input value="${esc(s.email)}" disabled></label>
      </div><div class="panel-head" style="border-top:1px solid var(--line)"><div><h2>Workspace</h2><p>Shared with the whole team</p></div></div><div class="panel-body form-grid">
        <label class="field">Company<input name="company" value="${esc(s.company)}"></label>
        <label class="field">Importing into by default<select name="homeCountry">${store.all('countries').map(c => `<option value="${c.id}" ${c.id === s.homeCountry ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label class="field">Usual purchase currency<select name="buyCurrency">${opts(CURRENCIES, s.buyCurrency)}</select></label>
        <label class="field">Local currency<select name="homeCurrency">${opts(CURRENCIES, s.homeCurrency)}</select></label>
      </div><div class="panel-head" style="border-top:1px solid var(--line)"><div><h2>Working hours</h2><p>Your hours are personal; China hours are shared</p></div></div><div class="panel-body form-grid">
        ${hours('workStart', 'workEnd', 'My day starts', 'My day ends')}
        ${hours('factoryStart', 'factoryEnd', 'China office opens', 'China office closes')}
        ${hours('lunchStart', 'lunchEnd', 'China lunch starts', 'China lunch ends')}
      </div><div class="panel-body" style="padding-top:0"><button class="btn primary">Save</button></div></form>

      <form class="panel" id="rates"><div class="panel-head"><div><h2>Exchange rates</h2><p>${s.ratesUpdated ? `${s.autoRates ? `Market rates${s.ratesDate ? ` of ${fdate(s.ratesDate)}` : ''} from ${esc(s.ratesSource || 'the rate service')}` : 'Set by hand'}, checked ${fdate(s.ratesUpdated, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Fetching today’s rates…'}</p></div><button type="button" class="btn sm" id="upd">Update now</button></div>
        <div class="panel-body form-grid">
          ${CURRENCIES.filter(c => c !== 'USD').map(c => `<label class="field">1 USD in ${c}<input type="number" step="any" name="${c}" value="${esc(s.rates[c])}"></label>`).join('')}
          <label class="check span-2"><input type="checkbox" name="autoRates" ${s.autoRates ? 'checked' : ''}> Update rates automatically from the internet</label>
          <p class="help span-2">When on, rates refresh every hour for the whole team and anything typed above is replaced. Turn it off to use the rates finance gives you.</p>
        </div><div class="panel-body" style="padding-top:0"><button class="btn primary">Save rates</button></div></form>
    </div>

    <div class="stack">
      <div class="panel"><div class="panel-head"><div><h2>Import countries</h2><p>Default duties and taxes for the landed cost calculator</p></div><button class="btn sm" id="add-c">Add country</button></div>
        <table class="data"><thead><tr><th>Country</th><th class="num">Default duty</th><th class="num">Add. duty</th><th class="num">Special tax</th><th class="num">VAT</th><th></th></tr></thead><tbody>
        ${store.all('countries').map(c => `<tr><td><b>${esc(c.name)}</b> <span class="muted">${esc(c.currency)}</span></td><td class="num">${c.duty === '' || c.duty === undefined ? '<span class="muted">per product</span>' : fmt(c.duty, 1) + '%'}</td><td class="num">${fmt(c.extraDuty, 1)}%</td><td class="num">${fmt(c.specialTax, 1)}%</td><td class="num">${fmt(c.vat, 0)}%</td><td><button class="btn sm ghost" data-c="${c.id}">Edit</button></td></tr>`).join('')}
        </tbody></table>
        <div class="panel-body"><p class="help">VAT rates checked 18 Oct 2026: Egypt 14%, Türkiye 20%. Customs duty depends on each product’s HS code, so it is entered per calculation.</p></div></div>

      <div class="panel"><div class="panel-head"><div><h2>Backup</h2><p>Everything is saved in the team database automatically</p></div></div><div class="panel-body">
        <p>${counts.length ? counts.map(([c, n]) => `${n} ${c}`).join(', ') : 'No data yet.'}</p>
        <p class="help">A backup file is an extra copy you keep yourself, e.g. once a month. ${session.isAdmin() ? 'Restoring adds the file’s records back into the database.' : 'Only admins can restore a backup or erase the workspace.'}</p>
        <div class="row mt"><button class="btn primary" id="exp">Download backup</button>
          ${session.isAdmin() ? `<label class="btn">Restore from backup<input type="file" id="imp" accept="application/json,.json" hidden></label>
          <button class="btn danger" id="reset">Erase everything</button>` : ''}</div>
      </div></div>
    </div>
  </div>`;

  $('#prof', main).addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const d = {};
    ['name', 'company', 'homeTz', 'homeCountry', 'buyCurrency', 'homeCurrency', 'theme'].forEach(k => (d[k] = f.elements[k].value));
    ['workStart', 'workEnd', 'factoryStart', 'factoryEnd', 'lunchStart', 'lunchEnd'].forEach(k => (d[k] = fromTime(f.elements[k].value)));
    store.setSettings(d);
    if (d.theme === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = d.theme;
    toast('Settings saved');
  });
  $('#rates', main).addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const rates = { ...s.rates };
    CURRENCIES.filter(c => c !== 'USD').forEach(c => { const v = num(f.elements[c].value); if (v > 0) rates[c] = v; });
    store.setSettings({ rates, autoRates: f.elements.autoRates.checked, ratesUpdated: new Date().toISOString() });
    toast('Rates saved');
  });
  $('#upd', main).addEventListener('click', async () => { await window.refreshRates(true); render(main); });
  const editCountry = id => {
    const c = id ? store.all('countries').find(x => x.id === id) : null;
    openForm({
      title: c ? `Edit ${c.name}` : 'Add country', fields: COUNTRY_FIELDS, values: c || { currency: 'USD', vatRecoverable: true },
      onSubmit: d => {
        ['extraDuty', 'specialTax', 'vat'].forEach(k => (d[k] = num(d[k])));
        d.duty = d.duty === '' ? '' : num(d.duty);
        if (c) store.update('countries', c.id, d); else store.add('countries', d);
        render(main);
      },
      onDelete: c && !c.builtIn ? () => { store.remove('countries', c.id); render(main); } : null
    });
  };
  $('#add-c', main).addEventListener('click', () => editCountry());
  $$('[data-c]', main).forEach(b => b.addEventListener('click', () => editCountry(b.dataset.c)));

  $('#exp', main).addEventListener('click', () => {
    download(`sourcing-desk-backup-${todayISO()}.json`, store.exportJSON());
    toast('Backup downloaded');
  });
  $('#imp', main)?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!(await confirmDialog('Records in the backup are written back into the team database. Records with the same ID are overwritten.', 'Restore'))) return;
    try {
      const n = await store.importJSON(await file.text());
      toast(`Backup restored: ${n} records`);
      render(main);
    } catch (err) {
      toast(err.message || 'That file could not be read.', 'err');
    }
  });
  $('#reset', main)?.addEventListener('click', async () => {
    if (!(await confirmDialog('This deletes all suppliers, quotes, notes and other records for the whole team. Download a backup first if you might need them.', 'Erase everything'))) return;
    try { await store.reset(); toast('Everything erased'); } catch (err) { toast(err.message, 'err'); }
    render(main);
  });
}

function toTime(h) {
  const v = num(h);
  const H = Math.floor(v), M = Math.round((v - H) * 60);
  return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`;
}
function fromTime(t) {
  const [h, m] = (t || '0:0').split(':').map(Number);
  return h + (m || 0) / 60;
}
