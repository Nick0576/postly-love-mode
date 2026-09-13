ALTER TABLE public.posts ADD COLUMN is_pinned boolean DEFAULT false;

ALTER TABLE public.posts ADD CONSTRAINT posts_pinned_unique UNIQUE (user_id, is_pinned) WHERE is_pinned = true;
