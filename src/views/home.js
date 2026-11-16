/**
 * Landing page (signed out) and the Desk dashboard (signed in).
 */
import { esc, binderClip, typewriter, squiggle, ORN, flameBadge, toast, errText } from '../lib/ui.js';
import { weekRange, msUntilReset, formatCountdown, weeksBetween } from '../lib/week.js';
import { SETS_PER_WEEK, PARTS, liveStreak, canRepair, conceptOfWeek } from '../lib/rules.js';
import { useRepair } from '../lib/session.js';

export function renderLanding(app, ctx) {
  app.innerHTML = `
  <div class="enter">
    <section class="hero">
      <div class="paper spiral hero-paper">
        <span class="label">Weekly English practice</span>
        <div><span class="hand">hi, writer</span></div>
        <h1 class="display hero-title">Quiet<br>Ink</h1>
        ${squiggle()}
        <p class="lead" style="margin-top:14px">Three small tasks a week: choose the right word, learn ten new phrases, and write a page worth sharing. Keep a streak for each one, and practise with friends.</p>
        <div class="btn-row" style="margin-top:18px">
          <button class="btn" id="land-signin">Sign in with Google</button>
          <a class="btn ghost" href="#/read">Browse the Reading Room</a>
        </div>
      </div>
      <div class="hero-side">
        <div class="paper plain quote-card">
          <span class="tape"></span>
          <blockquote>The difference between the almost right word and the right word is really a large matter.</blockquote>
          <cite class="label">Mark Twain, letter to George Bainton, 1888</cite>
          ${typewriter()}
        </div>
        <div class="sticker-row">
          ${flameBadge(4, { label: 'Fill', rot: '-3deg' })}
          ${flameBadge(2, { label: 'Flip', rot: '2deg' })}
          ${flameBadge(7, { label: 'Page', rot: '-1deg' })}
        </div>
      </div>
    </section>

    <section class="board">
      <div class="clip-top">${binderClip()}</div>
      <div class="grid-3">
        ${partIntro('Part one', 'Fill the Gap', 'Five sets of five sentences each week. Two minutes per question. Pick the word that makes the sentence right.')}
        ${partIntro('Part two', 'Word Flip', 'Ten phrases on one theme. Choose the right meaning against a five-minute clock, then flip the card to learn it.')}
        ${partIntro('Part three', 'The Weekly Page', 'One shared concept for everyone. Write as much as you like and publish it to your profile.')}
      </div>
    </section>

    <section class="band torn-both" aria-hidden="true">
      <div class="band-inner"><div class="band-giant">Read. Write. Repeat.<span class="orn">✸ ✦ ♣</span></div></div>
    </section>
  </div>`;
  document.getElementById('land-signin').addEventListener('click', ctx.signIn);
}

function partIntro(label, title, text) {
  return `<article class="paper part-card">
    <div class="clip-mini">${binderClip()}</div>
    <span class="label">${label}</span>
    <h2 class="pixel-title">${title}</h2>
    <p class="grow muted">${text}</p>
  </article>`;
}

