import { store } from '../store.js';
import { $, esc, fmt, money, relDay, dueClass, todayISO, addDays, daysBetween, fdate, zoneParts, zoneOffsetHours, chinaStatus, pill } from '../ui.js';
import { CALENDAR, EVENT_TYPES } from '../data/calendar.js';
import { STAGES } from './opportunities.js';
import { taskRow, wireTaskList, editTask } from './tasks.js';
import { logInteraction, newSupplier } from './suppliers.js';
import { blurHeading, lightRays, countUp, starButton, unmountWithin } from '../islands.jsx';

function greeting(h) {
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function bridge() {
  const s = store.settings();
  const tz = s.homeTz || 'Africa/Cairo';
  const me = zoneParts(tz);
  const cn = zoneParts('Asia/Shanghai');
  const diff = zoneOffsetHours('Asia/Shanghai') - zoneOffsetHours(tz); // China is ahead by diff hours
  const toHome = h => ((h - diff) % 24 + 24) % 24;
  const seg = (a, b, cls) => {
    const out = [];
    const A = a, B = b;
    if (B > A) out.push([A, B]); else { out.push([A, 24]); out.push([0, B]); }
    return out.map(([x, y]) => `<span class="seg ${cls}" style="left:${x / 24 * 100}%;width:${(y - x) / 24 * 100}%"></span>`).join('');
  };
  const fStart = toHome(s.factoryStart), fEnd = toHome(s.factoryEnd);
  const lStart = toHome(s.lunchStart), lEnd = toHome(s.lunchEnd);
  // Overlap of my work hours with China factory hours (my time)
  const ovStart = Math.max(s.workStart, fStart), ovEnd = Math.min(s.workEnd, fEnd < fStart ? 24 : fEnd);
  const hh = h => { const H = Math.floor(h), M = Math.round((h - H) * 60); return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`; };
  const st = chinaStatus();
  const homeName = tz.split('/').pop().replace(/_/g, ' ');
  return `
  <section class="bridge" aria-label="Time in ${esc(homeName)} and China">
    <div class="bridge-top">
      <div class="bridge-clock"><b>${me.time}</b><span>${esc(homeName)} · ${me.weekday}</span></div>
      <div class="bridge-status"><strong><i class="dot ${st.key}"></i>${esc(st.label)}</strong>${esc(st.detail)}</div>
      <div class="bridge-clock right"><b>${cn.time}</b><span>Shenzhen · ${cn.weekday} · ${diff >= 0 ? '+' : ''}${fmt(diff, diff % 1 ? 1 : 0)} h</span></div>
    </div>
    <div class="timeline" aria-hidden="true">
      <div class="track me">${seg(s.workStart, s.workEnd, 'work')}</div>
      <div class="track cn">${seg(fStart, fEnd, 'factory')}${seg(lStart, lEnd, 'lunch')}</div>
      <span class="now" style="left:${me.hours / 24 * 100}%"></span>
      <div class="ticks">${[0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => `<span style="left:${h / 24 * 100}%">${String(h % 24).padStart(2, '0')}</span>`).join('')}</div>
    </div>
    <div class="legend"><span><i style="background:var(--sky);opacity:.55"></i>Your working hours</span><span><i style="background:var(--jade);opacity:.7"></i>China office &amp; factory hours</span><span><i style="background:var(--brass)"></i>China lunch</span>
      ${ovEnd > ovStart ? `<span>Best window for calls: <b style="color:var(--ink)">${hh(ovStart)}–${hh(Math.min(ovEnd, lStart > ovStart && lStart < ovEnd ? lStart : ovEnd))}</b> your time</span>` : ''}</div>
  </section>`;
}

function bodyHtml() {
  const s = store.settings();
  const today = todayISO();
  const me = zoneParts(s.homeTz || 'Africa/Cairo');
  const suppliers = store.all('suppliers');
  const tasks = store.all('tasks');
  const samples = store.all('samples');
  const rfqs = store.all('rfqs');
  const opps = store.all('opportunities');

  // Agenda for today
  const items = [];
  suppliers.filter(x => x.nextFollowUp && x.nextFollowUp <= today).forEach(x => items.push({ date: x.nextFollowUp, html: `<a href="#/suppliers/${x.id}">Follow up with ${esc(x.name)}</a><small>${esc(x.contact || '')}${x.wechat ? ` · WeChat ${esc(x.wechat)}` : ''}</small>`, action: `<button class="btn sm" data-log="${x.id}">Log contact</button>` }));
  samples.filter(x => !['Approved', 'Rejected', 'Received', 'Testing'].includes(x.status) && x.eta && x.eta <= addDays(today, 2)).forEach(x => items.push({ date: x.eta, html: `<a href="#/samples">Sample arriving: ${esc(x.product)}</a><small>${esc([x.courier, x.tracking].filter(Boolean).join(' '))}</small>` }));
  rfqs.filter(r => r.deadline && !['Awarded', 'Closed'].includes(r.status) && r.deadline <= addDays(today, 3)).forEach(r => items.push({ date: r.deadline, html: `<a href="#/rfqs/${r.id}">Quotes due: ${esc(r.product)}</a><small>${(r.quotes || []).length} received so far</small>` }));
  opps.filter(o => o.decisionDate && !['Launched', 'Dropped'].includes(o.stage) && o.decisionDate <= addDays(today, 7)).forEach(o => items.push({ date: o.decisionDate, html: `<a href="#/opportunities/${o.id}">Decision due: ${esc(o.name)}</a><small>${esc(o.stage)}</small>` }));
  items.sort((a, b) => a.date.localeCompare(b.date));

  const dueTasks = tasks.filter(t => !t.done && t.due && t.due <= today).sort((a, b) => a.due.localeCompare(b.due));
  const soonTasks = tasks.filter(t => !t.done && t.due > today && t.due <= addDays(today, 7)).sort((a, b) => a.due.localeCompare(b.due));

  // Calendar: what's next
  const custom = store.all('events').map(e => ({ ...e, type: e.type || 'custom' }));
  const upcoming = [...CALENDAR, ...custom].filter(e => (e.end || e.date) >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const cny = CALENDAR.find(e => e.title.startsWith('Spring Festival') && e.date >= today);

  const inTransit = samples.filter(x => ['Paid', 'Shipped'].includes(x.status)).length;
  const openRfqs = rfqs.filter(r => !['Awarded', 'Closed'].includes(r.status)).length;
  const active = suppliers.filter(x => x.status === 'Active').length;
  const pipeline = STAGES.slice(0, 8).map(st => [st, opps.filter(o => o.stage === st).length]);
  const maxP = Math.max(1, ...pipeline.map(p => p[1]));
  const fresh = !suppliers.length && !tasks.length && !store.all('landed').length;

  return `
  ${fresh ? `
  <div class="panel mb"><div class="panel-head"><div><h2>Getting set up</h2><p>Four steps and this workspace starts working for you.</p></div></div>
    <ul class="agenda">
      <li><span class="when">Step 1</span><span class="what"><a href="javascript:void 0" id="g-sup">Add the suppliers you already work with</a><small>Their terms, contacts and follow-up dates</small></span></li>
      <li><span class="when">Step 2</span><span class="what"><a href="#/landed/new">Run a landed cost on a current product</a><small>Check that duties and VAT match what finance uses</small></span></li>
      <li><span class="when">Step 3</span><span class="what"><a href="#/market">Log a few competitor shelf prices</a><small>B.TECH, Noon, Amazon — whatever you check anyway</small></span></li>
      <li><span class="when">Step 4</span><span class="what"><a href="#/settings">Check your settings</a><small>Name, time zone, exchange rates and backup</small></span></li>
    </ul></div>` : ''}
  <div class="grid side">
    <div class="stack">
      <div class="panel">
        <div class="panel-head"><div><h2>Today</h2><p>${items.length + dueTasks.length ? `${items.length + dueTasks.length} things need you` : 'Nothing urgent'}</p></div><button class="btn sm" id="add-task">Add task</button></div>
        ${items.length || dueTasks.length ? `<ul class="agenda" id="today">
          ${items.map(i => `<li><span class="when ${dueClass(i.date)}">${relDay(i.date)}</span><span class="what">${i.html}</span>${i.action || ''}</li>`).join('')}
          ${dueTasks.map(taskRow).join('')}
        </ul>` : `<div class="panel-body"><p class="help">No follow-ups, deadlines or tasks due today. A good day to research new products or catch up with a supplier you have not heard from in a while.</p></div>`}
      </div>
      ${soonTasks.length ? `<div class="panel"><div class="panel-head"><h2>Next 7 days</h2><a class="btn sm ghost" href="#/tasks">All tasks</a></div><ul class="agenda" id="soon">${soonTasks.slice(0, 8).map(taskRow).join('')}</ul></div>` : ''}
      <div class="panel"><div class="panel-head"><h2>Product pipeline</h2><a class="btn sm ghost" href="#/opportunities">Open board</a></div><div class="panel-body">
        ${opps.length ? pipeline.map(([st, n]) => `<div class="row" style="flex-wrap:nowrap;margin-bottom:6px"><span style="width:110px;flex:none;font-size:.88rem;color:var(--ink-2)">${st}</span><div class="meter" style="flex:1"><span style="width:${n / maxP * 100}%"></span></div><b style="width:24px;text-align:right">${n}</b></div>`).join('')
          : '<p class="help">No product ideas tracked yet. <a href="#/opportunities">Add the first one</a> when something catches your eye.</p>'}
      </div></div>
    </div>
    <div class="stack">
      <div class="grid cols-3" style="gap:10px">
        <a class="panel stat" href="#/suppliers" style="text-decoration:none;color:inherit"><b data-count="${active}">${active}</b><span>Active suppliers</span></a>
        <a class="panel stat ${openRfqs ? 'warn' : ''}" href="#/rfqs" style="text-decoration:none;color:inherit"><b data-count="${openRfqs}">${openRfqs}</b><span>Open RFQs</span></a>
        <a class="panel stat" href="#/samples" style="text-decoration:none;color:inherit"><b data-count="${inTransit}">${inTransit}</b><span>Samples on the way</span></a>
      </div>
      <div class="panel"><div class="panel-head"><h2>Coming up</h2><a class="btn sm ghost" href="#/calendar">Calendar</a></div>
        ${cny ? `<div class="panel-body" style="border-bottom:1px solid var(--line)"><b><span data-count="${daysBetween(today, cny.date)}">${daysBetween(today, cny.date)}</span> days</b> until Chinese New Year holidays${cny.estimated ? ' <small class="muted">(estimated)</small>' : ''}.<br><small class="muted">Factories wind down earlier. Confirm pre-holiday orders early.</small></div>` : ''}
        <ul class="agenda">${upcoming.map(e => `<li><span class="when">${fdate(e.date, { day: 'numeric', month: 'short' })}</span><span class="what"><span>${esc(e.title)}</span><small>${EVENT_TYPES[e.type]?.label || ''}${e.end && e.end !== e.date ? ` · until ${fdate(e.end, { day: 'numeric', month: 'short' })}` : ''}</small></span></li>`).join('')}</ul>
      </div>
      <div class="panel"><div class="panel-head"><h2>Exchange rates</h2><a class="btn sm ghost" href="#/tools">Convert</a></div><div class="panel-body">
        ${['CNY', 'EGP', 'TRY', 'EUR'].map(c => `<div class="kv-row"><span>1 USD</span><span>${fmt(s.rates[c], c === 'EUR' ? 4 : 2)} ${c}</span></div>`).join('')}
        <p class="help mt">${s.ratesUpdated ? `Updated ${fdate(s.ratesUpdated, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Default rates. Connect to the internet to update.'}</p>
      </div></div>
    </div>
  </div>`;
}

function heroHtml() {
  const s = store.settings();
  const me = zoneParts(s.homeTz || 'Africa/Cairo');
  return `
  <section class="hero">
    <div class="hero-rays" id="hero-rays" aria-hidden="true"></div>
    <div class="hello">
      <div><h1 id="hello-title">${greeting(me.h)}, ${esc(s.name || 'there')}</h1><div class="date">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
      <div class="quick no-print">
        <button class="btn" id="q-task">New task</button>
        <a class="btn" href="#/landed/new">Landed cost</a>
        <a class="btn" href="#/rfqs">RFQs</a>
        <span class="star-slot" id="cta-slot"><a class="btn primary" href="#/templates">Write to a supplier</a></span>
      </div>
    </div>
    ${bridge()}
  </section>`;
}

function wireBody(main, animate) {
  const body = $('#dash-body', main);
  $('#add-task', body).addEventListener('click', () => editTask());
  $('#g-sup', body)?.addEventListener('click', () => newSupplier());
  body.querySelectorAll('[data-log]').forEach(b => b.addEventListener('click', () => logInteraction(b.dataset.log)));
  wireTaskList(body);
  if (animate) body.querySelectorAll('[data-count]').forEach(el => countUp(el, Number(el.dataset.count)));
}

export function render(main) {
  const s = store.settings();
  const me = zoneParts(s.homeTz || 'Africa/Cairo');
  main.innerHTML = heroHtml() + `<div id="dash-body">${bodyHtml()}</div>`;
  $('#q-task', main).addEventListener('click', () => editTask());
  blurHeading($('#hello-title', main), `${greeting(me.h)}, ${s.name || 'there'}`);
  lightRays($('#hero-rays', main));
  starButton($('#cta-slot', main), { href: '#/templates', label: 'Write to a supplier' });
  wireBody(main, true);

  const timer = setInterval(() => {
    const b = $('.bridge', main);
    if (b) b.outerHTML = bridge();
  }, 60000);
  return () => clearInterval(timer);
}

// Data changed: update the lists and numbers, leave the header (and its animations) alone.
export function refresh(main) {
  const body = $('#dash-body', main);
  if (!body) return render(main);
  unmountWithin(body);
  body.innerHTML = bodyHtml();
  wireBody(main, false);
}
