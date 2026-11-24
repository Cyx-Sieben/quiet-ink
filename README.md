# Quiet Ink ✦ Version 3

A personal daily-and-weekly English trainer with a "writer's desk scrapbook" style.
Sign in with Google, do a two-minute warm-up every day, keep a streak for each weekly
part, earn points, add friends — and keep every page you write on your own shelf,
exportable to Google Docs.

**First time? Follow [SETUP.md](SETUP.md) step by step.**

## The daily warm-up

A two-minute habit thread on your Desk: one gap question (preferring your past
mistakes), one flashcard to recall, and one "say it better" rewrite. +5 points a day
and its own daily streak, separate from the weekly streaks.

## The five weekly parts

| Part | How it works | Points | Streak counts when |
|---|---|---|---|
| **Fill the Gap** | Three sub-sections, one set of 5 questions each: the classic gap game, **Spot & Fix** (find the error, pick the correction), and **Build the Sentence** (tap words in order). 2 minutes per question; a timeout counts as wrong. | 10 per correct answer, +10 for a perfect set (max 180/week) | all three sub-sections are done |
| **Word Flip** | One topic of 10 cards per week. A 5-minute quiz: choose the meaning from 3 options, then the card flips to show meaning and examples. Wrong cards return in the daily warm-up. | 10 per correct card, +20 for 10/10 (max 120/week) | the quiz is finished |
| **Phrase Library** | One idiom or expression family per week: what it means, where it came from, how to use it properly, and real examples — plus a two-question "did it stick?" check. | 10 for reading, +5 for the check | the phrase is read |
| **Speaking Practice** | A weekly talking point with a Point-Reason-Example-Point framework, a phrase bank and critical-thinking nudges. Write your spoken-style answer, self-review against a checklist, rewrite if you like. | 25 for the draft, +10 for the self-review | the draft is submitted |
| **The Weekly Page** | Everyone gets the same concept each week. No word limit. Finish & save it to your private shelf, then export to Google Docs (or download .docx) and publish anywhere. | 50 for finishing | the page is finished |

- Weeks run Monday 00:00 to Sunday 23:59, Malaysian time (UTC+8), using server time.
- Each part has its **own** weekly streak. Missing one part does not break the others.
- Each account has **one streak repair for life**. It can restore a streak that broke
  because of last week, during the following week.
- Your writings stay **private**: they live in your own weekly records, never a public
  feed. Export makes them yours to publish anywhere.

## Social features

- Google sign-in, unique nickname, bio and profile picture (upload your own — it is
  shrunk to a small thumbnail — or use a sticker avatar / Google photo).
- Friend requests, friend list, weekly and all-time leaderboard, blocking.
- Public profile at `#/@nickname` with points and streaks.

## Tech

- [Vite](https://vitejs.dev) + plain JavaScript (no framework)
- [Firebase](https://firebase.google.com) Authentication (Google, with the Google
  Docs scope for exports) and Cloud Firestore
- [Vercel](https://vercel.com) hosting (static site, no serverless functions)

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
public/data/               learning content (edit freely)
  grammar_questions.json     classic Fill the Gap questions
  error_questions.json       Spot & Fix questions
  sentence_build.json        Build the Sentence drills
  flashcard_topics.json      Word Flip topics (30 weeks of 10 cards)
  phrases.json               Phrase Library entries
  speaking_prompts.json      Speaking Practice prompts
  rewrite_drills.json        warm-up "say it better" drills
  writing_prompts.json       weekly writing concepts
src/main.js                start-up, sign-in and page routing
src/firebase-config.js     your Firebase web settings
src/lib/rules.js           points, timers, streaks and weekly pickers
src/lib/week.js            week and day math (Malaysian time)
src/lib/session.js         database paths and saving progress
src/lib/docs.js            Google Docs export + .docx download
src/lib/friends.js         friend requests, friendships, blocking
src/views/                 one file per screen
firestore.rules            who can read and write what
```

## Database structure

| Path | Contents | Who can read |
|---|---|---|
| `users/{uid}` | nickname, bio, avatar/photo, points, streaks | everyone |
| `users/{uid}/private/state` | correct questions, mistakes, finished topics, friends, blocks, daily streak | owner |
| `users/{uid}/weeks/{monday}` | fill sub-parts, quiz, phrases, speaking, page draft, warm-ups, points | owner |
| `usernames/{nickname}` | reserves a nickname | everyone |
| `friendRequests/{from}_{to}` | pending requests | sender and receiver |
| `friendships/{a}_{b}` | accepted friendships | the two friends |

## Known limits

- Scores are calculated in the browser. The rules stop people from changing anyone
  else's data, but a technical user could edit their own points. Fully server-checked
  scoring needs Cloud Functions on Firebase's pay-as-you-go plan.
- Google Docs export needs the OAuth pop-up once per session; in mock mode it falls
  back to a .docx download.

## Credits

Fonts from Google Fonts (Archivo Black, Pixelify Sans, Caveat, EB Garamond, Poppins).
All illustrations, avatars and textures are original CSS and SVG.
