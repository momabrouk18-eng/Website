// Test-only stand-in for Firebase, used when running `VITE_BACKEND=local npm run dev`.
// Stores everything in this browser so the app can be tried without a Firebase project.
// It is never included in the real site.
const KEY = 'sd.localdb';
const AUTH = 'sd.localauth';
let data = {};
let me = null;
const docWatchers = new Map();
const colWatchers = new Map();
let authCb = null;

export const kind = 'local';

function persist() { localStorage.setItem(KEY, JSON.stringify(data)); }
function fire(path) {
  const col = path.split('/')[0];
  (colWatchers.get(col) || []).forEach(cb => cb(listCol(col)));
  (docWatchers.get(path) || []).forEach(cb => cb(data[path] ? { ...data[path] } : null));
}
function listCol(col) {
  return Object.entries(data).filter(([k]) => k.split('/')[0] === col && k.split('/').length === 2).map(([k, v]) => ({ ...v, id: k.split('/')[1] }));
}
const later = fn => setTimeout(fn, 10);

export async function init() {
  data = JSON.parse(localStorage.getItem(KEY) || '{}');
  me = JSON.parse(localStorage.getItem(AUTH) || 'null');
}
export function onUser(cb) { authCb = cb; later(() => cb(me)); return () => (authCb = null); }
function setMe(u) { me = u; localStorage.setItem(AUTH, JSON.stringify(u)); authCb && authCb(u); }
export async function signIn(email) { setMe({ uid: 'u_' + email.replace(/\W/g, ''), email, displayName: '' }); }
export async function signUp(name, email) { const u = { uid: 'u_' + email.replace(/\W/g, ''), email, displayName: name }; setMe(u); return u; }
export async function google() { setMe({ uid: 'u_google', email: 'google.user@example.com', displayName: 'Google User' }); }
export async function resetPassword() {}
export async function signOut() { setMe(null); }

export async function getDoc(path) { return data[path] ? { id: path.split('/')[1], ...data[path] } : null; }
export function watchDoc(path, cb) {
  if (!docWatchers.has(path)) docWatchers.set(path, []);
  docWatchers.get(path).push(cb);
  later(() => cb(data[path] ? { ...data[path] } : null));
  return () => docWatchers.set(path, docWatchers.get(path).filter(x => x !== cb));
}
export function watchCol(col, cb) {
  if (!colWatchers.has(col)) colWatchers.set(col, []);
  colWatchers.get(col).push(cb);
  later(() => cb(listCol(col)));
  return () => colWatchers.set(col, colWatchers.get(col).filter(x => x !== cb));
}
export const newId = () => Math.random().toString(36).slice(2, 14);
export async function set(path, value, merge = false) {
  if (path === 'meta/bootstrap' && data[path]) throw Object.assign(new Error('exists'), { code: 'permission-denied' });
  data[path] = merge ? { ...(data[path] || {}), ...value } : { ...value };
  persist(); later(() => fire(path));
}
export async function update(path, patch) {
  const cur = data[path] || {};
  Object.entries(patch).forEach(([k, v]) => {
    if (k.includes('.')) { const [a, b] = k.split('.'); cur[a] = { ...(cur[a] || {}), [b]: v }; } else cur[k] = v;
  });
  data[path] = cur; persist(); later(() => fire(path));
}
export async function remove(path) { delete data[path]; persist(); later(() => fire(path)); }
export async function batch(ops) {
  for (const op of ops) {
    if (op.type === 'delete') await remove(op.path);
    else if (op.type === 'update') await update(op.path, op.data);
    else await set(op.path, op.data, op.merge);
  }
}
export const explain = e => e?.message || 'Something went wrong.';