export function renderDashboard(app, ctx) {
  const { S, data } = ctx;
  const W = S.weekKey;
  const week = S.week;
  const p = S.profile;
  const weekNo = weeksBetween(S.priv.firstWeek || W, W) + 1;

  // Part 1
  const setsDone = week.fill.sets.length;
  const fillDone = setsDone >= SETS_PER_WEEK;
  const dots = Array.from({ length: SETS_PER_WEEK }, (_, i) => `<span class="dot ${i < setsDone ? 'on' : ''}"></span>`).join('');

  // Part 2
  const tIndex = week.flip ? week.flip.topic : S.priv.flipCompleted.length;
  const topic = data.topics[tIndex];
  const flipDone = Boolean(week.flip && week.flip.done);

  // Part 3
  const concept = conceptOfWeek(data.prompts, W);
  const pageDone = Boolean(week.page && week.page.published);

  const total = week.points.fill + week.points.flip + week.points.page;
  const repairable = Object.keys(PARTS).filter((k) => canRepair(p, k, W));

  const card = (key, label, title, desc, status, statusCls, extra, btn) => `
    <article class="paper part-card">
      <div class="clip-mini">${binderClip()}</div>
      <div class="part-top"><span class="label">${label}</span>${flameBadge(liveStreak(p.streaks[key], W), { rot: '3deg' })}</div>
      <h2 class="pixel-title">${esc(title)}</h2>
      <p class="grow muted">${desc}</p>
      ${extra || ''}
      <div class="sticker-row">
        <span class="sticker ${statusCls}">${status}</span>
        <span class="sticker ink" style="--rot:2deg">+${week.points[key]} pts</span>
      </div>
      ${btn}
    </article>`;

  app.innerHTML = `
  <div class="enter">
    ${repairable.length ? `
    <section class="paper plain repair-note">
      <span class="tape red"></span>
      <span class="label">Streak broken</span>
      <p style="margin:6px 0 12px">You missed last week for <strong>${repairable.map((k) => PARTS[k].name).join(' and ')}</strong>. You have <strong>one streak repair for your whole account</strong>. Using it keeps that streak alive (last week still earns no points). It is available until Sunday 23:59.</p>
      <div class="btn-row">${repairable.map((k) => `<button class="btn danger small" data-repair="${k}">Repair ${PARTS[k].name} (${p.streaks[k].current} weeks)</button>`).join('')}</div>
    </section>` : ''}

    <section class="hero">
      <div class="paper spiral hero-paper">
        <span class="label">Week ${weekNo} &nbsp;/&nbsp; ${esc(weekRange(W))}</span>
        <div><span class="hand">hi, ${esc(p.nickname)}</span></div>
        <h1 class="display hero-title">Your<br>Desk</h1>
        ${squiggle()}
        <div class="sticker-row" style="margin-top:16px">
          <span class="sticker blue">✦ ${total} pts this week</span>
          <span class="sticker peach" style="--rot:2deg">${p.totalPoints || 0} pts all time</span>
          <span class="sticker ${p.repairUsed ? 'ink' : 'mint'}" style="--rot:-1deg">${p.repairUsed ? 'Streak repair used' : '1 streak repair left'}</span>
        </div>
        <p style="margin-top:16px">${ORN}</p>
      </div>
      <div class="hero-side">
        <div>
          <div class="countdown-note torn-bottom">
            <span class="label">Next reset</span>
            <div class="count" id="countdown">${formatCountdown(msUntilReset())}</div>
            <span class="hand">Monday, 00:00</span>
          </div>
        </div>
        <div class="paper plain">
          <span class="label">Your streaks</span>
          <div class="streak-list">
            ${Object.entries(PARTS).map(([k, v]) => `<div class="streak-row"><span>${v.name}</span>${flameBadge(liveStreak(p.streaks[k], W), { rot: '0deg' })}<span class="muted" style="font-size:.8rem">best ${p.streaks[k].best || 0}</span></div>`).join('')}
          </div>
        </div>
      </div>
    </section>

    <section class="board" aria-label="This week's tasks">
      <div class="clip-top">${binderClip()}</div>
      <div class="grid-3">
        ${card('fill', 'Part one', 'Fill the Gap',
          'Five sets of five questions. Two minutes per question.',
          fillDone ? 'All sets done' : week.fill.active ? 'Set in progress' : `${setsDone} of ${SETS_PER_WEEK} sets`,
          fillDone ? 'blue' : 'mint',
          `<div class="dots" aria-label="${setsDone} of 5 sets done">${dots}</div>`,
          `<a class="btn" href="#/fill">${fillDone ? 'Review' : week.fill.active ? 'Resume set' : 'Open'}</a>`)}
        ${card('flip', `Part two / Topic ${tIndex + 1}`, 'Word Flip',
          topic ? `This week: <strong>${esc(topic.title)}</strong>. Ten cards, five minutes.` : 'You have finished every topic.',
          flipDone ? `Done: ${week.flip.score}/${week.flip.total}` : week.flip ? 'Quiz in progress' : 'Ready',
          flipDone ? 'blue' : 'lilac', '',
          `<a class="btn" href="#/flip">${flipDone ? 'Review cards' : 'Open'}</a>`)}
        ${card('page', 'Part three', 'The Weekly Page',
          concept ? `This week's concept: <strong>${esc(concept.name)}</strong>.` : '',
          pageDone ? 'Published' : week.page && week.page.draft ? 'Draft saved' : 'Open',
          pageDone ? 'blue' : 'peach', '',
          `<a class="btn" href="#/page">${pageDone ? 'View my page' : 'Start writing'}</a>`)}
      </div>
    </section>

    <section class="grid-2" style="margin-top:30px">
      <a class="paper plain link-card" href="#/read"><span class="label">Community</span><span class="pixel-title" style="font-size:1.6rem">Reading Room</span><span class="muted">Read this week's pages from other writers.</span></a>
      <a class="paper plain link-card" href="#/friends"><span class="label">Friends</span><span class="pixel-title" style="font-size:1.6rem">Leaderboard</span><span class="muted">See how your friends are doing this week.</span></a>
    </section>
  </div>`;

  app.querySelectorAll('[data-repair]').forEach((b) => {
    b.addEventListener('click', async () => {
      const part = b.dataset.repair;
      if (!window.confirm(`Use your only streak repair on ${PARTS[part].name}? You cannot get it back.`)) return;
      try {
        await useRepair(part);
        toast('Streak repaired. Complete this week to keep it going.');
        ctx.rerender();
      } catch (err) { toast(errText(err)); }
    });
  });

  const timer = setInterval(() => {
    const el = document.getElementById('countdown');
    if (el) el.textContent = formatCountdown(msUntilReset());
  }, 30000);
  return () => clearInterval(timer);
}
