// Picks the data backend. The real site always uses Firebase.
// `VITE_BACKEND=local npm run dev` uses a browser-only stand-in for testing.
export let be = null;

export async function loadBackend() {
  be = import.meta.env.VITE_BACKEND === 'local' ? await import('./local.js') : await import('./firebase.js');
  await be.init();
  return be;
}
