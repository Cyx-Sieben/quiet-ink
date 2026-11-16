# Quiet Ink Version 2: step-by-step setup

This guide updates your existing repository **cyx-sieben/quiet-ink** from Version 1 to Version 2 using
VS Code, Git, Node.js, Firebase and Vercel. It takes about 45 to 60 minutes the first time.

> Your other GitHub website is not touched by any of these steps. Everything happens inside the
> `quiet-ink` repository, the `quiet-ink` folder on your computer, and two new free accounts
> (Firebase and Vercel).

---

## Part 0. Back up your Version 1 progress (2 minutes)

Version 2 lives at a new web address, so it cannot read progress saved in your browser by Version 1.

1. Open https://cyx-sieben.github.io/quiet-ink/
2. Go to **Settings → Export progress** and keep the downloaded `.json` file.
3. Later (Part 7) you will import it with **Settings → Import a Version 1 backup file**.

---

## Part 1. Install the tools (15 minutes, once only)

1. **Node.js**: go to https://nodejs.org, download the **LTS** version, and install it with the default options.
2. **Git**: go to https://git-scm.com/downloads, download it for your system, and install it with the default options.
3. **VS Code**: go to https://code.visualstudio.com, download it and install it.
4. Check that they work. Open VS Code, then open a terminal with **Terminal → New Terminal** and run:

   ```bash
   node -v
   npm -v
   git --version
   ```

   Each command should print a version number. If one says "not recognised", restart your computer and try again.

5. Tell Git who you are (use your own name and the email of your GitHub account):

   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```

---

## Part 2. Download your repository into VS Code (5 minutes)

1. In VS Code, press **Ctrl + Shift + P** (Mac: **Cmd + Shift + P**), type **Git: Clone**, and press Enter.
2. Paste: `https://github.com/cyx-sieben/quiet-ink.git` and press Enter.
3. Choose a folder (for example `Documents`). If GitHub asks you to sign in, click **Allow** and sign in in the browser.
4. Click **Open** when VS Code asks whether to open the cloned repository.

Terminal alternative:

```bash
cd Documents
git clone https://github.com/cyx-sieben/quiet-ink.git
cd quiet-ink
code .
```

---

## Part 3. Replace the old files with Version 2 (5 minutes)

1. Unzip **quiet-ink-v2.zip** somewhere else, for example your Desktop.
2. In the **cloned** `quiet-ink` folder, delete the old Version 1 items:
   `index.html`, `css`, `js`, `data`, `assets`, `README.md` (and `.nojekyll` if it is there).
   Keep the hidden `.git` folder. It holds the history and the link to GitHub.
3. Copy **everything inside** the unzipped Version 2 folder into the cloned `quiet-ink` folder,
   including the hidden files `.gitignore` and `.firebaserc`.

   On Windows, turn on **View → Show → Hidden items** in File Explorer to see them.
   On a Mac, press **Cmd + Shift + .** in Finder.

The folder should now look like this:

```
quiet-ink/
├── api/newsstand.js          the Newsstand feed reader (runs on Vercel)
├── mock/                     offline fake Firebase for testing
├── public/                   data files, icons, manifest, service worker
│   └── data/                 grammar_questions, flashcard_topics, writing_prompts, newsstand_feeds
├── src/                      the app: main.js, styles.css, lib/, views/
├── firestore.rules           database security rules
├── firestore.indexes.json    database indexes
├── firebase.json  .firebaserc
├── index.html  package.json  vite.config.js  vercel.json
├── README.md  SETUP.md
└── .gitignore
```

4. In the VS Code terminal (make sure it is inside the `quiet-ink` folder), install the packages:

   ```bash
   npm install
   ```

   This creates a `node_modules` folder. It is not uploaded to GitHub, because `.gitignore` excludes it.

5. Try the app with fake data, before any Firebase setup:

   ```bash
   npm run dev:mock
   ```

   Open http://localhost:5173 in your browser. "Sign in with Google" will ask for any name; it creates
   a test user that only exists in your browser. Sign in as two different names to try friends.
   Press **Ctrl + C** in the terminal to stop it.

---

## Part 4. Create the Firebase project (15 minutes)

1. Go to https://console.firebase.google.com and sign in with your Google account.
2. Click **Create a project** (or **Add project**). Name it `quiet-ink`. Google Analytics is optional; you can turn it off. Click **Create project**.
3. **Turn on Google sign-in.** In the left menu choose **Build → Authentication → Get started**.
   Under **Sign-in method**, click **Google**, switch **Enable** on, choose a support email, and click **Save**.
4. **Create the database.** Choose **Build → Firestore Database → Create database**.
   - Location: **asia-southeast1 (Singapore)** is closest to Malaysia. This cannot be changed later.
   - Start in **production mode**. Your rules will be uploaded in Part 5.
5. **Register the web app.** Click the gear icon **⚙ → Project settings**. Under **Your apps**, click the **</>** (Web) icon.
   Name it `quiet-ink-web`. Do **not** tick Firebase Hosting. Click **Register app**.
