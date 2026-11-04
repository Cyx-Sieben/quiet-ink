# Quiet Ink ✦

A weekly English writing and vocabulary trainer with a "writer's desk scrapbook" look: grid paper, torn edges, stickers, clipboards and bold editorial type.

Each week you get three small tasks:

| Part | What you do | Weekly limit |
|------|-------------|--------------|
| **1. Word Puzzles (Teka-Teki)** | Fill the blank in a sentence by choosing the correct word from four options. Every answer comes with an explanation. | 5 sets × 5 random questions |
| **2. Flashcards** | Learn one themed topic of 10 words or phrases. Each card shows the meaning, type and example sentences. | 1 topic; the next one unlocks on Monday |
| **3. Weekly Reflection** | Read about a concept (for example wabi-sabi or the Michelangelo effect) and write a response. | 1 attempt; the piece locks after you submit |

A week runs from **Monday 00:00 to Sunday 23:59, Malaysian time (UTC+8)**.

---

## Folder structure

```
quiet-ink/
├── index.html                  Page shell, fonts, navigation
├── css/styles.css              Full design system (colours, paper, stickers, dark mode)
├── js/
│   ├── app.js                  Starts the app and handles routes (#/puzzles etc.)
│   ├── storage.js              Saves progress in the browser; export and import
│   ├── week.js                 Week and date calculations (UTC+8)
│   ├── progress.js             Shared rules: streaks, topic order, question picking
│   ├── ui.js                   Helpers and SVG decorations (binder clip, typewriter)
│   └── views/
│       ├── dashboard.js        The desk / home page
│       ├── puzzles.js          Part 1
│       ├── flashcards.js       Part 2
│       ├── reflection.js       Part 3
│       └── archive.js          Mistakes, archive and settings pages
├── data/
│   ├── grammar_questions.json  Part 1 question bank
│   ├── flashcard_topics.json   Part 2 topics (150) and their cards
│   └── writing_prompts.json    Part 3 concepts
└── assets/favicon.svg
```

No build step and no server code: it is plain HTML, CSS and JavaScript.

---

## Put it on GitHub

1. Create a new repository on GitHub (for example `quiet-ink`).
2. Click **Add file → Upload files**, drag in **everything inside** the `quiet-ink` folder (keep the folder structure), and click **Commit changes**.
3. Go to **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select the `main` branch and the `/ (root)` folder, then **Save**.
4. After a minute or two, your site will be live at `https://<your-username>.github.io/quiet-ink/`.

Or, from a terminal:

```bash
cd quiet-ink
git init
git add .
git commit -m "First version of Quiet Ink"
git branch -M main
git remote add origin https://github.com/<your-username>/quiet-ink.git
git push -u origin main
```

---

## Run it on your computer

Browsers will not load the JSON data files if you double-click `index.html`, so start a tiny local server inside the folder:

```bash
# Python 3
python -m http.server 8000
# then open http://localhost:8000
```

or, with Node.js: `npx serve .`

---

## Your progress

Progress is saved in your browser (localStorage). It does **not** sync between devices automatically.

- **Settings → Export progress** downloads a backup `.json` file.
- **Settings → Import progress** restores it on another device or browser.

Clearing your browser data will erase progress, so export a backup now and then.

---

## Adding or editing content

All learning content lives in the `data` folder, so you can change it without touching the code.

### Part 1: `data/grammar_questions.json`

```json
{
  "id": "g105",
  "sentence": "She has lived in Penang ____ 2019.",
  "options": ["since", "for", "from", "at"],
  "answer": "since",
  "explanation": "Use 'since' with a starting point in time.",
  "category": "grammar",
  "difficulty": "easy"
}
```

- Mark the blank with exactly four underscores: `____`.
- `answer` must match one of the `options` exactly. The app shuffles the options, so the order does not matter.
- `category` is `"grammar"` or `"word choice"`; `difficulty` is `"easy"`, `"medium"` or `"hard"`.
- Every `id` must be unique.

### Part 2: `data/flashcard_topics.json`

There are 150 topics. The first 15 already have their ten cards; the rest have a title and description, with an empty `cards` list, ready to be filled in. If you reach a topic with no cards, the app tells you to add them.

```json
{
  "week": 16,
  "title": "Decision Making",
  "description": "Words for weighing options, choosing and committing.",
  "cards": [
    {
      "term": "weigh up",
      "type": "phrasal verb",
      "meaning": "To consider the advantages and disadvantages of something carefully.",
      "examples": ["She weighed up both job offers before replying."]
    }
  ]
}
```

Keep topics in order and give each one ten cards. Topics unlock by completion, so a missed week never skips a topic.

### Part 3: `data/writing_prompts.json`

```json
{
  "id": "w053",
  "name": "Wabi-sabi",
  "field": "Japanese aesthetics",
  "explanation": "Two to four sentences explaining the concept and where it comes from.",
  "prompt": "The writing task for the week."
}
```

Each concept is shown once, in a random order, before the list repeats.

---

## Accessibility and motion

- Works with the keyboard: A to D answers puzzles, Space flips a flashcard, arrow keys move between cards.
- If your device is set to "reduce motion", animations switch off.
- A dark desk theme follows your device setting, or you can choose it in **Settings**.

## Credits

Fonts from Google Fonts: Archivo Black, Pixelify Sans, Caveat, EB Garamond and Poppins. All illustrations and textures are original CSS and SVG. Quotations on the home page are from public domain sources.

## Ideas for later

- Audio pronunciation for flashcards with the browser's speech synthesis.
- Spaced repetition: bring back cards from past topics just before you forget them.
- AI feedback on the weekly reflection (grammar, vocabulary and structure).
- A "use this week's words" challenge inside the reflection editor.
- Optional cloud sync with a free backend so progress follows you across devices.
