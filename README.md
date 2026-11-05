# Avocado Money

Grow your savings like an avocado tree. It's a private, offline expense and income tracker for iPhone, turned into a game and styled with the Lloyd Bolivar avocado brand (Fraunces + Plus Jakarta Sans, Paper and Study rooms).
Everything is stored **only on your phone**. There are no accounts, no servers and no bank logins: you enter the numbers yourself.

## What it does

| Screen | What you get |
|---|---|
| **Quick Add** (opens first) | Switch between **− Expense** and **+ Income**. Type the amount, tap a category, Save. Expenses can also be filled from a **📷 receipt photo** or a **📋 pasted GCash/bank SMS**. |
| **Home** | **Your savings**: the amount you set, plus income you log, minus spending (tap the number to correct it). Also this month's money in, out and net, your level and streak, spending vs. budget, safe-to-spend per day, income vs. spending by month, daily spending, where it went, needs vs. wants (50/30/20), what's coming up and top places. |
| **Debts** (boss battles, from Goals or Home) | Each debt you owe is a boss with an HP bar that drops as you pay. Choose **Avalanche** (highest interest first) or **Snowball** (smallest first) and see your debt-free date. Payments are logged as "Debt payments" expenses. Also tracks money **owed to you**. +25 XP per payment, +300 per boss defeated, plus debt badges and a weekly debt quest. |
| **Goals** (the game) | Goals grow from 🌰 seed → 🌱 → 🌿 → 🪴 → 🌳 → 🥑 harvest as you feed them. **XP and levels** (Seed up to Avocado legend), **daily streaks** with no-spend check-ins, **3 weekly quests**, and **15 badges**. |
| **Activity** | Every expense and income, searchable and filterable. Tap one to edit or delete it (with undo). |
| **Bills & paydays** (from Home tiles) | Subscriptions, bills and **recurring income** (for example salary on the 15th and 30th), logged automatically on their dates. It also spots repeating charges you haven't tracked yet. |
| **Where to cut** (Insights) | Ranked savings tips: spending spikes, eating out, coffee, subscriptions, gas, shopping, weekend spending, fees, the 50/30/20 check, emergency-fund coverage, and goals falling behind their date. |
| **Settings** (⚙ on Home) | Update savings, budget, category budgets, currency (₱ by default), CSV export, backup and restore, and demo data. |

**How XP works:** +10 per day you log anything, +5 per expense (up to 6 a day), +10 per income, +15 for a no-spend check-in, +20 per goal deposit (up to 3 a day), +250 for a fully funded goal, 30–80 per weekly quest and +50 per badge. Level 2 takes about 4 days; level 10 takes about a year of daily logging.

Tip: open Home → ⚙ → **Load demo data** to see everything filled in. You can remove it from the same menu.

## Install it on your iPhone

An iPhone web app has to be opened from an `https://` address once. After that it lives on your Home Screen and works offline. Pick one of these options (both are free):

### Option A: Netlify Drop (easiest, no coding tools)
1. On your PC, go to **https://app.netlify.com/drop** and sign up (free).
2. Drag the **`app`** folder (inside `C:\AI OS\Finance App\`) onto the page.
3. Netlify gives you a link like `https://something.netlify.app`. You can rename it in Site settings.
4. On your iPhone, open that link in **Safari**, then tap **Share ↑ → Add to Home Screen → Add**.

### Option B: GitHub Pages (how this project is set up)
1. Create an empty **public** repository on github.com (for example `gastos`), without a README.
2. Push this folder to it (`git push -u origin main`).
3. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**. The included workflow (`.github/workflows/pages.yml`) publishes the `app/` folder on every push.
4. After about a minute your app is at `https://<your-username>.github.io/gastos/`. Open it in Safari on your iPhone, then tap **Share → Add to Home Screen**.

> Your expenses never go to Netlify or GitHub. Those sites only host the app's code, and your data stays in the app's storage on your phone.

### Just want to try it on your phone first?
On the PC, run:
```
python -m http.server 8765 --directory app
```
Then on an iPhone that's on the same Wi-Fi, open `http://<your-PC's-IP>:8765` in Safari (find the IP with `ipconfig`). Offline mode only works from a real `https://` address, so use Option A or B for daily use.

## About the "widget"

Apple only lets apps built in Xcode on a Mac put real widgets on the Home Screen. Avocado Money gets you almost the same thing:

- **Put the Avocado Money icon in your Dock.** It opens straight to Quick Add with the keypad ready.
- The camera button is in the top-right corner, so a receipt is one tap away.

If you later get access to a Mac, the app can be wrapped as a native app with a real WidgetKit widget, and the logic here carries over.

## Your data
- Stored in the app's on-device database (IndexedDB). It isn't shared with Safari tabs.
- **Back up regularly:** ⚙ → *Back up everything* saves a `.json` file (send it to Files, iCloud Drive or Google Drive). *Restore from backup* brings it back, even on a new phone.
- Deleting the Home Screen icon deletes the app's data.

## Updating the app
Edit files in `app/`, re-upload (drag to Netlify again, or upload to GitHub), and bump `VERSION` in `app/sw.js`. Phones pick up the update the next time the app is opened.

## Project layout
```
app/                  ← the whole app (upload this folder)
  index.html, manifest.webmanifest, sw.js (offline cache)
  css/app.css
  js/app.js           router & startup
  js/store.js, db.js  on-device storage
  js/categories.js    categories + Philippine merchant list for auto-categorizing
  js/receipt.js       receipt OCR (Tesseract.js, loaded on first scan) + SMS parser
  js/analytics.js     totals, pace, recurring maths, subscription detection
  js/engine.js        "what to cut" insights
  js/charts.js        small SVG charts
  js/views/*.js       Quick Add, Home, Activity, Bills, Insights
  js/sheets.js        edit forms & settings
tools/make_icons.py   regenerates the app icons
```

Receipt reading downloads its text-recognition engine (about 10 MB) the first time you scan, then caches it for offline use.
