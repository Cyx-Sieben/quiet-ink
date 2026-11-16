/**
 * Static pages: privacy note, community guidelines, and the "finish setup" screen.
 */

export function renderPrivacy(app) {
  app.innerHTML = `
  <article class="reader paper plain enter">
    <span class="label">Privacy</span>
    <h1 class="reader-title">Privacy note</h1>
    <div class="reader-body">
      <p><strong>What we store.</strong> When you sign in with Google, Quiet Ink receives your Google account ID and, if you choose it as your avatar, your Google profile photo. Your email address is used only by Google sign-in and is never shown to other people or saved in the Quiet Ink database.</p>
      <p><strong>What you add.</strong> Your nickname, bio, avatar, scores, streaks, mistakes, drafts, published pages, comments, likes and friend list are saved in a Google Firebase database so they follow you across devices.</p>
      <p><strong>Who can see it.</strong> Your nickname, avatar, bio, points and streaks are public. Each page you publish can be public, friends only, or private. Drafts, mistakes and other progress are visible only to you.</p>
      <p><strong>Your control.</strong> You can change your profile, change the visibility of any page, delete pages, download all your data, or delete your account and everything in it from Settings.</p>
      <p><strong>Outside links.</strong> The Newsstand links to other websites, which have their own privacy policies.</p>
    </div>
  </article>`;
}

export function renderGuidelines(app) {
  app.innerHTML = `
  <article class="reader paper plain enter">
    <span class="label">Community</span>
    <h1 class="reader-title">Community guidelines</h1>
    <div class="reader-body">
      <p>Quiet Ink is a place to practise writing. Everyone here is learning, so please keep it kind and honest.</p>
      <p><strong>Write your own words.</strong> Do not publish text copied from other people, books or websites, or text written for you by someone else.</p>
      <p><strong>Be kind in comments.</strong> Give feedback on the writing, not the person. No insults, bullying or harassment.</p>
      <p><strong>Keep it safe.</strong> No hateful, violent or sexual content, no spam or advertising, and no sharing of anyone's private information.</p>
      <p><strong>Use the tools.</strong> If something breaks these rules, use Report. You can also block anyone you do not want to hear from.</p>
      <p>Content that breaks these guidelines may be removed by moderators.</p>
    </div>
  </article>`;
}

export function renderSetupNeeded(app) {
  app.innerHTML = `
  <div class="paper spiral enter" style="max-width:760px;margin:0 auto">
    <span class="hand red">one more step</span>
    <h1 class="pixel-title" style="margin:8px 0">Connect Firebase</h1>
    <p class="lead">Quiet Ink needs a Firebase project for sign-in and saving progress.</p>
    <ol>
      <li>Follow <strong>SETUP.md</strong> to create a free Firebase project and turn on Google sign-in and Firestore.</li>
      <li>Paste your web app settings into <code>src/firebase-config.js</code>.</li>
      <li>Push the change to GitHub; Vercel will redeploy automatically.</li>
    </ol>
    <p class="muted">Just want to look around first? On your computer, run <code>npm run dev:mock</code> to try the app with fake, offline data.</p>
  </div>`;
}
