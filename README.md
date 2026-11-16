# Quiet Ink ✦ Version 2

A social weekly English writing and vocabulary trainer with a "writer's desk scrapbook" style.
Sign in with Google, keep a weekly streak for each part, earn points, add friends, and publish
your weekly page to a Substack-style Reading Room.

**First time? Follow [SETUP.md](SETUP.md) step by step.**

## The three weekly parts

| Part | How it works | Points | Streak counts when |
|---|---|---|---|
| **Fill the Gap** | 5 sets × 5 random sentences with a blank and 4 options. 2 minutes per question; a timeout counts as wrong. Green for right, red for wrong, with an explanation. | 10 per correct answer, +10 for a perfect set (max 300/week) | all 5 sets are done |
| **Word Flip** | One topic of 10 cards per week. Press Start for a 5-minute quiz: choose the meaning from 3 options, then the card flips to show the meaning and examples. One answer per card. | 10 per correct card, +20 for 10/10 (max 120/week) | the quiz is finished |
| **The Weekly Page** | Everyone gets the same concept each week. No word limit. Publish as Public, Friends only or Private. The text locks after publishing. | 50 for publishing | the page is published |

- Weeks run Monday 00:00 to Sunday 23:59, Malaysian time (UTC+8), using server time.
- Each part has its **own** weekly streak. Missing one part does not break the others.
- Each account has **one streak repair for life**. It can restore a streak that broke because of last week, during the following week.

## Social features

- Google sign-in, unique nickname, bio and avatar; public profile at `#/@nickname`.
- Friend requests, friend list, weekly and all-time leaderboard, blocking.
- **Reading Room:** This Week, Latest, Friends and Topics tabs, search, likes, comments and reports.
- **Newsstand:** titles and short excerpts from public RSS feeds (Substack and others), with a link to read on the original site.
- Admin page for reports; data download; full account deletion.
- Installable as an app (PWA) on phones.

## Tech

- [Vite](https://vitejs.dev) + plain JavaScript (no framework)
- [Firebase](https://firebase.google.com) Authentication (Google) and Cloud Firestore
- [Vercel](https://vercel.com) hosting, plus one serverless function (`api/newsstand.js`)

## Commands

```bash
npm install          # install packages (once)
npm run dev:mock     # try the app with fake offline data, no Firebase needed
npm run dev          # run locally with your real Firebase project
npm run build        # production build into dist/
npm run deploy:rules # upload firestore.rules and firestore.indexes.json
```

## Project structure

```
api/newsstand.js        Vercel function that reads RSS/Atom feeds
mock/                   offline stand-in for Firebase (used by npm run dev:mock)
public/data/            learning content and Newsstand feed list (edit freely)
src/main.js             start-up, sign-in and page routing
src/firebase-config.js  your Firebase web settings
src/lib/rules.js        points, timers, streak and weekly-concept rules
src/lib/session.js      database paths and saving progress
src/lib/friends.js      friend requests, friendships, blocking
src/views/              one file per screen
firestore.rules         who can read and write what
```

## Database structure

| Path | Contents | Who can read |
|---|---|---|
| `users/{uid}` | nickname, bio, avatar, points, streaks | everyone |
| `users/{uid}/private/state` | correct questions, mistakes, finished topics, friends, blocks | owner |
| `users/{uid}/weeks/{monday}` | sets, quiz, drafts, weekly points | owner |
| `usernames/{nickname}` | reserves a nickname | everyone |
| `pieces/{uid}_{monday}` | published pages (+ `likes`, `comments`) | depends on visibility |
| `friendRequests/{from}_{to}` | pending requests | sender and receiver |
| `friendships/{a}_{b}` | accepted friendships | the two friends |
| `reports/{id}` | reports | admins |
| `admins/{uid}` | admin list (create in the console) | that admin |

## Known limits

- Scores are calculated in the browser. The rules stop people from changing anyone else's data, but a technical user could edit their own points. Fully server-checked scoring needs Cloud Functions on Firebase's pay-as-you-go plan.
- Search looks through the 300 most recent public pages. A search service such as Algolia would be needed for a very large site.
- Newsstand feed addresses could not be checked when they were written; any feed that fails is skipped and listed on the page.

## Credits

Fonts from Google Fonts (Archivo Black, Pixelify Sans, Caveat, EB Garamond, Poppins). All illustrations, avatars and textures are original CSS and SVG.
