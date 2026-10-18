// The app's data layer.
// Pages read from an in-memory copy (fast, synchronous) that Firestore keeps up to date live.
// Writes go to Firestore; every signed-in teammate sees the change within a second.
import { be } from './backend/index.js';

export const COLLECTIONS = ['suppliers', 'rfqs', 'orders', 'landed', 'opportunities', 'samples', 'market', 'tasks', 'notes', 'events', 'templates', 'countries'];
export const ROLES = { admin: 'Admin', member: 'Member', pending: 'Waiting for approval', disabled: 'Removed' };

export const DEFAULT_COUNTRIES = [
  {
    id: 'eg', name: 'Egypt', currency: 'EGP', builtIn: true,
    duty: '', extraDuty: 0, specialTax: 0, vat: 14, vatRecoverable: true,
    note: 'Customs duty depends on the product’s HS code (0–60% of CIF for most goods), so enter it for each product. VAT 14% is charged on CIF value plus duty. Shipments need an ACID number (ACI / Nafeza) before loading.'
  },
  {
    id: 'tr', name: 'Türkiye', currency: 'TRY', builtIn: true,
    duty: '', extraDuty: 0, specialTax: 0, vat: 20, vatRecoverable: true,
    note: 'Customs duty and additional customs duty (İGV) depend on the GTIP code and origin, so enter them for each product. Some electronics also carry ÖTV. KDV is 20% on most goods.'
  }
];

// Shared by the whole team (stored in settings/workspace)
const DEFAULT_WORKSPACE = {
  company: 'Dijitsu',
  homeCountry: 'eg',
  homeCurrency: 'EGP',
  buyCurrency: 'USD',
  // Fallback only, replaced by live rates within seconds of opening the site (market rates of 17 Oct 2026).
  rates: { USD: 1, CNY: 6.687, EGP: 53.16, TRY: 49.58, EUR: 0.8898 },
  ratesUpdated: null,
  autoRates: true,
  factoryStart: 8.5, factoryEnd: 17.5, lunchStart: 12, lunchEnd: 13.5
};
// Personal to each person (stored on their own user record)
const DEFAULT_PREFS = { homeTz: 'Africa/Cairo', theme: 'auto', workStart: 9, workEnd: 17 };
const PREF_KEYS = Object.keys(DEFAULT_PREFS);

const cache = Object.fromEntries(COLLECTIONS.map(c => [c, []]));
let users = [];
let invites = [];
let workspace = {};
let user = null;      // Firebase login: { uid, email, displayName }
let profile = null;   // users/{uid}: { name, email, role, prefs }
const listeners = new Set();
const unsubs = [];

function emit() { listeners.forEach(fn => fn()); }
function fail(err) {
  console.error(err);
  window.dispatchEvent(new CustomEvent('store-error', { detail: be.explain(err) }));
}
const newestFirst = list => list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
const now = () => new Date().toISOString();

export function uid() { return be.newId('ids'); }

// ---------- session ----------
export const session = {
  get user() { return user; },
  get profile() { return profile; },
  isAdmin: () => profile?.role === 'admin',
  isMember: () => ['admin', 'member'].includes(profile?.role)
};
export function setSession(u, p) { user = u; profile = p; }
export function setProfile(p) { profile = p; emit(); }

// Creates the user's record the first time they sign in.
// The very first person becomes admin; people the admin invited get their invited role;
// everyone else waits for an admin to approve them.
export async function ensureProfile(u, preferredName) {
  const existing = await be.getDoc(`users/${u.uid}`);
  if (existing) return existing;
  const email = (u.email || '').toLowerCase();
  const base = { uid: u.uid, email, name: preferredName || u.displayName || email.split('@')[0], createdAt: now(), prefs: {} };
  const boot = await be.getDoc('meta/bootstrap').catch(() => null);
  if (!boot) {
    try {
      await be.batch([
        { type: 'set', path: 'meta/bootstrap', data: { uid: u.uid, createdAt: now() } },
        { type: 'set', path: `users/${u.uid}`, data: { ...base, role: 'admin' } }
      ]);
      return { ...base, role: 'admin', first: true };
    } catch { /* someone else was first */ }
  }
  // Invitations only count for a verified email address (Google accounts always are).
  const invite = u.emailVerified ? await be.getDoc(`invites/${email}`).catch(() => null) : null;
  const role = invite?.role || 'pending';
  await be.set(`users/${u.uid}`, { ...base, role });
  return { ...base, role };
}

// Starts live syncing of all shared data. Resolves once everything has loaded once.
export async function startData() {
  stopData();
  const waits = [];
  const live = (subscribe, onData) => waits.push(new Promise(resolve => {
    let first = true;
    unsubs.push(subscribe(v => { onData(v); if (first) { first = false; resolve(); } else emit(); }, err => { fail(err); if (first) { first = false; resolve(); } }));
  }));
  COLLECTIONS.forEach(c => live((ok, bad) => be.watchCol(c, ok, bad), items => (cache[c] = newestFirst(items))));
  live((ok, bad) => be.watchDoc('settings/workspace', ok, bad), d => (workspace = d || {}));
  live((ok, bad) => be.watchCol('users', ok, bad), list => (users = list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))));
  if (session.isAdmin()) live((ok, bad) => be.watchCol('invites', ok, bad), list => (invites = list));
  await Promise.all(waits);
  if (session.isAdmin() && !cache.countries.length) {
    await be.batch(DEFAULT_COUNTRIES.map(c => ({ type: 'set', path: `countries/${c.id}`, data: { ...c, createdAt: now() } }))).catch(fail);
  }
}
export function stopData() {
  while (unsubs.length) unsubs.pop()();
  COLLECTIONS.forEach(c => (cache[c] = []));
  users = []; invites = []; workspace = {};
}

