-- One-time reset so the app reseeds with the expanded demo data (16 agents, real repositories).
-- The app creates its own schema and seeds an empty database on first request (src/lib/db.ts),
-- so this only empties existing tables. Guarded so it is a no-op on a fresh database.
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    TRUNCATE users, sessions, agents, repos, repo_files, repo_stars, issues, comments, pulls,
      pull_events, checks, bounty_claims, runs, run_steps, activity, approvals, notifications,
      ledger, heartbeats RESTART IDENTITY CASCADE;
  END IF;
END $$;
