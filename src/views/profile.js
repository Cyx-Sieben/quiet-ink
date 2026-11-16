/**
 * Public profile: a writer's ID badge, their streaks and their published pages.
 */
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';
import { esc, toast, errText, avatarHtml, flameBadge } from '../lib/ui.js';
import { weekKey, stamp } from '../lib/week.js';
import { PARTS, liveStreak } from '../lib/rules.js';
import { statusWith, sendRequest, cancelRequest, acceptRequest, declineRequest, removeFriend, blockUser, unblockUser } from '../lib/friends.js';
import { pieceCard } from './read.js';

export async function renderProfile(app, ctx, nick) {
  const { S } = ctx;
  const W = S.weekKey || weekKey();
  let user;
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('nicknameLower', '==', nick.toLowerCase()), limit(1)));
    if (snap.empty) throw new Error('none');
    user = { uid: snap.docs[0].id, ...snap.docs[0].data() };
  } catch (err) {
    app.innerHTML = '<div class="paper notice"><p class="pixel-title">Writer not found</p><p><a href="#/read">Back to the Reading Room</a></p></div>';
    return;
  }
  const me = S.user && S.profile ? S.user.uid : null;
  const mine = me === user.uid;
  const status = me ? await statusWith(user.uid) : 'none';
  const weekPts = user.weekPoints && user.weekPoints.week === W ? user.weekPoints.value : 0;

  app.innerHTML = `
  <div class="enter">
    <section class="profile-head">
      <div class="lanyard profile-lanyard">
        <div class="strap"></div>
        <div class="badge-clip"></div>
        <div class="id-badge paper plain">
          <span class="label">Quiet Ink writer</span>
          <div class="id-avatar">${avatarHtml(user, 96)}</div>
          <h1 class="pixel-title">${esc(user.nickname)}</h1>
          ${user.bio ? `<p class="serif id-bio">${esc(user.bio)}</p>` : ''}
          <span class="muted" style="font-size:.8rem">Joined ${esc(stamp(user.createdAt))}</span>
          <div class="sticker-row" style="justify-content:center;margin-top:12px">
            <span class="sticker blue">${user.totalPoints || 0} pts</span>
            <span class="sticker peach" style="--rot:2deg">${weekPts} this week</span>
          </div>
        </div>
      </div>
      <div class="paper plain profile-side">
        <span class="label">Weekly streaks</span>
        <div class="streak-list">
          ${Object.entries(PARTS).map(([k, v]) => `<div class="streak-row"><span>${v.name}</span>${flameBadge(liveStreak(user.streaks && user.streaks[k], W), { rot: '0deg' })}<span class="muted" style="font-size:.8rem">best ${(user.streaks && user.streaks[k] && user.streaks[k].best) || 0}</span></div>`).join('')}
        </div>
        <div class="btn-row" id="actions" style="margin-top:18px">${actionButtons(status, mine, Boolean(me))}</div>
      </div>
    </section>
    <div class="reading-column">
      <h2 class="label on-cloth section-label">${mine ? 'My pages' : `Pages by ${esc(user.nickname)}`}</h2>
      <div id="plist"><p class="on-cloth">Loading...</p></div>
    </div>
  </div>`;

  wireActions(app, ctx, user);

  try {
    let items = [];
    const col = collection(db, 'pieces');
    if (mine) {
      items = (await getDocs(query(col, where('uid', '==', user.uid), orderBy('createdAt', 'desc'), limit(100)))).docs;
    } else {
      const pub = await getDocs(query(col, where('uid', '==', user.uid), where('visibility', '==', 'public'), orderBy('createdAt', 'desc'), limit(100)));
      items = pub.docs;
      if (status === 'friends') {
        const fr = await getDocs(query(col, where('friendIds', 'array-contains', me), where('uid', '==', user.uid), where('visibility', '==', 'friends'), orderBy('createdAt', 'desc'), limit(100)));
        items = items.concat(fr.docs);
      }
    }
    const pieces = items.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0));
    document.getElementById('plist').innerHTML = pieces.length
      ? `<div class="piece-list">${pieces.map((p) => pieceCard(p, { showAuthor: false })).join('')}</div>`
      : '<div class="paper plain notice"><span class="hand">no pages yet</span></div>';
  } catch (err) {
    document.getElementById('plist').innerHTML = `<div class="paper plain notice"><p>${esc(errText(err))}</p></div>`;
  }
}

function actionButtons(status, mine, signedIn) {
  if (mine) return '<a class="btn ghost small" href="#/settings">Edit profile</a>';
  if (!signedIn) return '<span class="muted">Sign in to add this writer as a friend.</span>';
  switch (status) {
    case 'friends': return '<span class="sticker mint">✓ Friends</span><button class="btn ghost small" data-act="remove">Remove friend</button><button class="btn ghost small" data-act="block">Block</button>';
    case 'sent': return '<span class="sticker lilac">Request sent</span><button class="btn ghost small" data-act="cancel">Cancel request</button>';
    case 'received': return '<button class="btn small" data-act="accept">Accept friend request</button><button class="btn ghost small" data-act="decline">Decline</button>';
    case 'blocked': return '<span class="sticker red">Blocked</span><button class="btn ghost small" data-act="unblock">Unblock</button>';
    default: return '<button class="btn small" data-act="add">Add friend</button><button class="btn ghost small" data-act="block">Block</button>';
  }
}

function wireActions(app, ctx, user) {
  app.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
    const act = b.dataset.act;
    try {
      if (act === 'add') { const r = await sendRequest(user); toast(r === 'friends' ? 'You are now friends.' : 'Friend request sent.'); }
      if (act === 'cancel') { await cancelRequest(user.uid); toast('Request cancelled.'); }
      if (act === 'accept') { await acceptRequest(user.uid); toast('You are now friends.'); }
      if (act === 'decline') { await declineRequest(user.uid); toast('Request declined.'); }
      if (act === 'remove') {
        if (!window.confirm(`Remove ${user.nickname} from your friends?`)) return;
        await removeFriend(user.uid); toast('Friend removed.');
      }
      if (act === 'block') {
        if (!window.confirm(`Block ${user.nickname}? They will not be able to send you requests, and you will not see their pages or comments.`)) return;
        await blockUser(user.uid); toast('Blocked.');
      }
      if (act === 'unblock') { await unblockUser(user.uid); toast('Unblocked.'); }
      ctx.rerender();
    } catch (err) { toast(errText(err)); }
  }));
}
