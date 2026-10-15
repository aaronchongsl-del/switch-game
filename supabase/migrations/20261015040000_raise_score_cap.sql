-- Right answers add time, so long runs can score above 20,000. Raise the cap to 200,000; the 800-per-correct-answer check still applies.
alter table public.scores drop constraint scores_score_check;
alter table public.scores add constraint scores_score_check check (score between 0 and 200000);
-- submit_score is replaced with the same body, limit 200000 (see applied migration).
