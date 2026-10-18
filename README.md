# Sourcing Desk

A workspace for a Supplier & Business Development Executive: suppliers in China, RFQs, landed cost, product opportunities, samples and market intel in one place.

Hosted on Firebase Hosting (project `website-ed86c`). Plain HTML, CSS and JavaScript modules, no build step.

## What's inside

| Page | What it does |
|---|---|
| Dashboard | Today's follow-ups, tasks and deadlines, Cairo ↔ China time bridge, upcoming holidays and fairs |
| Suppliers | Supplier records, terms, ratings, contact log, next follow-up |
| RFQs & quotes | Line up supplier quotes and score them with adjustable weights |
| Samples | Track samples from request to verdict, with courier tracking links |
| Opportunities | Product pipeline from idea to launch, with a printable assessment |
| Market intel | Competitor shelf prices over time, trends and news |
| Landed cost | Full import cost per unit (Egypt, Türkiye or any country you add), margin and max negotiable price |
| Calculators | Currency, CBM & container fit, margin/markup, price breaks, lead-time planner, units |
| Calendar | China holidays, trade fairs, Egypt holidays, own events |
| Message templates | English + Chinese supplier messages with fill-in fields |
| Glossary | Incoterms, payment, quality, customs terms |
| Notes | Meeting and call notes, linked to suppliers |

## Data

Everything is saved in the browser (`localStorage`). Settings → Backup downloads a JSON file that can be restored on another computer.

## Working on it

```
public/
  index.html        app shell
  css/app.css       all styles
  js/app.js         navigation, search, clocks, exchange rates
  js/store.js       data storage and defaults
  js/ui.js          shared helpers (forms, modal, formatting)
  js/views/*.js     one file per page
  js/data/*.js      calendar, glossary, templates
```

Run locally: `firebase serve` or any static server in `public/`.

Branches: work on `dev` or a `feature/*` branch, open a pull request to `main`. Merging to `main` deploys live.
