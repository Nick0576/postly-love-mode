-- Add column to track when user started Love Mode
ALTER TABLE public.love_answers ADD COLUMN IF NOT EXISTS started_at timestamptz;
