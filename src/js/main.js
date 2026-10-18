// Entry point: connects to Firebase, decides which screen to show, then starts the app.
import '../css/app.css';
import { loadBackend, be } from './backend/index.js';
import { initMotion } from './motion.js';
import { ensureProfile, setSession, setProfile, startData, stopData, session } from './store.js';
import { showLoading, showAuth, showPending, showSetupNeeded, signupName } from './auth.js';
import { startApp } from './app.js';
import { $, toast } from './ui.js';

function applyTheme(theme) {
  try { localStorage.setItem('sd.theme', theme || 'auto'); } catch {}
  if (!theme || theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

async function boot() {
  initMotion();
  try {
    await loadBackend();
  } catch (e) {
    console.error(e);
    showSetupNeeded();
    return;
  }

  let profileUnsub = null;
  let loadedRole = null;

  be.onUser(async user => {
    if (profileUnsub) { profileUnsub(); profileUnsub = null; }
    if (!user) {
      stopData();
      loadedRole = null;
      setSession(null, null);
      showAuth();
      return;
    }
    showLoading('Signing you in…');
    try {
      const profile = await ensureProfile(user, signupName);
      setSession(user, profile);
      // Watch the person's own record so approval, role changes or removal take effect live.
      profileUnsub = be.watchDoc(`users/${user.uid}`, async p => {
        if (!p) return;
        setProfile(p);
        applyTheme(p.prefs?.theme);
        if (!session.isMember()) {
          stopData();
          loadedRole = null;
          showPending(p);
          return;
        }
        if (loadedRole !== p.role) {
          loadedRole = p.role;
          showLoading('Loading your workspace…');
          await startData();
          startApp();
          if (profile.first) toast('Welcome! You are the admin of this workspace.');
        }
      }, err => showAuth('signin', be.explain(err)));
    } catch (e) {
      console.error(e);
      showAuth('signin', be.explain(e));
    }
  });

  $('#sign-out').addEventListener('click', () => {
    location.hash = '#/';
    be.signOut();
  });
}

boot();