6. Firebase shows a block of code with `const firebaseConfig = { ... }`. Copy the six values into
   **`src/firebase-config.js`** in VS Code, replacing each `PASTE_...` text. For example:

   ```js
   export const firebaseConfig = {
     apiKey: 'AIzaSy...your key...',
     authDomain: 'quiet-ink-1a2b3.firebaseapp.com',
     projectId: 'quiet-ink-1a2b3',
     storageBucket: 'quiet-ink-1a2b3.firebasestorage.app',
     messagingSenderId: '123456789012',
     appId: '1:123456789012:web:abc123def456'
   };
   ```

   These values are not secret. It is safe for them to be on GitHub; the security rules protect the data.

7. Open **`.firebaserc`** and replace `PASTE_YOUR_PROJECT_ID` with your project ID (the `projectId` value above).

---

## Part 5. Upload the security rules and indexes (5 minutes)

The rules decide who can read and write what. Without them, the app cannot save anything.

```bash
npx firebase login
```

A browser window opens; sign in with the same Google account and click **Allow**. Then run:

```bash
npm run deploy:rules
```

You should see `Deploy complete!`. Indexes can take a few minutes to finish building; until then the
Reading Room may show an "index" message. Check progress under **Firestore Database → Indexes**.

Run `npm run deploy:rules` again whenever you change `firestore.rules` or `firestore.indexes.json`.

---

## Part 6. Test locally with real Firebase (5 minutes)

```bash
npm run dev
```

Open http://localhost:5173, click **Sign in with Google**, choose a nickname and avatar, and try a Fill the Gap question.
(`localhost` is allowed for sign-in by default.) Press **Ctrl + C** to stop.

---

## Part 7. Save the update to GitHub (5 minutes)

**Using VS Code buttons:**

1. Click the **Source Control** icon in the left bar (the branching icon). You will see the changed files.
2. Type a message in the box, for example: `Quiet Ink v2: accounts, streaks, points, Reading Room`.
3. Click **Commit**. If VS Code asks to stage all changes, click **Yes** (or **Always**).
4. Click **Sync Changes** (or **Push**). If asked, sign in to GitHub.

**Or using the terminal:**

```bash
git add .
git commit -m "Quiet Ink v2: accounts, streaks, points, Reading Room"
git push
```

Refresh https://github.com/cyx-sieben/quiet-ink to check that `src`, `api` and `package.json` are there.

---

## Part 8. Publish on Vercel (10 minutes)

1. Go to https://vercel.com and click **Sign Up → Continue with GitHub**. Choose the **Hobby** (free) plan.
2. Click **Add New… → Project**. Find `quiet-ink` in the list and click **Import**.
   If it is not listed, click **Adjust GitHub App Permissions** and allow access to the `quiet-ink` repository only.
3. Vercel detects **Vite** automatically. Leave the settings as they are:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Click **Deploy** and wait about one minute. Vercel gives you an address such as
   `https://quiet-ink.vercel.app` (the exact name may include extra letters).
5. **Allow sign-in on that address.** Back in Firebase: **Authentication → Settings → Authorized domains → Add domain**,
   then paste your Vercel address **without** `https://`, for example `quiet-ink.vercel.app`.
6. Open your Vercel address, sign in, and go to **Settings → Import a Version 1 backup file** to bring back your
   Version 1 progress from Part 0.

From now on, every `git push` to GitHub makes Vercel publish the new version automatically.

---

## Part 9. Switch off the old GitHub Pages copy (2 minutes)

Version 2 must be built before it can run, so the old address (`cyx-sieben.github.io/quiet-ink/`) would now show a broken page.

1. On GitHub, open the `quiet-ink` repository → **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **None** (or click **Unpublish site** if you see it).

This only affects the `quiet-ink` repository. Your other website keeps working exactly as before.

---

## Part 10. Make yourself an admin (optional, 3 minutes)

Admins can see and act on reports.

1. Sign in to your Vercel site once.
2. Firebase console → **Authentication → Users**. Copy your **User UID**.
3. **Firestore Database → Data → Start collection**. Collection ID: `admins`. Document ID: paste your UID.
   Add any field, for example `name` (string) = `cyx`. Click **Save**.
4. Reload the site. **Settings** now shows **Admin: reports**.

---

## Everyday changes

| I want to... | Do this |
|---|---|
| Add flashcards | Edit `public/data/flashcard_topics.json`, then commit and push |
| Add puzzle questions | Edit `public/data/grammar_questions.json`, then commit and push |
| Add writing concepts | Edit `public/data/writing_prompts.json`, then commit and push |
| Add or fix Newsstand sources | Edit `public/data/newsstand_feeds.json`, then commit and push |
| Change points or timers | Edit the numbers at the top of `src/lib/rules.js` |
| Change security rules | Edit `firestore.rules`, then run `npm run deploy:rules` |

---

## Troubleshooting

- **"Connect Firebase" page appears.** `src/firebase-config.js` still contains `PASTE_...`. Fill it in, then commit and push.
- **Sign-in popup closes with "unauthorized domain".** Add the site address in Firebase → Authentication → Settings → Authorized domains (Part 8, step 5).
- **"You do not have permission to do that."** The rules were not uploaded or are out of date. Run `npm run deploy:rules`.
- **"The database needs an index."** Run `npm run deploy:rules` and wait a few minutes for indexes to build.
- **Newsstand shows "Could not load ...".** That feed address is wrong or the site blocks readers. Open the address in your browser; if it does not show XML, remove it from `newsstand_feeds.json` or replace it.
- **`npm` is not recognised.** Restart VS Code (or the computer) after installing Node.js.
- **Git push is rejected.** Run `git pull` first, then `git push` again.
