CREATE TABLE public.stories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text,
  media_url text,
  media_type text CHECK (media_type IN ('image', 'video', 'text')),
  created_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '24 hours') NOT NULL
);

CREATE INDEX idx_stories_user_id ON public.stories(user_id);
CREATE INDEX idx_stories_expires_at ON public.stories(expires_at);

-- Enable row level security
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view all stories" ON public.stories FOR SELECT USING (true);
CREATE POLICY "Users can create own stories" ON public.stories FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete own stories" ON public.stories FOR DELETE USING (auth.uid()::text = user_id::text);
