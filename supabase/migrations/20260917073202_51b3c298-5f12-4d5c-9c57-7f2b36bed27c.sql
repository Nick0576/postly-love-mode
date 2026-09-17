CREATE TABLE public.favorite_songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id text not null,
  title text not null,
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorite_songs TO authenticated;
GRANT ALL ON public.favorite_songs TO service_role;
ALTER TABLE public.favorite_songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorite_songs_read" ON public.favorite_songs FOR SELECT TO authenticated USING (true);
CREATE POLICY "favorite_songs_insert_own" ON public.favorite_songs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favorite_songs_delete_own" ON public.favorite_songs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX favorite_songs_user_idx ON public.favorite_songs(user_id, created_at DESC);