import { store, session, ROLES } from '../store.js';
import { $, $$, esc, pill, pageHead, fdate, openForm, confirmDialog, toast, emptyState } from '../ui.js';

const TONE = { admin: 'jade', member: 'sky', pending: 'brass', disabled: 'seal' };

export function render(main) {
  const admin = session.isAdmin();
  const me = session.user?.uid;
  const users = store.users();
  const pending = users.filter(u => u.role === 'pending');
  const active = users.filter(u => ['admin', 'member'].includes(u.role));
  const removed = users.filter(u => u.role === 'disabled');
  const invites = admin ? store.invites() : [];

  const row = u => `<tr>
    <td><div class="strong">${esc(u.name || '—')}${u.uid === me ? ' <span class="muted">(you)</span>' : ''}</div><small class="muted">${esc(u.email)}</small></td>
    <td>${pill(ROLES[u.role] || u.role, TONE[u.role])}</td>
    <td class="muted nowrap">${fdate(u.createdAt)}</td>
    <td class="nowrap right">${admin && u.uid !== me ? actions(u) : ''}</td>
  </tr>`;
  const actions = u => {
    if (u.role === 'pending') return `<button class="btn sm primary" data-role="member" data-u="${u.uid}">Approve</button> <button class="btn sm danger" data-role="disabled" data-u="${u.uid}">Decline</button>`;
    if (u.role === 'disabled') return `<button class="btn sm" data-role="member" data-u="${u.uid}">Restore access</button>`;
    return `${u.role === 'member' ? `<button class="btn sm ghost" data-role="admin" data-u="${u.uid}">Make admin</button>` : `<button class="btn sm ghost" data-role="member" data-u="${u.uid}">Make member</button>`}
      <button class="btn sm ghost danger" data-role="disabled" data-u="${u.uid}">Remove</button>`;
  };

  main.innerHTML = pageHead('Team', admin
    ? 'Everyone with access to this workspace. Approve new sign-ups, invite colleagues and choose who is an admin.'
    : 'Everyone with access to this workspace. Only admins can add or remove people.',
    admin ? '<button class="btn primary" id="invite">Invite someone</button>' : '') + `
  ${admin && pending.length ? `<div class="panel mb"><div class="panel-head"><div><h2>Waiting for approval</h2><p>These people created an account and can’t see anything until you approve them.</p></div></div>
    <div class="table-wrap"><table class="data"><tbody>${pending.map(row).join('')}</tbody></table></div></div>` : ''}
  <div class="panel mb"><div class="panel-head"><div><h2>Members</h2><p>Members can add and edit everything. Admins can also delete, restore backups and manage the team.</p></div></div>
    <div class="table-wrap"><table class="data"><thead><tr><th>Person</th><th>Role</th><th>Joined</th><th></th></tr></thead><tbody>${active.map(row).join('')}</tbody></table></div></div>
  ${admin ? `<div class="panel mb"><div class="panel-head"><div><h2>Invitations</h2><p>Invited people who sign in with Google using that email get access straight away.</p></div></div>
    ${invites.length ? `<div class="table-wrap"><table class="data"><tbody>${invites.map(i => `<tr><td>${esc(i.email)}</td><td>${pill(ROLES[i.role], TONE[i.role])}</td><td class="muted">Invited by ${esc(i.invitedBy || '—')}</td><td class="right"><button class="btn sm ghost danger" data-cancel="${esc(i.email)}">Cancel</button></td></tr>`).join('')}</tbody></table></div>`
      : emptyState('No open invitations', 'Invite a colleague by email. Tell them to open this site and create an account with the same email.')}</div>` : ''}
  ${admin && removed.length ? `<div class="panel"><div class="panel-head"><h2>Removed</h2></div><div class="table-wrap"><table class="data"><tbody>${removed.map(row).join('')}</tbody></table></div></div>` : ''}`;

  $('#invite', main)?.addEventListener('click', () => openForm({
    title: 'Invite someone', submitLabel: 'Send invite',
    fields: [
      { name: 'email', label: 'Their email', type: 'email', required: true, span: true },
      { name: 'role', label: 'Role', type: 'select', options: [['member', 'Member'], ['admin', 'Admin']], span: true },
      { type: 'section', label: 'No email is sent. Share the site link and ask them to sign in with Google using this email; they get access straight away. If they sign up with a password instead, approve them under “Waiting for approval”.' }
    ],
    onSubmit: async d => {
      if (!/^\S+@\S+\.\S+$/.test(d.email)) { toast('That email address doesn’t look right.', 'err'); return; }
      await store.invite(d.email, d.role);
      toast('Invitation saved');
    }
  }));
  $$('[data-role]', main).forEach(b => b.addEventListener('click', async () => {
    const u = store.users().find(x => x.uid === b.dataset.u);
    const role = b.dataset.role;
    if (role === 'disabled' && !(await confirmDialog(`${u.name || u.email} will lose access to the workspace. Their past work stays.`, 'Remove access'))) return;
    if (role === 'admin' && !(await confirmDialog(`${u.name || u.email} will be able to delete data and manage the team.`, 'Make admin'))) return;
    store.setRole(u.uid, role);
    toast(role === 'member' ? 'Access granted' : role === 'admin' ? 'Now an admin' : 'Access removed');
  }));
  $$('[data-cancel]', main).forEach(b => b.addEventListener('click', () => store.cancelInvite(b.dataset.cancel)));
}
