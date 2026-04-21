# Job Extractor

## Overview
## Nested Context
- `.claude/commands/` — slash commands for extension workflows
  - `upwork-apply.md` — agent-mode job-finding + applying via `upwork-agent` MCP.
    Bakes in Amar's profile, filter rules (incl. skip IN/PK clients, $25/hr floor),
    shortest-path search (best-matches first, NOT `/nx/search/`), HARD STOP on
    Apply-page qualification warnings, no-script-click on Cloudflare Turnstile,
    and "by hook or crook" application posture with Sathi MCP as profile source.
    `upwork_apply_to_job` now supports **both hourly and fixed-price** natively
    (auto-detects via milestone-description input). Pass `milestones` + `duration`
    for fixed-price, skip them for hourly. The manual "Fixed-price apply runbook"
    in the command file is kept as a DOM-debug reference for selector-drift
    triage, not the primary path. Extension logic lives in
    `src/commands/apply-page-script.js` (spawn-then-fill milestone pattern
    handles the description re-render clobber).
  - `upwork_select_highlights` — MCP-callable recovery helper for current apply
    pages/modals. Enforces 2 portfolio + 2 certificate highlights, removes extras,
    supports preferred title substrings, commits highlights, and never clicks Send.
- `.claude/agents/` — selector-fallback, MV3, Supabase REST reviewers
- `bridge/run-codex-upwork.sh` — one-off launcher that runs the `upwork-apply`
  runbook via **Codex CLI** instead of Claude Code. It now prefers the Codex-owned
  runbook at `.codex/commands/upwork-apply.md` and falls back to
  `.claude/commands/upwork-apply.md`. Prepends a 6-rule memory preamble
  (yellow-banner HARD STOP, IN/PK + $25/hr filters, no-script Turnstile,
  best-matches-only, unified hourly+FP tool, no-commit posture) since Codex
  doesn't inherit Claude's memory dir. Requires `[mcp_servers.upwork-agent]` in
  `~/.codex/config.toml` (stdio → `bridge/mcp-server.js`). Sathi is HTTP MCP —
  either skip (paste profile inline) or bridge via `npx mcp-remote`.
  Usage: `./bridge/run-codex-upwork.sh [<job-url>]`. Logs to `bridge/codex-upwork-*.log`.

Related docs: `AGENTS.md` (platform rules), `supabase-schema.sql` (DB source of truth).

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
popup.html            # Side panel UI (Extract [Single, Batch], Tools [Capture])
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
