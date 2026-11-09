# Germany UniHub

BSc/MSc university finder for international study programmes in Germany.

Source lives in `src/` (gitignored). Publish minified bundles from `dist/`, same pattern as the root site.

## Structure

```
index.html
css/style.css
src/app.js
src/courses.js
src/city-coords.js
dist/app.js      # built
dist/data.js     # built
```

## Import study programmes (MyGermanUniversity dump)

Place `study-programs.json` at `unihub/data/raw/study-programs.json` (gitignored), then:

```bash
npm run import:study-programs
npm run build:unihub
```

This rebuilds `src/courses.js` from the full programme dump (all languages/degrees), infers subject groups from programme names, enriches ranking programme counts, and refreshes the Universities **All** tab.

## Build

From the repo root (needs `javascript-obfuscator`):

```bash
npm install
npm run build:unihub
```

Or build everything:

```bash
npm run build:all
```

## Run locally

```bash
npm start
```

Then open `http://localhost:8080/unihub/`.

## Features

- Search and filter programmes
- Watchlist bookmarks with shareable `?watch=` links
- Watchlist map view (Leaflet + OpenStreetMap)
- Match profile synced with filters
- Mobile / tablet responsive layout
