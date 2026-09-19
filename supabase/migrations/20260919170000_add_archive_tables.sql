-- Archive Feature Migration

-- Archived Chats table
CREATE TABLE public.archived_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat_partner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX archived_chats_user_idx ON public.archived_chats(user_id);
CREATE INDEX archived_chats_partner_idx ON public.archived_chats(chat_partner_id);
GRANT SELECT, INSERT, DELETE ON public.archived_chats TO authenticated;
GRANT ALL ON public.archived_chats TO service_role;
ALTER TABLE public.archived_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "archived_chats_read_own" ON public.archived_chats FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "archived_chats_insert_own" ON public.archived_chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "archived_chats_delete_own" ON public.archived_chats FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Archived Posts table
CREATE TABLE public.archived_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX archived_posts_user_idx ON public.archived_posts(user_id);
CREATE INDEX archived_posts_post_idx ON public.archived_posts(post_id);
GRANT SELECT, INSERT, DELETE ON public.archived_posts TO authenticated;
GRANT ALL ON public.archived_posts TO service_role;
ALTER TABLE public.archived_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "archived_posts_read_own" ON public.archived_posts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "archived_posts_insert_own" ON public.archived_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "archived_posts_delete_own" ON public.archived_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
