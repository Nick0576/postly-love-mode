CREATE TABLE public.likes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, post_id)
);

CREATE INDEX idx_likes_post_id ON public.likes(post_id);
CREATE INDEX idx_likes_user_id ON public.likes(user_id);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own likes" ON public.likes FOR INSERT WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "Users can delete their own likes" ON public.likes FOR DELETE USING (
  auth.uid() = user_id
);

CREATE POLICY "Users can view likes" ON public.likes FOR SELECT USING (
  true
);
