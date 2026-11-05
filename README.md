# Gastos — expense tracker for iPhone

A fast, private expense tracker that installs on your iPhone Home Screen and works offline.
Everything is stored **only on your phone**. There are no accounts, no servers and no bank logins.

## What it does

| Screen | What you get |
|---|---|
| **Quick Add** (opens first) | Type the amount on the keypad, tap a category, and tap Save. It takes about 3 seconds. Gastos learns your merchants, so "Jollibee" files itself under Food. |
| **📷 Scan receipt** | Take a photo or pick one from your library. On-device text recognition fills in the total, store and date, and the photo is saved with the expense. |
| **📋 Paste SMS** | Paste a GCash, Maya, bank or card notification and it pulls out the amount, merchant and payment method. |
| **Home (dashboard)** | Spent this month vs. budget with a pace marker, safe-to-spend per day, comparison with last month, fixed costs, bills due, daily spending chart, where it went (by category), needs vs. wants (50/30/20), a 6-month trend, top places and what's coming up. |
| **Activity** | Every expense, searchable and filterable. Tap one to edit it, view its receipt or delete it (with undo). |
| **Bills & subs** | Subscriptions and bills with their yearly cost, auto-logging on the due date, a **Pay** button for bills that vary, and detection of repeating charges you haven't tracked yet. |
| **Insights** | Suggestions on what to cut, ranked by how much they'd save: category spikes, eating out, coffee habits, subscription overload, streaming rotation, gas, impulse shopping, weekend splurges, fees, the 50/30/20 check, savings rate and no-spend days. |
| **Settings** (⚙ on Home) | Income, budget, category budgets, currency (₱ by default), CSV export, full backup and restore, and demo data. |

Tip: open Home → ⚙ → **Load demo data** to see every chart filled in. You can remove it from the same menu.

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

Apple only lets apps built in Xcode on a Mac put real widgets on the Home Screen. Gastos gets you almost the same thing:

- **Put the Gastos icon in your Dock.** It opens straight to Quick Add with the keypad ready.
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