// ---------- reading & writing ----------
export const store = {
  all(col) {
    if (col === 'countries' && !cache.countries.length) return DEFAULT_COUNTRIES;
    return cache[col] || [];
  },
  get(col, id) { return this.all(col).find(x => x.id === id); },
  add(col, obj) {
    const id = be.newId(col);
    const item = { ...obj, id, createdAt: now(), updatedAt: now(), createdBy: user?.uid || '', createdByName: profile?.name || '' };
    cache[col] = [item, ...cache[col]];
    emit();
    be.set(`${col}/${id}`, item).catch(fail);
    return item;
  },
  update(col, id, patch) {
    const item = this.get(col, id);
    if (!item) return null;
    const meta = { updatedAt: now(), updatedBy: user?.uid || '', updatedByName: profile?.name || '' };
    Object.assign(item, patch, meta);
    emit();
    be.update(`${col}/${id}`, { ...patch, ...meta }).catch(fail);
    return item;
  },
  remove(col, id) {
    if (!session.isAdmin()) { window.dispatchEvent(new CustomEvent('store-error', { detail: 'Only an admin can delete. Ask your admin to remove it.' })); return false; }
    cache[col] = cache[col].filter(x => x.id !== id);
    emit();
    be.remove(`${col}/${id}`).catch(fail);
    return true;
  },
  canDelete: () => session.isAdmin(),

  settings() {
    const prefs = profile?.prefs || {};
    return {
      ...DEFAULT_WORKSPACE, ...workspace,
      rates: { ...DEFAULT_WORKSPACE.rates, ...(workspace.rates || {}) },
      ...DEFAULT_PREFS, ...prefs,
      name: profile?.name || '', email: profile?.email || ''
    };
  },
  setSettings(patch) {
    const mine = {};
    const shared = {};
    Object.entries(patch).forEach(([k, v]) => {
      if (k === 'name') return;
      (PREF_KEYS.includes(k) ? mine : shared)[k] = v;
    });
    if (patch.name !== undefined && profile) {
      profile.name = patch.name;
      be.update(`users/${user.uid}`, { name: patch.name }).catch(fail);
    }
    if (Object.keys(mine).length && profile) {
      profile.prefs = { ...(profile.prefs || {}), ...mine };
      be.update(`users/${user.uid}`, Object.fromEntries(Object.entries(mine).map(([k, v]) => [`prefs.${k}`, v]))).catch(fail);
      if (mine.theme) try { localStorage.setItem('sd.theme', mine.theme); } catch {}
    }
    if (Object.keys(shared).length) {
      workspace = { ...workspace, ...shared };
      be.set('settings/workspace', shared, true).catch(fail);
    }
    emit();
  },

  // ---------- team ----------
  users: () => users,
  invites: () => invites,
  setRole(uid, role) { be.update(`users/${uid}`, { role, roleChangedBy: profile?.name || '', roleChangedAt: now() }).catch(fail); },
  invite(email, role) {
    const e = email.trim().toLowerCase();
    return be.set(`invites/${e}`, { email: e, role, invitedBy: profile?.name || '', createdAt: now() }).catch(fail);
  },
  cancelInvite(email) { return be.remove(`invites/${email}`).catch(fail); },

  // ---------- backup ----------
  exportJSON() {
    const out = { app: 'sourcing-desk', version: 2, exportedAt: now(), settings: workspace };
    COLLECTIONS.forEach(c => (out[c] = cache[c]));
    return JSON.stringify(out, null, 2);
  },
  async importJSON(text) {
    if (!session.isAdmin()) throw new Error('Only an admin can restore a backup.');
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !COLLECTIONS.some(c => Array.isArray(parsed[c]))) throw new Error('This file is not a Sourcing Desk backup.');
    const ops = [];
    COLLECTIONS.forEach(c => (parsed[c] || []).forEach(item => {
      const id = item.id || be.newId(c);
      ops.push({ type: 'set', path: `${c}/${id}`, data: { ...item, id } });
    }));
    if (parsed.settings) {
      const keep = ['company', 'homeCountry', 'homeCurrency', 'buyCurrency', 'rates', 'autoRates', 'factoryStart', 'factoryEnd', 'lunchStart', 'lunchEnd'];
      ops.push({ type: 'set', path: 'settings/workspace', merge: true, data: Object.fromEntries(keep.filter(k => parsed.settings[k] !== undefined).map(k => [k, parsed.settings[k]])) });
    }
    await be.batch(ops);
    return ops.length;
  },
  async reset() {
    if (!session.isAdmin()) throw new Error('Only an admin can erase the workspace.');
    const ops = [];
    COLLECTIONS.forEach(c => cache[c].forEach(x => ops.push({ type: 'delete', path: `${c}/${x.id}` })));
    await be.batch(ops);
    await be.batch(DEFAULT_COUNTRIES.map(c => ({ type: 'set', path: `countries/${c.id}`, data: { ...c, createdAt: now() } })));
  },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
};
