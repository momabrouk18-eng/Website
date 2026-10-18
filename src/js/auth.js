// Sign in, create account, forgot password, and the "waiting for approval" screen.
import { be } from './backend/index.js';
import { $, esc } from './ui.js';

const GOOGLE_ICON = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.6 44 33 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

const brand = sub => `<div class="auth-brand"><img src="/img/icon.svg" width="40" height="40" alt=""><div><strong>Sourcing Desk</strong><span>${sub}</span></div></div>`;

// The name typed on the sign-up form, used when the account record is created.
export let signupName = '';

export function showGate(html) {
  $('#shell').hidden = true;
  const g = $('#gate');
  g.hidden = false;
  g.innerHTML = html;
}

export function showLoading(text = 'Loading Sourcing Desk…') {
  showGate(`<div class="gate-loading"><img src="/img/icon.svg" width="40" height="40" alt=""><p>${esc(text)}</p></div>`);
}

export function showSetupNeeded() {
  showGate(`<div class="auth">${brand('Almost ready')}<div class="panel"><div class="panel-body">
    <h2>Firebase isn’t connected yet</h2>
    <p class="help mt">The site couldn’t load its Firebase settings. Register a web app in Firebase → Project settings → Your apps, or paste its config into <code>src/firebase-config.js</code>.</p>
  </div></div></div>`);
}

export function showAuth(mode = 'signin', message = '') {
  const isUp = mode === 'signup';
  const isReset = mode === 'reset';
  showGate(`<div class="auth">
    ${brand(isUp ? 'Create your account' : isReset ? 'Reset your password' : 'Sign in to your workspace')}
    <div class="panel"><div class="panel-body">
      ${message ? `<p class="${message.startsWith('ok:') ? 'ok' : 'error'} mb" role="alert">${esc(message.replace(/^ok:/, ''))}</p>` : '<p class="error mb" role="alert" hidden></p>'}
      ${isReset ? '' : `<button class="btn google-btn" id="google" type="button">${GOOGLE_ICON} Continue with Google</button><div class="divider mt mb">or with email</div>`}
      <form id="auth-form" novalidate>
        ${isUp ? '<label class="field">Your name<input name="name" autocomplete="name" required></label>' : ''}
        <label class="field">Email<input name="email" type="email" autocomplete="email" required></label>
        ${isReset ? '' : `<label class="field">Password ${isUp ? '<small>at least 6 characters</small>' : ''}<input name="password" type="password" autocomplete="${isUp ? 'new-password' : 'current-password'}" required minlength="6"></label>`}
        <button class="btn primary" id="auth-submit">${isUp ? 'Create account' : isReset ? 'Send reset link' : 'Sign in'}</button>
        ${mode === 'signin' ? '<button type="button" class="text-link" data-mode="reset" style="justify-self:start">Forgot password?</button>' : ''}
      </form>
    </div></div>
    <p class="switch">${isUp ? 'Already have an account? <button data-mode="signin">Sign in</button>' : isReset ? '<button data-mode="signin">Back to sign in</button>' : 'New here? <button data-mode="signup">Create an account</button>'}</p>
  </div>`);

  const gate = $('#gate');
  const errBox = gate.querySelector('[role="alert"]');
  const say = (text, ok = false) => { errBox.hidden = false; errBox.className = `${ok ? 'ok' : 'error'} mb`; errBox.textContent = text; };
  const busy = on => { const b = $('#auth-submit'); if (!b) return; b.disabled = on; b.textContent = on ? 'Please wait…' : (isUp ? 'Create account' : isReset ? 'Send reset link' : 'Sign in'); };

  gate.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => showAuth(b.dataset.mode)));
  $('#google')?.addEventListener('click', async () => {
    try { await be.google(); } catch (e) { say(be.explain(e)); }
  });
  $('#auth-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target.elements;
    const email = f.email.value.trim();
    if (!email) { say('Enter your email.'); f.email.focus(); return; }
    busy(true);
    try {
      if (isReset) { await be.resetPassword(email); say('If an account uses this email, a reset link is on its way. Check your inbox.', true); }
      else if (isUp) {
        const name = f.name.value.trim();
        if (!name) { say('Enter your name.'); f.name.focus(); busy(false); return; }
        signupName = name;
        await be.signUp(name, email, f.password.value);
      } else await be.signIn(email, f.password.value);
    } catch (err) {
      say(be.explain(err));
    }
    busy(false);
  });
  gate.querySelector('input')?.focus();
}

export function showPending(profile) {
  const removed = profile.role === 'disabled';
  showGate(`<div class="auth">${brand(esc(profile.email))}<div class="panel"><div class="panel-body">
    <h2>${removed ? 'Your access was removed' : 'Waiting for approval'}</h2>
    <p class="mt">${removed ? 'An admin removed this account from the workspace. Ask them if you think this is a mistake.' : 'Your account is created. An admin needs to approve it before you can see the workspace. This page opens by itself once they do.'}</p>
    <button class="btn mt" id="pending-out">Sign out</button>
  </div></div></div>`);
  $('#pending-out').addEventListener('click', () => be.signOut());
}
