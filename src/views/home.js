/**
 * Landing page (signed out) and the Desk dashboard (signed in),
 * including the daily two-minute warm-up.
 */
import { esc, binderClip, typewriter, squiggle, ORN, flameBadge, toast, errText, shuffle } from '../lib/ui.js';
import { now } from '../lib/clock.js';
import { weekRange, dayKey, msUntilReset, formatCountdown, weeksBetween, dayDate, nextWeek } from '../lib/week.js';
import { PARTS, POINTS, liveStreak, liveDayStreak, canRepair, conceptOfWeek, phraseOfWeek, promptOfWeek, warmupOfDay, FILL_PARTS } from '../lib/rules.js';
import { useRepair, completeWarmup, markCorrect, recordMistake, recordCardResult } from '../lib/session.js';

export function renderLanding(app, ctx) {
  app.innerHTML = `
  <div class="enter">
    <section class="hero">
      <div class="paper spiral hero-paper">
        <span class="label">Daily English practice</span>
        <div><span class="hand">hi, writer</span></div>
        <h1 class="display hero-title">Quiet<br>Ink</h1>
        ${squiggle()}
        <p class="lead" style="margin-top:14px">A two-minute warm-up every day, five small tasks a week: sharpen your grammar three ways, collect phrases, practise how you speak, and write a page worth keeping. Make it part of your routine.</p>
        <div class="btn-row" style="margin-top:18px">
          <button class="btn" id="land-signin">Sign in with Google</button>
          <a class="btn ghost" href="#/friends">How friends work</a>
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
          ${flameBadge(4, { label: 'Daily', rot: '-3deg' })}
          ${flameBadge(2, { label: 'Flip', rot: '2deg' })}
          ${flameBadge(7, { label: 'Page', rot: '-1deg' })}
        </div>
      </div>
    </section>

    <section class="board">
      <div class="clip-top">${binderClip()}</div>
      <div class="grid-3">
        ${partIntro('Every day', 'The Warm-Up', 'Two minutes: one gap question, one card to recall, one sentence to say better. Keeps the habit alive between the weekly tasks.')}
        ${partIntro('Part one', 'Fill the Gap', 'Three sets a week: the classic gap game, an error hunt, and building a sentence from scattered words.')}
        ${partIntro('Part two', 'Word Flip', 'Ten phrases on one theme. Choose the right meaning against a five-minute clock, then flip the card to learn it.')}
      </div>
    </section>

    <section class="board" style="margin-top:26px">
      <div class="clip-top">${binderClip()}</div>
      <div class="grid-3">
        ${partIntro('Part three', 'Phrase Library', 'One idiom or expression a week: what it means, where it came from, and how to use it properly.')}
        ${partIntro('Part four', 'Speaking Practice', 'A weekly talking point with a clear answer shape, a phrase bank and self-review — for the way you talk.')}
        ${partIntro('Part five', 'The Weekly Page', 'One shared concept for everyone. Write as much as you like, keep it on your shelf, export to Google Docs.')}
      </div>
    </section>

    <section class="band torn-both" aria-hidden="true">
      <div class="band-inner"><div class="band-giant">Write. Speak. Repeat.<span class="orn">✸ ✦ ♣</span></div></div>
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
  const D = dayKey();
  const week = S.week;
  const p = S.profile;
  const weekNo = weeksBetween(S.priv.firstWeek || W, W) + 1;

  const dayStreak = liveDayStreak(S.priv.daily, D);
  const warmupDone = week.warmups.includes(D);

  // Part 1: three sub-sections
  const fillKeys = Object.values(FILL_PARTS).map((part) => week.fill[part.key]);
  const fillDone = fillKeys.filter((s) => s.sets.length).length;
  const fillAllDone = fillDone === fillKeys.length;

  // Part 2
  const tIndex = week.flip ? week.flip.topic : S.priv.flipCompleted.length;
  const topic = data.topics[tIndex];
  const flipDone = Boolean(week.flip && week.flip.done);

  // Part 3
  const phrase = phraseOfWeek(data.phrases, W);
  const phraseDone = Boolean(week.phrases && week.phrases.read);

  // Part 4
  const speakPrompt = promptOfWeek(data.speaking, W);
  const speakDone = Boolean(week.speak && week.speak.reviewed);

  // Part 5
  const concept = conceptOfWeek(data.prompts, W);
  const pageDone = Boolean(week.page && week.page.published);

  const total = ['fill', 'flip', 'phrases', 'speak', 'page', 'warmup'].reduce((n, k) => n + (week.points[k] || 0), 0);
  const repairable = Object.keys(PARTS).filter((k) => canRepair(p, k, W));

  const card = (key, label, title, desc, status, statusCls, btn) => `
    <article class="paper part-card">
      <div class="clip-mini">${binderClip()}</div>
      <div class="part-top"><span class="label">${label}</span>${flameBadge(liveStreak(p.streaks[key], W), { rot: '3deg' })}</div>
      <h2 class="pixel-title">${esc(title)}</h2>
      <p class="grow muted">${desc}</p>
      <div class="sticker-row">
        <span class="sticker ${statusCls}">${status}</span>
        <span class="sticker ink" style="--rot:2deg">+${week.points[key] || 0} pts</span>
      </div>
      ${btn}
    </article>`;

  const warmup = warmupOfDay(D, data);

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
            <div class="streak-row"><span>Daily warm-up</span>${dayFlame(dayStreak)}<span class="muted" style="font-size:.8rem">best ${(S.priv.daily && S.priv.daily.best) || 0}</span></div>
            ${Object.entries(PARTS).map(([k, v]) => `<div class="streak-row"><span>${v.name}</span>${flameBadge(liveStreak(p.streaks[k], W), { rot: '0deg' })}<span class="muted" style="font-size:.8rem">best ${p.streaks[k].best || 0}</span></div>`).join('')}
          </div>
        </div>
      </div>
    </section>

    <section class="paper spiral warmup-card">
      <span class="tape"></span>
      <div class="warmup-head">
        <span class="label">Today's warm-up · 2 minutes</span>
        ${flameBadge(dayStreak, { label: 'Daily', rot: '2deg' })}
      </div>
      <p class="lead" style="margin:8px 0 14px">One gap question, one card to recall, one sentence to say better. That's all — the daily thread that keeps English in your routine.</p>
      <div class="btn-row">
        ${warmupDone
          ? '<span class="sticker mint">✓ Done today — come back tomorrow</span>'
          : '<button class="btn" id="warmup-start">Start today\'s warm-up</button>'}
        <span class="muted" style="font-size:.85rem;align-self:center">+${POINTS.warmup} pts a day</span>
      </div>
    </section>

    <section class="board" aria-label="This week's tasks">
      <div class="clip-top">${binderClip()}</div>
      <div class="grid-3">
        ${card('fill', 'Part one', 'Fill the Gap',
          `Three sets: Classic, Spot &amp; Fix, Build the Sentence. ${fillAllDone ? 'All three done this week.' : `${fillDone} of 3 done.`}`,
          fillAllDone ? 'All sets done' : week.fill.classic.active || week.fill.error.active || week.fill.build.active ? 'Set in progress' : 'Ready',
          fillAllDone ? 'blue' : 'mint',
          `<a class="btn" href="#/fill">${fillAllDone ? 'Review' : 'Open'}</a>`)}
        ${card('flip', `Part two / Topic ${tIndex + 1}`, 'Word Flip',
          topic ? `This week: <strong>${esc(topic.title)}</strong>. Ten cards, five minutes.` : 'You have finished every topic.',
          flipDone ? `Done: ${week.flip.score}/${week.flip.total}` : week.flip ? 'Quiz in progress' : 'Ready',
          flipDone ? 'blue' : 'lilac',
          `<a class="btn" href="#/flip">${flipDone ? 'Review cards' : 'Open'}</a>`)}
        ${card('phrases', 'Part three', 'Phrase Library',
          phrase ? `This week: <strong>${esc(phrase.title)}</strong>.` : '',
          phraseDone ? '✓ Read this week' : 'New phrase waiting',
          phraseDone ? 'blue' : 'peach',
          `<a class="btn" href="#/phrases">${phraseDone ? 'Read again' : 'Read'}</a>`)}
        ${card('speak', 'Part four', 'Speaking Practice',
          speakPrompt ? `This week: <strong>${esc(speakPrompt.title)}</strong>.` : '',
          speakDone ? '✓ Done' : week.speak && week.speak.draft ? 'Draft saved' : 'New prompt waiting',
          speakDone ? 'blue' : 'mint',
          `<a class="btn" href="#/speaking">${speakDone ? 'Read my answer' : 'Open'}</a>`)}
        ${card('page', 'Part five', 'The Weekly Page',
          concept ? `This week's concept: <strong>${esc(concept.name)}</strong>.` : '',
          pageDone ? 'Finished — on your shelf' : week.page && week.page.draft ? 'Draft saved' : 'Open',
          pageDone ? 'blue' : 'peach',
          `<a class="btn" href="#/page">${pageDone ? 'View my page' : 'Start writing'}</a>`)}
        ${`<article class="paper part-card">
            <div class="clip-mini">${binderClip()}</div>
            <div class="part-top"><span class="label">Friends</span></div>
            <h2 class="pixel-title">Writing Circle</h2>
            <p class="grow muted">Practise together: leaderboard, requests and progress.</p>
            <a class="btn ghost" href="#/friends">Open</a>
          </article>`}
      </div>
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

  const start = document.getElementById('warmup-start');
  if (start) start.addEventListener('click', () => renderWarmup(app, ctx, warmup));

  const timer = setInterval(() => {
    const el = document.getElementById('countdown');
    if (el) el.textContent = formatCountdown(msUntilReset());
  }, 30000);
  return () => clearInterval(timer);
}

