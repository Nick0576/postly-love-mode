ALTER TABLE public.profiles ADD COLUMN last_seen timestamptz;
ALTER TABLE public.profiles ADD COLUMN is_online boolean DEFAULT false;
