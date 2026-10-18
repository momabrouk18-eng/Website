// Public holidays, calculated for any year instead of typed in by hand.
//
// China: official holiday periods and make-up working days from lunar-javascript when the
//   State Council has announced them (each November for the next year); otherwise the dates
//   are calculated from the lunar calendar and marked "estimated".
// Egypt & Türkiye: fixed dates, Orthodox Easter for Sham el-Nessim, and Islamic holidays from
//   the Umm al-Qura calendar built into the browser (can move by a day after moon sighting).
// Trade fairs have no public data feed, so they are generated from their usual dates and
//   always marked "typical — confirm".

let lunar = null;
let cache = null;
const listeners = new Set();

const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ---------- China ----------
const CN_NAMES = {
  '元旦节': 'New Year holiday', '春节': 'Spring Festival (Chinese New Year)', '清明节': 'Qingming Festival',
  '劳动节': 'Labour Day holiday', '端午节': 'Dragon Boat Festival', '中秋节': 'Mid-Autumn Festival',
  '国庆节': 'National Day (Golden Week)', '国庆中秋': 'National Day & Mid-Autumn (Golden Week)'
};
const CN_NOTES = {
  '春节': 'Factories usually close 2–4 weeks around this. Production and shipping stop.',
  '国庆节': 'Offices closed for a week. Expect delays before and after.',
  '国庆中秋': 'Offices closed for over a week. Expect delays before and after.'
};

function chinaOfficial(year) {
  const days = lunar.HolidayUtil.getHolidays(year) || [];
  if (!days.length) return null;
  const out = [];
  const off = days.filter(d => !d.isWork()).sort((a, b) => a.getDay().localeCompare(b.getDay()));
  off.forEach(d => {
    const last = out.at(-1);
    if (last && last.key === d.getName() && addDays(last.end, 1) === d.getDay()) last.end = d.getDay();
    else out.push({ key: d.getName(), date: d.getDay(), end: d.getDay() });
  });
  const events = out.map(o => ({ date: o.date, end: o.end, title: CN_NAMES[o.key] || o.key, type: 'cn', note: CN_NOTES[o.key], source: 'official' }));
  days.filter(d => d.isWork()).forEach(d => events.push({
    date: d.getDay(), title: `Make-up working day (${CN_NAMES[d.getName()] || d.getName()})`, type: 'cn', source: 'official',
    note: 'Chinese offices and factories work this weekend day to make up for the holiday.'
  }));
  return events;
}

function chinaEstimated(year) {
  const L = lunar.Lunar;
  const solar = (m, d) => L.fromYmd(year, m, d).getSolar().toYmd();
  const ny = solar(1, 1);
  const qingming = L.fromYmd(year, 3, 1).getJieQiTable()['清明'].toYmd();
  return [
    { date: iso(year, 1, 1), title: 'New Year holiday', type: 'cn' },
    { date: addDays(ny, -1), end: addDays(ny, 6), title: 'Spring Festival (Chinese New Year)', type: 'cn', note: `New Year’s Day is ${ny}. ${CN_NOTES['春节']}` },
    { date: qingming, title: 'Qingming Festival', type: 'cn' },
    { date: iso(year, 5, 1), end: iso(year, 5, 5), title: 'Labour Day holiday', type: 'cn' },
    { date: solar(5, 5), title: 'Dragon Boat Festival', type: 'cn' },
    { date: solar(8, 15), title: 'Mid-Autumn Festival', type: 'cn' },
    { date: iso(year, 10, 1), end: iso(year, 10, 7), title: 'National Day (Golden Week)', type: 'cn', note: CN_NOTES['国庆节'] }
  ].map(e => ({ ...e, estimated: true, source: 'calculated', note: [e.note, 'Official dates are announced each November.'].filter(Boolean).join(' ') }));
}

// Planning reminders around Chinese New Year.
function cnyPlanning(year) {
  const ny = lunar.Lunar.fromYmd(year, 1, 1).getSolar().toYmd();
  return [
    { date: addDays(ny, -70), end: addDays(ny, -50), title: 'Place pre-CNY orders', type: 'plan', note: 'Orders confirmed later often slip past Chinese New Year. Confirm production slots and shipment dates now.' },
    { date: addDays(ny, -18), end: addDays(ny, 21), title: 'Chinese New Year slowdown', type: 'plan', note: 'Workers travel home before the holiday and many return late. Quality issues are more common in the first weeks back.' }
  ];
}

// ---------- Islamic calendar (browser built-in) ----------
function islamicDate(year, month, day) {
  const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric', day: 'numeric', timeZone: 'Africa/Cairo' });
  for (let t = Date.UTC(year, 0, 1, 10); t < Date.UTC(year + 1, 0, 1, 10); t += 864e5) {
    const p = f.formatToParts(new Date(t));
    if (p.find(x => x.type === 'month')?.value === String(month) && +p.find(x => x.type === 'day')?.value === day) return new Date(t).toISOString().slice(0, 10);
  }
  return null;
}
const moon = 'Date follows the Islamic calendar and can move by a day after the moon sighting.';

// Orthodox Easter (Julian computus, shifted to the Gregorian calendar), valid 1900–2099.
function orthodoxEaster(y) {
  const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
  return addDays(iso(y, month, day), 13);
}