function dayFlame(count) {
  return `<span class="sticker flame ${count > 0 ? 'lit' : 'cold'}" style="--rot:0deg" title="daily streak">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 3.5-1.5 5-1.5 7.5 0 1.4 1 2.5 2.3 2.5 1.6 0 2.4-1.3 2.2-3 2.3 1.7 3.5 4.2 3.5 6.5A6.5 6.5 0 0 1 12 22a6.5 6.5 0 0 1-6.5-6.5C5.5 10.5 12 7.5 12 2z"/></svg>
    <b>${count}</b><span>${count === 1 ? 'day' : 'days'}</span>
  </span>`;
}

/* ------------------------------------------------------------------ Warm-up flow */
function renderWarmup(app, ctx, warmup) {
  const { S, data } = ctx;
  const steps = [];
  if (warmup.gap) steps.push({ type: 'gap', item: warmup.gap });
  if (warmup.card) steps.push({ type: 'card', item: warmup.card });
  if (warmup.rewrite) steps.push({ type: 'rewrite', item: warmup.rewrite });
  if (!steps.length) {
    app.innerHTML = '<div class="paper notice"><p class="pixel-title">Warm-up not ready</p><p>Finish a Word Flip topic first, or check the content files.</p></div>';
    return;
  }
  let i = 0;

  const paint = () => {
    const step = steps[i];
    const label = `Warm-up · step ${i + 1} of ${steps.length}`;
    if (step.type === 'gap') return paintGap(step.item, label);
    if (step.type === 'card') return paintCard(step.item, label);
    return paintRewrite(step.item, label);
  };

  const finish = async () => {
    try {
      const awarded = await completeWarmup(POINTS.warmup);
      toast(awarded ? `Warm-up done: +${POINTS.warmup} pts. Day streak: ${(S.priv.daily.current) || 1}.` : 'Warm-up already recorded today.');
    } catch (err) { toast(errText(err)); }
    // The warm-up renders in-place on the #/ route, so re-render instead of
    // navigating (the hash is already #/ and would not fire a hashchange).
    ctx.rerender();
  };

  const nextStep = () => {
    i += 1;
    if (i < steps.length) paint();
    else finish();
  };

  function paintGap(q, label) {
    const opts = shuffle(q.options);
    app.innerHTML = `
    <div class="question-page enter">
      <header class="page-head compact"><span class="label">${label}</span><span class="sticker lilac">Quick gap</span></header>
      <section class="paper spiral">
        <p class="q-sentence">${esc(q.sentence).replace(/____/g, '<span class="blank" id="blank">&nbsp;?&nbsp;</span>')}</p>
        <div class="options">
          ${opts.map((opt, k) => `<button class="option" data-opt="${esc(opt)}" style="--rot:${['-1.2deg', '0.9deg', '-0.7deg', '0.6deg'][k % 4]}"><span class="key">${'ABCD'[k]}</span><span class="opt-text">${esc(opt)}</span><span class="mark"></span></button>`).join('')}
        </div>
        <div id="feedback" aria-live="polite"></div>
      </section>
    </div>`;
    const buttons = Array.from(app.querySelectorAll('.option'));
    buttons.forEach((b) => b.addEventListener('click', async () => {
      const correct = b.dataset.opt === q.answer;
      buttons.forEach((x) => {
        x.disabled = true;
        if (x.dataset.opt === q.answer) { x.classList.add('correct'); x.querySelector('.mark').textContent = '✓'; }
        else if (x === b) { x.classList.add('wrong'); x.querySelector('.mark').textContent = '✕'; }
        else x.classList.add('faded');
      });
      const blank = document.getElementById('blank');
      if (blank) { blank.textContent = q.answer; blank.classList.add(correct ? 'right' : 'wrong'); }
      try {
        if (correct) await markCorrect(q.id);
        else await recordMistake(q.id, b.dataset.opt);
      } catch (e) { /* non-fatal */ }
      document.getElementById('feedback').innerHTML = `
        <div class="explain lined ${correct ? 'good' : 'bad'}">
          <span class="hand ${correct ? '' : 'red'}">${correct ? '✓ Correct!' : '✕ The green one is right.'}</span>
          <p style="margin:0">${esc(q.explanation)}</p>
          <div class="btn-row" style="margin-top:14px"><button class="btn" id="next">Next</button></div>
        </div>`;
      document.getElementById('next').addEventListener('click', nextStep);
    }));
  }

  function paintCard(card, label) {
    const topicIndex = Math.max(0, (S.priv.flipCompleted || []).slice(-1)[0] || 0);
    app.innerHTML = `
    <div class="question-page enter">
      <header class="page-head compact"><span class="label">${label}</span><span class="sticker mint">Card recall</span></header>
      <section class="paper spiral" style="text-align:center">
        <p class="lead" style="margin:10px 0">What does <strong>${esc(card.term)}</strong> mean?</p>
        <div class="meaning-options" style="justify-content:center">
          <button class="btn" id="reveal">Flip the card</button>
        </div>
        <div id="feedback" aria-live="polite"></div>
      </section>
    </div>`;
    document.getElementById('reveal').addEventListener('click', async () => {
      // Self-graded: did you know it?
      app.querySelector('#feedback').innerHTML = `
        <div class="explain lined good" style="text-align:left">
          <p class="serif" style="font-size:1.15rem;margin:0 0 6px"><strong>${esc(card.term)}</strong> — ${esc(card.meaning)}</p>
          ${card.examples.map((ex) => `<p class="hand" style="font-size:1.2rem;margin:4px 0">${esc(ex)}</p>`).join('')}
          <p style="margin:10px 0 0">Did you know it before flipping?</p>
          <div class="btn-row" style="margin-top:10px">
            <button class="btn small" id="knew">Yes, I knew it</button>
            <button class="btn ghost small" id="didnt">Not really</button>
          </div>
        </div>`;
      const record = async (knew) => {
        try { await recordCardResult(topicIndex, card._index || 0, knew); } catch (e) { /* non-fatal */ }
        nextStep();
      };
      document.getElementById('knew').addEventListener('click', () => record(true));
      document.getElementById('didnt').addEventListener('click', () => record(false));
    });
  }

  function paintRewrite(drill, label) {
    app.innerHTML = `
    <div class="question-page enter">
      <header class="page-head compact"><span class="label">${label}</span><span class="sticker peach">Say it better</span></header>
      <section class="paper spiral">
        <p class="lead" style="margin:10px 0">Rewrite this casually-spoken sentence in clearer, more polished English:</p>
        <p class="q-sentence wrong-sentence" style="font-size:1.2rem">"${esc(drill.informal)}"</p>
        <textarea id="rw" class="editor lined" rows="3" placeholder="Type your improved version..." style="min-height:90px"></textarea>
        <div class="btn-row" style="margin-top:14px">
          <button class="btn" id="check">Check my version</button>
        </div>
        <div id="feedback" aria-live="polite"></div>
      </section>
    </div>`;
    document.getElementById('check').addEventListener('click', () => {
      const val = document.getElementById('rw').value.trim();
      if (!val) { toast('Type your version first.'); return; }
      document.getElementById('feedback').innerHTML = `
        <div class="explain lined good">
          <span class="hand">A polished version</span>
          <p class="serif" style="font-size:1.1rem;margin:6px 0">"${esc(drill.formal)}"</p>
          <p style="margin:0"><strong>Focus:</strong> ${esc(drill.focus)}</p>
          <p class="muted" style="margin:8px 0 0;font-size:.9rem">Compare it with yours. No score here — noticing the difference is the exercise.</p>
          <div class="btn-row" style="margin-top:14px"><button class="btn" id="next">Finish warm-up</button></div>
        </div>`;
      document.getElementById('next').addEventListener('click', nextStep);
    });
  }

  paint();
}
