// Local-first data store. Everything lives in this browser's localStorage under one key.
const KEY = 'workhub.v1';

export const COLLECTIONS = ['suppliers', 'rfqs', 'landed', 'opportunities', 'samples', 'market', 'tasks', 'notes', 'events', 'templates', 'countries'];

export const DEFAULT_COUNTRIES = [
  {
    id: 'eg', name: 'Egypt', currency: 'EGP', builtIn: true,
    duty: 20, extraDuty: 0, specialTax: 0, vat: 14, vatRecoverable: true,
    note: 'Duty rates depend on the HS code. VAT 14% is charged on CIF value plus duty. Shipments need an ACID number (ACI / Nafeza) before loading.'
  },
  {
    id: 'tr', name: 'Türkiye', currency: 'TRY', builtIn: true,
    duty: 0, extraDuty: 0, specialTax: 0, vat: 20, vatRecoverable: true,
    note: 'Customs duty and additional customs duty (İGV) depend on GTIP code and origin. Some electronics also carry ÖTV. KDV is 20% on most goods.'
  }
];

const DEFAULT_SETTINGS = {
  name: 'Mo2aa',
  from: 'Mohamed',
  company: 'Dijitsu',
  homeTz: 'Africa/Cairo',
  homeCountry: 'eg',
  homeCurrency: 'EGP',
  buyCurrency: 'USD',
  rates: { USD: 1, CNY: 7.1, EGP: 48.5, TRY: 41.5, EUR: 0.86 },
  ratesUpdated: null,
  autoRates: true,
  workStart: 9, workEnd: 17,
  factoryStart: 8.5, factoryEnd: 17.5, lunchStart: 12, lunchEnd: 13.5,
  theme: 'auto',
  messages: [
    'You prepared for this. Walk in like you belong there, because you do.',
    'One supplier at a time. One email at a time. You have got this.',
    'Proud of you, today and every day.',
    'New job, same brilliant you. Go show them.',
    'Take a real lunch break today. The suppliers can wait 30 minutes.',
    'Whatever happens today, you are learning faster than you think.',
    'Remember to drink water between those WeChat calls.',
    'Big ideas start as a line in your notes. Write them down.',
    'You speak their language, literally. That is a superpower.',
    'If today is hard, it is just one day. Call me after work.'
  ]
};

function blank() {
  const d = { settings: structuredClone(DEFAULT_SETTINGS) };
  COLLECTIONS.forEach(c => (d[c] = []));
  d.countries = structuredClone(DEFAULT_COUNTRIES);
  return d;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const parsed = JSON.parse(raw);
    const d = blank();
    COLLECTIONS.forEach(c => { if (Array.isArray(parsed[c])) d[c] = parsed[c]; });
    d.settings = { ...d.settings, ...(parsed.settings || {}) };
    d.settings.rates = { ...DEFAULT_SETTINGS.rates, ...(parsed.settings?.rates || {}) };
    if (!d.countries.length) d.countries = structuredClone(DEFAULT_COUNTRIES);
    return d;
  } catch (e) {
    console.error('Could not read saved data', e);
    return blank();
  }
}

let db = load();
const listeners = new Set();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {
    console.error(e);
    window.dispatchEvent(new CustomEvent('store-error', { detail: 'Could not save. Browser storage may be full or blocked.' }));
  }
  listeners.forEach(fn => fn());
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID().slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

export const store = {
  all(col) { return db[col] || []; },
  get(col, id) { return (db[col] || []).find(x => x.id === id); },
  add(col, obj) {
    const now = new Date().toISOString();
    const item = { id: uid(), createdAt: now, updatedAt: now, ...obj };
    db[col].unshift(item);
    save();
    return item;
  },
  update(col, id, patch) {
    const item = this.get(col, id);
    if (!item) return null;
    Object.assign(item, patch, { updatedAt: new Date().toISOString() });
    save();
    return item;
  },
  remove(col, id) {
    db[col] = db[col].filter(x => x.id !== id);
    save();
  },
  settings() { return db.settings; },
  setSettings(patch) { Object.assign(db.settings, patch); save(); },
  exportJSON() {
    return JSON.stringify({ app: 'sourcing-desk', version: 1, exportedAt: new Date().toISOString(), ...db }, null, 2);
  },
  importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !parsed.settings) throw new Error('This file is not a Sourcing Desk backup.');
    localStorage.setItem(KEY, JSON.stringify(parsed));
    db = load();
    save();
  },
  reset() { db = blank(); save(); },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
};

// Keep tabs in sync if the app is open twice.
window.addEventListener('storage', e => {
  if (e.key === KEY) { db = load(); listeners.forEach(fn => fn()); }
});
