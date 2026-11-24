# Quiet Ink Version 3: step-by-step setup

This guide sets up **Version 3** of your repository **cyx-sieben/quiet-ink** — the
personal daily-habit redesign: daily warm-up, three-part Fill the Gap, Phrase
Library, Speaking Practice, private writings with Google Docs export, and profile
picture uploads. The Reading Room, Newsstand, reports and admin page are gone.

If you already run Version 2 (Firebase project + Vercel), only the short
**"Upgrading from Version 2"** section below is new for you.

> Everything happens inside the `quiet-ink` repository and your existing Firebase
> and Vercel accounts. No new accounts are needed.

---

## Upgrading from Version 2 (10 minutes)

1. Get the Version 3 code (branch `v3-redesign`):
   ```bash
   git fetch origin
   git checkout v3-redesign
   ```
2. **Deploy the updated rules** — they are much simpler now (no pieces, reports,
   admins, likes or comments):
   ```bash
   npm install
   npm run deploy:rules
   ```
3. Run `npm run dev` and click through: sign in, do the warm-up, a Fill set, the
   Phrase Library, a Speaking draft, finish a page, try "Save to Google Docs".
   The first Docs export asks Google for permission once (a pop-up) — that is the
   `documents` scope at work.
4. When you are happy, merge the branch into `main` and push; Vercel redeploys
   automatically.

Old Reading Room pieces stay in the `pieces` collection in Firestore (nothing
deletes your old data), but the app no longer reads them. Delete the collection
in the console if you want a clean slate. Old week records keep working: the app
migrates the old Fill shape on the fly.

---

## First-time setup (from scratch)

Follow Parts 1–8 of the original guide: install Node.js, Git and VS Code; clone
https://github.com/cyx-sieben/quiet-ink.git; `npm install`; create the Firebase
project with Google sign-in and Firestore in `asia-southeast1`; paste the six
config values into `src/firebase-config.js`; set the project id in `.firebaserc`;
run `npx firebase login` and `npm run deploy:rules`; test with `npm run dev`;
push to GitHub and import the repo into Vercel (Vite is auto-detected); finally
add your Vercel domain to Firebase → Authentication → Settings → Authorized domains.

Try the app before any Firebase setup with:

```bash
npm run dev:mock
```

Open http://localhost:5173. "Sign in with Google" will ask for any name; it creates
a test user that only exists in your browser. Sign in as two different names to
try friends. In mock mode, the Google Docs export falls back to a .docx download.

The folder should look like this:

```
quiet-ink/
├── mock/                     offline fake Firebase for testing
├── public/                   data files, icons, manifest, service worker
│   └── data/                 8 content JSON files (questions, topics, phrases, prompts...)
├── src/                      the app: main.js, styles.css, lib/, views/
├── firestore.rules           database security rules
├── firestore.indexes.json    database indexes (none needed in v3)
├── firebase.json  .firebaserc
├── index.html  package.json  vite.config.js  vercel.json
├── README.md  SETUP.md
└── .gitignore
```

---

## Everyday changes

| I want to... | Do this |
|---|---|
| Add gap questions | Edit `public/data/grammar_questions.json`, then commit and push |
| Add Spot & Fix questions | Edit `public/data/error_questions.json` |
| Add Build drills | Edit `public/data/sentence_build.json` |
| Add flashcards | Edit `public/data/flashcard_topics.json` |
| Add phrase entries | Edit `public/data/phrases.json` |
| Add speaking prompts | Edit `public/data/speaking_prompts.json` |
| Add warm-up rewrites | Edit `public/data/rewrite_drills.json` |
| Add writing concepts | Edit `public/data/writing_prompts.json` |
| Change points or timers | Edit the numbers at the top of `src/lib/rules.js` |
| Change security rules | Edit `firestore.rules`, then run `npm run deploy:rules` |

---

## Troubleshooting

- **"Connect Firebase" page appears.** `src/firebase-config.js` still contains `PASTE_...`. Fill it in, then commit and push.
- **Sign-in popup closes with "unauthorized domain".** Add the site address in Firebase → Authentication → Settings → Authorized domains.
- **"You do not have permission to do that."** The rules were not uploaded or are out of date. Run `npm run deploy:rules`.
- **Google Docs export fails.** It needs a real (non-mock) sign-in, and the pop-up must not be blocked. Re-run it; the app re-authenticates and retries. A .docx download always works as a fallback.
- **`npm` is not recognised.** Restart VS Code (or the computer) after installing Node.js.
- **Git push is rejected.** Run `git pull` first, then `git push` again.
