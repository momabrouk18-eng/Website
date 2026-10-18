// Exchange rates, fetched live and refreshed every hour while the site is open.
// Both sources are free, need no key and allow requests from a browser.
// They publish market rates once a day; customs and banks may use a slightly different rate.
import { store, session } from '../store.js';
import { toast } from '../ui.js';

const CURRENCIES = ['CNY', 'EGP', 'TRY', 'EUR'];
const HOUR = 3600 * 1000;

const SOURCES = [
  {
    name: 'fawazahmed0 currency API',
    url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
    read: j => ({ date: j.date, rates: Object.fromEntries(CURRENCIES.map(c => [c, j.usd?.[c.toLowerCase()]])) })
  },
  {
    name: 'fawazahmed0 currency API (mirror)',
    url: 'https://latest.currency-api.pages.dev/v1/currencies/usd.json',
    read: j => ({ date: j.date, rates: Object.fromEntries(CURRENCIES.map(c => [c, j.usd?.[c.toLowerCase()]])) })
  },
  {
    name: 'ExchangeRate-API',
    url: 'https://open.er-api.com/v6/latest/USD',
    read: j => ({ date: j.time_last_update_utc ? new Date(j.time_last_update_utc).toISOString().slice(0, 10) : null, rates: Object.fromEntries(CURRENCIES.map(c => [c, j.rates?.[c]])) })
  }
];

async function fetchRates() {
  for (const s of SOURCES) {
    try {
      const r = await fetch(s.url, { cache: 'no-store' });
      if (!r.ok) continue;
      const { date, rates } = s.read(await r.json());
      if (CURRENCIES.every(c => Number.isFinite(rates[c]) && rates[c] > 0)) return { date, rates, source: s.name };
    } catch { /* try the next source */ }
  }
  throw new Error('No rate source reachable');
}

export async function refreshRates(force = false) {
  const s = store.settings();
  if (!session.isMember()) return;
  if (!s.autoRates && !force) return;
  const age = s.ratesUpdated ? Date.now() - new Date(s.ratesUpdated).getTime() : Infinity;
  if (!force && age < HOUR) return;
  try {
    const { date, rates, source } = await fetchRates();
    store.setSettings({ rates: { USD: 1, ...rates }, ratesUpdated: new Date().toISOString(), ratesDate: date, ratesSource: source });
    if (force) toast('Exchange rates updated');
  } catch {
    if (force) toast('Couldn’t reach any rate service. Rates stay as they are; you can type them in Settings.', 'err');
  }
}

export function startRates() {
  refreshRates();
  setInterval(refreshRates, 10 * 60 * 1000); // checks every 10 minutes, fetches when the last update is over an hour old
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshRates(); });
}
