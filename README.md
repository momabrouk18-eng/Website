# Sourcing Desk

A team workspace for supplier sourcing and business development: suppliers in China, RFQs, landed cost, product opportunities, samples and market intel in one place.

- **Hosting:** Firebase Hosting (project `website-ed86c`)
- **Accounts:** Firebase Authentication (email + password, Google)
- **Database:** Cloud Firestore, shared by the team, live-synced
- **Build:** Vite. Plain JavaScript pages, plus React for a few React Bits components
- **Motion:** GSAP + ScrollTrigger, Lenis smooth scroll (driven by GSAP's ticker)

## Folders

```
index.html              page shell (sidebar, top bar, sign-in gate)
src/
  firebase-config.js    Firebase web config (optional on Hosting)
  css/app.css           all styles
  js/main.js            entry: connects Firebase, picks sign-in / waiting / app screen
  js/auth.js            sign-in, sign-up, password reset, waiting-for-approval screens
  js/app.js             navigation, search, clocks, exchange rates, page switching
  js/store.js           data layer: live copy of the database, add / update / delete
  js/backend/           firebase.js (real), local.js (browser-only, for testing)
  js/motion.js          Lenis + GSAP ticker, scroll reveals, reduced-motion handling
  js/islands.jsx        mounts React Bits components into the pages
  js/ui.js              shared helpers: forms, dialogs, formatting
  js/views/*.js         one file per page
  js/data/*.js          calendar, glossary, message templates
  reactbits/            BlurText, CountUp, StarBorder, LightRays (from React Bits)
static/                 icon and 404 page, copied as-is
firestore.rules         who can read and write what
```

## Roles

| Role | Can |
|---|---|
| Admin | Everything, plus delete records, approve people, change roles, invite, restore backups |
| Member | Read, add and edit everything |
| Waiting for approval | Nothing until an admin approves |
| Removed | Nothing |

The first account ever created becomes admin.

## Commands

```
npm install        once, to download packages
npm run dev        run locally at http://localhost:5173 (needs src/firebase-config.js filled in)
npm run build      build the site into dist/
firebase deploy --only firestore:rules   publish the database rules
```

Test without Firebase: `VITE_BACKEND=local npm run dev` (data stays in the browser).

## Workflow

Work on a `feature/*` branch → pull request to `dev` (a preview link is posted on the PR) → pull request from `dev` to `main` → merging to `main` deploys live.
