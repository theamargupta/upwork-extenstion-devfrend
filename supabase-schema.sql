-- Run this in your Supabase SQL Editor

-- Drop old table if upgrading from v1 (no auth)
-- drop table if exists upwork_jobs;

create table if not exists upwork_jobs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid(),  -- auto-set from logged-in user
  job_uid text,
  title text,
  description text,
  url text,

  -- Budget
  budget_amount text,
  budget_type text,

  -- Job details
  experience_level text,
  posted_date text,
  location text,
  project_length text,
  project_type text,
  proposals text,
  skills text[],

  -- Activity
  last_viewed text,
  interviewing text,
  invites_sent text,

  -- Bid range
  bid_high text,
  bid_avg text,
  bid_low text,

  -- Connects
  connects_required text,
  connects_available text,

  -- Client info
  client_payment_verified boolean default false,
  client_location text,
  client_hire_rate text,
  client_open_jobs text,
  client_total_spent text,
  client_member_since text,
  client_rating text,
  client_reviews text,

  -- Scoring
  score integer,
  score_label text,

  -- Metadata
  extracted_at timestamptz default now(),
  created_at timestamptz default now(),

  -- Unique per user + job combo (allows different users to save same job)
  unique(user_id, job_uid)
);

-- Indexes
create index if not exists idx_upwork_jobs_user on upwork_jobs(user_id);
create index if not exists idx_upwork_jobs_score on upwork_jobs(score desc);
create index if not exists idx_upwork_jobs_created on upwork_jobs(created_at desc);

-- RLS: users can only see/modify their own jobs
alter table upwork_jobs enable row level security;

-- Drop old policies if they exist
drop policy if exists "Allow all access" on upwork_jobs;
drop policy if exists "Users can read own jobs" on upwork_jobs;
drop policy if exists "Users can insert own jobs" on upwork_jobs;
drop policy if exists "Users can update own jobs" on upwork_jobs;
drop policy if exists "Users can delete own jobs" on upwork_jobs;

create policy "Users can read own jobs" on upwork_jobs
  for select using (auth.uid() = user_id);

create policy "Users can insert own jobs" on upwork_jobs
  for insert with check (auth.uid() = user_id);

create policy "Users can update own jobs" on upwork_jobs
  for update using (auth.uid() = user_id);

create policy "Users can delete own jobs" on upwork_jobs
  for delete using (auth.uid() = user_id);