function egypt(year) {
  const fitr = islamicDate(year, 10, 1), adha = islamicDate(year, 12, 10), hijri = islamicDate(year, 1, 1), mawlid = islamicDate(year, 3, 12);
  const list = [
    { date: iso(year, 1, 7), title: 'Coptic Christmas' },
    { date: iso(year, 1, 25), title: 'Revolution Day / Police Day' },
    { date: addDays(orthodoxEaster(year), 1), title: 'Sham el-Nessim' },
    { date: iso(year, 4, 25), title: 'Sinai Liberation Day' },
    { date: iso(year, 5, 1), title: 'Labour Day' },
    { date: iso(year, 6, 30), title: 'June 30 Revolution' },
    { date: iso(year, 7, 23), title: 'Revolution Day' },
    { date: iso(year, 10, 6), title: 'Armed Forces Day' }
  ];
  if (fitr) list.push({ date: fitr, end: addDays(fitr, 2), title: 'Eid al-Fitr', estimated: true, note: moon });
  if (adha) list.push({ date: addDays(adha, -1), end: addDays(adha, 3), title: 'Arafat Day & Eid al-Adha', estimated: true, note: moon });
  if (hijri) list.push({ date: hijri, title: 'Islamic New Year', estimated: true, note: moon });
  if (mawlid) list.push({ date: mawlid, title: 'Prophet’s Birthday', estimated: true, note: moon });
  return list.map(e => ({ ...e, type: 'eg', source: 'calculated' }));
}

function turkiye(year) {
  const fitr = islamicDate(year, 10, 1), adha = islamicDate(year, 12, 10);
  const list = [
    { date: iso(year, 1, 1), title: 'New Year’s Day' },
    { date: iso(year, 4, 23), title: 'National Sovereignty and Children’s Day' },
    { date: iso(year, 5, 1), title: 'Labour Day' },
    { date: iso(year, 5, 19), title: 'Youth and Sports Day' },
    { date: iso(year, 7, 15), title: 'Democracy and National Unity Day' },
    { date: iso(year, 8, 30), title: 'Victory Day' },
    { date: iso(year, 10, 29), title: 'Republic Day' }
  ];
  if (fitr) list.push({ date: fitr, end: addDays(fitr, 2), title: 'Ramazan Bayramı', estimated: true, note: moon });
  if (adha) list.push({ date: adha, end: addDays(adha, 3), title: 'Kurban Bayramı', estimated: true, note: moon });
  return list.map(e => ({ ...e, type: 'tr', source: 'calculated' }));
}

// ---------- trade fairs: usual dates, regenerated every year ----------
const FAIRS = [
  { m: 1, d: 6, len: 4, title: 'CES — Las Vegas', url: 'https://www.ces.tech/' },
  { m: 3, d: 2, len: 4, title: 'MWC — Barcelona', url: 'https://www.mwcbarcelona.com/' },
  { m: 4, d: 11, len: 4, title: 'Global Sources Consumer Electronics (Apr) — Hong Kong', url: 'https://www.globalsources.com/trade-shows/' },
  { m: 4, d: 13, len: 4, title: 'HKTDC Electronics Fair (Spring) — Hong Kong', url: 'https://www.hktdc.com/event/hkelectronicsfairse/en' },
  { m: 4, d: 15, len: 5, title: 'Canton Fair, phase 1 (electronics) — Guangzhou', url: 'https://www.cantonfair.org.cn/en-US' },
  { m: 6, d: 2, len: 4, title: 'Computex — Taipei', url: 'https://www.computextaipei.com.tw/' },
  { m: 9, d: 4, len: 5, title: 'IFA — Berlin', url: 'https://www.ifa-berlin.com/' },
  { m: 10, d: 11, len: 4, title: 'Global Sources Consumer Electronics (Oct) — Hong Kong', url: 'https://www.globalsources.com/trade-shows/' },
  { m: 10, d: 13, len: 4, title: 'HKTDC Electronics Fair (Autumn) — Hong Kong', url: 'https://www.hktdc.com/event/hkelectronicsfairae/en' },
  { m: 10, d: 15, len: 5, title: 'Canton Fair, phase 1 (electronics) — Guangzhou', url: 'https://www.cantonfair.org.cn/en-US' },
  { m: 11, d: 16, len: 4, title: 'Cairo ICT — Cairo', url: 'https://www.cairoict.com/' }
];
function fairs(year) {
  return FAIRS.map(f => ({
    date: iso(year, f.m, f.d), end: addDays(iso(year, f.m, f.d), f.len - 1), title: f.title, url: f.url,
    type: 'fair', estimated: true, typical: true
  }));
}

// ---------- public API ----------
export async function loadHolidays() {
  if (cache) return cache;
  lunar = await import('lunar-javascript');
  const now = new Date().getFullYear();
  const events = [];
  for (const y of [now - 1, now, now + 1, now + 2]) {
    events.push(...(chinaOfficial(y) || chinaEstimated(y)), ...cnyPlanning(y), ...egypt(y), ...turkiye(y), ...fairs(y));
  }
  cache = events.sort((a, b) => a.date.localeCompare(b.date));
  listeners.forEach(fn => fn());
  return cache;
}
export const calendarEvents = () => cache || [];
export const onHolidays = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const nextChineseNewYear = today => calendarEvents().find(e => e.type === 'cn' && e.title.startsWith('Spring Festival') && (e.end || e.date) >= today);
