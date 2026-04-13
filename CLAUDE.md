# Upwork Job Extractor

## Overview
Chrome extension (Manifest V3) that extracts and scores Upwork job postings. Single job extraction, batch mode (1-50 jobs), intelligent scoring (1-10), copy as markdown/Claude format, and Supabase sync with deduplication.

## Tech Stack
- Vanilla HTML/CSS/JS (no frameworks, no build step)
- Chrome Manifest V3 (Side Panel API)
- Supabase REST API (hand-rolled, no SDK)
- Supabase Auth (JWT)
- Chrome storage.local for local caching

## How to Run
No build step. Load unpacked in chrome://extensions/ with Developer mode on.

## Project Structure
```
manifest.json         # MV3 config (v1.1.0)
content.js            # DOM extraction + batch automation (main logic)
background.js         # Service worker (side panel, message routing)
popup.html            # Side panel UI (4 tabs: Single, Batch, Saved, Settings)
popup.css             # Dark theme styles
popup.js              # UI logic (render, copy, tabs, auth, batch results)
supabase.js           # Custom REST API wrapper (auth + DB operations)
supabase-schema.sql   # PostgreSQL table + RLS policies
config.js             # Supabase credentials (GITIGNORED)
config.js.example     # Template for config.js
icons/                # Extension icons (16, 48, 128)
```

## Key Files
- content.js — All DOM extraction logic. Uses selector fallbacks via qs() helper. Scoring algorithm at lines 403-450.
- popup.js — UI controller. Tabs, rendering, copy formats, auth flow, batch results display.
- supabase.js — Custom REST wrapper. signUp, signIn, upsert, query methods. No SDK dependency.

## Code Conventions
- camelCase for functions/variables
- IIFE for content script isolation
- Message-based communication (chrome.runtime.sendMessage)
- Selector fallbacks — multiple selectors tried in sequence (Upwork DOM changes frequently)
- Dark theme UI with custom CSS classes
- Try-catch with user-facing toast notifications

## Scoring Algorithm (content.js)
Base: 5/10. Additive factors:
- Budget >= $1000: +3, >= $500: +2, >= $200: +1, < $200: -1
- Payment verified: +1, NOT verified: -2
- Hire rate > 50%: +2, > 20%: +1, 0%: -1
- Proposals < 5: +2, 5-10: +1, 15-20: -1, 20-50: -2, 50+: -3
- Posted within minutes: +1
- Client spent >= $10K: +2, >= $1K: +1
Labels: 8-10 APPLY, 5-7 MAYBE, 1-4 SKIP

## Environment (config.js)
```javascript
const SUPABASE_URL = 'https://xxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
```
Copy config.js.example to config.js and fill in Supabase credentials.

## Database
Supabase table: upwork_jobs. RLS enforced (user_id = auth.uid()). Indexes on user_id, score desc, created_at desc. Upsert on job_uid for deduplication.

## Rules
- ALWAYS validate selectors against real Upwork HTML before changing extraction logic
- Never guess selectors — Upwork changes DOM frequently
- Test on both job detail pages AND search/best-matches pages
- Keep supabase.js SDK-free (vanilla fetch)
- config.js must stay gitignored
