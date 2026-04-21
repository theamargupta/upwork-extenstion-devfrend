# This is a Chrome MV3 extension with NO build step

- Manifest V3, Service Worker (`background.js`).
- Vanilla JS / HTML / CSS only. Never add bundlers, frameworks, or npm dependencies.
- Do not add SDKs (e.g. `@supabase/supabase-js`). All Supabase calls go through the hand-rolled `supabase.js`.
- To reload the extension: open `chrome://extensions/`, enable Developer mode, click the refresh icon on the Job Extractor card.
- Selectors in `content.js` are fragile — always verify against live Upwork HTML before changing.
