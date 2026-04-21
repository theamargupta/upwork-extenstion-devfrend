# Job Extractor

Chrome extension (Manifest V3) that extracts job data from Upwork pages, scores them, and saves to Supabase. Opens as a side panel so it stays open while you browse.

## Features

- **Single Job Extraction** — Click the extension on any Upwork job page to extract all data from the DOM
- **Batch Extraction** — Auto-clicks through 1-50 jobs on Best Matches or Search Results, extracts each one
- **Scoring System** — Scores jobs 1-10 based on budget, client history, proposals, and more
- **Copy for Claude** — One-click copy in a condensed format optimized for pasting into Claude for proposal writing
- **Copy Markdown** — Full formatted markdown output
- **Supabase Integration** — Save extracted jobs to a Supabase database for tracking and analysis
- **Deduplication** — Skips already-extracted jobs in batch mode, upserts in Supabase
- **Side Panel UI** — Stays open while you interact with Upwork (no popup disappearing)

## Data Extracted

**Job Details:** Title, description, budget (amount + type), experience level, posted date, location, project length/type, proposals count, skills/tags

**Activity:** Last viewed by client, interviewing count, invites sent, bid range (high/avg/low), connects required/available

**Client Info:** Payment verified status, location + timezone, hire rate, open jobs, total spent, member since, rating, reviews

## Scoring

Jobs are scored 1-10 and labeled:

| Score | Label | Color |
|-------|-------|-------|
| 8-10 | APPLY | Green |
| 5-7 | MAYBE | Yellow |
| 1-4 | SKIP | Red |

**Scoring factors:**

| Factor | Points |
|--------|--------|
| Budget >= $1000 | +3 |
| Budget >= $500 | +2 |
| Budget >= $200 | +1 |
| Budget < $200 | -1 |
| Payment verified | +1 |
| Payment not verified | -2 |
| Hire rate > 50% | +2 |
| Hire rate > 20% | +1 |
| Hire rate 0% | -1 |
| Proposals < 5 | +2 |
| Proposals 5-10 | +1 |
| Proposals 15-20 | -1 |
| Proposals 20-50 | -2 |
| Proposals 50+ | -3 |
| Posted minutes ago | +1 |
| Client spent >= $10K | +2 |
| Client spent >= $1K | +1 |

## Installation

1. Clone or download this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the `upwork-job-extractor` folder
6. Navigate to any Upwork page and click the extension icon to open the side panel

## Supported Pages

- `upwork.com/jobs/*`
- `upwork.com/freelance-jobs/*`
- `upwork.com/nx/find-work/*` (Best Matches, Most Recent)
- `upwork.com/nx/search/jobs/*`
- `upwork.com/ab/proposals/job/*`

## Usage

### Single Job

1. Open any Upwork job (or click a job to open its sidebar)
2. Click the extension icon — side panel opens with extracted data
3. Click **Copy All** for markdown or **Copy Claude** for the condensed format

### Batch Mode

1. Go to Upwork Best Matches or Search Results (the list view)
2. Open the side panel and switch to the **Batch** tab
3. Set how many jobs to extract (1-50)
4. Click **Start** — the extension auto-clicks each job card, waits for the sidebar, extracts, closes, moves to next
5. Results appear sorted by score with summary stats
6. Copy all or save to Supabase

### Copy for Claude Format

```
JOB: [title]
BUDGET: [amount] [type]
LEVEL: [level]
POSTED: [when]
PROPOSALS: [count]
CLIENT: [location] | Hire rate: [X%] | Spent: [amount] | Payment: [verified/not] | Member since: [date]
SCORE: [X/10] [APPLY/MAYBE/SKIP]
SKILLS: [comma separated]
DESCRIPTION: [full description]
```

## Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Open SQL Editor and run the contents of `supabase-schema.sql`
3. Go to **Settings > API** in your Supabase dashboard
4. Copy the **Project URL** and **anon public** key
5. In the extension, go to the **Settings** tab
6. Paste both values, click **Test Connection**, then **Save**
7. Green **Save** buttons will appear on single and batch views

### Useful Queries

```sql
-- All APPLY jobs
select title, score, budget_amount, client_total_spent
from upwork_jobs where score_label = 'APPLY'
order by created_at desc;

-- Jobs with a specific skill
select title, score from upwork_jobs
where 'Next.js' = any(skills);

-- High-value clients
select title, client_total_spent, client_hire_rate
from upwork_jobs
where client_payment_verified = true
  and score >= 7
order by score desc;
```

## File Structure

```
upwork-job-extractor/
├── manifest.json          # Manifest V3 config
├── content.js             # DOM extraction + batch automation
├── background.js          # Service worker (side panel, storage)
├── popup.html             # Side panel UI
├── popup.css              # Dark theme styles
├── popup.js               # UI logic (tabs, render, copy, save)
├── supabase.js            # Supabase REST API helper
├── supabase-schema.sql    # Database table schema
├── README.md
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Tech Stack

- Vanilla HTML/CSS/JS (no framework)
- Chrome Manifest V3
- Chrome Side Panel API
- Supabase REST API (no SDK)
- Multiple fallback DOM selectors for Upwork layout changes
