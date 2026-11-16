/**
 * Friends: requests, friend list, leaderboard, finding writers and blocked users.
 */
import { esc, toast, errText, avatarHtml, flameBadge } from '../lib/ui.js';
import { PARTS, liveStreak } from '../lib/rules.js';
import { reconcileFriends } from '../lib/session.js';
import {
  incomingRequests, outgoingRequests, acceptRequest, declineRequest, cancelRequest,
  profiles, findUsers, sendRequest, unblockUser
} from '../lib/friends.js';

export async function renderFriends(app, ctx) {
  const { S } = ctx;
  const W = S.weekKey;
  app.innerHTML = `
  <div class="enter">
    <header class="page-head">
      <span class="label">Friends</span>
      <h1 class="pixel-title">The Writing Circle</h1>
      <span class="hand">practise together</span>
    </header>
    <div id="fbody"><p class="on-cloth">Loading...</p></div>
  </div>`;

  let incoming = [];
  let outgoing = [];
  let friends = [];
  try {
    const ids = await reconcileFriends();
    [incoming, outgoing, friends] = await Promise.all([incomingRequests(), outgoingRequests(), profiles(ids)]);
  } catch (err) {
    document.getElementById('fbody').innerHTML = `<div class="paper notice"><p>${esc(errText(err))}</p></div>`;
    return;
  }
  const blocked = S.priv.blocked.length ? await profiles(S.priv.blocked) : [];

  const weekPts = (u) => (u.weekPoints && u.weekPoints.week === W ? u.weekPoints.value : 0);
  const board = [{ uid: S.user.uid, ...S.profile }, ...friends];
  const byWeek = board.slice().sort((a, b) => weekPts(b) - weekPts(a));
  const byAll = board.slice().sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));

  const boardHtml = (rows, valueFn) => `<ol class="leaderboard">${rows.map((u, i) => `
    <li class="${u.uid === S.user.uid ? 'me' : ''}">
      <span class="rank">${i + 1}</span>
      <a class="byline-author" href="#/@${esc(u.nickname)}">${avatarHtml(u, 30)}<span>${esc(u.nickname)}${u.uid === S.user.uid ? ' (you)' : ''}</span></a>
      <span class="pts">${valueFn(u)} pts</span>
    </li>`).join('')}</ol>`;

  document.getElementById('fbody').innerHTML = `
    ${incoming.length ? `
    <section class="paper plain" style="margin-bottom:24px">
      <span class="tape"></span>
      <span class="label">Friend requests (${incoming.length})</span>
      <div class="stack" style="margin-top:12px;gap:12px">
        ${incoming.map((r) => `<div class="person-line">
          <a class="byline-author" href="#/@${esc(r.fromNick)}">${avatarHtml({ avatar: r.fromAvatar, photoURL: r.fromPhoto }, 32)}<span>${esc(r.fromNick)}</span></a>
          <span class="btn-row"><button class="btn small" data-accept="${esc(r.from)}">Accept</button><button class="btn ghost small" data-decline="${esc(r.from)}">Decline</button></span>
        </div>`).join('')}
      </div>
    </section>` : ''}

    <div class="grid-2" style="align-items:start">
      <section class="paper spiral">
        <span class="label">Leaderboard</span>
        <nav class="tabs small" role="tablist">
          <button class="tab on" data-board="week" role="tab">This week</button>
          <button class="tab" data-board="all" role="tab">All time</button>
        </nav>
        <div id="board-week">${boardHtml(byWeek, weekPts)}</div>
        <div id="board-all" hidden>${boardHtml(byAll, (u) => u.totalPoints || 0)}</div>
      </section>

      <section class="paper plain">
        <span class="label">Find writers</span>
        <form id="find" class="search-inline" role="search">
          <label class="visually-hidden" for="fq">Nickname</label>
          <input id="fq" placeholder="Search by nickname" autocomplete="off">
          <button class="btn small" type="submit">Search</button>
        </form>
        <div id="found"></div>
        ${outgoing.length ? `<span class="label" style="display:block;margin-top:18px">Sent requests</span>
        ${outgoing.map((r) => `<div class="person-line"><a href="#/@${esc(r.toNick)}">${esc(r.toNick)}</a><button class="btn ghost small" data-cancel="${esc(r.to)}">Cancel</button></div>`).join('')}` : ''}
      </section>
    </div>

    <section class="paper plain" style="margin-top:24px">
      <span class="label">My friends (${friends.length})</span>
      ${friends.length ? `<div class="friend-grid">${friends.map((u) => `
        <a class="friend-card" href="#/@${esc(u.nickname)}">
          ${avatarHtml(u, 48)}
          <strong>${esc(u.nickname)}</strong>
          <span class="muted" style="font-size:.8rem">${weekPts(u)} pts this week</span>
          <span class="mini-flames">${Object.keys(PARTS).map((k) => flameBadge(liveStreak(u.streaks && u.streaks[k], W), { label: PARTS[k].short, rot: '0deg' })).join('')}</span>
        </a>`).join('')}</div>` : '<p class="muted" style="margin-top:8px">No friends yet. Search for a classmate\'s nickname to send a request.</p>'}
    </section>

    ${blocked.length ? `<section class="paper plain" style="margin-top:24px">
      <span class="label">Blocked</span>
      ${blocked.map((u) => `<div class="person-line"><span>${esc(u.nickname)}</span><button class="btn ghost small" data-unblock="${esc(u.uid)}">Unblock</button></div>`).join('')}
    </section>` : ''}`;

  const act = async (fn, msg) => {
    try { await fn(); toast(msg); ctx.rerender(); } catch (err) { toast(errText(err)); }
  };
  app.querySelectorAll('[data-accept]').forEach((b) => b.addEventListener('click', () => act(() => acceptRequest(b.dataset.accept), 'You are now friends.')));
  app.querySelectorAll('[data-decline]').forEach((b) => b.addEventListener('click', () => act(() => declineRequest(b.dataset.decline), 'Request declined.')));
  app.querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => act(() => cancelRequest(b.dataset.cancel), 'Request cancelled.')));
  app.querySelectorAll('[data-unblock]').forEach((b) => b.addEventListener('click', () => act(() => unblockUser(b.dataset.unblock), 'Unblocked.')));

  app.querySelectorAll('[data-board]').forEach((b) => b.addEventListener('click', () => {
    app.querySelectorAll('[data-board]').forEach((x) => x.classList.toggle('on', x === b));
    document.getElementById('board-week').hidden = b.dataset.board !== 'week';
    document.getElementById('board-all').hidden = b.dataset.board !== 'all';
  }));

  document.getElementById('find').addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = document.getElementById('found');
    out.innerHTML = '<p class="muted">Searching...</p>';
    try {
      const users = (await findUsers(document.getElementById('fq').value)).filter((u) => u.uid !== S.user.uid);
      const friendSet = new Set(friends.map((f) => f.uid));
      const sentSet = new Set(outgoing.map((r) => r.to));
      out.innerHTML = users.length ? users.map((u) => `
        <div class="person-line">
          <a class="byline-author" href="#/@${esc(u.nickname)}">${avatarHtml(u, 30)}<span>${esc(u.nickname)}</span></a>
          ${friendSet.has(u.uid) ? '<span class="sticker mint">Friends</span>' : sentSet.has(u.uid) ? '<span class="sticker lilac">Sent</span>' : `<button class="btn small" data-add="${esc(u.uid)}">Add friend</button>`}
        </div>`).join('') : '<p class="muted">No writers found. Nicknames need at least 2 letters to search.</p>';
      out.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
        const u = users.find((x) => x.uid === b.dataset.add);
        act(async () => { await sendRequest(u); }, 'Friend request sent.');
      }));
    } catch (err) { out.innerHTML = `<p class="muted">${esc(errText(err))}</p>`; }
  });
}
